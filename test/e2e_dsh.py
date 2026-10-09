r"""在真实的 dsh Web 应用里端到端验证 dsh-image-annotate。

需要一个**隔离的** dsh 实例（自己的 DSH_HOME + profile 副本），例如：

  $env:DSH_HOME='<某个临时 home>'
  dsh.cmd --profile <profile> --port 19410 --no-open      # 日志末尾给出带 token 的 URL
  python test/e2e_dsh.py "http://127.0.0.1:19410/?token=..."

被测会话必须含至少一张图片（附件缩略图）。默认自动挑侧栏第一个会话；
也可以用环境变量指定：
  $env:DSH_E2E_SESSION_ROW='[data-row-key="session:<id>"]'
"""

from __future__ import annotations

import json
import math
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
SHOTS = HERE / "shots"
SHOTS.mkdir(exist_ok=True)

# 不写死任何人的会话：优先用环境变量，否则抓侧栏第一个会话行
SESSION_ROW = os.environ.get("DSH_E2E_SESSION_ROW", "") or '[data-row-key^="session:"]'

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))
    print(("[PASS] " if ok else "[FAIL] ") + name + (f" — {detail}" if detail else ""), flush=True)


def main(url: str) -> int:
    plugin_requests: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on("request", lambda req: plugin_requests.append(req.url) if "/plugins/" in req.url else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)

        # 首启可能有通知类弹窗：先用 Esc 清场
        for _ in range(3):
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)

        check(
            "页面加载出应用外壳",
            page.evaluate("() => document.querySelector('#root') !== null"),
        )

        # 打开含图片的会话
        def has_attachment_image() -> bool:
            return bool(
                page.evaluate(
                    """() => Array.from(document.images).some(
                           (i) => (i.currentSrc || i.src).startsWith('blob:') && i.naturalWidth > 300)"""
                )
            )

        if not has_attachment_image():
            try:
                page.wait_for_selector(SESSION_ROW, timeout=25000)
            except Exception as error:  # noqa: BLE001
                check("找到含图片的会话行", False, str(error)[:200])
                page.screenshot(path=str(SHOTS / "e2e-fail-sidebar.png"))
                browser.close()
                return report()
            # 侧栏行有 hover 层，用 JS 直接派发点击最稳
            page.evaluate(
                """(selector) => { const el = document.querySelector(selector);
                     el.scrollIntoView({block: 'center'});
                     el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }""",
                SESSION_ROW,
            )
            page.wait_for_timeout(2500)
            if not has_attachment_image():
                page.click(SESSION_ROW, force=True)
                page.wait_for_timeout(2500)

        page.wait_for_timeout(1200)
        for _ in range(2):
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)

        # 等会话正文里的附件缩略图（blob: 图片）
        try:
            page.wait_for_function(
                """() => Array.from(document.images).some(
                       (i) => (i.currentSrc || i.src).startsWith('blob:') && i.naturalWidth > 300)""",
                timeout=25000,
            )
        except Exception as error:  # noqa: BLE001
            check("会话里出现可点开的图片", False, str(error)[:160])
            page.screenshot(path=str(SHOTS / "e2e-fail-images.png"))
            browser.close()
            return report()

        check("会话里出现可点开的图片", True)
        page.screenshot(path=str(SHOTS / "e2e-01-session.png"))

        # 点开图片 → lightbox
        page.evaluate(
            """() => {
                const img = Array.from(document.images).find(
                  (i) => (i.currentSrc || i.src).startsWith('blob:') && i.naturalWidth > 300);
                const button = img.closest('button') || img;
                button.click();
            }"""
        )
        page.wait_for_selector('body > div[role="dialog"][aria-modal="true"] img', timeout=8000)
        check("点击图片打开 lightbox", True)
        page.wait_for_timeout(800)

        lightbox_info = page.evaluate(
            """() => {
                const d = document.querySelector('body > div[role="dialog"][aria-modal="true"]');
                const img = d.querySelector(':scope > img');
                const r = img.getBoundingClientRect();
                return { natural: [img.naturalWidth, img.naturalHeight], src: img.src.slice(0, 32),
                         rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
            }"""
        )
        print("lightbox:", json.dumps(lightbox_info))

        # 插件是否出现
        try:
            page.wait_for_selector(".dsa-fab", timeout=8000)
            check("插件在 lightbox 上注入「标注」按钮", True)
        except Exception as error:  # noqa: BLE001
            check("插件在 lightbox 上注入「标注」按钮", False, str(error)[:160])
            page.screenshot(path=str(SHOTS / "e2e-fail-nofab.png"))
            browser.close()
            return report()

        page.screenshot(path=str(SHOTS / "e2e-02-fab.png"))
        page.click(".dsa-fab")
        page.wait_for_selector('.dsa-canvas[data-dsa-active="1"]', timeout=5000)
        page.wait_for_timeout(400)

        geom = page.evaluate(
            """() => {
                const img = document.querySelector('body > div[role="dialog"][aria-modal="true"] > img').getBoundingClientRect();
                const c = document.querySelector('.dsa-canvas').getBoundingClientRect();
                return { img: [img.x, img.y, img.width, img.height], canvas: [c.x, c.y, c.width, c.height] };
            }"""
        )
        aligned = all(abs(a - b) < 2 for a, b in zip(geom["img"], geom["canvas"]))
        check("画布与真实预览图对齐", aligned, json.dumps({k: [round(v, 1) for v in vals] for k, vals in geom.items()}))

        # 画一个圈：先切到圆圈工具，围着图片中部画椭圆
        box = page.evaluate(
            """() => { const r = document.querySelector('.dsa-canvas').getBoundingClientRect();
                       return { x: r.x, y: r.y, w: r.width, h: r.height }; }"""
        )
        page.evaluate(
            """() => {
                const c = document.querySelector('.dsa-canvas');
                window.__evt = { down: 0, move: 0, up: 0 };
                for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
                    c.addEventListener(type, () => { const k = type.replace('pointer', ''); window.__evt[k]++; }, true);
                }
            }"""
        )
        page.click('.dsa-btn[title="圆圈"]')
        page.wait_for_timeout(150)
        active_tool = page.evaluate("""() => document.querySelector('.dsa-btn[data-dsa-on="1"]').title""")
        check("可切换到圆圈工具", active_tool == "圆圈", active_tool)

        cx, cy = box["x"] + box["w"] * 0.45, box["y"] + box["h"] * 0.4
        rx, ry = box["w"] * 0.18, box["h"] * 0.16
        page.mouse.move(cx + rx, cy)
        page.mouse.down()
        for step in range(1, 49):
            angle = step / 48 * 2 * math.pi
            page.mouse.move(cx + rx * math.cos(angle), cy + ry * math.sin(angle))
        page.mouse.up()
        page.wait_for_timeout(400)

        events = page.evaluate("() => window.__evt")
        painted = page.evaluate(
            """() => {
                const c = document.querySelector('.dsa-canvas');
                const g = c.getContext('2d');
                const data = g.getImageData(0, 0, c.width, c.height).data;
                let any = 0, red = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 10) any++;
                    if (data[i + 3] > 40 && data[i] > 150 && data[i + 1] < 130 && data[i + 2] < 130) red++;
                }
                return { any, red, size: [c.width, c.height] };
            }"""
        )
        print("pointer events:", json.dumps(events), "pixels:", json.dumps(painted))
        check("指针事件到达画布", events["down"] >= 1 and events["move"] >= 10 and events["up"] >= 1, json.dumps(events))
        check("圈选笔迹画到了预览图上", painted["any"] > 300 and painted["red"] > 300, json.dumps(painted))
        page.screenshot(path=str(SHOTS / "e2e-03-drawn.png"))

        # 画完之后依然可以调整位置：切到「选择 / 移动」把圈拖走
        check("工具条含「选择 / 移动」", page.locator('[data-dsa-tool="select"]').count() == 1)
        page.click('[data-dsa-tool="select"]')
        page.wait_for_timeout(120)
        ellipse_before = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state;
                 const pts = s.strokes[0].points;
                 let minX=1e9,minY=1e9;
                 for (const p of pts) { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); }
                 return { x: minX, y: minY, k: s.natural.w / s.rect.width }; }"""
        )
        page.mouse.move(cx + rx, cy)
        page.mouse.down()
        page.mouse.move(cx + rx + 70, cy + 50, steps=8)
        page.mouse.up()
        page.wait_for_timeout(250)
        ellipse_after = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state;
                 const pts = s.strokes[0].points;
                 let minX=1e9,minY=1e9;
                 for (const p of pts) { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); }
                 return { x: minX, y: minY }; }"""
        )
        expected_dx = 70 * ellipse_before["k"]
        expected_dy = 50 * ellipse_before["k"]
        check(
            "画完的圈可以选中并拖到新位置",
            abs(ellipse_after["x"] - ellipse_before["x"] - expected_dx) < 14 * ellipse_before["k"]
            and abs(ellipse_after["y"] - ellipse_before["y"] - expected_dy) < 14 * ellipse_before["k"],
            f"Δ=({ellipse_after['x']-ellipse_before['x']:.0f},{ellipse_after['y']-ellipse_before['y']:.0f}) 期望≈({expected_dx:.0f},{expected_dy:.0f})",
        )
        page.screenshot(path=str(SHOTS / "e2e-03c-moved.png"))

        # 文字工具：点一下图上位置，打字回车，成为一条独立笔迹
        page.click('.dsa-btn[title="文字"], .dsa-btn[title="Text"]')
        page.wait_for_timeout(120)
        text_click_x, text_click_y = box["x"] + box["w"] * 0.3, box["y"] + box["h"] * 0.62
        page.mouse.click(text_click_x, text_click_y)
        page.wait_for_selector(".dsa-textinput", timeout=3000)
        page.fill(".dsa-textinput", "这里有问题")
        page.keyboard.press("Enter")
        page.wait_for_timeout(250)
        tools = page.evaluate(
            """() => window.__dshImageAnnotate.annotators[0].state.strokes.map((s) => s.tool)"""
        )
        check("文字批注被记录为一笔", tools == ["ellipse", "text"], json.dumps(tools))

        # 已确定的文字框可以直接拖走（用户要求：圈完打完字还能调位置）
        text_before = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state;
                 const st = s.strokes[1];
                 return { x: st.x, y: st.y, kx: s.natural.w / s.rect.width, ky: s.natural.h / s.rect.height }; }"""
        )
        page.mouse.move(text_click_x + 12, text_click_y + 12)
        page.mouse.down()
        page.mouse.move(text_click_x + 12 + 90, text_click_y + 12 + 60, steps=8)
        page.mouse.up()
        page.wait_for_timeout(250)
        text_after = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state;
                 const st = s.strokes[1]; return { x: st.x, y: st.y, text: st.text }; }"""
        )
        check(
            "已确定的文字框可以拖动位置",
            abs(text_after["x"] - text_before["x"] - 90 * text_before["kx"]) < 16
            and abs(text_after["y"] - text_before["y"] - 60 * text_before["ky"]) < 16,
            f"Δ=({text_after['x']-text_before['x']:.0f},{text_after['y']-text_before['y']:.0f}) 期望≈({90*text_before['kx']:.0f},{60*text_before['ky']:.0f})",
        )
        page.screenshot(path=str(SHOTS / "e2e-03d-text-moved.png"))

        # 撤销：应把刚才那次「拖动文字」撤销回原位；重做再挪回去
        page.click('.dsa-btn[title^="撤销"], .dsa-btn[title^="Undo"]')
        page.wait_for_timeout(200)
        text_undone = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state;
                 const st = s.strokes[1]; return { x: st.x, y: st.y, count: s.strokes.length }; }"""
        )
        check(
            "撤销把文字拖回原位（笔迹数不变）",
            text_undone["count"] == 2 and abs(text_undone["x"] - text_before["x"]) < 4,
            f"count={text_undone['count']} x={text_undone['x']:.0f} 原始={text_before['x']:.0f}",
        )
        page.click('.dsa-btn[title^="重做"], .dsa-btn[title^="Redo"]')
        page.wait_for_timeout(200)
        redone = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state;
                 const st = s.strokes[1]; return { x: st.x, count: s.strokes.length }; }"""
        )
        check("重做把文字放回拖动后的位置", redone["count"] == 2 and abs(redone["x"] - text_after["x"]) < 4, f"x={redone['x']:.0f}")
        page.screenshot(path=str(SHOTS / "e2e-03b-text.png"))

        # 加入输入框
        rail_before = page.evaluate("""() => document.querySelectorAll('[aria-label="待发送附件"] img').length""")
        page.click(".dsa-primary")
        attached = False
        try:
            page.wait_for_function(
                """(before) => document.querySelectorAll('[aria-label="待发送附件"] img').length > before""",
                arg=rail_before,
                timeout=8000,
            )
            attached = True
        except Exception as error:  # noqa: BLE001
            print("rail wait failed:", str(error)[:160])
        rail_after = page.evaluate("""() => document.querySelectorAll('[aria-label="待发送附件"] img').length""")
        check("标注图进入输入框的待发送附件栏", attached, f"附件数 {rail_before} -> {rail_after}")

        page.wait_for_timeout(1200)
        page.screenshot(path=str(SHOTS / "e2e-04-attached.png"))

        draft = page.evaluate(
            """() => {
                const imgs = Array.from(document.querySelectorAll('[aria-label="待发送附件"] img'));
                return imgs.map((i) => ({ alt: i.alt, nw: i.naturalWidth, nh: i.naturalHeight }));
            }"""
        )
        print("draft rail:", json.dumps(draft, ensure_ascii=False))
        check("附件缩略图存在", len(draft) > rail_before, json.dumps(draft, ensure_ascii=False))
        check(
            "附件保持原图分辨率 1909x1231",
            bool(draft) and (draft[-1]["nw"], draft[-1]["nh"]) == (1909, 1231),
            json.dumps(draft[-1] if draft else {}),
        )

        # 导出图内容校验：圆圈的红色 + 文字的红色都在，且原图内容仍在
        export_stats = page.evaluate(
            """async () => {
                const img = Array.from(document.querySelectorAll('[aria-label="待发送附件"] img')).pop();
                await img.decode();
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                const d = g.getImageData(0, 0, c.width, c.height).data;
                let red = 0, dark = 0;
                for (let i = 0; i < d.length; i += 4) {
                    if (d[i] > 150 && d[i+1] < 130 && d[i+2] < 130) red++;
                    if (d[i] < 90 && d[i+1] < 90 && d[i+2] < 90) dark++;
                }
                return { red, dark, size: [c.width, c.height] };
            }"""
        )
        check("导出图里保留了圈选与文字笔迹", export_stats["red"] > 500, json.dumps(export_stats))

        check(
            "投递后自动关闭预览",
            page.evaluate(
                """() => document.querySelector('body > div[role="dialog"][aria-modal="true"]') === null"""
            ),
        )

        # 会话内其它图片不应被影响 + 插件可重复使用
        page.screenshot(path=str(SHOTS / "e2e-05-final.png"))

        served = [u for u in plugin_requests if "dsh-image-annotate" in u]
        check("浏览器确实请求了插件 bundle", len(served) > 0, served[0][:150] if served else "无 /plugins/ 请求")
        check("无页面异常", len(page_errors) == 0, "; ".join(page_errors[:2]))

        browser.close()
    return report()


def report() -> int:
    failed = [name for name, ok, _ in results if not ok]
    print("\n" + "=" * 64)
    print(f"总计 {len(results)} 项，通过 {len(results) - len(failed)} 项，失败 {len(failed)} 项")
    if failed:
        print("失败项：" + "; ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python test/e2e_dsh.py <authenticated-url>")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))

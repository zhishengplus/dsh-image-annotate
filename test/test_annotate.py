"""dsh-image-annotate 浏览器端功能测试（Playwright + 本地 fixture，不依赖 dsh 运行时）。

覆盖：
  1. 插件工厂被 __ModuleLoader__ 加载，apply() 后 lightbox 上出现「标注」按钮；
  2. 进入标注模式后 canvas 精确贴合原图（含非 1:1 缩放显示）；
  3. 画笔真能画上（像素级验证颜色）；
  4. 撤销能删掉最后一笔；
  5. 「加入输入框」把「原图像素尺寸」的标注图交给 composer 的 paste 入口；
  6. 导出的 PNG 既包含原图（浅灰底），也包含红色笔迹。

用法：python test/test_annotate.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

# 允许用 DSH_TEST_LOCALE=en-US 复现 GitHub runner 的英文环境（CI 就是这么跑的）
LOCALE = os.environ.get("DSH_TEST_LOCALE") or None

HERE = pathlib.Path(__file__).resolve().parent
FIXTURE = (HERE / "lightbox-fixture.html").as_uri()

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))


def red_pixels(page, selector: str, x: int, y: int, w: int, h: int) -> int:
    """统计 canvas 上某个区域内的红色像素数。"""
    return page.evaluate(
        """([selector, x, y, w, h]) => {
            const el = document.querySelector(selector);
            if (!el) return -1;
            const c = document.createElement('canvas');
            c.width = el.naturalWidth || el.width;
            c.height = el.naturalHeight || el.height;
            const g = c.getContext('2d');
            g.drawImage(el, 0, 0);
            const data = g.getImageData(x, y, w, h).data;
            let n = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 170 && data[i + 1] < 130 && data[i + 2] < 130) n++;
            }
            return n;
        }""",
        [selector, x, y, w, h],
    )


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900}, **({"locale": LOCALE} if LOCALE else {}))
        console: list[str] = []
        page.on("console", lambda msg: console.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: console.append(f"pageerror: {err}"))

        page.goto(FIXTURE)
        page.wait_for_timeout(200)

        loaded = page.evaluate("() => (window.__loaded || []).map(e => e.id)")
        check("插件工厂被 __ModuleLoader__ 加载", loaded == ["@dsh-plugin/dsh-image-annotate"], json.dumps(loaded, ensure_ascii=False))

        page.evaluate("() => window.__openLightbox(window.__TEST_IMAGE)")
        page.wait_for_selector(".dsa-fab", timeout=5000)
        check("lightbox 打开后出现「标注」按钮", page.is_visible(".dsa-fab"))

        page.click(".dsa-fab")
        page.wait_for_selector('.dsa-canvas[data-dsa-active="1"]', timeout=3000)
        check("点击后进入标注模式（工具栏 + 交互画布）", page.is_visible(".dsa-bar") and page.is_visible('.dsa-canvas[data-dsa-active="1"]'))

        geom = page.evaluate(
            """() => {
                const img = document.querySelector('.lb-image').getBoundingClientRect();
                const c = document.querySelector('.dsa-canvas').getBoundingClientRect();
                return { img: {x: img.x, y: img.y, w: img.width, h: img.height},
                         canvas: {x: c.x, y: c.y, w: c.width, h: c.height},
                         natural: [document.querySelector('.lb-image').naturalWidth,
                                   document.querySelector('.lb-image').naturalHeight] };
            }"""
        )
        close = (
            abs(geom["img"]["x"] - geom["canvas"]["x"]) < 1.5
            and abs(geom["img"]["y"] - geom["canvas"]["y"]) < 1.5
            and abs(geom["img"]["w"] - geom["canvas"]["w"]) < 1.5
            and abs(geom["img"]["h"] - geom["canvas"]["h"]) < 1.5
        )
        check("画布精确覆盖显示中的原图", close, json.dumps(geom))
        check("原图为 600x400（显示放大到 800x500）", geom["natural"] == [600, 400], str(geom["natural"]))

        # 画一笔：从左上往右下
        box = page.evaluate(
            """() => { const r = document.querySelector('.dsa-canvas').getBoundingClientRect();
                       return {x: r.x, y: r.y, w: r.width, h: r.height}; }"""
        )
        page.mouse.move(box["x"] + 40, box["y"] + 40)
        page.mouse.down()
        for step in range(1, 21):
            page.mouse.move(box["x"] + 40 + step * 8, box["y"] + 40 + step * 4)
        page.mouse.up()
        page.wait_for_timeout(120)

        painted = red_pixels(page, ".dsa-canvas", 0, 0, 800, 500)
        check("画笔在叠加层留下了笔迹", painted > 50, f"红色像素 {painted}")

        # 再画一笔在右下区域，然后撤销，只应撤销掉第二笔
        page.mouse.move(box["x"] + 600, box["y"] + 400)
        page.mouse.down()
        for step in range(1, 15):
            page.mouse.move(box["x"] + 600 - step * 4, box["y"] + 400 - step * 4)
        page.mouse.up()
        page.wait_for_timeout(120)
        before_undo = red_pixels(page, ".dsa-canvas", 480, 300, 320, 200)
        page.click('[data-dsa-action="undo"]')
        page.wait_for_timeout(120)
        after_undo = red_pixels(page, ".dsa-canvas", 480, 300, 320, 200)
        first_kept = red_pixels(page, ".dsa-canvas", 0, 0, 400, 200)
        check("撤销删掉最后一笔", before_undo > 20 and after_undo == 0, f"{before_undo} -> {after_undo}")
        check("撤销保留了第一笔", first_kept > 20, f"红色像素 {first_kept}")

        # 圆圈工具：手绘一整圈并回到起点，也要成形（回归：曾用「起点→终点」判定而塌成 0）
        import math

        page.click('[data-dsa-tool="ellipse"]')
        page.wait_for_timeout(100)
        ex, ey = box["x"] + box["w"] * 0.3, box["y"] + box["h"] * 0.6
        radius = 70
        page.mouse.move(ex + radius, ey)
        page.mouse.down()
        for step in range(1, 49):
            angle = step / 48 * 2 * math.pi
            page.mouse.move(ex + radius * math.cos(angle), ey + radius * math.sin(angle))
        page.mouse.up()
        page.wait_for_timeout(150)
        ellipse_pixels = red_pixels(
            page,
            ".dsa-canvas",
            int(ex - box["x"] - radius - 12),
            int(ey - box["y"] - radius - 12),
            radius * 2 + 24,
            radius * 2 + 24,
        )
        check("圆圈工具（手绘一圈回到起点）成形", ellipse_pixels > 60, f"区域内红色像素 {ellipse_pixels}")

        # 圈完之后撤销掉，保持后面导出用例的笔迹数量不变
        page.click('[data-dsa-action="undo"]')
        page.wait_for_timeout(100)
        ellipse_after_undo = red_pixels(
            page,
            ".dsa-canvas",
            int(ex - box["x"] - radius - 12),
            int(ey - box["y"] - radius - 12),
            radius * 2 + 24,
            radius * 2 + 24,
        )
        check("圆圈可被撤销", ellipse_after_undo == 0, f"撤销后 {ellipse_after_undo}")

        # 加入输入框
        page.click('[data-dsa-action="attach"]')
        page.wait_for_selector("#rail img[data-attachment]", timeout=6000)
        attached = page.evaluate(
            """() => { const img = document.querySelector('#rail img[data-attachment]');
                       return { name: img.dataset.name, nw: img.naturalWidth, nh: img.naturalHeight,
                                count: window.__intake.length }; }"""
        )
        check("标注图被交给输入框的 paste 入口", attached["count"] == 1, json.dumps(attached, ensure_ascii=False))
        check("导出的图是原图像素尺寸 600x400（而非屏幕尺寸）", (attached["nw"], attached["nh"]) == (600, 400), f"{attached['nw']}x{attached['nh']}")
        check("文件名形如 annotated-*.png", str(attached["name"]).startswith("annotated-") and str(attached["name"]).endswith(".png"), attached["name"])

        # 校验导出内容：既有原图浅灰底，又有红色笔迹
        export_stats = page.evaluate(
            """() => {
                const img = document.querySelector('#rail img[data-attachment]');
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                const all = g.getImageData(0, 0, c.width, c.height).data;
                let red = 0, light = 0;
                for (let i = 0; i < all.length; i += 4) {
                    if (all[i] > 170 && all[i+1] < 130 && all[i+2] < 130) red++;
                    if (all[i] > 225 && all[i+1] > 225 && all[i+2] > 225) light++;
                }
                return { red, light, w: c.width, h: c.height, blobs: window.__blobs.length };
            }"""
        )
        check("导出图含红色笔迹", export_stats["red"] > 50, json.dumps(export_stats))
        check("导出图保住了原图内容（浅灰底）", export_stats["light"] > 100000, f"浅色像素 {export_stats['light']}")

        # 附件出现后 lightbox 应关闭
        page.wait_for_timeout(400)
        check("投递成功后自动关闭预览", page.evaluate("() => document.querySelector('.lb-backdrop') === null"))

        page.screenshot(path=str(HERE / "screenshot-fixture.png"))

        errors = [line for line in console if line.startswith("pageerror")]
        check("无页面异常", len(errors) == 0, "; ".join(errors[:3]))

        browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n" + "=" * 60)
    print(f"总计 {len(results)} 项，通过 {len(results) - len(failed)} 项，失败 {len(failed)} 项")
    if failed:
        print("失败项：" + "; ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

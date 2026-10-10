"""绘制之后的编辑能力测试：选中 / 拖动 / 缩放 / 改字 / 删除 / 微调。

用同一套 fixture（test/lightbox-fixture.html），断言直接读标注器状态
（window.__dshImageAnnotate.annotators[0].state），比像素比对更精确。

用法：python test/test_edit.py
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

# fixture：600x400 的原图按 800x500 显示在 (240, 200) —— 两轴缩放不同，必须分开换算
VIEW = {"x": 240.0, "y": 200.0}
SCALE_X = 600 / 800  # 屏幕 -> 原图（x）
SCALE_Y = 400 / 500  # 屏幕 -> 原图（y）

STATE = """() => {
    const a = (window.__dshImageAnnotate || { annotators: [] }).annotators[0];
    if (!a) return null;
    const s = a.state;
    return { tool: s.tool, active: s.active,
             strokes: s.strokes, count: s.strokes.length,
             selected: s.selected ? s.strokes.indexOf(s.selected) : -1,
             past: s.past.length, future: s.future.length };
}"""

BOX = """() => { const s = window.__dshImageAnnotate.annotators[0].state;
     const st = s.selected; if (!st) return null;
     const pts = st.points; let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
     for (const p of pts) { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }
     return { x: minX, y: minY, w: maxX-minX, h: maxY-minY }; }"""

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))
    print(("[PASS] " if ok else "[FAIL] ") + name + (f" — {detail}" if detail else ""), flush=True)


def to_screen(nx: float, ny: float) -> tuple[float, float]:
    return VIEW["x"] + nx / SCALE_X, VIEW["y"] + ny / SCALE_Y


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900}, **({"locale": LOCALE} if LOCALE else {}))
        errors: list[str] = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(FIXTURE)
        page.wait_for_timeout(150)
        page.evaluate("() => window.__openLightbox(window.__TEST_IMAGE)")
        page.wait_for_selector(".dsa-fab", timeout=5000)
        page.click(".dsa-fab")
        page.wait_for_selector('.dsa-canvas[data-dsa-active="1"]', timeout=3000)
        page.wait_for_timeout(300)

        check("工具条上有「选择 / 移动」工具", page.locator('[data-dsa-tool="select"]').count() == 1)
        check("默认工具是画笔", page.evaluate("() => window.__dshImageAnnotate.annotators[0].state.tool") == "pen")

        # ---------- 画一笔，应自动选中 ----------
        page.mouse.move(320, 300)
        page.mouse.down()
        for step in range(1, 16):
            page.mouse.move(320 + step * 12, 300 + step * 6)
        page.mouse.up()
        page.wait_for_timeout(120)
        state = page.evaluate(STATE)
        check("画笔画出 1 笔", state["count"] == 1, json.dumps(state["count"]))
        check("画完自动选中该笔", state["selected"] == 0, f"selected={state['selected']}")

        # ---------- 选择工具：拖动移动 ----------
        page.click('[data-dsa-tool="select"]')
        page.wait_for_timeout(80)
        before = page.evaluate(STATE)["strokes"][0]["points"][0]
        mx, my = to_screen(before["x"], before["y"])
        page.mouse.move(mx + 60, my + 30)  # 落在这条线上
        page.mouse.down()
        page.mouse.move(mx + 60 + 80, my + 30 + 40, steps=8)
        page.mouse.up()
        page.wait_for_timeout(120)
        after = page.evaluate(STATE)["strokes"][0]["points"][0]
        expect_dx = 80 * SCALE_X
        expect_dy = 40 * SCALE_Y
        moved_ok = abs((after["x"] - before["x"]) - expect_dx) < 6 and abs((after["y"] - before["y"]) - expect_dy) < 6
        check(
            "选中后拖动可以移动位置",
            moved_ok,
            f"Δ=({after['x']-before['x']:.0f},{after['y']-before['y']:.0f}) 期望≈({expect_dx:.0f},{expect_dy:.0f})",
        )

        page.click('[data-dsa-action="undo"]')
        page.wait_for_timeout(100)
        undone = page.evaluate(STATE)["strokes"][0]["points"][0]
        check("移动可以撤销", abs(undone["x"] - before["x"]) < 2 and abs(undone["y"] - before["y"]) < 2, json.dumps(undone))
        page.click('[data-dsa-action="redo"]')
        page.wait_for_timeout(120)

        # 重做会清掉选中，重新点选回来
        page.click('[data-dsa-tool="select"]')
        first_point = page.evaluate(STATE)["strokes"][0]["points"][0]
        px, py = to_screen(first_point["x"], first_point["y"])
        page.mouse.click(px, py)
        page.wait_for_timeout(100)
        check("重做后可以重新点选", page.evaluate(STATE)["selected"] == 0)

        # ---------- 四角手柄缩放 ----------
        box = page.evaluate(BOX)
        hx, hy = to_screen(box["x"] + box["w"], box["y"] + box["h"])
        page.mouse.move(hx, hy)
        page.wait_for_timeout(60)
        check(
            "悬停角手柄变成缩放手势",
            page.evaluate("() => document.querySelector('.dsa-canvas').style.cursor") == "nwse-resize",
        )
        page.mouse.down()
        page.mouse.move(hx + 90, hy + 60, steps=8)
        page.mouse.up()
        page.wait_for_timeout(120)
        grown = page.evaluate(BOX)
        check(
            "拖角手柄可以放大",
            grown is not None and grown["w"] > box["w"] * 1.15 and grown["h"] > box["h"] * 1.15,
            f"{box['w']:.0f}x{box['h']:.0f} -> {grown['w']:.0f}x{grown['h']:.0f}" if grown else "selection lost",
        )
        page.click('[data-dsa-action="undo"]')
        page.wait_for_timeout(100)

        # ---------- 文字：新建 / 拖动 / 双击改字 ----------
        page.click('[data-dsa-tool="text"]')
        tx, ty = to_screen(80, 300)
        page.mouse.click(tx, ty)
        page.wait_for_selector(".dsa-textinput", timeout=3000)
        page.fill(".dsa-textinput", "第一版文字")
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        state = page.evaluate(STATE)
        text_index = state["count"] - 1
        text_stroke = state["strokes"][text_index]
        check(
            "文字成为独立笔迹",
            text_stroke["tool"] == "text" and text_stroke["text"] == "第一版文字",
            json.dumps(text_stroke["text"], ensure_ascii=False),
        )
        check("文字量出了宽度（选中框贴合）", text_stroke.get("textWidth", 0) > 20, str(text_stroke.get("textWidth")))

        hx, hy = to_screen(text_stroke["x"] + 10, text_stroke["y"] + 10)
        page.mouse.move(hx, hy)
        page.mouse.down()
        page.mouse.move(hx + 120, hy + 70, steps=8)
        page.mouse.up()
        page.wait_for_timeout(150)
        moved_text = page.evaluate(STATE)["strokes"][text_index]
        check(
            "文字工具里可以直接拖动已确定的文字框",
            abs(moved_text["x"] - text_stroke["x"] - 120 * SCALE_X) < 8
            and abs(moved_text["y"] - text_stroke["y"] - 70 * SCALE_Y) < 8,
            f"Δ=({moved_text['x']-text_stroke['x']:.0f},{moved_text['y']-text_stroke['y']:.0f})",
        )

        hx, hy = to_screen(moved_text["x"] + 8, moved_text["y"] + 8)
        page.mouse.dblclick(hx, hy)
        page.wait_for_selector(".dsa-textinput", timeout=3000)
        check("双击文字进入改字", page.input_value(".dsa-textinput") == "第一版文字", page.input_value(".dsa-textinput"))
        page.fill(".dsa-textinput", "第二版文字")
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        state = page.evaluate(STATE)
        edited = state["strokes"][text_index]
        check("改字后仍是同一笔（不新增）", state["count"] == 2 and edited["text"] == "第二版文字", f"count={state['count']} text={edited['text']}")

        # ---------- 方向键微调 + Delete 删除 ----------
        before_nudge = edited["x"]
        page.keyboard.press("ArrowRight")
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(100)
        nudged = page.evaluate(STATE)["strokes"][text_index]
        check("方向键微调位置", abs(nudged["x"] - before_nudge - 2) < 0.6, f"Δx={nudged['x']-before_nudge:.2f}")

        page.click('[data-dsa-tool="select"]')
        hx, hy = to_screen(nudged["x"] + 8, nudged["y"] + 8)
        page.mouse.click(hx, hy)
        page.wait_for_timeout(100)
        check("选择工具可以点选文字", page.evaluate(STATE)["selected"] == text_index)
        page.keyboard.press("Delete")
        page.wait_for_timeout(120)
        state = page.evaluate(STATE)
        check("Delete 删除选中笔迹", state["count"] == 1, f"count={state['count']}")
        page.click('[data-dsa-action="undo"]')
        page.wait_for_timeout(120)
        check("删除可以撤销", page.evaluate(STATE)["count"] == 2)

        page.screenshot(path=str(HERE / "shots" / "edit-fixture.png"))
        check("无页面异常", len(errors) == 0, "; ".join(errors[:2]))
        browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n" + "=" * 60)
    print(f"总计 {len(results)} 项，通过 {len(results) - len(failed)} 项，失败 {len(failed)} 项")
    if failed:
        print("失败项：" + "; ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

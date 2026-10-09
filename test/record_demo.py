r"""录制演示素材：在一个**全新干净的 dsh 实例**上跑完整标注流程。

隐私要求：素材里不得出现真实工作区 / 会话标题 / 账号 / 头像 / 对话内容。
因此本脚本：
  * 只连一个用全新 DSH_HOME 起的实例（侧栏只有「默认工作区」，未登录）；
  * 被标注的图片是 `docs/sample-ui.png`（脚本合成的中性示例界面）；
  * 图片是通过一次合成 paste 放进输入框的，不涉及任何历史会话。

用法：
  # 干净实例（示例）：
  #   $env:DSH_HOME=<全新 home>
  #   dsh.cmd demo --from-default-profile web --port 19415 --no-open
  python test/record_demo.py "http://127.0.0.1:19415/?token=..." [--out test/shots/video]
"""

from __future__ import annotations

import base64
import math
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SAMPLE = ROOT / "docs" / "sample-ui.png"

# 示例图上的目标元素（示例图自身像素坐标）：「Send invite」按钮
BUTTON = (774, 510)
LABEL_AT = (560, 640)
LABEL_TEXT = "按钮和输入框贴在一起了"


def dismiss_notices(page) -> None:
    """关掉首启说明 / API Key 提示这类遮挡层（干净实例没有凭据，会被问一次）。"""
    for _ in range(6):
        clicked = page.evaluate(
            """() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const pattern = /^(继续|知道了|关闭|稍后配置|稍后再试|Continue|Got it|Configure later|Not now|Later)$/i;
                const hit = buttons.find((b) => pattern.test((b.textContent || '').trim()));
                if (hit) { hit.click(); return (hit.textContent || '').trim(); }
                return null;
            }"""
        )
        if clicked:
            print("dismissed:", clicked)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        covered = page.evaluate(
            """() => {
                const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
                if (!el) return false;
                const text = (el.textContent || '').trim();
                return /预览版说明|API Key|Got it|Continue|Configure later/i.test(text) && text.length < 600;
            }"""
        )
        if not covered:
            return


def paste_sample(page) -> None:
    payload = base64.b64encode(SAMPLE.read_bytes()).decode()
    page.evaluate(
        """(b64) => {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const file = new File([bytes], 'sample-ui.png', { type: 'image/png' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            const editor = document.querySelector('[data-composer-input]');
            editor.focus();
            editor.dispatchEvent(new ClipboardEvent('paste', {
                clipboardData: dataTransfer, bubbles: true, cancelable: true, composed: true
            }));
        }""",
        payload,
    )


def main(url: str) -> int:
    video_dir = ROOT / "test" / "shots" / "video"
    video_dir.mkdir(parents=True, exist_ok=True)
    for stale in video_dir.glob("*.webm"):
        stale.unlink()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=str(video_dir),
            record_video_size={"width": 1440, "height": 900},
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(6000)
        dismiss_notices(page)
        page.wait_for_timeout(800)

        # 1) 把示例图粘进输入框 → 草稿缩略图
        paste_sample(page)
        page.wait_for_selector('[aria-label="待发送附件"] img, [aria-label="Attachments"] img', timeout=8000)
        page.wait_for_timeout(1200)

        # 2) 点缩略图打开原图预览
        page.evaluate(
            """() => {
                const img = document.querySelector('[aria-label="待发送附件"] img, [aria-label="Attachments"] img');
                (img.closest('button') || img).click();
            }"""
        )
        page.wait_for_selector('body > div[role="dialog"][aria-modal="true"] img', timeout=8000)
        page.wait_for_timeout(1000)

        # 3) 进入标注模式
        page.click(".dsa-fab")
        page.wait_for_selector('.dsa-canvas[data-dsa-active="1"]', timeout=5000)
        page.wait_for_timeout(700)

        rect = page.evaluate(
            """() => { const r = document.querySelector('.dsa-canvas').getBoundingClientRect();
                       return { x: r.x, y: r.y, w: r.width, h: r.height }; }"""
        )
        natural = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state; return { w: s.natural.w, h: s.natural.h }; }"""
        )
        kx, ky = rect["w"] / natural["w"], rect["h"] / natural["h"]
        to_screen = lambda x, y: (rect["x"] + x * kx, rect["y"] + y * ky)  # noqa: E731

        # 4) 圈住那个按钮
        page.click('.dsa-btn[title="圆圈"], .dsa-btn[title="Circle"]')
        page.wait_for_timeout(400)
        cx, cy = to_screen(*BUTTON)
        rx, ry = 118 * kx, 62 * ky
        page.mouse.move(cx + rx, cy)
        page.mouse.down()
        for step in range(1, 73):
            angle = step / 72 * 2 * math.pi
            page.mouse.move(cx + rx * math.cos(angle), cy + ry * math.sin(angle))
            page.wait_for_timeout(8)
        page.mouse.up()
        page.wait_for_timeout(700)

        # 5) 写一行说明
        page.click('.dsa-btn[title="文字"], .dsa-btn[title="Text"]')
        page.wait_for_timeout(350)
        lx, ly = to_screen(*LABEL_AT)
        page.mouse.click(lx, ly)
        page.wait_for_selector(".dsa-textinput", timeout=4000)
        page.type(".dsa-textinput", LABEL_TEXT, delay=80)
        page.wait_for_timeout(300)
        page.keyboard.press("Enter")
        page.wait_for_timeout(800)

        # 6) 选中后拖走：先挪圈，再挪文字（演示「画完还能调」）
        page.click('[data-dsa-tool="select"]')
        page.wait_for_timeout(350)
        page.mouse.move(cx + rx, cy)
        page.mouse.down()
        page.mouse.move(cx + rx + 70, cy + 60, steps=14)
        page.wait_for_timeout(250)
        page.mouse.up()
        page.wait_for_timeout(700)

        page.mouse.move(lx + 40, ly + 20)
        page.mouse.down()
        page.mouse.move(lx + 40 + 150, ly + 20 + 60, steps=14)
        page.wait_for_timeout(250)
        page.mouse.up()
        page.wait_for_timeout(900)
        page.screenshot(path=str(ROOT / "docs" / "demo-move-text.png"))

        # 7) 加入输入框 → 预览关闭，附件栏出现标注图
        page.click(".dsa-primary")
        page.wait_for_timeout(2500)
        dismiss_notices(page)
        page.wait_for_timeout(600)
        page.screenshot(path=str(ROOT / "docs" / "demo-attached.png"))

        context.close()
        browser.close()

    videos = sorted(video_dir.glob("*.webm"))
    print("video:", videos[-1] if videos else "(none)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))

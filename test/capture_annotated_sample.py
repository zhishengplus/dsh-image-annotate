r"""在干净实例上跑一遍标注流程，并把插件导出的那张 PNG 存下来（README 素材用）。

产出 docs/annotated-sample.png —— 就是「加入输入框」后模型收到的那张图，
原分辨率、无任何界面边框，比截屏更干净。

前置：一个全新 DSH_HOME 起的隔离实例（侧栏只有默认工作区、未登录）：
    dsh.cmd demo --from-default-profile web --port 19415 --no-open
用法：
    python test/capture_annotated_sample.py "http://127.0.0.1:19415/?token=..."
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
OUTPUT = ROOT / "docs" / "annotated-sample.png"

BUTTON = (774, 510)
LABEL_AT = (560, 640)
LABEL_TEXT = "按钮和输入框贴在一起了"


def dismiss_notices(page) -> None:
    for _ in range(6):
        clicked = page.evaluate(
            """() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const pattern = /^(继续|知道了|关闭|稍后配置|Continue|Got it|Configure later|Not now|Later)$/i;
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
                return el ? /预览版说明|API Key|Got it|Continue|Configure later/i.test((el.textContent || '').trim()) : false;
            }"""
        )
        if not covered:
            return


def main(url: str) -> int:
    payload = base64.b64encode(SAMPLE.read_bytes()).decode()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(6000)
        dismiss_notices(page)

        # 把示例图放进输入框 → 点缩略图 → 标注
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
        page.wait_for_selector('[aria-label="待发送附件"] img, [aria-label="Attachments"] img', timeout=8000)
        page.wait_for_timeout(1000)
        page.evaluate(
            """() => {
                const img = document.querySelector('[aria-label="待发送附件"] img, [aria-label="Attachments"] img');
                (img.closest('button') || img).click();
            }"""
        )
        page.wait_for_selector('body > div[role="dialog"][aria-modal="true"] img', timeout=8000)
        page.wait_for_timeout(800)
        page.click(".dsa-fab")
        page.wait_for_timeout(700)

        rect = page.evaluate(
            """() => { const r = document.querySelector('.dsa-canvas').getBoundingClientRect();
                       return { x: r.x, y: r.y, w: r.width, h: r.height }; }"""
        )
        natural = page.evaluate(
            """() => { const s = window.__dshImageAnnotate.annotators[0].state; return { w: s.natural.w, h: s.natural.h }; }"""
        )
        kx, ky = rect["w"] / natural["w"], rect["h"] / natural["h"]
        cx, cy = rect["x"] + BUTTON[0] * kx, rect["y"] + BUTTON[1] * ky

        # 圈住按钮
        page.click('.dsa-btn[title="圆圈"], .dsa-btn[title="Circle"]')
        page.wait_for_timeout(300)
        rx, ry = 118 * kx, 62 * ky
        page.mouse.move(cx + rx, cy)
        page.mouse.down()
        for step in range(1, 49):
            angle = step / 48 * 2 * math.pi
            page.mouse.move(cx + rx * math.cos(angle), cy + ry * math.sin(angle))
        page.mouse.up()
        page.wait_for_timeout(500)

        # 写一行说明
        page.click('.dsa-btn[title="文字"], .dsa-btn[title="Text"]')
        page.wait_for_timeout(250)
        page.mouse.click(rect["x"] + LABEL_AT[0] * kx, rect["y"] + LABEL_AT[1] * ky)
        page.wait_for_selector(".dsa-textinput", timeout=4000)
        page.type(".dsa-textinput", LABEL_TEXT, delay=60)
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)

        # 加入输入框 → 取回导出的那张 PNG
        before = page.evaluate("""() => document.querySelectorAll('[aria-label="待发送附件"] img, [aria-label="Attachments"] img').length""")
        page.click(".dsa-primary")
        page.wait_for_function(
            """(n) => document.querySelectorAll('[aria-label="待发送附件"] img, [aria-label="Attachments"] img').length > n""",
            arg=before,
            timeout=10000,
        )
        page.wait_for_timeout(1200)
        encoded = page.evaluate(
            """async () => {
                const imgs = Array.from(document.querySelectorAll('[aria-label="待发送附件"] img, [aria-label="Attachments"] img'));
                const img = imgs[imgs.length - 1];
                const buffer = await (await fetch(img.src)).arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                }
                return { name: img.alt, data: btoa(binary) };
            }"""
        )
        OUTPUT.write_bytes(base64.b64decode(encoded["data"]))
        print("saved:", OUTPUT.name, f"{OUTPUT.stat().st_size / 1024:.0f} KB", "from", encoded["name"])
        browser.close()
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))

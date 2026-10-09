"""生成一张中性的「示例界面」图，用于演示素材（不含任何真实工作区 / 会话 / 个人信息）。

画的是一个假 SaaS 面板：顶栏 + 侧栏 + 两张卡片 + 一个故意做歪的按钮（演示里圈它）。

用法：python test/make_demo_image.py [输出路径]
"""

from __future__ import annotations

import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

W, H = 1240, 820
BG = (247, 248, 250)
CARD = (255, 255, 255)
LINE = (228, 231, 236)
TEXT = (28, 32, 38)
MUTED = (128, 136, 148)
ACCENT = (77, 107, 254)
OK = (34, 197, 94)

FONT_DIR = pathlib.Path(r"C:\Windows\Fonts")


def font(name: str, size: int):
    for candidate in (name, "segoeui.ttf", "arial.ttf"):
        path = FONT_DIR / candidate
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    return ImageFont.load_default()


def main() -> int:
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "docs/sample-ui.png")
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)

    f_title = font("seguisb.ttf", 22)
    f_head = font("seguisb.ttf", 15)
    f_body = font("segoeui.ttf", 14)
    f_small = font("segoeui.ttf", 12)
    f_btn = font("seguisb.ttf", 14)

    # 顶栏
    draw.rectangle([0, 0, W, 58], fill=CARD)
    draw.line([0, 58, W, 58], fill=LINE)
    draw.text((24, 17), "Acme Analytics", font=f_title, fill=TEXT)
    for index, item in enumerate(["Overview", "Reports", "Segments", "Settings"]):
        x = 300 + index * 110
        draw.text((x, 21), item, font=f_body, fill=ACCENT if index == 1 else MUTED)
    draw.ellipse([W - 46, 15, W - 18, 43], fill=(214, 220, 230))

    # 侧栏
    draw.rectangle([0, 58, 208, H], fill=CARD)
    draw.line([208, 58, 208, H], fill=LINE)
    draw.text((24, 84), "WORKSPACE", font=f_small, fill=MUTED)
    for index, item in enumerate(["Dashboard", "Customers", "Invoices", "Exports", "API keys"]):
        y = 112 + index * 38
        if index == 0:
            draw.rounded_rectangle([12, y - 8, 196, y + 22], radius=8, fill=(238, 242, 255))
        draw.text((28, y), item, font=f_body, fill=ACCENT if index == 0 else TEXT)

    # 卡片一：柱状图
    draw.rounded_rectangle([232, 84, 704, 372], radius=14, fill=CARD, outline=LINE)
    draw.text((256, 106), "Monthly revenue", font=f_head, fill=TEXT)
    draw.text((256, 130), "Last 12 months", font=f_small, fill=MUTED)
    bars = [0.42, 0.55, 0.48, 0.66, 0.58, 0.72, 0.61, 0.78, 0.69, 0.85, 0.74, 0.92]
    for index, value in enumerate(bars):
        x = 262 + index * 36
        top = 340 - int(value * 170)
        draw.rounded_rectangle([x, top, x + 22, 340], radius=5, fill=ACCENT if index == 11 else (206, 216, 250))

    # 卡片二：表格
    draw.rounded_rectangle([728, 84, 1208, 372], radius=14, fill=CARD, outline=LINE)
    draw.text((752, 106), "Recent orders", font=f_head, fill=TEXT)
    draw.line([752, 136, 1184, 136], fill=LINE)
    rows = [("#10428", "$1,280.00", "Paid"), ("#10427", "$640.00", "Paid"), ("#10426", "$2,140.00", "Pending"), ("#10425", "$318.00", "Paid")]
    for index, (order, amount, status) in enumerate(rows):
        y = 152 + index * 44
        draw.text((752, y), order, font=f_body, fill=TEXT)
        draw.text((880, y), amount, font=f_body, fill=TEXT)
        color = OK if status == "Paid" else (245, 158, 11)
        draw.rounded_rectangle([1010, y - 4, 1090, y + 20], radius=6, fill=color + (36,) if False else (235, 245, 238))
        draw.text((1020, y), status, font=f_small, fill=color)
        draw.line([752, y + 30, 1184, y + 30], fill=(240, 242, 245))

    # 卡片三：设置面板（这里放一个「故意没对齐」的按钮，供演示圈注）
    draw.rounded_rectangle([232, 396, 1208, 620], radius=14, fill=CARD, outline=LINE)
    draw.text((256, 418), "Workspace settings", font=f_head, fill=TEXT)
    draw.text((256, 448), "Invite teammates and choose who can publish reports.", font=f_body, fill=MUTED)
    draw.rounded_rectangle([256, 486, 700, 526], radius=8, fill=(245, 247, 250), outline=LINE)
    draw.text((272, 498), "name@company.com", font=f_body, fill=MUTED)
    # 故意歪一点、并且文字被挤到的按钮 —— 演示要圈的「问题」
    draw.rounded_rectangle([706, 489, 842, 531], radius=8, fill=ACCENT)
    draw.text((720, 501), "Send invite", font=f_btn, fill=(255, 255, 255))
    draw.rounded_rectangle([256, 552, 340, 588], radius=8, outline=LINE)
    draw.text((272, 562), "Cancel", font=f_body, fill=MUTED)
    draw.text((852, 500), "← button overlaps the field on narrow widths", font=f_small, fill=(200, 90, 90))

    # 底部
    draw.text((232, 660), "Tip: annotate this screenshot to point at the exact element.", font=f_small, fill=MUTED)
    draw.rounded_rectangle([232, 700, 420, 752], radius=10, fill=(238, 242, 255))
    draw.text((254, 716), "Getting started", font=f_btn, fill=ACCENT)

    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out)
    print(f"{out}  {image.size[0]}x{image.size[1]}  {out.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

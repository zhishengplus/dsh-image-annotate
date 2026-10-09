"""生成 README 用的视觉素材（可重复生成，不含任何个人信息）。

产出：
  docs/banner.png       顶部横幅：英文名 + 中文名 + 一句话 + 手绘圈注示意
  docs/before-after.png 「原始截图 → 标注后」对比图（右侧取自真实录制画面）

用法：python test/make_readme_assets.py
"""

from __future__ import annotations

import math
import pathlib
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
FONTS = pathlib.Path(r"C:\Windows\Fonts")

ACCENT = (122, 162, 255)
INK = (255, 255, 255)
MUTED = (169, 180, 198)
RED = (229, 72, 77)


def font(names: list[str], size: int):
    for name in names:
        path = FONTS / name
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size, index=0)
            except OSError:
                continue
    return ImageFont.load_default()


def latin(size: int, bold: bool = True):
    return font(["seguisb.ttf", "segoeui.ttf", "arialbd.ttf"], size) if bold else font(["segoeui.ttf", "arial.ttf"], size)


def cjk(size: int, bold: bool = True):
    return font(["msyhbd.ttc", "msyh.ttc", "simhei.ttf"], size) if bold else font(["msyh.ttc", "simhei.ttf"], size)


def wobbly_ellipse(draw: ImageDraw.ImageDraw, box, colour, width, jitter=3.0, seed=7):
    """手绘感椭圆：沿椭圆路径加一点噪声，再重叠描两遍。"""
    rng = random.Random(seed)
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
    for pass_index in range(2):
        points = []
        steps = 96
        for i in range(steps + 1):
            angle = i / steps * 2 * math.pi
            wobble = 1 + rng.uniform(-0.012, 0.012) + pass_index * 0.004
            points.append((cx + rx * wobble * math.cos(angle), cy + ry * wobble * math.sin(angle)))
        draw.line(points, fill=colour, width=width, joint="curve")


def banner() -> pathlib.Path:
    width, height = 1600, 470
    image = Image.new("RGB", (width, height), (10, 13, 24))
    draw = ImageDraw.Draw(image)

    # 深色渐变底 + 左上角一团光晕
    for y in range(height):
        ratio = y / height
        draw.line(
            [(0, y), (width, y)],
            fill=(int(12 + 16 * ratio), int(15 + 22 * ratio), int(26 + 46 * ratio)),
        )
    glow = Image.new("L", (width, height), 0)
    ImageDraw.Draw(glow).ellipse([-260, -300, 900, 520], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    image = Image.composite(Image.new("RGB", (width, height), (40, 66, 150)), image, glow)
    draw = ImageDraw.Draw(image)

    # 左侧文案
    draw.text((92, 92), "dsh-image-annotate", font=latin(66), fill=INK)
    draw.text((96, 182), "图片标注笔", font=cjk(52), fill=ACCENT)
    draw.text((98, 262), "截图说不清的地方，圈一下就好了。", font=cjk(27, bold=False), fill=MUTED)
    draw.text(
        (98, 312),
        "Circle it. Label it. Move it. Send it to the model.",
        font=latin(21, bold=False),
        fill=(126, 138, 158),
    )

    # 小徽章
    pill = (98, 366, 470, 414)
    draw.rounded_rectangle(pill, radius=24, fill=(26, 34, 60), outline=(60, 78, 130))
    draw.text((124, 378), "DeepSeek Harness Plugin", font=latin(19, bold=False), fill=(196, 208, 232))

    # 右侧：一张「截图卡片」，上面有一个被圈出来的按钮
    card = (980, 96, 1520, 386)
    draw.rounded_rectangle([card[0] + 6, card[1] + 10, card[2] + 6, card[3] + 10], radius=18, fill=(6, 8, 16))
    draw.rounded_rectangle(card, radius=18, fill=(247, 248, 250))
    draw.rounded_rectangle([card[0], card[1], card[2], card[1] + 46], radius=18, fill=(255, 255, 255))
    draw.line([card[0], card[1] + 46, card[2], card[1] + 46], fill=(226, 230, 236))
    draw.text((card[0] + 26, card[1] + 13), "Preview", font=latin(19), fill=(40, 46, 58))
    for index, colour in enumerate([(214, 220, 230), (214, 220, 230), (214, 220, 230)]):
        x = card[2] - 44 - index * 26
        draw.ellipse([x, card[1] + 14, x + 18, card[1] + 32], fill=colour)
    # 卡片里的「界面」线条
    for index in range(5):
        y = card[1] + 78 + index * 34
        draw.rounded_rectangle([card[0] + 30, y, card[0] + 300 - index * 18, y + 14], radius=7, fill=(228, 232, 238))
    button = (card[0] + 348, card[1] + 150, card[0] + 470, card[1] + 190)
    draw.rounded_rectangle(button, radius=10, fill=(77, 107, 254))
    draw.text((button[0] + 20, button[1] + 10), "Send", font=latin(19), fill=(255, 255, 255))
    # 圈它 + 箭头 + 手写批注
    wobbly_ellipse(draw, (button[0] - 34, button[1] - 26, button[2] + 40, button[3] + 28), RED, 6)
    draw.line([(button[2] + 60, button[3] + 52), (button[2] + 150, button[3] + 112)], fill=RED, width=6)
    draw.polygon(
        [
            (button[2] + 150, button[3] + 112),
            (button[2] + 122, button[3] + 104),
            (button[2] + 138, button[3] + 88),
        ],
        fill=RED,
    )
    draw.text((button[0] - 24, button[3] + 104), "button overlaps the field", font=latin(20, bold=False), fill=RED)

    out = DOCS / "banner.png"
    image.save(out, optimize=True)
    return out


def before_after() -> pathlib.Path:
    """左：干净的示例截图；右：插件真正导出的标注图（由 capture_annotated_sample.py 生成）。"""
    before = Image.open(DOCS / "sample-ui.png").convert("RGB")
    after = Image.open(DOCS / "annotated-sample.png").convert("RGB")

    target_w = 660
    before = before.resize((target_w, round(before.height * target_w / before.width)), Image.LANCZOS)
    after = after.resize((target_w, round(after.height * target_w / after.width)), Image.LANCZOS)

    gap, caption_h, pad = 92, 74, 34
    width = pad * 2 + target_w * 2 + gap
    height = pad * 2 + caption_h + max(before.height, after.height)
    canvas = Image.new("RGB", (width, height), (247, 248, 250))
    draw = ImageDraw.Draw(canvas)

    def paste(image: Image.Image, x: int, caption: str, colour):
        shadow = Image.new("RGB", (image.width + 12, image.height + 12), (232, 234, 238))
        canvas.paste(shadow, (x + 4, pad + caption_h - 6))
        canvas.paste(image, (x, pad + caption_h))
        draw.rounded_rectangle(
            [x, pad + caption_h - 6, x + image.width, pad + caption_h + image.height],
            radius=10,
            outline=(226, 229, 235),
        )
        draw.text((x, pad + 22), caption, font=cjk(26), fill=colour)

    paste(before, pad, "原始截图", (108, 116, 130))
    paste(after, pad + target_w + gap, "标注后 · 一键加进输入框", (77, 107, 254))

    arrow_y = pad + caption_h + before.height // 2
    arrow_x = pad + target_w + gap // 2
    draw.line([(arrow_x - 26, arrow_y), (arrow_x + 26, arrow_y)], fill=(150, 158, 172), width=5)
    draw.polygon([(arrow_x + 26, arrow_y), (arrow_x + 6, arrow_y - 12), (arrow_x + 6, arrow_y + 12)], fill=(150, 158, 172))

    out = DOCS / "before-after.png"
    canvas.save(out, optimize=True)
    return out


def main() -> int:
    DOCS.mkdir(exist_ok=True)
    for path in (banner(), before_after()):
        print(f"{path.relative_to(ROOT)}  {Image.open(path).size}  {path.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

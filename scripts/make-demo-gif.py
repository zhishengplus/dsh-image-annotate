#!/usr/bin/env python3
"""把 playwright 录的 webm 变成 README 用的 GIF。

Playwright 自带的 ffmpeg 是精简版（只有 webm/vp8 + png 序列，没有 gif muxer），
所以拆成两步：ffmpeg 抽帧 → Pillow 合成带调色板的 GIF。

用法：
    python scripts/make-demo-gif.py <input.webm> <output.gif> [--start 5.2] [--duration 15.5] [--width 760] [--fps 8]

ffmpeg 路径优先取 $FFMPEG，其次 ms-playwright 目录下的 ffmpeg-win64.exe。
"""

from __future__ import annotations

import argparse
import glob
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

from PIL import Image


def find_ffmpeg() -> str:
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    local = pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright"
    for candidate in sorted(local.glob("ffmpeg-*/ffmpeg-win64.exe")):
        return str(candidate)
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise SystemExit("找不到 ffmpeg：设置 $FFMPEG 或安装 ffmpeg")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("output")
    parser.add_argument("--start", type=float, default=0.0)
    parser.add_argument("--duration", type=float, default=0.0)
    parser.add_argument("--width", type=int, default=760)
    parser.add_argument("--fps", type=int, default=8)
    parser.add_argument("--colors", type=int, default=64)
    args = parser.parse_args()

    ffmpeg = find_ffmpeg()
    with tempfile.TemporaryDirectory() as tmp:
        command = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
        if args.start:
            command += ["-ss", str(args.start)]
        if args.duration:
            command += ["-t", str(args.duration)]
        command += [
            "-i", args.source,
            # Playwright 的精简 ffmpeg 没有 fps 滤镜，用输出帧率 -r 代替
            "-r", str(args.fps),
            "-vf", f"scale={args.width}:-2:flags=lanczos",
            "-f", "image2",
            os.path.join(tmp, "f%04d.png"),
        ]
        subprocess.run(command, check=True)

        frames = sorted(glob.glob(os.path.join(tmp, "f*.png")))
        if not frames:
            raise SystemExit("没有抽到任何帧")

        images = [Image.open(path).convert("RGB") for path in frames]
        # 逐帧自适应调色板：用第一帧的调色板会把后面才出现的红笔/蓝按钮压成深灰。
        converted = [
            image.quantize(colors=args.colors, method=Image.MEDIANCUT) for image in images
        ]
        converted[0].save(
            args.output,
            save_all=True,
            append_images=converted[1:],
            duration=int(1000 / args.fps),
            loop=0,
            optimize=True,
            disposal=2,
        )

    size = pathlib.Path(args.output).stat().st_size
    print(f"{args.output}: {len(frames)} frames, {size / 1024 / 1024:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

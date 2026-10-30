# Builds the app icons and splash images in assets/images from assets/first-report-icon-light.png.
# Run from apps/mobile:  uv run --with pillow --with numpy python scripts/build-icons.py assets assets/images
# The mark is pulled out as an anti-aliased alpha mask, then recoloured flat and placed on clean canvases.
import sys
from pathlib import Path
from PIL import Image
import numpy as np

SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
BG = np.array([250, 248, 244]); INK = {"left": np.array([26, 28, 32]), "right": np.array([196, 61, 47])}
SPLIT = 630  # the gap between the two panels, in source pixels

im = np.asarray(Image.open(SRC / "first-report-icon-light.png").convert("RGB")).astype(float)
crop = (slice(260, 1000), slice(270, 990))
im = im[crop]
split = SPLIT - 270
alpha = np.zeros(im.shape[:2])
for side, xs in (("left", slice(0, split)), ("right", slice(split, None))):
    c = INK[side] - BG
    a = ((im[:, xs] - BG) @ c) / (c @ c)
    alpha[:, xs] = a
alpha = np.clip((alpha - 0.06) / 0.88, 0, 1)
ys, xs = np.nonzero(alpha > 0.02)
alpha = alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
split -= xs.min()
H, W = alpha.shape
print("mark", W, "x", H, "split", split)

def mark(left, right):
    rgb = np.zeros((H, W, 3)); rgb[:, :split] = left; rgb[:, split:] = right
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")

def place(m, size, height_share, bg=None):
    h = round(size * height_share); w = round(W * h / H)
    canvas = Image.new("RGBA", (size, size), (*bg, 255) if bg is not None else (0, 0, 0, 0))
    m = m.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - w) // 2, (size - h) // 2))
    return canvas

hex_ = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
LIGHT = mark(hex_("#1A1C20"), hex_("#C43D2F"))
DARK = mark(hex_("#FEFCF7"), hex_("#D03F2F"))
TINT = mark(hex_("#FFFFFF"), hex_("#A6A6A6"))
MONO = mark(hex_("#FFFFFF"), hex_("#FFFFFF"))

place(LIGHT, 1024, 0.56, hex_("#FAF8F4")).convert("RGB").save(OUT / "icon.png")
place(DARK, 1024, 0.56).save(OUT / "icon-dark.png")
place(TINT, 1024, 0.56).save(OUT / "icon-tinted.png")
# Android masks the adaptive foreground to the inner 66/108; the mark stays inside it.
place(LIGHT, 1024, 0.40).save(OUT / "adaptive-icon.png")
place(MONO, 1024, 0.40).save(OUT / "adaptive-monochrome.png")
# Android 12+ crops the splash icon to a circle two-thirds of the canvas wide.
place(LIGHT, 1024, 0.48).save(OUT / "splash-icon.png")
place(DARK, 1024, 0.48).save(OUT / "splash-icon-dark.png")

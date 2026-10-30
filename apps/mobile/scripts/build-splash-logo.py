# Builds the light and dark splash logos in assets/images from assets/first-report-logo-light.png.
# Run from apps/mobile:  uv run --with pillow --with numpy python scripts/build-splash-logo.py assets assets/images
# Each pixel is split into one flat ink (dark, red or tagline grey) plus coverage, so the logo
# can sit on any background and be recoloured for dark mode with the same edges.
import sys
from pathlib import Path
from PIL import Image
import numpy as np

SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
# The "NEWS · CONTEXT · PERSPECTIVE" line, in source pixels; the panels to its left reach as low.
TAGLINE_TOP, TAGLINE_LEFT = 462, 740

im = np.asarray(Image.open(SRC / "first-report-logo-light.png").convert("RGB")).astype(float)
bg = np.median(im[:60].reshape(-1, 3), axis=0)
ink = {"dark": np.array([19, 25, 28.0]), "red": np.array([200, 57, 37.0]), "grey": np.array([121, 129, 138.0])}

def coverage(pixels, colour):
    c = colour - bg
    a = np.clip(((pixels - bg) @ c) / (c @ c), 0, 1)
    residual = np.linalg.norm(pixels - (bg + a[..., None] * c), axis=-1)
    return a, residual

# Dark or red, whichever explains the pixel better; the tagline is grey.
(a_dark, r_dark), (a_red, r_red) = coverage(im, ink["dark"]), coverage(im, ink["red"])
red = r_red < r_dark
alpha = np.where(red, a_red, a_dark)
label = red.astype(int)  # 0 dark, 1 red, 2 grey
tag = (slice(TAGLINE_TOP, None), slice(TAGLINE_LEFT, None))
alpha[tag], _ = coverage(im[tag], ink["grey"])
label[tag] = 2
alpha = np.clip((alpha - 0.06) / 0.88, 0, 1)

ys, xs = np.nonzero(alpha > 0.02)
pad = 8
box = (slice(ys.min() - pad, ys.max() + 1 + pad), slice(xs.min() - pad, xs.max() + 1 + pad))
alpha, label = alpha[box], label[box]
print("logo", alpha.shape[1], "x", alpha.shape[0])

def logo(colours):
    rgb = np.array(colours, dtype=float)[label]
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")

hex_ = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
logo([hex_("#13191C"), hex_("#C8392A"), hex_("#79818A")]).save(OUT / "splash-logo.png")
logo([hex_("#FEFCF7"), hex_("#D03F2F"), hex_("#A3ACB4")]).save(OUT / "splash-logo-dark.png")

"""Fit chris's Gemini-drawn house art onto the map grid (888x704, 8 px per cell).

The art and the traced floor plan differ slightly in proportion, so the warp is separable
and piecewise linear: matching wall centers in the art (src) and on the grid (dst) are pinned.
    python3 warp_art.py   -> main-floor-adventure.png
"""
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 888, 704
# (grid px, art px) for wall centers
XS = [(36, 49), (268, 364), (404, 547), (484, 655), (852, 1149)]
YS = [(36, 48), (220, 275), (252, 316), (284, 356), (328, 411), (556, 711), (604, 774)]

def interp(pts, v):
    for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
        if v <= a1 or (a1, b1) == pts[-1]:
            return b0 + (v - a0) * (b1 - b0) / (a1 - a0)

def build(src_path, out_path):
    src = Image.open(src_path).convert('RGB'); sw, sh = src.size; sp = src.load()
    out = Image.new('RGB', (W, H)); op = out.load()
    xm = [min(sw - 1, max(0, round(interp(XS, x + .5)))) for x in range(W)]
    ym = [min(sh - 1, max(0, round(interp(YS, y + .5)))) for y in range(H)]
    for y in range(H):
        for x in range(W):
            op[x, y] = sp[xm[x], ym[y]]
    # 256-color palette, no dithering: same look at a third of the size (it's embedded in the card)
    out.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out_path, optimize=True)
    return out

if __name__ == '__main__':
    build(os.path.join(HERE, 'art', 'gemini-reference.png'), os.path.join(HERE, 'main-floor-adventure.png'))
    print('wrote main-floor-adventure.png')

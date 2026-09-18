"""Take the red out of a creature's frames - for the ones that are not gory.

A video model paints a raw pink into leg tips and joints now and then (the spider's Wan rear-up:
red tips on the raised legs), and the tone pass then saturates it. This pulls every red or pink
pixel - warm, with blue at or above green - down to a dark desaturated brown, and leaves
the amber eyes (blue far below green) alone. Run after art:video, before art:optimize:

    python3 tools/art-unred.py assets/art/enemy-spider-mutant-rear-fidget-*.png

Python 3 with Pillow (`python3` on the owner's machine).
"""
import sys
from PIL import Image

def amber(r, g, b, a):
    # What the game's eye-glow finder keys on (textures.ts findGlowPoints): never touched.
    return a > 200 and r > 170 and 80 < g < 210 and b < 100 and r - b > 110


def red(r, g, b, a):
    # Red and pink have blue at or above green (a magenta cast); the dark brown fur has blue
    # below green. Crushed reds like (30, 0, 0) count too. A motion smear reads orange: red
    # more than twice green - which a dark amber rim can be too, so amber is excluded first.
    return a > 60 and not amber(r, g, b, a) and ((r > g + 8 and b >= g) or r > 2 * g + 8)

for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if red(r, g, b, a):
                lum = int(0.45 * r + 0.4 * g + 0.15 * b)
                px[x, y] = (int(lum * 0.8) + 3, int(lum * 0.75) + 3, int(lum * 0.7) + 2, a)
                n += 1
    if n:
        im.save(path)
    print(f"{path}: {n} red pixels muted")

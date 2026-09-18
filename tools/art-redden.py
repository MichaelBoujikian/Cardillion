"""Keep exactly one amber cluster per frame - the eye - and push any other amber to red.

The renderer's eye-glow finder (src/render/battle/textures.ts findGlowPoints) places a glow on
every amber cluster it sees (up to two), so a wound highlight that reads amber gets a glow on
the flank. This keeps the leftmost cluster (the head faces left on every side-profile sprite)
and drops the green channel of the rest so they read red. Run after art:poses / art:video,
before art:optimize:

    python3 tools/art-redden.py assets/art/enemy-possum-mutant-*.png

Python 3 with Pillow (`python3` on the owner's machine). Worth porting into art-poses.mjs.
"""
import sys
from PIL import Image

def amber(r, g, b, a):
    return a > 200 and r > 170 and 80 < g < 210 and b < 100 and r - b > 110

def clusters(px, w, h, cell):
    cols, rows = -(-w // cell), -(-h // cell)
    hits = {}
    for y in range(h):
        for x in range(w):
            if amber(*px[x, y]):
                k = (y // cell) * cols + (x // cell)
                e = hits.setdefault(k, [0, 0, 0, set()])
                e[0] += 1; e[1] += x; e[2] += y; e[3].add(k)
    seen, out = set(), []
    for k in list(hits):
        if k in seen:
            continue
        stack, n, sx, sy, cells = [k], 0, 0, 0, set()
        while stack:
            c = stack.pop()
            if c in seen or c not in hits:
                continue
            seen.add(c); e = hits[c]; n += e[0]; sx += e[1]; sy += e[2]; cells.add(c)
            cx, cy = c % cols, c // cols
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < cols and 0 <= ny < rows:
                    stack.append(ny * cols + nx)
        out.append({"n": n, "u": sx / n / w, "v": sy / n / h, "cells": cells})
    return out, cols

for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    cell = 16  # ~8 px at the finder's 512 px scale
    found, cols = clusters(px, w, h, cell)
    # the finder ignores clusters under 6 px at 512 wide; at full res that is ~6*(w/512)^2
    big = [c for c in found if c["n"] >= 6 * (w / 512) ** 2]
    if len(big) <= 1:
        print(f"{path}: {len(big)} cluster, nothing to do")
        continue
    eye = min(big, key=lambda c: c["u"])
    others = [c for c in big if c is not eye]
    kill = set().union(*(c["cells"] for c in others))
    n = 0
    for y in range(h):
        for x in range(w):
            if (y // cell) * cols + (x // cell) in kill:
                r, g, b, a = px[x, y]
                if amber(r, g, b, a):
                    px[x, y] = (r, min(g, 70), b, a)  # amber -> red; wounds read red, never amber
                    n += 1
    im.save(path)
    print(f"{path}: kept the eye at ({eye['u']:.3f},{eye['v']:.3f}), reddened {n} px in {len(others)} other cluster(s)")

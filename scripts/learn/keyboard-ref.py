#!/usr/bin/env python3
"""Draws the reference keyboard for public/learn/hands-either-side.webp (docs/LEARN.md).

The image model does not draw the black keys in their real groups of two and three, so the hands
were painted onto this: 24 white keys from F2 to A5, top view, 1536x1024, the lessons' paper and
ink. Needs Pillow. Writes keyboard-ref.png to the current directory.
"""

from PIL import Image, ImageDraw

W, H = 1536, 1024
PAPER, INK, WOOD = (248, 244, 236), (35, 29, 24), (120, 95, 75)
WHITES = 24
TOP, BOTTOM = 180, 560

im = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(im)
names = ["F", "G", "A", "B", "C", "D", "E"] * 4
kw = W / WHITES
for i in range(WHITES):
    d.rectangle([i * kw, TOP, (i + 1) * kw, BOTTOM], fill=(252, 249, 242), outline=INK, width=3)
# A black key after C, D, F, G and A, never after E or B: groups of two and three.
offset = {"C": 0.62, "D": 0.78, "F": 0.6, "G": 0.7, "A": 0.8}
bw = kw * 0.58
for i in range(WHITES - 1):
    if names[i] in offset:
        cx = i * kw + kw * (0.5 + offset[names[i]])
        d.rectangle([cx - bw / 2, TOP, cx + bw / 2, TOP + (BOTTOM - TOP) * 0.63], fill=INK)
d.rectangle([0, BOTTOM, W, BOTTOM + 60], fill=WOOD)
im.save("keyboard-ref.png")

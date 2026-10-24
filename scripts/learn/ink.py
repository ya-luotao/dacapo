"""Takes the cream paper out of a lesson's etching: python3 ink.py in.webp out-ink.webp [...].

Each pixel's darkness against the paper (the commonest light tone) becomes the alpha of one
neutral ink, so the drawing sits on white, or in the dark theme on the ivory paper of the music.
"""

import sys

from PIL import Image

INK = (29, 29, 31)
DARKEST = 20

for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
    gray = Image.open(src).convert('L')
    hist = gray.histogram()
    paper = max(range(181, 256), key=lambda v: hist[v])
    edge = paper - 6
    alpha = gray.point(lambda v: 0 if v >= edge else min(255, (edge - v) * 255 // (edge - DARKEST)))
    out = Image.new('RGBA', gray.size, INK + (0,))
    out.putalpha(alpha)
    out.save(dst, 'WEBP', quality=86, method=6)

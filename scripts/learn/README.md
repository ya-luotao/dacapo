# Lesson illustrations

The etchings in `public/learn/`, painted by GPT Image 2.5 (`gpt-image-2.5-sunburst`, quality
high, 1536×1024) with the Herdstead painter skill's `paint.py`, then scaled to 1200×800 WebP at
quality 80. Each prompt ends with `prompts/style.txt`.

| Picture                   | How                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `seated-at-middle-c.webp` | `generate` with `prompts/seat.txt` (the pianist sat left of centre), then `edit` of that image with `prompts/seat-edit.txt`                                  |
| `hands-either-side.webp`  | `edit` of the keyboard drawn by `keyboard-ref.py` with `prompts/hands-edit.txt`: the model paints the hands and the etching over black keys placed correctly |

| `posture-from-the-side.webp` | `generate` with `prompts/side.txt`, the second of two |
| `curved-hand.webp` | `generate` with `prompts/curve.txt`, the second of two |
| `two-hands.webp` | `generate` with `prompts/flat-hands.txt`, the second of two; numbers added in code |

Seven calls in all, two images each. See docs/LEARN.md for what to check before using a picture.

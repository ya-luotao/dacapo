import { GLYPH, SPACE } from './geometry.ts';
import { DYNAMIC_LETTERS } from './glyphs.ts';

// Sizes and curves for what marks.tsx draws around the notes.

export type DynamicLetter = keyof typeof DYNAMIC_LETTERS;

export function isDynamicLetter(c: string): c is DynamicLetter {
  return c in DYNAMIC_LETTERS;
}

/** The width of a dynamic such as "mf", in SVG units at `scale`. */
export function dynamicWidth(text: string, scale = 1): number {
  let width = 0;
  for (const c of text) if (isDynamicLetter(c)) width += DYNAMIC_LETTERS[c].advance;
  return width * GLYPH * scale;
}

/**
 * A slur (or a tie) from (x1, y1) to (x2, y2), as a crescent thin at its ends, bowing up by about
 * `height` above the higher end (or down below the lower one).
 */
export function slurPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height: number,
  above: boolean,
): string {
  const sign = above ? -1 : 1;
  const thick = 0.18 * SPACE;
  const d = (x2 - x1) / 5;
  const base = above ? Math.min(y1, y2) : Math.max(y1, y2);
  const outer = base + (sign * height) / 0.75;
  const inner = base + (sign * (height - thick)) / 0.75;
  return (
    `M${x1} ${y1}C${x1 + d} ${outer} ${x2 - d} ${outer} ${x2} ${y2}` +
    `C${x2 - d} ${inner} ${x1 + d} ${inner} ${x1} ${y1}Z`
  );
}

import { readPref, writePref } from '../../lib/localPrefs.ts';

// Which aspects of expression the Pieces judge, per browser (docs/EXPRESSION.md, "UI"): all by
// default.

export const EXPRESSION_ASPECTS = ['dynamics', 'articulation', 'pedal'] as const;
export type ExpressionAspect = (typeof EXPRESSION_ASPECTS)[number];

const ASPECTS_PREF = 'dacapo.expression.off';

/** The aspects judged, in their order: every one not turned off. */
export function readExpressionAspects(): ExpressionAspect[] {
  let off: unknown;
  try {
    off = JSON.parse(readPref(ASPECTS_PREF) ?? '[]');
  } catch {
    off = [];
  }
  const skipped = Array.isArray(off) ? off : [];
  return EXPRESSION_ASPECTS.filter((a) => !skipped.includes(a));
}

export function writeExpressionAspects(on: readonly ExpressionAspect[]): void {
  const off = EXPRESSION_ASPECTS.filter((a) => !on.includes(a));
  writePref(ASPECTS_PREF, off.length === 0 ? null : JSON.stringify(off));
}

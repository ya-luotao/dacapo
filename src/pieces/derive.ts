// A piece as it is practised: the written MusicXML with the left hand a pattern makes from its
// chord symbols written in (docs/HARMONY.md, "Lead sheets (H3)"). One document is changed, then
// both drawn and parsed, so what is drawn is what is judged.

import { writeLeftHand } from '../core/leadSheetXml.ts';
import { parseMusicXml } from '../core/musicxml.ts';
import type { PatternId } from '../core/progressions.ts';
import type { Score } from '../core/score.ts';
import { parseXml } from './load.ts';

/** The score to practise, and the MusicXML Verovio draws it from. */
export interface Practised {
  xml: string;
  score: Score;
}

/** The document as text; browsers leave the XML declaration out. */
function serializeXml(doc: Document): string {
  const text = new XMLSerializer().serializeToString(doc);
  return text.startsWith('<?xml') ? text : `<?xml version="1.0" encoding="UTF-8"?>\n${text}`;
}

/**
 * The piece with its left hand from the symbols, in `pattern`: `score` is the piece as written,
 * parsed from `xml`.
 */
export function withLeftHand(xml: string, score: Score, pattern: PatternId): Practised {
  const doc = parseXml(xml);
  const hands = writeLeftHand(doc, score, pattern);
  return { xml: serializeXml(doc), score: parseMusicXml(doc, { hands }) };
}

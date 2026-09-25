// Reading MusicXML in the browser: the core parser with the browser's DOMParser.

import { musicXmlFromBytes, parseMusicXml, ScoreError } from '../core/musicxml.ts';
import type { Score, StaffHands } from '../core/score.ts';

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

export function readScore(xml: string, hands: StaffHands | null = null): Score {
  return parseMusicXml(parseXml(xml), { hands });
}

export interface ReadFile {
  xml: string;
  score: Score;
}

/** Accepted file names, for the file input and drag and drop. */
export const PIECE_EXTENSIONS = ['.musicxml', '.xml', '.mxl'] as const;

export function isPieceFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return PIECE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Reads an imported file; throws `ScoreError` when it is not a usable score. */
export async function readPieceFile(file: Blob): Promise<ReadFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xml = musicXmlFromBytes(bytes, parseXml);
  return { xml, score: readScore(xml) };
}

export { ScoreError };

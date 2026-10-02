import { useEffect, useState } from 'react';
import type { Score } from '../../core/score.ts';
import { loadBuiltIn, type BuiltInId } from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';

// The library's scores for the lessons' figures (a passage to hear, a piece's form): each read
// from its own file when a figure first needs it, and once.

/** Scores already read, so a figure opened twice reads its file once. */
const scores = new Map<BuiltInId, Promise<Score>>();
/** Those in hand: a figure drawn again, or drawn once with no effect to wait for, starts from them. */
const read = new Map<BuiltInId, Score>();

/**
 * Hands the figures a library piece's score read elsewhere: a page drawn once, without scripts
 * (docs/SITE.md), reads no file after it is drawn, so its figures take their scores from here.
 */
export function rememberLibraryScore(id: BuiltInId, score: Score): void {
  read.set(id, score);
  scores.set(id, Promise.resolve(score));
}

function libraryScore(id: BuiltInId): Promise<Score> {
  let score = scores.get(id);
  if (!score) {
    score = loadBuiltIn(id).then((xml) => {
      const parsed = readScore(xml);
      read.set(id, parsed);
      return parsed;
    });
    scores.set(id, score);
  }
  return score;
}

/** A library piece's score, read from its file when the figure first needs it. */
export function useLibraryScore(id: BuiltInId): Score | null {
  const [loaded, setLoaded] = useState<{ id: BuiltInId; score: Score } | null>(null);
  useEffect(() => {
    let live = true;
    void libraryScore(id).then((score) => {
      if (live) setLoaded({ id, score });
    });
    return () => {
      live = false;
    };
  }, [id]);
  return loaded?.id === id ? loaded.score : (read.get(id) ?? null);
}

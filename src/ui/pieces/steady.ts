import { useMemo } from 'react';
import { barHeatmap, steadyBars } from '../../core/barHeatmap.ts';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import type { HandSelection } from '../../core/score.ts';
import { readPref } from '../../lib/localPrefs.ts';
import { usePieceSteps } from '../practice/context.ts';
import { readPiecePrefs, WEAK_ALL_KEYS_PREF } from './prefs.ts';

/** A piece's steady bars for the hands last chosen: how many, of how many those hands play. */
export interface SteadyBars {
  hands: HandSelection;
  steady: number;
  of: number;
}

/**
 * How many of a piece's bars are steady for the hands last chosen (the bar heatmap's own rule),
 * for its line in the library and under "Next for you". Null while its step records are read.
 */
export function useSteadyBars(pieceId: string, facts: PieceFacts): SteadyBars | null {
  const records = usePieceSteps(pieceId);
  const prefs = readPiecePrefs(pieceId);
  const hands: HandSelection = prefs.hands;
  // With a left hand from the symbols the piece is practised on other notes: the practice page
  // leaves their checksum and bar counts here (docs/HARMONY.md, H3).
  const { checksum, bars: counts } = prefs.practised ?? facts;
  // Runs in the written key, unless Weak bars was asked for every key (H4).
  const allKeys = readPref(WEAK_ALL_KEYS_PREF) === '1';
  const steady = useMemo(() => {
    if (!records) return null;
    const bars = [
      ...new Set(
        records
          .filter((r) => r.hands === hands && r.checksum === checksum)
          .filter((r) => allKeys || r.transpose === undefined)
          .map((r) => r.measure),
      ),
    ];
    return steadyBars(barHeatmap(records, { checksum, hands, bars, allKeys }).cells).steady;
  }, [records, checksum, hands, allKeys]);
  return steady === null ? null : { hands, steady, of: counts[hands] };
}

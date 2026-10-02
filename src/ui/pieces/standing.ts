import { useMemo } from 'react';
import { piecesStanding, type PiecesStanding } from '../../core/piecesStanding.ts';
import { dayKey } from '../../core/streak.ts';
import { useNow } from '../progress/useNow.ts';
import { useTodayRecords } from '../today/useTodayRecords.ts';

/**
 * Where the pieces stand now (docs/PIECES.md, "Next for you"): which were played to their end,
 * the piece in hand and the piece to begin next. From the records today's plan reads, without
 * its rules; null while they are being read.
 */
export function usePiecesStanding(): PiecesStanding | null {
  const records = useTodayRecords();
  const today = dayKey(useNow());
  return useMemo(() => records && piecesStanding(records, { today }), [records, today]);
}

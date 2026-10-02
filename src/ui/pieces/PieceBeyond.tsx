import { isFullKeys, reachBeyond } from '../../core/instrument.ts';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import { useInstrumentKeys } from '../instrument.ts';
import { useBeyondWords } from './beyond.ts';

/**
 * A quiet line on a library card when the piece goes beyond the player's keyboard
 * (docs/PERSONAL.md, "The instrument's keys"): "Goes below your keyboard, to A1". Nothing with
 * 88 keys, for a piece that stays on the keyboard, and while a piece's facts do not have its
 * keys yet.
 */
export function PieceBeyond({ facts }: { facts?: PieceFacts }) {
  const keys = useInstrumentKeys();
  const words = useBeyondWords();
  if (isFullKeys(keys) || !facts?.keys) return null;
  const reach = reachBeyond(facts.keys, keys);
  return reach && <span className="library-piece-progress">{words.reach(reach)}</span>;
}

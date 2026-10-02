import { useT } from '../../i18n/index.ts';
import { useNoteNames } from '../noteNames.ts';

/** How far a piece goes beyond the keyboard: the key it goes down to, the key it goes up to. */
export interface Reach {
  below: number | null;
  above: number | null;
}

/**
 * The words for a piece that goes beyond the player's keyboard (docs/PERSONAL.md, "The
 * instrument's keys"): "Goes below your keyboard, to A1", its card's and its page's line, the
 * keys named as the reader names notes; and for the notes a run had played for the player.
 */
export function useBeyondWords(): {
  /** A card's line. */
  reach: (reach: Reach) => string;
  /** The page's: the same, and what becomes of those notes. */
  page: (reach: Reach) => string;
  given: (notes: number) => string;
} {
  const t = useT();
  const { midiName } = useNoteNames();
  const reach = ({ below, above }: Reach): string => {
    if (below !== null && above !== null)
      return t('pieces.beyond.both', { low: midiName(below), high: midiName(above) });
    if (below !== null) return t('pieces.beyond.below', { note: midiName(below) });
    return above === null ? '' : t('pieces.beyond.above', { note: midiName(above) });
  };
  return {
    reach,
    page: (r) => t('pieces.beyond.page', { reach: reach(r) }),
    given: (notes) => (notes === 1 ? t('pieces.given.one') : t('pieces.given.other', { n: notes })),
  };
}

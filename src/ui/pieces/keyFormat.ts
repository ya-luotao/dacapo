import { useMemo } from 'react';
import { noteLetter } from '../../core/chordSymbols.ts';
import { keyTonic, type PieceKey } from '../../core/transpose.ts';
import { useT, type Translate } from '../../i18n/index.ts';

// How the Key control names keys and transpositions (docs/HARMONY.md, "Transposing (H4)").

/** A transposition as a signed number of semitones: `+2`, `−3` (a true minus sign). */
export const shiftText = (semitones: number) =>
  semitones < 0 ? `−${-semitones}` : `+${semitones}`;

/**
 * `B minor`, `F♯ major`; `G major / E minor` where the score does not tell its mode (the two keys
 * of its signature).
 */
export function keyName(t: Translate, key: PieceKey): string {
  const major = t('harmony.key.major', { tonic: noteLetter(keyTonic(key.fifths, 'major')) });
  const minor = t('harmony.key.minor', { tonic: noteLetter(keyTonic(key.fifths, 'minor')) });
  if (key.mode === 'major') return major;
  if (key.mode === 'minor') return minor;
  return t('pieces.key.either', { major, minor });
}

export function useKeyName(): (key: PieceKey) => string {
  const t = useT();
  return useMemo(() => (key: PieceKey) => keyName(t, key), [t]);
}

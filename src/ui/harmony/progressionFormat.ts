import { useMemo } from 'react';
import {
  keyChord,
  keyTonic,
  parseProgressionPieceId,
  progressionNumerals,
  type PatternId,
  type ProgressionId,
  type ProgressionKey,
  type ProgressionSpec,
} from '../../core/progressions.ts';
import { useT, type Translate } from '../../i18n/index.ts';
import { tonicName } from '../scales/format.ts';

/**
 * `ii7–V7–Imaj7`: a progression's numerals in plain text, as a title or a sentence writes them
 * (the page's serif has no superscript figures; `NumeralsText` sets them raised).
 */
export function numeralsText(id: ProgressionId): string {
  return progressionNumerals(id)
    .map((c) => `${c.numeral}${c.figure}`)
    .join('–');
}

/** `C major`, `F♯ minor`. */
export const keyName = (t: Translate, key: ProgressionKey) => {
  const { tonic, mode } = keyTonic(key);
  return t(mode === 'major' ? 'harmony.key.major' : 'harmony.key.minor', {
    tonic: tonicName(tonic),
  });
};

/** `I–IV–V–I in C major`, `12-bar blues in B♭ major`: the name a practised progression goes by. */
export function progressionTitle(t: Translate, spec: Pick<ProgressionSpec, 'progression' | 'key'>) {
  const key = keyName(t, spec.key);
  return spec.progression === 'blues'
    ? t('harmony.progression.title.blues', { key })
    : t('harmony.progression.title', { progression: numeralsText(spec.progression), key });
}

/** The title of a piece id that names a progression, or null for any other piece. */
export function progressionPieceTitle(t: Translate, pieceId: string): string | null {
  const spec = parseProgressionPieceId(pieceId);
  return spec
    ? t('harmony.progression.piece', {
        title: progressionTitle(t, spec),
        pattern: t(`harmony.pattern.${spec.pattern}`),
      })
    : null;
}

/** The progression's chords in a key as symbols, each once: `C – F – G`, `Dm7 – G7 – Cmaj7`. */
export function keySymbols(id: ProgressionId, key: ProgressionKey): string {
  return progressionNumerals(id)
    .map((c) => keyChord(key, c).text)
    .join(' – ');
}

export function useProgressionFormat() {
  const t = useT();
  return useMemo(
    () => ({
      key: (key: ProgressionKey) => keyName(t, key),
      title: (spec: Pick<ProgressionSpec, 'progression' | 'key'>) => progressionTitle(t, spec),
      pattern: (pattern: PatternId) => t(`harmony.pattern.${pattern}`),
      patternDetail: (pattern: PatternId) => t(`harmony.pattern.${pattern}.detail`),
      name: (id: ProgressionId) => t(`harmony.progression.${id}`),
    }),
    [t],
  );
}

/** The page of a progression: `/harmony/progressions/I-IV-V-I/F%23/alberti`. */
export const progressionPath = ({ progression, key, pattern }: ProgressionSpec) =>
  `/harmony/progressions/${progression}/${encodeURIComponent(key)}/${pattern}`;

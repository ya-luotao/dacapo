import { useMemo } from 'react';
import {
  parseRhythmEarItem,
  type RhythmEarLevelProgress,
  type RhythmEarMiss,
  type RhythmEarMode,
} from '../../core/rhythmEar.ts';
import { useI18n } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { useRhythmFormat } from '../read/rhythmFormat.ts';

/** Wording of rhythm dictation: bars in words, the levels' figures, the misses. */
export function useRhythmEarFormat() {
  const { t } = useI18n();
  const rhythm = useRhythmFormat();
  const read = useReadFormat();
  return useMemo(() => {
    /** A bar in words, cell after cell: "quarter, two eighths, half". */
    const cells = (bar: readonly string[]) =>
      bar.map((c) => rhythm.cell(c)).join(t('app.listSeparator'));
    /** An item: "dotted eighth and sixteenth in 4/4". */
    const item = (key: string) => {
      const parsed = parseRhythmEarItem(key);
      if (!parsed) return key;
      return t('rhythm.item', { cell: rhythm.cell(parsed.cell), meter: parsed.meter });
    };
    return {
      cells,
      item,
      /** The level's figures towards mastery, as the level list shows them. */
      levelStats: (p: RhythmEarLevelProgress) =>
        t('ear.rhythm.level.stats', {
          answers: p.answers,
          window: p.window,
          accuracy: read.percent(p.accuracy),
        }),
      /** A wrong answer, and what it was answered as. */
      miss: (m: RhythmEarMiss, by: RhythmEarMode) => {
        const asked = rhythm.capitalize(item(m.item));
        const cell = parseRhythmEarItem(m.item)?.cell;
        if (m.as === null) return t('ear.rhythm.missed.none', { item: asked });
        if (m.as === cell && by === 'play') return t('ear.rhythm.missed.time', { item: asked });
        return t(by === 'play' ? 'ear.rhythm.missed.tapped' : 'ear.rhythm.missed.chosen', {
          item: asked,
          as: rhythm.cell(m.as),
        });
      },
    };
  }, [t, rhythm, read]);
}

export type RhythmEarFormat = ReturnType<typeof useRhythmEarFormat>;

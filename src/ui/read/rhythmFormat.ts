import { useMemo } from 'react';
import {
  barTicksOf,
  beatTicksOf,
  getRhythmLevel,
  parseHandsKey,
  parseRhythmItem,
  type RhythmLevelId,
  type RhythmMeter,
} from '../../core/rhythmCells.ts';
import type { RhythmExercise } from '../../core/rhythmExercise.ts';
import {
  inTime,
  RHYTHM_MASTERY_WINDOW,
  type CellTiming,
  type RhythmLevelProgress,
} from '../../core/rhythmRead.ts';
import { TENDENCY_MS } from '../../core/rhythmRun.ts';
import { useI18n } from '../../i18n/index.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useReadFormat } from './format.ts';

/** Locale-aware wording of Read's rhythm lines: levels, cells, tempos, timings. */
export function useRhythmFormat() {
  const { t, locale } = useI18n();
  const read = useReadFormat();
  return useMemo(() => {
    const and = new Intl.ListFormat(locale, { type: 'conjunction' });
    const levelName = (id: RhythmLevelId) => t(`rhythm.level.${id}`);
    /** A cell by its key: `ed-s` → "dotted eighth and sixteenth"; two hands name both. */
    const cell = (key: string): string => {
      const hands = parseHandsKey(key);
      if (hands)
        return t('rhythm.cell.hands', {
          right: t(`rhythm.cell.${hands.right}` as MessageKey),
          left: t(`rhythm.cell.${hands.left}` as MessageKey),
        });
      return t(`rhythm.cell.${key}` as MessageKey);
    };
    const ms = (value: number | null) =>
      value === null ? t('read.none') : t('rhythm.ms', { ms: Math.round(Math.abs(value)) });
    return {
      levelName,
      /** What the level adds, and its meters: "sixteenths and dotted eighths · 4/4, 2/4". */
      levelDetail: (id: RhythmLevelId) =>
        t('rhythm.level.detail', {
          what: t(`rhythm.level.${id}.detail`),
          meters: getRhythmLevel(id).meters.join(t('app.listSeparator')),
        }),
      level: (id: RhythmLevelId) => `${id} · ${levelName(id)}`,
      /** A name at the start of a line. */
      capitalize: (text: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1),
      cell,
      /** An item: its cell, and the meter when it says something. */
      item: (item: string) => {
        const parsed = parseRhythmItem(item);
        if (!parsed) return item;
        return t('rhythm.item', { cell: cell(parsed.cell), meter: parsed.meter });
      },
      /** The beat a minute: ♩ = 72, or ♩. = 60 in 6/8. */
      tempo: (meter: RhythmMeter | null, bpm: number) =>
        t(meter === '6/8' ? 'rhythm.tempo.dotted' : 'pieces.tempo.bpm', { bpm }),
      /** How far off the beat, without its sign: "23 ms". */
      ms,
      /** The level's figures towards mastery, as Read's level list shows them. */
      stats: (p: RhythmLevelProgress) =>
        t('rhythm.level.stats', {
          cells: p.cells,
          window: RHYTHM_MASTERY_WINDOW,
          accuracy: read.percent(p.accuracy),
          median: ms(p.medianDeviation),
        }),
      /** A cell of a run in words, for a screen reader: where it is, and how each note was. */
      cellResult: (c: CellTiming, exercise: RhythmExercise) => {
        const placed = exercise.cells[c.cell]!;
        const bar = barTicksOf(exercise.meter);
        const timings = c.deviations
          .flat()
          .flatMap((d) =>
            d === null
              ? [t('rhythm.timing.missed')]
              : inTime(d)
                ? []
                : [t(d < 0 ? 'pieces.timing.early' : 'pieces.timing.late', { ms: Math.abs(d) })],
          );
        if (c.extras > 0)
          timings.push(
            c.extras === 1
              ? t('rhythm.timing.extras.one')
              : t('rhythm.timing.extras.other', { n: c.extras }),
          );
        return t('rhythm.cellResult', {
          bar: placed.bar + 1,
          beat: 1 + Math.floor((placed.start % bar) / beatTicksOf(exercise.meter)),
          cell: cell(c.key),
          timings: and.format(timings),
        });
      },
      /** Rushing, dragging, or neither (rhythm mode's rule). */
      tendency: (tendency: number | null) => {
        if (tendency === null) return t('rhythm.tendency.none');
        if (Math.abs(tendency) < TENDENCY_MS) return t('rhythm.tendency.even', { ms: TENDENCY_MS });
        return t(tendency < 0 ? 'rhythm.tendency.rushing' : 'rhythm.tendency.dragging', {
          ms: Math.round(Math.abs(tendency)),
        });
      },
    };
  }, [t, locale, read]);
}

export type RhythmFormat = ReturnType<typeof useRhythmFormat>;

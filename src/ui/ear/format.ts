import { useMemo } from 'react';
import {
  getEarLevel,
  givenKey,
  intervalOfSemitones,
  parseItem,
  type ChordQuality,
  type EarLevelId,
  type Inversion,
} from '../../core/earItems.ts';
import type { MissedItem } from '../../core/earSession.ts';
import { midiName } from '../../core/note.ts';
import { useI18n } from '../../i18n/index.ts';

/** Keys as note names, low to high: `C4 E4 G♯4`. */
export function keyNames(keys: readonly number[]): string {
  return [...keys]
    .sort((a, b) => a - b)
    .map((midi) => midiName(midi).replace('#', '♯'))
    .join(' ');
}

/** Names of the ear-training items, levels and answers in the current language. */
export function useEarFormat() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
    const interval = (name: string) => t(`ear.interval.${name}` as 'ear.interval.P8');
    const chord = (quality: ChordQuality, inversion: Inversion, withPosition: boolean) =>
      withPosition
        ? t('ear.chord.withInversion', {
            chord: t(`ear.chord.${quality}`),
            inversion: t(`ear.inversion.${inversion}`),
          })
        : t(`ear.chord.${quality}`);
    /** The inversion level names every chord with its position; the others are root position. */
    const withPosition = (level: EarLevelId | null, inversion: Inversion) =>
      inversion !== 'root' || level === 'C3';

    /** `major 3rd up`, `minor triad, 1st inversion`. */
    const item = (key: string, level: EarLevelId | null = null) => {
      const parsed = parseItem(key);
      if (!parsed) return key;
      if (parsed.family === 'interval') {
        return t(`ear.item.${parsed.direction}`, { name: interval(parsed.name) });
      }
      return chord(parsed.quality, parsed.inversion, withPosition(level, parsed.inversion));
    };

    /** A name as an answer button says it: `Major 3rd`, `Major, 1st inversion`. */
    const button = (name: string, level: EarLevelId) => {
      const [quality, inversion] = name.split(':') as [ChordQuality, Inversion | undefined];
      if (!inversion) return capitalize(interval(name));
      const short = t(`ear.chord.${quality}.short`);
      return withPosition(level, inversion)
        ? t('ear.chord.withInversion', {
            chord: short,
            inversion: t(`ear.inversion.${inversion}`),
          })
        : short;
    };

    /** A name chosen, in running text: `perfect 5th`, `minor triad`. */
    const name = (value: string, level: EarLevelId) => {
      const [quality, inversion] = value.split(':') as [ChordQuality, Inversion | undefined];
      if (!inversion) return interval(value);
      return chord(quality, inversion, withPosition(level, inversion));
    };

    /**
     * What was answered: a name, or the keys played. A key played for an interval is told by the
     * interval it makes with the key shown, in the direction asked, when that is one of ours.
     */
    const answer = (missed: MissedItem, level: EarLevelId) => {
      if (typeof missed.answer === 'string') return name(missed.answer, level);
      const parsed = parseItem(missed.item);
      if (parsed?.family === 'interval' && missed.answer.length === 1) {
        const given = givenKey({ item: missed.item, notes: missed.prompt });
        const played = missed.answer[0]!;
        const distance = parsed.direction === 'down' ? given - played : played - given;
        const heard = distance > 0 ? intervalOfSemitones(distance) : null;
        if (heard)
          return t('ear.summary.played', { interval: interval(heard), keys: keyNames([played]) });
      }
      return keyNames(missed.answer);
    };

    return {
      capitalize,
      interval,
      item,
      button,
      name,
      answer,
      /** `I1 · Octave, fifth and major third`. */
      level: (id: EarLevelId) => `${id} · ${t(`ear.level.${id}`)}`,
      levelName: (id: EarLevelId) => t(`ear.level.${id}`),
      /** `5 intervals`, `6 chords`. */
      levelSize: (id: EarLevelId) => {
        const level = getEarLevel(id);
        return level.family === 'interval'
          ? t('ear.level.intervals', { n: level.names.length })
          : t('ear.level.chords', { n: level.chords.length });
      },
    };
  }, [t, locale]);
}

export type EarFormat = ReturnType<typeof useEarFormat>;

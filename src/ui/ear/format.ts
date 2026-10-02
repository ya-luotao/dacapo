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
import { echoMistake, spellInKey, type EchoScale, type MelodyKey } from '../../core/earMelody.ts';
import {
  cadenceKeyChords,
  cadenceKeyOf,
  isCadence,
  isCadenceLevelId,
  readCadence,
} from '../../core/cadences.ts';
import type { ProgressionKey } from '../../core/progressions.ts';
import { keyName } from '../harmony/progressionFormat.ts';
import type { EarLevelProgress, MissedItem } from '../../core/earSession.ts';
import type { Tonic } from '../../core/scaleTypes.ts';
import { isTuneId, TUNE_IDS, WHOLE_TUNE, type TuneId, type TunePart } from '../../core/tuneList.ts';
import { getTune } from '../../core/tunes.ts';
import { useI18n } from '../../i18n/index.ts';
import { useNoteNames } from '../noteNames.ts';
import { tonicName } from '../scales/format.ts';

/** Names of the ear-training items, levels and answers in the current language. */
export function useEarFormat() {
  const { t, locale } = useI18n();
  const { midiName, spelledName } = useNoteNames();
  return useMemo(() => {
    /** Keys as note names, low to high: `C4 E4 G♯4`. */
    const keyNames = (keys: readonly number[]) =>
      [...keys]
        .sort((a, b) => a - b)
        .map((midi) => midiName(midi))
        .join(' ');
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

    /** A tune by its title in the library. */
    const tuneTitle = (id: TuneId) => t(`library.${id}.title`);
    /** `Phrase 3`, `The whole tune`. */
    const tunePart = (part: TunePart) =>
      part === WHOLE_TUNE ? t('ear.tune.part.whole') : t('ear.tune.part', { n: part });

    /**
     * `major 3rd up`, `minor triad, 1st inversion`; a melody by its level's name; a tune's phrase
     * as `Amazing Grace: phrase 2`.
     */
    const item = (key: string, level: EarLevelId | null = null) => {
      const parsed = parseItem(key);
      if (!parsed) return key;
      if (parsed.family === 'echo') return t(`ear.level.${parsed.level}`);
      if (parsed.family === 'cadence') return t(`ear.cadence.${parsed.cadence}`);
      if (parsed.family === 'tune') {
        return parsed.part === WHOLE_TUNE
          ? t('ear.tune.item.whole', { tune: tuneTitle(parsed.tune) })
          : t('ear.tune.item', { tune: tuneTitle(parsed.tune), n: parsed.part });
      }
      if (parsed.family === 'interval') {
        return t(`ear.item.${parsed.direction}`, { name: interval(parsed.name) });
      }
      return chord(parsed.quality, parsed.inversion, withPosition(level, parsed.inversion));
    };

    /** A name as an answer button says it: `Major 3rd`, `Major, 1st inversion`. */
    const button = (name: string, level: EarLevelId) => {
      if (isCadence(name)) return t(`ear.cadence.${name}.short`);
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
      if (isCadence(value)) return t(`ear.cadence.${value}`);
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

    /** A key and its note: `perfect 4th up (F4)`; the same key again; or the key alone. */
    /** A key as the melody's key writes it (B♭4 in F major), or with sharps without one. */
    const noteName = (midi: number, key: MelodyKey | undefined) =>
      key ? spelledName(spellInKey(midi, key)) : keyNames([midi]);

    const step = (semitones: number, midi: number, key: MelodyKey | undefined) => {
      const name = noteName(midi, key);
      if (semitones === 0) return t('ear.echo.same', { key: name });
      const heard = intervalOfSemitones(Math.abs(semitones));
      if (!heard) return name;
      return t('ear.echo.step', {
        interval: t(semitones > 0 ? 'ear.echo.up' : 'ear.echo.down', { name: interval(heard) }),
        key: name,
      });
    };

    /**
     * A melody missed, by the interval into its first wrong note: `Note 3: perfect 4th up (F4),
     * played as perfect 5th up (G4)`. `note` is the wrong note's number where it is not its place
     * in the prompt (a whole tune's is counted in its phrase).
     */
    const echoMiss = (missed: MissedItem, note?: number) => {
      if (typeof missed.answer === 'string') return missed.answer;
      const mistake = echoMistake(missed.prompt, missed.answer);
      if (!mistake) return keyNames(missed.answer);
      if (mistake.asked === null || mistake.answered === null) {
        return t('ear.echo.missed.first', {
          expected: noteName(mistake.expected, missed.key),
          played: noteName(mistake.played, missed.key),
        });
      }
      return t('ear.echo.missed', {
        n: note ?? mistake.note,
        asked: step(mistake.asked, mistake.expected, missed.key),
        answered: step(mistake.answered, mistake.played, missed.key),
      });
    };

    /**
     * Where a key of a tune's item is: its phrase (1-based) and its number in it. A phrase's keys
     * are its own; a whole tune's are found in the phrase they belong to.
     */
    const tunePlace = (itemKey: string, index: number): { phrase: number; note: number } | null => {
      const parsed = parseItem(itemKey);
      if (parsed?.family !== 'tune') return null;
      if (parsed.part !== WHOLE_TUNE) return { phrase: parsed.part, note: index + 1 };
      const { phrases } = getTune(parsed.tune);
      const phrase = phrases.findIndex((span) => index >= span.from && index < span.to);
      if (phrase === -1) return null;
      return { phrase: phrase + 1, note: index - phrases[phrase]!.from + 1 };
    };

    /**
     * A phrase of a tune missed: `Phrase 3 · Note 5: major 2nd up (E5), played as …`; of the whole
     * tune, the phrase it went wrong in: `The whole tune, phrase 3 · Note 5: …`.
     */
    const tuneMiss = (missed: MissedItem) => {
      const parsed = parseItem(missed.item);
      if (parsed?.family !== 'tune' || typeof missed.answer === 'string') return echoMiss(missed);
      const place = tunePlace(missed.item, missed.answer.length - 1);
      const part =
        parsed.part === WHOLE_TUNE && place
          ? t('ear.tune.part.wholeAt', { n: place.phrase })
          : tunePart(parsed.part);
      return t('ear.tune.missed', { part, miss: echoMiss(missed, place?.note) });
    };

    /**
     * A cadence's progression in its key: `I–IV–V–vi in D major: D G A Bm`. From the prompt as
     * drawn, or from a stored answer's keys and key; null when they cannot be read.
     */
    const cadenceLine = (key: ProgressionKey, numerals: readonly string[]) =>
      t('ear.cadence.line', {
        numerals: numerals.join('–'),
        key: keyName(t, key),
        chords: cadenceKeyChords(key, numerals)
          .map((c) => c.text)
          .join(' '),
      });
    /** `D major: D G A Bm`. */
    const cadenceChords = (key: ProgressionKey, numerals: readonly string[]) =>
      t('ear.cadence.chords', {
        key: keyName(t, key),
        chords: cadenceKeyChords(key, numerals)
          .map((c) => c.text)
          .join(' '),
      });
    const missedCadence = (missed: MissedItem, level: EarLevelId): string | null => {
      if (!isCadenceLevelId(level)) return null;
      const key = cadenceKeyOf(level, missed.key);
      const numerals = key ? readCadence(key, missed.prompt) : null;
      return key && numerals ? cadenceLine(key, numerals) : null;
    };

    return {
      capitalize,
      keyNames,
      cadenceLine,
      cadenceChords,
      missedCadence,
      interval,
      item,
      button,
      name,
      answer,
      /** `I1 · Octave, fifth and major third`; a tune by its title alone. */
      level: (id: EarLevelId) => (isTuneId(id) ? tuneTitle(id) : `${id} · ${t(`ear.level.${id}`)}`),
      levelName: (id: EarLevelId) => (isTuneId(id) ? tuneTitle(id) : t(`ear.level.${id}`)),
      /** What stands for a level where its id does: `EC3`; a tune's place in the list, `4`. */
      levelId: (id: EarLevelId) => (isTuneId(id) ? String(TUNE_IDS.indexOf(id) + 1) : id),
      /** `5 intervals`, `6 chords`, `5–6 notes`, `4 phrases`. */
      levelSize: (id: EarLevelId) => {
        const level = getEarLevel(id);
        if (level.family === 'tune') return t('ear.level.phrases', { n: level.phrases });
        if (level.family === 'echo') {
          const [min, max] = level.rules.notes;
          return min === max
            ? t('ear.level.notes', { n: min })
            : t('ear.level.notesRange', { min, max });
        }
        if (level.family === 'cadence') {
          return t('ear.level.cadences', { n: level.rules.cadences.length });
        }
        return level.family === 'interval'
          ? t('ear.level.intervals', { n: level.names.length })
          : t('ear.level.chords', { n: level.chords.length });
      },
      /**
       * `12/40 answers · 83% correct · median 1.9 s`, or `… melodies …` for Echo; a tune by how
       * much of it is right without a replay, `5 of 7 right without a replay`.
       */
      levelStats: (progress: EarLevelProgress, percent: string, median: string) => {
        const { family } = getEarLevel(progress.level);
        if (family === 'tune') {
          return t('ear.level.stats.tune', {
            right: Math.round((progress.accuracy ?? 0) * progress.answers),
            window: progress.window,
          });
        }
        return t(family === 'echo' ? 'ear.level.stats.echo' : 'ear.level.stats', {
          answers: progress.answers,
          window: progress.window,
          accuracy: percent,
          median,
        });
      },
      /** `D major`, `A minor (harmonic)`: the key of a melody. */
      key: (tonic: Tonic, scale: EchoScale) =>
        t(`ear.echo.key.${scale}`, { tonic: tonicName(tonic) }),
      echoMiss,
      tuneTitle,
      tunePart,
      tunePlace,
      tuneMiss,
    };
  }, [t, locale, midiName, spelledName]);
}

export type EarFormat = ReturnType<typeof useEarFormat>;

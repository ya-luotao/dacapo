import { useMemo, type ReactNode } from 'react';
import {
  OTHER,
  type AnswerFamily,
  type FamilyLevelId,
  type ItemFigures,
} from '../../../core/answerProgress.ts';
import { CADENCE_NUMERALS, isCadence } from '../../../core/cadences.ts';
import {
  EAR_FAMILIES,
  intervalOfSemitones,
  isEarLevelId,
  parseItem,
  type ChordQuality,
  type Inversion,
} from '../../../core/earItems.ts';
import {
  formatSymbol,
  isHarmonyLevelId,
  parseSymbol,
  parseSymbolItem,
} from '../../../core/chordSymbols.ts';
import { isRhythmEarLevelId } from '../../../core/rhythmEar.ts';
import { isTuneId } from '../../../core/tuneList.ts';
import { parseSignature, parseTheoryItem, isTheoryLevelId } from '../../../core/theoryItems.ts';
import { signatureTonic } from '../../../core/keys.ts';
import { useI18n } from '../../../i18n/index.ts';
import { useEarFormat } from '../../ear/format.ts';
import { CellFigure } from '../../ear/rhythmFigure.tsx';
import { useRhythmEarFormat } from '../../ear/rhythmEarFormat.ts';
import { useHarmonyFormat } from '../../harmony/format.ts';
import { SymbolText } from '../../harmony/SymbolText.tsx';
import { useRhythmFormat } from '../../read/rhythmFormat.ts';
import { useReadFormat } from '../../read/format.ts';
import { useTheoryFormat } from '../../read/theoryFormat.ts';
import { tonicName } from '../../scales/format.ts';
import { ChordSymbol } from './ChordSymbol.tsx';

const asChord = (label: string) => {
  const [quality, inversion] = label.split(':') as [ChordQuality, Inversion];
  return { quality, inversion };
};

/** Names of the families, their items and the labels of their confusion tables. */
export function useFamilyFormat() {
  const { t } = useI18n();
  const ear = useEarFormat();
  const theory = useTheoryFormat();
  const read = useReadFormat();
  const harmony = useHarmonyFormat();
  const rhythm = useRhythmFormat();
  const dictation = useRhythmEarFormat();
  return useMemo(() => {
    /** A chord and its position, the position said unless it is the root position. */
    const chord = (label: string) => {
      const { quality, inversion } = asChord(label);
      if (inversion === 'root') return t(`ear.chord.${quality}`);
      return t('ear.chord.withInversion', {
        chord: t(`ear.chord.${quality}`),
        inversion: t(`ear.inversion.${inversion}`),
      });
    };

    /**
     * `perfect 4th up`: a step of a melody, in signed semitones; a tune's `0`, the same note
     * again.
     */
    const step = (label: string) => {
      const semitones = Number(label);
      if (semitones === 0) return t('ear.tune.same');
      const name = intervalOfSemitones(Math.abs(semitones));
      if (!name) return label;
      return t(semitones > 0 ? 'ear.echo.up' : 'ear.echo.down', { name: ear.interval(name) });
    };

    const key = (label: string) => {
      const [signature, mode] = label.split(':') as [string, 'major' | 'minor'];
      const fifths = parseSignature(signature);
      return fifths === null ? label : { fifths, mode };
    };

    /** A label of the confusion table in words: `minor 6th`, `E♭ major`, `perfect 4th up`. */
    const long = (family: AnswerFamily, label: string): string => {
      if (label === OTHER) return t('families.confusion.other.long');
      switch (family) {
        case 'interval':
          return ear.interval(label);
        case 'echo':
        case 'tune':
          return step(label);
        case 'cadence':
          return isCadence(label) ? t(`ear.cadence.${label}`) : label;
        case 'rhythmEar':
          return rhythm.cell(label);
        case 'readInterval':
          return theory.interval(label);
        case 'keySignature': {
          const parsed = key(label);
          return typeof parsed === 'string' ? parsed : theory.key(parsed.fifths, parsed.mode);
        }
        case 'chord':
        case 'readChord':
          return chord(label);
        case 'chordSymbol':
          return harmony.symbolWords(label);
      }
    };

    /**
     * A label as a heading of the table: `m6`, `↑P4` (a tune's repeated note `P1`), `A2`, `E♭` (a
     * minor key in lower case, `c♯`), a chord symbol with its inversion's figures, or a lead
     * sheet's symbol (`Dm7`).
     */
    const short = (family: AnswerFamily, label: string): ReactNode => {
      if (label === OTHER) return t('families.confusion.other');
      switch (family) {
        case 'interval':
        case 'readInterval':
          return label;
        case 'cadence':
          return isCadence(label) ? CADENCE_NUMERALS[label] : label;
        case 'echo':
        case 'tune': {
          const semitones = Number(label);
          if (semitones === 0) return 'P1';
          const name = intervalOfSemitones(Math.abs(semitones));
          return `${semitones > 0 ? '↑' : '↓'}${name ?? Math.abs(semitones)}`;
        }
        case 'rhythmEar':
          return <CellFigure cell={label} label={rhythm.cell(label)} />;
        case 'keySignature': {
          const parsed = key(label);
          if (typeof parsed === 'string') return parsed;
          const tonic = tonicName(signatureTonic(parsed.fifths, parsed.mode));
          return parsed.mode === 'minor' ? tonic.charAt(0).toLowerCase() + tonic.slice(1) : tonic;
        }
        case 'chord':
        case 'readChord':
          return <ChordSymbol {...asChord(label)} />;
        case 'chordSymbol': {
          const symbol = parseSymbol(label);
          return symbol ? <SymbolText symbol={symbol} /> : label;
        }
      }
    };

    /**
     * An item in words: `minor 6th up`, `EC3 · Up to the octave`, `augmented 2nd, harmonic`,
     * `Dm7 · D minor 7th chord`, `Amazing Grace: phrase 2`.
     */
    const item = (family: AnswerFamily, itemKey: string): string => {
      if (family === 'echo') {
        const parsed = parseItem(itemKey);
        return parsed?.family === 'echo' ? ear.level(parsed.level) : itemKey;
      }
      if (
        family === 'interval' ||
        family === 'chord' ||
        family === 'cadence' ||
        family === 'tune'
      ) {
        return ear.item(itemKey);
      }
      if (family === 'chordSymbol') {
        const symbol = parseSymbolItem(itemKey);
        return symbol ? `${formatSymbol(symbol)} · ${harmony.words(symbol)}` : itemKey;
      }
      if (family === 'rhythmEar') return dictation.item(itemKey);
      const parsed = parseTheoryItem(itemKey);
      if (!parsed) return itemKey;
      if (parsed.family === 'readChord') {
        return chord(`${parsed.quality}:${parsed.inversion}`);
      }
      if (parsed.family === 'keySignature') return theory.key(parsed.fifths, parsed.mode);
      const { quality, number } = parsed.name;
      return t(`theory.item.${parsed.direction}`, {
        name: theory.interval(`${quality}${number}`),
      });
    };

    /** `EC3 · Up to the octave`, `RI2 · Numbers and qualities`. */
    const level = (id: FamilyLevelId) => {
      if (isEarLevelId(id)) return ear.level(id);
      if (isHarmonyLevelId(id)) return harmony.level(id);
      if (isRhythmEarLevelId(id)) return rhythm.level(id);
      return isTheoryLevelId(id) ? theory.level(id) : id;
    };
    const levelName = (id: FamilyLevelId) => {
      if (isEarLevelId(id)) return ear.levelName(id);
      if (isHarmonyLevelId(id)) return harmony.levelName(id);
      if (isRhythmEarLevelId(id)) return rhythm.levelName(id);
      return isTheoryLevelId(id) ? theory.levelName(id) : id;
    };
    /** What a level is headed by where there is little room: its id, or a tune's title. */
    const levelTag = (id: FamilyLevelId) => (isTuneId(id) ? ear.tuneTitle(id) : id);

    /** Replays of an Ear item, or hinted cards of a theory item. */
    const aids = (family: AnswerFamily, n: number) => {
      const kind = (EAR_FAMILIES as readonly string[]).includes(family) || family === 'rhythmEar';
      return n === 1
        ? t(kind ? 'families.item.replays.one' : 'families.item.hints.one')
        : t(kind ? 'families.item.replays.other' : 'families.item.hints.other', { n });
    };

    /** `Correct lately 40% (4 of 10)`, `median 2.3 s`, `1 replay`: an item's figures. */
    const figures = (family: AnswerFamily, figures: ItemFigures): string[] =>
      [
        t('families.item.recent', {
          ratio: t('heatmap.details.ratio', {
            percent: read.percent(figures.recentCorrect / figures.recentCount),
            correct: figures.recentCorrect,
            count: figures.recentCount,
          }),
        }),
        figures.medianMs !== null &&
          t('families.item.median', { time: read.seconds(figures.medianMs) }),
        figures.aids > 0 && aids(family, figures.aids),
      ].filter((part) => part !== false);

    return { long, short, item, level, levelName, levelTag, aids, figures };
  }, [t, ear, theory, read, harmony, rhythm, dictation]);
}

export type FamilyFormat = ReturnType<typeof useFamilyFormat>;

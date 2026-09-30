import { useMemo } from 'react';
import { isSeventh } from '../../core/earItems.ts';
import { midiOf } from '../../core/musicxml.ts';
import { formatPitch, midiToPitch, type Clef } from '../../core/note.ts';
import type { SpelledPitch } from '../../core/score.ts';
import {
  getTheoryLevel,
  parseChordName,
  parseIntervalName,
  parseSignature,
  parseSpelled,
  parseTheoryItem,
  rootOf,
  signatureAccidentals,
  type ReadChordQuality,
  type ReadInversion,
  type Root,
  type TheoryLevelId,
} from '../../core/theoryItems.ts';
import type { TheoryMissed } from '../../core/theorySession.ts';
import { signatureTonic } from '../../core/scales.ts';
import { useI18n } from '../../i18n/index.ts';
import { spelledName, tonicName } from '../scales/format.ts';

const SIGNS: Readonly<Record<number, string>> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** A written note without its octave, as the hint shows it: `F𝄪`, `E♭`. */
export const letterOf = (p: Pick<SpelledPitch, 'step' | 'alter'>) =>
  `${p.step}${SIGNS[p.alter] ?? ''}`;

/** A chord's root as written: `F♯`. */
export const rootName = (root: Root) => letterOf(root);

/**
 * Keys played for a card, low to high, each named as the card writes it where it is one of its
 * notes; otherwise with flats in a flat key or among flat notes, sharps elsewhere.
 */
export function playedNames(keys: readonly number[], prompt: string[] | string): string {
  const written = Array.isArray(prompt) ? prompt.map(parseSpelled).filter((p) => p !== null) : [];
  const fifths = typeof prompt === 'string' ? parseSignature(prompt) : null;
  const flats = fifths !== null ? fifths < 0 : written.some((p) => p.alter < 0);
  return [...keys]
    .sort((a, b) => a - b)
    .map((midi) => {
      const note = written.find((p) => midiOf(p) === midi);
      return note ? spelledName(note) : formatPitch(midiToPitch(midi, flats ? 'flat' : 'sharp'));
    })
    .join(' ');
}

/** Names of the theory cards' items, levels and answers in the current language. */
export function useTheoryFormat() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

    /** `augmented 2nd`, `perfect octave`; RI1's answer `3` as `3rd`. */
    const interval = (name: string) => {
      if (/^[2-8]$/.test(name)) return t(`theory.number.${name}` as 'theory.number.2');
      const parsed = parseIntervalName(name);
      if (!parsed) return name;
      return t('theory.interval', {
        quality: t(`theory.quality.${parsed.quality}`),
        number: t(`theory.number.${parsed.number}`),
      });
    };

    /** `minor triad`, `minor triad, 1st inversion`, as the level names it. */
    const chord = (quality: ReadChordQuality, inversion: ReadInversion, withPosition: boolean) =>
      withPosition && !isSeventh(quality)
        ? t('ear.chord.withInversion', {
            chord: t(`ear.chord.${quality}`),
            inversion: t(`ear.inversion.${inversion}`),
          })
        : t(`ear.chord.${quality}`);

    const withPosition = (level: TheoryLevelId) => {
      const l = getTheoryLevel(level);
      return l.family === 'readChord' && l.withPosition;
    };

    /** `E♭ major`, `C minor`. */
    const key = (fifths: number, mode: 'major' | 'minor') =>
      t(`theory.key.${mode}`, { tonic: tonicName(signatureTonic(fifths, mode)) });

    /** `3 flats`, `no sharps or flats`. */
    const signature = (fifths: number) => {
      if (fifths === 0) return t('theory.signature.none');
      const n = Math.abs(fifths);
      const kind = fifths > 0 ? 'sharps' : 'flats';
      return n === 1
        ? t(`theory.signature.${kind}.one`)
        : t(`theory.signature.${kind}.other`, { n });
    };

    /** `augmented 2nd, up`; `E♭ major`; `minor triad, 1st inversion`. */
    const item = (itemKey: string, level: TheoryLevelId) => {
      const parsed = parseTheoryItem(itemKey);
      if (!parsed) return itemKey;
      if (parsed.family === 'readInterval') {
        const { quality, number } = parsed.name;
        return t(`theory.item.${parsed.direction}`, { name: interval(`${quality}${number}`) });
      }
      if (parsed.family === 'keySignature') return key(parsed.fifths, parsed.mode);
      return chord(parsed.quality, parsed.inversion, withPosition(level));
    };

    /** `F♯ minor triad, 1st inversion`: a chord named with its root. */
    const chordName = (name: string, level: TheoryLevelId) => {
      const parsed = parseChordName(name);
      if (!parsed) return name;
      return t('theory.chordName', {
        root: rootName(parsed.root),
        chord: chord(parsed.quality, parsed.inversion, withPosition(level)),
      });
    };

    /** A name chosen, in running text: an interval or a chord. */
    const name = (value: string, level: TheoryLevelId) =>
      getTheoryLevel(level).family === 'readChord' ? chordName(value, level) : interval(value);

    /** Written notes as stored, named: `C4 D♯4`, `(bass staff)` after them off the treble. */
    const card = (prompt: string[] | string, clef: Clef | undefined) => {
      if (typeof prompt === 'string') {
        const fifths = parseSignature(prompt);
        return fifths === null ? prompt : signature(fifths);
      }
      const notes = prompt.map((id) => {
        const pitch = parseSpelled(id);
        return pitch ? spelledName(pitch) : id;
      });
      const written = notes.join(' ');
      return clef
        ? t('read.noteOnStaff', { note: written, staff: t(`read.level.${clef}`) })
        : written;
    };

    /** What was answered wrong: a name, or the keys played. */
    const answer = (missed: Pick<TheoryMissed, 'answer' | 'prompt'>, level: TheoryLevelId) =>
      typeof missed.answer === 'string'
        ? name(missed.answer, level)
        : playedNames(missed.answer, missed.prompt);

    /** The right answer of a missed card, in words. */
    const right = (missed: TheoryMissed, level: TheoryLevelId) => {
      const parsed = parseTheoryItem(missed.item);
      if (parsed?.family === 'readChord' && Array.isArray(missed.prompt)) {
        const notes = missed.prompt.map(parseSpelled).filter((p) => p !== null);
        const root = rootOf(missed.item, notes);
        if (root) {
          return t('theory.chordName', {
            root: rootName(root),
            chord: chord(parsed.quality, parsed.inversion, withPosition(level)),
          });
        }
      }
      return item(missed.item, level);
    };

    /** A signature's sharps or flats in order, for the hint: `F♯ C♯ G♯`. */
    const signatureLetters = (fifths: number) =>
      signatureAccidentals(fifths).map(rootName).join(' ');

    return {
      capitalize,
      interval,
      chord,
      key,
      signature,
      item,
      chordName,
      name,
      card,
      answer,
      right,
      signatureLetters,
      /** `RI2 · Numbers and qualities`. */
      level: (id: TheoryLevelId) => `${id} · ${t(`theory.level.${id}`)}`,
      levelName: (id: TheoryLevelId) => t(`theory.level.${id}`),
      /** `Natural notes · both staves`, `9 keys`. */
      levelDetail: (id: TheoryLevelId) => {
        const level = getTheoryLevel(id);
        return level.family === 'keySignature'
          ? t('theory.level.keys', { n: level.fifths.length })
          : t(`theory.level.${level.id}.detail`);
      },
    };
  }, [t, locale]);
}

export type TheoryFormat = ReturnType<typeof useTheoryFormat>;

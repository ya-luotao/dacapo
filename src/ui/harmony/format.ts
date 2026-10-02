import { useMemo } from 'react';
import {
  bassTone,
  parseSymbol,
  parseSymbolItem,
  rootPc,
  symbolTones,
  type ChordSymbol,
  type HarmonyLevelId,
  type SymbolQuality,
} from '../../core/chordSymbols.ts';
import { midiToPitch, pitchClass } from '../../core/note.ts';
import { useI18n, type MessageKey } from '../../i18n/index.ts';
import { useNoteNames, type NoteNames } from '../noteNames.ts';
import { rootName } from '../read/theoryFormat.ts';

/** The words for a quality: the Ear page's for its chords, Harmony's own for the others. */
const QUALITY_WORDS: Readonly<Record<SymbolQuality, MessageKey>> = {
  maj: 'ear.chord.maj',
  min: 'ear.chord.min',
  dim: 'ear.chord.dim',
  aug: 'ear.chord.aug',
  sus2: 'harmony.chord.sus2',
  sus4: 'harmony.chord.sus4',
  dom7: 'ear.chord.dom7',
  maj7: 'ear.chord.maj7',
  min7: 'ear.chord.min7',
  hdim7: 'ear.chord.hdim7',
  dim7: 'harmony.chord.dim7',
  maj6: 'harmony.chord.maj6',
  min6: 'harmony.chord.min6',
  add9: 'harmony.chord.add9',
};

/** A symbol's notes as named, root first: `D F A C`, `C E♭ G♭ B𝄫`. Its bass is not among them. */
export function chordToneNames(symbol: ChordSymbol, { letterOf }: NoteNames): string {
  return symbolTones({ ...symbol, bass: null })
    .map(letterOf)
    .join(' ');
}

/**
 * Keys held, low to high, each named as the symbol names that note where it is one of its tones;
 * otherwise with flats beside a flat root or among flat tones, sharps elsewhere.
 */
export function heldNames(
  keys: readonly number[],
  symbol: ChordSymbol,
  { letterOf, letterName }: NoteNames,
): string {
  const tones = symbolTones(symbol);
  const flats = symbol.root.alter < 0 || tones.some((t) => t.alter < 0);
  return [...keys]
    .sort((a, b) => a - b)
    .map((midi) => {
      const tone = tones.find((t) => rootPc(t) === pitchClass(midi));
      return tone ? letterOf(tone) : letterName(midiToPitch(midi, flats ? 'flat' : 'sharp'));
    })
    .join(' ');
}

/** Names on the Harmony page in the current language: levels, chords in words, notes. */
export function useHarmonyFormat() {
  const { t } = useI18n();
  const names = useNoteNames();
  return useMemo(() => {
    /** `minor 7th chord`. */
    const quality = (q: SymbolQuality) => t(QUALITY_WORDS[q]);

    /**
     * `D minor 7th chord`, `C major triad over E`: a symbol in words, for reading aloud. A
     * chord's name, as its symbol is, so in letters.
     */
    const words = (symbol: ChordSymbol) => {
      const chord = t('theory.chordName', {
        root: rootName(symbol.root),
        chord: quality(symbol.quality),
      });
      const bass = bassTone(symbol);
      return bass ? t('harmony.chord.over', { chord, bass: rootName(bass) }) : chord;
    };

    /** A symbol as written (`Dm7`) and its words, from a label or an item; the text if neither. */
    const symbolWords = (text: string) => {
      const symbol = parseSymbol(text) ?? parseSymbolItem(text);
      return symbol ? words(symbol) : text;
    };

    /**
     * What a symbol is, tone by tone: `D F A C`; a slash chord's bass after them, `C E G, E
     * lowest`, or `A C E, G lowest`.
     */
    const notes = (symbol: ChordSymbol) => {
      const chord = chordToneNames(symbol, names);
      const bass = bassTone(symbol);
      return bass ? t('harmony.notes.bass', { notes: chord, bass: names.letterOf(bass) }) : chord;
    };

    return {
      quality,
      words,
      symbolWords,
      notes,
      /** `H2 · Major and minor triads`. */
      level: (id: HarmonyLevelId) => `${id} · ${t(`harmony.level.${id}`)}`,
      levelName: (id: HarmonyLevelId) => t(`harmony.level.${id}`),
      levelDetail: (id: HarmonyLevelId) => t(`harmony.level.${id}.detail`),
    };
  }, [t, names]);
}

export type HarmonyFormat = ReturnType<typeof useHarmonyFormat>;

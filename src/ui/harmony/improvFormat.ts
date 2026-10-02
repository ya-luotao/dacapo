import { useMemo } from 'react';
import { rootPc } from '../../core/chordSymbols.ts';
import {
  BACKINGS,
  backingNumerals,
  improvPlan,
  scaleTones,
  type BackingId,
  type Feel,
  type ImprovPattern,
  type ImprovScale,
} from '../../core/improv.ts';
import type { ImprovSession } from '../../core/improvFigures.ts';
import { keyChord } from '../../core/progressions.ts';
import { useT, type Translate } from '../../i18n/index.ts';
import { useNoteNames, type NoteNames } from '../noteNames.ts';
import { tonicName } from '../scales/format.ts';

// Names for Improvise in the current language: backings, keys, scales, feels, notes.

const STEP_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `ii7–V7–Imaj7`, `i7–IV7`: a backing's numerals in plain text. */
export const backingNumeralsText = (id: BackingId) =>
  backingNumerals(id)
    .map((c) => `${c.numeral}${c.figure}`)
    .join('–');

/** `F major`, `D Dorian`. */
export function backingKeyName(t: Translate, backing: BackingId, key: string): string {
  const tonic = tonicName(key);
  return BACKINGS[backing].mode === 'dorian'
    ? t('harmony.improv.key.dorian', { tonic })
    : t('harmony.key.major', { tonic });
}

/** `12-bar blues in F major`, `I–vi–IV–V in G major`, `i7–IV7 in D Dorian`. */
export function backingTitle(t: Translate, backing: BackingId, key: string): string {
  return t('harmony.improv.title', {
    backing: backing === 'blues' ? t('harmony.improv.backing.blues') : backingNumeralsText(backing),
    key: backingKeyName(t, backing, key),
  });
}

/** The backing's chords in a key as symbols, each once: `F7 – B♭7 – C7`. */
export const backingSymbols = (backing: BackingId, key: string) =>
  backingNumerals(backing)
    .map((c) => keyChord(key, c).text)
    .join(' – ');

/** The scale's notes as the key spells them: `F A♭ B♭ C♭ C E♭`. */
const scaleNotes = (tonic: string, scale: ImprovScale, { letterOf }: NoteNames) =>
  scaleTones(tonic, scale).map(letterOf).join(' ');

/**
 * A key named as the backing's scale or chords spell its pitch class (`A♭4` in F blues, `B3`
 * over G7), else with the key's own signs.
 */
function improvNoteName(
  midi: number,
  session: Pick<ImprovSession, 'backing' | 'key' | 'scale'>,
  { midiName, spelledName }: NoteNames,
): string {
  const pc = ((midi % 12) + 12) % 12;
  const plan = improvPlan({
    backing: session.backing,
    key: session.key,
    scale: session.scale,
    pattern: BACKINGS[session.backing].patterns[0]!,
    feel: 'straight',
    bpm: 80,
    call: false,
    seed: 0,
  });
  const spelled = [...plan.scaleTones, ...plan.chords.flatMap((c) => c.tones)].find(
    (t) => rootPc(t) === pc,
  );
  if (!spelled) {
    const flats = plan.scaleTones.some((t) => t.alter < 0) || session.key.includes('b');
    return midiName(midi, flats ? 'flat' : 'sharp');
  }
  const octave = Math.round((midi - spelled.alter - STEP_PC[spelled.step]!) / 12) - 1;
  return spelledName({ ...spelled, octave });
}

export function useImprovFormat() {
  const t = useT();
  const names = useNoteNames();
  return useMemo(
    () => ({
      backing: (id: BackingId) => t(`harmony.improv.backing.${id}`),
      title: (backing: BackingId, key: string) => backingTitle(t, backing, key),
      key: (backing: BackingId, key: string) => backingKeyName(t, backing, key),
      scale: (scale: ImprovScale) => t(`harmony.improv.scale.${scale}`),
      scaleOf: (tonic: string, scale: ImprovScale) =>
        t(`harmony.improv.scaleOf.${scale}`, { tonic: tonicName(tonic) }),
      pattern: (pattern: ImprovPattern) => t(`harmony.pattern.${pattern}`),
      patternDetail: (pattern: ImprovPattern) => t(`harmony.pattern.${pattern}.detail`),
      feel: (feel: Feel) => t(`harmony.improv.feel.${feel}`),
      scaleNotes: (tonic: string, scale: ImprovScale) => scaleNotes(tonic, scale, names),
      noteName: (midi: number, session: Pick<ImprovSession, 'backing' | 'key' | 'scale'>) =>
        improvNoteName(midi, session, names),
    }),
    [t, names],
  );
}

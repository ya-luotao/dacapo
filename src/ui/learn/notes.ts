import { parsePitch, pitchToMidi, type Pitch } from '../../core/note.ts';
import { keySignature, MINOR_TONICS } from '../../core/keys.ts';
import { scaleNotes } from '../../core/scales.ts';
import type { ScaleType } from '../../core/scaleTypes.ts';

// Notes as the lessons write and print them.

export function pitch(text: string): Pitch {
  const parsed = parsePitch(text);
  if (!parsed) throw new Error(`Not a pitch: ${text}`);
  return parsed;
}

/** A pitch as printed: F♯4, B♭3, or without the octave: F♯. */
export function pitchName(p: Pitch, octave = true): string {
  const sign = p.accidental === 1 ? '♯' : p.accidental === -1 ? '♭' : '';
  return `${p.letter}${sign}${octave ? p.octave : ''}`;
}

/** A tonic as printed: B♭, F♯. */
export function tonicName(tonic: string): string {
  return tonic.replace('b', '♭').replace('#', '♯');
}

export type ScaleKind = Exclude<ScaleType, 'chromatic' | 'majorArpeggio' | 'minorArpeggio'>;

export interface ScaleStep {
  pitch: Pitch;
  midi: number;
  finger: number | null;
  direction: 'up' | 'down';
}

/**
 * A scale up an octave from its tonic and back down, right hand, spelled with each letter once
 * (core/scales.ts), with its fingering where Hanon gives one. The lessons' pitches have no double
 * sharps or flats, so a scale that needs one (G♯ harmonic minor's F𝄪) is refused.
 */
export function scaleRun(kind: ScaleKind, tonic: string): ScaleStep[] {
  const right = scaleNotes({ type: kind, tonic, octaves: 1, hands: 'right' }).right;
  return right.map((n) => {
    if (Math.abs(n.pitch.alter) > 1) throw new Error(`${tonic} ${kind} needs a double accidental`);
    return {
      pitch: {
        letter: n.pitch.step,
        accidental: n.pitch.alter as Pitch['accidental'],
        octave: n.pitch.octave,
      },
      midi: n.midi,
      finger: n.finger,
      direction: n.direction,
    };
  });
}

/** A major scale going up an octave from its tonic, spelled with each letter once, with its fingering. */
export function majorScale(tonic: string): ScaleStep[] {
  return scaleRun('major', tonic).slice(0, 8);
}

/** A scale up and back down, one octave, right hand, with its fingering. */
export function scaleKeys(kind: ScaleKind, tonic: string): { keys: number[]; fingers: number[] } {
  const run = scaleRun(kind, tonic);
  return { keys: run.map((n) => n.midi), fingers: run.map((n) => n.finger ?? 0) };
}

/** A major scale up and back down, one octave, right hand, with its fingering. */
export function majorScaleRun(tonic: string): { keys: number[]; fingers: number[] } {
  return scaleKeys('major', tonic);
}

/** A scale's keys going up an octave from its tonic. */
export function scaleUp(kind: ScaleKind, tonic: string): number[] {
  return scaleRun(kind, tonic)
    .slice(0, 8)
    .map((n) => n.midi);
}

/** The minor key with the same key signature as a major key, if the Scales page has it. */
export function relativeMinor(major: string): string | undefined {
  const fifths = keySignature('major', major).fifths;
  return MINOR_TONICS.find((m) => keySignature('naturalMinor', m).fifths === fifths);
}

/** The same pitch moved by whole octaves to lie at `midi`. */
function atMidi(p: Pitch, midi: number): Pitch {
  return { ...p, octave: p.octave + (midi - pitchToMidi(p)) / 12 };
}

export interface SnippetKey {
  tonic: string;
  mode: 'major' | 'minor';
}

/**
 * Five notes that end a phrase in a key: its 3rd, 2nd, 4th, the 7th below and the tonic, over its
 * 5th and then its tonic in the bass; with the key signature, and the keys to hear it a step at a
 * time. In a minor key the 7th is raised, as it nearly always is before the tonic.
 */
export function phraseIn({ tonic, mode }: SnippetKey): {
  tune: Pitch[];
  bass: Pitch[];
  fifths: number;
  sound: (number | number[])[];
} {
  const run = scaleRun(mode === 'major' ? 'major' : 'harmonicMinor', tonic);
  // The tonic between D4 and C♯5, so the tune sits on the treble staff.
  const up = run[0]!.midi < 62 ? 12 : 0;
  const tune = [2, 1, 3, 6, 0].map((d) =>
    atMidi(run[d]!.pitch, run[d]!.midi + up - (d === 6 ? 12 : 0)),
  );
  // The bass's tonic between A2 and G♯3; its 5th above it or, if that is too high, a 4th below.
  let root = run[0]!.midi + up;
  while (root > 56) root -= 12;
  const fifth = root + 7 <= 57 ? root + 7 : root - 5;
  const bass = [atMidi(run[4]!.pitch, fifth), atMidi(run[0]!.pitch, root)];
  const fifths = keySignature(mode === 'major' ? 'major' : 'naturalMinor', tonic).fifths;
  const keys = tune.map(pitchToMidi);
  const low = bass.map(pitchToMidi);
  return {
    tune,
    bass,
    fifths,
    sound: [[low[0]!, keys[0]!], keys[1]!, keys[2]!, keys[3]!, [low[1]!, keys[4]!]],
  };
}

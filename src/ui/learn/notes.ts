import { parsePitch, type Pitch } from '../../core/note.ts';
import { scaleNotes } from '../../core/scales.ts';

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

/** A major scale going up an octave from its tonic, spelled with each letter once, with its fingering. */
export function majorScale(tonic: string): { pitch: Pitch; midi: number; finger: number | null }[] {
  const right = scaleNotes({ type: 'major', tonic, octaves: 1, hands: 'right' }).right;
  return right.slice(0, 8).map((n) => ({
    pitch: {
      letter: n.pitch.step,
      accidental: n.pitch.alter as Pitch['accidental'],
      octave: n.pitch.octave,
    },
    midi: n.midi,
    finger: n.finger,
  }));
}

/** A major scale up and back down, one octave, right hand, with its fingering. */
export function majorScaleRun(tonic: string): { keys: number[]; fingers: number[] } {
  const right = scaleNotes({ type: 'major', tonic, octaves: 1, hands: 'right' }).right;
  return { keys: right.map((n) => n.midi), fingers: right.map((n) => n.finger ?? 0) };
}

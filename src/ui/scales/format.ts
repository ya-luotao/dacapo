import type { SpelledPitch } from '../../core/score.ts';
import type { ScaleExercise, Tonic } from '../../core/scaleTypes.ts';
import { useT } from '../../i18n/index.ts';

const ACCIDENTALS: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** A written note as the scale spells it: `F𝄪5`, `E♭4`. */
export function spelledName(pitch: SpelledPitch): string {
  return `${pitch.step}${ACCIDENTALS[pitch.alter] ?? ''}${pitch.octave}`;
}

/** A tonic with its sign: `F♯`, `E♭`. */
export function tonicName(tonic: Tonic): string {
  return tonic.replace('#', '♯').replace('b', '♭');
}

/** "D major", "Chromatic scale on E♭": one template per type, in the language's own order. */
export function useExerciseName() {
  const t = useT();
  return (e: Pick<ScaleExercise, 'type' | 'tonic'>) =>
    t(`scales.name.${e.type}`, { tonic: tonicName(e.tonic) });
}

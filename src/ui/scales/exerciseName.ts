import { trillForm, type ScaleExercise, type Tonic } from '../../core/scaleTypes.ts';
import { useT } from '../../i18n/index.ts';
import { useCallback } from 'react';

/** A tonic with its sign: `F♯`, `E♭`. */
export function tonicName(tonic: Tonic): string {
  return tonic.replace('#', '♯').replace('b', '♭');
}

/**
 * "D major", "Chromatic scale on E♭", "Hanon No. 3": one template per type, in the language's own
 * order.
 */
export function useExerciseName() {
  const t = useT();
  return useCallback(
    (e: Pick<ScaleExercise, 'type' | 'tonic' | 'variant'>) => {
      const tonic = tonicName(e.tonic);
      // A form of the exercise that its name says: a trill's fingers and bars, No. 45's fingering,
      // the thirds' chromatic form.
      if (e.type === 'trill') {
        const form = trillForm(e.variant);
        return form.hanon
          ? t('scales.name.trillHanon')
          : t('scales.name.trill', {
              tonic,
              fingers: `${form.lower}–${form.upper}`,
              bars: form.bars,
            });
      }
      if (e.type === 'repeatedNotes') {
        const [n, k] = (e.variant ?? '').split('.');
        return k
          ? t('scales.name.repeatedFingering', { n: n ?? '', k })
          : t('scales.name.repeatedNotes', { n: n ?? '' });
      }
      if (e.type === 'thirds' && e.variant === 'chromatic') return t('scales.name.thirdsChromatic');
      return t(`scales.name.${e.type}`, { tonic, n: e.variant ?? '' });
    },
    [t],
  );
}

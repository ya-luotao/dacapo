import type { PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../../i18n/index.ts';
import type { PointerInput } from '../../input/index.ts';
import { LEFT_PAD_KEY, RIGHT_PAD_KEY } from './tapKeys.ts';

// Parts of a rhythm run shared by Read's rhythm lines and the Ear page's rhythm dictation: the
// count of the bar as dots, and the pads to tap on.

/** The counts of a bar as numbered dots, the one sounding lit; each beat's first ringed. */
export function CountDots({
  counts,
  lit,
  compound,
}: {
  counts: number;
  lit: number | null;
  compound: boolean;
}) {
  const on = lit === null ? null : ((lit % counts) + counts) % counts;
  return (
    <div className="lesson-beats is-small rhythm-beats" aria-hidden="true">
      {Array.from({ length: counts }, (_, i) => (
        <span
          key={i}
          className={
            (on === i ? 'is-on' : '') + (i === 0 || (compound && i % 3 === 0) ? ' is-accent' : '')
          }
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

/**
 * Pads to tap on with a finger or the mouse: one, or one per hand. They play through the on-screen
 * piano's input, so a pad is timed like any key.
 */
export function TapPads({ hands, pointer }: { hands: boolean; pointer: PointerInput }) {
  const t = useT();
  const pads = hands
    ? [
        { key: LEFT_PAD_KEY, label: t('rhythm.pad.left') },
        { key: RIGHT_PAD_KEY, label: t('rhythm.pad.right') },
      ]
    : [{ key: RIGHT_PAD_KEY, label: t('rhythm.pad') }];
  const down = (key: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.press(e.pointerId, key, e.timeStamp);
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => pointer.release(e.pointerId, e.timeStamp);
  return (
    <div className="rhythm-pads">
      {pads.map((pad) => (
        <button
          key={pad.key}
          type="button"
          className="rhythm-pad"
          tabIndex={-1}
          onPointerDown={down(pad.key)}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          {pad.label}
        </button>
      ))}
    </div>
  );
}

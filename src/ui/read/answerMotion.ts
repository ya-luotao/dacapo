import { useEffect, type RefObject } from 'react';

/**
 * How an answer moves the card (Read's notes): a right key strikes the note, which swells once and
 * settles, done before the next card comes (ADVANCE_DELAY_MS); a wrong key nudges the sheet aside
 * and back, again for each other wrong key. A new card is never animated in: its time runs from
 * the moment it is painted, so it must be all there at once. Nothing moves for a reader who asks
 * for less motion.
 */

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

const STRIKE: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.16)', offset: 0.3 },
  { transform: 'scale(1)' },
];

const NUDGE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-4px)', offset: 0.2 },
  { transform: 'translateX(4px)', offset: 0.45 },
  { transform: 'translateX(-2px)', offset: 0.7 },
  { transform: 'translateX(0)' },
];

const DURATION = 260;

function stillWanted(): boolean {
  return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Moves `card` as the answer `status` says. `answer` names the answer (the card and its wrong
 * key): a new one moves it again, the same one does not.
 */
export function useAnswerMotion(
  card: RefObject<HTMLElement | null>,
  status: 'waiting' | 'wrong' | 'correct',
  answer: string,
) {
  useEffect(() => {
    const el = card.current;
    if (!el || status === 'waiting' || !stillWanted()) return;
    const target = status === 'correct' ? el.querySelector('.vf-notehead') : el;
    if (!target || typeof target.animate !== 'function') return;
    const motion = target.animate(status === 'correct' ? STRIKE : NUDGE, {
      duration: DURATION,
      easing: status === 'correct' ? EASE : 'ease-out',
    });
    return () => motion.cancel();
  }, [card, status, answer]);
}

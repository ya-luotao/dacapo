import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import type { Clef, Pitch } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import { drawGrandStaff, STAFF_HEIGHT, STAFF_WIDTH } from './draw.ts';
import { getFontState, subscribeFont } from './font.ts';

export type StaffState = 'neutral' | 'correct' | 'wrong';

interface GrandStaffProps {
  pitch: Pitch;
  clef: Clef;
  state?: StaffState;
  /**
   * Called with `performance.now()` in the first animation frame after the note was drawn.
   * A new callback identity draws and reports again.
   */
  onPainted?: (time: number) => void;
}

/** A braced grand staff with one whole note. Colours come from CSS, so themes need no redraw. */
export function GrandStaff({ pitch, clef, state = 'neutral', onPainted }: GrandStaffProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const font = useSyncExternalStore(subscribeFont, getFontState, getFontState);
  const { letter, accidental, octave } = pitch;

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || font !== 'ready') return;
    drawGrandStaff(el, { letter, accidental, octave }, clef);
    const frame = requestAnimationFrame(() => onPainted?.(performance.now()));
    return () => {
      cancelAnimationFrame(frame);
      el.replaceChildren();
    };
  }, [font, letter, accidental, octave, clef, onPainted]);

  return (
    <div
      className="grand-staff"
      data-state={state}
      role="img"
      aria-label={t('staff.label')}
      style={{ '--staff-aspect': STAFF_WIDTH / STAFF_HEIGHT } as CSSProperties}
    >
      <div className="grand-staff-svg" ref={host} />
      {font === 'failed' && <p className="grand-staff-error">{t('staff.fontFailed')}</p>}
    </div>
  );
}

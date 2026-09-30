import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import type { Clef, Pitch } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import {
  drawGrandStaff,
  drawGrandStaffNotes,
  drawMelody,
  STAFF_HEIGHT,
  STAFF_WIDTH,
  type MelodyDrawing,
} from './draw.ts';
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

interface NotesStaffProps {
  /** One column of whole notes per entry: the pitches sounding together. */
  columns: readonly (readonly Pitch[])[];
  /** What the staff shows, for assistive technology. */
  label: string;
  state?: StaffState;
  className?: string;
}

/**
 * A braced grand staff with several whole notes, one column after another (a melodic interval)
 * or stacked (a chord), split between the staves at middle C. Colours come from CSS.
 */
export function NotesStaff({ columns, label, state = 'neutral', className }: NotesStaffProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const font = useSyncExternalStore(subscribeFont, getFontState, getFontState);
  // Redrawn only when the notes change, not for a new array with the same notes.
  const key = JSON.stringify(columns);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || font !== 'ready') return;
    drawGrandStaffNotes(el, JSON.parse(key) as Pitch[][]);
    return () => el.replaceChildren();
  }, [font, key]);

  return (
    <div
      className={className ? `grand-staff ${className}` : 'grand-staff'}
      data-state={state}
      role="img"
      aria-label={label}
      style={{ '--staff-aspect': STAFF_WIDTH / STAFF_HEIGHT } as CSSProperties}
    >
      <div className="grand-staff-svg" ref={host} />
      {font === 'failed' && <p className="grand-staff-error">{t('staff.fontFailed')}</p>}
    </div>
  );
}

interface MelodyStaffProps {
  drawing: MelodyDrawing;
  /** What the staff shows, for assistive technology. */
  label: string;
  className?: string;
}

/**
 * A melody in quarters with its key signature, on the staff that suits it, with the notes played
 * right and the wrong key tinted. Its size follows the notes: the box takes the drawing's aspect
 * ratio, and `--melody-units` its width in drawing units for CSS to scale.
 */
export function MelodyStaff({ drawing, label, className }: MelodyStaffProps) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const font = useSyncExternalStore(subscribeFont, getFontState, getFontState);
  // Redrawn only when the notes change, not for a new object with the same notes.
  const key = JSON.stringify(drawing);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || font !== 'ready') return;
    const { width, height } = drawMelody(el, JSON.parse(key) as MelodyDrawing);
    box.current?.style.setProperty('--staff-aspect', String(width / height));
    box.current?.style.setProperty('--melody-units', String(width));
    return () => el.replaceChildren();
  }, [font, key]);

  return (
    <div
      ref={box}
      className={className ? `grand-staff melody-staff ${className}` : 'grand-staff melody-staff'}
      role="img"
      aria-label={label}
    >
      <div className="grand-staff-svg" ref={host} />
      {font === 'failed' && <p className="grand-staff-error">{t('staff.fontFailed')}</p>}
    </div>
  );
}

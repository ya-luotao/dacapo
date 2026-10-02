import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { inHands, type HandSelection, type Score, type Step } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import {
  layoutPiece,
  loadVerovio,
  mapNotes,
  scaleFor,
  engravingKey,
  type Engraving,
  type Toolkit,
} from './verovio.ts';

export type ScoreStatus =
  | { state: 'loading' }
  | { state: 'ready'; unplaced: number }
  | { state: 'failed'; reason: 'engine' | 'render' };

interface ScoreViewProps {
  xml: string;
  score: Score;
  title: string;
  /** The step to point at; null: none. */
  step: Step | null;
  /** Keys of the step already played. */
  pressed: readonly number[];
  /** A wrong key fell on the step (a run played back): the cursor says so. */
  cursorWrong?: boolean;
  /**
   * Written bars whose notes and markings are hidden (memory mode): the staff lines, barlines,
   * clefs and signatures stay. `revealed` bars show all the same, and `revealedNotes` (our note
   * ids) show inside a hidden bar.
   */
  hiddenBars?: ReadonlySet<number>;
  revealedBars?: ReadonlySet<number>;
  revealedNotes?: readonly string[];
  hands: HandSelection;
  onStatus: (status: ScoreStatus) => void;
  /** Drawn behind the notes, e.g. tints per bar; placed with the bars' boxes. */
  behind?: (bars: BarBoxes) => ReactNode;
  /**
   * Laid over the score, e.g. focusable targets per bar; with `events`, also given where each
   * note and rest of every staff is drawn.
   */
  above?: (bars: BarBoxes, events: EventBoxes) => ReactNode;
  /** Measure the notes and rests too, for what is laid over the score by time (`EventBoxes`). */
  events?: boolean;
  /** Classes for single notes by our note id, e.g. the notes of a scale already played. */
  marks?: ReadonlyMap<string, string>;
  /** Staff size relative to the usual (a short scale is drawn larger). */
  zoom?: number;
  /** Engraving choices other than Verovio's defaults (verovio.ts). */
  engraving?: Engraving;
  /**
   * The frame has a height of its own (the practice page's one-screen layout), so a tall frame
   * may draw the staff larger. Off where the frame is only as tall as the score.
   */
  fillHeight?: boolean;
}

/** The staff lines of a written bar, in px from the top left of the score's page. */
export interface BarBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Written measure index → its box. */
export type BarBoxes = ReadonlyMap<number, BarBox>;

/** Where a note or rest is drawn: its head (or the rest), and the whole of it with its stem. */
export interface EventBox {
  head: BarBox;
  whole: BarBox;
}

/**
 * Written measure index → per staff (top first) the notes and rests drawn in it, in the order of
 * the file: a page that wrote the file knows which is which.
 */
export type EventBoxes = ReadonlyMap<number, readonly (readonly EventBox[])[]>;

const NO_BOXES: BarBoxes = new Map();
const NO_EVENTS: EventBoxes = new Map();
const NO_ENGRAVING: Engraving = {};

/** One drawing of the score: our note ids and measures addressed in Verovio's SVG. */
interface Drawing {
  /** Our note id → the note's SVG group. */
  notes: Map<string, Element>;
  /** Written measure index → its SVG group. */
  measures: Element[];
}

const RELAYOUT_DEBOUNCE_MS = 150;

/** The practice page's one-screen layout (styles.css, `.piece-session`). */
const ONE_SCREEN = '(min-width: 48rem) and (min-height: 36rem)';

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Union of the client rects of `elements`, relative to `origin`. */
function unionRect(elements: Iterable<Element>, origin: DOMRect): DOMRect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (left === Infinity) return null;
  return new DOMRect(left - origin.left, top - origin.top, right - left, bottom - top);
}

function boxOf(rect: DOMRect): BarBox {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** The staff lines of a measure: the height of its system, without what sticks out. */
function measureBox(measure: Element, origin: DOMRect): DOMRect | null {
  return unionRect(measure.querySelectorAll(':scope > g.staff > path'), origin);
}

/**
 * The score, drawn by Verovio in the text colour. The current step is marked by a band behind
 * its notes; its notes are inked in the accent colour and turn "ok" as they are played. Notes the
 * selected hands do not play are drawn lighter. The frame scrolls so the current system sits at
 * the top, with the next one below it.
 */
export function ScoreView({
  xml,
  score,
  title,
  step,
  pressed,
  cursorWrong = false,
  hiddenBars,
  revealedBars,
  revealedNotes,
  hands,
  onStatus,
  behind,
  above,
  marks,
  zoom = 1,
  engraving = NO_ENGRAVING,
  fillHeight = true,
  events = false,
}: ScoreViewProps) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const status = useRef(onStatus);
  // The engraving is followed by value: a new object with the same choices draws nothing again.
  const engravingId = engravingKey(engraving);
  const engravingNow = useRef(engraving);
  useLayoutEffect(() => {
    status.current = onStatus;
    engravingNow.current = engraving;
  });

  // Load the engine and draw; again whenever the width changes.
  useEffect(() => {
    const outer = frame.current;
    const target = host.current;
    if (!outer || !target) return;
    const oneScreen = window.matchMedia(ONE_SCREEN);
    let cancelled = false;
    let tk: Toolkit | null = null;
    // Our note id → Verovio's id, kept across relayouts (same document, same ids).
    let ids: Map<string, string> | null = null;
    let width = 0;
    let scale = 0;

    const widthOf = () => Math.max(280, Math.floor(target.clientWidth));
    // The frame's height counts only where the page is one screen and the frame takes the height
    // the rest leaves (styles.css, .piece-session); elsewhere it grows with the score.
    const scaleNow = () =>
      Math.round(
        scaleFor(
          widthOf(),
          fillHeight && oneScreen.matches ? Math.floor(outer.clientHeight) : null,
        ) * zoom,
      );

    function draw() {
      if (!tk) return;
      width = widthOf();
      scale = scaleNow();
      const reloaded = layoutPiece(tk, xml, width, scale, engravingNow.current);
      target!.innerHTML = tk.renderToSVG(1);
      // Everything is drawn under one color="black"; CSS decides the ink instead.
      for (const el of target!.querySelectorAll('[color]')) el.removeAttribute('color');
      const svg = target!.querySelector('svg');
      svg?.classList.add('score-svg');
      svg?.setAttribute('aria-hidden', 'true');
      // For inspection: the staff size this drawing uses (verovio.ts, scaleFor).
      svg?.setAttribute('data-scale', String(scale));
      const measures = [...target!.querySelectorAll('g.measure')];
      if (!ids || reloaded) {
        const mapping = mapNotes(
          tk,
          score,
          measures.map((m) => m.getAttribute('data-id') ?? ''),
        );
        ids = mapping.notes;
        status.current({ state: 'ready', unplaced: mapping.unplaced.length });
      }
      const byId = new Map<string, Element>();
      for (const el of target!.querySelectorAll('g.note')) {
        const id = el.getAttribute('data-id');
        if (id) byId.set(id, el);
      }
      const notes = new Map<string, Element>();
      for (const [ours, theirs] of ids) {
        const el = byId.get(theirs);
        if (el) notes.set(ours, el);
      }
      setDrawing({ notes, measures });
    }

    status.current({ state: 'loading' });
    loadVerovio().then(
      (toolkit) => {
        if (cancelled) return;
        tk = toolkit;
        try {
          draw();
        } catch (error) {
          console.error('dacapo: could not draw the score', error);
          status.current({ state: 'failed', reason: 'render' });
        }
      },
      (error: unknown) => {
        console.error('dacapo: could not load Verovio', error);
        if (!cancelled) status.current({ state: 'failed', reason: 'engine' });
      },
    );

    let timer = 0;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!cancelled && tk && (widthOf() !== width || scaleNow() !== scale)) draw();
      }, RELAYOUT_DEBOUNCE_MS);
    });
    observer.observe(outer);
    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timer);
      target.replaceChildren();
      setDrawing(null);
    };
  }, [xml, score, zoom, engravingId, fillHeight]);

  // Notes the selected hands do not play are drawn lighter.
  useLayoutEffect(() => {
    if (!drawing) return;
    const other: Element[] = [];
    for (const note of score.notes) {
      if (inHands(note.hand, hands)) continue;
      const el = drawing.notes.get(note.id);
      if (el) other.push(el);
    }
    for (const el of other) el.classList.add('is-other');
    return () => {
      for (const el of other) el.classList.remove('is-other');
    };
  }, [drawing, score, hands]);

  // The current step: its notes inked, the played ones "ok", tied continuations muted, and so are
  // the notes the app plays for the player (beyond their keyboard): shown, not pressed.
  useLayoutEffect(() => {
    if (!drawing || !step) return;
    const midiOf = new Map(score.notes.map((n) => [n.id, n.midi]));
    const marked: Element[] = [];
    for (const id of step.noteIds) {
      const el = drawing.notes.get(id);
      if (!el) continue;
      el.classList.add(pressed.includes(midiOf.get(id)!) ? 'is-pressed' : 'is-current');
      marked.push(el);
    }
    for (const id of [...step.heldIds, ...(step.givenIds ?? [])]) {
      const el = drawing.notes.get(id);
      if (!el) continue;
      el.classList.add('is-held');
      marked.push(el);
    }
    return () => {
      for (const el of marked) el.classList.remove('is-current', 'is-pressed', 'is-held');
    };
  }, [drawing, step, pressed, score]);

  // Memory mode: the hidden bars fade, but for those revealed; single notes can show through.
  useLayoutEffect(() => {
    if (!drawing || !hiddenBars || hiddenBars.size === 0) return;
    const faded: Element[] = [];
    for (const index of hiddenBars) {
      const el = drawing.measures[index];
      if (!el || revealedBars?.has(index)) continue;
      el.classList.add('is-faded');
      faded.push(el);
    }
    const shown: Element[] = [];
    for (const id of revealedNotes ?? []) {
      const el = drawing.notes.get(id);
      if (!el) continue;
      // A chord's stem is the chord's.
      const chord = el.parentElement?.closest('g.chord');
      for (const target of chord ? [el, chord] : [el]) {
        target.classList.add('is-revealed');
        shown.push(target);
      }
    }
    return () => {
      for (const el of faded) el.classList.remove('is-faded');
      for (const el of shown) el.classList.remove('is-revealed');
    };
  }, [drawing, hiddenBars, revealedBars, revealedNotes]);

  // Classes for single notes, laid on after the step's so they can override its ink.
  useLayoutEffect(() => {
    if (!drawing || !marks || marks.size === 0) return;
    const marked: [Element, string][] = [];
    for (const [id, name] of marks) {
      const el = drawing.notes.get(id);
      if (!el) continue;
      el.classList.add(name);
      marked.push([el, name]);
    }
    return () => {
      for (const [el, name] of marked) el.classList.remove(name);
    };
  }, [drawing, marks]);

  // Where each bar is drawn, for what is placed behind or over the bars; again on every relayout.
  const wantsBoxes = Boolean(behind || above);
  const [boxes, setBoxes] = useState<BarBoxes>(NO_BOXES);
  const [eventBoxes, setEventBoxes] = useState<EventBoxes>(NO_EVENTS);
  useLayoutEffect(() => {
    const sheet = page.current;
    if (!drawing || !sheet || !wantsBoxes) {
      setBoxes(NO_BOXES);
      setEventBoxes(NO_EVENTS);
      return;
    }
    const origin = sheet.getBoundingClientRect();
    const next = new Map<number, BarBox>();
    const nextEvents = new Map<number, EventBox[][]>();
    drawing.measures.forEach((measure, index) => {
      const box = measureBox(measure, origin);
      if (box) next.set(index, boxOf(box));
      if (!events) return;
      const staves = [...measure.querySelectorAll(':scope > g.staff')].map((staff) =>
        [...staff.querySelectorAll('g.note, g.rest')].flatMap((el): EventBox[] => {
          const whole = unionRect([el], origin);
          const head = unionRect([el.querySelector('.notehead') ?? el], origin);
          return whole && head ? [{ head: boxOf(head), whole: boxOf(whole) }] : [];
        }),
      );
      nextEvents.set(index, staves);
    });
    setBoxes(next);
    setEventBoxes(events ? nextEvents : NO_EVENTS);
  }, [drawing, wantsBoxes, events]);

  // The band behind the step, and the scroll that keeps its system (and the next) in view.
  const system = useRef<Element | null>(null);
  useLayoutEffect(() => {
    const el = band.current;
    const sheet = page.current;
    const outer = frame.current;
    if (!el || !sheet || !outer) return;
    const measure = step ? drawing?.measures[step.measure] : undefined;
    if (!drawing || !step || !measure) {
      el.hidden = true;
      return;
    }
    const origin = sheet.getBoundingClientRect();
    const box = measureBox(measure, origin);
    const heads = unionRect(
      [...step.noteIds, ...(step.givenIds ?? [])].flatMap((id) => drawing.notes.get(id) ?? []),
      origin,
    );
    if (!box) {
      el.hidden = true;
      return;
    }
    // Without a drawn note (it could not be placed) the whole bar is marked.
    const x = heads ? heads.left - 6 : box.left;
    const w = heads ? heads.width + 12 : box.width;
    const y = box.top - 12;
    const h = box.height + 24;
    const wasHidden = el.hidden;
    el.hidden = false;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = `translate(${x}px, ${y}px)`;
    if (wasHidden) el.getBoundingClientRect(); // no slide in from the corner

    const current = measure.closest('g.system');
    if (current !== system.current) {
      system.current = current;
      const top = box.top - 32;
      const visible =
        top >= outer.scrollTop && box.bottom + 24 <= outer.scrollTop + outer.clientHeight;
      if (!visible || top > outer.scrollTop + outer.clientHeight / 3) {
        outer.scrollTo({
          top: Math.max(0, top),
          behavior: prefersReducedMotion() ? 'instant' : 'smooth',
        });
      }
    }
  }, [drawing, step]);

  return (
    <div className="score-frame" ref={frame}>
      <div className="score-page" ref={page}>
        <div className="score-layer" aria-hidden="true">
          {behind?.(boxes)}
          <div
            ref={band}
            className={cursorWrong ? 'score-cursor is-wrong' : 'score-cursor'}
            hidden
          />
        </div>
        <div
          className="score-host"
          ref={host}
          role="img"
          aria-label={t('pieces.score', { title })}
        />
        {above?.(boxes, eventBoxes)}
      </div>
    </div>
  );
}

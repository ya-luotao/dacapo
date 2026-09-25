import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { inHands, type HandSelection, type Score, type Step } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { layoutPiece, loadVerovio, mapNotes, type Toolkit } from './verovio.ts';

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
  hands: HandSelection;
  onStatus: (status: ScoreStatus) => void;
}

/** One drawing of the score: our note ids and measures addressed in Verovio's SVG. */
interface Drawing {
  /** Our note id → the note's SVG group. */
  notes: Map<string, Element>;
  /** Written measure index → its SVG group. */
  measures: Element[];
}

const RELAYOUT_DEBOUNCE_MS = 150;

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
export function ScoreView({ xml, score, title, step, pressed, hands, onStatus }: ScoreViewProps) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const status = useRef(onStatus);
  useLayoutEffect(() => {
    status.current = onStatus;
  });

  // Load the engine and draw; again whenever the width changes.
  useEffect(() => {
    const outer = frame.current;
    const target = host.current;
    if (!outer || !target) return;
    let cancelled = false;
    let tk: Toolkit | null = null;
    // Our note id → Verovio's id, kept across relayouts (same document, same ids).
    let ids: Map<string, string> | null = null;
    let width = 0;

    const widthOf = () => Math.max(280, Math.floor(target.clientWidth));

    function draw() {
      if (!tk) return;
      width = widthOf();
      const reloaded = layoutPiece(tk, xml, width);
      target!.innerHTML = tk.renderToSVG(1);
      // Everything is drawn under one color="black"; CSS decides the ink instead.
      for (const el of target!.querySelectorAll('[color]')) el.removeAttribute('color');
      const svg = target!.querySelector('svg');
      svg?.classList.add('score-svg');
      svg?.setAttribute('aria-hidden', 'true');
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
        if (!cancelled && tk && widthOf() !== width) draw();
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
  }, [xml, score]);

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

  // The current step: its notes inked, the played ones "ok", tied continuations muted.
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
    for (const id of step.heldIds) {
      const el = drawing.notes.get(id);
      if (!el) continue;
      el.classList.add('is-held');
      marked.push(el);
    }
    return () => {
      for (const el of marked) el.classList.remove('is-current', 'is-pressed', 'is-held');
    };
  }, [drawing, step, pressed, score]);

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
      step.noteIds.flatMap((id) => drawing.notes.get(id) ?? []),
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
          <div ref={band} className="score-cursor" hidden />
        </div>
        <div
          className="score-host"
          ref={host}
          role="img"
          aria-label={t('pieces.score', { title })}
        />
      </div>
    </div>
  );
}

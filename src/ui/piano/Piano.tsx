import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { MIDDLE_C, midiName, PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import type { PointerInput } from '../../input/index.ts';
import {
  BLACK_LENGTH,
  pianoLayout,
  velocityOpacity,
  type KeyGeometry,
  type PianoLayout,
} from './layout.ts';

// Screen-reader and keyboard activation of a key (no pointer) plays it as a short tap.
const ACTIVATION_POINTER = -1;

interface Keys {
  layout: PianoLayout;
  geometry: ReadonlyMap<number, KeyGeometry>;
}

const FULL = keysOf(PIANO_LOWEST, PIANO_HIGHEST);

function keysOf(low: number, high: number): Keys {
  const layout = pianoLayout(low, high);
  return { layout, geometry: new Map(layout.keys.map((key) => [key.midi, key])) };
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Scrolls so that `low`–`high` is centred; with `onlyIfHidden`, only when part of it is out of view. */
function scrollToKeys(
  el: HTMLElement,
  { layout, geometry }: Keys,
  low: number,
  high: number,
  onlyIfHidden: boolean,
) {
  const first = geometry.get(low);
  const last = geometry.get(high);
  if (!first || !last) return;
  const scale = el.scrollWidth / layout.width;
  const left = first.left * scale;
  const right = (last.left + last.width) * scale;
  if (onlyIfHidden && left >= el.scrollLeft && right <= el.scrollLeft + el.clientWidth) return;
  el.scrollTo({
    left: (left + right) / 2 - el.clientWidth / 2,
    behavior: onlyIfHidden && !prefersReducedMotion() ? 'smooth' : 'instant',
  });
}

/** Scrolls `keys` into view if any of them is hidden. */
function revealKeys(el: HTMLElement | null, piano: Keys, keys: Iterable<number>) {
  const onPiano = [...keys].filter((midi) => piano.geometry.has(midi));
  if (!el || onPiano.length === 0) return;
  scrollToKeys(el, piano, Math.min(...onPiano), Math.max(...onPiano), true);
}

function keyAt(target: EventTarget): number | null {
  const el = (target as Element).closest?.('[data-midi]');
  return el instanceof HTMLElement ? Number(el.dataset.midi) : null;
}

interface PianoProps {
  held: ReadonlyMap<number, number>;
  sustained: ReadonlySet<number>;
  pointer: PointerInput;
  /** Keys to point out, e.g. the answer after a wrong press: outlined and marked with a triangle. */
  marked?: ReadonlySet<number>;
  /** Keys just played wrong: flashed in the error colour. */
  wrong?: ReadonlySet<number>;
  /** A shorter keyboard (both ends white keys); the whole 88 keys by default. */
  range?: readonly [low: number, high: number];
  className?: string;
}

const NONE: ReadonlySet<number> = new Set();

export function Piano({
  held,
  sustained,
  pointer,
  marked = NONE,
  wrong = NONE,
  range,
  className,
}: PianoProps) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const [low, high] = range ?? [PIANO_LOWEST, PIANO_HIGHEST];
  const piano = useMemo(() => (range ? keysOf(low, high) : FULL), [range, low, high]);
  const { layout } = piano;
  const percent = (units: number) => `${(units / layout.width) * 100}%`;

  const labels = useMemo(
    () =>
      new Map(
        layout.keys.map(({ midi, black }) => {
          const name = midiName(midi);
          if (black)
            return [midi, t('piano.key.black', { sharp: name, flat: midiName(midi, 'flat') })];
          return [midi, midi === MIDDLE_C ? t('piano.key.middleC', { name }) : name];
        }),
      ),
    [t, layout],
  );

  useLayoutEffect(() => {
    const centre = piano.geometry.has(MIDDLE_C) ? MIDDLE_C : Math.round((low + high) / 2);
    if (scroller.current) scrollToKeys(scroller.current, piano, centre, centre, false);
  }, [piano, low, high]);

  useEffect(() => revealKeys(scroller.current, piano, held.keys()), [piano, held]);
  useEffect(() => revealKeys(scroller.current, piano, marked), [piano, marked]);

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const midi = keyAt(e.target);
    if (midi !== null) pointer.press(e.pointerId, midi, e.timeStamp);
  }

  // Mouse glissando: sliding onto another key while the button is down plays it. Touch pointers
  // are captured by the key they started on, so on touch screens a drag scrolls instead.
  function onPointerOver(e: PointerEvent) {
    if (!pointer.isDown(e.pointerId)) return;
    const midi = keyAt(e.target);
    if (midi !== null) pointer.press(e.pointerId, midi, e.timeStamp);
  }

  function onPointerEnd(e: PointerEvent) {
    pointer.release(e.pointerId, e.timeStamp);
  }

  function onKeyActivate(midi: number, detail: number, time: number) {
    if (detail !== 0) return;
    pointer.press(ACTIVATION_POINTER, midi, time);
    pointer.release(ACTIVATION_POINTER, time);
  }

  return (
    <div className={className ? `piano-scroller ${className}` : 'piano-scroller'} ref={scroller}>
      <div
        className="piano"
        role="group"
        aria-label={
          range
            ? t('piano.label.range', { low: midiName(low), high: midiName(high) })
            : t('piano.label')
        }
        style={{ aspectRatio: `${layout.width} / 5.6`, '--whites': layout.width } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {layout.keys.map(({ midi, black, left, width }) => {
          const velocity = held.get(midi);
          const state =
            (velocity !== undefined ? ' is-held' : sustained.has(midi) ? ' is-sustained' : '') +
            (marked.has(midi) ? ' is-marked' : '') +
            (wrong.has(midi) ? ' is-wrong' : '');
          return (
            <button
              key={midi}
              type="button"
              tabIndex={-1}
              className={`key ${black ? 'key-black' : 'key-white'}${state}`}
              style={{
                left: percent(left),
                width: percent(width),
                height: black ? `${BLACK_LENGTH * 100}%` : undefined,
              }}
              data-midi={midi}
              aria-label={
                marked.has(midi)
                  ? t('piano.key.marked', { name: labels.get(midi)! })
                  : labels.get(midi)
              }
              aria-pressed={velocity !== undefined}
              onClick={(e) => onKeyActivate(midi, e.detail, e.timeStamp)}
            >
              {velocity !== undefined && (
                <span className="key-fill" style={{ opacity: velocityOpacity(velocity) }} />
              )}
              {marked.has(midi) ? (
                <span className="key-target" aria-hidden="true">
                  <svg viewBox="0 0 10 8">
                    <path d="M5 0l5 8H0z" />
                  </svg>
                </span>
              ) : (
                midi === MIDDLE_C && (
                  <span className="key-mark" aria-hidden="true">
                    C4
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

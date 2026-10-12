import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FIRST_MIDI, freqOf, NAMES, PEDAL_NAMES, type PedalName } from '../../core/grandPiano.ts';
import { useHubState, useInput } from '../input/context.ts';
import { GrandPianoLive, type FigurePhase, type Reading } from './grandPiano/live.ts';
import { Choices } from './kit.tsx';
import { useStaticPage } from './lesson.ts';
import { LessonPiano } from './LessonPiano.tsx';

// One octave of a grand piano from the keys to the soundboard, played: every key from every
// keyboard plays its note of the octave in the drawing, slowed down if you like, and the three
// pedals work as on the instrument. The drawing comes from scripts/figures/grand-piano.mjs.

const SRC = `${import.meta.env.BASE_URL}learn/grand-piano.svg`;
/** Three octaves to play on: each folds into the drawing's one. */
const KEYS: readonly [number, number] = [48, 83];

export interface GrandPianoCopy {
  /** What the drawing shows, for a screen reader and as the picture's alternative text. */
  label: string;
  speeds: { real: string; slow4: string; slow10: string };
  pedals: Record<PedalName, string>;
  phases: Record<FigurePhase, string>;
  /** Shown while the figure plays by itself. */
  touring: string;
}

type Speed = '1' | '4' | '10';

export function GrandPiano({ copy }: { copy: GrandPianoCopy }) {
  const staticPage = useStaticPage();
  const { hub, pointer } = useInput();
  const { sustain: hubSustain } = useHubState();
  const holder = useRef<HTMLDivElement>(null);
  const live = useRef<GrandPianoLive | null>(null);
  const [speed, setSpeed] = useState<Speed>('4');
  const [feet, setFeet] = useState<Record<PedalName, boolean>>({
    soft: false,
    sostenuto: false,
    sustain: false,
  });
  const [midiFeet, setMidiFeet] = useState<Record<PedalName, boolean>>({
    soft: false,
    sostenuto: false,
    sustain: false,
  });
  const [reading, setReading] = useState<Reading | null>(null);

  // The drawing, loaded once and moved by its controller without React.
  useEffect(() => {
    if (staticPage) return;
    let gone = false;
    void fetch(SRC)
      .then((response) => response.text())
      .then((text) => {
        const el = holder.current;
        if (gone || !el) return;
        el.innerHTML = text;
        const svg = el.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('aria-label', copy.label);
        live.current = new GrandPianoLive(svg, setReading);
        live.current.setSpeed(Number(speed), false);
      });
    return () => {
      gone = true;
      live.current?.destroy();
      live.current = null;
    };
    // The drawing is made once; speed and words reach it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticPage]);

  useEffect(() => {
    holder.current?.querySelector('svg')?.setAttribute('aria-label', copy.label);
  }, [copy.label]);

  // Every key from every source, folded into the octave the drawing has.
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on' || event.type === 'off') {
          live.current?.press(
            ((event.midi % 12) + 12) % 12,
            event.type === 'on',
            event.velocity / 127,
          );
        } else if (event.type === 'pedal' && event.controller !== 64) {
          const name: PedalName = event.controller === 66 ? 'sostenuto' : 'soft';
          setMidiFeet((now) => ({ ...now, [name]: event.value >= 64 }));
        }
      }),
    [hub],
  );

  // The pedals: a button or a real pedal holds each one down.
  const sustain = hubSustain || midiFeet.sustain;
  const wanted = useRef<Record<PedalName, boolean> | null>(null);
  useEffect(() => {
    const next = {
      soft: feet.soft || midiFeet.soft,
      sostenuto: feet.sostenuto || midiFeet.sostenuto,
      sustain: feet.sustain || sustain,
    };
    const before = wanted.current;
    wanted.current = next;
    if (!before) return;
    for (const name of PEDAL_NAMES)
      if (next[name] !== before[name]) live.current?.setPedal(name, next[name]);
  }, [feet, midiFeet, sustain]);

  useEffect(() => {
    live.current?.setSpeed(Number(speed));
  }, [speed]);

  if (staticPage) {
    return (
      <div className="grand-piano">
        <img
          className="grand-piano-figure"
          src={SRC}
          alt={copy.label}
          width={760}
          height={440}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  // A key in the drawing plays like a key of the on-screen piano: through the hub, so it sounds.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const figure = live.current;
    if (!figure) return;
    const target = event.target as Element;
    const pedal = figure.pedalOf(target);
    if (pedal) {
      setFeet((now) => ({ ...now, [pedal]: true }));
      const up = () => {
        setFeet((now) => ({ ...now, [pedal]: false }));
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      return;
    }
    const note = figure.noteAt(target);
    const i = note >= 0 ? note : figure.nearestKey(event.clientX, event.clientY);
    if (i < 0) return;
    pointer.press(event.pointerId, FIRST_MIDI + i, performance.now());
    const up = (end: PointerEvent) => {
      if (end.pointerId !== event.pointerId) return;
      pointer.release(event.pointerId, performance.now());
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const shown = reading ?? { note: 9, phase: 'rest' as const, pedals: feet, touring: true };
  return (
    <div className="grand-piano">
      <div className="plate-toolbar">
        <Choices
          value={speed}
          onChange={setSpeed}
          options={[
            { value: '1', label: copy.speeds.real },
            { value: '4', label: copy.speeds.slow4 },
            { value: '10', label: copy.speeds.slow10 },
          ]}
        />
      </div>
      <div className="plate-toolbar">
        {PEDAL_NAMES.map((name) => {
          const down = shown.pedals[name];
          const fromFoot = name === 'sustain' ? sustain : midiFeet[name];
          return (
            <button
              key={name}
              type="button"
              className={down ? 'button is-compact is-current' : 'button is-compact'}
              aria-pressed={down}
              // Held down by a real pedal: only letting go of it lifts it.
              disabled={fromFoot}
              onClick={() => setFeet((now) => ({ ...now, [name]: !now[name] }))}
            >
              {copy.pedals[name]}
            </button>
          );
        })}
      </div>
      <p className="plate-readout grand-piano-readout" aria-live={shown.touring ? 'off' : 'polite'}>
        <b>{NAMES[shown.note]}</b>
        <span>{Math.round(freqOf(shown.note))} Hz</span>
        <span>{copy.phases[shown.phase]}</span>
        {shown.touring && <span className="muted">{copy.touring}</span>}
      </p>
      <div className="grand-piano-figure" ref={holder} onPointerDown={onPointerDown} />
      <LessonPiano range={KEYS} />
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  keyDownSeconds,
  REST,
  stepAction,
  type ActionPhase,
  type ActionState,
} from '../../core/pianoAction.ts';
import { useHubState, useInput } from '../input/context.ts';
import type { PartId } from './actionParts.ts';
import { Choices } from './kit.tsx';
import { keyName, usePlayKey } from './lesson.ts';
import { LessonPiano } from './LessonPiano.tsx';
import { PianoActionDrawing } from './PianoActionDrawing.tsx';

// The piano action, played: every key pressed anywhere (a MIDI keyboard, the computer keys, the
// keyboard under the drawing) drives it, at its own speed, slowed down if you like. The steps
// under it light up as the action goes through them.

const STEP = 0.0005;
/** How long a press is kept down in the drawing at least, so a slowed-down tap still plays out. */
const MIN_HOLD = 0.2;

export interface InsideCopy {
  label: string;
  speed: string;
  speeds: { real: string; slow4: string; slow10: string };
  names: string;
  sustain: string;
  play: string;
  pressed: string;
  loudness: string;
  pointAt: string;
  parts: Record<PartId, { name: string; text: string }>;
  steps: readonly { phase: ActionPhase; text: string }[];
}

type Speed = '1' | '4' | '10';

interface Press {
  midi: number;
  down: boolean;
  velocity: number;
  /** Simulated seconds until which the key stays down in the drawing, whatever the player does. */
  until: number;
}

export function InsideAction({ copy }: { copy: InsideCopy }) {
  const { hub } = useInput();
  const { sustain: pedal } = useHubState();
  const play = usePlayKey();
  const [speed, setSpeed] = useState<Speed>('4');
  const [showNames, setShowNames] = useState(true);
  const [sustain, setSustain] = useState(false);
  const [focus, setFocus] = useState<PartId | null>(null);
  const [view, setView] = useState<{ state: ActionState; time: number; midi: number | null }>({
    state: REST,
    time: 0,
    midi: null,
  });
  const press = useRef<Press | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // On a narrow screen the drawing scrolls: open it on the hammer and the jack, not the key's end.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) * 0.6;
  }, []);
  const sim = useRef({ state: REST, time: 0 });
  const slow = useRef(4);
  const sustained = useRef(false);
  useEffect(() => {
    slow.current = Number(speed);
    sustained.current = sustain || pedal;
  }, [speed, sustain, pedal]);

  // Every key from every source, the drawing's own demo included.
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') {
          const velocity = event.velocity / 127;
          press.current = {
            midi: event.midi,
            down: true,
            velocity,
            until: sim.current.time + keyDownSeconds(velocity) + MIN_HOLD,
          };
        } else if (event.type === 'off' && press.current?.midi === event.midi) {
          press.current = { ...press.current, down: false };
        }
      }),
    [hub],
  );

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) / slow.current;
      last = now;
      let { state, time } = sim.current;
      const p = press.current;
      for (let t = 0; t < dt; t += STEP) {
        time += STEP;
        state = stepAction(
          state,
          {
            down: p !== null && (p.down || time < p.until),
            velocity: p?.velocity ?? 0.6,
            sustain: sustained.current,
          },
          STEP,
        );
      }
      sim.current = { state, time };
      setView({ state, time, midi: p?.midi ?? null });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const { state } = view;
  const shown = focus ? copy.parts[focus] : null;

  return (
    <div className="inside">
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
        <button
          type="button"
          className={showNames ? 'button is-compact is-current' : 'button is-compact'}
          aria-pressed={showNames}
          onClick={() => setShowNames(!showNames)}
        >
          {copy.names}
        </button>
        <button
          type="button"
          className={sustain || pedal ? 'button is-compact is-current' : 'button is-compact'}
          aria-pressed={sustain || pedal}
          onClick={() => setSustain(!sustain)}
        >
          {copy.sustain}
        </button>
        <button
          type="button"
          className="button button-primary is-compact"
          onClick={() => play(60, 700)}
        >
          <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
            <path d="M1 1l8 5-8 5z" />
          </svg>
          {copy.play}
        </button>
      </div>

      <div className="inside-readout" aria-live="off">
        <span>
          {copy.pressed} <b>{view.midi === null ? '—' : keyName(view.midi)}</b>
        </span>
        <span className="inside-meter">
          {copy.loudness}
          <i style={{ transform: `scaleX(${state.ring})` }} />
        </span>
      </div>

      <div className="act-scroll" ref={scroller}>
        <PianoActionDrawing
          state={state}
          time={view.time}
          names={
            showNames
              ? (Object.fromEntries(
                  Object.entries(copy.parts).map(([id, p]) => [id, p.name]),
                ) as Record<PartId, string>)
              : null
          }
          focus={focus}
          onFocus={setFocus}
          label={copy.label}
        />
      </div>

      <p className="inside-part" aria-live="polite">
        {shown ? (
          <>
            <b>{shown.name}</b> {shown.text}
          </>
        ) : (
          <span className="muted">{copy.pointAt}</span>
        )}
      </p>

      <ol className="inside-steps">
        {copy.steps.map((step, i) => (
          <li key={i} className={step.phase === state.phase ? 'is-current' : undefined}>
            {step.text}
          </li>
        ))}
      </ol>

      <LessonPiano range={[48, 83]} />
    </div>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  keyDownSeconds,
  REST,
  stepAction,
  type ActionPhase,
  type ActionState,
} from '../../core/pianoAction.ts';
import { useHubState, useInput } from '../input/context.ts';
import { PART_IDS, type PartId } from './actionParts.ts';
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
/** Each step stays lit at least this long (real ms): some last a few milliseconds in the action. */
const STEP_MS = 320;
const KEYS: readonly [number, number] = [48, 83];
/** The touch the drawing uses for keys that cannot sense it (the computer keys, a click). */
const TOUCH = { soft: 0.15, loud: 1 } as const;

export interface InsideCopy {
  label: string;
  speeds: { real: string; slow4: string; slow10: string };
  touch: { key: string; soft: string; loud: string };
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
type Touch = 'key' | 'soft' | 'loud';

interface Press {
  midi: number;
  down: boolean;
  velocity: number;
  /** Simulated seconds until which the key stays down in the drawing, whatever the player does. */
  until: number;
}

/**
 * The step to light, one after another, each for at least STEP_MS: the let-off lasts a few
 * milliseconds, and would otherwise never show.
 */
class StepQueue {
  private queue: ActionPhase[] = [];
  private shown: ActionPhase = 'rest';
  private since = 0;

  push(phase: ActionPhase) {
    const last = this.queue.at(-1) ?? this.shown;
    if (phase !== last) this.queue.push(phase);
    // Far behind (a burst of notes): skip to the newest.
    if (this.queue.length > 5) this.queue = this.queue.slice(-2);
  }

  current(now: number): ActionPhase {
    if (this.queue.length > 0 && now - this.since >= STEP_MS) {
      this.shown = this.queue.shift()!;
      this.since = now;
    }
    return this.shown;
  }
}

export function InsideAction({ copy }: { copy: InsideCopy }) {
  const { hub } = useInput();
  const { sustain: pedal } = useHubState();
  const play = usePlayKey();
  const [speed, setSpeed] = useState<Speed>('4');
  const [touch, setTouch] = useState<Touch>('key');
  const [showNames, setShowNames] = useState(true);
  const [sustain, setSustain] = useState(false);
  const [focus, setFocus] = useState<PartId | null>(null);
  const [view, setView] = useState<{
    state: ActionState;
    time: number;
    midi: number | null;
    step: ActionPhase;
  }>({ state: REST, time: 0, midi: null, step: 'rest' });
  const press = useRef<Press | null>(null);
  const sim = useRef({ state: REST, time: 0 });
  const steps = useRef(new StepQueue());
  const settings = useRef<{ slow: number; sustain: boolean; touch: Touch }>({
    slow: 4,
    sustain: false,
    touch: 'key',
  });
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    settings.current = { slow: Number(speed), sustain: sustain || pedal, touch };
  }, [speed, sustain, pedal, touch]);

  // On a narrow screen the drawing scrolls: open it on the hammer and the jack, not the key's end.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) * 0.6;
  }, []);

  // Every key from every source, the drawing's own demo included.
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') {
          const chosen = settings.current.touch;
          const velocity = chosen === 'key' ? event.velocity / 127 : TOUCH[chosen];
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
    let still = false;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) / settings.current.slow;
      last = now;
      let { state, time } = sim.current;
      const p = press.current;
      for (let t = 0; t < dt; t += STEP) {
        const before = state;
        time += STEP;
        state = stepAction(
          state,
          {
            down: p !== null && (p.down || time < p.until),
            velocity: p?.velocity ?? 0.6,
            sustain: settings.current.sustain,
          },
          STEP,
        );
        // Repetition: as the key rises, the repetition lever holds the hammer up until the jack
        // springs back under it; only then is it the key's return and the damper's fall.
        const repeating =
          (before.jackOut && !state.jackOut && state.key > 0.2) ||
          (state.phase === 'release' && state.jackOut);
        steps.current.push(repeating ? 'repeat' : state.phase);
      }
      sim.current = { state, time };
      const step = steps.current.current(now);
      // At rest with nothing to show, the drawing is left alone.
      const idle =
        state.phase === 'rest' && state.ring === 0 && state.damper === 0 && step === 'rest';
      if (!(idle && still)) setView({ state, time, midi: p?.midi ?? null, step });
      still = idle;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const names = useMemo(
    () =>
      showNames
        ? (Object.fromEntries(PART_IDS.map((id) => [id, copy.parts[id].name])) as Record<
            PartId,
            string
          >)
        : null,
    [showNames, copy],
  );

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
        <Choices
          value={touch}
          onChange={setTouch}
          options={[
            { value: 'key', label: copy.touch.key },
            { value: 'soft', label: copy.touch.soft },
            { value: 'loud', label: copy.touch.loud },
          ]}
        />
      </div>
      <div className="plate-toolbar">
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
          // Held down by a real pedal: only letting go of it lifts it.
          disabled={pedal}
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

      <div className="inside-readout">
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
          names={names}
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
      {/* The parts by name, for the keyboard and for a small screen. */}
      <div className="inside-parts">
        {PART_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={focus === id ? 'is-current' : undefined}
            aria-pressed={focus === id}
            onClick={() => setFocus(focus === id ? null : id)}
          >
            {copy.parts[id].name}
          </button>
        ))}
      </div>

      <ol className="inside-steps">
        {copy.steps.map((step, i) => (
          <li key={i} className={step.phase === view.step ? 'is-current' : undefined}>
            {step.text}
          </li>
        ))}
      </ol>

      <LessonPiano range={KEYS} />
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import {
  CHECK,
  keyDownSeconds,
  REST,
  stepAction,
  type ActionInput,
  type ActionState,
} from './pianoAction.ts';

const DT = 0.001;

function run(state: ActionState, input: ActionInput, seconds: number, seen?: Set<string>) {
  let s = state;
  for (let t = 0; t < seconds; t += DT) {
    s = stepAction(s, input, DT);
    seen?.add(s.phase);
  }
  return s;
}

const press = (velocity: number): ActionInput => ({ down: true, velocity, sustain: false });
const lift: ActionInput = { down: false, velocity: 0, sustain: false };

describe('the piano action', () => {
  it('throws the hammer at the string, then the backcheck catches it while the key is held', () => {
    const seen = new Set<string>();
    const s = run(REST, press(0.7), 0.4, seen);
    expect(seen).toContain('free');
    expect(seen).toContain('strike');
    expect(s.key).toBe(1);
    expect(s.jackOut).toBe(true);
    expect(s.checked).toBe(true);
    expect(s.hammer).toBe(CHECK);
    expect(s.damper).toBe(1);
    expect(s.ring).toBeGreaterThan(0.3);
  });

  it('strikes louder for a faster press', () => {
    const soft = run(REST, press(0.1), 0.3);
    const loud = run(REST, press(1), 0.3);
    expect(loud.ring).toBeGreaterThan(soft.ring);
    expect(keyDownSeconds(1)).toBeLessThan(keyDownSeconds(0));
  });

  it('keeps the string ringing while held, and silences it when the damper falls', () => {
    const held = run(REST, press(0.7), 0.5);
    const stillRinging = run(held, press(0.7), 0.5);
    expect(stillRinging.ring).toBeGreaterThan(0.1);
    const released = run(stillRinging, lift, 0.4);
    expect(released.key).toBe(0);
    expect(released.hammer).toBe(0);
    expect(released.damper).toBe(0);
    expect(released.ring).toBe(0);
    expect(released.phase).toBe('rest');
  });

  it('lets the sustain pedal keep the damper up after the key is released', () => {
    const held = run(REST, press(0.7), 0.4);
    const pedal = run(held, { down: false, velocity: 0, sustain: true }, 0.4);
    expect(pedal.damper).toBe(1);
    expect(pedal.ring).toBeGreaterThan(0.1);
  });

  it('repeats from a key let only part way up: the jack is back under the hammer', () => {
    let s = run(REST, press(0.8), 0.4);
    // Let the key rise only part way, then press it again.
    s = run(s, lift, 0.03);
    expect(s.key).toBeGreaterThan(0.4);
    expect(s.jackOut).toBe(false);
    const strikes = s.sinceStrike;
    s = run(s, press(0.8), 0.3);
    expect(strikes).toBeGreaterThan(0.1);
    expect(s.sinceStrike).toBeLessThan(0.3);
  });
});

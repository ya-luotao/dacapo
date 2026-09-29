// A grand piano's action, one key, in motion: the key, the jack that throws the hammer and lets it
// go, the hammer's free flight to the string and back, the backcheck that catches it, the damper,
// and the string ringing. Simplified, but in the right order and with the right causes, for the
// "Inside the piano" page. Positions are fractions of their travel; time is in seconds.

/** How far the key goes down before the jack lets go of the hammer (let-off). */
export const LET_OFF = 0.88;
/** Where the backcheck catches the falling hammer while the key is held. */
export const CHECK = 0.44;
/** Down this far, the key holds the backcheck up to catch the hammer. */
export const HELD = 0.9;
/** How far above the jack the repetition lever lifts the hammer, once the key comes up a little. */
const LIFT = 0.06;
/** The key must be this far down before it starts lifting the damper. */
const DAMPER_FROM = 0.3;
const GRAVITY = 40;
const REBOUND = 0.35;
/** Hammer speed (travel per second) that makes the loudest note. */
const LOUD = 30;
const KEY_UP_SECONDS = 0.08;
const DAMPER_SECONDS = 0.05;
/** How fast a note dies away: slowly while the damper is off the string, at once when it lands. */
const RING_SECONDS = 2.5;
const DAMPED_SECONDS = 0.06;

export type ActionPhase = 'rest' | 'down' | 'free' | 'strike' | 'checked' | 'repeat' | 'release';

export interface ActionState {
  /** How far the key is down, 0–1. */
  key: number;
  /** The hammer's height, 0 at rest to 1 against the string. */
  hammer: number;
  hammerSpeed: number;
  /** Whether the jack has let go of the hammer. */
  jackOut: boolean;
  /** The jack's tilt as drawn, 0 under the hammer to 1 fully out. */
  jack: number;
  /** Whether the backcheck holds the hammer. */
  checked: boolean;
  /** How far the damper is off the string, 0–1. */
  damper: number;
  /** How loud the string is ringing, 0–1. */
  ring: number;
  /** Seconds since the string was last struck. */
  sinceStrike: number;
  phase: ActionPhase;
}

export interface ActionInput {
  /** The key is held down (by the player, or kept down so a slow motion can finish). */
  down: boolean;
  /** How fast it is pressed, 0–1 (a MIDI velocity / 127). */
  velocity: number;
  /** The sustain pedal: every damper off the strings. */
  sustain: boolean;
}

export const REST: ActionState = {
  key: 0,
  hammer: 0,
  hammerSpeed: 0,
  jackOut: false,
  jack: 0,
  checked: false,
  damper: 0,
  ring: 0,
  sinceStrike: Infinity,
  phase: 'rest',
};

/** Seconds a press takes to bring the key down: a fast press is a loud one. */
export function keyDownSeconds(velocity: number): number {
  const v = Math.min(1, Math.max(0, velocity));
  return 0.14 - 0.11 * v;
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** One step of `dt` seconds. */
export function stepAction(s: ActionState, input: ActionInput, dt: number): ActionState {
  const key = approach(
    s.key,
    input.down ? 1 : 0,
    dt / (input.down ? keyDownSeconds(input.velocity) : KEY_UP_SECONDS),
  );
  const keySpeed = (key - s.key) / dt;
  let { hammer, hammerSpeed, jackOut, checked, ring, sinceStrike } = s;
  sinceStrike += dt;

  // Let-off: near the bottom of the key's travel the jack tips out from under the hammer, which
  // flies on by itself at the speed the jack gave it.
  if (!jackOut && input.down && key >= LET_OFF) {
    jackOut = true;
    hammerSpeed = Math.max(hammerSpeed, keySpeed);
  }

  if (!jackOut) {
    // The jack carries the hammer: it rides on it, or falls back onto it.
    if (hammer <= key + 1e-6) {
      hammer = key;
      hammerSpeed = keySpeed;
    } else {
      hammerSpeed -= GRAVITY * dt;
      hammer += hammerSpeed * dt;
      if (hammer <= key) {
        hammer = key;
        hammerSpeed = keySpeed;
      }
    }
  } else if (checked) {
    hammer = CHECK;
    hammerSpeed = 0;
    // Letting the key up a little frees the hammer from the backcheck.
    if (key < HELD) checked = false;
  } else {
    hammerSpeed -= GRAVITY * dt;
    hammer += hammerSpeed * dt;
    if (hammer >= 1) {
      ring = Math.min(1, Math.max(ring, hammerSpeed / LOUD));
      sinceStrike = 0;
      hammer = 1;
      hammerSpeed = -hammerSpeed * REBOUND;
    }
    if (key >= HELD) {
      // Key held: the falling hammer pushes the repetition lever down and the backcheck catches it.
      if (hammerSpeed < 0 && hammer <= CHECK) {
        checked = true;
        hammer = CHECK;
        hammerSpeed = 0;
      }
    } else {
      // Key part way up: the repetition lever's spring lifts the hammer a little above the jack.
      const lever = Math.min(LET_OFF, key + LIFT);
      if (hammer <= lever && hammerSpeed <= 0) {
        hammer = approach(hammer, lever, dt / 0.03);
        hammerSpeed = 0;
      }
      // With the hammer lifted clear, the jack springs back under it: the note can be played again
      // without letting the key all the way up.
      if (hammerSpeed <= 0 && hammer >= key + LIFT / 2) jackOut = false;
    }
  }
  if (key === 0) {
    jackOut = false;
    checked = false;
  }

  const lift = input.sustain ? 1 : Math.min(1, Math.max(0, (key - DAMPER_FROM) / 0.4));
  const damper = approach(s.damper, lift, dt / DAMPER_SECONDS);
  ring *= Math.exp(-dt / (damper < 0.15 ? DAMPED_SECONDS : RING_SECONDS));
  if (ring < 0.002) ring = 0;

  const jack = approach(s.jack, jackOut ? 1 : 0, dt / 0.02);

  const phase: ActionPhase =
    key === 0 && hammer === 0
      ? 'rest'
      : !input.down
        ? 'release'
        : checked
          ? 'checked'
          : sinceStrike < 0.12
            ? 'strike'
            : jackOut && hammerSpeed > 0
              ? 'free'
              : jackOut
                ? 'repeat'
                : 'down';

  return {
    key,
    hammer,
    hammerSpeed,
    jackOut,
    jack,
    checked,
    damper,
    ring,
    sinceStrike,
    phase,
  };
}

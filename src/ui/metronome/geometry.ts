// The metronome's geometry: a Maelzel pyramid in the drawing's own units (the SVG viewBox), the
// tempo scale on its plate, and where the sliding weight sits for a tempo.
//
// The scale is spaced by the physics of the real one, not by eye. The pendulum is a compound
// pendulum: a heavy bob hidden in the case below the pivot, a light rod, and the slider above the
// pivot. Its rate is f ∝ √((M·D − m·x) / (M·D² + m·x² + I)) (M, D: the bob's mass and depth below
// the pivot; m, x: the slider's mass and height above it; I: the rod's moment of inertia). The
// slider's mass is found so that 20–300 BPM spans the rod, and the height for a tempo by bisection.

import { MAX_BPM, MIN_BPM } from '../../core/pulse.ts';
import { TEMPO_FROM, TEMPO_NAMES, tempoWord } from '../../core/tempoNames.ts';

export const VIEW_W = 320;
/** The drawing ends at the plinth: the metronome stands on the beat rail below it. */
export const VIEW_H = 334;
export const CX = VIEW_W / 2;

/** The case: a truncated pyramid on a moulded plinth. */
export const CASE_TOP = 22;
export const CASE_BOTTOM = 318;
export const CASE_TOP_HALF = 30;
export const CASE_BOTTOM_HALF = 76;
export const PLINTH_BOTTOM = VIEW_H;
/** The moulded cap on the case's top: a slab overhanging it, and a thinner step on that. */
export const CAP_TOP = 15.5;
export const CAP_STEP = 18.5;
export const CAP_OVERHANG = 2.6;

/** The recess in the front, and the ivory plate in it. */
export const RECESS_TOP = 48;
export const RECESS_BOTTOM = 292;
/** How far in from the case's edge the recess starts (measured across). */
export const RECESS_INSET = 6;

/** The pendulum: its pivot low in the recess, the rod's top held in the clip when stopped. */
export const PIVOT_Y = 278;
export const ROD_TOP = 30;
export const ROD_LENGTH = PIVOT_Y - ROD_TOP;
export const WEIGHT_H = 21;
export const WEIGHT_TOP_HALF = 9;
export const WEIGHT_BOTTOM_HALF = 11.5;
/** The weight's top edge (where the tempo is read) at the fastest and the slowest tempo. */
const TOP_FAST = 248;
const TOP_SLOW = 58;

/** Half the plate's width at height `y` (inside the recess's walls). */
export const PLATE_MARGIN = 1.8;
/** The engraved frame line, this far inside the plate's edge. */
export const FRAME_INSET = 1.2;
export function plateHalf(y: number): number {
  return caseHalf(y) - RECESS_INSET - PLATE_MARGIN;
}

/** Half the case's width at height `y`. */
export function caseHalf(y: number): number {
  return (
    CASE_TOP_HALF + ((CASE_BOTTOM_HALF - CASE_TOP_HALF) * (y - CASE_TOP)) / (CASE_BOTTOM - CASE_TOP)
  );
}

// The physics, in the drawing's units: the bob 28 below the pivot (it fits in the case under the
// recess), a rod of 2% of the bob's mass.
export const BOB_MASS = 1;
export const BOB_DEPTH = 28;
export const ROD_INERTIA = (0.02 * BOB_MASS * ROD_LENGTH ** 2) / 3;
/** The slider's centre above the pivot at the fastest and slowest tempo. */
const X_FAST = PIVOT_Y - TOP_FAST - WEIGHT_H / 2;
const X_SLOW = PIVOT_Y - TOP_SLOW - WEIGHT_H / 2;

function rate(x: number, sliderMass: number): number {
  const torque = BOB_MASS * BOB_DEPTH - sliderMass * x;
  const inertia = BOB_MASS * BOB_DEPTH ** 2 + sliderMass * x ** 2 + ROD_INERTIA;
  return Math.sqrt(Math.max(0, torque) / inertia);
}

/** The slider's mass that makes the rod's span 300 : 20. */
export const SLIDER_MASS = (() => {
  let low = 0;
  let high = (BOB_MASS * BOB_DEPTH) / X_SLOW;
  for (let i = 0; i < 100; i++) {
    const mass = (low + high) / 2;
    if (rate(X_FAST, mass) / rate(X_SLOW, mass) < MAX_BPM / MIN_BPM) low = mass;
    else high = mass;
  }
  return (low + high) / 2;
})();
const BPM_PER_RATE = MAX_BPM / rate(X_FAST, SLIDER_MASS);

/** The tempo the pendulum beats with the slider's centre `x` above the pivot. */
export function tempoAt(x: number): number {
  return BPM_PER_RATE * rate(x, SLIDER_MASS);
}

/** Where the weight's top edge sits for `bpm` (clamped to the scale): higher for slower. */
export function weightY(bpm: number): number {
  const target = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
  let fast = X_FAST;
  let slow = X_SLOW;
  for (let i = 0; i < 48; i++) {
    const x = (fast + slow) / 2;
    if (tempoAt(x) > target) fast = x;
    else slow = x;
  }
  return PIVOT_Y - (fast + slow) / 2 - WEIGHT_H / 2;
}

/**
 * The marks of the scale: Maelzel's series (40–208), carried down to 20 in steps of 2 and up to
 * 300 in the same widening steps: 8 to 240, then 12.
 */
export const SCALE_MARKS: readonly number[] = [
  ...range(20, 60, 2),
  ...range(60, 72, 3),
  ...range(72, 120, 4),
  ...range(120, 144, 6),
  ...range(144, 240, 8),
  ...range(240, 300, 12),
  300,
];

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let n = from; n < to; n += step) out.push(n);
  return out;
}

/** The marks that carry a number (left of the rod), far enough apart not to touch. */
export const SCALE_LABELS: readonly number[] = [
  20, 40, 50, 60, 72, 84, 96, 108, 120, 132, 144, 160, 176, 192, 208, 224, 240, 264, 288, 300,
];
/** The labels kept on a narrow screen. */
export const SCALE_LABELS_NARROW: readonly number[] = [20, 40, 60, 84, 120, 160, 208, 300];
export const LABEL_SIZE = 6.8;
/** On a phone (styles.css sets it): fewer numbers, larger. */
export const LABEL_SIZE_NARROW = 7.4;

/** The Italian marks engraved right of the rod, each at the middle of its range. */
export const TEMPO_BANDS = TEMPO_NAMES.map((name, i) => {
  const next = TEMPO_NAMES[i + 1];
  const top = weightY(TEMPO_FROM[name]);
  const bottom = weightY(next ? TEMPO_FROM[next] : MAX_BPM);
  return { name, word: tempoWord(name), top, bottom, y: (top + bottom) / 2 };
});
/**
 * The marks are set in capitals as large as LARGHETTO allows: nine letters where the plate is
 * still narrow. A capital is 0.67 of the size high.
 */
export const BAND_SIZE = 4.2;
export const CAP_HEIGHT = 0.67;
/**
 * Each word is set to this width a letter, the face's own advance for capitals with the tracking
 * in styles.css (text layout at such sizes varies with the scale, so the width is fixed).
 */
export const BAND_ADVANCE = 0.72 * BAND_SIZE;
/** Right of the rod: the ticks reach only left of it. */
export const BAND_X = CX + 2.8;
/** The number's right edge. */
export const LABEL_X = CX - 12.5;

/**
 * The swing either side of the centre, in degrees: the rod's top passes well beyond the case, as
 * on the real one, and stays inside the drawing.
 */
export const AMPLITUDE = 32;

/** The rod's shadow falls below and right of it (the light is upper left). */
const SHADOW_DX = 1.7;
const SHADOW_DY = 1.3;

/** `value` as a percentage of `of`: the layers share one box, so they line up at any size. */
export const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(4)}%`;
/** Where the rod turns, as the moving layers' transform-origin. */
export const PIVOT_ORIGIN = `50% ${pct(PIVOT_Y, VIEW_H)}`;
export const SHADOW_OFFSET = `translate(${pct(SHADOW_DX, VIEW_W)}, ${pct(SHADOW_DY, VIEW_H)})`;

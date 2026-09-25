// Drawing the beat, frame by frame: the pendulum's swing (released on the first beat, settling
// when stopped) and the beat dots. These write transforms, opacity and data attributes straight to
// the DOM (no React render).

import type { PulsePosition } from '../../core/pulse.ts';
import { AMPLITUDE, SHADOW_OFFSET } from './geometry.ts';

/** How long the accent's glint takes to cross the weight (ms). */
const GLINT_MS = 240;
/** A stopped pendulum is still again within this (ms)… */
export const SETTLE_MS = 700;
/** …its swing dying away this fast (the time constant, ms). */
const SETTLE_DECAY_MS = 130;
/** The last part of the settle eases what is left to rest. */
const SETTLE_FADE = 0.6;

type Beat = Pick<PulsePosition, 'beat' | 'phase'>;

/** The pendulum's angle: through the centre on every beat, still at the ends. */
export function swingAngle(position: Beat): number {
  return AMPLITUDE * Math.sin(Math.PI * (position.beat + position.phase));
}

/**
 * The angle, and how fast it changes (degrees per ms), from Start on: released from the clip on
 * the first beat, from rest at the centre, it reaches the full swing at the first end.
 */
export function pendulumMotion(position: Beat & Pick<PulsePosition, 'from' | 'to'>): {
  angle: number;
  velocity: number;
} {
  const u = position.beat + position.phase;
  const period = position.to - position.from;
  if (u < 0.5) {
    const s = Math.sin(Math.PI * u);
    return {
      angle: AMPLITUDE * s * s,
      velocity: (AMPLITUDE * Math.PI * Math.sin(2 * Math.PI * u)) / period,
    };
  }
  return {
    angle: swingAngle(position),
    velocity: (AMPLITUDE * Math.PI * Math.cos(Math.PI * u)) / period,
  };
}

export interface Swing {
  angle: number;
  /** Degrees per ms. */
  velocity: number;
  /** The beat's length (ms): half a swing there and back. */
  period: number;
}

/**
 * The angle `t` ms after a stop that found the pendulum at `swing`: it swings on at its own rate,
 * dying away, and is at rest after SETTLE_MS. Never wider than the swing it had.
 */
export function settleAngle(swing: Swing, t: number): number {
  if (t >= SETTLE_MS) return 0;
  const w = Math.PI / swing.period;
  const k = 1 / SETTLE_DECAY_MS;
  const angle =
    Math.exp(-k * t) *
    (swing.angle * Math.cos(w * t) + ((swing.velocity + k * swing.angle) / w) * Math.sin(w * t));
  const fade = Math.min(1, Math.max(0, (t / SETTLE_MS - SETTLE_FADE) / (1 - SETTLE_FADE)));
  const clamp = Math.min(AMPLITUDE, Math.max(-AMPLITUDE, angle));
  return clamp * (1 - fade * fade * (3 - 2 * fade));
}

interface Layers {
  root: HTMLElement;
  rod: SVGSVGElement;
  shadow: SVGSVGElement;
  glint: SVGElement;
}

function layersOf(root: HTMLElement): Layers | null {
  const rod = root.querySelector<SVGSVGElement>('.pendulum-rod');
  const shadow = root.querySelector<SVGSVGElement>('.pendulum-shadow');
  const glint = root.querySelector<SVGElement>('.pendulum-glint');
  return rod && shadow && glint ? { root, rod, shadow, glint } : null;
}

/**
 * Moves one pendulum to `position` on each frame (null: stopped, or not yet on the first beat).
 * `still`: at rest in its clip, whatever happens (reduced motion). Writes transforms and opacity
 * only, and only when they change.
 */
export function createPendulumPainter() {
  let layers: Layers | null = null;
  let last: (Swing & { at: number }) | null = null;
  let settling: (Swing & { at: number }) | null = null;
  let shown = '';
  let glint = '';

  function write(angle: number) {
    const rotate = `rotate(${angle.toFixed(3)}deg)`;
    if (!layers || rotate === shown) return;
    shown = rotate;
    layers.rod.style.transform = rotate;
    layers.shadow.style.transform = `${SHADOW_OFFSET} ${rotate}`;
  }

  function writeGlint(value: string) {
    if (!layers || value === glint) return;
    glint = value;
    layers.glint.style.transform = value ? `translateX(${value}px)` : '';
    layers.glint.style.opacity = value ? '1' : '0';
  }

  return function paint(
    root: HTMLElement,
    position: PulsePosition | null,
    now: number,
    still: boolean,
  ): void {
    if (layers?.root !== root) {
      layers = layersOf(root);
      shown = glint = '';
    }
    if (!layers) return;
    if (still) {
      last = settling = null;
      write(0);
      writeGlint('');
      setSilent(root, false);
      return;
    }
    if (!position) {
      if (last) settling = last;
      last = null;
      const t = settling ? now - settling.at : Infinity;
      if (t >= SETTLE_MS) settling = null;
      write(settling ? settleAngle(settling, t) : 0);
      writeGlint('');
      setSilent(root, false);
      return;
    }
    const motion = pendulumMotion(position);
    const period = position.to - position.from;
    last = { ...motion, period, at: now };
    let angle = motion.angle;
    // Started again while still settling: what is left of the old swing dies away on top.
    if (settling) {
      const t = now - settling.at;
      if (t >= SETTLE_MS) settling = null;
      else angle = Math.min(AMPLITUDE, Math.max(-AMPLITUDE, angle + settleAngle(settling, t)));
    }
    write(angle);
    const since = position.phase * period;
    const accent = position.accent === 'accent' && !position.silent;
    writeGlint(accent && since < GLINT_MS ? ((since / GLINT_MS) * 36).toFixed(2) : '');
    setSilent(root, position.silent);
  };
}

function setSilent(root: HTMLElement, silent: boolean) {
  if (silent === 'silent' in root.dataset) return;
  if (silent) root.dataset.silent = '';
  else delete root.dataset.silent;
}

/** Marks the beat and the subdivision heard now; touches the DOM only when they change. */
export function paintDots(root: HTMLElement, position: PulsePosition | null): void {
  const beat = position ? String(position.inBar) : '';
  const sub = position ? String(Math.floor(position.phase * position.subdivision)) : '';
  if (root.dataset.now === beat && root.dataset.nowSub === sub) return;
  root.dataset.now = beat;
  root.dataset.nowSub = sub;
  for (const el of root.querySelectorAll('[data-now]')) el.removeAttribute('data-now');
  if (!position) {
    delete root.dataset.silent;
    return;
  }
  root.querySelector(`.beat-dot[data-beat="${beat}"]`)?.setAttribute('data-now', '');
  if (sub !== '0')
    root
      .querySelector(`.beat-sub[data-beat="${beat}"][data-sub="${sub}"]`)
      ?.setAttribute('data-now', '');
  if (position.silent) root.dataset.silent = '';
  else delete root.dataset.silent;
}

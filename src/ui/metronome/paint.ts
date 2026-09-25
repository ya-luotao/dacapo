// Drawing the beat, frame by frame: the Maelzel pendulum's geometry and swing, and the beat dots.
// These write transforms, opacity and data attributes straight to the DOM (no React render).

import { MAX_BPM, MIN_BPM, type PulsePosition } from '../../core/pulse.ts';

export const PIVOT_X = 120;
export const PIVOT_Y = 288;
export const ROD_TOP = 30;
/** Where the weight's top edge sits at the slowest and the fastest tempo. */
const Y_SLOW = 58;
const Y_FAST = 236;
/** The swing either side of the centre, in degrees. */
export const AMPLITUDE = 24;
/** How quickly the accent's flash fades (ms). */
const FLASH_MS = 150;

/** Higher for slower, spaced like a real scale (evenly by the ratio of tempos). */
export function weightY(bpm: number): number {
  const f = Math.log(bpm / MIN_BPM) / Math.log(MAX_BPM / MIN_BPM);
  return Y_SLOW + Math.min(1, Math.max(0, f)) * (Y_FAST - Y_SLOW);
}

/** The pendulum's angle: through the centre on every beat, still at the ends. */
export function swingAngle(position: Pick<PulsePosition, 'beat' | 'phase'>): number {
  return AMPLITUDE * Math.sin(Math.PI * (position.beat + position.phase));
}

/** Tempos marked on the scale; the labelled ones alternate sides. */
export const SCALE_MARKS = [
  20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 66, 72, 80, 88, 96, 104, 112, 120, 132, 144, 160, 176,
  192, 208, 232, 256, 280, 300,
];
const LABELS = [20, 32, 40, 52, 60, 72, 88, 104, 120, 144, 176, 208, 256, 300];
/** Which side of the rod each labelled mark's number goes: −1 left, 1 right. */
export const LABEL_SIDE = new Map(LABELS.map((mark, i) => [mark, i % 2 ? 1 : -1]));

/** Moves the drawing to `position` (null: back to rest). Writes transforms and opacity only. */
export function paintPendulum(
  svg: SVGSVGElement,
  position: PulsePosition | null,
  still: boolean,
): void {
  const rod = svg.querySelector<SVGGElement>('.pendulum-rod');
  const flash = svg.querySelector<SVGPathElement>('.pendulum-flash');
  if (!rod || !flash) return;
  if (!position || still) {
    rod.style.transition = '';
    rod.style.transform = 'rotate(0deg)';
    flash.style.opacity = '0';
    if (svg.dataset.silent) delete svg.dataset.silent;
    return;
  }
  rod.style.transition = 'none';
  rod.style.transform = `rotate(${swingAngle(position).toFixed(3)}deg)`;
  const since = position.phase * (position.to - position.from);
  const accent = position.accent === 'accent' && !position.silent;
  flash.style.opacity = accent ? Math.exp(-since / FLASH_MS).toFixed(3) : '0';
  const silent = position.silent ? '1' : undefined;
  if (svg.dataset.silent !== silent) {
    if (silent) svg.dataset.silent = silent;
    else delete svg.dataset.silent;
  }
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

// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BarCell } from '../../core/barHeatmap.ts';
import type { Measure } from '../../core/score.ts';
import { I18nProvider, loadLocale } from '../../i18n/index.ts';
import type { LoadedLocale } from '../../i18n/locale.ts';
import type { BarBoxes } from '../notation/ScoreView.tsx';
import { useBarFormat } from './barFormat.ts';
import { usePieceFormat } from './format.ts';
import { ScoreBarPicker, type LoopRange } from './ScoreBarPicker.tsx';
import { BarTargets } from './WeakBars.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MEASURES: readonly Measure[] = [0, 1, 2, 3, 4].map((index) => ({
  index,
  number: String(index + 1),
  start: index * 16,
  duration: 16,
  beats: 4,
  beatType: 4,
  repeat: { forward: false, backwardTimes: null, ending: [] },
  jumps: [],
}));

const BOXES: BarBoxes = new Map([
  [0, { left: 10, top: 20, width: 80, height: 60 }],
  [1, { left: 90, top: 20, width: 80, height: 60 }],
  [2, { left: 170, top: 20, width: 80, height: 60 }],
  [3, { left: 250, top: 20, width: 80, height: 60 }],
  [4, { left: 10, top: 120, width: 80, height: 60 }],
]);

const CELLS: readonly BarCell[] = MEASURES.map((m) => ({
  measure: m.index,
  runs: 3,
  steps: 12,
  passes: 1,
  medianMs: 900,
  wrong: 1,
  wrongPerStep: 0.1,
  missed: 0,
  bucket: 2,
  steady: false,
}));

let localeData: LoadedLocale;
let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  localeData = await loadLocale('en');
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderWithI18n(node: ReactNode) {
  act(() => {
    root.render(
      <I18nProvider initial={localeData} chosen="en">
        {node}
      </I18nProvider>,
    );
  });
}

function PickerHarness({
  startBar,
  loop,
  disabled = false,
  onStartBar,
  onLoopRange,
  onClearLoop,
}: {
  startBar: number;
  loop: LoopRange | null;
  disabled?: boolean;
  onStartBar: (measure: number) => void;
  onLoopRange: (from: number, to: number) => void;
  onClearLoop: () => void;
}) {
  const format = usePieceFormat(MEASURES);
  return (
    <div className="score-frame">
      <div className="score-page">
        <ScoreBarPicker
          boxes={BOXES}
          format={format}
          startBar={startBar}
          loop={loop}
          disabled={disabled}
          onStartBar={onStartBar}
          onLoopRange={onLoopRange}
          onClearLoop={onClearLoop}
        />
      </div>
    </div>
  );
}

function WeakBarsHarness({
  onStartBar,
  onLoopBar,
}: {
  onStartBar: (measure: number) => void;
  onLoopBar: (measure: number) => void;
}) {
  const format = usePieceFormat(MEASURES);
  const barFormat = useBarFormat(format, 'hesitation');
  return (
    <div className="score-frame">
      <div className="score-page">
        <BarTargets
          cells={CELLS}
          boxes={BOXES}
          format={barFormat}
          onStartBar={onStartBar}
          onLoopBar={onLoopBar}
        />
      </div>
    </div>
  );
}

function clickEl(el: Element, init?: MouseEventInit) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  });
}

describe('ScoreBarPicker', () => {
  it('calls onStartBar on plain click and keeps hit targets hidden from assistive tech', () => {
    const onStartBar = vi.fn();
    const onLoopRange = vi.fn();
    const onClearLoop = vi.fn();

    renderWithI18n(
      <PickerHarness
        startBar={0}
        loop={null}
        onStartBar={onStartBar}
        onLoopRange={onLoopRange}
        onClearLoop={onClearLoop}
      />,
    );

    const hits = host.querySelectorAll('.score-bar-hit');
    expect(hits).toHaveLength(5);
    for (const hit of hits) expect(hit.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('button')).toHaveLength(0);

    clickEl(hits[2]!);
    expect(onStartBar).toHaveBeenCalledTimes(1);
    expect(onStartBar).toHaveBeenCalledWith(2);
    expect(onLoopRange).not.toHaveBeenCalled();
  });

  it('computes [min, max] loop ranges on Shift-click using startBar or loop.from as anchor', () => {
    const onStartBar = vi.fn();
    const onLoopRange = vi.fn();
    const onClearLoop = vi.fn();

    renderWithI18n(
      <PickerHarness
        startBar={2}
        loop={null}
        onStartBar={onStartBar}
        onLoopRange={onLoopRange}
        onClearLoop={onClearLoop}
      />,
    );

    const hits = host.querySelectorAll('.score-bar-hit');
    clickEl(hits[4]!, { shiftKey: true });
    expect(onLoopRange).toHaveBeenLastCalledWith(2, 4);

    clickEl(hits[0]!, { shiftKey: true });
    expect(onLoopRange).toHaveBeenLastCalledWith(0, 2);
    expect(onStartBar).not.toHaveBeenCalled();

    renderWithI18n(
      <PickerHarness
        startBar={3}
        loop={{ from: 1, to: 3 }}
        onStartBar={onStartBar}
        onLoopRange={onLoopRange}
        onClearLoop={onClearLoop}
      />,
    );

    const nextHits = host.querySelectorAll('.score-bar-hit');
    clickEl(nextHits[0]!, { shiftKey: true });
    expect(onLoopRange).toHaveBeenLastCalledWith(0, 1);

    clickEl(nextHits[4]!, { shiftKey: true });
    expect(onLoopRange).toHaveBeenLastCalledWith(1, 4);
  });

  it('renders loop bands across systems and calls onClearLoop when clear button is clicked', () => {
    const onStartBar = vi.fn();
    const onLoopRange = vi.fn();
    const onClearLoop = vi.fn();

    renderWithI18n(
      <PickerHarness
        startBar={1}
        loop={{ from: 1, to: 4 }}
        onStartBar={onStartBar}
        onLoopRange={onLoopRange}
        onClearLoop={onClearLoop}
      />,
    );

    // Bars 1..3 are on top=20, bar 4 wraps onto top=120 -> 2 loop bands.
    expect(host.querySelectorAll('.score-bar-loop-band')).toHaveLength(2);
    const clear = host.querySelector<HTMLButtonElement>('.score-bar-clear');
    expect(clear).not.toBeNull();
    expect(clear?.title).toBe('Clear loop (bars 2–5)');

    clickEl(clear!);
    expect(onClearLoop).toHaveBeenCalledTimes(1);
  });

  it('ignores pointer bar clicks and disables clearing when disabled', () => {
    const onStartBar = vi.fn();
    const onLoopRange = vi.fn();
    const onClearLoop = vi.fn();

    renderWithI18n(
      <PickerHarness
        startBar={0}
        loop={{ from: 0, to: 1 }}
        disabled
        onStartBar={onStartBar}
        onLoopRange={onLoopRange}
        onClearLoop={onClearLoop}
      />,
    );

    const hits = host.querySelectorAll('.score-bar-hit');
    clickEl(hits[1]!);
    clickEl(hits[2]!, { shiftKey: true });
    const clear = host.querySelector<HTMLButtonElement>('.score-bar-clear');
    expect(clear?.disabled).toBe(true);
    expect(onStartBar).not.toHaveBeenCalled();
    expect(onLoopRange).not.toHaveBeenCalled();
  });
});

describe('BarTargets dialog actions', () => {
  it('opens bar details dialog on click, calls onStartBar / onLoopBar, and closes', () => {
    const onStartBar = vi.fn();
    const onLoopBar = vi.fn();

    renderWithI18n(<WeakBarsHarness onStartBar={onStartBar} onLoopBar={onLoopBar} />);

    const targets = host.querySelectorAll('.bar-target');
    expect(targets).toHaveLength(5);

    clickEl(targets[1]!);
    let dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const findButton = (label: string) =>
      [...dialog!.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

    const startBtn = findButton('Start from bar 2');
    const loopBtn = findButton('Loop bar 2');
    expect(startBtn).toBeDefined();
    expect(loopBtn).toBeDefined();

    clickEl(startBtn!);
    expect(onStartBar).toHaveBeenCalledWith(1);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    clickEl(targets[1]!);
    dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    clickEl(findButton('Loop bar 2')!);
    expect(onLoopBar).toHaveBeenCalledWith(1);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes bar details dialog on Escape and restores focus to the bar button', () => {
    const onStartBar = vi.fn();
    const onLoopBar = vi.fn();

    renderWithI18n(<WeakBarsHarness onStartBar={onStartBar} onLoopBar={onLoopBar} />);

    const targets = host.querySelectorAll('.bar-target');
    const barButton = targets[2] as HTMLButtonElement;
    clickEl(barButton);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(barButton);
  });
});

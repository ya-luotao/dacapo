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
import { BarTargets, LoopBand, ScoreBarTargets } from './WeakBars.tsx';

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

function ScoreTargetsHarness({
  loop,
  onBarClick,
}: {
  loop: { from: number; to: number } | null;
  onBarClick: (measure: number, shift: boolean) => void;
}) {
  const format = usePieceFormat(MEASURES);
  return (
    <div className="score-frame">
      <div className="score-page">
        {loop && <LoopBand loop={loop} boxes={BOXES} />}
        <ScoreBarTargets
          measures={MEASURES.map((m) => m.index)}
          boxes={BOXES}
          label={(m) => `Start from bar ${format.barNumber(m)}`}
          hint="Click a bar to start there; Shift-click to loop"
          onBarClick={onBarClick}
        />
      </div>
    </div>
  );
}

function WeakBarsHarness({
  onBarClick,
  onStartBar,
  onLoopBar,
}: {
  onBarClick?: (measure: number, shift: boolean) => void;
  onStartBar?: (measure: number) => void;
  onLoopBar?: (measure: number) => void;
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
          onBarClick={onBarClick}
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

describe('ScoreBarTargets and LoopBand', () => {
  it('renders loop bands across bars and passes bar index and shift flag on click', () => {
    const onBarClick = vi.fn();

    renderWithI18n(<ScoreTargetsHarness loop={{ from: 1, to: 3 }} onBarClick={onBarClick} />);

    expect(host.querySelectorAll('.bar-loop')).toHaveLength(3);
    const jumps = host.querySelectorAll('.bar-jump');
    expect(jumps).toHaveLength(5);

    clickEl(jumps[2]!);
    expect(onBarClick).toHaveBeenLastCalledWith(2, false);

    clickEl(jumps[4]!, { shiftKey: true });
    expect(onBarClick).toHaveBeenLastCalledWith(4, true);
  });
});

describe('BarTargets dialog and Shift-click actions', () => {
  it('opens bar details dialog on plain click, calls onStartBar / onLoopBar, and loops directly on Shift-click', () => {
    const onBarClick = vi.fn();
    const onStartBar = vi.fn();
    const onLoopBar = vi.fn();

    renderWithI18n(
      <WeakBarsHarness onBarClick={onBarClick} onStartBar={onStartBar} onLoopBar={onLoopBar} />,
    );

    const targets = host.querySelectorAll('.bar-target');
    expect(targets).toHaveLength(5);

    clickEl(targets[3]!, { shiftKey: true });
    expect(onBarClick).toHaveBeenCalledWith(3, true);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

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

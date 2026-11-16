// @vitest-environment jsdom
import { act, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { improvPlan } from '../core/improv.ts';
import { I18nProvider, loadLocale } from '../i18n/index.ts';
import type { LoadedLocale } from '../i18n/locale.ts';
import type { InputSystem } from '../input/index.ts';
import { BUILTIN_OUTPUT } from '../output/output.ts';
import { createScheduler } from '../output/scheduler.ts';
import { FakePort } from '../output/testing.ts';
import { ChordsSession } from './harmony/ChordsSession.tsx';
import { createHarmonyController } from './harmony/controller.ts';
import { ImprovSession } from './harmony/ImprovSession.tsx';
import type { ImprovController, ImprovView } from './harmony/improvController.ts';
import { EarSession } from './ear/EarSession.tsx';
import { RhythmEarSession } from './ear/RhythmEarSession.tsx';
import { createEarController } from './ear/controller.ts';
import { createRhythmEarController } from './ear/rhythmController.ts';
import { InputContext } from './input/context.ts';
import { MetronomeContext, type MetronomeHandle } from './metronome/context.ts';
import { writeLatency } from './pieces/rhythmPrefs.ts';
import type { RhythmPlayer, RhythmSnapshot } from './pieces/useRhythmPlayer.ts';
import { PracticeContext } from './practice/context.ts';
import { createPracticeStore } from './practice/store.ts';
import { ReadSession } from './read/ReadSession.tsx';
import { RhythmSession } from './read/RhythmSession.tsx';
import { SightSession } from './read/SightSession.tsx';
import { TheorySession } from './read/TheorySession.tsx';
import { createReadController } from './read/controller.ts';
import { createRhythmController } from './read/rhythmController.ts';
import { DEFAULT_RHYTHM_PREFS } from './read/rhythmPrefs.ts';
import { createSightController } from './read/sightController.ts';
import { DEFAULT_SIGHT_PREFS } from './read/sightPrefs.ts';
import { createTheoryController } from './read/theoryController.ts';

vi.mock('./staff/font.ts', () => ({
  MUSIC_FONT: 'Bravura',
  loadMusicFont: () => undefined,
  subscribeFont: () => () => undefined,
  getFontState: () => 'ready',
}));

vi.mock('./notation/ScoreView.tsx', async () => {
  const { useEffect } = await import('react');
  return {
    ScoreView({ onStatus }: { onStatus?: (status: { state: 'ready'; unplaced: number }) => void }) {
      useEffect(() => {
        onStatus?.({ state: 'ready', unplaced: 0 });
      }, [onStatus]);
      return <div data-testid="mock-score-view" />;
    },
  };
});

const rhythmPlayerControl = {
  stopSpy: vi.fn(),
  startSpy: vi.fn(),
  snapshot: { state: 'stopped', step: null, count: null } as RhythmSnapshot,
  listeners: new Set<() => void>(),
  setSnapshot(next: RhythmSnapshot) {
    this.snapshot = next;
    for (const l of [...this.listeners]) l();
  },
};

vi.mock('./pieces/useRhythmPlayer.ts', () => ({
  sharedClickTrack: () => null,
  useRhythmPlayer: () => {
    const snapshot = useSyncExternalStore(
      (listener) => {
        rhythmPlayerControl.listeners.add(listener);
        return () => rhythmPlayerControl.listeners.delete(listener);
      },
      () => rhythmPlayerControl.snapshot,
    );
    const player = {
      start: () => {
        rhythmPlayerControl.startSpy();
        rhythmPlayerControl.setSnapshot({ state: 'playing', step: 0, count: null });
        return 1000;
      },
      press: () => 'miss',
      stop: () => {
        rhythmPlayerControl.stopSpy();
        rhythmPlayerControl.setSnapshot({ state: 'stopped', step: null, count: null });
      },
      subscribe: (listener: () => void) => {
        rhythmPlayerControl.listeners.add(listener);
        return () => rhythmPlayerControl.listeners.delete(listener);
      },
      getSnapshot: () => rhythmPlayerControl.snapshot,
    } as unknown as RhythmPlayer;

    return { player, snapshot };
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let locale: LoadedLocale;
let host: HTMLDivElement;
let root: Root;

function createMockInput(): InputSystem {
  const port = new FakePort();
  const scheduler = createScheduler();
  scheduler.setPort(port);

  const hubState = {
    held: new Map<number, number>(),
    sustained: new Set<number>(),
    sustain: false,
    lastChord: [] as number[],
  };
  const outputState = {
    ports: [BUILTIN_OUTPUT],
    choice: { kind: 'auto' as const },
    selected: BUILTIN_OUTPUT,
  };

  const midiStatus = { state: 'no-device' as const };
  const monitorSettings = { mode: 'all' as const, level: 1 };

  return {
    hub: {
      onEvent: () => () => undefined,
      add: () => () => undefined,
      subscribe: () => () => undefined,
      getState: () => hubState,
    },
    midi: {
      subscribeStatus: () => () => undefined,
      getStatus: () => midiStatus,
      retry: vi.fn(),
    },
    output: {
      scheduler,
      onInterrupt: () => () => undefined,
      subscribe: () => () => undefined,
      getState: () => outputState,
    },
    samples: {
      subscribe: () => () => undefined,
      getStatus: () => 'ready' as const,
    },
    monitor: {
      tap: (source: unknown) => source,
      subscribe: () => () => undefined,
      getSettings: () => monitorSettings,
    },
    keyboard: {
      subscribeOctave: () => () => undefined,
      getOctave: () => 4,
      suspend: () => () => undefined,
    },
    pointer: {
      down: () => undefined,
      up: () => undefined,
      cancel: () => undefined,
      start: () => () => undefined,
    } as unknown as InputSystem['pointer'],
  } as unknown as InputSystem;
}

function createMockMetronomeHandle(): MetronomeHandle {
  const snapshot = {
    running: false,
    bpm: 90,
    beat: 0,
    bar: 0,
    meter: { numerator: 4, denominator: 4 },
  };
  return {
    metronome: {
      block: () => () => undefined,
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      start: () => undefined,
      stop: () => undefined,
      setBpm: () => undefined,
      setMeter: () => undefined,
      setVolume: () => undefined,
    },
    offers: {
      subscribe: () => () => undefined,
      get: () => null,
      set: () => undefined,
    },
  } as unknown as MetronomeHandle;
}

function renderWithProviders(node: ReactNode) {
  const input = createMockInput();
  const practice = createPracticeStore();
  const metronome = createMockMetronomeHandle();
  act(() => {
    root.render(
      <I18nProvider initial={locale} chosen="en">
        <PracticeContext.Provider value={practice}>
          <InputContext.Provider value={input}>
            <MetronomeContext.Provider value={metronome}>{node}</MetronomeContext.Provider>
          </InputContext.Provider>
        </PracticeContext.Provider>
      </I18nProvider>,
    );
  });
}

function pressEscape(target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
  });
}

function buttonByText(label: string): HTMLButtonElement {
  const buttons = [...host.querySelectorAll('button')];
  const match = buttons.find((b) => b.textContent?.trim() === label);
  if (!match) throw new Error(`Button "${label}" not found`);
  return match;
}

beforeAll(async () => {
  if (!('scrollTo' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollTo', {
      value: () => undefined,
      configurable: true,
    });
  }
  HTMLCanvasElement.prototype.getContext = (() => ({
    measureText: () => ({ width: 8 }),
  })) as unknown as HTMLCanvasElement['getContext'];
  locale = await loadLocale('en');
});

beforeEach(() => {
  localStorage.clear();
  writeLatency({ offset: 0, at: 1000 });
  rhythmPlayerControl.stopSpy.mockClear();
  rhythmPlayerControl.startSpy.mockClear();
  rhythmPlayerControl.snapshot = { state: 'stopped', step: null, count: null };
  rhythmPlayerControl.listeners.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('Universal session Escape ergonomics', () => {
  it('wires Escape and guards in ReadSession', () => {
    const practice = createPracticeStore();
    const readCtrl = createReadController({ practice });
    readCtrl.start('L1', 5, false);
    const readStop = vi.spyOn(readCtrl, 'stop');
    renderWithProviders(
      <ReadSession session={readCtrl.getState()!} controller={readCtrl} onHint={vi.fn()} />,
    );
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    const textInput = document.createElement('input');
    textInput.type = 'text';
    host.append(textInput);
    pressEscape(textInput);
    expect(readStop).not.toHaveBeenCalled();
    textInput.remove();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    host.append(dialog);
    pressEscape();
    expect(readStop).not.toHaveBeenCalled();
    dialog.remove();
    pressEscape();
    expect(readStop).toHaveBeenCalledTimes(1);
  });

  it('wires Escape in TheorySession', () => {
    const practice = createPracticeStore();
    const theoryCtrl = createTheoryController({ practice });
    theoryCtrl.start({ level: 'RI2', by: 'name', length: 5, hint: false });
    const theoryStop = vi.spyOn(theoryCtrl, 'stop');
    renderWithProviders(
      <TheorySession session={theoryCtrl.getState()!} controller={theoryCtrl} onHint={vi.fn()} />,
    );
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    pressEscape();
    expect(theoryStop).toHaveBeenCalledTimes(1);
  });

  it('wires Escape in EarSession', () => {
    const practice = createPracticeStore();
    const earCtrl = createEarController({
      practice,
      sound: { play: vi.fn(), silence: vi.fn() },
    });
    earCtrl.start({
      level: 'I1',
      by: 'name',
      directions: ['up'],
      chordStyle: 'broken',
      length: 5,
    });
    const earStop = vi.spyOn(earCtrl, 'stop');
    renderWithProviders(<EarSession view={earCtrl.getState()!} controller={earCtrl} />);
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    pressEscape();
    expect(earStop).toHaveBeenCalledTimes(1);
  });

  it('wires Escape in ChordsSession', () => {
    const practice = createPracticeStore();
    const chordsCtrl = createHarmonyController({ practice });
    chordsCtrl.start({ level: 'H1', length: 5, hint: false });
    const chordsStop = vi.spyOn(chordsCtrl, 'stop');
    renderWithProviders(
      <ChordsSession session={chordsCtrl.getState()!} controller={chordsCtrl} onHint={vi.fn()} />,
    );
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    pressEscape();
    expect(chordsStop).toHaveBeenCalledTimes(1);
  });

  it('wires Escape in ImprovSession', () => {
    const plan = improvPlan({
      backing: 'blues',
      key: 'C',
      scale: 'blues',
      pattern: 'shuffle',
      feel: 'straight',
      bpm: 120,
      call: false,
      seed: 1,
    });
    const improvView: ImprovView = {
      phase: 'running',
      plan,
      click: false,
      heard: new Map(),
      session: null,
      playback: null,
      loading: null,
      missing: null,
    };
    const improvStop = vi.fn();
    const improvCtrl = {
      stop: improvStop,
      setClick: vi.fn(),
      subscribeBeat: () => () => undefined,
      position: () => 0,
    } as unknown as ImprovController;
    renderWithProviders(<ImprovSession view={improvView} controller={improvCtrl} />);
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    pressEscape();
    expect(improvStop).toHaveBeenCalledTimes(1);
  });

  it('guards RhythmEarSession Escape when calibration sheet is open', () => {
    const practice = createPracticeStore();
    const ctrl = createRhythmEarController({
      practice,
      player: { start: () => 0, press: vi.fn(), stop: vi.fn() },
      latency: () => 0,
      clickVolume: () => 50,
    });
    ctrl.start({ level: 'R1', by: 'play', bpm: 80, length: 5 });
    const stopSpy = vi.spyOn(ctrl, 'stop');

    renderWithProviders(
      <RhythmEarSession view={{ ...ctrl.getState()!, sound: null }} controller={ctrl} />,
    );
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    expect(buttonByText('Calibrate').disabled).toBe(false);

    // Open calibration sheet -> calibrationOpen becomes true.
    act(() => {
      buttonByText('Calibrate').click();
    });
    pressEscape();
    expect(stopSpy).not.toHaveBeenCalled();

    // Close calibration -> Escape now stops session.
    act(() => {
      buttonByText('Close').click();
    });
    pressEscape();
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('uses two-level Escape in RhythmSession and guards against open calibration sheet', () => {
    const practice = createPracticeStore();
    const ctrl = createRhythmController({ practice });
    ctrl.start({ level: 'R1', bpm: 80, length: 5 });
    const sessionStop = vi.spyOn(ctrl, 'stop');

    renderWithProviders(
      <RhythmSession
        session={ctrl.getState()!}
        controller={ctrl}
        prefs={DEFAULT_RHYTHM_PREFS}
        onPrefs={vi.fn()}
      />,
    );

    // Calibration sheet open blocks both run and session Escape.
    act(() => {
      buttonByText('Calibrate').click();
    });
    pressEscape();
    expect(rhythmPlayerControl.stopSpy).not.toHaveBeenCalled();
    expect(sessionStop).not.toHaveBeenCalled();

    act(() => {
      buttonByText('Close').click();
    });

    // Not running -> Stop button carries Escape shortcut.
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');

    // Start run -> active run Stop button carries Escape; first Escape stops ONLY the run.
    act(() => {
      buttonByText('Start').click();
    });
    expect(rhythmPlayerControl.startSpy).toHaveBeenCalledTimes(1);
    const runStopBtn = buttonByText('Stop');
    expect(runStopBtn.getAttribute('aria-keyshortcuts')).toBe('Escape');

    pressEscape();
    expect(rhythmPlayerControl.stopSpy).toHaveBeenCalledTimes(1);
    expect(sessionStop).not.toHaveBeenCalled();

    // Second Escape when stopped exits the session.
    pressEscape();
    expect(sessionStop).toHaveBeenCalledTimes(1);
  });

  it('uses two-level Escape in SightSession (wait mode, time mode, and calibration guard)', () => {
    const practice = createPracticeStore();
    const ctrl = createSightController({ practice });
    ctrl.start({ level: 'F1', length: 5 });
    const sessionStop = vi.spyOn(ctrl, 'stop');

    // First verify time-mode calibration guard + two-level Escape.
    renderWithProviders(
      <SightSession
        key="time"
        session={ctrl.getState()!}
        controller={ctrl}
        prefs={{ ...DEFAULT_SIGHT_PREFS, play: 'time' }}
        bpm={80}
      />,
    );

    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');

    act(() => {
      buttonByText('Calibrate').click();
    });
    pressEscape();
    expect(rhythmPlayerControl.stopSpy).not.toHaveBeenCalled();
    expect(sessionStop).not.toHaveBeenCalled();
    act(() => {
      buttonByText('Close').click();
    });

    // Start time-mode run -> first Escape calls player.stop(), does NOT end session.
    act(() => {
      buttonByText('Start now').click();
    });
    expect(rhythmPlayerControl.startSpy).toHaveBeenCalledTimes(1);
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');
    pressEscape();
    expect(rhythmPlayerControl.stopSpy).toHaveBeenCalledTimes(1);
    expect(sessionStop).not.toHaveBeenCalled();

    // Verify wait-mode two-level Escape as well.
    renderWithProviders(
      <SightSession
        key="wait"
        session={ctrl.getState()!}
        controller={ctrl}
        prefs={{ ...DEFAULT_SIGHT_PREFS, play: 'wait' }}
        bpm={80}
      />,
    );

    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');

    act(() => {
      buttonByText('Start now').click();
    });
    expect(buttonByText('Stop').getAttribute('aria-keyshortcuts')).toBe('Escape');

    // First Escape stops the wait-mode run, keeping the session open.
    pressEscape();
    expect(sessionStop).not.toHaveBeenCalled();
    expect(buttonByText('Start')).toBeTruthy();

    // Second Escape stops the session.
    pressEscape();
    expect(sessionStop).toHaveBeenCalledTimes(1);
  });
});

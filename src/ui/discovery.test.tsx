// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { HarmonyLevelId } from '../core/chordSymbols.ts';
import type { EarLevelId } from '../core/earItems.ts';
import { earLevelProgress, type EarLevelProgress } from '../core/earSession.ts';
import {
  harmonyLevelProgress,
  type ChordSymbolAnswer,
  type HarmonyLevelProgress,
} from '../core/harmonySession.ts';
import { FULL_KEYS } from '../core/instrument.ts';
import { LEVEL_IDS, type LevelId } from '../core/levels.ts';
import type { PieceSessionRecord, ReadSessionRecord, SessionRecord } from '../core/log.ts';
import { levelProgress, type LevelProgress } from '../core/mastery.ts';
import { progressionPieceId } from '../core/progressions.ts';
import {
  rhythmEarLevelProgress,
  RHYTHM_EAR_LEVEL_IDS,
  type RhythmEarLevelId,
  type RhythmEarLevelProgress,
} from '../core/rhythmEar.ts';
import { recoverSummary, type Attempt } from '../core/session.ts';
import { dayKey } from '../core/streak.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import type { InputSystem } from '../input/index.ts';
import { BUILTIN_OUTPUT, type OutputState } from '../output/output.ts';
import { I18nProvider, loadLocale } from '../i18n/index.ts';
import type { LoadedLocale } from '../i18n/locale.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import {
  sampleAttempt,
  sampleEarSession,
  sampleHarmonySession,
  samplePiece,
  sampleRhythmEarSession,
  sampleRhythmSession,
  sampleRun,
  sampleScaleSession,
  sampleSightSession,
  sampleTheorySession,
  sampleTuneSession,
} from '../storage/fixtures.ts';
import { createMemoryRepository, type StoredData } from '../storage/repository.ts';
import { EarSetup } from './ear/EarSetup.tsx';
import { DEFAULT_EAR_PREFS, EAR_PREFS_KEY, writeEarPrefs } from './ear/prefs.ts';
import { ChordsSetup } from './harmony/ChordsSetup.tsx';
import { HarmonyPage } from './harmony/HarmonyPage.tsx';
import { HARMONY_PREFS_KEY, writeHarmonyPrefs } from './harmony/prefs.ts';
import { InputContext } from './input/context.ts';
import { forgetInstrumentKeys, writeInstrumentKeys } from './instrument.ts';
import { createOfferStore, MetronomeContext, type MetronomeHandle } from './metronome/context.ts';
import { EarPage } from './pages/EarPage.tsx';
import { ReadPage } from './pages/ReadPage.tsx';
import { Library } from './pieces/Library.tsx';
import { PracticeProvider } from './practice/PracticeProvider.tsx';
import { createPracticeStore, type PracticeStore } from './practice/store.ts';
import { SessionList } from './progress/SessionList.tsx';
import { WhereYouAre } from './progress/WhereYouAre.tsx';
import { READ_PREFS_KEY, writeReadPrefs } from './read/prefs.ts';
import { ReadSetup } from './read/ReadSetup.tsx';
import { writeStartPref } from './start/prefs.ts';

vi.mock('./staff/font.ts', () => ({
  MUSIC_FONT: 'Bravura',
  loadMusicFont: () => undefined,
  subscribeFont: () => () => undefined,
  getFontState: () => 'loading',
}));

vi.mock('./notation/verovio.ts', () => ({
  prefetchVerovio: () => () => undefined,
}));

const TODAY = dayKey(Date.now());
const START_KEY = 'dacapo.start';

let root: Root | null = null;
let host: HTMLElement;
let stop: (() => void) | null = null;
let enLocale: LoadedLocale;

beforeAll(async () => {
  enLocale = await loadLocale('en');
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  Element.prototype.scrollTo = () => undefined;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  stop?.();
  stop = null;
  host.remove();
  window.location.hash = '';
  forgetInstrumentKeys();
  localStorage.clear();
  vi.restoreAllMocks();
});

function seededStore(patch: Partial<StoredData> = {}): PracticeStore {
  const base = createMemoryRepository();
  const repository = {
    ...base,
    async load() {
      const data = await base.load();
      return { ...data, ...patch };
    },
  };
  const store = createPracticeStore({
    open: () => Promise.resolve({ repository, failure: null }),
  });
  stop = store.start();
  return store;
}

const settleLoaded = (store: PracticeStore) =>
  act(async () => {
    await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
    await store.settled();
  });

function mount(node: ReactNode, store: PracticeStore = seededStore()) {
  const idle = { held: new Map(), sustained: new Set() };
  const midiStatus = { state: 'no-device' } as const;
  const outputState: OutputState = {
    ports: [BUILTIN_OUTPUT],
    choice: { kind: 'auto' },
    selected: BUILTIN_OUTPUT,
  };
  const input = {
    hub: {
      subscribe: () => () => undefined,
      getState: () => idle,
      onEvent: () => () => undefined,
    },
    midi: {
      subscribeStatus: () => () => undefined,
      getStatus: () => midiStatus,
    },
    output: {
      subscribe: () => () => undefined,
      getState: () => outputState,
      scheduler: {
        playAll: () => [],
        cut: () => undefined,
        panic: () => undefined,
      },
      onInterrupt: () => () => undefined,
    },
    samples: {
      subscribe: () => () => undefined,
      getStatus: () => 'ready',
    },
    monitor: {
      subscribe: () => () => undefined,
      getSettings: () => ({ mode: 'all', level: 1 }),
    },
    keyboard: {
      subscribeOctave: () => () => undefined,
      getOctave: () => 4,
      suspend: () => () => undefined,
    },
    onMidiKey: () => () => undefined,
    pointer: {
      down: () => undefined,
      up: () => undefined,
    },
  } as unknown as InputSystem;
  const metronomeSnap = {
    status: 'stopped',
    pausedBy: null,
    blockedBy: null,
    settings: { bpm: 90 },
    bpm: 90,
    target: 90,
    bar: null,
  };
  const metronomeHandle = {
    offers: createOfferStore(),
    metronome: {
      subscribe: () => () => undefined,
      getSnapshot: () => metronomeSnap,
      block: () => () => undefined,
    },
  } as unknown as MetronomeHandle;

  root = createRoot(host);
  act(() => {
    root!.render(
      <I18nProvider initial={enLocale}>
        <InputContext value={input}>
          <MetronomeContext value={metronomeHandle}>
            <PracticeProvider store={store}>
              <Router hook={memoryLocation({ path: '/' }).hook}>{node}</Router>
            </PracticeProvider>
          </MetronomeContext>
        </InputContext>
      </I18nProvider>,
    );
  });
  return store;
}

function setSearchValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.bind(input)(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickButton(label: string) {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
  expect(button, `button "${label}"`).toBeDefined();
  act(() => button!.click());
  return button!;
}

function readProgressMap(attempts: readonly Attempt[] = []): ReadonlyMap<LevelId, LevelProgress> {
  return new Map(LEVEL_IDS.map((id) => [id, levelProgress(attempts, id)] as const));
}

function readSessionRecord(
  id: string,
  level: LevelId,
  atMs = 1_700_000_000_000,
): {
  attempts: Attempt[];
  session: ReadSessionRecord;
} {
  const attempts = Array.from({ length: 5 }, (_, i) =>
    sampleAttempt(i, id, { id: `${id}:${i}`, level, at: atMs + i * 1000, ms: 900, correct: true }),
  );
  return { attempts, session: { kind: 'read', ...recoverSummary(attempts)!, length: 5 } };
}

describe('Library search and filtering', () => {
  it('renders all built-in entries at defaults and layers keyboard-fit filtering onto search and played status', async () => {
    const store = seededStore();
    await settleLoaded(store);

    mount(<Library finished={new Set(['beethoven-ode-to-joy'])} />, store);

    expect(host.querySelectorAll('.library-piece')).toHaveLength(BUILT_IN.length);
    expect(host.querySelector('.library-filter-fits')).toBeNull();

    const search = host.querySelector<HTMLInputElement>('.library-search-input');
    expect(search).not.toBeNull();
    setSearchValue(search!, 'petzold');
    const searched = [...host.querySelectorAll('.library-piece')];
    expect(searched.length).toBeGreaterThan(0);
    expect(searched.every((el) => el.textContent?.toLowerCase().includes('petzold'))).toBe(true);
    expect(host.querySelectorAll('.library-level')).toHaveLength(1);

    const clear = host.querySelector<HTMLButtonElement>('.library-search-clear');
    expect(clear).not.toBeNull();
    act(() => clear!.click());
    expect(host.querySelectorAll('.library-piece')).toHaveLength(BUILT_IN.length);

    const played = host.querySelector<HTMLInputElement>('.library-filter input[value="played"]')!;
    act(() => played.click());
    expect(
      [...host.querySelectorAll<HTMLAnchorElement>('.library-piece')].map((a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/pieces/beethoven-ode-to-joy']);

    const unplayed = host.querySelector<HTMLInputElement>(
      '.library-filter input[value="unplayed"]',
    )!;
    act(() => unplayed.click());
    const unplayedLinks = [...host.querySelectorAll<HTMLAnchorElement>('.library-piece')].map((a) =>
      a.getAttribute('href'),
    );
    expect(unplayedLinks).toHaveLength(BUILT_IN.length - 1);
    expect(unplayedLinks).not.toContain('/pieces/beethoven-ode-to-joy');

    const all = host.querySelector<HTMLInputElement>('.library-filter input[value="all"]')!;
    act(() => all.click());

    act(() => writeInstrumentKeys({ low: 48, high: 84 }));
    const fitsCheckbox = host.querySelector<HTMLInputElement>('.library-filter-fits input');
    expect(fitsCheckbox).not.toBeNull();
    act(() => fitsCheckbox!.click());
    const fittingIds = [...host.querySelectorAll<HTMLAnchorElement>('.library-piece')].map((a) =>
      a.getAttribute('href'),
    );
    expect(fittingIds).toContain('/pieces/turk-aller-anfang');
    expect(fittingIds).not.toContain('/pieces/beethoven-ode-to-joy');

    setSearchValue(search!, 'no-such-piece-xyz');
    expect(host.querySelector('.library-empty')).not.toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('.library-search-clear')!.click());
    act(() => fitsCheckbox!.click());
    expect(host.querySelectorAll('.library-piece')).toHaveLength(BUILT_IN.length);
    act(() => writeInstrumentKeys(FULL_KEYS));
  });
});

describe('Setup double-click level start and mastery counter', () => {
  it('selects and starts on double-click in ReadSetup while respecting unplayable key ranges', () => {
    const onLevel = vi.fn();
    const onStart = vi.fn();
    writeInstrumentKeys({ low: 62, high: 74 });

    mount(
      <ReadSetup
        level="L1"
        length={10}
        hint={false}
        progress={readProgressMap()}
        suggested="L1"
        onLevel={onLevel}
        onLength={() => undefined}
        onHint={() => undefined}
        onStart={onStart}
      />,
    );

    const levels = [...host.querySelectorAll<HTMLLabelElement>('label.level')];
    expect(levels.length).toBeGreaterThan(2);

    act(() => {
      levels[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onLevel).toHaveBeenCalledWith('L1');
    expect(onStart).toHaveBeenCalledWith('L1');

    onLevel.mockClear();
    onStart.mockClear();

    const l2 = levels.find((l) => l.querySelector('.level-id')?.textContent === 'L2')!;
    act(() => {
      l2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onLevel).toHaveBeenCalledWith('L2');
    expect(onStart).toHaveBeenCalledWith('L2');

    onLevel.mockClear();
    onStart.mockClear();

    const bassLevel = levels.find((l) => l.querySelector('.level-id')?.textContent === 'L3')!;
    act(() => {
      bassLevel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onLevel).toHaveBeenCalledWith('L3');
    expect(onStart).not.toHaveBeenCalled();

    act(() => {
      host
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onStart).toHaveBeenCalledWith();
  });

  it('selects and starts on double-click in ChordsSetup', () => {
    const onLevel = vi.fn();
    const onStart = vi.fn();
    const progress = new Map<HarmonyLevelId, HarmonyLevelProgress>([
      ['H1', harmonyLevelProgress([] as readonly ChordSymbolAnswer[], 'H1')],
      ['H2', harmonyLevelProgress([] as readonly ChordSymbolAnswer[], 'H2')],
    ]);

    mount(
      <ChordsSetup
        level="H1"
        length={10}
        hint={false}
        progress={progress}
        suggested="H1"
        onLevel={onLevel}
        onLength={() => undefined}
        onHint={() => undefined}
        onStart={onStart}
      />,
    );

    const h2 = [...host.querySelectorAll<HTMLLabelElement>('label.level')].find(
      (l) => l.querySelector('.level-id')?.textContent === 'H2',
    )!;
    act(() => {
      h2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onLevel).toHaveBeenCalledWith('H2');
    expect(onStart).toHaveBeenCalledWith('H2');
  });

  it('starts the clicked non-selected level immediately on a single synthetic dblclick in ReadPage and HarmonyPage', async () => {
    const readStore = seededStore();
    await settleLoaded(readStore);
    window.location.hash = '#/read';
    mount(<ReadPage />, readStore);

    const readL1 = host.querySelector<HTMLInputElement>('input[type="radio"][value="L1"]');
    expect(readL1?.checked).toBe(true);

    const readL2Label = [...host.querySelectorAll<HTMLLabelElement>('label.level')].find(
      (l) => l.querySelector('.level-id')?.textContent === 'L2',
    )!;
    act(() => {
      readL2Label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(host.querySelector('section.read-session')).not.toBeNull();
    expect(host.querySelector('.read-level')?.textContent).toContain('L2');

    act(() => root?.unmount());
    root = null;

    const harmonyStore = seededStore();
    await settleLoaded(harmonyStore);
    window.location.hash = '#/harmony';
    mount(<HarmonyPage />, harmonyStore);

    const harmH1 = host.querySelector<HTMLInputElement>('input[type="radio"][value="H1"]');
    expect(harmH1?.checked).toBe(true);

    const harmH2Label = [...host.querySelectorAll<HTMLLabelElement>('label.level')].find(
      (l) => l.querySelector('.level-id')?.textContent === 'H2',
    )!;
    act(() => {
      harmH2Label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(host.querySelector('section.harmony-session')).not.toBeNull();
    expect(host.querySelector('.read-level')?.textContent).toContain('H2');
  });

  it('passes explicit rhythm level id when double-clicking a rhythm ear level in EarSetup', () => {
    const onRhythmLevel = vi.fn();
    const onRhythmStart = vi.fn();
    const earProgress = new Map<EarLevelId, EarLevelProgress>();
    const earRhythmProgress = new Map<RhythmEarLevelId, RhythmEarLevelProgress>();
    for (const id of RHYTHM_EAR_LEVEL_IDS) {
      earRhythmProgress.set(id, rhythmEarLevelProgress([], id));
    }

    mount(
      <EarSetup
        prefs={{ ...DEFAULT_EAR_PREFS, family: 'rhythmEar' }}
        level="I1"
        progress={earProgress}
        suggested="I1"
        onPrefs={() => undefined}
        onLevel={() => undefined}
        onStart={() => undefined}
        rhythm={{
          level: 'R1',
          progress: earRhythmProgress,
          suggested: 'R1',
          onLevel: onRhythmLevel,
          onStart: onRhythmStart,
          bpm: 72,
          onTempo: () => undefined,
        }}
      />,
    );

    const r3 = [...host.querySelectorAll<HTMLLabelElement>('label.level')].find(
      (l) => l.querySelector('.level-id')?.textContent === 'R3',
    )!;
    act(() => {
      r3.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onRhythmLevel).toHaveBeenCalledWith('R3');
    expect(onRhythmStart).toHaveBeenCalledWith('R3');
  });

  it('shows mastered counts after family segmented choices without changing radio labels', async () => {
    const store = seededStore();
    await settleLoaded(store);
    mount(<ReadPage />, store);

    const readRadios = [
      ...host.querySelectorAll<HTMLInputElement>('.read-what input[type="radio"]'),
    ];
    expect(readRadios.map((r) => r.closest('label')?.textContent)).toContain('Notes');
    const readCount = host.querySelector('.read-what + .setup-mastered-count');
    expect(readCount?.textContent).toBe(`0 of ${LEVEL_IDS.length} mastered`);

    const onEarStart = vi.fn();
    const onEarLevel = vi.fn();
    const earProgress = new Map<EarLevelId, EarLevelProgress>();
    const earRhythmProgress = new Map<RhythmEarLevelId, RhythmEarLevelProgress>();
    for (const id of RHYTHM_EAR_LEVEL_IDS) {
      earRhythmProgress.set(id, rhythmEarLevelProgress([], id));
    }
    earProgress.set('I1', { ...earLevelProgress([], 'I1'), mastered: true });

    act(() => root?.unmount());
    root = null;
    mount(
      <EarSetup
        prefs={{ ...DEFAULT_EAR_PREFS, family: 'interval' }}
        level="I1"
        progress={earProgress}
        suggested="I1"
        onPrefs={() => undefined}
        onLevel={onEarLevel}
        onStart={onEarStart}
        startDisabled
        rhythm={{
          level: 'R1',
          progress: earRhythmProgress,
          suggested: 'R1',
          onLevel: () => undefined,
          bpm: 72,
          onTempo: () => undefined,
        }}
      />,
      store,
    );

    const earCount = host.querySelector('.ear-family + .setup-mastered-count');
    expect(earCount?.textContent).toMatch(/^1 of \d+ mastered$/);
    const e1 = host.querySelector<HTMLLabelElement>('label.level')!;
    act(() => {
      e1.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onEarLevel).toHaveBeenCalledWith('I1');
    expect(onEarStart).not.toHaveBeenCalled();
  });
});

describe('Focused progress and actionable session links', () => {
  it('folds locked rows in WhereYouAre when at least two practices are locked and keeps flat list when unlocked', async () => {
    localStorage.setItem(START_KEY, '');
    writeStartPref({ from: 'new' });
    const store = seededStore();
    await settleLoaded(store);

    mount(<WhereYouAre today={TODAY} />, store);
    await act(async () => {
      await vi.waitFor(() => expect(host.querySelector('.where-rows')).not.toBeNull());
    });

    const locked = host.querySelector<HTMLDetailsElement>('.where-locked');
    expect(locked).not.toBeNull();
    expect(locked!.open).toBe(false);
    expect(locked!.querySelector('summary')?.textContent).toMatch(/^Later in the course \(\d+\)$/);

    act(() => locked!.querySelector('summary')!.click());
    expect(locked!.open).toBe(true);
    expect(locked!.querySelectorAll('.where-rows li.is-closed').length).toBeGreaterThanOrEqual(2);

    act(() => root?.unmount());
    root = null;
    writeStartPref({ from: 'player', reads: 'both' });
    mount(<WhereYouAre today={TODAY} />, store);
    await act(async () => {
      await vi.waitFor(() => expect(host.querySelector('.where-rows')).not.toBeNull());
    });
    expect(host.querySelector('.where-locked')).toBeNull();
  });

  it('filters SessionList by kind and turns active session targets into links with safe fallback for deleted custom pieces', async () => {
    const savedCustom: StoredPiece = samplePiece(9, { id: 'custom-kept', title: 'Kept Piece' });
    const builtInPiece: PieceSessionRecord = {
      ...sampleRun(
        's-piece-1',
        4,
        { pieceId: 'petzold-minuet-in-g' },
        { pieceId: 'petzold-minuet-in-g', hands: 'right', tempo: 85 },
      ).session,
      startedAt: 1_700_000_010_000,
    };
    const progPieceId = progressionPieceId({
      progression: 'I-IV-V-I',
      key: 'C',
      pattern: 'block',
    });
    const progPiece: PieceSessionRecord = {
      ...sampleRun(
        's-prog',
        4,
        { pieceId: progPieceId },
        { pieceId: progPieceId, title: 'Cadence in C' },
      ).session,
      startedAt: 1_700_000_009_000,
    };
    const keptCustomSession: PieceSessionRecord = {
      ...sampleRun(
        's-custom-kept',
        4,
        { pieceId: 'custom-kept' },
        { pieceId: 'custom-kept', title: 'Kept Piece' },
      ).session,
      startedAt: 1_700_000_008_000,
    };
    const deletedCustomSession: PieceSessionRecord = {
      ...sampleRun(
        's-custom-gone',
        4,
        { pieceId: 'custom-gone' },
        { pieceId: 'custom-gone', title: 'Gone Piece' },
      ).session,
      startedAt: 1_700_000_007_000,
    };
    const readSess = readSessionRecord('s-read', 'L2', 1_700_000_006_000).session;
    const theorySess = {
      ...sampleTheorySession('s-theory', 4).session,
      startedAt: 1_700_000_005_000,
    };
    const rhythmSess = {
      ...sampleRhythmSession('s-rhythm', 2).session,
      startedAt: 1_700_000_004_000,
    };
    const sightSess = { ...sampleSightSession('s-sight', 2), startedAt: 1_700_000_003_000 };
    const earSess = { ...sampleEarSession('s-ear', 3).session, startedAt: 1_700_000_002_000 };
    const tuneSess = { ...sampleTuneSession('s-tune').session, startedAt: 1_700_000_001_500 };
    const rhythmEarSess = {
      ...sampleRhythmEarSession('s-re', 2).session,
      startedAt: 1_700_000_001_200,
    };
    const harmonySess = {
      ...sampleHarmonySession('s-harm', 4).session,
      startedAt: 1_700_000_001_000,
    };
    const scaleSess = {
      ...sampleScaleSession('s-scale', 2, { exercise: 'major:C:1:both' }).session,
      startedAt: 1_700_000_000_500,
    };

    const sessions: SessionRecord[] = [
      builtInPiece,
      progPiece,
      keptCustomSession,
      deletedCustomSession,
      readSess,
      theorySess,
      rhythmSess,
      sightSess,
      earSess,
      tuneSess,
      rhythmEarSess,
      harmonySess,
      scaleSess,
    ];

    const store = seededStore({ pieces: [savedCustom], sessions });
    await settleLoaded(store);

    mount(<SessionList sessions={sessions} />, store);
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(sessions.length);

    const links = [...host.querySelectorAll<HTMLAnchorElement>('.session-link')].map((a) =>
      a.getAttribute('href'),
    );
    expect(links.some((h) => h?.startsWith('/pieces/petzold-minuet-in-g?'))).toBe(true);
    expect(links).toContain('/harmony/progressions/I-IV-V-I/C/block');
    expect(links.some((h) => h?.startsWith('/pieces/custom-kept?'))).toBe(true);
    expect(links.some((h) => h?.includes('custom-gone'))).toBe(false);
    expect(host.textContent).toContain('Gone Piece');
    expect(links).toContain('/read?family=notes&level=L2');
    expect(links.some((h) => h?.startsWith('/scales?'))).toBe(true);
    expect(links.some((h) => h?.startsWith('/harmony?family=chordSymbol'))).toBe(true);
    expect(links.some((h) => h?.startsWith('/ear?family=rhythmEar'))).toBe(true);

    clickButton('Pieces');
    expect(host.querySelectorAll('.session-list > li.is-piece')).toHaveLength(4);
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(4);

    clickButton('Read');
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(4);

    clickButton('Ear');
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(3);

    clickButton('Scales');
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(1);

    clickButton('Harmony');
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(1);

    clickButton('All');
    expect(host.querySelectorAll('.session-list > li')).toHaveLength(sessions.length);
  });
});

describe('Quick Jump deep links for Read, Ear, and Harmony', () => {
  it('opens ReadPage at /read?family=rhythm on the Rhythm tab without overwriting localStorage', async () => {
    writeReadPrefs({ choice: 'notes', chordBy: 'play', levels: {} });
    const before = localStorage.getItem(READ_PREFS_KEY);
    const store = seededStore();
    await settleLoaded(store);

    window.location.hash = '#/read?family=rhythm';
    mount(<ReadPage />, store);

    const rhythmRadio = host.querySelector<HTMLInputElement>(
      '.read-what input[type="radio"][value="rhythm"]',
    );
    expect(rhythmRadio?.checked).toBe(true);
    expect(host.querySelector('.rhythm-setup')).not.toBeNull();
    expect(localStorage.getItem(READ_PREFS_KEY)).toBe(before);
  });

  it('opens EarPage at /ear?family=cadence on the Cadences tab without overwriting localStorage', async () => {
    writeEarPrefs({ ...DEFAULT_EAR_PREFS, family: 'interval' });
    const before = localStorage.getItem(EAR_PREFS_KEY);
    const store = seededStore();
    await settleLoaded(store);

    window.location.hash = '#/ear?family=cadence';
    mount(<EarPage />, store);

    const cadenceRadio = host.querySelector<HTMLInputElement>(
      '.ear-family input[type="radio"][value="cadence"]',
    );
    expect(cadenceRadio?.checked).toBe(true);
    const levelIds = [...host.querySelectorAll('.level-id')].map((el) => el.textContent);
    expect(levelIds).toContain('CA1');
    expect(localStorage.getItem(EAR_PREFS_KEY)).toBe(before);
  });

  it('opens HarmonyPage at /harmony?practice=improvise on the Improvise tab without overwriting localStorage', async () => {
    writeHarmonyPrefs({
      practice: 'chords',
      progression: 'I-IV-V-I',
      majorKey: 'C',
      minorKey: 'Am',
      pattern: 'block',
      bpm: 80,
      level: null,
    });
    const before = localStorage.getItem(HARMONY_PREFS_KEY);
    const store = seededStore();
    await settleLoaded(store);

    window.location.hash = '#/harmony?practice=improvise';
    mount(<HarmonyPage />, store);

    const improviseRadio = host.querySelector<HTMLInputElement>(
      '.harmony-practices input[type="radio"][value="improvise"]',
    );
    expect(improviseRadio?.checked).toBe(true);
    expect(host.querySelector('.improv-setup')).not.toBeNull();
    expect(localStorage.getItem(HARMONY_PREFS_KEY)).toBe(before);
  });
});

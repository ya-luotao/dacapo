// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router, type BaseLocationHook } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { KEYBOARDS } from '../core/instrument.ts';
import type { PieceFacts } from '../core/pieceRecords.ts';
import { progressionPieceId } from '../core/progressions.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import { I18nProvider, loadLocale } from '../i18n/index.ts';
import type { LoadedLocale } from '../i18n/locale.ts';
import type { InputSystem } from '../input/index.ts';
import { TERM_GROUPS, TERMS } from '../learn/terms.ts';
import { BUILTIN_OUTPUT, type OutputState } from '../output/output.ts';
import { createMemoryRepository, type StoredData } from '../storage/repository.ts';
import { samplePiece } from '../storage/fixtures.ts';
import { progressionPath } from './harmony/progressionFormat.ts';
import { ProgressionsSetup } from './harmony/ProgressionsSetup.tsx';
import { DEFAULT_HARMONY_PREFS, readProgressionTempo, type HarmonyPrefs } from './harmony/prefs.ts';
import { InputContext } from './input/context.ts';
import { forgetInstrumentKeys, writeInstrumentKeys } from './instrument.ts';
import { TermsList } from './learn/TermEntry.tsx';
import { TermsPage } from './learn/TermsPage.tsx';
import { createOfferStore, MetronomeContext, type MetronomeHandle } from './metronome/context.ts';
import { readPiecePrefs } from './pieces/prefs.ts';
import { YourPieces } from './pieces/YourPieces.tsx';
import { PracticeProvider } from './practice/PracticeProvider.tsx';
import { createPracticeStore, type PracticeStore } from './practice/store.ts';

vi.mock('./staff/font.ts', () => ({
  MUSIC_FONT: 'Bravura',
  loadMusicFont: () => undefined,
  subscribeFont: () => () => undefined,
  getFontState: () => 'loading',
}));

vi.mock('./notation/verovio.ts', () => ({
  prefetchVerovio: () => () => undefined,
  countUnplaced: () => Promise.resolve(0),
}));

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

function mount(
  node: ReactNode,
  store: PracticeStore = seededStore(),
  loc = memoryLocation({ path: '/', record: true }),
) {
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
              <Router hook={loc.hook}>{node}</Router>
            </PracticeProvider>
          </MetronomeContext>
        </InputContext>
      </I18nProvider>,
    );
  });
  return { store, loc };
}

function setSearchValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.bind(input)(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function makeFacts(keys: readonly [number, number]): PieceFacts {
  return {
    checksum: 'check',
    bars: { both: 4, right: 4, left: 4 },
    notes: { play: 16, skip: 16 },
    keys,
  };
}

function makePiece(
  i: number,
  opts: {
    title: string;
    composer: string;
    fileName: string;
    keys: readonly [number, number];
  },
): StoredPiece {
  return samplePiece(i, {
    title: opts.title,
    composer: opts.composer,
    fileName: opts.fileName,
    facts: makeFacts(opts.keys),
  });
}

describe('TermsList SSG invariant & TermsPage filtering', () => {
  it('renders TermsList statically without client providers or interactive controls', () => {
    const staticHook: BaseLocationHook = Object.assign(
      (): [string, () => void] => ['/learn/terms', () => undefined],
      { searchHook: () => '' },
    );
    const html = renderToStaticMarkup(
      <Router hook={staticHook}>
        <TermsList language="en" />
      </Router>,
    );
    const explicitDefaultsHtml = renderToStaticMarkup(
      <Router hook={staticHook}>
        <TermsList language="en" query="" group="all" emptyMessage="" />
      </Router>,
    );

    expect(html).toBe(explicitDefaultsHtml);
    expect(html).not.toMatch(/<(?:button|input|select|textarea|form|label)\b/i);

    const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    expect(parsed.querySelectorAll('.terms-group')).toHaveLength(TERM_GROUPS.length);
    expect(parsed.querySelectorAll('.terms-row')).toHaveLength(TERMS.length);
  });

  it('filters terms by search query, aliases, and group pills, showing empty state on miss', () => {
    mount(<TermsPage />);

    const toolbar = host.querySelector('.library-filter');
    expect(toolbar).not.toBeNull();
    const search = host.querySelector<HTMLInputElement>('.library-search-input')!;
    expect(search.placeholder).toBe('Filter terms…');
    expect(search.getAttribute('aria-label')).toBe('Filter musical terms');

    const pills = Array.from(host.querySelectorAll<HTMLButtonElement>('.filter-pill'));
    expect(pills.map((p) => p.textContent)).toEqual(['All', ...TERM_GROUPS.map((g) => g.title.en)]);
    expect(pills[0]?.getAttribute('aria-pressed')).toBe('true');

    // Filter by group pill.
    const tempoGroup = TERM_GROUPS.find((g) => g.id === 'tempo')!;
    const tempoPill = pills.find((p) => p.textContent === tempoGroup.title.en)!;
    act(() => tempoPill.click());
    expect(tempoPill.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelectorAll('.terms-group')).toHaveLength(1);
    expect(host.querySelector('.terms-group h2')?.textContent).toBe(tempoGroup.title.en);

    // Search within the group matches alias/summary text case-insensitively.
    setSearchValue(search, 'cresc.');
    const matchedRows = Array.from(host.querySelectorAll('.terms-row'));
    expect(matchedRows.some((r) => r.getAttribute('href') === '/learn/terms/crescendo')).toBe(true);

    // Reset to All and enter a query matching no terms.
    act(() => pills[0]!.click());
    setSearchValue(search, 'zzz-no-term');
    expect(host.querySelectorAll('.terms-group')).toHaveLength(0);
    expect(host.querySelector('.library-empty')?.textContent).toBe('No terms match “zzz-no-term”.');
  });
});

describe('YourPieces search & fits-keyboard filtering', () => {
  it('hides filter toolbar for fewer than 4 imported pieces', async () => {
    const pieces = [
      makePiece(1, {
        title: 'Prelude in C',
        composer: 'Bach',
        fileName: 'pre.mxl',
        keys: [48, 84],
      }),
      makePiece(2, {
        title: 'Waltz in A',
        composer: 'Chopin',
        fileName: 'wal.mxl',
        keys: [48, 84],
      }),
      makePiece(3, { title: 'Etude', composer: 'Burgmuller', fileName: 'et.mxl', keys: [48, 84] }),
    ];
    const store = seededStore({ pieces });
    await settleLoaded(store);

    mount(<YourPieces />, store);

    expect(host.querySelector('.library-filter')).toBeNull();
    expect(host.querySelectorAll('.your-piece-row')).toHaveLength(3);
  });

  it('shows search and keyboard-fit filters once 4+ pieces exist and handles empty matches', async () => {
    writeInstrumentKeys(KEYBOARDS[61]); // MIDI 36..96
    const pieces = [
      makePiece(1, {
        title: 'Prelude in C',
        composer: 'J. S. Bach',
        fileName: 'bwv-846.musicxml',
        keys: [48, 84],
      }),
      makePiece(2, {
        title: 'Nocturne',
        composer: 'Frederic Chopin',
        fileName: 'nocturne.mxl',
        keys: [28, 90], // below 61-key range
      }),
      makePiece(3, {
        title: 'Minuet',
        composer: 'Christian Petzold',
        fileName: 'minuet-draft.xml',
        keys: [36, 96], // exact fit for 61 keys
      }),
      makePiece(4, {
        title: 'Arabesque',
        composer: 'Johann Burgmuller',
        fileName: 'arabesque.mxl',
        keys: [40, 88],
      }),
    ];
    const store = seededStore({ pieces });
    await settleLoaded(store);

    mount(<YourPieces />, store);

    expect(host.querySelector('.library-filter')).not.toBeNull();
    expect(host.querySelectorAll('.your-piece-row')).toHaveLength(4);

    const search = host.querySelector<HTMLInputElement>('.library-search-input')!;
    expect(search.placeholder).toBe('Filter your pieces…');
    expect(search.getAttribute('aria-label')).toBe('Filter your pieces');

    // Matches title, composer, and fileName.
    setSearchValue(search, 'bwv-846');
    expect(host.querySelectorAll('.your-piece-row')).toHaveLength(1);
    expect(host.querySelector('.library-piece-title')?.textContent).toBe('Prelude in C');

    setSearchValue(search, 'chopin');
    expect(host.querySelectorAll('.your-piece-row')).toHaveLength(1);
    expect(host.querySelector('.library-piece-title')?.textContent).toBe('Nocturne');

    setSearchValue(search, '');
    expect(host.querySelectorAll('.your-piece-row')).toHaveLength(4);

    // Fits-keyboard toggle filters out pieces outside the 61-key range.
    const fitsInput = host.querySelector<HTMLInputElement>('.library-filter-fits input')!;
    expect(host.querySelector('.library-filter-fits')?.textContent).toBe('Fits 61-key keyboard');
    act(() => fitsInput.click());
    const visibleTitles = Array.from(host.querySelectorAll('.library-piece-title')).map(
      (n) => n.textContent,
    );
    expect(visibleTitles).not.toContain('Nocturne');
    expect(visibleTitles).toHaveLength(3);

    // Non-matching search shows the empty filter state.
    setSearchValue(search, 'symphony');
    expect(host.querySelector('.library-empty')?.textContent).toBe('No pieces match this filter.');
  });

  it('hides the keyboard-fit checkbox when configured for full 88 keys', async () => {
    const pieces = Array.from({ length: 4 }, (_, i) =>
      makePiece(i + 1, {
        title: `Piece ${i + 1}`,
        composer: 'Composer',
        fileName: `piece-${i + 1}.mxl`,
        keys: [28, 100],
      }),
    );
    const store = seededStore({ pieces });
    await settleLoaded(store);

    mount(<YourPieces />, store);

    expect(host.querySelector('.library-filter')).not.toBeNull();
    expect(host.querySelector('.library-filter-fits')).toBeNull();
  });
});

describe('ProgressionsSetup double-click quick launch', () => {
  it('persists selection and launches immediately on double-clicking progression or pattern cards', async () => {
    const store = seededStore();
    await settleLoaded(store);
    const loc = memoryLocation({ path: '/harmony', record: true });

    const seenPatches: Partial<HarmonyPrefs>[] = [];
    function Harness() {
      const [prefs, setPrefs] = useState<HarmonyPrefs>({
        ...DEFAULT_HARMONY_PREFS,
        practice: 'progressions',
        progression: 'I-IV-V-I',
        majorKey: 'G',
        minorKey: 'Dm',
        pattern: 'block',
        bpm: 96,
      });
      return (
        <ProgressionsSetup
          prefs={prefs}
          onPrefs={(patch) => {
            seenPatches.push(patch);
            setPrefs((prev) => ({ ...prev, ...patch }));
          }}
        />
      );
    }

    mount(<Harness />, store, loc);

    // Double-click a minor progression card: uses its own remembered minorKey ('Dm') right away.
    const minorRadio = host.querySelector<HTMLInputElement>('input[value="i-iv-V-i"]')!;
    const minorLabel = minorRadio.closest('label')!;
    act(() => {
      minorLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const expectedMinorSpec = {
      progression: 'i-iv-V-i' as const,
      key: 'Dm' as const,
      pattern: 'block' as const,
    };
    const minorPieceId = progressionPieceId(expectedMinorSpec);
    expect(seenPatches).toContainEqual({ progression: 'i-iv-V-i' });
    expect(loc.history[loc.history.length - 1]).toBe(progressionPath(expectedMinorSpec));
    expect(readProgressionTempo(minorPieceId)).toBe(96);
    expect(readPiecePrefs(minorPieceId)?.tempo).toBe(100);

    // Double-click a different pattern card: persists pattern and launches immediately.
    const albertiRadio = host.querySelector<HTMLInputElement>('input[value="alberti"]')!;
    const albertiLabel = albertiRadio.closest('label')!;
    act(() => {
      albertiLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const expectedAlbertiSpec = {
      progression: 'i-iv-V-i' as const,
      key: 'Dm' as const,
      pattern: 'alberti' as const,
    };
    expect(seenPatches).toContainEqual({ pattern: 'alberti' });
    expect(loc.history[loc.history.length - 1]).toBe(progressionPath(expectedAlbertiSpec));
  });
});

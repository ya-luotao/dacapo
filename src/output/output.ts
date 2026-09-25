// The MIDI output the instrument is played through: which one (chosen in Settings, remembered by
// name), hot-plugging, and silencing it whenever sound must stop — the route changes, the output
// goes away, the page is hidden or left.

import type { RequestMidiAccess } from '../input/webmidi.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';
import type { EchoGuard } from './echo.ts';
import { browserClock, createScheduler, type Clock, type Scheduler } from './scheduler.ts';

export type OutputChoice = { kind: 'auto' } | { kind: 'none' } | { kind: 'port'; name: string };

export interface OutputPort {
  id: string;
  /** Trimmed; may be empty. */
  name: string;
}

export interface OutputState {
  /** Connected outputs, in the browser's order. */
  ports: readonly OutputPort[];
  choice: OutputChoice;
  /** Where notes go now; null: nowhere. */
  selected: OutputPort | null;
}

export type InterruptReason = 'route' | 'hidden';

export interface MidiOutput {
  scheduler: Scheduler;
  getState: () => OutputState;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  /** Sound was cut from outside (the route changed, the page was hidden): playback must stop. */
  onInterrupt: (listener: (reason: InterruptReason) => void) => () => void;
  choose: (choice: OutputChoice) => void;
  /** Middle C for 400 ms. */
  testNote: () => void;
  /** Starts following the outputs. Returns a function that stops; start again afterwards is fine. */
  start: () => () => void;
  /** Takes up the shared access once it has been granted elsewhere (the input's retry). */
  retry: () => void;
}

export const OUTPUT_PREF = 'dacapo.midiOutput';
export const TEST_NOTE = { midi: 60, velocity: 72, ms: 400 };

export function readChoice(value: string | null): OutputChoice {
  if (value === 'none') return { kind: 'none' };
  if (value?.startsWith('port:')) return { kind: 'port', name: value.slice(5) };
  return { kind: 'auto' };
}

function writeChoice(choice: OutputChoice): string | null {
  if (choice.kind === 'none') return 'none';
  if (choice.kind === 'port') return `port:${choice.name}`;
  return null;
}

/** The output to use: the chosen name, or with "auto" the output named like a connected input. */
export function resolveOutput(
  ports: readonly OutputPort[],
  inputNames: readonly string[],
  choice: OutputChoice,
): OutputPort | null {
  if (choice.kind === 'none') return null;
  if (choice.kind === 'port') return ports.find((p) => p.name === choice.name) ?? null;
  const names = new Set(inputNames.filter(Boolean).map((n) => n.toLowerCase()));
  return ports.find((p) => p.name !== '' && names.has(p.name.toLowerCase())) ?? null;
}

function sameState(a: OutputState, b: OutputState): boolean {
  return (
    a.selected?.id === b.selected?.id &&
    a.selected?.name === b.selected?.name &&
    writeChoice(a.choice) === writeChoice(b.choice) &&
    a.ports.length === b.ports.length &&
    a.ports.every((p, i) => p.id === b.ports[i]!.id && p.name === b.ports[i]!.name)
  );
}

export interface MidiOutputOptions {
  /** The access shared with the input (see `shareMidiAccess`); null: no Web MIDI. */
  requestAccess: RequestMidiAccess | null;
  guard?: EchoGuard;
  clock?: Clock;
  /** Where visibility and page-hide events come from; the browser's by default. */
  page?: { document: EventTarget & { visibilityState: string }; window: EventTarget } | null;
  prefs?: {
    read: (key: string) => string | null;
    write: (key: string, value: string | null) => void;
  };
}

export function createMidiOutput(options: MidiOutputOptions): MidiOutput {
  const { requestAccess, guard } = options;
  const clock = options.clock ?? browserClock;
  const prefs = options.prefs ?? { read: readPref, write: writePref };
  const page =
    options.page === undefined
      ? typeof document === 'undefined'
        ? null
        : { document, window }
      : options.page;

  let portName = '';
  const scheduler = createScheduler({
    clock,
    onSent(data, time) {
      if ((data[0]! & 0xf0) === 0x90 && data[2]! > 0)
        guard?.sent(portName, data[1]!, time ?? clock.now());
    },
  });

  let state: OutputState = {
    ports: [],
    choice: readChoice(prefs.read(OUTPUT_PREF)),
    selected: null,
  };
  const listeners = new Set<() => void>();
  const interruptListeners = new Set<(reason: InterruptReason) => void>();
  let access: MIDIAccess | null = null;
  // Bumped on every start and stop, so a late grant for a stopped run is ignored.
  let running = 0;
  let active = false;
  const outputs = new Map<string, MIDIOutput>();

  function interrupt(reason: InterruptReason, silenced = false) {
    if (!silenced) scheduler.panic();
    for (const listener of [...interruptListeners]) listener(reason);
  }

  function setState(next: OutputState) {
    const previous = state.selected;
    const route = next.selected?.id !== previous?.id;
    if (sameState(state, next)) return;
    state = next;
    if (route) {
      const port = next.selected ? (outputs.get(next.selected.id) ?? null) : null;
      // The old port is silenced (setPort panics on it) before the new one takes over.
      scheduler.setPort(port);
      portName = next.selected?.name ?? '';
      port?.open().catch(() => undefined);
      // Nothing can have been playing without an output.
      if (previous) interrupt('route', true);
    }
    for (const listener of [...listeners]) listener();
  }

  function sync(choice: OutputChoice = state.choice) {
    outputs.clear();
    const ports: OutputPort[] = [];
    const inputNames: string[] = [];
    if (access) {
      access.outputs.forEach((output) => {
        if (output.state !== 'connected') return;
        outputs.set(output.id, output);
        ports.push({ id: output.id, name: output.name?.trim() ?? '' });
      });
      access.inputs.forEach((input) => {
        if (input.state === 'connected') inputNames.push(input.name?.trim() ?? '');
      });
    }
    setState({ ports, choice, selected: resolveOutput(ports, inputNames, choice) });
  }

  function connect(run: number) {
    requestAccess?.().then(
      (granted) => {
        if (run !== running || access === granted) return;
        access?.removeEventListener('statechange', onStateChange);
        access = granted;
        access.addEventListener('statechange', onStateChange);
        sync();
      },
      () => undefined,
    );
  }

  const onStateChange = () => sync();

  const onVisibility = () => {
    if (page?.document.visibilityState === 'hidden') interrupt('hidden');
  };
  const onPageHide = () => interrupt('hidden');

  return {
    scheduler,
    getState: () => state,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    onInterrupt(listener) {
      interruptListeners.add(listener);
      return () => void interruptListeners.delete(listener);
    },
    choose(choice) {
      prefs.write(OUTPUT_PREF, writeChoice(choice));
      sync(choice);
    },
    testNote() {
      if (!state.selected) return;
      const now = clock.now();
      scheduler.play({
        midi: TEST_NOTE.midi,
        velocity: TEST_NOTE.velocity,
        on: now,
        off: now + TEST_NOTE.ms,
      });
    },
    start() {
      const run = ++running;
      active = true;
      page?.document.addEventListener('visibilitychange', onVisibility);
      page?.window.addEventListener('pagehide', onPageHide);
      connect(run);
      return () => {
        if (run !== running) return;
        running++;
        active = false;
        page?.document.removeEventListener('visibilitychange', onVisibility);
        page?.window.removeEventListener('pagehide', onPageHide);
        access?.removeEventListener('statechange', onStateChange);
        access = null;
        sync();
      };
    },
    retry() {
      if (active && !access) connect(running);
    },
  };
}

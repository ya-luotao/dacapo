// The MIDI output the instrument is played through: which one (chosen in Settings, remembered by
// name), hot-plugging, and silencing it whenever sound must stop — the route changes, the output
// goes away, the page is hidden or left. The built-in piano (piano.ts) is one more output: chosen,
// or taken by "auto" when no connected keyboard has an output of its own.

import type { RequestMidiAccess } from '../input/webmidi.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';
import type { EchoGuard } from './echo.ts';
import {
  browserClock,
  createScheduler,
  type Clock,
  type OutPort,
  type Scheduler,
} from './scheduler.ts';

export type OutputChoice =
  { kind: 'auto' } | { kind: 'builtin' } | { kind: 'none' } | { kind: 'port'; name: string };

export interface OutputPort {
  id: string;
  /** Trimmed; may be empty. */
  name: string;
}

/** The built-in piano, as an output. */
export const BUILTIN_OUTPUT: OutputPort = { id: 'dacapo:builtin', name: '' };

export const isBuiltin = (port: OutputPort | null): boolean => port?.id === BUILTIN_OUTPUT.id;

export interface OutputState {
  /** Connected outputs, in the browser's order. */
  ports: readonly OutputPort[];
  choice: OutputChoice;
  /** Where notes go now (`BUILTIN_OUTPUT` for the built-in piano); null: nowhere. */
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
/**
 * How long "auto" waits for MIDI before it settles for the built-in piano, as the keyboard help
 * does: access is usually granted within milliseconds, and a keyboard then takes over.
 */
export const SETTLE_MS = 1500;

export function readChoice(value: string | null): OutputChoice {
  if (value === 'none') return { kind: 'none' };
  if (value === 'builtin') return { kind: 'builtin' };
  if (value?.startsWith('port:')) return { kind: 'port', name: value.slice(5) };
  return { kind: 'auto' };
}

function writeChoice(choice: OutputChoice): string | null {
  if (choice.kind === 'none') return 'none';
  if (choice.kind === 'builtin') return 'builtin';
  if (choice.kind === 'port') return `port:${choice.name}`;
  return null;
}

/**
 * The output to use: the chosen name, or with "auto" the output named like a connected input.
 * `builtin` is the built-in piano where it can play (and "auto" has stopped waiting for MIDI).
 */
export function resolveOutput(
  ports: readonly OutputPort[],
  inputNames: readonly string[],
  choice: OutputChoice,
  builtin: OutputPort | null = null,
): OutputPort | null {
  if (choice.kind === 'none') return null;
  if (choice.kind === 'builtin') return builtin;
  if (choice.kind === 'port') return ports.find((p) => p.name === choice.name) ?? null;
  const names = new Set(inputNames.filter(Boolean).map((n) => n.toLowerCase()));
  return ports.find((p) => p.name !== '' && names.has(p.name.toLowerCase())) ?? builtin;
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
  /** The built-in piano; `prepare` is called when it becomes the output (to load its sound). */
  builtin?: { port: OutPort; prepare?: () => void } | null;
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
  const builtin = options.builtin ?? null;
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
  /** MIDI access was granted or refused, or took too long: "auto" may take the built-in piano. */
  let settled = false;
  let stopSettle: (() => void) | null = null;
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
      const midiPort = next.selected ? (outputs.get(next.selected.id) ?? null) : null;
      const piano = isBuiltin(next.selected) ? builtin : null;
      // The old port is silenced (setPort panics on it) before the new one takes over.
      scheduler.setPort(piano?.port ?? midiPort);
      // Nothing we send the built-in piano can come back as a key press.
      portName = piano ? '' : (next.selected?.name ?? '');
      midiPort?.open().catch(() => undefined);
      piano?.prepare?.();
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
    const piano =
      active && builtin && (settled || choice.kind === 'builtin') ? BUILTIN_OUTPUT : null;
    setState({ ports, choice, selected: resolveOutput(ports, inputNames, choice, piano) });
  }

  function settle() {
    stopSettle?.();
    stopSettle = null;
    if (settled) return;
    settled = true;
    sync();
  }

  function connect(run: number) {
    if (!requestAccess) {
      settle();
      return;
    }
    requestAccess().then(
      (granted) => {
        if (run !== running) return;
        if (access !== granted) {
          access?.removeEventListener('statechange', onStateChange);
          access = granted;
          access.addEventListener('statechange', onStateChange);
          sync();
        }
        settle();
      },
      () => {
        if (run === running) settle();
      },
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
      if (builtin && !settled) stopSettle ??= clock.every(SETTLE_MS, settle);
      sync();
      connect(run);
      return () => {
        if (run !== running) return;
        running++;
        active = false;
        settled = false;
        stopSettle?.();
        stopSettle = null;
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

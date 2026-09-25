// @vitest-environment jsdom
//
// The Web MIDI shim the Apple app injects (apple/Dacapo/MIDI/midi-bridge.js), run as the app runs
// it: the shipped file, evaluated as a classic script before any of our code, with a fake native
// side behind `webkit.messageHandlers.dacapoMidi`. The app's own MIDI code (input/webmidi.ts,
// output/output.ts) runs on top of it, so the shim is held to the Web MIDI semantics dacapo relies
// on, the same ones input/webmidi.test.ts states with its fakes of Chrome's API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import shimSource from '../../apple/Dacapo/MIDI/midi-bridge.js?raw';
import { createInputHub, type HubEvent } from '../input/hub.ts';
import { browserMidiAccess, createWebMidiInput, shareMidiAccess } from '../input/webmidi.ts';
import { createMidiOutput } from '../output/output.ts';

/** Host time (CoreMIDI, ms) = page time (performance.now()) + OFFSET. */
const OFFSET = 1_000_000;

interface PortInfo {
  id: string;
  type: 'input' | 'output';
  name: string;
  manufacturer: string;
  version: string;
  online: boolean;
}

type Message =
  | { type: 'hello' }
  | { type: 'clock' }
  | { type: 'send'; items: [string, number[], number][] }
  | { type: 'clear'; id: string };

interface Bridge {
  receive: (batch: [string, number, number[], number][], flushedHostMs: number) => void;
  ports: (list: PortInfo[]) => void;
  clock: { tick: number; lo: number; hi: number; offset: number; samples: number; resets: number };
  sync: (rounds: number) => Promise<void>;
}

const port = (id: string, type: PortInfo['type'], name: string, online = true): PortInfo => ({
  id,
  type,
  name,
  manufacturer: 'Kawai',
  version: '1',
  online,
});

const PIANO_IN = port('11', 'input', 'MP11SE');
const PIANO_OUT = port('12', 'output', 'MP11SE');

/** The page clock, under the test's control. */
let now = 1000;
/** A round trip's page time before and after the native side reads its host clock. */
let readAt: [before: number, after: number] = [0, 0];
/** A jump of the host clock against the page clock (as across sleep). */
let clockJump = 0;
let native: {
  ports: PortInfo[];
  error: string | null;
  sent: [string, number[], number][];
  posts: Message[];
};

function fakeHandler() {
  return {
    postMessage(message: Message): Promise<unknown> {
      native.posts.push(message);
      switch (message.type) {
        case 'hello':
          return Promise.resolve(native.error ? { error: native.error } : { ports: native.ports });
        case 'clock': {
          now += readAt[0];
          const host = now + OFFSET + clockJump;
          now += readAt[1];
          return Promise.resolve(host);
        }
        case 'send':
          native.sent.push(...message.items);
          return Promise.resolve(null);
        case 'clear':
          return Promise.resolve(null);
      }
    },
  };
}

const SHIM_GLOBALS = [
  '__dacapoMidi',
  'MIDIAccess',
  'MIDIPort',
  'MIDIInput',
  'MIDIOutput',
  'MIDIMessageEvent',
  'MIDIConnectionEvent',
] as const;

/** Loads the shim into a fresh page, as WKUserScript does at document start. */
function injectShim(): Bridge {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the shipped script, run as WebKit runs a user script
  const run = new Function(shimSource) as () => void;
  run();
  return (globalThis as unknown as { __dacapoMidi: Bridge }).__dacapoMidi;
}

let bridge: Bridge;

beforeEach(() => {
  now = 1000;
  readAt = [0, 0];
  clockJump = 0;
  native = { ports: [PIANO_IN, PIANO_OUT], error: null, sent: [], posts: [] };
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  Object.defineProperty(globalThis, 'webkit', {
    value: { messageHandlers: { dacapoMidi: fakeHandler() } },
    configurable: true,
  });
  bridge = injectShim();
});

/** Takes the shim out of the page again. */
function removeShim() {
  const g = globalThis as Record<string, unknown>;
  for (const name of SHIM_GLOBALS) delete g[name];
  delete (navigator as unknown as Record<string, unknown>).requestMIDIAccess;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  removeShim();
  delete (globalThis as Record<string, unknown>).webkit;
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const access = () => navigator.requestMIDIAccess({ sysex: false });

function received(id: string, bytes: number[], hostMs: number) {
  bridge.receive([[id, hostMs, bytes, hostMs]], hostMs);
}

describe('injection', () => {
  it('provides requestMIDIAccess and the Web MIDI classes', () => {
    expect(typeof navigator.requestMIDIAccess).toBe('function');
    expect(browserMidiAccess()).not.toBeNull();
    for (const name of SHIM_GLOBALS) expect(name in globalThis, name).toBe(true);
  });

  it('does nothing outside the app (no message handler)', () => {
    removeShim();
    delete (globalThis as Record<string, unknown>).webkit;
    injectShim();
    expect('requestMIDIAccess' in navigator).toBe(false);
    expect('__dacapoMidi' in globalThis).toBe(false);
  });
});

describe('MIDIAccess', () => {
  it('is one shared object, however often it is requested', async () => {
    const [a, b] = await Promise.all([access(), access()]);
    expect(a).toBe(b);
    expect(await access()).toBe(a);
    expect(native.posts.filter((m) => m.type === 'hello')).toHaveLength(1);
    const shared = shareMidiAccess(browserMidiAccess()!);
    expect(await shared()).toBe(a);
  });

  it('lists inputs and outputs as Maps of ports with their properties', async () => {
    const midi = await access();
    expect(midi.inputs).toBeInstanceOf(Map);
    expect(midi.outputs).toBeInstanceOf(Map);
    const input = midi.inputs.get('11')!;
    expect(input).toMatchObject({
      id: '11',
      name: 'MP11SE',
      manufacturer: 'Kawai',
      version: '1',
      type: 'input',
      state: 'connected',
      connection: 'closed',
    });
    expect(input).toBeInstanceOf(globalThis.MIDIInput);
    expect(midi.outputs.get('12')).toMatchObject({ type: 'output', state: 'connected' });
    expect(midi.sysexEnabled).toBe(false);
  });

  it('refuses SysEx', async () => {
    await expect(navigator.requestMIDIAccess({ sysex: true })).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
  });

  it('fails with NotSupportedError when CoreMIDI did not start, and can be asked again', async () => {
    native.error = 'CoreMIDI error -10830';
    await expect(access()).rejects.toMatchObject({ name: 'NotSupportedError' });
    native.error = null;
    await expect(access()).resolves.toBeDefined();
  });
});

describe('input', () => {
  it('opens implicitly when a midimessage listener is added, with a statechange', async () => {
    const midi = await access();
    const input = midi.inputs.get('11')!;
    const onAccess = vi.fn();
    const onPort = vi.fn();
    midi.addEventListener('statechange', onAccess);
    input.onstatechange = onPort;
    input.addEventListener('midimessage', () => undefined);
    expect(input.connection).toBe('open');
    expect(onAccess).toHaveBeenCalledTimes(1);
    expect(onPort).toHaveBeenCalledTimes(1);
    expect((onAccess.mock.calls[0]![0] as MIDIConnectionEvent).port).toBe(input);
  });

  it('opens implicitly through onmidimessage too', async () => {
    const input = (await access()).inputs.get('11')!;
    input.onmidimessage = () => undefined;
    expect(input.connection).toBe('open');
  });

  it('delivers messages only to open ports, with the bytes untouched', async () => {
    const input = (await access()).inputs.get('11')!;
    const events: MIDIMessageEvent[] = [];
    received('11', [0x90, 60, 80], now + OFFSET);
    input.addEventListener('midimessage', (e) => events.push(e));
    received('11', [0x90, 60, 0], now + OFFSET);
    received('99', [0x90, 61, 80], now + OFFSET);
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(globalThis.MIDIMessageEvent);
    // Note-on with velocity 0 stays exactly that; dacapo's parser reads it as a note-off.
    expect([...events[0]!.data!]).toEqual([0x90, 60, 0]);
  });

  it('stamps each message with its native timestamp on the page clock', async () => {
    const input = (await access()).inputs.get('11')!;
    const stamps: number[] = [];
    input.addEventListener('midimessage', (e) => stamps.push(e.timeStamp));
    // Delivered late (now is 1000), stamped when the source sent them.
    bridge.receive(
      [
        ['11', OFFSET + 900.25, [0x90, 60, 80], OFFSET + 990],
        ['11', OFFSET + 920.5, [0x80, 60, 0], OFFSET + 995],
      ],
      OFFSET + 999,
    );
    expect(stamps).toEqual([900.25, 920.5]);
  });
});

describe('ports come and go', () => {
  it('keeps an unplugged port listed as disconnected (pending if open), and reconnects it', async () => {
    const midi = await access();
    const input = midi.inputs.get('11')!;
    const events: [string, string, string][] = [];
    midi.addEventListener('statechange', (e) => {
      const p = e.port!;
      events.push([p.id, p.state, p.connection]);
    });
    input.addEventListener('midimessage', () => undefined);
    events.length = 0;

    bridge.ports([PIANO_OUT]);
    expect(midi.inputs.get('11')).toBe(input);
    expect(input.state).toBe('disconnected');
    expect(input.connection).toBe('pending');
    expect(events).toEqual([['11', 'disconnected', 'pending']]);

    bridge.ports([PIANO_IN, PIANO_OUT]);
    expect(input.state).toBe('connected');
    expect(input.connection).toBe('open');
    expect(events.at(-1)).toEqual(['11', 'connected', 'open']);
  });

  it('adds new ports with a statechange, and treats an offline port as disconnected', async () => {
    const midi = await access();
    const seen = vi.fn();
    midi.onstatechange = seen;
    bridge.ports([PIANO_IN, PIANO_OUT, port('21', 'input', 'Pedal box')]);
    expect(midi.inputs.get('21')?.state).toBe('connected');
    expect(seen).toHaveBeenCalledTimes(1);
    bridge.ports([PIANO_IN, PIANO_OUT, port('21', 'input', 'Pedal box', false)]);
    expect(midi.inputs.get('21')?.state).toBe('disconnected');
    expect(seen).toHaveBeenCalledTimes(2);
    // The same list again changes nothing.
    bridge.ports([PIANO_IN, PIANO_OUT, port('21', 'input', 'Pedal box', false)]);
    expect(seen).toHaveBeenCalledTimes(2);
  });
});

describe('output', () => {
  it('validates like Chromium', async () => {
    const output = (await access()).outputs.get('12')!;
    for (const bad of [[256, 0, 0], [-1], [0x90, 60.5, 1], [60, 100], [0x90, 60], [0x90, 0x80, 1]])
      expect(() => output.send(bad), JSON.stringify(bad)).toThrow(TypeError);
    expect(() => output.send([0xf0, 0x7e, 0x7f, 0xf7])).toThrow(
      expect.objectContaining({ name: 'InvalidAccessError' }),
    );
    bridge.ports([PIANO_IN]);
    expect(() => output.send([0x90, 60, 100])).toThrow(
      expect.objectContaining({ name: 'InvalidStateError' }),
    );
    await flush();
    expect(native.sent).toEqual([]);
  });

  it('splits complete messages, batches a turn’s sends, and maps timestamps to host time', async () => {
    const output = (await access()).outputs.get('12')!;
    native.posts.length = 0;
    output.send([0x90, 60, 100, 0x80, 60, 0]);
    output.send(new Uint8Array([0xb0, 64, 127]), now + 250);
    output.send([0xf8], now - 5);
    expect(output.connection).toBe('open');
    await flush();
    expect(native.posts.filter((m) => m.type === 'send')).toHaveLength(1);
    expect(native.sent).toEqual([
      ['12', [0x90, 60, 100], 0],
      ['12', [0x80, 60, 0], 0],
      // Future: CoreMIDI schedules it at the matching host time.
      ['12', [0xb0, 64, 127], now + 250 + OFFSET],
      // Past or zero: now.
      ['12', [0xf8], 0],
    ]);
  });

  it('clear() sends what is queued, then asks native to drop what is scheduled', async () => {
    const output = (await access()).outputs.get('12')!;
    native.posts.length = 0;
    output.send([0x90, 60, 100], now + 500);
    // Web MIDI's clear(); TypeScript's DOM types do not have it yet.
    (output as MIDIOutput & { clear: () => void }).clear();
    expect(native.posts.map((m) => m.type)).toEqual(['send', 'clear']);
  });
});

describe('clock', () => {
  it('knows the offset before access resolves', async () => {
    await access();
    expect(bridge.clock.samples).toBeGreaterThanOrEqual(25);
    expect(bridge.clock.offset).toBe(OFFSET);
    expect(bridge.clock.lo).toBeLessThanOrEqual(OFFSET);
    expect(bridge.clock.hi).toBeGreaterThanOrEqual(OFFSET);
  });

  it('narrows the offset by intersecting round trips', async () => {
    // Slow round trips (6 ms), the host clock read at their start: each bounds the offset only
    // to 6 ms plus a clock tick either side.
    readAt = [0, 6];
    await access();
    const { tick } = bridge.clock;
    expect(bridge.clock.hi - bridge.clock.lo).toBe(6 + 2 * tick);
    // One round trip read at its end bounds it from the other side: together, one tick either side.
    readAt = [6, 0];
    await bridge.sync(1);
    expect(bridge.clock.hi - bridge.clock.lo).toBe(2 * tick);
    expect(bridge.clock.lo).toBeLessThanOrEqual(OFFSET);
    expect(bridge.clock.hi).toBeGreaterThanOrEqual(OFFSET);
    expect(bridge.clock.offset).toBe(OFFSET);
    expect(bridge.clock.resets).toBe(0);
  });

  it('starts over when the clocks jump against each other', async () => {
    await access();
    clockJump = 40;
    await bridge.sync(1);
    expect(bridge.clock.resets).toBe(1);
    expect(bridge.clock.offset).toBe(OFFSET + 40);
    await bridge.sync(3);
    expect(bridge.clock.resets).toBe(1);
  });

  it('keeps measuring every 2 s', async () => {
    await access();
    const before = bridge.clock.samples;
    vi.advanceTimersByTime(4000);
    await flush();
    expect(bridge.clock.samples).toBe(before + 2);
  });
});

describe('dacapo on the shim', () => {
  it('input: pending → connected, hub events with native timestamps, hot-plugging', async () => {
    const hub = createInputHub();
    const midi = createWebMidiInput(shareMidiAccess(browserMidiAccess()!));
    const events: HubEvent[] = [];
    hub.onEvent((e) => events.push(e));
    const stop = hub.add(midi);
    expect(midi.getStatus()).toEqual({ state: 'pending' });
    await flush();
    await vi.waitFor(() =>
      expect(midi.getStatus()).toEqual({ state: 'connected', names: ['MP11SE'] }),
    );

    received('11', [0x90, 60, 80], OFFSET + 1234.5);
    received('11', [0xfe], OFFSET + 1240);
    received('11', [0xb0, 64, 127], OFFSET + 1250);
    received('11', [0x90, 60, 0], OFFSET + 1300);
    expect(events).toEqual([
      { type: 'on', midi: 60, velocity: 80, time: 1234.5 },
      { type: 'sustain', down: true, time: 1250 },
      { type: 'off', midi: 60, velocity: 0, time: 1300 },
    ]);

    received('11', [0x90, 64, 90], OFFSET + 1400);
    bridge.ports([PIANO_OUT]);
    expect(midi.getStatus()).toEqual({ state: 'no-device' });
    expect(hub.getState()).toMatchObject({ held: new Map(), sustain: false });
    bridge.ports([PIANO_IN, PIANO_OUT]);
    expect(midi.getStatus()).toEqual({ state: 'connected', names: ['MP11SE'] });
    stop();
  });

  it('input: unsupported when CoreMIDI did not start', async () => {
    native.error = 'CoreMIDI error -10830';
    const hub = createInputHub();
    const midi = createWebMidiInput(browserMidiAccess());
    const stop = hub.add(midi);
    await vi.waitFor(() => expect(midi.getStatus()).toEqual({ state: 'unsupported' }));
    stop();
  });

  it('output: picks the instrument named like the keyboard and plays a test note on time', async () => {
    const output = createMidiOutput({
      requestAccess: shareMidiAccess(browserMidiAccess()!),
      page: null,
      prefs: { read: () => null, write: () => undefined },
    });
    const stop = output.start();
    await vi.waitFor(() =>
      expect(output.getState().selected).toEqual({ id: '12', name: 'MP11SE' }),
    );
    const at = now;
    output.testNote();
    await flush();
    // The scheduler hands the note-off over within its look-ahead, with its own timestamp...
    now += 350;
    vi.advanceTimersByTime(100);
    await flush();
    const notes = native.sent.filter(([, bytes]) => (bytes[0]! & 0xe0) === 0x80);
    expect(notes[0]).toEqual(['12', [0x90, 60, 72], 0]);
    // ...which CoreMIDI gets on the host clock: 400 ms after the note-on.
    expect(notes[1]).toEqual(['12', [0x80, 60, 64], at + 400 + OFFSET]);
    stop();
  });
});

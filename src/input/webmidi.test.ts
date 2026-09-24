import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInputHub, type HubEvent, type InputHub } from './hub.ts';
import { createWebMidiInput, parseMidiMessage, type RequestMidiAccess } from './webmidi.ts';

describe('parseMidiMessage', () => {
  it('parses note-on on any channel', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({
      type: 'on',
      channel: 0,
      midi: 60,
      velocity: 100,
    });
    expect(parseMidiMessage([0x9f, 21, 1])).toEqual({
      type: 'on',
      channel: 15,
      midi: 21,
      velocity: 1,
    });
  });

  it('treats note-on with velocity 0 as note-off', () => {
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({
      type: 'off',
      channel: 0,
      midi: 60,
      velocity: 0,
    });
  });

  it('parses note-off with its release velocity', () => {
    expect(parseMidiMessage([0x83, 108, 64])).toEqual({
      type: 'off',
      channel: 3,
      midi: 108,
      velocity: 64,
    });
  });

  it('parses the sustain pedal with 64 as the threshold', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toEqual({ type: 'sustain', channel: 0, down: true });
    expect(parseMidiMessage([0xb0, 64, 64])).toMatchObject({ down: true });
    expect(parseMidiMessage([0xb0, 64, 63])).toMatchObject({ down: false });
    expect(parseMidiMessage([0xb1, 64, 0])).toEqual({ type: 'sustain', channel: 1, down: false });
  });

  it('parses "all notes off" and "all sound off" as a reset', () => {
    expect(parseMidiMessage([0xb0, 123, 0])).toEqual({ type: 'reset', channel: 0 });
    expect(parseMidiMessage([0xb0, 120, 0])).toEqual({ type: 'reset', channel: 0 });
  });

  it('ignores other controllers and channel messages', () => {
    expect(parseMidiMessage([0xb0, 1, 50])).toBeNull(); // modulation
    expect(parseMidiMessage([0xb0, 67, 127])).toBeNull(); // soft pedal
    expect(parseMidiMessage([0xa0, 60, 10])).toBeNull(); // poly aftertouch
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull(); // pitch bend
    expect(parseMidiMessage([0xc0, 5, 0])).toBeNull(); // program change (padded)
  });

  it('ignores system messages safely, whatever their length', () => {
    expect(parseMidiMessage([0xf8])).toBeNull(); // timing clock
    expect(parseMidiMessage([0xfe])).toBeNull(); // active sensing
    expect(parseMidiMessage([0xff])).toBeNull(); // reset
    expect(parseMidiMessage([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])).toBeNull(); // SysEx
    expect(parseMidiMessage([0xf2, 0x10, 0x20])).toBeNull(); // song position
  });

  it('ignores truncated, empty, missing and malformed data', () => {
    expect(parseMidiMessage(null)).toBeNull();
    expect(parseMidiMessage(undefined)).toBeNull();
    expect(parseMidiMessage([])).toBeNull();
    expect(parseMidiMessage([0x90, 60])).toBeNull();
    expect(parseMidiMessage([60, 100, 0])).toBeNull(); // running status: no status byte
    expect(parseMidiMessage([0x90, 0x80, 100])).toBeNull(); // data byte with the high bit set
    expect(parseMidiMessage(new Uint8Array([0x90, 64, 90]))).toMatchObject({ midi: 64 });
  });
});

// --- Fakes for the Web MIDI API ---

class FakeInput extends EventTarget {
  readonly type = 'input';
  state: MIDIPortDeviceState = 'connected';
  listeners = 0;
  opened = 0;

  readonly id: string;
  readonly name: string | null;

  constructor(id: string, name: string | null) {
    super();
    this.id = id;
    this.name = name;
  }

  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === 'midimessage' && listener) this.listeners++;
    super.addEventListener(type, listener);
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === 'midimessage' && listener) this.listeners--;
    super.removeEventListener(type, listener);
  }

  open() {
    this.opened++;
    return Promise.resolve(this);
  }

  send(bytes: number[], timeStamp = 1000) {
    const event = new Event('midimessage');
    Object.defineProperty(event, 'data', { value: new Uint8Array(bytes) });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    this.dispatchEvent(event);
  }
}

class FakeAccess {
  inputs = new Map<string, FakeInput>();
  onstatechange: ((event: Event) => void) | null = null;

  plug(input: FakeInput) {
    input.state = 'connected';
    this.inputs.set(input.id, input);
    this.onstatechange?.(new Event('statechange'));
  }

  unplug(input: FakeInput, keepInMap = true) {
    input.state = 'disconnected';
    if (!keepInMap) this.inputs.delete(input.id);
    this.onstatechange?.(new Event('statechange'));
  }
}

function deferredAccess() {
  const access = new FakeAccess();
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<MIDIAccess>((res, rej) => {
    resolve = () => res(access as unknown as MIDIAccess);
    reject = rej;
  });
  const request = vi.fn<RequestMidiAccess>(() => promise);
  return { access, request, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Every source is stopped after each test so the development guard starts clean.
const cleanups: (() => void)[] = [];

function track(hub: InputHub): InputHub {
  return {
    ...hub,
    add(source) {
      const stop = hub.add(source);
      cleanups.push(stop);
      return stop;
    },
  };
}

function hubWithMidi(request: RequestMidiAccess | null) {
  const hub = track(createInputHub());
  const midi = createWebMidiInput(request);
  const events: HubEvent[] = [];
  hub.onEvent((e) => events.push(e));
  return { hub, midi, events };
}

afterEach(() => {
  for (const stop of cleanups.splice(0)) stop();
  vi.restoreAllMocks();
});

describe('createWebMidiInput', () => {
  it('reports unsupported when Web MIDI is missing and does nothing on start', () => {
    const { hub, midi } = hubWithMidi(null);
    expect(midi.getStatus()).toEqual({ state: 'unsupported' });
    const stop = hub.add(midi);
    expect(midi.getStatus()).toEqual({ state: 'unsupported' });
    stop();
  });

  it('goes pending → connected with every input name, and requests access once', async () => {
    const { access, request, resolve } = deferredAccess();
    access.inputs.set('a', new FakeInput('a', 'MP11SE'));
    access.inputs.set('b', new FakeInput('b', ' Pedal box '));
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi);
    expect(midi.getStatus()).toEqual({ state: 'pending' });
    resolve();
    await flush();
    expect(midi.getStatus()).toEqual({ state: 'connected', names: ['MP11SE', 'Pedal box'] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports no-device when access is granted but nothing is plugged in', async () => {
    const { request, resolve } = deferredAccess();
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi);
    resolve();
    await flush();
    expect(midi.getStatus()).toEqual({ state: 'no-device' });
  });

  it('reports no-permission when access is refused, and retry asks again', async () => {
    const first = deferredAccess();
    const second = deferredAccess();
    const request = vi
      .fn<RequestMidiAccess>()
      .mockImplementationOnce(first.request)
      .mockImplementationOnce(second.request);
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi);
    first.reject(new DOMException('denied', 'NotAllowedError'));
    await flush();
    expect(midi.getStatus()).toEqual({ state: 'no-permission' });

    second.access.inputs.set('a', new FakeInput('a', 'MP11SE'));
    midi.retry();
    expect(midi.getStatus()).toEqual({ state: 'pending' });
    second.resolve();
    await flush();
    expect(midi.getStatus()).toEqual({ state: 'connected', names: ['MP11SE'] });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('reports unsupported for NotSupportedError', async () => {
    const { request, reject } = deferredAccess();
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi);
    reject(new DOMException('no platform MIDI', 'NotSupportedError'));
    await flush();
    expect(midi.getStatus()).toEqual({ state: 'unsupported' });
  });

  it('turns messages into hub events with the event timestamp, on every channel', async () => {
    const { access, request, resolve } = deferredAccess();
    const input = new FakeInput('a', 'MP11SE');
    access.inputs.set('a', input);
    const { hub, midi, events } = hubWithMidi(request);
    hub.add(midi);
    resolve();
    await flush();

    input.send([0x90, 60, 80], 1234.5);
    input.send([0x91, 64, 90], 1240);
    input.send([0xf8], 1241);
    input.send([0xfe], 1242);
    input.send([0x90, 60, 0], 1300);
    expect(events).toEqual([
      { type: 'on', midi: 60, velocity: 80, time: 1234.5 },
      { type: 'on', midi: 64, velocity: 90, time: 1240 },
      { type: 'off', midi: 60, velocity: 0, time: 1300 },
    ]);
    expect([...hub.getState().held]).toEqual([[64, 90]]);
  });

  it('tracks the sustain pedal', async () => {
    const { access, request, resolve } = deferredAccess();
    const input = new FakeInput('a', 'MP11SE');
    access.inputs.set('a', input);
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi);
    resolve();
    await flush();

    input.send([0xb0, 64, 127]);
    input.send([0x90, 60, 80]);
    input.send([0x80, 60, 0]);
    expect(hub.getState()).toMatchObject({ sustain: true, sustained: new Set([60]) });
    input.send([0xb0, 64, 0]);
    expect(hub.getState()).toMatchObject({ sustain: false, sustained: new Set() });
  });

  it('follows hot-plugging and releases the keys of an unplugged device', async () => {
    const { access, request, resolve } = deferredAccess();
    const piano = new FakeInput('a', 'MP11SE');
    const { hub, midi, events } = hubWithMidi(request);
    hub.add(midi);
    resolve();
    await flush();
    expect(midi.getStatus()).toEqual({ state: 'no-device' });

    access.plug(piano);
    expect(midi.getStatus()).toEqual({ state: 'connected', names: ['MP11SE'] });
    expect(piano.listeners).toBe(1);
    piano.send([0x90, 60, 80]);
    piano.send([0xb0, 64, 127]);

    access.unplug(piano);
    expect(midi.getStatus()).toEqual({ state: 'no-device' });
    expect(piano.listeners).toBe(0);
    expect(hub.getState()).toMatchObject({ held: new Map(), sustain: false });
    expect(events.at(-2)).toMatchObject({ type: 'off', midi: 60 });
    expect(events.at(-1)).toMatchObject({ type: 'sustain', down: false });

    // Plugged back in (Chrome keeps the same port object): exactly one listener again.
    access.plug(piano);
    expect(piano.listeners).toBe(1);
    access.unplug(piano, false);
    expect(piano.listeners).toBe(0);
  });

  it('keeps the other device’s keys when one of two devices is unplugged', async () => {
    const { access, request, resolve } = deferredAccess();
    const a = new FakeInput('a', 'MP11SE');
    const b = new FakeInput('b', 'Mini keys');
    access.inputs.set('a', a);
    access.inputs.set('b', b);
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi);
    resolve();
    await flush();

    a.send([0x90, 60, 80]);
    b.send([0x90, 60, 70]);
    b.send([0x90, 62, 70]);
    access.unplug(b);
    expect([...hub.getState().held.keys()]).toEqual([60]);
    expect(midi.getStatus()).toEqual({ state: 'connected', names: ['MP11SE'] });
  });
});

describe('StrictMode-style remounts', () => {
  // React StrictMode runs effect → cleanup → effect. The provider adds the MIDI source in an
  // effect, so these sequences are exactly what happens on every mount in development.

  it('start → stop → start before access resolves: one request, one listener per input', async () => {
    const { access, request, resolve } = deferredAccess();
    const a = new FakeInput('a', 'MP11SE');
    const b = new FakeInput('b', 'Pedal box');
    access.inputs.set('a', a);
    access.inputs.set('b', b);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { hub, midi, events } = hubWithMidi(request);

    hub.add(midi)();
    hub.add(midi);
    resolve();
    await flush();

    expect(request).toHaveBeenCalledTimes(1);
    expect(a.listeners).toBe(1);
    expect(b.listeners).toBe(1);
    a.send([0x90, 60, 80]);
    expect(events).toHaveLength(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it('start → stop → start after access resolved: listeners are moved, not duplicated', async () => {
    const { access, request, resolve } = deferredAccess();
    const a = new FakeInput('a', 'MP11SE');
    access.inputs.set('a', a);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { hub, midi, events } = hubWithMidi(request);

    const stop = hub.add(midi);
    resolve();
    await flush();
    expect(a.listeners).toBe(1);

    stop();
    expect(a.listeners).toBe(0);
    expect(access.onstatechange).toBeNull();

    for (let i = 0; i < 3; i++) {
      hub.add(midi)();
      const again = hub.add(midi);
      await flush();
      expect(a.listeners).toBe(1);
      expect(() => hub.add(midi)).toThrow(/already added/);
      expect(a.listeners).toBe(1);
      again();
    }
    hub.add(midi);
    await flush();
    a.send([0x90, 60, 80]);
    expect(events).toHaveLength(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it('a stopped source ignores a late access grant and late statechange events', async () => {
    const { access, request, resolve } = deferredAccess();
    const a = new FakeInput('a', 'MP11SE');
    access.inputs.set('a', a);
    const { hub, midi } = hubWithMidi(request);
    hub.add(midi)();
    resolve();
    await flush();
    expect(a.listeners).toBe(0);
    access.plug(new FakeInput('b', 'Late'));
    expect(a.listeners).toBe(0);
  });

  it('the development guard reports two live listeners on the same port', async () => {
    const { access, request, resolve } = deferredAccess();
    access.inputs.set('a', new FakeInput('a', 'MP11SE'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Two hubs, each with its own source over the same MIDIAccess — the bug the guard catches.
    track(createInputHub()).add(createWebMidiInput(request));
    track(createInputHub()).add(createWebMidiInput(request));
    resolve();
    await flush();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0]?.[0])).toContain('second listener');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createInputHub } from '../input/hub.ts';
import { createWebMidiInput, shareMidiAccess } from '../input/webmidi.ts';
import { createEchoGuard } from './echo.ts';
import {
  createMidiOutput,
  OUTPUT_PREF,
  readChoice,
  resolveOutput,
  type InterruptReason,
  type MidiOutputOptions,
} from './output.ts';
import { resetAllChannels } from './messages.ts';
import { fakeClock, FakePort } from './testing.ts';

// --- Fakes for the Web MIDI API (outputs, and inputs for "auto") ---

class FakeOutput extends FakePort {
  readonly type = 'output';
  state: MIDIPortDeviceState = 'connected';
  opened = 0;
  readonly id: string;
  readonly name: string | null;

  constructor(id: string, name: string | null) {
    super();
    this.id = id;
    this.name = name;
  }

  open() {
    this.opened++;
    return Promise.resolve(this);
  }
}

class FakeInput extends EventTarget {
  readonly type = 'input';
  state: MIDIPortDeviceState = 'connected';
  readonly id: string;
  readonly name: string | null;

  constructor(id: string, name: string | null) {
    super();
    this.id = id;
    this.name = name;
  }

  open() {
    return Promise.resolve(this);
  }

  send(bytes: number[], timeStamp: number) {
    const event = new Event('midimessage');
    Object.defineProperty(event, 'data', { value: new Uint8Array(bytes) });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    this.dispatchEvent(event);
  }
}

class FakeAccess extends EventTarget {
  inputs = new Map<string, FakeInput>();
  outputs = new Map<string, FakeOutput>();
  stateListeners = 0;

  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === 'statechange' && listener) this.stateListeners++;
    super.addEventListener(type, listener);
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === 'statechange' && listener) this.stateListeners--;
    super.removeEventListener(type, listener);
  }

  change() {
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakePage {
  document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  window = new EventTarget();

  hide() {
    this.document.visibilityState = 'hidden';
    this.document.dispatchEvent(new Event('visibilitychange'));
  }

  show() {
    this.document.visibilityState = 'visible';
    this.document.dispatchEvent(new Event('visibilitychange'));
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(stored: string | null = null, options: Partial<MidiOutputOptions> = {}) {
  const access = new FakeAccess();
  const clock = fakeClock(1000);
  const page = new FakePage();
  const prefs = new Map<string, string>();
  if (stored !== null) prefs.set(OUTPUT_PREF, stored);
  const request = vi.fn(() => Promise.resolve(access as unknown as MIDIAccess));
  const output = createMidiOutput({
    requestAccess: request,
    clock,
    page,
    prefs: {
      read: (key) => prefs.get(key) ?? null,
      write: (key, value) => {
        if (value === null) prefs.delete(key);
        else prefs.set(key, value);
      },
    },
    ...options,
  });
  const interrupts: InterruptReason[] = [];
  output.onInterrupt((reason) => interrupts.push(reason));
  return { access, clock, page, prefs, request, output, interrupts };
}

function mp11(access: FakeAccess) {
  const input = new FakeInput('in-1', 'MP11SE');
  const out = new FakeOutput('out-1', 'MP11SE');
  access.inputs.set(input.id, input);
  access.outputs.set(out.id, out);
  return { input, out };
}

describe('resolveOutput', () => {
  const ports = [
    { id: 'a', name: 'IAC Bus 1' },
    { id: 'b', name: 'MP11SE' },
  ];

  it('auto: the output named like a connected input, else none', () => {
    expect(resolveOutput(ports, ['MP11SE'], { kind: 'auto' })).toEqual(ports[1]);
    expect(resolveOutput(ports, ['mp11se'], { kind: 'auto' })).toEqual(ports[1]);
    expect(resolveOutput(ports, ['Mini keys'], { kind: 'auto' })).toBeNull();
    expect(resolveOutput(ports, [], { kind: 'auto' })).toBeNull();
    expect(resolveOutput([{ id: 'x', name: '' }], [''], { kind: 'auto' })).toBeNull();
  });

  it('a chosen output by name, or none', () => {
    expect(resolveOutput(ports, [], { kind: 'port', name: 'IAC Bus 1' })).toEqual(ports[0]);
    expect(resolveOutput(ports, [], { kind: 'port', name: 'Gone' })).toBeNull();
    expect(resolveOutput(ports, ['MP11SE'], { kind: 'none' })).toBeNull();
  });

  it('reads the stored choice', () => {
    expect(readChoice(null)).toEqual({ kind: 'auto' });
    expect(readChoice('none')).toEqual({ kind: 'none' });
    expect(readChoice('port:MP11SE')).toEqual({ kind: 'port', name: 'MP11SE' });
    expect(readChoice('garbage')).toEqual({ kind: 'auto' });
  });
});

describe('createMidiOutput', () => {
  it('picks the output of the connected keyboard by default and opens it', async () => {
    const { access, output } = setup();
    const { out } = mp11(access);
    access.outputs.set('iac', new FakeOutput('iac', 'IAC Bus 1'));
    output.start();
    await flush();
    expect(output.getState()).toEqual({
      ports: [
        { id: 'out-1', name: 'MP11SE' },
        { id: 'iac', name: 'IAC Bus 1' },
      ],
      choice: { kind: 'auto' },
      selected: { id: 'out-1', name: 'MP11SE' },
    });
    expect(out.opened).toBe(1);
  });

  it('remembers a choice by name, including none', async () => {
    const { access, output, prefs } = setup();
    mp11(access);
    access.outputs.set('iac', new FakeOutput('iac', 'IAC Bus 1'));
    output.start();
    await flush();
    output.choose({ kind: 'port', name: 'IAC Bus 1' });
    expect(output.getState().selected).toEqual({ id: 'iac', name: 'IAC Bus 1' });
    expect(prefs.get(OUTPUT_PREF)).toBe('port:IAC Bus 1');
    output.choose({ kind: 'none' });
    expect(output.getState().selected).toBeNull();
    expect(prefs.get(OUTPUT_PREF)).toBe('none');
    output.choose({ kind: 'auto' });
    expect(prefs.has(OUTPUT_PREF)).toBe(false);
    expect(output.getState().selected?.name).toBe('MP11SE');
  });

  it('starts from the stored choice', async () => {
    const { access, output } = setup('none');
    mp11(access);
    output.start();
    await flush();
    expect(output.getState()).toMatchObject({ choice: { kind: 'none' }, selected: null });
  });

  it('follows hot-plugging: loss silences and interrupts, return reconnects', async () => {
    const { access, output, interrupts, clock } = setup();
    const { input, out } = mp11(access);
    output.start();
    await flush();
    const changes = vi.fn();
    output.subscribe(changes);
    output.scheduler.play({ midi: 60, velocity: 72, on: clock.now(), off: clock.now() + 1000 });
    expect(out.log()).toEqual(['on 60 v72@1000']);

    out.state = 'disconnected';
    input.state = 'disconnected';
    access.change();
    expect(output.getState().selected).toBeNull();
    expect(interrupts).toEqual(['route']);
    // Silenced before it was let go (a real, unplugged port would throw; that is caught).
    expect(out.log().slice(1, 2)).toEqual(['off 60']);
    expect(out.sent).toHaveLength(1 + 1 + 48);
    expect(output.scheduler.sounding()).toEqual([]);

    out.state = 'connected';
    input.state = 'connected';
    access.change();
    expect(output.getState().selected?.id).toBe('out-1');
    expect(interrupts).toEqual(['route']);
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it('a route change panics on the old output only', async () => {
    const { access, output, clock } = setup();
    const { out } = mp11(access);
    const iac = new FakeOutput('iac', 'IAC Bus 1');
    access.outputs.set('iac', iac);
    output.start();
    await flush();
    output.scheduler.play({ midi: 64, velocity: 72, on: clock.now(), off: clock.now() + 1000 });
    output.choose({ kind: 'port', name: 'IAC Bus 1' });
    expect(out.log()[1]).toBe('off 64');
    expect(out.sent.slice(2)).toEqual(
      resetAllChannels().map((data) => ({ data, time: undefined })),
    );
    expect(iac.sent).toEqual([]);
    output.testNote();
    expect(iac.log()).toEqual(['on 60 v72@1000']);
    clock.advance(500);
    expect(iac.log()).toEqual(['on 60 v72@1000', 'off 60@1400']);
  });

  it('silences when the page is hidden or left', async () => {
    const { access, output, interrupts, page, clock } = setup();
    const { out } = mp11(access);
    output.start();
    await flush();
    output.scheduler.play({ midi: 60, velocity: 72, on: clock.now(), off: clock.now() + 5000 });
    page.hide();
    expect(interrupts).toEqual(['hidden']);
    expect(out.log()[1]).toBe('off 60');
    page.show();
    expect(interrupts).toEqual(['hidden']);
    page.window.dispatchEvent(new Event('pagehide'));
    expect(interrupts).toEqual(['hidden', 'hidden']);
    // Already silent: the second panic sends nothing.
    expect(out.sent).toHaveLength(1 + 1 + 48);
    output.testNote();
    page.window.dispatchEvent(new Event('pagehide'));
    expect(out.log().slice(-49, -48)).toEqual(['off 60']);
  });

  it('the test note needs an output', async () => {
    const { access, output } = setup('none');
    const { out } = mp11(access);
    output.start();
    await flush();
    output.testNote();
    expect(out.sent).toEqual([]);
  });

  it('StrictMode: start → stop → start keeps one statechange listener and one set of page listeners', async () => {
    const { access, output, page, interrupts } = setup();
    mp11(access);
    output.start()();
    const stop = output.start();
    await flush();
    expect(access.stateListeners).toBe(1);
    expect(output.getState().selected?.name).toBe('MP11SE');
    page.hide();
    expect(interrupts.filter((r) => r === 'hidden')).toHaveLength(1);
    stop();
    expect(access.stateListeners).toBe(0);
    expect(output.getState().selected).toBeNull();
    page.hide();
    expect(interrupts.filter((r) => r === 'hidden')).toHaveLength(1);
  });

  it('shares the input’s access: one request, and a retry granted to the input reaches the output', async () => {
    const access = new FakeAccess();
    mp11(access);
    const request = vi
      .fn<() => Promise<MIDIAccess>>()
      .mockImplementationOnce(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
      .mockImplementation(() => Promise.resolve(access as unknown as MIDIAccess));
    const shared = shareMidiAccess(request);
    const hub = createInputHub();
    const midi = createWebMidiInput(shared);
    const output = createMidiOutput({ requestAccess: shared, page: null, clock: fakeClock() });
    hub.add(midi);
    output.start();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(midi.getStatus()).toEqual({ state: 'no-permission' });
    expect(output.getState().selected).toBeNull();

    midi.retry();
    await flush();
    expect(midi.getStatus().state).toBe('connected');
    output.retry();
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(output.getState().selected?.name).toBe('MP11SE');
  });
});

describe('echo guard', () => {
  it('matches a note we sent to the same device within 30 ms, once', () => {
    const guard = createEchoGuard();
    guard.sent('MP11SE', 60, 1000);
    expect(guard.isEcho('Other', 60, 1005)).toBe(false);
    expect(guard.isEcho('MP11SE', 62, 1005)).toBe(false);
    expect(guard.isEcho('MP11SE', 60, 1031)).toBe(false);
    expect(guard.isEcho('MP11SE', 60, 1012)).toBe(true);
    expect(guard.isEcho('MP11SE', 60, 1013)).toBe(false); // used up
    guard.sent('MP11SE', 64, 2000); // sent ahead: the echo may be stamped a little earlier
    expect(guard.isEcho('MP11SE', 64, 1990)).toBe(true);
    expect(guard.isEcho('', 64, 2000)).toBe(false);
  });

  it('end to end: our own note coming back on the input is not taken for a key press', async () => {
    const access = new FakeAccess();
    const { input, out } = mp11(access);
    const clock = fakeClock(1000);
    const guard = createEchoGuard();
    const shared = shareMidiAccess(() => Promise.resolve(access as unknown as MIDIAccess));
    const hub = createInputHub();
    const presses: number[] = [];
    hub.onEvent((e) => {
      if (e.type === 'on') presses.push(e.midi);
    });
    hub.add(createWebMidiInput(shared, guard.isEcho));
    const output = createMidiOutput({ requestAccess: shared, guard, clock, page: null });
    output.start();
    await flush();

    output.testNote();
    expect(out.log()).toEqual(['on 60 v72@1000']);
    input.send([0x90, 60, 72], 1004); // the echo
    input.send([0x90, 60, 90], 1200); // the player, later
    input.send([0x90, 62, 90], 1001); // another key at the same moment
    expect(presses).toEqual([60, 62]);
    expect(hub.getState().held.get(60)).toBe(90);
  });
});

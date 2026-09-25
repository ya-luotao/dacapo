// Web MIDI for WebKit, backed by CoreMIDI (MIDI/MIDIBridge.swift). Injected at document start in
// the page's world, before dacapo's code runs. It provides the subset dacapo uses:
// navigator.requestMIDIAccess({ sysex: false }), MIDIAccess.inputs/outputs (maplike, ports stay
// listed as "disconnected" when unplugged), statechange on the access and the port, midimessage
// with `data` and a `timeStamp` on the performance.now() timeline, MIDIOutput.send(data,
// timestamp) and clear(). One MIDIAccess is shared by every call.
//
// Clock: CoreMIDI stamps messages in mach host time. The page's performance.now() runs on the
// same monotonic clock with a fixed origin, so page = host - offset. The offset is measured by
// round trips: native reads the host time somewhere between two performance.now() readings, so
// every round trip bounds the offset from both sides; the bounds of all round trips are
// intersected. An empty intersection (the clocks moved against each other, e.g. across sleep)
// starts over from the latest round trip.
(() => {
  'use strict';
  const handler = globalThis.webkit?.messageHandlers?.dacapoMidi;
  if (!handler || 'requestMIDIAccess' in navigator) return;
  const post = (message) => handler.postMessage(message);

  // ---- Clock ------------------------------------------------------------------------------

  /** Smallest step of performance.now() here (WebKit coarsens it). */
  function measureTick() {
    let last = performance.now();
    let min = Infinity;
    for (let i = 0, seen = 0; i < 100000 && seen < 50; i++) {
      const now = performance.now();
      if (now > last) {
        min = Math.min(min, now - last);
        last = now;
        seen++;
      }
    }
    return Number.isFinite(min) ? min : 1;
  }

  const clock = {
    tick: measureTick(),
    lo: -Infinity,
    hi: Infinity,
    offset: NaN,
    samples: 0,
    resets: 0,
    minRtt: Infinity,
  };

  async function syncOnce() {
    const p0 = performance.now();
    const host = await post({ type: 'clock' });
    const p1 = performance.now();
    // host was read at a page time t with p0 - tick < t < p1 + tick.
    const lo = host - p1 - clock.tick;
    const hi = host - p0 + clock.tick;
    const nextLo = Math.max(clock.lo, lo);
    const nextHi = Math.min(clock.hi, hi);
    if (nextLo > nextHi) {
      clock.lo = lo;
      clock.hi = hi;
      clock.resets++;
    } else {
      clock.lo = nextLo;
      clock.hi = nextHi;
    }
    clock.offset = (clock.lo + clock.hi) / 2;
    clock.samples++;
    clock.minRtt = Math.min(clock.minRtt, p1 - p0);
  }

  async function sync(rounds) {
    for (let i = 0; i < rounds; i++) await syncOnce();
  }

  const toPage = (hostMs) =>
    Number.isFinite(clock.offset) ? hostMs - clock.offset : performance.now();
  const toHost = (pageMs) => pageMs + clock.offset;

  // ---- Events -----------------------------------------------------------------------------

  class MIDIMessageEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.data = init.data ?? new Uint8Array(0);
      // Event.timeStamp is the construction time; Web MIDI's is when the message arrived.
      if (init.timeStamp !== undefined)
        Object.defineProperty(this, 'timeStamp', { value: init.timeStamp, enumerable: true });
    }
  }

  class MIDIConnectionEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.port = init.port ?? null;
    }
  }

  function handlerProperty(target, type) {
    let current = null;
    Object.defineProperty(target, `on${type}`, {
      get: () => current,
      set: (fn) => {
        if (current) target.removeEventListener(type, current);
        current = typeof fn === 'function' ? fn : null;
        if (current) target.addEventListener(type, current);
      },
    });
  }

  // ---- Ports ------------------------------------------------------------------------------

  let access = null;

  class MIDIPort extends EventTarget {
    #info;
    #state;
    #connection = 'closed';
    constructor(info) {
      super();
      this.#info = info;
      this.#state = info.online ? 'connected' : 'disconnected';
      handlerProperty(this, 'statechange');
    }
    get id() {
      return this.#info.id;
    }
    get name() {
      return this.#info.name;
    }
    get manufacturer() {
      return this.#info.manufacturer;
    }
    get version() {
      return this.#info.version;
    }
    get type() {
      return this.#info.type;
    }
    get state() {
      return this.#state;
    }
    get connection() {
      return this.#connection;
    }
    open() {
      if (this.#connection !== 'open' && this.#state === 'connected') this._setConnection('open');
      return Promise.resolve(this);
    }
    close() {
      if (this.#connection !== 'closed') this._setConnection('closed');
      return Promise.resolve(this);
    }
    _setConnection(connection) {
      this.#connection = connection;
      notify(this);
    }
    /** From the endpoint list; returns whether anything changed. */
    _update(info) {
      const state = info && info.online ? 'connected' : 'disconnected';
      if (info) this.#info = info;
      if (state === this.#state) return false;
      this.#state = state;
      if (state === 'disconnected')
        this.#connection = this.#connection === 'closed' ? 'closed' : 'pending';
      else if (this.#connection === 'pending') this.#connection = 'open';
      return true;
    }
  }

  class MIDIInput extends MIDIPort {
    constructor(info) {
      super(info);
      handlerProperty(this, 'midimessage');
    }
    addEventListener(type, listener, options) {
      super.addEventListener(type, listener, options);
      // Listening opens the port implicitly, as in Web MIDI.
      if (type === 'midimessage') void this.open();
    }
  }

  const outgoing = [];
  let flushQueued = false;

  function flushOutgoing() {
    flushQueued = false;
    if (outgoing.length === 0) return;
    void post({ type: 'send', items: outgoing.splice(0) });
  }

  const LENGTHS = { 0x80: 3, 0x90: 3, 0xa0: 3, 0xb0: 3, 0xc0: 2, 0xd0: 2, 0xe0: 3 };
  const SYSTEM_LENGTHS = {
    0xf1: 2,
    0xf2: 3,
    0xf3: 2,
    0xf6: 1,
    0xf8: 1,
    0xfa: 1,
    0xfb: 1,
    0xfc: 1,
    0xfe: 1,
    0xff: 1,
  };

  /** Splits `data` into complete messages; throws like Chromium for anything else. */
  function messagesOf(data) {
    const bytes = Array.from(data, (b) => {
      if (!Number.isInteger(b) || b < 0 || b > 255) throw new TypeError('MIDI data must be bytes');
      return b;
    });
    const out = [];
    for (let i = 0; i < bytes.length;) {
      const status = bytes[i];
      if (status === 0xf0) throw new DOMException('SysEx is not allowed', 'InvalidAccessError');
      const length = status >= 0xf0 ? SYSTEM_LENGTHS[status] : LENGTHS[status & 0xf0];
      if (!length || i + length > bytes.length) throw new TypeError('Invalid MIDI message');
      const message = bytes.slice(i, i + length);
      if (message.slice(1).some((b) => b > 0x7f)) throw new TypeError('Invalid MIDI message');
      out.push(message);
      i += length;
    }
    return out;
  }

  class MIDIOutput extends MIDIPort {
    send(data, timestamp = 0) {
      if (this.state !== 'connected')
        throw new DOMException('Port is disconnected', 'InvalidStateError');
      const messages = messagesOf(data);
      if (this.connection !== 'open') void this.open();
      // Past or zero: now. Future: CoreMIDI schedules it at the matching host time.
      const at =
        timestamp > performance.now() && Number.isFinite(clock.offset) ? toHost(timestamp) : 0;
      for (const message of messages) outgoing.push([this.id, message, at]);
      if (!flushQueued) {
        flushQueued = true;
        queueMicrotask(flushOutgoing);
      }
    }
    clear() {
      flushOutgoing();
      void post({ type: 'clear', id: this.id });
    }
  }

  function notify(port) {
    const init = { port };
    port.dispatchEvent(new MIDIConnectionEvent('statechange', init));
    access?.dispatchEvent(new MIDIConnectionEvent('statechange', init));
  }

  class MIDIAccess extends EventTarget {
    constructor() {
      super();
      this.inputs = new Map();
      this.outputs = new Map();
      this.sysexEnabled = false;
      handlerProperty(this, 'statechange');
    }
  }

  function applyPorts(list, announce) {
    const seen = new Set();
    const changed = [];
    for (const info of list) {
      const map = info.type === 'input' ? access.inputs : access.outputs;
      seen.add(`${info.type}:${info.id}`);
      const port = map.get(info.id);
      if (!port) {
        const created = info.type === 'input' ? new MIDIInput(info) : new MIDIOutput(info);
        map.set(info.id, created);
        changed.push(created);
      } else if (port._update(info)) changed.push(port);
    }
    for (const map of [access.inputs, access.outputs]) {
      for (const port of map.values()) {
        if (!seen.has(`${port.type}:${port.id}`) && port._update(null)) changed.push(port);
      }
    }
    if (announce) for (const port of changed) notify(port);
  }

  // ---- Native → page ----------------------------------------------------------------------

  const trace = { on: false, events: [] };

  function receive(batch, flushedHostMs) {
    if (!access) return;
    const arrived = performance.now();
    for (const [id, stampMs, bytes, receivedMs] of batch) {
      const port = access.inputs.get(id);
      if (!port || port.connection !== 'open') continue;
      const timeStamp = toPage(stampMs);
      const dispatched = performance.now();
      port.dispatchEvent(
        new MIDIMessageEvent('midimessage', { data: new Uint8Array(bytes), timeStamp }),
      );
      if (trace.on)
        trace.events.push({
          id,
          bytes,
          stamp: timeStamp,
          received: toPage(receivedMs),
          flushed: toPage(flushedHostMs),
          arrived,
          dispatched,
        });
    }
  }

  // ---- Entry point ------------------------------------------------------------------------

  let pending = null;

  function requestMIDIAccess(options = {}) {
    if (options && options.sysex)
      return Promise.reject(new DOMException('SysEx is not available', 'NotAllowedError'));
    pending ??= (async () => {
      const hello = await post({ type: 'hello' });
      if (!hello || hello.error)
        throw new DOMException(hello?.error ?? 'MIDI is unavailable', 'NotSupportedError');
      await sync(25);
      access = new MIDIAccess();
      applyPorts(hello.ports, false);
      // Keep measuring: cheap, and it notices a clock jump (sleep) within seconds.
      setInterval(() => void syncOnce().catch(() => undefined), 2000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void sync(10).catch(() => undefined);
      });
      return access;
    })().catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  }

  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: requestMIDIAccess,
    configurable: true,
    enumerable: true,
    writable: true,
  });
  for (const [name, value] of Object.entries({
    MIDIAccess,
    MIDIPort,
    MIDIInput,
    MIDIOutput,
    MIDIMessageEvent,
    MIDIConnectionEvent,
  }))
    if (!(name in globalThis))
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

  Object.defineProperty(globalThis, '__dacapoMidi', {
    configurable: true,
    value: Object.freeze({
      receive,
      ports: (list) => access && applyPorts(list, true),
      clock,
      sync,
      trace,
      toPage,
      toHost,
    }),
  });
})();

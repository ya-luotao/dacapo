import { describe, expect, it } from 'vitest';
import { createInputHub, type HubEvent } from './hub.ts';
import type { Emit, InputEvent, NoteInput } from './types.ts';

function fakeSource(id: string) {
  let emit: Emit | null = null;
  let starts = 0;
  let stops = 0;
  const source: NoteInput = {
    id,
    start(next) {
      starts++;
      emit = next;
      return () => {
        stops++;
        emit = null;
      };
    },
  };
  return {
    source,
    send: (event: InputEvent, port?: string) => emit?.(event, port),
    on: (midi: number, velocity = 80, port?: string) =>
      emit?.({ type: 'on', midi, velocity, time: 0 }, port),
    off: (midi: number, port?: string) => emit?.({ type: 'off', midi, velocity: 0, time: 0 }, port),
    pedal: (down: boolean, port?: string) => emit?.({ type: 'sustain', down, time: 0 }, port),
    counts: () => ({ starts, stops }),
    get emit() {
      return emit;
    },
  };
}

function setup() {
  const hub = createInputHub();
  const events: HubEvent[] = [];
  hub.onEvent((e) => events.push(e));
  const a = fakeSource('a');
  const b = fakeSource('b');
  const stopA = hub.add(a.source);
  const stopB = hub.add(b.source);
  const held = () => [...hub.getState().held.keys()];
  const summary = () =>
    events.map((e) => (e.type === 'sustain' ? `pedal:${e.down}` : `${e.type}:${e.midi}`));
  return { hub, a, b, stopA, stopB, events, held, summary };
}

describe('createInputHub', () => {
  it('starts with an empty, stable state', () => {
    const hub = createInputHub();
    const s = hub.getState();
    expect(s).toEqual({ held: new Map(), sustained: new Set(), sustain: false, lastChord: [] });
    expect(hub.getState()).toBe(s);
  });

  it('merges sources: a key is held while any source holds it', () => {
    const { a, b, held, summary } = setup();
    a.on(60);
    b.on(60);
    b.on(64);
    expect(held()).toEqual([60, 64]);
    a.off(60);
    expect(held()).toEqual([60, 64]);
    b.off(60);
    expect(held()).toEqual([64]);
    expect(summary()).toEqual(['on:60', 'on:64', 'off:60']);
  });

  it('keeps ports of one source apart', () => {
    const { a, held } = setup();
    a.on(60, 80, 'dev1');
    a.on(60, 80, 'dev2');
    a.off(60, 'dev1');
    expect(held()).toEqual([60]);
    a.send({ type: 'reset', time: 0 }, 'dev2');
    expect(held()).toEqual([]);
  });

  it('ignores repeated note-ons, stray note-offs and non-MIDI numbers', () => {
    const { a, held, summary } = setup();
    a.on(60);
    a.on(60);
    a.off(61);
    a.on(-1);
    a.on(128);
    a.on(60.5);
    expect(held()).toEqual([60]);
    expect(summary()).toEqual(['on:60']);
  });

  it('records velocity and keeps held keys in press order', () => {
    const { hub, a } = setup();
    a.on(67, 30);
    a.on(60, 127);
    expect([...hub.getState().held]).toEqual([
      [67, 30],
      [60, 127],
    ]);
  });

  it('remembers the last chord sorted low to high, after release too', () => {
    const { hub, a } = setup();
    a.on(67);
    a.on(60);
    a.on(64);
    expect(hub.getState().lastChord).toEqual([60, 64, 67]);
    a.off(64);
    a.off(60);
    a.off(67);
    expect(hub.getState().lastChord).toEqual([60, 64, 67]);
    a.on(72);
    expect(hub.getState().lastChord).toEqual([72]);
  });

  it('tracks sustain: released keys keep sounding until the pedal is up', () => {
    const { hub, a, b, summary } = setup();
    a.pedal(true);
    b.on(60);
    b.off(60);
    expect(hub.getState()).toMatchObject({ sustain: true, sustained: new Set([60]) });
    b.on(60);
    expect(hub.getState().sustained.has(60)).toBe(false);
    b.off(60);
    a.pedal(false);
    expect(hub.getState()).toMatchObject({ sustain: false, sustained: new Set() });
    expect(summary()).toEqual(['pedal:true', 'on:60', 'off:60', 'on:60', 'off:60', 'pedal:false']);
  });

  it('holds the pedal while any source holds it and only reports real changes', () => {
    const { hub, a, b, summary } = setup();
    a.pedal(true);
    b.pedal(true);
    a.pedal(true);
    a.pedal(false);
    expect(hub.getState().sustain).toBe(true);
    b.pedal(false);
    expect(hub.getState().sustain).toBe(false);
    b.pedal(false);
    expect(summary()).toEqual(['pedal:true', 'pedal:false']);
  });

  it('a reset releases only that port’s keys and pedal', () => {
    const { hub, a, b, held } = setup();
    a.on(60);
    a.pedal(true);
    b.on(62);
    a.send({ type: 'reset', time: 5 });
    expect(held()).toEqual([62]);
    expect(hub.getState().sustain).toBe(false);
    // Released while the pedal was still down, then the pedal came up in the same reset.
    expect(hub.getState().sustained.size).toBe(0);
  });

  it('only creates a new state object when something changed', () => {
    const { hub, a } = setup();
    let changes = 0;
    hub.subscribe(() => changes++);
    const before = hub.getState();
    a.off(60);
    a.pedal(false);
    expect(hub.getState()).toBe(before);
    a.on(60);
    expect(hub.getState()).not.toBe(before);
    expect(changes).toBe(1);
  });

  it('state is already updated when event listeners run', () => {
    const { hub, a } = setup();
    let seen: number[] = [];
    hub.onEvent(() => (seen = [...hub.getState().held.keys()]));
    a.on(60);
    expect(seen).toEqual([60]);
  });

  it('removing a source stops it and releases what it held, once', () => {
    const { hub, a, b, stopA, held, summary } = setup();
    a.on(60);
    a.on(62, 80, 'other');
    a.pedal(true);
    b.on(62);
    stopA();
    stopA();
    expect(a.counts()).toEqual({ starts: 1, stops: 1 });
    expect(held()).toEqual([62]);
    expect(hub.getState().sustain).toBe(false);
    expect(summary()).toEqual(['on:60', 'on:62', 'pedal:true', 'off:60', 'pedal:false']);
  });

  it('ignores events a source sends after it was removed', () => {
    const { a, stopA, held } = setup();
    const staleEmit = a.emit!;
    stopA();
    staleEmit({ type: 'on', midi: 60, velocity: 1, time: 0 });
    expect(held()).toEqual([]);
  });

  it('rejects the same source id twice, and allows it again after removal', () => {
    const hub = createInputHub();
    const a = fakeSource('a');
    const stop = hub.add(a.source);
    expect(() => hub.add(a.source)).toThrow(/already added/);
    expect(a.counts().starts).toBe(1);
    stop();
    // StrictMode: effect → cleanup → effect.
    hub.add(a.source);
    expect(a.counts()).toEqual({ starts: 2, stops: 1 });
  });

  it('unsubscribes listeners', () => {
    const hub = createInputHub();
    const a = fakeSource('a');
    hub.add(a.source);
    let changes = 0;
    let events = 0;
    const offChange = hub.subscribe(() => changes++);
    const offEvent = hub.onEvent(() => events++);
    a.on(60);
    offChange();
    offEvent();
    a.on(61);
    expect([changes, events]).toEqual([1, 1]);
  });
});

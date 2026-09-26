import { describe, expect, it, vi } from 'vitest';
import { createInputHub, type HubEvent } from '../input/hub.ts';
import type { Emit, InputEvent, NoteInput } from '../input/types.ts';
import { createKeyMonitor, MONITOR_KEYS_PREF, MONITOR_MIDI_PREF } from './monitor.ts';

function fakeSource(id: string) {
  let emit: Emit | null = null;
  const source: NoteInput = {
    id,
    start(next) {
      emit = next;
      return () => void (emit = null);
    },
  };
  return {
    source,
    send: (event: InputEvent, port?: string) => emit?.(event, port),
    on: (midi: number, velocity = 80, port?: string) =>
      emit?.({ type: 'on', midi, velocity, time: 0 }, port),
    off: (midi: number, port?: string) => emit?.({ type: 'off', midi, velocity: 0, time: 0 }, port),
    pedal: (down: boolean) => emit?.({ type: 'sustain', down, time: 0 }),
  };
}

function setup(stored: Record<string, string> = {}) {
  const prefs = new Map(Object.entries(stored));
  const played: string[] = [];
  const prepare = vi.fn();
  const monitor = createKeyMonitor({
    piano: {
      noteOn: (midi, velocity) => played.push(`on ${midi} v${velocity}`),
      noteOff: (midi) => played.push(`off ${midi}`),
      sustain: (down) => played.push(down ? 'pedal down' : 'pedal up'),
      silence: () => played.push('silence'),
    },
    prepare,
    prefs: {
      read: (key) => prefs.get(key) ?? null,
      write: (key, value) => {
        if (value === null) prefs.delete(key);
        else prefs.set(key, value);
      },
    },
  });
  const hub = createInputHub();
  const events: HubEvent[] = [];
  hub.onEvent((e) => events.push(e));
  const keyboard = fakeSource('keyboard');
  const pointer = fakeSource('pointer');
  const midi = fakeSource('midi');
  hub.add(monitor.tap(keyboard.source, 'keys'));
  hub.add(monitor.tap(pointer.source, 'keys'));
  hub.add(monitor.tap(midi.source, 'midi'));
  const stop = monitor.start();
  return { monitor, prefs, played, prepare, hub, events, keyboard, pointer, midi, stop };
}

describe('key monitor', () => {
  it('sounds the computer keyboard and the on-screen keys by default, not a MIDI keyboard', () => {
    const { played, keyboard, pointer, midi } = setup();
    keyboard.on(60, 96);
    pointer.on(64, 96, 'p1');
    midi.on(67, 50);
    keyboard.off(60);
    pointer.off(64, 'p1');
    midi.off(67);
    expect(played).toEqual(['on 60 v96', 'on 64 v96', 'off 60', 'off 64']);
  });

  it('leaves the input hub’s events as they were', () => {
    const { events, keyboard, midi } = setup();
    keyboard.on(60, 96);
    midi.on(67, 50);
    expect(events).toEqual([
      { type: 'on', midi: 60, velocity: 96, time: 0 },
      { type: 'on', midi: 67, velocity: 50, time: 0 },
    ]);
  });

  it('a key held by two sources sounds once, until both let it go', () => {
    const { played, keyboard, pointer } = setup();
    keyboard.on(60, 96);
    pointer.on(60, 96, 'p1');
    keyboard.off(60);
    expect(played).toEqual(['on 60 v96']);
    pointer.off(60, 'p1');
    expect(played).toEqual(['on 60 v96', 'off 60']);
  });

  it('passes the pedal on', () => {
    const { monitor, played, midi } = setup();
    monitor.set({ keys: true, midi: true });
    midi.pedal(true);
    midi.on(60, 70);
    midi.off(60);
    midi.pedal(false);
    expect(played).toEqual(['pedal down', 'on 60 v70', 'off 60', 'pedal up']);
  });

  it('turned off, its held keys stop sounding; the choice is remembered', () => {
    const { monitor, prefs, played, keyboard, midi } = setup();
    const changes = vi.fn();
    monitor.subscribe(changes);
    keyboard.on(60, 96);
    monitor.set({ keys: false, midi: true });
    expect(played).toEqual(['on 60 v96', 'off 60']);
    expect(changes).toHaveBeenCalledTimes(1);
    expect(monitor.getSettings()).toEqual({ keys: false, midi: true });
    expect(prefs.get(MONITOR_KEYS_PREF)).toBe('off');
    expect(prefs.get(MONITOR_MIDI_PREF)).toBe('on');
    keyboard.on(62, 96);
    midi.on(64, 40);
    expect(played.slice(2)).toEqual(['on 64 v40']);
    monitor.set({ keys: true, midi: false });
    expect(prefs.size).toBe(0);
  });

  it('starts from the stored choice', () => {
    const { played, keyboard, midi } = setup({
      [MONITOR_KEYS_PREF]: 'off',
      [MONITOR_MIDI_PREF]: 'on',
    });
    keyboard.on(60, 96);
    midi.on(64, 40);
    expect(played).toEqual(['on 64 v40']);
  });

  it('asks for the samples with the first key, or as soon as a MIDI keyboard is to sound', () => {
    const { monitor, prepare, keyboard } = setup();
    expect(prepare).not.toHaveBeenCalled();
    keyboard.on(60, 96);
    expect(prepare).toHaveBeenCalledTimes(1);
    const other = setup();
    other.monitor.set({ keys: true, midi: true });
    expect(other.prepare).toHaveBeenCalledTimes(1);
    expect(monitor.getSettings().midi).toBe(false);
  });

  it('a source is tapped once, and its tap starts and stops as often as the hub likes', () => {
    const { monitor, played, keyboard, hub } = setup();
    expect(() => monitor.tap(keyboard.source, 'keys')).toThrow();
    const other = fakeSource('other');
    const tapped = monitor.tap(other.source, 'keys');
    hub.add(tapped)();
    hub.add(tapped);
    other.on(70, 96);
    expect(played).toEqual(['on 70 v96']);
  });

  it('stopped, it lets every key up and silences the piano; it can start again', () => {
    const { monitor, played, keyboard, stop } = setup();
    keyboard.on(60, 96);
    stop();
    expect(played).toEqual(['on 60 v96', 'off 60', 'silence']);
    keyboard.on(62, 96);
    expect(played).toHaveLength(3);
    monitor.start();
    keyboard.on(64, 96);
    expect(played.slice(3)).toEqual(['on 64 v96']);
  });
});

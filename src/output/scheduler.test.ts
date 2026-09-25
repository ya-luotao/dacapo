import { describe, expect, it } from 'vitest';
import { noteOff, noteOn, resetAllChannels } from './messages.ts';
import { createScheduler, LOOKAHEAD_MS } from './scheduler.ts';
import { fakeClock, FakePort } from './testing.ts';

function setup() {
  const clock = fakeClock(1000);
  const port = new FakePort();
  const scheduler = createScheduler({ clock });
  scheduler.setPort(port);
  return { clock, port, scheduler };
}

const PANIC_TAIL = resetAllChannels().map((data) => ({ data, time: undefined }));

describe('messages', () => {
  it('builds complete channel messages', () => {
    expect(noteOn(0, 60, 72)).toEqual([0x90, 60, 72]);
    expect(noteOn(3, 60, 0)).toEqual([0x93, 60, 1]); // never a disguised note-off
    expect(noteOff(15, 108)).toEqual([0x8f, 108, 64]);
  });

  it('resets every channel: sustain up, all notes off, all sound off', () => {
    const reset = resetAllChannels();
    expect(reset).toHaveLength(48);
    expect(reset.slice(0, 3)).toEqual([
      [0xb0, 64, 0],
      [0xb0, 123, 0],
      [0xb0, 120, 0],
    ]);
    expect(reset.at(-1)).toEqual([0xbf, 120, 0]);
    expect(reset.every(([status]) => status < 0xf0)).toBe(true);
  });
});

describe('createScheduler', () => {
  it('hands messages over only within the lookahead, with their own timestamps', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 72, on: 1050, off: 1500 });
    scheduler.play({ midi: 64, velocity: 72, on: 1200, off: 1300 });
    expect(port.log()).toEqual(['on 60 v72@1050']);
    clock.advance(100); // t = 1100: 1200 is not within the lookahead yet
    expect(port.log()).toEqual(['on 60 v72@1050']);
    clock.advance(20); // t = 1120: 1200 ≤ 1120 + 80
    expect(port.log()).toEqual(['on 60 v72@1050', 'on 64 v72@1200']);
    clock.advance(100); // t = 1220: 1300 due
    expect(port.log()).toEqual(['on 60 v72@1050', 'on 64 v72@1200', 'off 64@1300']);
    clock.advance(300);
    expect(port.log().at(-1)).toBe('off 60@1500');
    // Done: the queue is empty and the timer stopped.
    expect(scheduler.pending()).toBe(0);
    expect(clock.timers()).toBe(0);
  });

  it('never sends a message more than the lookahead ahead of the clock', () => {
    const clock = fakeClock(0);
    const port = new FakePort();
    const scheduler = createScheduler({ clock });
    scheduler.setPort(port);
    const sentAt: { time: number; now: number }[] = [];
    const original = port.send.bind(port);
    port.send = (data, time) => {
      sentAt.push({ time: time ?? clock.now(), now: clock.now() });
      original(data, time);
    };
    for (let i = 0; i < 40; i++)
      scheduler.play({ midi: 60 + (i % 5), velocity: 70, on: i * 37, off: i * 37 + 30 });
    clock.advance(2000);
    expect(sentAt).toHaveLength(80);
    for (const { time, now } of sentAt) {
      expect(time - now).toBeLessThanOrEqual(LOOKAHEAD_MS);
      expect(time).toBeGreaterThanOrEqual(now);
    }
  });

  it('orders messages by time and releases a key before striking it again', () => {
    const { clock, port, scheduler } = setup();
    scheduler.playAll([
      { midi: 62, velocity: 60, on: 1060, off: 1070 },
      { midi: 60, velocity: 60, on: 1010, off: 1040 },
      { midi: 60, velocity: 60, on: 1040, off: 1060 },
    ]);
    clock.advance(200);
    expect(port.log()).toEqual([
      'on 60 v60@1010',
      'off 60@1040',
      'on 60 v60@1040',
      'off 60@1060',
      'on 62 v60@1060',
      'off 62@1070',
    ]);
  });

  it('keeps one note per key: an overlapping later note ends the earlier one', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 60, on: 1200, off: 2000 });
    scheduler.play({ midi: 60, velocity: 60, on: 1500, off: 1700 });
    // A note that would start before a queued note of the same key stops where that one starts.
    scheduler.play({ midi: 60, velocity: 60, on: 1100, off: 1300 });
    clock.advance(1000);
    expect(port.log()).toEqual([
      'on 60 v60@1100',
      'off 60@1200',
      'on 60 v60@1200',
      'off 60@1500',
      'on 60 v60@1500',
      'off 60@1700',
    ]);
  });

  it('a note of a key already handed over for later waits until that note has ended', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 60, on: 1000, off: 1050 }); // on and off both sent
    scheduler.play({ midi: 60, velocity: 60, on: 1020, off: 1200 });
    clock.advance(300);
    expect(port.log()).toEqual(['on 60 v60@1000', 'off 60@1050', 'on 60 v60@1050', 'off 60@1200']);
  });

  it('merges a unison: the same key struck at the same time sounds once, for the longer note', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 55, velocity: 60, on: 1300, off: 1400 });
    scheduler.play({ midi: 55, velocity: 60, on: 1300, off: 1600 });
    clock.advance(1000);
    expect(port.log()).toEqual(['on 55 v60@1300', 'off 55@1600']);
  });

  it('tracks the notes that sound, including those handed over for later', () => {
    const { clock, scheduler } = setup();
    scheduler.play({ midi: 64, velocity: 60, on: 1000, off: 1100 });
    scheduler.play({ midi: 60, velocity: 60, on: 1050, off: 1300 });
    scheduler.play({ midi: 67, velocity: 60, on: 1500, off: 1600 });
    expect(scheduler.sounding()).toEqual([
      { channel: 0, midi: 60 },
      { channel: 0, midi: 64 },
    ]);
    clock.advance(150);
    expect(scheduler.sounding()).toEqual([{ channel: 0, midi: 60 }]);
    clock.advance(1000);
    expect(scheduler.sounding()).toEqual([]);
  });

  it('cut: a queued note never sounds; a sounding one is released now', () => {
    const { clock, port, scheduler } = setup();
    const a = scheduler.play({ midi: 60, velocity: 60, on: 1000, off: 3000 });
    const b = scheduler.play({ midi: 62, velocity: 60, on: 2000, off: 3000 });
    clock.advance(500);
    scheduler.cut(a);
    scheduler.cut(b);
    scheduler.cut(999); // unknown: nothing
    clock.advance(3000);
    expect(port.log()).toEqual(['on 60 v60@1000', 'off 60@1500']);
  });

  it('cut of a note handed over for later releases it right after its note-on', () => {
    const { port, scheduler } = setup();
    const a = scheduler.play({ midi: 60, velocity: 60, on: 1060, off: 3000 });
    scheduler.cut(a);
    expect(port.log()).toEqual(['on 60 v60@1060', 'off 60@1061']);
  });

  it('a timer running late still sends a note-on before its own note-off', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 60, on: 1100, off: 1110 });
    clock.set(1500); // the page was busy: no tick ran in between
    clock.advance(20);
    expect(port.log()).toEqual(['on 60 v60@1500', 'off 60@1501']);
    expect(scheduler.sounding()).toEqual([]);
  });

  it('panic: note-offs for tracked notes, then sustain, notes and sound off on 16 channels', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 60, on: 1000, off: 5000 });
    scheduler.play({ midi: 64, velocity: 60, on: 1000, off: 5000, channel: 1 });
    scheduler.play({ midi: 67, velocity: 60, on: 3000, off: 5000 }); // still queued here
    clock.advance(100);
    port.sent = [];
    scheduler.panic();
    expect(port.sent).toEqual([
      { data: [0x80, 60, 64], time: undefined },
      { data: [0x81, 64, 64], time: undefined },
      ...PANIC_TAIL,
    ]);
    expect(scheduler.pending()).toBe(0);
    expect(scheduler.sounding()).toEqual([]);
    clock.advance(10_000);
    expect(port.sent).toHaveLength(2 + 48); // the queued note never goes out
    expect(clock.timers()).toBe(0);
  });

  it('panic also releases note-ons already handed over for later, after they arrive', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 60, on: 1030, off: 2000 });
    scheduler.play({ midi: 62, velocity: 60, on: 1070, off: 2000 });
    clock.advance(10); // t = 1010: both note-ons are with the port (1030, 1070)
    port.sent = [];
    scheduler.panic();
    const log = port.log();
    expect(log.slice(0, 2)).toEqual(['off 60', 'off 62']);
    expect(log.slice(-2)).toEqual(['off 60@1071', 'off 62@1071']);
    // Every late release is stamped no earlier than every note-on already sent.
    expect(log).toHaveLength(2 + 48 + 2);
  });

  it('panics on the old port when the port changes, and sends nothing without one', () => {
    const { clock, port, scheduler } = setup();
    scheduler.play({ midi: 60, velocity: 60, on: 1000, off: 2000 });
    const other = new FakePort();
    scheduler.setPort(other);
    expect(port.log().slice(0, 2)).toEqual(['on 60 v60@1000', 'off 60']);
    expect(port.sent).toHaveLength(2 + 48);
    expect(other.sent).toEqual([]);
    scheduler.setPort(null);
    scheduler.play({ midi: 62, velocity: 60, on: 1000, off: 1100 });
    clock.advance(500);
    expect(other.sent).toEqual([]); // nothing was ever sent to it, so nothing to silence
  });

  it('panic is skipped while nothing has been sent since the last one', () => {
    const { clock, port, scheduler } = setup();
    scheduler.panic();
    expect(port.sent).toEqual([]);
    scheduler.play({ midi: 60, velocity: 60, on: 1000, off: 1100 });
    clock.advance(200);
    scheduler.panic();
    expect(port.sent).toHaveLength(2 + 48);
    scheduler.panic();
    expect(port.sent).toHaveLength(2 + 48);
  });

  it('survives a port that throws (unplugged mid-send)', () => {
    const { clock, port, scheduler } = setup();
    port.broken = true;
    scheduler.play({ midi: 60, velocity: 60, on: 1000, off: 1100 });
    expect(() => clock.advance(200)).not.toThrow();
    expect(() => scheduler.panic()).not.toThrow();
  });
});

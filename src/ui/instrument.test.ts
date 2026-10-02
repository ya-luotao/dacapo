// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FULL_KEYS, hasKey, KEYBOARDS } from '../core/instrument.ts';
import { getLevel } from '../core/levels.ts';
import { midiOf } from '../core/musicxml.ts';
import { seededRng } from '../core/random.ts';
import {
  forgetInstrumentKeys,
  INSTRUMENT_RANGE_PREF,
  readInstrumentKeys,
  writeInstrumentKeys,
} from './instrument.ts';
import { instrumentRange, whiteKeys } from './piano/range.ts';
import { createPracticeStore } from './practice/store.ts';
import { createReadController } from './read/controller.ts';
import { createTheoryController } from './read/theoryController.ts';

// The instrument's keys as the browser keeps them (docs/PERSONAL.md, "The instrument's keys"),
// and what reads them without a page: Read's cards, the chord cards, Play's keyboard.

const SMALL = { low: 48, high: 72 };

afterEach(() => {
  localStorage.clear();
  forgetInstrumentKeys();
});

describe('the preference', () => {
  it('is 88 keys until a keyboard is chosen, and keeps nothing for 88 keys', () => {
    expect(readInstrumentKeys()).toBe(FULL_KEYS);
    writeInstrumentKeys(KEYBOARDS[49]);
    expect(localStorage.getItem(INSTRUMENT_RANGE_PREF)).toBe('{"low":36,"high":84}');
    expect(readInstrumentKeys()).toEqual({ low: 36, high: 84 });
    writeInstrumentKeys(FULL_KEYS);
    expect(localStorage.getItem(INSTRUMENT_RANGE_PREF)).toBeNull();
    expect(readInstrumentKeys()).toBe(FULL_KEYS);
  });

  it('is read again on the next visit', () => {
    writeInstrumentKeys(SMALL);
    forgetInstrumentKeys();
    expect(readInstrumentKeys()).toEqual(SMALL);
    // The same object until the choice changes: what depends on it is worked out once.
    expect(readInstrumentKeys()).toBe(readInstrumentKeys());
  });

  it.each(['', 'null', '49', '{"low":36}', '{"low":84,"high":36}', '[36,84]', '{low:36'])(
    'takes %j for 88 keys',
    (kept) => {
      localStorage.setItem(INSTRUMENT_RANGE_PREF, kept);
      expect(readInstrumentKeys()).toBe(FULL_KEYS);
    },
  );
});

describe('Play’s keyboard', () => {
  it('draws the instrument’s keys, each end out to a white key', () => {
    expect(instrumentRange(48, 72)).toEqual([48, 72]);
    expect(instrumentRange(36, 84)).toEqual([36, 84]);
    // A keyboard set from a black key to a black key (B♭2 to F♯5).
    expect(instrumentRange(46, 78)).toEqual([45, 79]);
    expect(whiteKeys(instrumentRange(48, 72))).toBe(15);
    expect(instrumentRange(21, 108)).toEqual([21, 108]);
  });
});

function timers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    setTimer: (run: () => void) => {
      pending.set(next, run);
      return next++;
    },
    clearTimer: (id: number) => void pending.delete(id),
    flush: () => {
      for (const [id, run] of [...pending]) {
        pending.delete(id);
        run();
      }
    },
  };
}

describe('Read on a keyboard with fewer keys', () => {
  function setup() {
    const clock = timers();
    let ids = 0;
    const controller = createReadController({
      practice: createPracticeStore(),
      now: () => 1_700_000_000_000,
      rng: seededRng(9),
      newId: () => `s${++ids}`,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    return { controller, flush: clock.flush };
  }

  it('draws only the cards the keyboard has, card after card', () => {
    writeInstrumentKeys(SMALL);
    const { controller, flush } = setup();
    // L6 runs from C2 to C6: of it, C3–C5.
    controller.start('L6', 50, false);
    const seen = new Set<number>();
    for (let n = 0; n < 50 && controller.getState()!.phase === 'running'; n++) {
      const { card } = controller.getState()!;
      expect(hasKey(SMALL, card.note.midi)).toBe(true);
      seen.add(card.note.midi);
      controller.painted(card.index, 1000 + n * 2000);
      controller.press(card.note.midi, 1500 + n * 2000);
      flush();
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(controller.getState()!.level).toBe('L6');
  });

  it('draws of some of a level’s notes (Practise these) those the keyboard has', () => {
    writeInstrumentKeys(SMALL);
    const { controller } = setup();
    const notes = getLevel('L6').notes.filter((n) => [36, 60, 84].includes(n.midi));
    expect(notes.length).toBeGreaterThan(2);
    controller.start('L6', 10, false, notes);
    expect(controller.getState()!.notes!.every((n) => n.midi === 60)).toBe(true);
    expect(controller.getState()!.card.note.midi).toBe(60);
    // With none of them on the keyboard there is nothing to draw.
    controller.start(
      'L6',
      10,
      false,
      getLevel('L6').notes.filter((n) => n.midi === 84),
    );
    expect(controller.getState()).toBeNull();
  });

  it('draws every card of a level that lies on the keyboard, as before', () => {
    writeInstrumentKeys(SMALL);
    const { controller } = setup();
    controller.start('L1', 10, false);
    expect(controller.getState()).toMatchObject({ level: 'L1', phase: 'running' });
  });

  it('starts no session of a level with none of its notes on the keyboard', () => {
    // C5–C7: of L2 (C4–C5) one key, of L1 none.
    writeInstrumentKeys({ low: 72, high: 96 });
    const { controller, flush } = setup();
    controller.start('L1', 10, false);
    expect(controller.getState()).toBeNull();
    // The one note left of L2 is drawn, and drawn again.
    controller.start('L2', 10, false);
    for (let n = 0; n < 3; n++) {
      const { card } = controller.getState()!;
      expect(card.note.key).toBe('C5@treble');
      controller.painted(card.index, 1000 + n * 2000);
      controller.press(72, 1500 + n * 2000);
      flush();
    }
    expect(controller.getState()!.card.index).toBe(3);
    // Back on 88 keys both start.
    writeInstrumentKeys(FULL_KEYS);
    controller.start('L1', 10, false);
    expect(controller.getState()).toMatchObject({ level: 'L1', phase: 'running' });
  });
});

describe('a written chord on a keyboard with fewer keys', () => {
  function chordCard(keys: { low: number; high: number }) {
    writeInstrumentKeys(keys);
    const clock = timers();
    let ids = 0;
    const practice = createPracticeStore();
    const controller = createTheoryController({
      practice,
      now: () => 1_700_000_000_000,
      rng: seededRng(4),
      newId: () => `t${++ids}`,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    controller.start({ level: 'RC1', by: 'play', length: 10, hint: false });
    const { card } = controller.getState()!;
    if (card.prompt.family !== 'readChord') throw new Error('a chord card was expected');
    controller.painted(card.index, 1000);
    return { controller, practice, written: card.prompt.notes.map(midiOf) };
  }

  it('is right with a note the keyboard lacks played in another octave, and recorded as written', () => {
    // A keyboard that ends under the chord's top note: that note is played an octave lower.
    const probe = chordCard(FULL_KEYS);
    const top = Math.max(...probe.written);
    localStorage.clear();
    forgetInstrumentKeys();
    const { controller, practice, written } = chordCard({ low: 21, high: top - 1 });
    expect(written).toEqual(probe.written);
    for (const midi of written) controller.press(midi === top ? top - 12 : midi, 1500);
    expect(controller.getState()!.card.status).toBe('correct');
    const [answer] = practice.getSnapshot().answers;
    expect(answer).toMatchObject({ correct: true });
    // Letting the key go lets go of the note it stood for.
    controller.release(top - 12, 1600);
    expect(controller.getState()!.card.held).not.toContain(top);
  });

  it('is wrong with that octave on a keyboard that has the note', () => {
    const { controller, written } = chordCard(FULL_KEYS);
    const top = Math.max(...written);
    for (const midi of written) controller.press(midi === top ? top - 12 : midi, 1500);
    expect(controller.getState()!.card.status).toBe('wrong');
  });
});

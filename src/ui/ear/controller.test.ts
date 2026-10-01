import { describe, expect, it } from 'vitest';
import { givenKey, targetKey, type PlannedNote } from '../../core/earItems.ts';
import { TONIC_CHORD_MS } from '../../core/earMelody.ts';
import { seededRng, type Rng } from '../../core/random.ts';
import { tunePrompt } from '../../core/tunes.ts';
import { createPracticeStore } from '../practice/store.ts';
import {
  ADVANCE_DELAY_MS,
  CORRECTION_LEAD_MS,
  createEarController,
  FIRST_LEAD_MS,
  PROMPT_LEAD_MS,
  type EarConfig,
} from './controller.ts';

const INTERVALS: EarConfig = {
  level: 'I1',
  by: 'play',
  directions: ['up'],
  chordStyle: 'broken',
  length: 10,
};

const GRACE: EarConfig = {
  level: 'trad-amazing-grace',
  by: 'name',
  directions: [],
  chordStyle: 'broken',
  length: 50,
};

function setup(rng: Rng = seededRng(9)) {
  const practice = createPracticeStore();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 1;
  let ids = 0;
  let time = 10_000;
  const played: { notes: readonly PlannedNote[]; start: number }[] = [];
  let silenced = 0;
  const controller = createEarController({
    practice,
    sound: {
      play: (notes, start) => void played.push({ notes, start }),
      silence: () => void silenced++,
    },
    clock: () => time,
    now: () => 1_700_000_000_000,
    rng,
    newId: () => `s${++ids}`,
    setTimer: (run, ms) => {
      timers.set(nextTimer, { run, ms });
      return nextTimer++;
    },
    clearTimer: (id) => void timers.delete(id),
  });
  const state = () => controller.getState()!;
  const card = () => state().session.card;
  /** Runs the timers due in `ms`, moving the clock on. */
  const wait = (ms: number) => {
    time += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.ms > ms) {
        timer.ms -= ms;
        continue;
      }
      timers.delete(id);
      timer.run();
    }
  };
  /** Until the answer window is open. */
  const listen = () => wait(card().opensAt! - time);
  return {
    practice,
    controller,
    timers,
    played,
    state,
    card,
    wait,
    listen,
    now: () => time,
    silenced: () => silenced,
  };
}

describe('ear controller', () => {
  it('plays the first prompt after a moment, and listens until its last note-on', () => {
    const { controller, played, state, card, now, listen } = setup();
    controller.start(INTERVALS);
    expect(played).toHaveLength(1);
    expect(played[0]!.start).toBe(now() + FIRST_LEAD_MS);
    expect(played[0]!.notes.map((n) => n.midi)).toEqual(card().prompt.notes);
    expect(state().listening).toBe(true);
    expect(card().opensAt).toBe(now() + FIRST_LEAD_MS + 800);
    listen();
    expect(state().listening).toBe(false);
  });

  it('ignores keys while the prompt plays, then records the answer', () => {
    const { controller, practice, card, now, listen } = setup();
    controller.start(INTERVALS);
    const target = targetKey(card().prompt);
    controller.press(target, now() + 100);
    expect(card().status).toBe('waiting');
    listen();
    controller.press(target, now() + 700);
    expect(card().status).toBe('correct');
    expect(practice.getSnapshot().answers).toEqual([
      expect.objectContaining({ sessionId: 's1', correct: true, ms: 700, replays: 0 }),
    ]);
  });

  it('moves to the next item 400 ms after a right answer and plays its prompt', () => {
    const { controller, played, timers, card, now, listen, wait } = setup();
    controller.start(INTERVALS);
    listen();
    controller.press(targetKey(card().prompt), now() + 500);
    expect([...timers.values()].map((t) => t.ms)).toContain(ADVANCE_DELAY_MS);
    wait(ADVANCE_DELAY_MS);
    expect(card()).toMatchObject({ index: 1, status: 'waiting' });
    expect(played).toHaveLength(2);
    expect(played[1]!.start).toBe(now() + PROMPT_LEAD_MS);
  });

  it('after a wrong answer plays the right one, then moves on with a key or Next', () => {
    const { controller, played, card, now, listen, silenced } = setup();
    controller.start(INTERVALS);
    listen();
    const { prompt } = card();
    controller.press(targetKey(prompt) + 1, now() + 400);
    expect(card().status).toBe('wrong');
    // The correction: the same prompt again, not counted as a replay.
    expect(played).toHaveLength(2);
    expect(played[1]!.start).toBe(now() + CORRECTION_LEAD_MS);
    expect(card().replays).toBe(0);
    // A key while the correction plays does not move on.
    controller.press(60, now() + 100);
    expect(card().index).toBe(0);
    listen();
    controller.press(60, now() + 10);
    expect(card()).toMatchObject({ index: 1, status: 'waiting' });

    // Next moves on at once and silences the correction.
    listen();
    controller.press(targetKey(card().prompt) + 1, now() + 400);
    const before = silenced();
    controller.next();
    expect(silenced()).toBe(before + 1);
    expect(card().index).toBe(2);
  });

  it('counts Hear again before the answer, and opens the window at its last note-on', () => {
    const { controller, played, practice, card, now, listen } = setup();
    controller.start(INTERVALS);
    listen();
    controller.hearAgain();
    expect(played).toHaveLength(2);
    expect(card().replays).toBe(1);
    const opensAt = card().opensAt!;
    expect(opensAt).toBe(now() + PROMPT_LEAD_MS + 800);
    controller.press(targetKey(card().prompt), opensAt - 1);
    expect(card().status).toBe('waiting');
    listen();
    controller.press(targetKey(card().prompt), now() + 300);
    expect(practice.getSnapshot().answers[0]).toMatchObject({ replays: 1, ms: 300 });
  });

  it('plays a chord broken, then block, and judges the keys held', () => {
    const { controller, played, card, now, listen } = setup();
    controller.start({ ...INTERVALS, level: 'C1', directions: [] });
    const { prompt } = card();
    expect(played[0]!.notes).toHaveLength(6);
    listen();
    const [root, third, fifth] = prompt.notes as [number, number, number];
    expect(givenKey(prompt)).toBe(root);
    controller.press(root - 12, now() + 10);
    controller.press(third, now() + 20);
    expect(card().status).toBe('waiting');
    controller.release(third);
    controller.press(fifth + 12, now() + 30);
    expect(card().status).toBe('waiting');
    controller.press(third + 12, now() + 40);
    expect(card().status).toBe('correct');
  });

  it('answers by name', () => {
    const { controller, practice, card, now, listen } = setup();
    controller.start({ ...INTERVALS, by: 'name' });
    controller.choose('P8', now());
    expect(card().status).toBe('waiting');
    listen();
    controller.press(targetKey(card().prompt), now() + 10);
    expect(card().status).toBe('waiting');
    controller.choose('P8', now() + 900);
    expect(practice.getSnapshot().answers).toHaveLength(1);
    expect(practice.getSnapshot().answers[0]).toMatchObject({ by: 'name', answer: 'P8' });
  });

  it('saves one summary when the session completes', () => {
    const { controller, practice, card, now, listen, wait, state } = setup();
    controller.start({ ...INTERVALS, length: 10 });
    for (let i = 0; i < 10; i++) {
      listen();
      controller.press(targetKey(card().prompt), now() + 600);
      wait(ADVANCE_DELAY_MS);
    }
    expect(state().session.phase).toBe('done');
    expect(state().listening).toBe(false);
    const { sessions, answers } = practice.getSnapshot();
    expect(answers).toHaveLength(10);
    expect(sessions).toEqual([
      expect.objectContaining({ kind: 'ear', id: 's1', level: 'I1', items: 10, accuracy: 1 }),
    ]);
  });

  it('stopping keeps the answers, silences and cancels the timers; nothing is saved empty', () => {
    const { controller, practice, timers, card, now, listen, silenced } = setup();
    controller.start(INTERVALS);
    listen();
    controller.press(targetKey(card().prompt), now() + 600);
    controller.stop();
    expect(timers.size).toBe(0);
    expect(silenced()).toBeGreaterThan(0);
    expect(practice.getSnapshot().sessions[0]).toMatchObject({ items: 1, length: 10 });
    controller.close();
    expect(controller.getState()).toBeNull();

    controller.start(INTERVALS);
    controller.dispose();
    expect(practice.getSnapshot().sessions).toHaveLength(1);
  });

  it('plays a melody after its tonic chord and takes it back key by key', () => {
    const { controller, practice, played, card, now, listen, wait, state } = setup();
    controller.start({ ...INTERVALS, level: 'EC2', by: 'name', directions: [], length: 5 });
    expect(state().session).toMatchObject({ family: 'echo', by: 'play', length: 5 });
    const { prompt } = card();
    // Three keys of the chord, then the four notes of the melody.
    expect(played[0]!.notes.map((n) => n.midi)).toEqual([...prompt.melody!.chord, ...prompt.notes]);
    expect(card().opensAt).toBe(now() + FIRST_LEAD_MS + 1500 + 3 * 600);
    listen();
    for (const midi of prompt.notes.slice(0, -1)) controller.press(midi, now() + 100);
    expect(card()).toMatchObject({ status: 'waiting', played: prompt.notes.slice(0, -1) });
    // Nothing is recorded until the melody is complete.
    expect(practice.getSnapshot().answers).toEqual([]);
    controller.press(prompt.notes.at(-1)!, now() + 900);
    expect(card().status).toBe('correct');
    expect(practice.getSnapshot().answers).toEqual([
      expect.objectContaining({ family: 'echo', item: 'echo:EC2', correct: true, ms: 900 }),
    ]);
    wait(ADVANCE_DELAY_MS);
    expect(card()).toMatchObject({ index: 1, status: 'waiting', played: [] });
  });

  it('after a wrong key plays the melody again alone; Hear again plays the chord too', () => {
    const { controller, played, card, now, listen } = setup();
    controller.start({ ...INTERVALS, level: 'EC2', directions: [], length: 5 });
    listen();
    const { prompt } = card();
    controller.press(prompt.notes[0]!, now() + 100);
    controller.press(prompt.notes[1]! + 1, now() + 200);
    expect(card()).toMatchObject({
      status: 'wrong',
      answer: [prompt.notes[0], prompt.notes[1]! + 1],
    });
    // The correction: the melody without its chord, not counted as a replay.
    expect(played[1]!.notes.map((n) => n.midi)).toEqual(prompt.notes);
    expect(played[1]!.start).toBe(now() + CORRECTION_LEAD_MS);
    expect(card().opensAt).toBe(now() + CORRECTION_LEAD_MS + 3 * 600);
    expect(card().replays).toBe(0);
    controller.hearAgain();
    expect(played[2]!.notes.map((n) => n.midi)).toEqual([...prompt.melody!.chord, ...prompt.notes]);
    expect(card().replays).toBe(0);
    listen();
    controller.press(60, now() + 10);
    expect(card().index).toBe(1);
  });

  it('stops listening when the sound is cut from outside', () => {
    const { controller, state, timers } = setup();
    controller.start(INTERVALS);
    controller.interrupted();
    expect(state().listening).toBe(false);
    expect(timers.size).toBe(0);
  });
});

describe('ear controller: a tune', () => {
  const midis = (notes: readonly PlannedNote[]) => notes.map((n) => n.midi);

  it('plays a phrase after the chord of its key, in its own rhythm, and takes it back', () => {
    const { controller, practice, played, card, now, listen, wait, state } = setup();
    controller.start(GRACE);
    // Played back, every phrase and the whole of it, whatever the page asked for.
    expect(state().session).toMatchObject({
      family: 'tune',
      by: 'play',
      length: 5,
      key: { tonic: 'G', scale: 'major' },
    });
    const first = tunePrompt('tune:trad-amazing-grace:1', 0);
    expect(card().prompt).toEqual(first);
    expect(midis(played[0]!.notes)).toEqual([55, 59, 62, ...first.notes]);
    // The chord, a beat's rest, then the line: the window opens at its last note-on.
    const lead = TONIC_CHORD_MS + first.tune.restMs;
    expect(played[0]!.notes[3]).toMatchObject({ midi: 62, on: lead });
    expect(card().opensAt).toBe(now() + FIRST_LEAD_MS + lead + first.tune.events.at(-1)!.on);
    listen();
    for (const midi of first.notes.slice(0, -1)) controller.press(midi, now() + 100);
    expect(practice.getSnapshot().answers).toEqual([]);
    controller.press(first.notes.at(-1)!, now() + 4000);
    expect(practice.getSnapshot().answers).toEqual([
      expect.objectContaining({
        family: 'tune',
        level: 'trad-amazing-grace',
        item: 'tune:trad-amazing-grace:1',
        correct: true,
        key: { tonic: 'G', scale: 'major' },
      }),
    ]);
    // The next phrase, not one drawn by weakness.
    wait(ADVANCE_DELAY_MS);
    expect(card()).toMatchObject({ index: 1, status: 'waiting', played: [] });
    expect(card().prompt.item).toBe('tune:trad-amazing-grace:2');
  });

  it('in another key: one key drawn for the session, from its first phrase to the whole', () => {
    // The first lot of the draw: six semitones down, D flat major.
    const { controller, practice, card, now, listen, wait, state } = setup(() => 0);
    controller.start({ ...GRACE, tuneKey: 'other' });
    expect(state().session.key).toEqual({ tonic: 'Db', scale: 'major' });
    const items: string[] = [];
    while (state().session.phase === 'running') {
      const { prompt } = card();
      items.push(prompt.item);
      expect(prompt).toEqual(tunePrompt(prompt.item, -6));
      listen();
      for (const midi of prompt.notes) controller.press(midi, now() + 50);
      wait(ADVANCE_DELAY_MS);
    }
    expect(items).toEqual([
      'tune:trad-amazing-grace:1',
      'tune:trad-amazing-grace:2',
      'tune:trad-amazing-grace:3',
      'tune:trad-amazing-grace:4',
      'tune:trad-amazing-grace:whole',
    ]);
    const { answers, sessions } = practice.getSnapshot();
    expect(answers).toEqual(
      Array(5).fill(expect.objectContaining({ key: { tonic: 'Db', scale: 'major' } })),
    );
    expect(sessions).toEqual([
      expect.objectContaining({
        kind: 'ear',
        family: 'tune',
        level: 'trad-amazing-grace',
        length: 5,
        items: 5,
        accuracy: 1,
        key: { tonic: 'Db', scale: 'major' },
      }),
    ]);

    // In its own key nothing is drawn: G major, whatever the rng.
    controller.start({ ...GRACE, tuneKey: 'own' });
    expect(state().session.key).toEqual({ tonic: 'G', scale: 'major' });
    expect(card().prompt.tune?.semitones).toBe(0);
  });

  it('after a wrong key plays the phrase again alone, and so does Hear again', () => {
    const { controller, played, card, now, listen } = setup();
    controller.start(GRACE);
    listen();
    const { prompt } = card();
    // Hear again before the answer: the chord and the phrase, counted.
    controller.hearAgain();
    expect(midis(played[1]!.notes)).toEqual([55, 59, 62, ...prompt.notes]);
    expect(card().replays).toBe(1);
    listen();
    controller.press(prompt.notes[0]!, now() + 100);
    controller.press(prompt.notes[1]! + 2, now() + 200);
    expect(card()).toMatchObject({ status: 'wrong', answer: [62, 69] });
    // The correction: the phrase in its rhythm, without the chord.
    expect(midis(played[2]!.notes)).toEqual(prompt.notes);
    expect(played[2]!.start).toBe(now() + CORRECTION_LEAD_MS);
    expect(played[2]!.notes[0]!.on).toBe(0);
    // Hear again now is the same, and is not counted.
    controller.hearAgain();
    expect(midis(played[3]!.notes)).toEqual(prompt.notes);
    expect(card().replays).toBe(1);
    listen();
    controller.press(60, now() + 10);
    expect(card().prompt.item).toBe('tune:trad-amazing-grace:2');
  });

  it('plays the phrase the whole tune went wrong in', () => {
    const { controller, played, practice, card, now, listen, wait } = setup();
    controller.start(GRACE);
    for (let i = 0; i < 4; i++) {
      listen();
      for (const midi of card().prompt.notes) controller.press(midi, now() + 50);
      wait(ADVANCE_DELAY_MS);
    }
    const { prompt } = card();
    expect(prompt.item).toBe('tune:trad-amazing-grace:whole');
    expect(prompt.notes).toHaveLength(35);
    listen();
    // Right up to the fourth key of the third line (keys 16–27), which goes wrong.
    for (const midi of prompt.notes.slice(0, 19)) controller.press(midi, now() + 50);
    const before = played.length;
    controller.press(prompt.notes[19]! + 1, now() + 60);
    expect(card().status).toBe('wrong');
    expect(practice.getSnapshot().answers.at(-1)).toMatchObject({
      item: 'tune:trad-amazing-grace:whole',
      correct: false,
      answer: [...prompt.notes.slice(0, 19), prompt.notes[19]! + 1],
    });
    expect(played).toHaveLength(before + 1);
    expect(midis(played.at(-1)!.notes)).toEqual(prompt.notes.slice(16, 28));
    controller.hearAgain();
    expect(midis(played.at(-1)!.notes)).toEqual(prompt.notes.slice(16, 28));
  });
});

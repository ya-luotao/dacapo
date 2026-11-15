import { describe, expect, it } from 'vitest';
import { RELEASE_GAP_MS } from '../../core/playback.ts';
import {
  MAX_PHRASE_EVENTS,
  MAX_PHRASE_MS,
  MIN_NOTE_MS,
  buildPhrasePlan,
  createPhraseRecorder,
  formatDuration,
  soundingKeysAt,
} from './phraseRecorder.ts';

describe('phraseRecorder', () => {
  it('ignores empty takes and only-sustain or orphan-off takes', () => {
    const empty = createPhraseRecorder();
    expect(empty.finish(5000)).toBeNull();

    const silent = createPhraseRecorder();
    silent.push({ type: 'sustain', down: true, time: 100 });
    silent.push({ type: 'off', midi: 60, velocity: 0, time: 200 });
    silent.push({ type: 'sustain', down: false, time: 300 });
    expect(silent.hasStarted()).toBe(false);
    expect(silent.elapsed(500)).toBe(0);
    expect(silent.finish(1000)).toBeNull();
  });

  it('trims dead silence before first onset and pairs note on/off events', () => {
    const rec = createPhraseRecorder();
    rec.push({ type: 'on', midi: 60, velocity: 90, time: 2500 });
    rec.push({ type: 'on', midi: 64, velocity: 84, time: 2700 });
    rec.push({ type: 'off', midi: 60, velocity: 0, time: 2850 });
    rec.push({ type: 'off', midi: 64, velocity: 0, time: 3100 });

    expect(rec.hasStarted()).toBe(true);
    expect(rec.elapsed(4000)).toBe(1500);

    const phrase = rec.finish(3300);
    expect(phrase).not.toBeNull();
    expect(phrase!.notes).toEqual([
      { midi: 60, on: 0, off: 350, velocity: 90 },
      { midi: 64, on: 200, off: 600, velocity: 84 },
    ]);
    expect(phrase!.length).toBe(720);
  });

  it('closes still-held notes at max(stopAt, on + MIN_NOTE_MS) and clamps length', () => {
    const rec = createPhraseRecorder();
    rec.push({ type: 'on', midi: 60, velocity: 72, time: 1000 });
    const phrase = rec.finish(1020);
    expect(phrase).not.toBeNull();
    expect(phrase!.notes).toEqual([{ midi: 60, on: 0, off: MIN_NOTE_MS, velocity: 72 }]);
    expect(phrase!.length).toBe(MIN_NOTE_MS + 120);

    const longHeld = createPhraseRecorder();
    longHeld.push({ type: 'on', midi: 62, velocity: 64, time: 100 });
    const longPhrase = longHeld.finish(600);
    expect(longPhrase!.notes).toEqual([{ midi: 62, on: 0, off: 500, velocity: 64 }]);
    expect(longPhrase!.length).toBe(620);
  });

  it('handles zero-duration tap events with MIN_NOTE_MS', () => {
    const rec = createPhraseRecorder();
    rec.push({ type: 'on', midi: 67, velocity: 70, time: 400 });
    rec.push({ type: 'off', midi: 67, velocity: 0, time: 400 });
    const phrase = rec.finish(500);
    expect(phrase!.notes).toEqual([{ midi: 67, on: 0, off: MIN_NOTE_MS, velocity: 70 }]);
  });

  it('separates repeated same-key strikes by at least RELEASE_GAP_MS', () => {
    const rec = createPhraseRecorder();
    rec.push({ type: 'on', midi: 60, velocity: 80, time: 1000 });
    rec.push({ type: 'off', midi: 60, velocity: 0, time: 1190 });
    rec.push({ type: 'on', midi: 60, velocity: 85, time: 1200 });
    rec.push({ type: 'off', midi: 60, velocity: 0, time: 1400 });

    const phrase = rec.finish(1500);
    expect(phrase!.notes[0]!.off).toBe(200 - RELEASE_GAP_MS);
    expect(phrase!.notes[1]!.on - phrase!.notes[0]!.off).toBeGreaterThanOrEqual(RELEASE_GAP_MS);
  });

  it('records sustain pedal CC64 controls including pedal already down at onset', () => {
    const rec = createPhraseRecorder();
    rec.push({ type: 'sustain', down: true, time: 50 });
    rec.push({ type: 'on', midi: 60, velocity: 75, time: 200 });
    rec.push({ type: 'sustain', down: true, time: 250 }); // duplicate state ignored
    rec.push({ type: 'sustain', down: false, time: 450 });
    rec.push({ type: 'off', midi: 60, velocity: 0, time: 500 });

    const phrase = rec.finish(600);
    expect(phrase!.controls).toEqual([
      { at: 0, controller: 64, value: 127 },
      { at: 250, controller: 64, value: 0 },
    ]);
  });

  it('enforces MAX_PHRASE_EVENTS and MAX_PHRASE_MS bounds', () => {
    const many = createPhraseRecorder();
    for (let i = 0; i < MAX_PHRASE_EVENTS + 100; i++) {
      many.push({ type: 'on', midi: 60 + (i % 12), velocity: 70, time: 1000 + i * 20 });
      many.push({ type: 'off', midi: 60 + (i % 12), velocity: 0, time: 1010 + i * 20 });
    }
    const bounded = many.finish(100_000);
    expect(bounded).not.toBeNull();
    expect(bounded!.notes.length).toBeLessThanOrEqual(MAX_PHRASE_EVENTS / 2);

    const long = createPhraseRecorder();
    long.push({ type: 'on', midi: 60, velocity: 70, time: 0 });
    long.push({ type: 'off', midi: 60, velocity: 0, time: MAX_PHRASE_MS + 50_000 });
    long.push({ type: 'on', midi: 64, velocity: 70, time: MAX_PHRASE_MS + 10 });
    const longPhrase = long.finish(MAX_PHRASE_MS + 60_000);
    expect(longPhrase!.notes).toEqual([{ midi: 60, on: 0, off: MAX_PHRASE_MS, velocity: 70 }]);
    expect(longPhrase!.length).toBe(MAX_PHRASE_MS);
  });

  it('builds DemoPlan with unique sorted cues and separates loop wrap-around repeats', () => {
    const plan = buildPhrasePlan(
      {
        notes: [
          { midi: 60, on: 0, off: 120, velocity: 72 },
          { midi: 64, on: 0, off: 200, velocity: 72 },
          { midi: 60, on: 300, off: 495, velocity: 72 },
        ],
        controls: [{ at: 50, controller: 64, value: 127 }],
        length: 500,
      },
      true,
    );

    expect(plan.loop).toBe(true);
    expect(plan.start).toBe(0);
    expect(plan.steps).toEqual([]);
    // Last C4 (60) wraps to first C4 (60) at 500, so off is pulled back by RELEASE_GAP_MS.
    const lastC4 = plan.notes.find((n) => n.midi === 60 && n.on === 300)!;
    expect(500 - lastC4.off).toBeGreaterThanOrEqual(RELEASE_GAP_MS);
    expect(plan.cues).toEqual([0, 120, 200, 300, 500 - RELEASE_GAP_MS]);

    expect([...soundingKeysAt(plan, 0)].sort()).toEqual([60, 64]);
    expect([...soundingKeysAt(plan, 120)]).toEqual([64]);
    expect([...soundingKeysAt(plan, 200)]).toEqual([]);
    expect([...soundingKeysAt(plan, 350)]).toEqual([60]);
    expect([...soundingKeysAt(plan, 500)].sort()).toEqual([60, 64]); // loops cleanly
  });

  it('returns empty sounding keys past length for non-looping plans and formats durations', () => {
    const plan = buildPhrasePlan(
      {
        notes: [{ midi: 60, on: 0, off: 100, velocity: 72 }],
        controls: [],
        length: 220,
      },
      false,
    );

    expect([...soundingKeysAt(plan, -1)]).toEqual([]);
    expect([...soundingKeysAt(plan, 99)]).toEqual([60]);
    expect([...soundingKeysAt(plan, 100)]).toEqual([]);
    expect([...soundingKeysAt(plan, 220)]).toEqual([]);

    expect(formatDuration(-500)).toBe('0:00');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(4200)).toBe('0:04');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(300_000)).toBe('5:00');
  });
});

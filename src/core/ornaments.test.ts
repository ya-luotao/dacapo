import { describe, expect, it } from 'vitest';
import type { GraceNote, Ornament } from './markings.ts';
import { GRACE_MAX_MS, ORNAMENT_MAX_MS, realise, type Principal } from './ornaments.ts';

const C5 = 72;

function principal(options: Partial<Principal> = {}): Principal {
  // A quarter note at ♩ = 120: 500 ms, a thirty-second 62.5 ms.
  return { midi: C5, on: 1000, off: 1500, thirtySecond: 62.5, appoggiatura: 250, ...options };
}

function grace(midi: number, slash = true, chord = false): GraceNote {
  return { id: `g${midi}`, midi, pitch: { step: 'D', alter: 0, octave: 5 }, slash, chord };
}

const ornament = (kind: Ornament['kind'], extra: Partial<Ornament> = {}): Ornament => ({
  kind,
  upper: 74,
  lower: 71,
  ...extra,
});

const keys = (notes: { midi: number; on: number; off: number }[]) =>
  notes.map((n) => `${n.midi}:${n.on}-${n.off}`);

describe('realise', () => {
  it('plays a plain note as it is', () => {
    expect(keys(realise(principal()))).toEqual(['72:1000-1500']);
  });

  it('puts an acciaccatura just before the beat, a thirty-second of at most 80 ms', () => {
    expect(keys(realise(principal({ graces: [grace(74)] })))).toEqual([
      '74:937.5-1000',
      '72:1000-1500',
    ]);
    // Slow: the thirty-second is 125 ms, the grace note 80.
    const slow = realise(principal({ thirtySecond: 125, graces: [grace(74)] }));
    expect(keys(slow)).toEqual([`74:${1000 - GRACE_MAX_MS}-1000`, '72:1000-1500']);
  });

  it('plays a group of grace notes before the beat, a chord of them at once', () => {
    const notes = realise(
      principal({ graces: [grace(76, false), grace(79, false, true), grace(74, false)] }),
    );
    expect(keys(notes)).toEqual(['76:875-937.5', '79:875-937.5', '74:937.5-1000', '72:1000-1500']);
  });

  it('puts an appoggiatura on the beat, taking its share of the note', () => {
    expect(keys(realise(principal({ graces: [grace(74, false)] })))).toEqual([
      '74:1000-1250',
      '72:1250-1500',
    ]);
  });

  it('never sounds before the floor: the figure starts there and the note after it', () => {
    expect(keys(realise(principal({ graces: [grace(74)] }), 1000))).toEqual([
      '74:1000-1062.5',
      '72:1062.5-1500',
    ]);
  });

  it('plays mordents on the beat in thirty-seconds of at most 70 ms', () => {
    expect(keys(realise(principal({ ornaments: [ornament('mordent')] })))).toEqual([
      '72:1000-1062.5',
      '71:1062.5-1125',
      '72:1125-1500',
    ]);
    expect(keys(realise(principal({ ornaments: [ornament('inverted-mordent')] })))).toEqual([
      '72:1000-1062.5',
      '74:1062.5-1125',
      '72:1125-1500',
    ]);
    const slow = realise(principal({ thirtySecond: 125, ornaments: [ornament('mordent')] }));
    expect(slow[1]).toEqual({
      midi: 71,
      on: 1000 + ORNAMENT_MAX_MS,
      off: 1000 + 2 * ORNAMENT_MAX_MS,
    });
    // A long one alternates twice.
    const long = realise(principal({ ornaments: [ornament('inverted-mordent', { long: true })] }));
    expect(long.map((n) => n.midi)).toEqual([72, 74, 72, 74, 72]);
  });

  it('shortens a mordent to fit a short note', () => {
    const short = realise(principal({ off: 1090, ornaments: [ornament('mordent')] }));
    expect(keys(short)).toEqual(['72:1000-1030', '71:1030-1060', '72:1060-1090']);
  });

  it('turns upper–principal–lower–principal, the inverted turn the other way, a delayed one at the end', () => {
    expect(realise(principal({ ornaments: [ornament('turn')] })).map((n) => n.midi)).toEqual([
      74, 72, 71, 72,
    ]);
    expect(
      realise(principal({ ornaments: [ornament('inverted-turn')] })).map((n) => n.midi),
    ).toEqual([71, 72, 74, 72]);
    expect(keys(realise(principal({ ornaments: [ornament('delayed-turn')] })))).toEqual([
      '72:1000-1250',
      '74:1250-1312.5',
      '72:1312.5-1375',
      '71:1375-1437.5',
      '72:1437.5-1500',
    ]);
  });

  it('trills in thirty-seconds from the principal, ending on it', () => {
    const notes = realise(principal({ ornaments: [ornament('trill')] }));
    // 500 ms: eight thirty-seconds, the last upper one dropped so it ends on the principal.
    expect(notes.map((n) => n.midi)).toEqual([72, 74, 72, 74, 72, 74, 72]);
    expect(notes.at(-1)).toEqual({ midi: 72, on: 1375, off: 1500 });
    expect(notes[1]).toEqual({ midi: 74, on: 1062.5, off: 1125 });
  });

  it('starts a trill on the upper note when asked, and closes it with a written turn', () => {
    const upper = realise(principal({ ornaments: [ornament('trill')] }), -Infinity, {
      trillStart: 'upper',
    });
    expect(upper.map((n) => n.midi)).toEqual([74, 72, 74, 72, 74, 72, 74, 72]);
    const closed = realise(principal({ ornaments: [ornament('trill'), ornament('turn')] }));
    expect(closed.map((n) => n.midi)).toEqual([72, 74, 72, 74, 72, 71, 72]);
  });

  it('plays a trill too short to alternate as an inverted mordent', () => {
    const short = realise(principal({ off: 1150, ornaments: [ornament('trill')] }));
    expect(short.map((n) => n.midi)).toEqual([72, 74, 72]);
  });

  it('plays an appoggiatura, then the ornament on what is left of the note', () => {
    const notes = realise(
      principal({ graces: [grace(74, false)], ornaments: [ornament('mordent')] }),
    );
    expect(keys(notes)).toEqual([
      '74:1000-1250',
      '72:1250-1312.5',
      '71:1312.5-1375',
      '72:1375-1500',
    ]);
  });
});

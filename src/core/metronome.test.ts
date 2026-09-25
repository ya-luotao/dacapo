import { describe, expect, it } from 'vitest';
import { beatTicks, clicks, countIn, isCompound } from './metronome.ts';
import { playSpan, timeline } from './playback.ts';
import { performanceOrder } from './repeats.ts';
import { bar, bars, Q, score } from './scoreFixtures.ts';

const at = (list: { at: number; accent: boolean }[]) =>
  list.map((c) => `${Math.round(c.at)}${c.accent ? '!' : ''}`);

describe('metronome', () => {
  it('clicks every quarter in 4/4, the downbeat accented, at the tempo', () => {
    const s = score(bars(2), [], [{ tick: 0, bpm: 120 }]);
    const order = performanceOrder(s.measures);
    const ms = timeline(s, order);
    expect(at(clicks(s, order, 0, 1, ms, 0))).toEqual([
      '0!',
      '500',
      '1000',
      '1500',
      '2000!',
      '2500',
      '3000',
      '3500',
    ]);
    // Half the tempo, twice the time.
    expect(at(clicks(s, order, 0, 0, timeline(s, order, 0.5), 0))).toEqual([
      '0!',
      '1000',
      '2000',
      '3000',
    ]);
  });

  it('compound meters click the dotted beat; 3/8 and 3/4 click every beat', () => {
    expect(isCompound({ beats: 6, beatType: 8 })).toBe(true);
    expect(isCompound({ beats: 12, beatType: 8 })).toBe(true);
    expect(isCompound({ beats: 9, beatType: 16 })).toBe(true);
    expect(isCompound({ beats: 3, beatType: 8 })).toBe(false);
    expect(isCompound({ beats: 6, beatType: 4 })).toBe(false);
    expect(beatTicks({ beats: 6, beatType: 8 })).toEqual({ beat: 1.5 * Q, bar: 3 * Q });

    const six = score(bars(1, 6, 8), [], [{ tick: 0, bpm: 60 }]);
    const order = performanceOrder(six.measures);
    // ♩ = 60: a dotted quarter is 1.5 s; two clicks per bar.
    expect(at(clicks(six, order, 0, 0, timeline(six, order), 0))).toEqual(['0!', '1500']);

    const three = score(bars(1, 3, 8), [], [{ tick: 0, bpm: 60 }]);
    const o3 = performanceOrder(three.measures);
    expect(at(clicks(three, o3, 0, 0, timeline(three, o3), 0))).toEqual(['0!', '500', '1000']);
  });

  it('a pickup clicks as the end of a full bar, a short last bar from its start', () => {
    // 3/4 with a one-beat pickup, one full bar, and a two-beat last bar.
    const measures = [
      bar(0, 0, { beats: 3, duration: Q }),
      bar(1, Q, { beats: 3 }),
      bar(2, 4 * Q, { beats: 3, duration: 2 * Q }),
    ];
    const s = score(measures, [], [{ tick: 0, bpm: 60 }]);
    const order = performanceOrder(measures);
    expect(at(clicks(s, order, 0, 2, timeline(s, order), 0))).toEqual([
      '0', // the pickup is beat 3, not accented
      '1000!',
      '2000',
      '3000',
      '4000!',
      '5000',
    ]);
  });

  it('counts in one full bar, and a pickup gets the beats before it', () => {
    const plain = score(bars(2), [], [{ tick: 0, bpm: 120 }]);
    const order = performanceOrder(plain.measures);
    const ms = timeline(plain, order);
    const span = playSpan(plain, order, null, 1)!;
    // Starting at bar 2 (2 s in): the four beats before it.
    expect(at(countIn(plain, order, span, ms, 0))).toEqual(['0!', '500', '1000', '1500']);

    const measures = [bar(0, 0, { beats: 3, duration: Q }), bar(1, Q, { beats: 3 })];
    const s = score(measures, [], [{ tick: 0, bpm: 60 }]);
    const o = performanceOrder(measures);
    const pickup = countIn(s, o, playSpan(s, o, null, 0)!, timeline(s, o), 0);
    // "1 2 3 | 1 2" and the pickup comes on 3, at 0.
    expect(at(pickup)).toEqual(['-5000!', '-4000', '-3000', '-2000!', '-1000']);
  });

  it('follows a tempo mark inside the piece and repeats', () => {
    const measures = [
      bar(0, 0, { repeat: { forward: true, backwardTimes: null, ending: [] } }),
      bar(1, 4 * Q, { repeat: { forward: false, backwardTimes: 2, ending: [] } }),
    ];
    const s = score(
      measures,
      [],
      [
        { tick: 0, bpm: 60 },
        { tick: 4 * Q, bpm: 120 },
      ],
    );
    const order = performanceOrder(measures);
    const list = clicks(s, order, 0, order.length - 1, timeline(s, order), 0);
    expect(at(list)).toEqual([
      '0!',
      '1000',
      '2000',
      '3000',
      '4000!',
      '4500',
      '5000',
      '5500',
      '6000!',
      '7000',
      '8000',
      '9000',
      '10000!',
      '10500',
      '11000',
      '11500',
    ]);
  });
});

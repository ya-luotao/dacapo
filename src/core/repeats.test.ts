import { describe, expect, it } from 'vitest';
import {
  firstOccurrence,
  performanceOrder,
  playOrder,
  resolveLoop,
  writtenOrder,
  type PlayedMeasure,
} from './repeats.ts';
import type { Repeat } from './score.ts';

const Q = 960;

/** Bars of one quarter each; `spec` per bar: '|:' forward, ':|' or ':|3' backward, '[1' volta. */
function bars(spec: string[]) {
  let ending: number[] = [];
  return spec.map((s) => {
    const start = /\[([\d,]+)/.exec(s);
    if (start) ending = start[1]!.split(',').map(Number);
    const backward = /:\|(\d)?/.exec(s);
    const repeat: Repeat = {
      forward: s.includes('|:'),
      backwardTimes: backward ? Number(backward[1] ?? 2) : null,
      ending,
    };
    if (s.includes(']')) ending = [];
    return { duration: Q, repeat };
  });
}

const show = (order: PlayedMeasure[]) => order.map((p) => `${p.measure}.${p.pass}`);

describe('performanceOrder', () => {
  it('plays a simple repeat twice, from the start or from |:', () => {
    expect(show(performanceOrder(bars(['', ':|'])))).toEqual(['0.1', '1.1', '0.2', '1.2']);
    expect(show(performanceOrder(bars(['', '|:', ':|', ''])))).toEqual([
      '0.1',
      '1.1',
      '2.1',
      '1.2',
      '2.2',
      '3.1',
    ]);
  });

  it('honours times and multi-number voltas', () => {
    const order = performanceOrder(bars(['|:', '[1,2 ] :|3', '[3 ]', '']));
    expect(show(order)).toEqual(['0.1', '1.1', '0.2', '1.2', '0.3', '2.3', '3.1']);
  });

  it('lets a volta span several measures', () => {
    const order = performanceOrder(bars(['', '[1', '] :|', '[2 ]']));
    expect(show(order)).toEqual(['0.1', '1.1', '2.1', '0.2', '3.2']);
  });

  it('goes back after a first ending that lacks its repeat sign', () => {
    // As exported for Burgmüller's Arabesque (PDMX 5849868): `:|` only on the second ending.
    const order = performanceOrder(bars(['', '|:', '[1 ]', '[2 ] :|', '']));
    expect(show(order)).toEqual(['0.1', '1.1', '2.1', '1.2', '3.2', '4.1']);
  });

  it('accumulates performance ticks', () => {
    expect(performanceOrder(bars(['', ':|'])).map((p) => p.start)).toEqual([0, Q, 2 * Q, 3 * Q]);
  });

  it('stops on a malformed structure instead of looping forever', () => {
    const measures = bars(['', ':|']).map((m) => ({
      ...m,
      repeat: { ...m.repeat, backwardTimes: 1e9 },
    }));
    expect(performanceOrder(measures).length).toBe(32);
  });
});

describe('writtenOrder', () => {
  it('plays every bar once and only the last volta', () => {
    const measures = bars(['', '|:', '[1 ] :|', '[2 ]', '']);
    expect(show(writtenOrder(measures))).toEqual(['0.1', '1.1', '3.1', '4.1']);
    expect(writtenOrder(measures).map((p) => p.start)).toEqual([0, Q, 2 * Q, 3 * Q]);
  });

  it('takes the highest ending of a group, even across bars', () => {
    const measures = bars(['|:', '[1,2', '] :|3', '[3 ]', '']);
    expect(show(writtenOrder(measures))).toEqual(['0.1', '3.1', '4.1']);
    expect(show(playOrder(measures, 'skip'))).toEqual(show(writtenOrder(measures)));
    expect(show(playOrder(measures, 'play'))).toEqual(show(performanceOrder(measures)));
  });
});

describe('loops and start bars', () => {
  // Für Elise's shape: pickup, 7 bars, 1st ending, 2nd ending, then a second repeated section.
  const shape = bars([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '[1 ] :|',
    '[2 ]',
    '|:',
    '',
    '[1 ] :|',
    '[2 ]',
  ]);
  const order = performanceOrder(shape);

  it('finds the first time a bar is played', () => {
    expect(firstOccurrence(order, 3)).toBe(3);
    expect(firstOccurrence(order, 9)).toBe(17);
    expect(firstOccurrence(writtenOrder(shape), 8)).toBe(-1);
  });

  it('loops the first run from A to B that stays within the chosen bars', () => {
    // Bars 1–5: the first pass.
    expect(resolveLoop(order, 1, 5)).toEqual({ first: 1, last: 5 });
    // Bars 7 to the 2nd ending: the second pass only, not back to the pickup.
    const range = resolveLoop(order, 7, 9)!;
    expect(show(order.slice(range.first, range.last + 1))).toEqual(['7.2', '9.2']);
    // Bars 5 to 10 leave through the second ending.
    const across = resolveLoop(order, 5, 10)!;
    expect(order.slice(across.first, across.last + 1).map((p) => p.measure)).toEqual([
      5, 6, 7, 9, 10,
    ]);
  });

  it('keeps both passes when the whole repeat is chosen', () => {
    const whole = resolveLoop(order, 0, 13)!;
    expect(whole).toEqual({ first: 0, last: order.length - 1 });
  });

  it('falls back to the first run when every run leaves the range', () => {
    // From the 1st ending to bar 8 of... the 1st ending again is a one-bar loop.
    expect(resolveLoop(order, 8, 8)).toEqual({ first: 8, last: 8 });
    // Bar 12 (a 1st ending) to 13 (the 2nd): only reachable by going back to 10.
    const back = resolveLoop(order, 12, 13)!;
    expect(order.slice(back.first, back.last + 1).map((p) => p.measure)).toEqual([12, 10, 11, 13]);
  });

  it('has no loop over a bar that is never played', () => {
    expect(resolveLoop(writtenOrder(shape), 8, 9)).toBeNull();
  });
});

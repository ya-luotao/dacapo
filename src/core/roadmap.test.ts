import { describe, expect, it } from 'vitest';
import { roadOrder, type RoadBar } from './roadmap.ts';

/** The bars played, numbered from 1 as a score numbers them. */
const played = (bars: readonly RoadBar[]) => roadOrder(bars).map((i) => i + 1);

describe('the order a score is played in', () => {
  it('is the bars as written, without signs', () => {
    expect(played([{}, {}, {}])).toEqual([1, 2, 3]);
  });

  it('plays a repeat once more: from the beginning, or from its |:', () => {
    expect(played([{}, {}, { end: true }, {}])).toEqual([1, 2, 3, 1, 2, 3, 4]);
    expect(played([{}, { start: true }, { end: true }, {}])).toEqual([1, 2, 3, 2, 3, 4]);
  });

  it('plays two repeats one after the other, each from its own start', () => {
    expect(played([{ start: true }, { end: true }, { start: true }, { end: true }])).toEqual([
      1, 2, 1, 2, 3, 4, 3, 4,
    ]);
    // The second without its |: goes back to just after the first.
    expect(played([{}, { end: true }, {}, { end: true }])).toEqual([1, 2, 1, 2, 3, 4, 3, 4]);
  });

  it('plays the first ending the first time and the second after the repeat', () => {
    expect(played([{}, {}, { ending: [1], end: true }, { ending: [2] }, {}])).toEqual([
      1, 2, 3, 1, 2, 4, 5,
    ]);
    // An ending of two bars.
    expect(played([{}, { ending: [1] }, { ending: [1], end: true }, { ending: [2] }, {}])).toEqual([
      1, 2, 3, 1, 4, 5,
    ]);
  });

  it('goes back to the beginning at D.C. al Fine and stops at Fine', () => {
    expect(played([{}, { fine: true }, {}, { jump: { from: 'dc', to: 'fine' } }])).toEqual([
      1, 2, 3, 4, 1, 2,
    ]);
  });

  it('goes back to the segno at D.S. al Fine', () => {
    expect(
      played([{}, { segno: true }, { fine: true }, { jump: { from: 'ds', to: 'fine' } }]),
    ).toEqual([1, 2, 3, 4, 2, 3]);
  });

  it('leaves at To Coda for the coda after D.S. al Coda, and D.C. al Coda', () => {
    const bars: RoadBar[] = [
      {},
      { segno: true },
      { toCoda: true },
      { jump: { from: 'ds', to: 'coda' } },
      { coda: true },
      {},
    ];
    expect(played(bars)).toEqual([1, 2, 3, 4, 2, 3, 5, 6]);
    bars[3] = { jump: { from: 'dc', to: 'coda' } };
    expect(played(bars)).toEqual([1, 2, 3, 4, 1, 2, 3, 5, 6]);
  });

  it('plays to the end after a D.C. with nowhere to stop, and jumps only once', () => {
    expect(played([{}, { jump: { from: 'dc', to: 'end' } }, {}])).toEqual([1, 2, 1, 2, 3]);
  });

  it('takes no repeat after the jump back, and plays only the last ending', () => {
    expect(
      played([
        { start: true },
        { ending: [1], end: true },
        { ending: [2], fine: true },
        { jump: { from: 'dc', to: 'fine' } },
      ]),
    ).toEqual([1, 2, 1, 3, 4, 1, 3]);
    expect(
      played([{}, { end: true, fine: true }, {}, { jump: { from: 'dc', to: 'fine' } }]),
    ).toEqual([1, 2, 1, 2, 3, 4, 1, 2]);
  });

  it('stops where a jump has nowhere to go', () => {
    expect(played([{}, { jump: { from: 'ds', to: 'fine' } }, {}])).toEqual([1, 2]);
    expect(played([{}, { toCoda: true }, { jump: { from: 'dc', to: 'coda' } }, {}])).toEqual([
      1, 2, 3, 1, 2,
    ]);
  });

  it('never plays for ever, whatever the signs', () => {
    const tangled: RoadBar[] = Array.from({ length: 6 }, () => ({
      start: true,
      end: true,
      segno: true,
      jump: { from: 'ds', to: 'coda' },
      toCoda: true,
      coda: true,
    }));
    expect(roadOrder(tangled).length).toBeLessThanOrEqual(tangled.length * 4);
    expect(played([{ ending: [3] }, { ending: [4] }])).toEqual([]);
  });
});

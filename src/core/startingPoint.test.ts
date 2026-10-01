import { describe, expect, it } from 'vitest';
import { LEVEL_IDS } from './levels.ts';
import {
  DEFAULT_READS,
  DEFAULT_START,
  opensEverything,
  readingFloor,
  READS,
  readStartingPoint,
  type Reads,
  type StartingPoint,
} from './startingPoint.ts';

const player = (reads: Reads): StartingPoint => ({ from: 'player', reads });

describe('the starting point', () => {
  it('is new to the piano, or playing already with what is read', () => {
    expect(READS).toEqual(['treble', 'both', 'ledger', 'unknown']);
    // Unasked, the app does what it does for a newcomer; a player is assumed to read nothing yet.
    expect(DEFAULT_START).toEqual({ from: 'new' });
    expect(DEFAULT_READS).toBe('unknown');
  });

  it('is read back from the browser as it was written', () => {
    const answers: StartingPoint[] = [{ from: 'new' }, ...READS.map(player)];
    for (const answer of answers) {
      expect(readStartingPoint(JSON.parse(JSON.stringify(answer)))).toEqual(answer);
    }
    // Only what an answer can hold is kept.
    expect(readStartingPoint({ from: 'new', reads: 'both', more: 1 })).toEqual({ from: 'new' });
    expect(readStartingPoint({ from: 'player', reads: 'both', more: 1 })).toEqual(player('both'));
  });

  it('is no answer when it is anything else', () => {
    for (const value of [
      null,
      undefined,
      '',
      'new',
      1,
      true,
      [],
      [{ from: 'new' }],
      {},
      { from: 'teacher' },
      { from: 'player' },
      { from: 'player', reads: 'L5' },
      { from: 'player', reads: null },
      { from: ['new'] },
      { reads: 'both' },
    ]) {
      expect(readStartingPoint(value), JSON.stringify(value)).toBeNull();
    }
  });

  it('opens every practice for someone who plays already, and for no one else', () => {
    expect(opensEverything(null)).toBe(false);
    expect(opensEverything({ from: 'new' })).toBe(false);
    for (const reads of READS) expect(opensEverything(player(reads)), reads).toBe(true);
  });

  it('says where Read’s notes begin: the first level beyond what is read already', () => {
    expect(readingFloor(player('treble'))).toBe('L3');
    expect(readingFloor(player('both'))).toBe('L5');
    expect(readingFloor(player('ledger'))).toBe('L7');
    // "I would rather find out", a newcomer and no answer: no floor.
    expect(readingFloor(player('unknown'))).toBeNull();
    expect(readingFloor({ from: 'new' })).toBeNull();
    expect(readingFloor(null)).toBeNull();
    for (const reads of READS) {
      const floor = readingFloor(player(reads));
      if (floor !== null) expect(LEVEL_IDS).toContain(floor);
    }
  });
});

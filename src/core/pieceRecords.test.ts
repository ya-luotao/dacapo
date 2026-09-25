import { describe, expect, it } from 'vitest';
import { sampleHeader, sampleStep, T0 } from '../storage/fixtures.ts';
import {
  fnv1a,
  pieceChecksum,
  pieceSession,
  recoverPieceSession,
  stepId,
  type PieceStep,
} from './pieceRecords.ts';
import type { ScoreNote } from './score.ts';

const note = (onset: number, midi: number, hand: ScoreNote['hand'] = 'right') =>
  ({ onset, midi, duration: 480, hand }) as ScoreNote;

describe('piece checksum', () => {
  it('changes with any note, its length or its hand, and nothing else', () => {
    const notes = [note(0, 60), note(480, 62, 'left')];
    const base = pieceChecksum({ notes });
    expect(base).toMatch(/^[0-9a-f]{8}$/);
    expect(pieceChecksum({ notes: notes.map((n) => ({ ...n, id: 'other' })) })).toBe(base);
    expect(pieceChecksum({ notes: [note(0, 60), note(480, 63, 'left')] })).not.toBe(base);
    expect(pieceChecksum({ notes: [note(0, 60), note(480, 62, 'right')] })).not.toBe(base);
    expect(pieceChecksum({ notes: [notes[0]!, { ...notes[1]!, duration: 960 }] })).not.toBe(base);
    expect(fnv1a('')).toBe('811c9dc5');
  });
});

describe('piece sessions', () => {
  const steps: PieceStep[] = [
    sampleStep('r1', 0, { ms: 900, wrong: 0, at: T0 + 900 }),
    sampleStep('r1', 1, { ms: 1_200, wrong: 2, at: T0 + 2_100 }),
    // A step left for ten minutes counts as the idle limit.
    sampleStep('r1', 2, { ms: 600_000, wrong: 1, at: T0 + 602_100 }),
  ];

  it('adds up the time on the steps, capped, and the wrong notes', () => {
    const session = pieceSession(sampleHeader('r1'), steps, true);
    expect(session).toEqual({
      kind: 'piece',
      ...sampleHeader('r1'),
      endedAt: T0 + 602_100,
      activeMs: 900 + 1_200 + 60_000,
      steps: 3,
      wrong: 3,
      completed: true,
    });
  });

  it('is rebuilt from its header and its own steps, in order, not completed', () => {
    const other = sampleStep('r2', 0, { at: T0 + 5 });
    const recovered = recoverPieceSession(sampleHeader('r1'), [steps[2]!, other, steps[0]!]);
    expect(recovered).toMatchObject({ id: 'r1', steps: 2, wrong: 1, completed: false });
    expect(recovered!.endedAt).toBe(T0 + 602_100);
    expect(recoverPieceSession(sampleHeader('r1'), [other])).toBeNull();
  });

  it('numbers step ids so they sort in order', () => {
    expect(stepId('abc', 7)).toBe('abc:00007');
    expect(stepId('abc', 12) > stepId('abc', 9)).toBe(true);
  });
});

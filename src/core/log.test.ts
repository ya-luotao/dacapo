import { describe, expect, it } from 'vitest';
import { byStartDescending, byTime, recoverReadSessions, type SessionRecord } from './log.ts';
import type { Attempt } from './session.ts';

const T = 1_700_000_000_000;

const attempt = (id: string, sessionId: string, at: number, correct = true): Attempt => ({
  id,
  sessionId,
  level: 'L1',
  note: 'E4@treble',
  target: 64,
  played: correct ? 64 : 65,
  correct,
  ms: 900,
  hinted: false,
  timedOut: false,
  at,
});

const free = (id: string, startedAt: number): SessionRecord => ({
  kind: 'free',
  id,
  startedAt,
  endedAt: startedAt + 20_000,
  activeMs: 20_000,
  notes: 30,
});

describe('recoverReadSessions', () => {
  it('rebuilds a session for attempts whose session was never stored', () => {
    const attempts = [
      attempt('a1', 'known', T),
      attempt('a2', 'lost', T + 10_000),
      attempt('a3', 'lost', T + 12_000, false),
    ];
    const recovered = recoverReadSessions(attempts, [free('known', T - 1000)]);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      kind: 'read',
      id: 'lost',
      level: 'L1',
      cards: 2,
      correct: 1,
      length: 2,
      startedAt: T + 10_000 - 900,
      endedAt: T + 12_000,
      missed: ['E4@treble'],
    });
  });

  it('finds nothing when every attempt has its session', () => {
    expect(recoverReadSessions([attempt('a1', 's', T)], [free('s', T)])).toEqual([]);
  });
});

describe('ordering', () => {
  it('orders attempts by time, then id, and sessions newest first', () => {
    const attempts = [attempt('b', 's', T), attempt('c', 's', T - 1), attempt('a', 's', T)];
    expect(attempts.sort(byTime).map((a) => a.id)).toEqual(['c', 'a', 'b']);
    const sessions = [free('x', T), free('y', T + 1), free('w', T)];
    expect(sessions.sort(byStartDescending).map((s) => s.id)).toEqual(['y', 'w', 'x']);
  });
});

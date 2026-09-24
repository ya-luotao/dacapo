import { IDLE_MS } from './activity.ts';

// Free play is time spent playing on the Play route. A session starts on the first note-on, stays
// open while there is activity (note on/off, pedal) at least every IDLE_MS, and lasts from the
// first note to the last activity: the idle tail is not practice. All times are epoch ms.

/** Shorter sessions are not recorded. */
export const MIN_FREE_PLAY_MS = 10_000;

/** A free-play session still in progress. Plain data, so it can be saved while it runs. */
export interface OpenFreePlay {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  /** Note-ons so far. */
  notes: number;
}

export interface FreePlaySession {
  kind: 'free';
  id: string;
  startedAt: number;
  /** The last activity. */
  endedAt: number;
  activeMs: number;
  notes: number;
}

export type FreePlayEvent =
  | { type: 'note-on'; at: number }
  /** Note-off or a pedal change: keeps a session open, never starts one. */
  | { type: 'activity'; at: number }
  /** Time passes: ends the session once it has been idle for `IDLE_MS`. */
  | { type: 'tick'; at: number }
  /** Left the Play route, hid the tab or closed the page. */
  | { type: 'stop' };

export interface FreePlayStep {
  open: OpenFreePlay | null;
  /** The session that just ended, if it was long enough to record. */
  finished: FreePlaySession | null;
  /** A session ended (recorded or too short); its saved progress can be dropped. */
  ended: OpenFreePlay | null;
}

/** Turns a session that ended into what gets recorded, or null if it was too short. */
export function closeFreePlay(open: OpenFreePlay): FreePlaySession | null {
  const activeMs = open.lastActivityAt - open.startedAt;
  if (activeMs < MIN_FREE_PLAY_MS) return null;
  return {
    kind: 'free',
    id: open.id,
    startedAt: open.startedAt,
    endedAt: open.lastActivityAt,
    activeMs,
    notes: open.notes,
  };
}

function isIdle(open: OpenFreePlay, at: number): boolean {
  return at - open.lastActivityAt >= IDLE_MS;
}

export function stepFreePlay(
  open: OpenFreePlay | null,
  event: FreePlayEvent,
  newId: () => string,
): FreePlayStep {
  const end = (next: OpenFreePlay | null): FreePlayStep => ({
    open: next,
    finished: open ? closeFreePlay(open) : null,
    ended: open,
  });
  const same = (next: OpenFreePlay | null): FreePlayStep => ({
    open: next,
    finished: null,
    ended: null,
  });

  switch (event.type) {
    case 'note-on': {
      const fresh = () => ({
        id: newId(),
        startedAt: event.at,
        lastActivityAt: event.at,
        notes: 1,
      });
      if (!open) return same(fresh());
      if (isIdle(open, event.at)) return end(fresh());
      return same({
        ...open,
        lastActivityAt: Math.max(open.lastActivityAt, event.at),
        notes: open.notes + 1,
      });
    }
    case 'activity':
      if (!open) return same(null);
      if (isIdle(open, event.at)) return end(null);
      return same({ ...open, lastActivityAt: Math.max(open.lastActivityAt, event.at) });
    case 'tick':
      return open && isIdle(open, event.at) ? end(null) : same(open);
    case 'stop':
      return open ? end(null) : same(null);
  }
}

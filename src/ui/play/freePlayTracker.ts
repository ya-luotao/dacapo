import { stepFreePlay, type FreePlayEvent, type OpenFreePlay } from '../../core/freePlay.ts';
import type { HubEvent } from '../../input/index.ts';
import type { PracticeStore } from '../practice/store.ts';

/** How often an open session checks for idleness. */
export const FREE_PLAY_TICK_MS = 5_000;
/**
 * How often a running session is saved (when it changed), so closing the tab loses at most about
 * this much: writes started while the page unloads are not reliably committed.
 */
export const FREE_PLAY_SAVE_MS = 10_000;

export interface FreePlayTrackerOptions {
  onHubEvent: (listener: (event: HubEvent) => void) => () => void;
  practice: Pick<PracticeStore, 'saveOpenFreePlay' | 'finishFreePlay'>;
  /** False while the tab is hidden: notes played then do not count. */
  isVisible?: () => boolean;
  /** Epoch ms. */
  now?: () => number;
  newId?: () => string;
  setInterval?: (run: () => void, ms: number) => number;
  clearInterval?: (id: number) => void;
}

export interface FreePlayTracker {
  getOpen: () => OpenFreePlay | null;
  /** Ends the running session, e.g. when the tab is hidden or the page is closing. */
  end: () => void;
  /** Ends the running session and stops listening. */
  dispose: () => void;
}

/**
 * Counts free play while it is mounted (on the Play route): turns hub events into free-play
 * sessions, records the finished ones and keeps the running one saved.
 */
export function createFreePlayTracker({
  onHubEvent,
  practice,
  isVisible = () => true,
  now = Date.now,
  newId = () => crypto.randomUUID(),
  setInterval = (run, ms) => window.setInterval(run, ms),
  clearInterval = (id) => window.clearInterval(id),
}: FreePlayTrackerOptions): FreePlayTracker {
  let open: OpenFreePlay | null = null;
  let savedAt: number | null = null;
  let savedVersion: OpenFreePlay | null = null;
  let timer: number | null = null;

  function step(event: FreePlayEvent) {
    const result = stepFreePlay(open, event, newId);
    const started = result.open !== null && result.open.id !== open?.id;
    open = result.open;
    if (result.ended) practice.finishFreePlay(result.ended.id, result.finished);
    if (started) savedAt = now();
    if (open && timer === null) {
      timer = setInterval(tick, FREE_PLAY_TICK_MS);
    } else if (!open && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function tick() {
    const at = now();
    step({ type: 'tick', at });
    if (open && open !== savedVersion && savedAt !== null && at - savedAt >= FREE_PLAY_SAVE_MS) {
      practice.saveOpenFreePlay(open);
      savedVersion = open;
      savedAt = at;
    }
  }

  const unsubscribe = onHubEvent((event) => {
    if (!isVisible()) return;
    if (event.type === 'on') step({ type: 'note-on', at: now() });
    else step({ type: 'activity', at: now() });
  });

  const end = () => step({ type: 'stop' });

  return {
    getOpen: () => open,
    end,
    dispose() {
      unsubscribe();
      end();
    },
  };
}

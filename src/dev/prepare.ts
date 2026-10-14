import { deleteDB } from 'idb';
import { parseNoteKey } from '../core/levels.ts';
import { recoverSummary, type Attempt } from '../core/session.ts';
import { DB_NAME, openDacapoDB } from '../storage/db.ts';
import { createIndexedDbRepository, type PracticeRepository } from '../storage/repository.ts';
import { devScenario } from './scenarios.ts';

const OWNER_KEY = 'dacapo.dev.scenario';
const OWNER = 'disposable-v1';

/** No random IDs or stored aggregates: use the same summary and stats paths as practice. */
async function seedProgress(repository: PracticeRepository, now: number): Promise<void> {
  const notes = ['C4@treble', 'D4@treble', 'E4@treble', 'F4@treble', 'G4@treble'];
  for (const daysAgo of [6, 4, 2, 1, 0]) {
    const day = new Date(now);
    day.setDate(day.getDate() - daysAgo);
    const at = day.getTime() - 900_000;
    const sessionId = `dev-reading-${daysAgo}`;
    const attempts: Attempt[] = Array.from({ length: 20 }, (_, i) => {
      const note = notes[i % notes.length]!;
      const target = parseNoteKey(note)!.midi;
      const correct = i % 4 !== 3;
      return {
        id: `${sessionId}-${i}`,
        sessionId,
        level: 'L1',
        note,
        target,
        played: correct ? target : target + 1,
        correct,
        ms: 600 + ((i * 373) % 2400),
        hinted: false,
        timedOut: false,
        at: at + i * 4000,
      };
    });
    for (const attempt of attempts) await repository.addAttempt(attempt);
    await repository.putSession({ kind: 'read', ...recoverSummary(attempts)! });
    await repository.putSession({
      kind: 'free',
      id: `dev-free-${daysAgo}`,
      startedAt: at + 120_000,
      endedAt: at + 780_000,
      activeMs: (5 + daysAgo) * 60_000,
      notes: 200 + daysAgo * 20,
    });
  }
}

/**
 * Own only an unused origin, then reset its disposable data on every page load. The dev entry
 * holds an origin-wide lock for the page's lifetime so a second tab cannot reset a running one.
 * Storage errors must stop startup, not silently seed a memory fallback.
 */
export async function prepareScenario(
  name: string,
  now: number,
  onBlocked: () => void,
): Promise<string> {
  const scenario = devScenario(name);
  if (navigator.serviceWorker?.controller) {
    throw new Error('A service worker controls this origin. Use a fresh browser profile.');
  }
  const prefs = Object.keys(localStorage).filter((key) => key.startsWith('dacapo.'));
  if (localStorage.getItem(OWNER_KEY) !== OWNER) {
    const databases = await indexedDB.databases();
    if (databases.length || prefs.length) {
      throw new Error('Existing data is not a dev scenario. Use a fresh browser profile.');
    }
    // Claim before writing anything else, so an interrupted seed can be retried on reload.
    localStorage.setItem(OWNER_KEY, OWNER);
  }

  await deleteDB(DB_NAME, { blocked: onBlocked });
  for (const key of prefs) if (key !== OWNER_KEY) localStorage.removeItem(key);
  localStorage.setItem('dacapo.locale', 'en');
  localStorage.setItem('dacapo.theme', 'light');
  if (scenario.name !== 'empty') {
    localStorage.setItem('dacapo.start', JSON.stringify({ from: 'player', reads: 'both' }));
    localStorage.setItem('dacapo.returning', '1');
  }

  const repository = createIndexedDbRepository(await openDacapoDB({ onBlocked }));
  try {
    if (scenario.name === 'progress') await seedProgress(repository, now);
  } finally {
    repository.close();
  }
  return scenario.hash;
}

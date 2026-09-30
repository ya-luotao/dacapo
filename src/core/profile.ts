import { canonical } from '../lib/canonical.ts';
import type { SessionRecord } from './log.ts';
import { parseExerciseKey } from './scales.ts';
import type { ScaleType, Tonic } from './scaleTypes.ts';
import { titleFromFile, type StoredPiece } from './storedPiece.ts';
import {
  currentStreak,
  dailyTotals,
  dayKey,
  longestStreak,
  yearGrid,
  type DayKey,
} from './streak.ts';

// The public profile (docs/PROFILE.md): the username rules, and the document a device publishes,
// built from what it has stored. Only what the chosen visibility shows goes in it.

export type ProfileVisibility = 'off' | 'private' | 'public';

/** The account's profile settings, as the service keeps them. */
export interface ProfileSettings {
  visibility: ProfileVisibility;
  /** `public` only: the activity names the pieces. */
  titles: boolean;
}

export const PROFILE_OFF: ProfileSettings = { visibility: 'off', titles: false };

export const PROFILE_VERSION = 1;
/** Serialized, at most this many bytes (the service's limit). */
export const MAX_PROFILE_BYTES = 256 * 1024;
/** Pieces and scales listed per day; the rest are counted. */
export const DAY_ITEMS = 5;
/** A piece's title is cut to this many characters, `…` included. */
export const TITLE_LENGTH = 80;

export type ActivityKind = 'read' | 'free' | 'piece' | 'scale';

export interface DayActivity {
  /** Active ms per kind practised that day. */
  kinds: Partial<Record<ActivityKind, number>>;
  /** The longest of the day, longest first; `title` only with `titles`. */
  pieces?: { title?: string; ms: number }[];
  morePieces?: number;
  scales?: { type: ScaleType; tonic: Tonic; ms: number }[];
  moreScales?: number;
}

export interface ProfileDocument {
  v: typeof PROFILE_VERSION;
  visibility: Exclude<ProfileVisibility, 'off'>;
  titles: boolean;
  /** The owner's local date when built. */
  today: DayKey;
  /** The owner's week start (1 Monday … 7 Sunday). */
  firstDay: number;
  /** Active ms per date of the year grid, days with practice only. */
  days: Record<DayKey, number>;
  streak: { current: number; longest: number };
  /** Over all time. */
  totals: { days: number; ms: number };
  /** `public` only, for the same dates as `days`. */
  activity?: Record<DayKey, DayActivity>;
}

export interface ProfileInput {
  sessions: readonly SessionRecord[];
  pieces: readonly StoredPiece[];
  settings: ProfileSettings;
  now: number;
  firstDay: number;
  /** For tests; the system zone when omitted. */
  timeZone?: string;
}

/** `text` cut to `length` characters (code points), the last one `…`, when longer. */
export function clip(text: string, length = TITLE_LENGTH): string {
  const chars = Array.from(text);
  return chars.length <= length ? text : `${chars.slice(0, length - 1).join('')}…`;
}

/** The longest `DAY_ITEMS` of `items`, longest first (ties by `key`), and how many are left out. */
function longest<T extends { ms: number }>(
  items: readonly T[],
  key: (item: T) => string,
): { top: T[]; more: number } {
  const sorted = [...items].sort(
    (a, b) => b.ms - a.ms || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0),
  );
  return { top: sorted.slice(0, DAY_ITEMS), more: Math.max(0, sorted.length - DAY_ITEMS) };
}

/**
 * The day kind a session counts as. The service accepts these kinds only and rejects a document
 * with any other, so ear training counts as reading (the nearest: drills by level, away from the
 * pieces) until the service learns an `ear` kind (docs/EAR.md, "Clarifications").
 */
function activityKind(session: SessionRecord): ActivityKind {
  return session.kind === 'ear' ? 'read' : session.kind;
}

function dayActivity(
  sessions: readonly SessionRecord[],
  titles: ReadonlyMap<string, string>,
  withTitles: boolean,
): DayActivity {
  const kinds: Partial<Record<ActivityKind, number>> = {};
  const pieces = new Map<string, { id: string; title: string; ms: number }>();
  const scales = new Map<string, { type: ScaleType; tonic: Tonic; ms: number }>();
  for (const session of sessions) {
    if (session.activeMs > 0) {
      const kind = activityKind(session);
      kinds[kind] = (kinds[kind] ?? 0) + session.activeMs;
    }
    if (session.kind === 'piece') {
      const piece = pieces.get(session.pieceId) ?? {
        id: session.pieceId,
        title: titles.get(session.pieceId) ?? '',
        ms: 0,
      };
      piece.ms += session.activeMs;
      pieces.set(session.pieceId, piece);
    } else if (session.kind === 'scale') {
      for (const run of session.runs) {
        const exercise = parseExerciseKey(run.exercise);
        if (!exercise) continue;
        const key = `${exercise.type}:${exercise.tonic}`;
        const scale = scales.get(key) ?? { type: exercise.type, tonic: exercise.tonic, ms: 0 };
        scale.ms += Math.max(0, run.endedAt - run.startedAt);
        scales.set(key, scale);
      }
    }
  }

  const activity: DayActivity = {
    kinds: Object.fromEntries(Object.entries(kinds).map(([kind, ms]) => [kind, Math.round(ms)])),
  };
  if (pieces.size > 0) {
    const { top, more } = longest([...pieces.values()], (p) => p.id);
    activity.pieces = top.map(({ title, ms }) => {
      const shown = withTitles ? clip(title.trim()) : '';
      return shown ? { title: shown, ms: Math.round(ms) } : { ms: Math.round(ms) };
    });
    if (more > 0) activity.morePieces = more;
  }
  if (scales.size > 0) {
    const { top, more } = longest([...scales.values()], (s) => `${s.type}:${s.tonic}`);
    activity.scales = top.map(wholeMs);
    if (more > 0) activity.moreScales = more;
  }
  return activity;
}

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

/**
 * Whole milliseconds: scale runs are timed to fractions of one, and the document's numbers are
 * integers (the service refuses anything else).
 */
function wholeMs<T extends { ms: number }>(item: T): T {
  return { ...item, ms: Math.round(item.ms) };
}

/**
 * The document to publish for `settings`, keys in sorted order; null when the profile is off.
 * Over `MAX_PROFILE_BYTES`, the oldest days' activity is left out until it fits.
 */
export function buildProfile({
  sessions,
  pieces,
  settings,
  now,
  firstDay,
  timeZone,
}: ProfileInput): ProfileDocument | null {
  if (settings.visibility === 'off') return null;
  const totals = dailyTotals(sessions, timeZone);
  const today = dayKey(now, timeZone);
  const gridDays = yearGrid(totals, today, { firstDay })
    .flat()
    .filter((d) => d !== null && d.ms > 0);
  const days = Object.fromEntries(gridDays.map((d) => [d!.day, Math.round(d!.ms)]));

  let allMs = 0;
  let practised = 0;
  for (const ms of totals.values()) {
    allMs += ms;
    if (ms > 0) practised++;
  }

  const document: ProfileDocument = {
    v: PROFILE_VERSION,
    visibility: settings.visibility,
    titles: settings.visibility === 'public' && settings.titles,
    today,
    firstDay,
    days,
    streak: { current: currentStreak(totals, today), longest: longestStreak(totals) },
    totals: { days: practised, ms: Math.round(allMs) },
  };

  if (settings.visibility === 'public') {
    const byDay = new Map<DayKey, SessionRecord[]>();
    for (const session of sessions) {
      const day = dayKey(session.startedAt, timeZone);
      if (!(day in days)) continue;
      let list = byDay.get(day);
      if (!list) byDay.set(day, (list = []));
      list.push(session);
    }
    // Only the titles of pieces still stored, and not those made from a file's name (the file
    // name is never published): the others are "a piece".
    const titles = new Map(
      pieces
        .filter((p) => p.title.trim() !== titleFromFile(p.fileName).trim())
        .map((p) => [p.id, p.title]),
    );
    const activity: Record<DayKey, DayActivity> = {};
    for (const day of Object.keys(days)) {
      activity[day] = dayActivity(byDay.get(day) ?? [], titles, document.titles);
    }
    document.activity = activity;

    // Oldest first: the days whose activity goes first when the document is too large.
    // A day's entry, with its key and comma, is taken off the size without serializing again.
    const dates = Object.keys(activity).sort();
    let bytes = byteLength(JSON.stringify(document));
    while (bytes > MAX_PROFILE_BYTES && dates.length > 0) {
      const date = dates.shift()!;
      bytes -= byteLength(`"${date}":${JSON.stringify(activity[date])},`);
      delete activity[date];
      if (bytes <= MAX_PROFILE_BYTES) bytes = byteLength(JSON.stringify(document));
    }
  }
  return canonical(document);
}

// Usernames ------------------------------------------------------------------------------------

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/**
 * Not available as usernames: the service's paths and the names of the app. The service also
 * refuses names with an offensive word, which only it knows.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'api',
  'v1',
  'u',
  'privacy',
  'terms',
  'about',
  'help',
  'support',
  'settings',
  'admin',
  'app',
  'www',
  'mail',
  'static',
  'assets',
  'blog',
  'docs',
  'report',
  'robots',
  'favicon',
  'icons',
  'licenses',
  'piano',
  'dacapo',
  'playdacapo',
]);

/** A username as it is stored: trimmed and lower-cased. */
export const normalizeUsername = (value: string): string => value.trim().toLowerCase();

export type UsernameProblem = 'length' | 'characters' | 'edges' | 'hyphens' | 'unavailable';

/** What is wrong with a (normalized) username, or null when the service may accept it. */
export function usernameProblem(name: string): UsernameProblem | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return 'length';
  if (!/^[a-z0-9-]+$/.test(name)) return 'characters';
  if (name.startsWith('-') || name.endsWith('-')) return 'edges';
  if (name.includes('--')) return 'hyphens';
  if (RESERVED_USERNAMES.has(name)) return 'unavailable';
  return null;
}

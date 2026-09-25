import { byStartDescending, byTime, type SessionRecord } from '../core/log.ts';
import type { Attempt } from '../core/session.ts';
import { byImportedDescending, type StoredPiece } from '../core/storedPiece.ts';
import { dayKey } from '../core/streak.ts';
import type { NoteStats } from '../core/weakness.ts';
import { isLocale, type Locale } from '../i18n/locale.ts';
import { isThemePreference, type ThemePreference } from '../lib/themePreference.ts';
import { validateAttempt, validatePiece, validateSession } from './validate.ts';

// The export file: everything the user owns, as one versioned JSON document. Importing merges by
// id and never trusts the file's note stats; they are rebuilt from the attempts.

export const EXPORT_FORMAT = 'dacapo';
/** Bump when the file shape changes; older files must keep importing. Version 2 adds pieces. */
export const EXPORT_VERSION = 2;

export interface Preferences {
  /** null follows the browser language. */
  locale: Locale | null;
  theme: ThemePreference;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  /** ISO 8601. */
  exportedAt: string;
  app: { version: string };
  preferences: Preferences;
  /** Oldest first. */
  sessions: SessionRecord[];
  /** Oldest first. */
  attempts: Attempt[];
  /** Derived from `attempts`; included for reading, ignored on import. */
  noteStats: NoteStats[];
  /** Imported pieces, oldest first, with their MusicXML. */
  pieces: StoredPiece[];
}

export interface ExportInput {
  sessions: readonly SessionRecord[];
  attempts: readonly Attempt[];
  stats: Readonly<Record<string, NoteStats>>;
  pieces: readonly StoredPiece[];
}

export function buildExport(
  data: ExportInput,
  preferences: Preferences,
  { now, appVersion }: { now: number; appVersion: string },
): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    app: { version: appVersion },
    preferences: { locale: preferences.locale, theme: preferences.theme },
    sessions: [...data.sessions].sort((a, b) => byStartDescending(b, a)),
    attempts: [...data.attempts].sort(byTime),
    noteStats: Object.values(data.stats).sort((a, b) => (a.key < b.key ? -1 : 1)),
    pieces: [...data.pieces].sort((a, b) => byImportedDescending(b, a)),
  };
}

/** `dacapo-YYYY-MM-DD.json`, with the local date. */
export function exportFileName(now: number, timeZone?: string): string {
  return `dacapo-${dayKey(now, timeZone)}.json`;
}

export type ImportError =
  { kind: 'malformed' } | { kind: 'wrong-format' } | { kind: 'future-version'; version: number };

export type Collection = 'sessions' | 'attempts' | 'pieces';

export interface InvalidRecord {
  collection: Collection | 'preferences';
  /** Position in the file's array; 0 for preferences. */
  index: number;
  /** The first field that is missing or wrong, or `record` when it is not an object at all. */
  field: string;
  problem: 'invalid' | 'duplicate';
}

export interface ParsedImport {
  version: number;
  exportedAt: string | null;
  appVersion: string | null;
  sessions: SessionRecord[];
  attempts: Attempt[];
  /** Empty for a version 1 file. */
  pieces: StoredPiece[];
  /** null when the file has none or they are invalid (then listed in `invalid`). */
  preferences: Preferences | null;
  invalid: InvalidRecord[];
}

export type ParseResult = { ok: true; value: ParsedImport } | { ok: false; error: ImportError };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function validatePreferences(value: unknown): Preferences | string {
  if (!isObject(value)) return 'record';
  if (value.locale !== null && !isLocale(value.locale)) return 'locale';
  if (!isThemePreference(value.theme)) return 'theme';
  return { locale: value.locale, theme: value.theme };
}

function validateAll<T extends { id: string }>(
  collection: Collection,
  records: readonly unknown[],
  validate: (value: unknown) => { ok: true; value: T } | { ok: false; field: string },
  invalid: InvalidRecord[],
): T[] {
  const valid: T[] = [];
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const result = validate(record);
    if (!result.ok) {
      invalid.push({ collection, index, field: result.field, problem: 'invalid' });
    } else if (seen.has(result.value.id)) {
      invalid.push({ collection, index, field: 'id', problem: 'duplicate' });
    } else {
      seen.add(result.value.id);
      valid.push(result.value);
    }
  });
  return valid;
}

/** Parses and validates an export file. Invalid records are listed, never dropped silently. */
export function parseImport(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'malformed' } };
  }
  if (!isObject(json) || json.format !== EXPORT_FORMAT) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  const { version } = json;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  if (version > EXPORT_VERSION) return { ok: false, error: { kind: 'future-version', version } };
  if (!Array.isArray(json.sessions) || !Array.isArray(json.attempts)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Version 1 files have no pieces; from version 2 on the list is required.
  if (version >= 2 && !Array.isArray(json.pieces)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }

  const invalid: InvalidRecord[] = [];
  const sessions = validateAll('sessions', json.sessions, validateSession, invalid);
  const attempts = validateAll('attempts', json.attempts, validateAttempt, invalid);
  const pieces = Array.isArray(json.pieces)
    ? validateAll('pieces', json.pieces, validatePiece, invalid)
    : [];
  let preferences: Preferences | null = null;
  if (json.preferences !== undefined) {
    const result = validatePreferences(json.preferences);
    if (typeof result === 'string') {
      invalid.push({ collection: 'preferences', index: 0, field: result, problem: 'invalid' });
    } else {
      preferences = result;
    }
  }
  return {
    ok: true,
    value: {
      version,
      exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : null,
      appVersion:
        isObject(json.app) && typeof json.app.version === 'string' ? json.app.version : null,
      sessions,
      attempts,
      pieces,
      preferences,
      invalid,
    },
  };
}

export interface ImportCounts {
  /** Not stored yet; will be added. */
  new: number;
  /** Stored already (same id); kept as stored. */
  present: number;
  invalid: number;
}

export type ImportPlan = Record<Collection, ImportCounts>;

export function planImport(
  parsed: ParsedImport,
  existing: {
    sessionIds: ReadonlySet<string>;
    attemptIds: ReadonlySet<string>;
    pieceIds: ReadonlySet<string>;
  },
): ImportPlan {
  const count = (
    records: readonly { id: string }[],
    ids: ReadonlySet<string>,
    collection: Collection,
  ): ImportCounts => {
    const present = records.filter((r) => ids.has(r.id)).length;
    return {
      new: records.length - present,
      present,
      invalid: parsed.invalid.filter((i) => i.collection === collection).length,
    };
  };
  return {
    sessions: count(parsed.sessions, existing.sessionIds, 'sessions'),
    attempts: count(parsed.attempts, existing.attemptIds, 'attempts'),
    pieces: count(parsed.pieces, existing.pieceIds, 'pieces'),
  };
}

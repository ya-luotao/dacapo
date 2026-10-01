import type { Answer } from '../core/answers.ts';
import type { AssignmentRecord } from '../core/assignmentRecords.ts';
import type { SessionRecord } from '../core/log.ts';
import type { PieceStep } from '../core/pieceRecords.ts';
import type { StoredScaleRun } from '../core/scaleRecords.ts';
import type { Attempt } from '../core/session.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import type { TakeChunk } from '../core/takes.ts';
import type { PieceDeletion } from '../storage/syncTypes.ts';
import {
  validateAnswer,
  validateAssignmentRecord,
  validateAttempt,
  validatePiece,
  validatePieceStep,
  validateScaleRun,
  validateSession,
  validateTake,
  type Validation,
} from '../storage/validate.ts';
import { pieceBody, type PieceBody } from './records.ts';

// What a pull brings (docs/SYNC.md, "Applying a pull"): each change validated like a record in an
// import file. Apart from records.ts because the validators judge every record by its practice's
// rules, which is most of the app's logic: the sync client loads this module when a pull has
// changes, never at a plain start.

export type Incoming =
  | { collection: 'attempts'; record: Attempt }
  | { collection: 'sessions'; record: SessionRecord }
  | { collection: 'pieceSteps'; record: PieceStep }
  | { collection: 'scaleRuns'; record: StoredScaleRun }
  | { collection: 'answers'; record: Answer }
  | { collection: 'takes'; record: TakeChunk }
  | { collection: 'assignments'; record: AssignmentRecord }
  | { collection: 'pieces'; id: string; deletion: PieceDeletion }
  | { collection: 'pieces'; id: string; piece: PieceBody };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isDeletion(v: unknown): v is PieceDeletion {
  return (
    isObject(v) &&
    v.deleted === true &&
    typeof v.at === 'number' &&
    Number.isFinite(v.at) &&
    typeof v.withSteps === 'boolean'
  );
}

/** Validates a piece body; the MusicXML is checked once it is downloaded. */
function validatePieceBody(value: unknown): Validation<PieceBody> {
  if (!isObject(value)) return { ok: false, field: 'record' };
  if (typeof value.xmlHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.xmlHash)) {
    return { ok: false, field: 'xmlHash' };
  }
  const checked = validatePiece({ ...value, xml: '<placeholder/>' });
  if (!checked.ok) return checked;
  return { ok: true, value: pieceBody(checked.value, value.xmlHash) };
}

/** The complete piece, once its MusicXML is here; null when it does not validate. */
export function pieceWithXml(body: PieceBody, xml: string): StoredPiece | null {
  // The validator keeps only the fields of a stored piece: `xmlHash` is dropped.
  const checked = validatePiece({ ...body, xml });
  return checked.ok ? checked.value : null;
}

/**
 * A change pulled from the service, validated like a record in an import file; null when it is
 * not one this version knows or does not validate (it is skipped and counted).
 */
export function incoming(value: unknown): Incoming | null {
  if (!isObject(value) || typeof value.id !== 'string') return null;
  const { id, body } = value;
  const matches = (record: { id: string }) => record.id === id;
  switch (value.collection) {
    case 'attempts': {
      const checked = validateAttempt(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'attempts', record: checked.value }
        : null;
    }
    case 'sessions': {
      const checked = validateSession(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'sessions', record: checked.value }
        : null;
    }
    case 'pieceSteps': {
      const checked = validatePieceStep(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'pieceSteps', record: checked.value }
        : null;
    }
    case 'scaleRuns': {
      const checked = validateScaleRun(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'scaleRuns', record: checked.value }
        : null;
    }
    case 'answers': {
      const checked = validateAnswer(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'answers', record: checked.value }
        : null;
    }
    case 'takes': {
      const checked = validateTake(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'takes', record: checked.value }
        : null;
    }
    case 'assignments': {
      const checked = validateAssignmentRecord(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'assignments', record: checked.value }
        : null;
    }
    case 'pieces': {
      if (isDeletion(body)) {
        const deletion: PieceDeletion = { deleted: true, at: body.at, withSteps: body.withSteps };
        return { collection: 'pieces', id, deletion };
      }
      const checked = validatePieceBody(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'pieces', id, piece: checked.value }
        : null;
    }
    default:
      return null;
  }
}

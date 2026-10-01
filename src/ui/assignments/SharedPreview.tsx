import { useEffect, useId, useMemo, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import {
  storedAssignments,
  type Assignment,
  type SharedPiece,
} from '../../core/assignmentRecords.ts';
import { importedPieceTasks, type Shared } from '../../core/assignmentShare.ts';
import { pieceFacts, type PieceFacts } from '../../core/pieceRecords.ts';
import type { ScoreWarning } from '../../core/score.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { useAssignmentFormat } from './format.ts';
import { TaskList } from './TaskList.tsx';
import { useKnownPieces } from './useChecklist.ts';

/** A piece a file carries, read: its facts, or null when its MusicXML cannot be read. */
interface FilePiece {
  piece: SharedPiece;
  facts: PieceFacts | null;
  warnings: ScoreWarning[];
}

function readPieces(pieces: readonly SharedPiece[]): FilePiece[] {
  return pieces.map((piece) => {
    try {
      const score = readScore(piece.xml, piece.hands);
      return { piece, facts: pieceFacts(score), warnings: score.warnings };
    } catch {
      return { piece, facts: null, warnings: [] };
    }
  });
}

/**
 * An assignment that came by a link or a file, before it is added: who set it, its dates, its
 * note and its tasks, read-only, and **Add to my assignments**. The pieces a file carries are
 * added to the pieces then, except those already here (the same notes).
 */
export function AssignmentPreview({
  assignment,
  pieces,
}: {
  assignment: Assignment;
  pieces: readonly SharedPiece[];
}) {
  const t = useT();
  const id = useId();
  const format = useAssignmentFormat();
  const store = usePracticeStore();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const known = useKnownPieces();
  const [, navigate] = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  // Keyboard and screen-reader users land on what was opened.
  useEffect(() => heading.current?.focus(), []);

  const stored = storedAssignments(assignments).find((r) => r.id === assignment.id);
  const filePieces = useMemo(() => readPieces(pieces), [pieces]);
  const here = (checksum: string | null | undefined) =>
    checksum != null && known.some((p) => p.checksum === checksum);
  // Imported pieces the tasks name that are neither here nor in the file.
  const missing = importedPieceTasks(assignment, isBuiltInId).filter(
    (task) =>
      !here(task.piece.checksum) &&
      !known.some((p) => p.id === task.piece.id) &&
      !filePieces.some((p) => p.facts?.checksum === task.piece.checksum),
  );

  /** The pieces of the file that are not here yet, each under an id of its own. */
  function addPieces() {
    const added = new Set<string>();
    for (const { piece, facts, warnings } of filePieces) {
      if (!facts || here(facts.checksum) || added.has(facts.checksum)) continue;
      added.add(facts.checksum);
      store.savePiece({
        id: crypto.randomUUID(),
        title: piece.title,
        composer: piece.composer,
        fileName: piece.fileName,
        xml: piece.xml,
        importedAt: Date.now(),
        hands: piece.hands,
        warnings,
        facts,
      });
    }
  }

  function add() {
    addPieces();
    store.saveAssignment(
      stored
        ? {
            ...stored,
            // The later version is the assignment; an earlier one never replaces it.
            assignment:
              assignment.updatedAt > stored.assignment.updatedAt ? assignment : stored.assignment,
            following: true,
          }
        : {
            id: assignment.id,
            type: 'assignment',
            assignment,
            made: false,
            following: true,
            addedAt: Date.now(),
          },
    );
    // The link's data leaves the history with the page that showed it.
    navigate(`/assignments/${assignment.id}`, { replace: true });
  }

  const newer = stored !== undefined && assignment.updatedAt > stored.assignment.updatedAt;
  const older = stored !== undefined && assignment.updatedAt < stored.assignment.updatedAt;
  const status: MessageKey | null = !stored
    ? null
    : newer
      ? 'assignments.open.have.older'
      : older
        ? 'assignments.open.have.newer'
        : stored.following
          ? 'assignments.open.have.same'
          : 'assignments.open.have.mine';
  const action: MessageKey | null = !stored
    ? 'assignments.open.add'
    : newer
      ? 'assignments.open.update'
      : stored.following
        ? null
        : 'assignments.open.follow';

  return (
    <section className="assignment-preview" aria-labelledby={`${id}-title`}>
      <p className="eyebrow">{t('assignments.open.eyebrow')}</p>
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="assignment-name">
        {assignment.title}
      </h2>
      <p className="assignment-meta">
        <span>
          {assignment.teacher
            ? t('assignments.from', { name: assignment.teacher })
            : t('assignments.from.nobody')}
        </span>
        <span>{format.dates(assignment)}</span>
      </p>
      {assignment.note && <p className="assignment-note">{assignment.note}</p>}
      <TaskList tasks={assignment.tasks} />

      {filePieces.length > 0 && (
        <div className="assignment-pieces">
          <p className="eyebrow">{t('assignments.open.pieces')}</p>
          <ul>
            {filePieces.map(({ piece, facts }) => (
              <li key={piece.id}>
                <span>{piece.title || t('pieces.untitled')}</span>
                <span className="muted">
                  {t(
                    !facts
                      ? 'assignments.open.piece.unreadable'
                      : here(facts.checksum)
                        ? 'assignments.open.piece.here'
                        : 'assignments.open.piece.new',
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <p className="data-message is-error" role="alert">
          {t('assignments.open.missing', {
            titles: [...new Set(missing.map((task) => format.pieceTitle(task)))].join(
              t('app.listSeparator'),
            ),
          })}
        </p>
      )}

      {status && (
        <p className="data-message" role="status">
          {t(status)}
        </p>
      )}
      <div className="actions">
        {action && (
          <button type="button" className="button button-primary" disabled={!loaded} onClick={add}>
            {t(action)}
          </button>
        )}
        {stored && (
          <Link
            href={`/assignments/${stored.id}`}
            className={action ? 'button' : 'button button-primary'}
          >
            {t('assignments.open.show')}
          </Link>
        )}
        <Link href="/assignments" className="button">
          {t(stored ? 'assignments.back' : 'assignments.open.dismiss')}
        </Link>
      </div>
      <p className="help">{t('assignments.open.help')}</p>
    </section>
  );
}

/** What a link or a file held, opened: in T1 an assignment. */
export function SharedPreview({ shared }: { shared: Shared }) {
  const t = useT();
  if (shared.kind === 'assignment') {
    return <AssignmentPreview assignment={shared.assignment} pieces={shared.pieces} />;
  }
  return (
    <p className="data-message is-error" role="alert">
      {t('assignments.open.error.invalid')}
    </p>
  );
}

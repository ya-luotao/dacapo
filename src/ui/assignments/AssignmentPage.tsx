import { useId, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  storedAssignments,
  storedReports,
  type StoredAssignment,
  type TaskProgress,
} from '../../core/assignmentRecords.ts';
import { tasksMet } from '../../core/assignments.ts';
import { piecesToShare, type Shared } from '../../core/assignmentShare.ts';
import { dayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { useAssignmentFormat } from './format.ts';
import { KeptReports, SendReport } from './ReportView.tsx';
import { ShareBox } from './ShareBox.tsx';
import { TaskList } from './TaskList.tsx';
import { useChecklist, useKnownPieces } from './useChecklist.ts';

/** The checklist of an assignment for me: each task's figure, its tick, and the way to start it. */
function Checklist({
  record,
  progress,
}: {
  record: StoredAssignment;
  /** Null while the records are being read. */
  progress: TaskProgress[] | null;
}) {
  const t = useT();
  const id = useId();
  const pieces = useKnownPieces();
  const met = progress && tasksMet(progress);
  return (
    <section className="assignment-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        {t('assignments.checklist')}
        {met && <span className="assignment-count">{t('assignments.done', met)}</span>}
      </h2>
      {progress ? (
        <TaskList tasks={record.assignment.tasks} progress={progress} pieces={pieces} />
      ) : (
        <p className="muted" role="status">
          {t('assignments.checklist.loading')}
        </p>
      )}
      <p className="help">{t('assignments.checklist.help')}</p>
    </section>
  );
}

/** Sharing an assignment set here: its link, or its file with the imported pieces it names. */
function Share({ record }: { record: StoredAssignment }) {
  const t = useT();
  const id = useId();
  const format = useAssignmentFormat();
  const { pieces } = usePractice();
  const { assignment } = record;
  const carried = useMemo(
    () => piecesToShare(assignment, pieces, isBuiltInId),
    [assignment, pieces],
  );
  const shared = useMemo<Shared>(
    () => ({ kind: 'assignment', assignment, pieces: carried.pieces }),
    [assignment, carried],
  );
  const needsFile = carried.pieces.length > 0 || carried.missing.length > 0;
  return (
    <section className="assignment-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('assignments.share')}</h2>
      <ShareBox
        shared={shared}
        fileOnly={needsFile ? 'assignments.share.fileOnly' : undefined}
        linkHelp="assignments.share.link.help"
      />
      {carried.missing.length > 0 && (
        <p className="data-message is-error" role="alert">
          {t('assignments.share.missing', {
            titles: [...new Set(carried.missing.map((task) => format.pieceTitle(task)))].join(
              t('app.listSeparator'),
            ),
          })}
        </p>
      )}
    </section>
  );
}

/**
 * One assignment: for me, its checklist; set by me, its tasks and the ways to share it. An
 * assignment a learner sets for themself is both.
 */
export function AssignmentPage({ id }: { id: string }) {
  const t = useT();
  const format = useAssignmentFormat();
  const store = usePracticeStore();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const today = dayKey(useNow());
  const [, navigate] = useLocation();
  const [deleting, setDeleting] = useState(false);
  const record = storedAssignments(assignments).find((r) => r.id === id);
  // The checklist, for the assignment's own list and for its report.
  const progress = useChecklist(record?.following ? record.assignment : null);

  if (!record) {
    return (
      <section className="page">
        <p className="piece-back">
          <Link href="/assignments">{t('assignments.back')}</Link>
        </p>
        {loaded ? (
          <EmptyState action={{ href: '/assignments', label: t('assignments.back') }}>
            {t('assignments.notFound')}
          </EmptyState>
        ) : (
          <p className="muted" role="status">
            {t('storage.loading')}
          </p>
        )}
      </section>
    );
  }

  const { assignment, made, following } = record;
  return (
    <section className="assignment">
      <p className="piece-back">
        <Link href="/assignments">{t('assignments.back')}</Link>
      </p>
      <h1 className="assignment-name">{assignment.title}</h1>
      <p className="assignment-meta">
        {(assignment.teacher || !made) && (
          <span>
            {assignment.teacher
              ? t('assignments.from', { name: assignment.teacher })
              : t('assignments.from.nobody')}
          </span>
        )}
        <span>{format.dates(assignment)}</span>
        <span>{format.due(assignment, today)}</span>
      </p>
      {assignment.note && <p className="assignment-note">{assignment.note}</p>}

      {following ? (
        <Checklist record={record} progress={progress} />
      ) : (
        <section className="assignment-section" aria-label={t('assignments.tasks')}>
          <h2>{t('assignments.tasks')}</h2>
          <TaskList tasks={assignment.tasks} />
        </section>
      )}

      {following && <SendReport assignment={assignment} progress={progress} />}
      {made && <Share record={record} />}
      {made && <KeptReports assignmentId={id} />}

      <div className="actions assignment-actions">
        {made && (
          <Link href={`/assignments/${id}/edit`} className="button">
            {t('assignments.edit')}
          </Link>
        )}
        {made && (
          <button
            type="button"
            className="button"
            onClick={() => store.saveAssignment({ ...record, following: !following })}
          >
            {t(following ? 'assignments.unfollow' : 'assignments.follow')}
          </button>
        )}
        <button
          type="button"
          className="button-link is-danger"
          aria-expanded={deleting}
          onClick={() => setDeleting(!deleting)}
        >
          {t(made ? 'assignments.delete' : 'assignments.remove')}
        </button>
      </div>
      {made && (
        <p className="help">
          {t(following ? 'assignments.unfollow.help' : 'assignments.follow.help')}
        </p>
      )}
      {deleting && (
        <div className="your-piece-panel" role="alertdialog" aria-label={t('assignments.delete')}>
          <p>
            {t(made ? 'assignments.delete.confirm' : 'assignments.remove.confirm', {
              title: assignment.title,
            })}
          </p>
          <div className="actions">
            <button
              type="button"
              className="button button-danger"
              autoFocus
              onClick={() => {
                // The reports kept under it go with it.
                for (const kept of storedReports(assignments)) {
                  if (kept.report.assignmentId === id) store.deleteAssignment(kept.id);
                }
                store.deleteAssignment(id);
                navigate('/assignments', { replace: true });
              }}
            >
              {t(made ? 'assignments.delete' : 'assignments.remove')}
            </button>
            <button type="button" className="button" onClick={() => setDeleting(false)}>
              {t('pieces.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

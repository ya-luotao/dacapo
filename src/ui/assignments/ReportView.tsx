import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'wouter';
import {
  MAX_NAME,
  MAX_NOTE,
  storedAssignments,
  storedReports,
  type Assignment,
  type Report,
  type TaskProgress,
} from '../../core/assignmentRecords.ts';
import { buildReport, reportDayList, tasksMet } from '../../core/assignments.ts';
import { parseReport, type Shared } from '../../core/assignmentShare.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { useLogFormat } from '../progress/format.ts';
import { useAssignmentFormat } from './format.ts';
import { ShareBox } from './ShareBox.tsx';
import { TaskList } from './TaskList.tsx';
import { NAME_PREF } from './tasks.ts';

/**
 * A report as it reads (docs/ASSIGNMENTS.md, "The report"): who made it and when, their note,
 * each task of the assignment with its goal, its figure, its tick and its best and last run, and
 * the minutes of each day. Everything shown is in the report itself, so it reads the same
 * whether or not the assignment it answers is on the device.
 */
export function ReportView({ report }: { report: Report }) {
  const t = useT();
  const log = useLogFormat();
  const days = reportDayList(report);
  const longest = Math.max(1, ...days.map((d) => d.minutes));
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  return (
    <div className="report">
      {report.note && <p className="assignment-note">{report.note}</p>}
      <TaskList
        tasks={report.tasks.map((t) => t.task)}
        progress={report.tasks.map((t) => t.progress)}
      />
      <div className="report-days">
        <p className="eyebrow">
          {t('assignments.report.days')}
          <span className="report-total">{t('assignments.report.total', { n: total })}</span>
        </p>
        {days.length === 0 ? (
          <p className="muted">{t('assignments.report.days.none')}</p>
        ) : (
          <ol>
            {days.map(({ day, minutes }) => (
              <li key={day} className={minutes === 0 ? 'is-none' : undefined}>
                <span className="report-day">{log.longDay(day)}</span>
                <span
                  className="report-bar"
                  style={{ '--share': minutes / longest } as CSSProperties}
                  aria-hidden="true"
                />
                <span className="report-minutes">{t('progress.minutes', { n: minutes })}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** Who a report is from, the days it covers, when it was made and how many tasks are done. */
export function ReportMeta({ report }: { report: Report }) {
  const t = useT();
  const format = useAssignmentFormat();
  const log = useLogFormat();
  const met = tasksMet(report.tasks.map((entry) => entry.progress));
  return (
    <p className="assignment-meta">
      <span>
        {report.from ? t('assignments.from', { name: report.from }) : t('assignments.from.nobody')}
      </span>
      <span>{format.dates(report)}</span>
      <span>{t('assignments.report.made', { date: log.dateTime(report.createdAt) })}</span>
      <span>{t('assignments.done', met)}</span>
    </p>
  );
}

/**
 * A report that came by a link or a file: read next to the assignment it answers (the one stored
 * here with its id), and kept under it if the teacher wants; without that assignment it can
 * still be read.
 */
export function ReportPreview({ report }: { report: Report }) {
  const t = useT();
  const id = useId();
  const store = usePracticeStore();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const [, navigate] = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  // Keyboard and screen-reader users land on what was opened.
  useEffect(() => heading.current?.focus(), []);
  const assignment = storedAssignments(assignments).find((r) => r.id === report.assignmentId);
  const kept = storedReports(assignments).some((r) => r.id === report.id);

  function keep() {
    store.saveAssignment({ id: report.id, type: 'report', report, addedAt: Date.now() });
    // The link's data leaves the history with the page that showed it.
    navigate(`/assignments/${report.assignmentId}`, { replace: true });
  }

  return (
    <section className="assignment-preview" aria-labelledby={`${id}-title`}>
      <p className="eyebrow">{t('assignments.report.eyebrow')}</p>
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="assignment-name">
        {report.title}
      </h2>
      <ReportMeta report={report} />
      <ReportView report={report} />

      {loaded && (
        <p className="data-message" role="status">
          {t(
            !assignment
              ? 'assignments.report.noAssignment'
              : kept
                ? 'assignments.report.kept'
                : assignment.assignment.updatedAt !== report.assignmentVersion
                  ? 'assignments.report.otherVersion'
                  : 'assignments.report.keep.help',
          )}
        </p>
      )}
      <div className="actions">
        {assignment && !kept && (
          <button type="button" className="button button-primary" onClick={keep}>
            {t('assignments.report.keep')}
          </button>
        )}
        {assignment && (
          <Link
            href={`/assignments/${assignment.id}`}
            className={kept ? 'button button-primary' : 'button'}
          >
            {t('assignments.report.assignment')}
          </Link>
        )}
        <Link href="/assignments" className="button">
          {t('assignments.back')}
        </Link>
      </div>
    </section>
  );
}

/**
 * The reports a teacher kept on an assignment, the latest first: each folds open to its figures,
 * and can be deleted.
 */
export function KeptReports({ assignmentId }: { assignmentId: string }) {
  const t = useT();
  const id = useId();
  const store = usePracticeStore();
  const { assignments } = usePractice();
  const [deleting, setDeleting] = useState<string | null>(null);
  const reports = storedReports(assignments).filter((r) => r.report.assignmentId === assignmentId);
  return (
    <section className="assignment-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('assignments.reports')}</h2>
      {reports.length === 0 ? (
        <p className="muted">{t('assignments.reports.empty')}</p>
      ) : (
        <ul className="kept-reports">
          {reports.map(({ id: reportId, report }) => (
            <li key={reportId}>
              <details>
                <summary>
                  <ReportMeta report={report} />
                </summary>
                <ReportView report={report} />
                <div className="actions">
                  {deleting === reportId ? (
                    <>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => store.deleteAssignment(reportId)}
                      >
                        {t('assignments.report.delete')}
                      </button>
                      <button type="button" className="button" onClick={() => setDeleting(null)}>
                        {t('pieces.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button-link is-danger"
                      onClick={() => setDeleting(reportId)}
                    >
                      {t('assignments.report.delete')}
                    </button>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Send a report (the student's side): the checklist as it stands turned into a report, with a
 * name and a note, as a link to copy or a file. Made when the section is opened, and again when
 * it is opened again; dacapo sends it nowhere.
 */
export function SendReport({
  assignment,
  progress,
}: {
  assignment: Assignment;
  progress: readonly TaskProgress[] | null;
}) {
  const t = useT();
  const id = useId();
  const { sessions } = usePractice();
  // The report being made: its id and its moment, from when the section was opened.
  const [made, setMade] = useState<{ id: string; now: number } | null>(null);
  const [from, setFrom] = useState(() => readPref(NAME_PREF) ?? '');
  const [note, setNote] = useState('');

  // By the rules a link is read with: what is shared here can always be opened.
  const report =
    made && progress
      ? parseReport(
          buildReport(assignment, progress, {
            id: made.id,
            from: from.trim(),
            note: note.trim(),
            now: made.now,
            sessions,
          }),
        )
      : null;
  const shared: Shared | null = report && { kind: 'report', report };

  return (
    <section className="assignment-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('assignments.report.title')}</h2>
      <p className="help">{t('assignments.report.help')}</p>
      {!made ? (
        <div className="actions">
          <button
            type="button"
            className="button"
            disabled={!progress}
            onClick={() => setMade({ id: crypto.randomUUID(), now: Date.now() })}
          >
            {t('assignments.report.send')}
          </button>
        </div>
      ) : (
        <div className="report-form">
          <div className="field">
            <label htmlFor={`${id}-from`}>{t('assignments.edit.teacher')}</label>
            <input
              id={`${id}-from`}
              className="text-input"
              value={from}
              maxLength={MAX_NAME}
              autoComplete="name"
              onChange={(e) => {
                setFrom(e.target.value);
                writePref(NAME_PREF, e.target.value.trim() || null);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-note`}>{t('assignments.report.note')}</label>
            <textarea
              id={`${id}-note`}
              className="text-input assignment-note-input"
              value={note}
              rows={3}
              maxLength={MAX_NOTE}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {shared ? (
            <ShareBox
              shared={shared}
              linkHelp="assignments.report.link.help"
              tooLarge="assignments.report.tooLarge"
            />
          ) : (
            <p className="data-message is-error" role="alert">
              {t('assignments.report.failed')}
            </p>
          )}
          <div className="actions">
            <button type="button" className="button" onClick={() => setMade(null)}>
              {t('pieces.import.close')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

import { useId, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { byDue, storedAssignments, type StoredAssignment } from '../../core/assignmentRecords.ts';
import { tasksMet } from '../../core/assignments.ts';
import {
  ASSIGNMENT_FILE_SUFFIX,
  linkData,
  MAX_FILE_CHARS,
  OPEN_ROUTE,
  parseShareFile,
  REPORT_FILE_SUFFIX,
  type Shared,
  type ShareError,
} from '../../core/assignmentShare.ts';
import { dayKey, type DayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { validateSharedPiece } from '../../storage/validate.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { SHARE_ERRORS, timingOf, useAssignmentFormat } from './format.ts';
import { SharedPreview } from './SharedPreview.tsx';
import { useChecklist } from './useChecklist.ts';

/** For me: what is on now first (soonest due), then what is to come, then what is over. */
function forMeOrder(today: DayKey) {
  const rank = { current: 0, upcoming: 1, past: 2 } as const;
  return (a: StoredAssignment, b: StoredAssignment) => {
    const ta = timingOf(a.assignment, today);
    const tb = timingOf(b.assignment, today);
    // What is over: the latest first.
    return rank[ta] - rank[tb] || (ta === 'past' ? byDue(b, a) : byDue(a, b));
  };
}

/** An assignment in a list: its name, who set it, when it is due, and how far it is. */
function Row({ record, today, mine }: { record: StoredAssignment; today: DayKey; mine: boolean }) {
  const t = useT();
  const format = useAssignmentFormat();
  const { assignment } = record;
  const progress = useChecklist(mine ? null : assignment);
  const met = progress && tasksMet(progress);
  const timing = timingOf(assignment, today);
  return (
    <li className={timing === 'past' ? 'assignment-row is-past' : 'assignment-row'}>
      <Link href={`/assignments/${record.id}`} className="assignment-link">
        <span className="assignment-link-title">{assignment.title}</span>
        <span className="assignment-link-meta">
          {mine
            ? format.dates(assignment)
            : [
                assignment.teacher && t('assignments.from', { name: assignment.teacher }),
                format.due(assignment, today),
              ]
                .filter(Boolean)
                .join(' · ')}
        </span>
        <span
          className={
            met && met.met === met.of ? 'assignment-link-count is-done' : 'assignment-link-count'
          }
        >
          {mine
            ? assignment.tasks.length === 1
              ? t('assignments.tasks.one')
              : t('assignments.tasks.other', { n: assignment.tasks.length })
            : met
              ? t('assignments.done', met)
              : ''}
        </span>
      </Link>
    </li>
  );
}

/** A link pasted or a file chosen: opened, to be looked at before it is added. */
function OpenForm({
  onFile,
}: {
  onFile: (shared: Shared | null, error: ShareError | null) => void;
}) {
  const t = useT();
  const id = useId();
  const [, navigate] = useLocation();
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [bad, setBad] = useState(false);

  async function readFile(file: File) {
    if (file.size > MAX_FILE_CHARS * 4) return onFile(null, 'too-large');
    let text: string;
    try {
      text = await file.text();
    } catch {
      return onFile(null, 'malformed');
    }
    const result = parseShareFile(text, validateSharedPiece);
    if (result.ok) onFile(result.value, null);
    else onFile(null, result.error);
  }

  return (
    <div className="assignments-open" role="group" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="eyebrow">
        {t('assignments.open')}
      </h3>
      <form
        className="share-link"
        onSubmit={(e) => {
          e.preventDefault();
          const data = linkData(link);
          setBad(data === null);
          if (data !== null) navigate(`${OPEN_ROUTE}${data}`);
        }}
      >
        <label htmlFor={`${id}-link`} className="visually-hidden">
          {t('assignments.open.link')}
        </label>
        <input
          id={`${id}-link`}
          className="text-input"
          value={link}
          placeholder={t('assignments.open.link')}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setLink(e.target.value);
            setBad(false);
          }}
        />
        <button type="submit" className="button" disabled={link.trim() === ''}>
          {t('assignments.open.go')}
        </button>
        <button type="button" className="button" onClick={() => input.current?.click()}>
          {t('assignments.open.file')}
        </button>
        <input
          ref={input}
          type="file"
          accept={`${ASSIGNMENT_FILE_SUFFIX},${REPORT_FILE_SUFFIX},.json,application/json`}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so choosing the same file again still fires a change.
            e.target.value = '';
            if (file) void readFile(file);
          }}
        />
      </form>
      {bad ? (
        <p className="data-message is-error" role="alert">
          {t('assignments.open.error.malformed')}
        </p>
      ) : (
        <p className="help">{t('assignments.open.help.form')}</p>
      )}
    </div>
  );
}

/**
 * Assignments (docs/ASSIGNMENTS.md): the ones for me, each with how far its checklist is; the
 * ones set by me, to share; and where a link or a file is opened.
 */
export function AssignmentsPage() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const today = dayKey(useNow());
  // What a chosen file held (`n` tells one file from the next), or why it could not be read.
  const [opened, setOpened] = useState<{
    shared: Shared | null;
    error: ShareError | null;
    n: number;
  } | null>(null);
  const all = storedAssignments(assignments);
  const forMe = all.filter((r) => r.following).sort(forMeOrder(today));
  const byMe = all.filter((r) => r.made).sort((a, b) => byDue(b, a));

  return (
    <section className="assignments">
      <h1>{t('assignments.title')}</h1>
      <p className="muted assignments-intro">{t('assignments.intro')}</p>

      {opened?.shared && <SharedPreview key={opened.n} shared={opened.shared} />}
      {opened?.error && (
        <p className="data-message is-error" role="alert">
          {t(SHARE_ERRORS[opened.error])}
        </p>
      )}

      {!loaded ? (
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : (
        <>
          <section className="assignments-list" aria-labelledby="assignments-for-me">
            <h2 id="assignments-for-me">{t('assignments.forMe')}</h2>
            {forMe.length === 0 ? (
              <p className="muted">{t('assignments.forMe.empty')}</p>
            ) : (
              <ul className="assignment-rows">
                {forMe.map((record) => (
                  <Row key={record.id} record={record} today={today} mine={false} />
                ))}
              </ul>
            )}
            <OpenForm
              onFile={(shared, error) =>
                setOpened((before) => ({ shared, error, n: (before?.n ?? 0) + 1 }))
              }
            />
          </section>

          <section className="assignments-list" aria-labelledby="assignments-by-me">
            <h2 id="assignments-by-me">{t('assignments.byMe')}</h2>
            {byMe.length === 0 ? (
              <p className="muted">{t('assignments.byMe.empty')}</p>
            ) : (
              <ul className="assignment-rows">
                {byMe.map((record) => (
                  <Row key={record.id} record={record} today={today} mine />
                ))}
              </ul>
            )}
            <div className="actions">
              <Link href="/assignments/new" className="button button-primary">
                {t('assignments.new')}
              </Link>
            </div>
          </section>
        </>
      )}

      <p className="help assignments-privacy">{t('assignments.privacy')}</p>
    </section>
  );
}

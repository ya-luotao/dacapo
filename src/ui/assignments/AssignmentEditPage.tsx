import { useId, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  MAX_NAME,
  MAX_NOTE,
  MAX_TASKS,
  MAX_TITLE,
  MAX_WINDOW_DAYS,
  storedAssignments,
  TASK_KINDS,
  type Assignment,
  type KnownTask,
  type StoredAssignment,
  type Task,
} from '../../core/assignmentRecords.ts';
import { isDay, parseAssignment } from '../../core/assignmentShare.ts';
import { daysBetween } from '../../core/review.ts';
import { addDays, dayKey } from '../../core/streak.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { TaskEditor } from './TaskEditor.tsx';
import { TaskList } from './TaskList.tsx';
import { NAME_PREF, newTask, newTaskId } from './tasks.ts';

/** `/assignments/new` and `/assignments/<id>/edit`. */
export function AssignmentEditPage({ id }: { id?: string }) {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const record = id ? storedAssignments(assignments).find((r) => r.id === id && r.made) : undefined;

  if (id && !record) {
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
  // Until storage is in, a new assignment could not be saved either.
  if (!loaded) {
    return (
      <p className="muted" role="status">
        {t('storage.loading')}
      </p>
    );
  }
  return <Editor key={id ?? 'new'} record={record} />;
}

type Editing = { task: KnownTask; adding: boolean } | null;

function Editor({ record }: { record: StoredAssignment | undefined }) {
  const t = useT();
  const id = useId();
  const store = usePracticeStore();
  const [, navigate] = useLocation();
  const before = record?.assignment;
  const [today] = useState(() => dayKey(Date.now()));
  const [title, setTitle] = useState(before?.title ?? '');
  const [teacher, setTeacher] = useState(before?.teacher ?? readPref(NAME_PREF) ?? '');
  const [note, setNote] = useState(before?.note ?? '');
  const [start, setStart] = useState(before?.start ?? today);
  const [due, setDue] = useState(before?.due ?? addDays(today, 6));
  const [tasks, setTasks] = useState<Task[]>(before?.tasks ?? []);
  const [following, setFollowing] = useState(record?.following ?? false);
  const [editing, setEditing] = useState<Editing>(null);
  const [failed, setFailed] = useState(false);

  const dates: MessageKey | null =
    !isDay(start) || !isDay(due)
      ? 'assignments.edit.error.dates'
      : due < start
        ? 'assignments.edit.error.order'
        : daysBetween(start, due) >= MAX_WINDOW_DAYS
          ? 'assignments.edit.error.long'
          : null;
  const ready = title.trim() !== '' && dates === null && tasks.length > 0 && editing === null;
  const back = record ? `/assignments/${record.id}` : '/assignments';

  function saveTask(task: KnownTask) {
    setTasks((list) =>
      list.some((x) => x.id === task.id)
        ? list.map((x) => (x.id === task.id ? task : x))
        : [...list, task],
    );
    setEditing(null);
    setFailed(false);
  }

  function save() {
    const now = Date.now();
    const assignment: Assignment = {
      id: before?.id ?? crypto.randomUUID(),
      title: title.trim(),
      note: note.trim(),
      teacher: teacher.trim(),
      start,
      due,
      tasks,
      createdAt: before?.createdAt ?? now,
      // Later than the version it replaces, even on a device whose clock is behind.
      updatedAt: before ? Math.max(now, before.updatedAt + 1) : now,
    };
    // By the rules a link is read with: what is saved here can always be shared and opened.
    const checked = parseAssignment(assignment);
    if (!checked) {
      setFailed(true);
      return;
    }
    writePref(NAME_PREF, assignment.teacher || null);
    store.saveAssignment({
      id: checked.id,
      type: 'assignment',
      assignment: checked,
      made: true,
      following,
      addedAt: record?.addedAt ?? now,
    });
    navigate(`/assignments/${checked.id}`, { replace: true });
  }

  return (
    <section className="assignment assignment-edit">
      <p className="piece-back">
        <Link href={back}>{t(record ? 'assignments.edit.back' : 'assignments.back')}</Link>
      </p>
      <h1>{t(record ? 'assignments.edit' : 'assignments.new')}</h1>

      <div className="field">
        <label htmlFor={`${id}-title`}>{t('assignments.edit.title')}</label>
        <input
          id={`${id}-title`}
          className="text-input"
          value={title}
          maxLength={MAX_TITLE}
          placeholder={t('assignments.edit.title.placeholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-teacher`}>{t('assignments.edit.teacher')}</label>
        <input
          id={`${id}-teacher`}
          className="text-input"
          value={teacher}
          maxLength={MAX_NAME}
          autoComplete="name"
          onChange={(e) => setTeacher(e.target.value)}
        />
        <p className="help">{t('assignments.edit.teacher.help')}</p>
      </div>
      <div className="assignment-dates">
        <div className="field">
          <label htmlFor={`${id}-start`}>{t('assignments.edit.start')}</label>
          <input
            id={`${id}-start`}
            className="text-input"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-due`}>{t('assignments.edit.due')}</label>
          <input
            id={`${id}-due`}
            className="text-input"
            type="date"
            value={due}
            min={start}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
      </div>
      {dates ? (
        <p className="data-message is-error" role="alert">
          {t(dates)}
        </p>
      ) : (
        <p className="help">{t('assignments.edit.dates.help')}</p>
      )}
      <div className="field">
        <label htmlFor={`${id}-note`}>{t('assignments.edit.note')}</label>
        <textarea
          id={`${id}-note`}
          className="text-input assignment-note-input"
          value={note}
          rows={3}
          maxLength={MAX_NOTE}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <section className="assignment-section" aria-labelledby={`${id}-tasks`}>
        <h2 id={`${id}-tasks`}>{t('assignments.tasks')}</h2>
        {tasks.length === 0 && !editing && <p className="muted">{t('assignments.edit.empty')}</p>}
        <TaskList
          tasks={editing && !editing.adding ? tasks.filter((x) => x.id !== editing.task.id) : tasks}
          actions={(task) => (
            <span className="task-actions">
              {task.kind !== 'unknown' && (
                <button
                  type="button"
                  className="button-link"
                  disabled={editing !== null}
                  onClick={() => setEditing({ task, adding: false })}
                >
                  {t('assignments.edit.task.change')}
                </button>
              )}
              <button
                type="button"
                className="button-link is-danger"
                disabled={editing !== null}
                onClick={() => setTasks((list) => list.filter((x) => x.id !== task.id))}
              >
                {t('assignments.edit.task.remove')}
              </button>
            </span>
          )}
        />
        {editing ? (
          <TaskEditor
            key={editing.task.id}
            task={editing.task}
            adding={editing.adding}
            onSave={saveTask}
            onCancel={() => setEditing(null)}
          />
        ) : (
          tasks.length < MAX_TASKS && (
            <div className="task-add" role="group" aria-labelledby={`${id}-add`}>
              <span id={`${id}-add`} className="eyebrow">
                {t('assignments.edit.add')}
              </span>
              <div className="task-add-kinds">
                {TASK_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="button"
                    onClick={() =>
                      setEditing({ task: newTask(kind, newTaskId(tasks)), adding: true })
                    }
                  >
                    {t(`assignments.kind.${kind}`)}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </section>

      <label className="check assignment-follow">
        <input
          type="checkbox"
          checked={following}
          onChange={(e) => setFollowing(e.target.checked)}
        />
        <span>{t('assignments.edit.follow')}</span>
      </label>
      <p className="help">{t('assignments.edit.follow.help')}</p>

      {failed && (
        <p className="data-message is-error" role="alert">
          {t('assignments.edit.error.size')}
        </p>
      )}
      <div className="actions">
        <button type="button" className="button button-primary" disabled={!ready} onClick={save}>
          {t('assignments.edit.save')}
        </button>
        <Link href={back} className="button">
          {t('pieces.cancel')}
        </Link>
      </div>
    </section>
  );
}

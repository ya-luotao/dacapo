import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  MAX_MINUTES,
  MAX_RUNS,
  MAX_WINDOW_DAYS,
  type KnownTask,
  type LessonTask,
  type LevelFamily,
  type LevelTask,
  type MinutesTask,
  type PieceMeasure,
  type PieceTask,
  type ScaleTask,
} from '../../core/assignmentRecords.ts';
import {
  LEVEL_FAMILIES,
  levelsOfFamily,
  pageOfFamily,
  passSteps,
  TASK_TEMPO_MAX,
  TASK_TEMPO_MIN,
  TASK_TEMPO_STEP,
  type LevelPage,
} from '../../core/assignments.ts';
import { leftHandPatterns } from '../../core/leadSheet.ts';
import { HAND_SELECTIONS, type PracticeMode } from '../../core/pieceRecords.ts';
import { isNotesPerBeat, type GridPerBeat } from '../../core/scaleClick.ts';
import { exerciseKey, parseExerciseKey } from '../../core/scales.ts';
import { layoutOf } from '../../core/scaleXml.ts';
import type { BarLoop } from '../../core/wait.ts';
import { useI18n, useT } from '../../i18n/index.ts';
import { EXTRAS, lessonLanguage, LESSONS } from '../../learn/lessons.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { usePieceFormat } from '../pieces/format.ts';
import { usePiece } from '../pieces/usePiece.ts';
import { usePractice } from '../practice/context.ts';
import { DEFAULT_CLICK, DEFAULT_EXERCISE, type ClickPrefs } from '../scales/prefs.ts';
import { ScalePicker } from '../scales/ScalePicker.tsx';
import { familyKey, levelKey, useAssignmentFormat } from './format.ts';

const MODES: readonly PracticeMode[] = ['wait', 'rhythm', 'memory'];
const TEMPOS = Array.from(
  { length: (TASK_TEMPO_MAX - TASK_TEMPO_MIN) / TASK_TEMPO_STEP + 1 },
  (_, i) => TASK_TEMPO_MIN + i * TASK_TEMPO_STEP,
);
const PERCENTS = [50, 60, 70, 75, 80, 85, 90, 95, 100];
const PAGES: readonly LevelPage[] = ['read', 'ear', 'harmony'];

/** A whole number in a field: typed freely, kept between `min` and `max`. */
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  // The number as typed: taken when it is one in range, put right when the field is left.
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <div className="field task-number">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="text-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={typed ?? String(value)}
        onChange={(e) => {
          setTyped(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setTyped(null)}
      />
    </div>
  );
}

interface EditorProps<T extends KnownTask> {
  task: T;
  /** A task not yet in the assignment: the button adds it. */
  adding: boolean;
  onSave: (task: T) => void;
  onCancel: () => void;
}

/** Save and Cancel under a task's form; `task` is null while the form cannot be saved. */
function Actions<T extends KnownTask>({
  task,
  adding,
  onSave,
  onCancel,
}: Omit<EditorProps<T>, 'task'> & { task: T | null }) {
  const t = useT();
  return (
    <div className="actions">
      <button
        type="button"
        className="button button-primary"
        disabled={!task}
        onClick={() => task && onSave(task)}
      >
        {t(adding ? 'assignments.edit.task.add' : 'assignments.edit.task.save')}
      </button>
      <button type="button" className="button" onClick={onCancel}>
        {t('pieces.cancel')}
      </button>
    </div>
  );
}

function PieceEditor({ task, adding, onSave, onCancel }: EditorProps<PieceTask>) {
  const t = useT();
  const id = useId();
  const format = useAssignmentFormat();
  const { pieces } = usePractice();
  const [pieceId, setPieceId] = useState(task.piece.id);
  const [bars, setBars] = useState<BarLoop | null>(
    task.bars && { from: task.bars.from, to: task.bars.to },
  );
  const [hands, setHands] = useState(task.hands);
  const [mode, setMode] = useState(task.mode);
  const [tempo, setTempo] = useState(task.tempo);
  const [runs, setRuns] = useState(task.runs);
  const [measure, setMeasure] = useState<PieceMeasure | 'any'>(task.goal?.measure ?? 'any');
  const [percent, setPercent] = useState(task.goal?.percent ?? 90);
  const state = usePiece(pieceId);
  const opened = state.status === 'ready' ? state.piece : null;
  const bar = usePieceFormat(opened?.score.measures ?? []);
  const known = BUILT_IN.some((p) => p.id === pieceId) || pieces.some((p) => p.id === pieceId);

  // Notes are in time only in rhythm mode: another mode judges them right or not.
  const goalMeasure = measure === 'inTime' && mode !== 'rhythm' ? 'right' : measure;
  const measures = opened?.score.measures.length ?? 0;
  const loop = bars && bars.to < measures ? bars : null;
  const pass = useMemo(
    () => (opened ? passSteps(opened.score, hands, loop) : null),
    [opened, hands, loop],
  );
  // A score with chord symbols can have its left hand made from them (H3): on a lead sheet,
  // whose own left hand is empty, the left hand and both can still be set.
  const fromSymbols = useMemo(
    () => opened !== null && leftHandPatterns(opened.score).length > 0,
    [opened],
  );
  const playable =
    pass !== null && (pass.play > 0 || pass.skip > 0 || (fromSymbols && hands !== 'right'));
  const current: PieceTask | null =
    opened && pass && playable
      ? {
          kind: 'piece',
          id: task.id,
          piece: {
            id: opened.id,
            title: opened.title,
            composer: opened.composer,
            checksum: opened.facts.checksum,
          },
          bars: loop && {
            ...loop,
            fromLabel: opened.score.measures[loop.from]?.number ?? String(loop.from + 1),
            toLabel: opened.score.measures[loop.to]?.number ?? String(loop.to + 1),
          },
          hands,
          mode,
          tempo,
          runs,
          ...(goalMeasure !== 'any' && { goal: { measure: goalMeasure, percent } }),
          pass,
        }
      : null;
  const barOptions = (from: number) =>
    Array.from({ length: Math.max(0, measures - from) }, (_, i) => (
      <option key={from + i} value={from + i}>
        {bar.barNumber(from + i)}
      </option>
    ));

  return (
    <>
      <div className="task-form">
        <div className="field">
          <label htmlFor={`${id}-piece`}>{t('assignments.edit.piece')}</label>
          <select
            id={`${id}-piece`}
            value={pieceId}
            onChange={(e) => {
              setPieceId(e.target.value);
              setBars(null);
            }}
          >
            {!known && <option value={pieceId}>{format.pieceTitle(task)}</option>}
            <optgroup label={t('pieces.library')}>
              {BUILT_IN.filter((p) => !p.leadSheet).map((p) => (
                <option key={p.id} value={p.id}>
                  {t(`library.${p.id}.title`)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('pieces.leadSheets')}>
              {BUILT_IN.filter((p) => p.leadSheet).map((p) => (
                <option key={p.id} value={p.id}>
                  {t(`library.${p.id}.title`)}
                </option>
              ))}
            </optgroup>
            {pieces.length > 0 && (
              <optgroup label={t('pieces.yours')}>
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || t('pieces.untitled')}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-from`}>{t('assignments.edit.bars')}</label>
          <span className="task-bars">
            <select
              id={`${id}-from`}
              className="is-compact"
              aria-label={t('pieces.loop.from')}
              value={loop?.from ?? ''}
              disabled={!opened}
              onChange={(e) => {
                const from = e.target.value === '' ? null : Number(e.target.value);
                setBars(from === null ? null : { from, to: Math.max(from, loop?.to ?? from) });
              }}
            >
              <option value="">{t('progress.session.wholePiece')}</option>
              {barOptions(0)}
            </select>
            {loop && (
              <>
                <span aria-hidden="true">–</span>
                <select
                  className="is-compact"
                  aria-label={t('pieces.loop.to')}
                  value={loop.to}
                  onChange={(e) => setBars({ from: loop.from, to: Number(e.target.value) })}
                >
                  {barOptions(loop.from)}
                </select>
              </>
            )}
          </span>
        </div>
        <fieldset className="field">
          <legend>{t('pieces.hand')}</legend>
          <div className="segmented">
            {HAND_SELECTIONS.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`${id}-hands`}
                  checked={hands === choice}
                  // A piece for one hand has nothing for the other, unless it can be made.
                  disabled={opened !== null && opened.facts.bars[choice] === 0 && !fromSymbols}
                  onChange={() => setHands(choice)}
                />
                <span>{t(`pieces.hand.${choice}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>{t('pieces.mode')}</legend>
          <div className="segmented">
            {MODES.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`${id}-mode`}
                  checked={mode === choice}
                  onChange={() => setMode(choice)}
                />
                <span>{t(`pieces.mode.${choice}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${id}-tempo`}>{t('assignments.edit.tempo')}</label>
          <select
            id={`${id}-tempo`}
            className="is-compact"
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          >
            {TEMPOS.map((value) => (
              <option key={value} value={value}>
                {format.percent(value / 100)}
              </option>
            ))}
          </select>
        </div>
        <NumberField
          label={t('assignments.edit.runs')}
          value={runs}
          min={1}
          max={MAX_RUNS}
          onChange={setRuns}
        />
        <div className="field">
          <label htmlFor={`${id}-goal`}>{t('assignments.edit.goal')}</label>
          <span className="task-bars">
            <select
              id={`${id}-goal`}
              value={goalMeasure}
              onChange={(e) => setMeasure(e.target.value as PieceMeasure | 'any')}
            >
              <option value="any">{t('assignments.edit.goal.any')}</option>
              <option value="right">{t('assignments.edit.goal.right')}</option>
              {mode === 'rhythm' && (
                <option value="inTime">{t('assignments.edit.goal.inTime')}</option>
              )}
            </select>
            {goalMeasure !== 'any' && (
              <select
                className="is-compact"
                aria-label={t('assignments.edit.goal.percent')}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
              >
                {PERCENTS.map((value) => (
                  <option key={value} value={value}>
                    {format.percent(value / 100)}
                  </option>
                ))}
              </select>
            )}
          </span>
        </div>
      </div>
      <p className="help" role="status">
        {state.status === 'loading'
          ? t('pieces.preparing')
          : !opened
            ? t('assignments.edit.pieceMissing')
            : !playable
              ? t('assignments.edit.nothingToPlay')
              : fromSymbols && hands !== 'right'
                ? t('assignments.edit.piece.leadSheet')
                : t('assignments.edit.piece.help')}
      </p>
      <Actions task={current} adding={adding} onSave={onSave} onCancel={onCancel} />
    </>
  );
}

function ScaleEditor({ task, adding, onSave, onCancel }: EditorProps<ScaleTask>) {
  const t = useT();
  const id = useId();
  const [exercise, setExercise] = useState(
    () => parseExerciseKey(task.exercise) ?? DEFAULT_EXERCISE,
  );
  const [click, setClick] = useState<ClickPrefs>(() => ({
    on: task.click !== null,
    bpm: task.click?.bpm ?? DEFAULT_CLICK.bpm,
    perBeat: isNotesPerBeat(task.click?.perBeat) ? task.click.perBeat : DEFAULT_CLICK.perBeat,
  }));
  const [runs, setRuns] = useState(task.runs);
  const current: ScaleTask = {
    kind: 'scale',
    id: task.id,
    exercise: exerciseKey(exercise),
    // The grid as it is played: the notes to the beat chosen, or the exercise's own rhythm.
    click: click.on
      ? { bpm: click.bpm, perBeat: layoutOf(exercise, click.perBeat).perBeat as GridPerBeat }
      : null,
    runs,
  };
  return (
    <>
      <ScalePicker
        id={id}
        hidden={false}
        exercise={exercise}
        onChange={setExercise}
        click={click}
        onClick={setClick}
        onChosen={() => undefined}
        disabled={false}
      />
      <div className="task-form">
        <NumberField
          label={t('assignments.edit.runs')}
          value={runs}
          min={1}
          max={MAX_RUNS}
          onChange={setRuns}
        />
      </div>
      <p className="help">{t('assignments.edit.scale.help')}</p>
      <Actions task={current} adding={adding} onSave={onSave} onCancel={onCancel} />
    </>
  );
}

function LevelEditor({ task, adding, onSave, onCancel }: EditorProps<LevelTask>) {
  const t = useT();
  const id = useId();
  const [family, setFamily] = useState<LevelFamily>(task.family);
  const [level, setLevel] = useState(task.level);
  const [mastery, setMastery] = useState(task.goal === 'mastery');
  const [sessions, setSessions] = useState(task.goal === 'mastery' ? 3 : task.goal);
  const levels = levelsOfFamily(family);
  const current: LevelTask = {
    kind: 'level',
    id: task.id,
    family,
    level: levels.includes(level) ? level : levels[0]!,
    goal: mastery ? 'mastery' : sessions,
  };
  return (
    <>
      <div className="task-form">
        <div className="field">
          <label htmlFor={`${id}-family`}>{t('assignments.edit.family')}</label>
          <select
            id={`${id}-family`}
            value={family}
            onChange={(e) => {
              const next = e.target.value as LevelFamily;
              setFamily(next);
              setLevel(levelsOfFamily(next)[0]!);
            }}
          >
            {PAGES.map((page) => (
              <optgroup key={page} label={t(`nav.${page}`)}>
                {LEVEL_FAMILIES.filter((f) => pageOfFamily(f) === page).map((f) => (
                  <option key={f} value={f}>
                    {t(familyKey(f))}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-level`}>{t('assignments.edit.level')}</label>
          <select
            id={`${id}-level`}
            value={current.level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {`${l} · ${t(levelKey(family, l))}`}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="field">
          <legend>{t('assignments.edit.levelGoal')}</legend>
          <div className="segmented">
            {([false, true] as const).map((choice) => (
              <label key={String(choice)}>
                <input
                  type="radio"
                  name={`${id}-goal`}
                  checked={mastery === choice}
                  onChange={() => setMastery(choice)}
                />
                <span>
                  {t(
                    choice
                      ? 'assignments.edit.levelGoal.mastery'
                      : 'assignments.edit.levelGoal.sessions',
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {!mastery && (
          <NumberField
            label={t('assignments.edit.sessions')}
            value={sessions}
            min={1}
            max={MAX_RUNS}
            onChange={setSessions}
          />
        )}
      </div>
      <p className="help">
        {t(
          mastery ? 'assignments.edit.level.help.mastery' : 'assignments.edit.level.help.sessions',
        )}
      </p>
      <Actions task={current} adding={adding} onSave={onSave} onCancel={onCancel} />
    </>
  );
}

function LessonEditor({ task, adding, onSave, onCancel }: EditorProps<LessonTask>) {
  const t = useT();
  const { locale } = useI18n();
  const id = useId();
  const [slug, setSlug] = useState(task.slug);
  const language = lessonLanguage(locale);
  return (
    <>
      <div className="task-form">
        <div className="field">
          <label htmlFor={id}>{t('assignments.edit.lesson')}</label>
          <select id={id} value={slug} onChange={(e) => setSlug(e.target.value)}>
            {[...LESSONS, ...EXTRAS]
              .filter((lesson) => lesson.ready)
              .map((lesson) => (
                <option key={lesson.slug} value={lesson.slug}>
                  {lesson.title[language]}
                </option>
              ))}
          </select>
        </div>
      </div>
      <p className="help">{t('assignments.edit.lesson.help')}</p>
      <Actions
        task={{ kind: 'lesson', id: task.id, slug }}
        adding={adding}
        onSave={onSave}
        onCancel={onCancel}
      />
    </>
  );
}

function MinutesEditor({ task, adding, onSave, onCancel }: EditorProps<MinutesTask>) {
  const t = useT();
  const [minutes, setMinutes] = useState(task.minutes);
  const [days, setDays] = useState(task.days);
  return (
    <>
      <div className="task-form">
        <NumberField
          label={t('assignments.edit.minutes')}
          value={minutes}
          min={1}
          max={MAX_MINUTES}
          onChange={setMinutes}
        />
        <NumberField
          label={t('assignments.edit.days')}
          value={days}
          min={1}
          max={MAX_WINDOW_DAYS}
          onChange={setDays}
        />
      </div>
      <p className="help">{t('assignments.edit.minutes.help')}</p>
      <Actions
        task={{ kind: 'minutes', id: task.id, minutes, days }}
        adding={adding}
        onSave={onSave}
        onCancel={onCancel}
      />
    </>
  );
}

/** The form of one task, by its kind, with the app's own pickers. */
export function TaskEditor({
  task,
  adding,
  onSave,
  onCancel,
}: {
  task: KnownTask;
  adding: boolean;
  onSave: (task: KnownTask) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const props = { adding, onSave, onCancel };
  let form: ReactNode;
  switch (task.kind) {
    case 'piece':
      form = <PieceEditor task={task} {...props} />;
      break;
    case 'scale':
      form = <ScaleEditor task={task} {...props} />;
      break;
    case 'level':
      form = <LevelEditor task={task} {...props} />;
      break;
    case 'lesson':
      form = <LessonEditor task={task} {...props} />;
      break;
    case 'minutes':
      form = <MinutesEditor task={task} {...props} />;
      break;
  }
  return (
    <section className="task-editor" aria-label={t(`assignments.kind.${task.kind}`)}>
      <h3>{t(`assignments.kind.${task.kind}`)}</h3>
      {form}
    </section>
  );
}

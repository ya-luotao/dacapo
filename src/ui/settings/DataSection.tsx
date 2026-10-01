import { useId, useRef, useState } from 'react';
import { GOAL_MINUTES, goalOn, withGoal, type GoalMinutes } from '../../core/goal.ts';
import { dayKey } from '../../core/streak.ts';
import {
  buildExport,
  exportFileName,
  exportText,
  parseImport,
  planImport,
  type ImportError,
  type ParsedImport,
  type Preferences,
} from '../../storage/exchange.ts';
import type { MergeResult } from '../../storage/repository.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { downloadText } from '../../lib/download.ts';
import { currentShell } from '../../lib/shell.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { useSyncStatus } from '../sync/context.ts';
import { readGoal, writeGoal } from '../progress/goal.ts';
import { useNow } from '../progress/useNow.ts';
import { Segmented } from '../Segmented.tsx';
import { ImportPreview } from './ImportPreview.tsx';
import { OfflineBlock } from './OfflineBlock.tsx';
import { inMemory, storageMessage } from './storageMessage.ts';

interface StoredIds {
  pieceSteps: ReadonlySet<string>;
  scaleRuns: ReadonlySet<string>;
  takes: ReadonlySet<string>;
}

type ImportState =
  | { step: 'idle' }
  | { step: 'error'; error: ImportError | { kind: 'read' } }
  | {
      step: 'preview';
      fileName: string;
      parsed: ParsedImport;
      /** Step records, scale runs and takes stored already, by id. */
      stored: StoredIds;
      working: boolean;
    }
  | { step: 'done'; added: MergeResult }
  | { step: 'failed' }
  | { step: 'exportFailed' };

const ERRORS: Record<(ImportError | { kind: 'read' })['kind'], MessageKey> = {
  malformed: 'settings.import.error.malformed',
  'wrong-format': 'settings.import.error.wrongFormat',
  'future-version': 'settings.import.error.futureVersion',
  'too-many-lessons': 'settings.import.error.tooManyLessons',
  read: 'settings.import.error.read',
};

interface DataSectionProps {
  /** The preferences the page above keeps; the daily goal is this section's own. */
  preferences: Omit<Preferences, 'goal'>;
  onApplyPreferences: (preferences: Preferences) => void;
}

export function DataSection({ preferences, onApplyPreferences }: DataSectionProps) {
  const t = useT();
  const id = useId();
  const practice = usePracticeStore();
  const data = usePractice();
  const status = useStorageStatus();
  const synced = Boolean(useSyncStatus()?.account);
  const now = useNow();
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ step: 'idle' });
  // The daily goal (docs/PERSONAL.md): kept as its changes, so the days before one keep theirs.
  const [goal, setGoal] = useState(readGoal);

  function onGoal(minutes: GoalMinutes) {
    const changed = withGoal(goal, dayKey(Date.now()), minutes);
    setGoal(changed);
    writeGoal(changed);
  }

  async function onExport() {
    let pieceSteps, scaleRuns, takes;
    try {
      [pieceSteps, scaleRuns, takes] = await Promise.all([
        practice.allPieceSteps(),
        practice.allScaleRuns(),
        practice.allTakes(),
      ]);
    } catch {
      setState({ step: 'exportFailed' });
      return;
    }
    const at = Date.now();
    const file = buildExport(
      { ...data, pieceSteps, scaleRuns, takes },
      { ...preferences, goal },
      { now: at, appVersion: __APP_VERSION__ },
    );
    downloadText(exportText(file), exportFileName(at));
  }

  async function onFile(file: File) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setState({ step: 'error', error: { kind: 'read' } });
      return;
    }
    const result = parseImport(text);
    if (!result.ok) {
      setState({ step: 'error', error: result.error });
      return;
    }
    const { pieceSteps, scaleRuns, takes } = result.value;
    const [stepIds, runIds, takeIds] = await Promise.all([
      pieceSteps.length > 0 ? practice.pieceStepIds() : new Set<string>(),
      scaleRuns.length > 0 ? practice.scaleRunIds() : new Set<string>(),
      takes.length > 0 ? practice.takeIds() : new Set<string>(),
    ]);
    setState({
      step: 'preview',
      fileName: file.name,
      parsed: result.value,
      stored: { pieceSteps: stepIds, scaleRuns: runIds, takes: takeIds },
      working: false,
    });
  }

  async function onApply(
    parsed: ParsedImport,
    fileName: string,
    stored: StoredIds,
    applyPreferences: boolean,
  ) {
    setState({ step: 'preview', fileName, parsed, stored, working: true });
    try {
      const added = await practice.importData({
        sessions: parsed.sessions,
        attempts: parsed.attempts,
        pieces: parsed.pieces,
        pieceSteps: parsed.pieceSteps,
        scaleRuns: parsed.scaleRuns,
        answers: parsed.answers,
        takes: parsed.takes,
        assignments: parsed.assignments,
        lessons: parsed.lessons,
      });
      if (applyPreferences && parsed.preferences) {
        // The file's goal takes this device's place, with its days; a file without one says
        // nothing of the goal.
        if (parsed.preferences.goal) {
          setGoal(parsed.preferences.goal);
          writeGoal(parsed.preferences.goal);
        }
        onApplyPreferences(parsed.preferences);
      }
      setState({ step: 'done', added });
    } catch {
      setState({ step: 'failed' });
    }
  }

  return (
    <section className="field data" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('settings.data')}</h2>
      <p className="help">{t(synced ? 'settings.data.help.synced' : 'settings.data.help')}</p>
      <p className={inMemory(status) ? 'data-status is-warning' : 'data-status'}>
        {t(storageMessage(status))}
      </p>

      <Segmented
        className="data-goal"
        legend={t('settings.goal')}
        name={`${id}-goal`}
        options={GOAL_MINUTES.map((n) => ({ value: n, label: t('progress.minutes', { n }) }))}
        value={goalOn(goal, dayKey(now))}
        onChange={onGoal}
        help={t('settings.goal.help')}
      />

      <div className="data-actions">
        <div>
          <button
            type="button"
            className="button"
            onClick={() => void onExport()}
            disabled={!status.loaded}
            aria-describedby={`${id}-export`}
          >
            {t('settings.export')}
          </button>
          <p id={`${id}-export`} className="help">
            {t('settings.export.help', { file: exportFileName(now) })}
          </p>
        </div>
        <div>
          <button
            type="button"
            className="button"
            onClick={() => fileInput.current?.click()}
            disabled={!status.loaded || (state.step === 'preview' && state.working)}
            aria-describedby={`${id}-import`}
          >
            {t('settings.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared so choosing the same file again still fires a change.
              e.target.value = '';
              if (file) void onFile(file);
            }}
          />
          <p id={`${id}-import`} className="help">
            {t('settings.import.help')}
          </p>
        </div>
      </div>

      {state.step === 'error' && (
        <p className="data-message is-error" role="alert">
          {t(ERRORS[state.error.kind], {
            version: state.error.kind === 'future-version' ? state.error.version : '',
            limit: state.error.kind === 'too-many-lessons' ? state.error.limit : '',
          })}
        </p>
      )}
      {state.step === 'preview' && (
        <ImportPreview
          fileName={state.fileName}
          parsed={state.parsed}
          plan={planImport(state.parsed, {
            sessionIds: new Set(data.sessions.map((s) => s.id)),
            attemptIds: new Set(data.attempts.map((a) => a.id)),
            pieceIds: new Set(data.pieces.map((p) => p.id)),
            pieceStepIds: state.stored.pieceSteps,
            scaleRunIds: state.stored.scaleRuns,
            answerIds: new Set(data.answers.map((a) => a.id)),
            takeIds: state.stored.takes,
            assignmentIds: new Set(data.assignments.map((a) => a.id)),
            lessons: data.lessons,
          })}
          working={state.working}
          today={dayKey(now)}
          onApply={(applyPreferences) =>
            void onApply(state.parsed, state.fileName, state.stored, applyPreferences)
          }
          onCancel={() => setState({ step: 'idle' })}
        />
      )}
      {state.step === 'done' && (
        <p className="data-message is-ok" role="status">
          {t('settings.import.done', {
            sessions: state.added.sessions,
            attempts: state.added.attempts,
            pieces: state.added.pieces,
            steps: state.added.pieceSteps,
            scaleRuns: state.added.scaleRuns,
            ear: state.added.answers,
            takes: state.added.takes,
            assignments: state.added.assignments,
            lessons: state.added.lessons,
          })}
        </p>
      )}
      {state.step === 'exportFailed' && (
        <p className="data-message is-error" role="alert">
          {t('settings.export.failed')}
        </p>
      )}
      {state.step === 'failed' && (
        <p className="data-message is-error" role="alert">
          {t('settings.import.failed')}
        </p>
      )}

      {currentShell() === 'web' && <OfflineBlock />}
    </section>
  );
}

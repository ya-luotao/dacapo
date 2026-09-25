import { useId, useRef, useState } from 'react';
import {
  buildExport,
  exportFileName,
  parseImport,
  planImport,
  type ImportError,
  type ParsedImport,
  type Preferences,
} from '../../storage/exchange.ts';
import type { MergeResult } from '../../storage/repository.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { downloadText } from '../../lib/download.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import type { StorageStatus } from '../practice/store.ts';
import { useNow } from '../progress/useNow.ts';
import { ImportPreview } from './ImportPreview.tsx';

type ImportState =
  | { step: 'idle' }
  | { step: 'error'; error: ImportError | { kind: 'read' } }
  | { step: 'preview'; fileName: string; parsed: ParsedImport; working: boolean }
  | { step: 'done'; added: MergeResult }
  | { step: 'failed' };

const ERRORS: Record<(ImportError | { kind: 'read' })['kind'], MessageKey> = {
  malformed: 'settings.import.error.malformed',
  'wrong-format': 'settings.import.error.wrongFormat',
  'future-version': 'settings.import.error.futureVersion',
  read: 'settings.import.error.read',
};

function storageMessage(status: StorageStatus): MessageKey {
  if (!status.loaded) return 'settings.storage.loading';
  if (status.state === 'unavailable') return 'settings.storage.memory';
  if (status.persisted === true) return 'settings.storage.persisted';
  if (status.persisted === false) return 'settings.storage.notPersisted';
  return 'settings.storage.unknown';
}

interface DataSectionProps {
  preferences: Preferences;
  onApplyPreferences: (preferences: Preferences) => void;
}

export function DataSection({ preferences, onApplyPreferences }: DataSectionProps) {
  const t = useT();
  const id = useId();
  const practice = usePracticeStore();
  const data = usePractice();
  const status = useStorageStatus();
  const now = useNow();
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ step: 'idle' });

  function onExport() {
    const at = Date.now();
    const file = buildExport(data, preferences, { now: at, appVersion: __APP_VERSION__ });
    downloadText(`${JSON.stringify(file, null, 2)}\n`, exportFileName(at));
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
    setState(
      result.ok
        ? { step: 'preview', fileName: file.name, parsed: result.value, working: false }
        : { step: 'error', error: result.error },
    );
  }

  async function onApply(parsed: ParsedImport, fileName: string, applyPreferences: boolean) {
    setState({ step: 'preview', fileName, parsed, working: true });
    try {
      const added = await practice.importData({
        sessions: parsed.sessions,
        attempts: parsed.attempts,
        pieces: parsed.pieces,
      });
      if (applyPreferences && parsed.preferences) onApplyPreferences(parsed.preferences);
      setState({ step: 'done', added });
    } catch {
      setState({ step: 'failed' });
    }
  }

  return (
    <section className="field data" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('settings.data')}</h2>
      <p className="help">{t('settings.data.help')}</p>
      <p className={status.state === 'unavailable' ? 'data-status is-warning' : 'data-status'}>
        {t(storageMessage(status))}
      </p>

      <div className="data-actions">
        <div>
          <button
            type="button"
            className="button"
            onClick={onExport}
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
          })}
          working={state.working}
          onApply={(applyPreferences) =>
            void onApply(state.parsed, state.fileName, applyPreferences)
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
          })}
        </p>
      )}
      {state.step === 'failed' && (
        <p className="data-message is-error" role="alert">
          {t('settings.import.failed')}
        </p>
      )}
    </section>
  );
}

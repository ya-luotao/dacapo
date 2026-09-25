import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Link } from 'wouter';
import type { ScoreErrorKind } from '../../core/musicxml.ts';
import { pieceFacts } from '../../core/pieceRecords.ts';
import type { ScoreWarning } from '../../core/score.ts';
import type { StoredPiece } from '../../core/storedPiece.ts';
import { useT } from '../../i18n/index.ts';
import {
  isPieceFileName,
  PIECE_EXTENSIONS,
  readPieceFile,
  readScore,
  ScoreError,
} from '../../pieces/load.ts';
import { countUnplaced } from '../notation/verovio.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { HandsEditor } from './HandsEditor.tsx';
import { PieceProgress } from './PieceProgress.tsx';
import { forgetPiecePrefs } from './prefs.ts';

type ImportState =
  | { step: 'idle' }
  | { step: 'reading'; name: string }
  | { step: 'checking'; name: string }
  | { step: 'error'; error: ScoreErrorKind | 'type' | 'read' }
  | {
      step: 'report';
      piece: StoredPiece;
      bars: number;
      notes: number;
      /** null: the score could not be drawn to check. */
      unplaced: number | null;
    };

function titleFromFile(name: string): string {
  return name.replace(/\.(musicxml|xml|mxl)$/i, '').replace(/[_]+/g, ' ');
}

export function YourPieces() {
  const t = useT();
  const id = useId();
  const store = usePracticeStore();
  const { pieces } = usePractice();
  const { loaded } = useStorageStatus();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ step: 'idle' });
  const [dragging, setDragging] = useState(false);
  const busy = state.step === 'reading' || state.step === 'checking';

  // Pieces imported before their facts were kept get them now, one at a time.
  const missing = pieces.find((p) => !p.facts);
  useEffect(() => {
    if (!missing) return;
    const id = setTimeout(() => {
      try {
        store.savePiece({ ...missing, facts: pieceFacts(readScore(missing.xml, missing.hands)) });
      } catch {
        // Unreadable: the practice page says so; the library line just has no bar count.
      }
    }, 0);
    return () => clearTimeout(id);
  }, [missing, store]);

  async function importFile(file: File) {
    if (!isPieceFileName(file.name)) {
      setState({ step: 'error', error: 'type' });
      return;
    }
    setState({ step: 'reading', name: file.name });
    let read;
    try {
      read = await readPieceFile(file);
    } catch (error) {
      setState({ step: 'error', error: error instanceof ScoreError ? error.kind : 'read' });
      return;
    }
    const { xml, score } = read;
    const piece: StoredPiece = {
      id: crypto.randomUUID(),
      title: score.title || titleFromFile(file.name),
      composer: score.composer,
      fileName: file.name,
      xml,
      importedAt: Date.now(),
      hands: null,
      warnings: score.warnings,
      facts: pieceFacts(score),
    };
    store.savePiece(piece);
    setState({ step: 'checking', name: file.name });
    let unplaced: number | null;
    try {
      unplaced = await countUnplaced(xml, score);
    } catch {
      unplaced = null;
    }
    setState({
      step: 'report',
      piece,
      bars: score.measures.length,
      notes: score.notes.filter((n) => n.hand !== null && !n.tieStop).length,
      unplaced,
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !busy) void importFile(file);
  }

  return (
    <section className="your-pieces" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('pieces.yours')}</h2>
      <p className="help">{t('pieces.yours.help')}</p>

      <div
        className={dragging ? 'pieces-drop is-dragging' : 'pieces-drop'}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="button"
          onClick={() => input.current?.click()}
          disabled={!loaded || busy}
        >
          {t('pieces.import')}
        </button>
        <span className="muted">{dragging ? t('pieces.drop.active') : t('pieces.drop')}</span>
        <input
          ref={input}
          type="file"
          accept={[...PIECE_EXTENSIONS, 'application/vnd.recordare.musicxml+xml'].join(',')}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so choosing the same file again still fires a change.
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>

      <div aria-live="polite">
        {state.step === 'reading' && (
          <p className="pieces-progress">{t('pieces.import.reading', { name: state.name })}</p>
        )}
        {state.step === 'checking' && (
          <p className="pieces-progress">{t('pieces.import.checking')}</p>
        )}
        {state.step === 'error' && (
          <p className="data-message is-error" role="alert">
            {t(`pieces.import.error.${state.error}`)}
          </p>
        )}
        {state.step === 'report' && (
          <ImportReport
            piece={state.piece}
            bars={state.bars}
            notes={state.notes}
            unplaced={state.unplaced}
            onClose={() => setState({ step: 'idle' })}
          />
        )}
      </div>

      {loaded && pieces.length === 0 && <p className="muted">{t('pieces.yours.empty')}</p>}
      {pieces.length > 0 && (
        <ul className="library-list your-list">
          {pieces.map((piece) => (
            <ImportedPiece key={piece.id} piece={piece} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ImportReport({
  piece,
  bars,
  notes,
  unplaced,
  onClose,
}: {
  piece: StoredPiece;
  bars: number;
  notes: number;
  unplaced: number | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <section
      className="import-preview pieces-report"
      aria-label={t('pieces.import.done', { title: piece.title })}
    >
      <h3>{t('pieces.import.done', { title: piece.title })}</h3>
      <p className="muted">{t('pieces.import.size', { bars, notes })}</p>
      <p className={unplaced ? 'pieces-report-warn' : undefined}>
        {unplaced === null
          ? t('pieces.import.unchecked')
          : unplaced === 0
            ? t('pieces.import.placed')
            : t('pieces.import.unplaced', { n: unplaced })}
      </p>
      {piece.warnings.length > 0 && <Warnings warnings={piece.warnings} />}
      <div className="actions">
        <Link href={`/pieces/${piece.id}`} className="button button-primary">
          {t('pieces.import.open')}
        </Link>
        <button type="button" className="button" onClick={onClose}>
          {t('pieces.import.close')}
        </button>
      </div>
    </section>
  );
}

export function Warnings({ warnings }: { warnings: readonly ScoreWarning[] }) {
  const t = useT();
  return (
    <div className="pieces-warnings">
      <p>{t('pieces.import.warnings')}</p>
      <ul>
        {warnings.map((w) => (
          <li key={w}>{t(`pieces.warning.${w}`)}</li>
        ))}
      </ul>
    </div>
  );
}

type RowMode = 'view' | 'rename' | 'hands' | 'delete';

function ImportedPiece({ piece }: { piece: StoredPiece }) {
  const t = useT();
  const format = usePieceFormat();
  const store = usePracticeStore();
  const [mode, setMode] = useState<RowMode>('view');
  const [title, setTitle] = useState(piece.title);
  const [deleteRecords, setDeleteRecords] = useState(true);
  const titleId = useId();
  const shown = piece.title || t('pieces.untitled');

  return (
    <li className="your-piece">
      <div className="your-piece-row">
        <Link href={`/pieces/${piece.id}`} className="library-piece">
          <span className="library-piece-title">{shown}</span>
          {piece.composer && <span className="library-piece-composer">{piece.composer}</span>}
          <span className="library-piece-note">
            {piece.fileName} · {t('pieces.imported', { date: format.date(piece.importedAt) })}
          </span>
          <PieceProgress pieceId={piece.id} facts={piece.facts} />
        </Link>
        <div className="your-piece-actions">
          <button
            type="button"
            className="button-link"
            aria-expanded={mode === 'rename'}
            onClick={() => {
              setTitle(piece.title);
              setMode(mode === 'rename' ? 'view' : 'rename');
            }}
          >
            {t('pieces.rename')}
          </button>
          <button
            type="button"
            className="button-link"
            aria-expanded={mode === 'hands'}
            onClick={() => setMode(mode === 'hands' ? 'view' : 'hands')}
          >
            {t('pieces.hands')}
          </button>
          <button
            type="button"
            className="button-link is-danger"
            aria-expanded={mode === 'delete'}
            onClick={() => setMode(mode === 'delete' ? 'view' : 'delete')}
          >
            {t('pieces.delete')}
          </button>
        </div>
      </div>

      {mode === 'rename' && (
        <form
          className="your-piece-panel rename"
          onSubmit={(e) => {
            e.preventDefault();
            const next = title.trim();
            if (next && next !== piece.title) store.savePiece({ ...piece, title: next });
            setMode('view');
          }}
        >
          <label htmlFor={titleId}>{t('pieces.rename.label')}</label>
          <input
            id={titleId}
            className="text-input"
            value={title}
            maxLength={200}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMode('view');
            }}
          />
          <button type="submit" className="button button-primary" disabled={!title.trim()}>
            {t('pieces.save')}
          </button>
          <button type="button" className="button" onClick={() => setMode('view')}>
            {t('pieces.cancel')}
          </button>
        </form>
      )}
      {mode === 'hands' && (
        <HandsEditor
          piece={piece}
          onDone={(hands) => {
            if (hands !== undefined) {
              let facts = piece.facts;
              try {
                facts = pieceFacts(readScore(piece.xml, hands));
              } catch {
                // Kept as they were; the practice page recomputes them.
              }
              store.savePiece({ ...piece, hands, ...(facts && { facts }) });
            }
            setMode('view');
          }}
        />
      )}
      {mode === 'delete' && (
        <div className="your-piece-panel" role="alertdialog" aria-label={t('pieces.delete')}>
          <p>{t('pieces.delete.confirm', { title: shown })}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={deleteRecords}
              onChange={(e) => setDeleteRecords(e.target.checked)}
            />
            <span>{t('pieces.delete.records')}</span>
          </label>
          <p className="help">{t('pieces.delete.log')}</p>
          <div className="actions">
            <button
              type="button"
              className="button button-danger"
              autoFocus
              onClick={() => {
                store.deletePiece(piece.id, { steps: deleteRecords });
                forgetPiecePrefs(piece.id);
              }}
            >
              {t('pieces.delete')}
            </button>
            <button type="button" className="button" onClick={() => setMode('view')}>
              {t('pieces.cancel')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

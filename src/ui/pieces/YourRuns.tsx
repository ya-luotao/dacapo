import { useEffect, useMemo, useRef, useState } from 'react';
import { takeEvents, type TakeEvent } from '../../core/takes.ts';
import { analyzeExpression, type Melody } from '../../core/expression.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { LeftHandChoice } from '../../core/leadSheet.ts';
import type { Score } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';
import { ExpressionPanel } from './ExpressionPanel.tsx';
import type { ExpressionAspect } from './expressionPrefs.ts';
import type { PieceFormat } from './format.ts';
import { PlayBackButton } from './PlayBackButton.tsx';
import { RunList } from './RunList.tsx';
import { usePieceRuns, useRunFacts, useRunTake } from './runs.ts';
import { usePracticeStore } from '../practice/context.ts';

/** What playing a past run back needs of its take. */
export interface PastTake {
  events: readonly TakeEvent[];
  latency: number;
}

/**
 * "Your runs": the piece's past runs, laid over the score, each with its expression, computed
 * from its take when it is opened.
 */
export function YourRuns({
  pieceId,
  checksum,
  leftHand,
  scoreIn,
  format,
  melody,
  aspects,
  onMelody,
  onLoopBars,
  onPlayBack,
  onClose,
}: {
  pieceId: string;
  checksum: string;
  /** The left hand the piece is practised with now: a run with another has other notes. */
  leftHand: LeftHandChoice;
  /** The piece in the key a run was played in (semitones from the written key). */
  scoreIn: (transpose: number) => Score | null;
  format: PieceFormat;
  melody: Melody;
  /** The aspects judged; with none, a run offers no expression. */
  aspects: readonly ExpressionAspect[];
  onMelody: (melody: Melody) => void;
  onLoopBars: (from: number, to: number) => void;
  /** Plays a run back; absent without an output to play it on. */
  onPlayBack?: (run: PieceSessionRecord, take: PastTake) => void;
  onClose: () => void;
}) {
  const t = useT();
  const log = useLogFormat();
  const store = usePracticeStore();
  const runs = usePieceRuns(pieceId);
  /** A row's take being read, or why it cannot be played back. */
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);

  async function playBack(run: PieceSessionRecord) {
    if (!onPlayBack) return;
    if ((run.leftHand ?? 'written') !== leftHand) {
      setNotice({ id: run.id, text: t('pieces.runs.otherLeftHand') });
      return;
    }
    setNotice({ id: run.id, text: t('pieces.runs.loading') });
    const chunks = await store.takes({ sessionId: run.id }).catch(() => null);
    if (!chunks || chunks.length === 0) {
      setNotice({ id: run.id, text: t('pieces.runs.noTake') });
      return;
    }
    if (chunks[0]!.checksum !== checksum) {
      setNotice({ id: run.id, text: t('pieces.runs.changed') });
      return;
    }
    setNotice(null);
    onPlayBack(run, { events: takeEvents(chunks), latency: chunks[0]!.latency ?? 0 });
  }
  const facts = useRunFacts();
  const [open, setOpen] = useState<PieceSessionRecord | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [open]);

  return (
    <section
      className="piece-summary your-runs"
      aria-labelledby="your-runs-title"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (open) setOpen(null);
        else onClose();
      }}
    >
      <div className="weak-table-head">
        <h2 id="your-runs-title" ref={heading} tabIndex={-1}>
          {open ? log.dateTime(open.startedAt) : t('pieces.runs.title')}
        </h2>
        <div className="actions">
          {open && (
            <button type="button" className="button is-compact" onClick={() => setOpen(null)}>
              {t('pieces.runs.back')}
            </button>
          )}
          <button type="button" className="button is-compact" onClick={onClose}>
            {t('pieces.weak.table.close')}
          </button>
        </div>
      </div>
      {open && <p className="your-runs-facts">{facts(open)}</p>}
      {open ? (
        <PastRun
          run={open}
          checksum={checksum}
          otherLeftHand={(open.leftHand ?? 'written') !== leftHand}
          score={scoreIn(open.transpose ?? 0)}
          format={format}
          melody={melody}
          aspects={aspects}
          onMelody={onMelody}
          onLoopBars={onLoopBars}
          onPlayBack={onPlayBack && ((take) => onPlayBack(open, take))}
        />
      ) : (
        <RunList
          runs={runs}
          actions={(run) => (
            <>
              {onPlayBack && <PlayBackButton compact onClick={() => void playBack(run)} />}
              {aspects.length > 0 && (
                <button type="button" className="button is-compact" onClick={() => setOpen(run)}>
                  {t('pieces.expression')}
                </button>
              )}
              {notice?.id === run.id && (
                <p className="muted run-notice" role="status">
                  {notice.text}
                </p>
              )}
            </>
          )}
        />
      )}
    </section>
  );
}

function PastRun({
  run,
  checksum,
  otherLeftHand,
  score,
  format,
  melody,
  aspects,
  onMelody,
  onLoopBars,
  onPlayBack,
}: {
  run: PieceSessionRecord;
  checksum: string;
  /** The run was played with another left hand than the piece has now. */
  otherLeftHand: boolean;
  /** The piece in the run's key; null when it cannot be had. */
  score: Score | null;
  format: PieceFormat;
  melody: Melody;
  aspects: readonly ExpressionAspect[];
  onMelody: (melody: Melody) => void;
  onLoopBars: (from: number, to: number) => void;
  onPlayBack?: (take: PastTake) => void;
}) {
  const t = useT();
  const take = useRunTake(run.id, checksum);
  const analysis = useMemo(
    () =>
      take.state === 'ready' && score
        ? analyzeExpression({
            score,
            hands: run.hands,
            repeats: run.repeats,
            loop: run.loop,
            mode: run.mode === 'rhythm' ? 'rhythm' : 'wait',
            scale: run.tempo / 100,
            latency: take.latency,
            events: take.events,
            melody,
          })
        : null,
    [take, score, run, melody],
  );
  if (otherLeftHand) return <p className="muted">{t('pieces.runs.otherLeftHand')}</p>;
  if (take.state === 'loading') return <p className="muted">{t('pieces.runs.loading')}</p>;
  if (take.state === 'none') return <p className="muted">{t('pieces.runs.noTake')}</p>;
  if (take.state === 'changed') return <p className="muted">{t('pieces.runs.changed')}</p>;
  const playButton = onPlayBack && (
    <p className="your-runs-play">
      <PlayBackButton
        compact
        onClick={() => onPlayBack({ events: take.events, latency: take.latency })}
      />
    </p>
  );
  if (!analysis || aspects.length === 0) return playButton;
  return (
    <>
      {playButton}
      <ExpressionPanel
        analysis={analysis}
        format={format}
        hands={run.hands}
        melody={melody}
        aspects={aspects}
        onMelody={onMelody}
        onLoopBars={onLoopBars}
      />
    </>
  );
}

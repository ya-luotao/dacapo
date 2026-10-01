import { useEffect, useMemo, useState } from 'react';
import type { PieceSessionRecord } from '../../core/log.ts';
import { takeEvents, type TakeChunk, type TakeEvent } from '../../core/takes.ts';
import { useT } from '../../i18n/index.ts';
import { usePractice, usePracticeStore } from '../practice/context.ts';
import { useLogFormat } from '../progress/format.ts';
import { shiftText } from './keyFormat.ts';

// A piece's past runs, and what was played in one of them (its take), read from storage only
// when a run is opened. The Expression panel of a past run is computed from it; "Play back your
// run" (docs/PIECES.md, P5) plays it.

/** A piece's runs, most recent first. */
export function usePieceRuns(pieceId: string): PieceSessionRecord[] {
  const { sessions } = usePractice();
  return useMemo(
    () =>
      sessions
        .filter((s): s is PieceSessionRecord => s.kind === 'piece' && s.pieceId === pieceId)
        .sort((a, b) => b.startedAt - a.startedAt || (a.id < b.id ? 1 : -1)),
    [sessions, pieceId],
  );
}

/** A run in a line: its mode, hands, bars, tempo and time. */
export function useRunFacts(): (run: PieceSessionRecord) => string {
  const t = useT();
  const log = useLogFormat();
  return (run) =>
    [
      run.memory
        ? t('pieces.runs.memory', {
            stage: t(`pieces.memory.stage.${run.memory.stage}`),
            n: run.memory.prompts,
          })
        : t(run.mode === 'rhythm' ? 'pieces.mode.rhythm' : 'pieces.mode.wait'),
      t(`progress.session.hands.${run.hands}`),
      ...(run.leftHand
        ? [t('pieces.runs.leftHand', { pattern: t(`harmony.pattern.${run.leftHand}`) })]
        : []),
      ...(run.transpose ? [t('pieces.runs.key', { shift: shiftText(run.transpose) })] : []),
      run.loop
        ? run.loop.fromLabel === run.loop.toLabel
          ? t('progress.session.bar', { bar: run.loop.fromLabel })
          : t('progress.session.barRange', { from: run.loop.fromLabel, to: run.loop.toLabel })
        : t('progress.session.wholePiece'),
      t('pieces.tempo.percent', { percent: run.tempo }),
      log.duration(run.activeMs),
    ].join(' · ');
}

export type RunTake =
  | { state: 'loading' }
  /** Nothing of it was kept: a run from before takes, or the take could not be read. */
  | { state: 'none' }
  /** Played on another version of the piece's notes: its steps no longer match. */
  | { state: 'changed' }
  | {
      state: 'ready';
      chunks: TakeChunk[];
      events: TakeEvent[];
      /** Rhythm mode: the latency taken off every key. */
      latency: number;
    };

/** One run's take, read when asked; `checksum` is the piece's as it is now. */
export function useRunTake(sessionId: string, checksum: string): RunTake {
  const store = usePracticeStore();
  const [loaded, setLoaded] = useState<{ id: string; chunks: TakeChunk[] | null } | null>(null);
  useEffect(() => {
    let live = true;
    store.takes({ sessionId }).then(
      (chunks) => live && setLoaded({ id: sessionId, chunks }),
      () => live && setLoaded({ id: sessionId, chunks: null }),
    );
    return () => {
      live = false;
    };
  }, [store, sessionId]);
  return useMemo((): RunTake => {
    if (loaded?.id !== sessionId) return { state: 'loading' };
    const chunks = loaded.chunks;
    if (!chunks || chunks.length === 0) return { state: 'none' };
    if (chunks[0]!.checksum !== checksum) return { state: 'changed' };
    return {
      state: 'ready',
      chunks,
      events: takeEvents(chunks),
      latency: chunks[0]!.latency ?? 0,
    };
  }, [loaded, sessionId, checksum]);
}

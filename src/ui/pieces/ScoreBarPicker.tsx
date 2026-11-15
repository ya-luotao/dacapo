import { useMemo, type MouseEvent } from 'react';
import type { BarLoop } from '../../core/wait.ts';
import { useT } from '../../i18n/index.ts';
import type { BarBox, BarBoxes } from '../notation/ScoreView.tsx';
import type { PieceFormat } from './format.ts';

/** Inclusive 0-based bar range selected for looping. */
export type LoopRange = BarLoop;

/** Props for the pointer bar-picker overlay rendered above the score SVG. */
export interface ScoreBarPickerProps {
  boxes: BarBoxes;
  format: PieceFormat;
  startBar: number;
  loop: LoopRange | null;
  disabled?: boolean;
  onStartBar: (measure: number) => void;
  onLoopRange: (from: number, to: number) => void;
  onClearLoop: () => void;
}

interface LoopSegment {
  key: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const BAR_PAD = 8;
const SYSTEM_TOLERANCE = 8;

function buildLoopSegments(
  entries: readonly (readonly [number, BarBox])[],
  loop: LoopRange | null,
): LoopSegment[] {
  if (!loop) return [];
  const segments: Array<LoopSegment & { refTop: number; right: number; bottom: number }> = [];
  for (const [measure, box] of entries) {
    if (measure < loop.from || measure > loop.to) continue;
    const prev = segments[segments.length - 1];
    if (
      prev &&
      Math.abs(box.top - prev.refTop) <= SYSTEM_TOLERANCE &&
      box.left >= prev.left - SYSTEM_TOLERANCE
    ) {
      prev.left = Math.min(prev.left, box.left);
      prev.top = Math.min(prev.top, box.top - BAR_PAD);
      prev.right = Math.max(prev.right, box.left + box.width);
      prev.bottom = Math.max(prev.bottom, box.top + box.height + BAR_PAD);
      prev.width = prev.right - prev.left;
      prev.height = prev.bottom - prev.top;
    } else {
      segments.push({
        key: measure,
        refTop: box.top,
        left: box.left,
        top: box.top - BAR_PAD,
        width: box.width,
        height: box.height + 2 * BAR_PAD,
        right: box.left + box.width,
        bottom: box.top + box.height + BAR_PAD,
      });
    }
  }
  return segments;
}

/**
 * Subtle pointer overlay on top of rendered score bars: click to start at a bar,
 * Shift-click to set a loop range, and clear active loops directly on the score.
 */
export function ScoreBarPicker({
  boxes,
  format,
  startBar,
  loop,
  disabled = false,
  onStartBar,
  onLoopRange,
  onClearLoop,
}: ScoreBarPickerProps) {
  const t = useT();
  const entries = useMemo(() => [...boxes.entries()].sort((a, b) => a[0] - b[0]), [boxes]);
  const segments = useMemo(() => buildLoopSegments(entries, loop), [entries, loop]);

  if (entries.length === 0) return null;

  const firstSegment = segments[0] ?? null;
  const clearLabel = loop
    ? t('pieces.bar.clearLoop', { bars: format.barSpan(loop.from, loop.to) })
    : '';

  function handleBarClick(e: MouseEvent<HTMLDivElement>, measure: number) {
    if (disabled) return;
    if (e.shiftKey) {
      const anchor = loop ? loop.from : startBar;
      onLoopRange(Math.min(anchor, measure), Math.max(anchor, measure));
      return;
    }
    onStartBar(measure);
  }

  return (
    <div className={disabled ? 'score-bar-picker is-disabled' : 'score-bar-picker'}>
      {segments.map((seg) => (
        <div
          key={seg.key}
          className="score-bar-loop-band"
          aria-hidden="true"
          style={{ left: seg.left, top: seg.top, width: seg.width, height: seg.height }}
        />
      ))}

      {entries.map(([measure, box]) => {
        const isStart = measure === startBar;
        const isInLoop = loop !== null && measure >= loop.from && measure <= loop.to;
        const classes = ['score-bar-hit'];
        if (isStart) classes.push('is-start');
        if (isInLoop) classes.push('is-loop');
        return (
          <div
            key={measure}
            className={classes.join(' ')}
            aria-hidden="true"
            style={{
              left: box.left,
              top: box.top - BAR_PAD,
              width: box.width,
              height: box.height + 2 * BAR_PAD,
            }}
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault();
            }}
            onClick={(e) => handleBarClick(e, measure)}
          >
            <span className="score-bar-badge">{format.barLabel(measure)}</span>
          </div>
        );
      })}

      {loop && firstSegment && (
        <button
          type="button"
          className="score-bar-clear"
          disabled={disabled}
          aria-label={clearLabel}
          title={clearLabel}
          style={{
            left: firstSegment.left + firstSegment.width,
            top: Math.max(12, firstSegment.top),
          }}
          onClick={onClearLoop}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}

      {!disabled && (
        <p className="score-bar-hint" aria-hidden="true">
          {t('pieces.bar.hint')}
        </p>
      )}
    </div>
  );
}

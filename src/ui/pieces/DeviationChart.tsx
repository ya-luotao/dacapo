import { useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { MAX_WINDOW_MS } from '../../core/rhythm.ts';
import { IN_TIME_MS, type RhythmSummary, type RunNote } from '../../core/rhythmRun.ts';
import { midiName } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';
import { useTimingWords } from './timingWords.ts';

// One run's timing: a dot per note played, early below the zero line and late above it, over a
// band of ±50 ms, missed notes as crosses along the bottom. One series, so no legend box: the
// axis words say what up and down mean. The same notes are listed in a table.

const WIDTH = 640;
const PLOT_TOP = 10;
const PLOT_HEIGHT = 104;
const MISSED_Y = PLOT_TOP + PLOT_HEIGHT + 16;
const HEIGHT = MISSED_Y + 12;
const LEFT = 44;
const RIGHT = 8;
const TICKS = [-100, -50, 0, 50, 100];
const DOT_R = 4;

const y = (ms: number) =>
  PLOT_TOP +
  ((MAX_WINDOW_MS - Math.max(-MAX_WINDOW_MS, Math.min(MAX_WINDOW_MS, ms))) / (2 * MAX_WINDOW_MS)) *
    PLOT_HEIGHT;

export function DeviationChart({
  summary,
  format,
}: {
  summary: RhythmSummary;
  format: PieceFormat;
}) {
  const t = useT();
  const id = useId();
  const words = useTimingWords();
  const frame = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ note: RunNote; x: number } | null>(null);
  const notes = summary.timeline;
  const span = Math.max(1, notes.at(-1)?.time ?? 1);
  const x = (time: number) => LEFT + (time / span) * (WIDTH - LEFT - RIGHT);
  const points = useMemo(
    () => notes.map((note) => ({ note, cx: LEFT + (note.time / span) * (WIDTH - LEFT - RIGHT) })),
    [notes, span],
  );

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * WIDTH;
    let best: (typeof points)[number] | null = null;
    for (const p of points) if (!best || Math.abs(p.cx - px) < Math.abs(best.cx - px)) best = p;
    if (!best || Math.abs(best.cx - px) > 24) setHover(null);
    else setHover({ note: best.note, x: (best.cx / WIDTH) * 100 });
  }

  const label = (note: RunNote) =>
    t('pieces.rhythm.chart.note', {
      bar: format.barTitle(note.measure),
      key: midiName(note.midi),
      timing: words(note.deviation),
    });

  return (
    <figure className="deviation">
      <figcaption id={`${id}-title`}>{t('pieces.rhythm.chart')}</figcaption>
      <div className="deviation-frame" ref={frame}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          <rect
            className="deviation-band"
            x={LEFT}
            y={y(IN_TIME_MS)}
            width={WIDTH - LEFT - RIGHT}
            height={y(-IN_TIME_MS) - y(IN_TIME_MS)}
          />
          {TICKS.map((ms) => (
            <g key={ms} className={ms === 0 ? 'deviation-zero' : 'deviation-grid'}>
              {ms === 0 && <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} />}
              <text x={LEFT - 6} y={y(ms)} dy="0.32em" textAnchor="end">
                {ms > 0 ? `+${ms}` : ms}
              </text>
            </g>
          ))}
          <text className="deviation-word" x={LEFT + 4} y={PLOT_TOP + 8}>
            {t('pieces.rhythm.chart.late')}
          </text>
          <text className="deviation-word" x={LEFT + 4} y={PLOT_TOP + PLOT_HEIGHT - 4}>
            {t('pieces.rhythm.chart.early')}
          </text>
          {summary.drift.map((stretch) => (
            <g key={stretch.fromTime} className="deviation-stretch">
              <line
                x1={x(stretch.fromTime)}
                x2={x(stretch.toTime)}
                y1={PLOT_TOP + 1}
                y2={PLOT_TOP + 1}
              />
              <text
                x={(x(stretch.fromTime) + x(stretch.toTime)) / 2}
                y={PLOT_TOP + 12}
                textAnchor="middle"
              >
                {t(
                  stretch.direction === 'faster'
                    ? 'pieces.rhythm.chart.faster'
                    : 'pieces.rhythm.chart.slower',
                )}
              </text>
            </g>
          ))}
          {points.map(({ note, cx }, i) =>
            note.deviation === null ? (
              <path
                key={i}
                className="deviation-missed"
                d={`M${cx - 3.5} ${MISSED_Y - 3.5}l7 7m0 -7l-7 7`}
              />
            ) : (
              <circle
                key={i}
                className={hover?.note === note ? 'deviation-dot is-hover' : 'deviation-dot'}
                cx={cx}
                cy={y(note.deviation)}
                r={DOT_R}
              />
            ),
          )}
          <text className="deviation-word" x={LEFT - 6} y={MISSED_Y} dy="0.32em" textAnchor="end">
            {t('pieces.rhythm.chart.missed')}
          </text>
        </svg>
        {hover && (
          <p className="deviation-tip" style={{ left: `${hover.x}%` }} aria-hidden="true">
            {label(hover.note)}
          </p>
        )}
      </div>
      <p id={`${id}-desc`} className="help">
        {t('pieces.rhythm.chart.desc', { ms: IN_TIME_MS })}
      </p>
      <details className="history-details">
        <summary>{t('pieces.rhythm.table')}</summary>
        <div className="hm-table-scroll">
          <table className="history-table deviation-table">
            <thead>
              <tr>
                <th scope="col">{t('pieces.rhythm.table.time')}</th>
                <th scope="col">{t('pieces.rhythm.table.bar')}</th>
                <th scope="col">{t('pieces.rhythm.table.key')}</th>
                <th scope="col">{t('pieces.rhythm.table.timing')}</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note, i) => (
                <tr key={i}>
                  <td>{format.seconds(note.time)}</td>
                  <th scope="row">
                    {summary.rounds > 1
                      ? t('pieces.rhythm.table.round', {
                          bar: format.barShort(note.measure),
                          n: note.round + 1,
                        })
                      : format.barShort(note.measure)}
                  </th>
                  <td>{midiName(note.midi)}</td>
                  <td>{words(note.deviation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

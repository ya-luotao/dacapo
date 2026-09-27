import { useId, useMemo, useState, type PointerEvent } from 'react';
import type { HandAnalysis, NoteFigures } from '../../core/evenness.ts';
import { useT } from '../../i18n/index.ts';

// One run of one hand, note by note in the order of the scale: each note's deviation from the line
// through its neighbours (late above, early below), crosses for missed and wrong notes, a pause
// mark where the player hesitated, the turn at the top as a rule, the crossings under the axis,
// and the loudness of each note against its neighbours as a thin row below. The same notes are
// listed in a table.

const WIDTH = 640;
const LEFT = 52;
/** Room between the labels on the left and the first note. */
const INSET = 10;
const RIGHT = 8;
const TOP = 14;
const PLOT = 104;
const MARK_Y = TOP + PLOT + 20;
const FINGER_Y = MARK_Y + 16;
const LOUD_TOP = FINGER_Y + 16;
const LOUD = 28;
const DOT_R = 4;
/** The plot shows at least ±40 ms, and never more than ±150: beyond, a dot sits on the edge. */
const MIN_RANGE = 40;
const MAX_RANGE = 150;
/** Finger numbers are written under every note while they have room; else only at crossings. */
const FINGERS_ALL_UP_TO = 36;

export function ProfileChart({
  hand,
  names,
}: {
  hand: HandAnalysis;
  /** Each note's name as the scale spells it (F𝄪, not G), by index. */
  names: readonly string[];
}) {
  const t = useT();
  const id = useId();
  const [hover, setHover] = useState<{ note: NoteFigures; x: number } | null>(null);
  const notes = hand.notes;
  const loud = hand.loudness !== null;
  const height = (loud ? LOUD_TOP + LOUD : FINGER_Y) + 6;

  const range = useMemo(() => {
    const most = Math.max(0, ...notes.map((n) => Math.abs(n.deviation ?? 0)));
    return Math.min(MAX_RANGE, Math.max(MIN_RANGE, Math.ceil(most / 20) * 20));
  }, [notes]);
  const loudRange = useMemo(
    () => Math.max(12, ...notes.map((n) => Math.abs(n.velocityResidual ?? 0))),
    [notes],
  );
  const step = (WIDTH - LEFT - INSET - RIGHT) / Math.max(1, notes.length - 1);
  const x = (index: number) => LEFT + INSET + index * step;
  const y = (ms: number) =>
    TOP + ((range - Math.max(-range, Math.min(range, ms))) / (2 * range)) * PLOT;
  const ticks = [-range, -range / 2, 0, range / 2, range];
  const turn = notes.find((n) => n.turn);

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * WIDTH;
    const index = Math.round((px - LEFT - INSET) / step);
    const note = notes[Math.max(0, Math.min(notes.length - 1, index))];
    if (!note || Math.abs(x(note.index) - px) > Math.max(12, step)) setHover(null);
    else setHover({ note, x: (x(note.index) / WIDTH) * 100 });
  }

  const timing = (note: NoteFigures) => {
    if (note.outcome === 'missed') return t('scales.note.missed');
    if (note.outcome === 'wrong') return t('scales.note.wrong');
    if (note.deviation === null) return t('scales.note.noTiming');
    const ms = Math.round(Math.abs(note.deviation));
    if (ms === 0) return t('scales.note.onLine');
    return note.deviation > 0 ? t('scales.note.late', { ms }) : t('scales.note.early', { ms });
  };
  const finger = (note: NoteFigures) =>
    note.finger === null ? '' : t('scales.note.finger', { finger: note.finger });
  const loudness = (note: NoteFigures) =>
    note.velocity === null || note.velocityResidual === null
      ? ''
      : t(note.accent ? 'scales.note.accent' : 'scales.note.velocity', {
          velocity: note.velocity,
          residual: `${note.velocityResidual > 0 ? '+' : note.velocityResidual < 0 ? '−' : '±'}${Math.abs(Math.round(note.velocityResidual))}`,
        });
  const label = (note: NoteFigures) =>
    [
      t('scales.note.label', { n: note.index + 1, key: names[note.index] ?? '' }),
      finger(note),
      timing(note),
      note.hesitation !== null
        ? t('scales.note.hesitation', { ms: Math.round(note.hesitation) })
        : '',
      loud ? loudness(note) : '',
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <figure className="deviation scale-profile">
      <figcaption id={`${id}-title`}>{t('scales.chart')}</figcaption>
      <div className="deviation-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((ms) => (
            <g key={ms} className={ms === 0 ? 'deviation-zero' : 'deviation-grid'}>
              {ms === 0 && <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} />}
              <text x={LEFT - 6} y={y(ms)} dy="0.32em" textAnchor="end">
                {ms > 0 ? `+${ms}` : ms}
              </text>
            </g>
          ))}
          <text className="deviation-word" x={LEFT + 4} y={TOP + 8}>
            {t('scales.chart.late')}
          </text>
          <text className="deviation-word" x={LEFT + 4} y={TOP + PLOT - 4}>
            {t('scales.chart.early')}
          </text>
          {turn && (
            <g className="scale-profile-turn">
              <line x1={x(turn.index)} x2={x(turn.index)} y1={TOP - 6} y2={MARK_Y + 4} />
              <text x={x(turn.index)} y={TOP - 8} textAnchor="middle">
                {t('scales.chart.top')}
              </text>
            </g>
          )}
          {notes.map((note) =>
            note.hesitation === null ? null : (
              <g key={`h${note.index}`} className="scale-profile-pause">
                <line
                  x1={x(note.index - 0.5)}
                  x2={x(note.index - 0.5)}
                  y1={TOP + 2}
                  y2={TOP + PLOT - 2}
                />
              </g>
            ),
          )}
          {notes.map((note) =>
            note.outcome !== 'played' ? (
              <path
                key={note.index}
                className={
                  note.outcome === 'wrong' ? 'deviation-missed is-wrong' : 'deviation-missed'
                }
                d={`M${x(note.index) - 3.5} ${MARK_Y - 3.5}l7 7m0 -7l-7 7`}
              />
            ) : note.deviation === null ? null : (
              <circle
                key={note.index}
                className={[
                  'deviation-dot',
                  note.crossing ? 'is-crossing' : '',
                  hover?.note === note ? 'is-hover' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                cx={x(note.index)}
                cy={y(note.deviation)}
                r={DOT_R}
              />
            ),
          )}
          <text className="deviation-word" x={LEFT - 6} y={MARK_Y} dy="0.32em" textAnchor="end">
            {t('scales.chart.missed')}
          </text>
          <text className="deviation-word" x={LEFT - 6} y={FINGER_Y} dy="0.32em" textAnchor="end">
            {t('scales.chart.finger')}
          </text>
          {notes.map((note) =>
            note.finger === null ||
            (notes.length > FINGERS_ALL_UP_TO && note.crossing === null) ? null : (
              <text
                key={`f${note.index}`}
                className={
                  note.crossing ? 'scale-profile-finger is-crossing' : 'scale-profile-finger'
                }
                x={x(note.index)}
                y={FINGER_Y}
                dy="0.32em"
                textAnchor="middle"
              >
                {note.finger}
              </text>
            ),
          )}
          {loud && (
            <g className="scale-profile-loud">
              <text
                className="deviation-word"
                x={LEFT - 6}
                y={LOUD_TOP + LOUD / 2}
                dy="0.32em"
                textAnchor="end"
              >
                {t('scales.chart.loud')}
              </text>
              <line
                x1={LEFT}
                x2={WIDTH - RIGHT}
                y1={LOUD_TOP + LOUD / 2}
                y2={LOUD_TOP + LOUD / 2}
              />
              {notes.map((note) => {
                if (note.velocityResidual === null) return null;
                const h = (Math.abs(note.velocityResidual) / loudRange) * (LOUD / 2);
                const mid = LOUD_TOP + LOUD / 2;
                return (
                  <rect
                    key={`v${note.index}`}
                    className={note.accent ? 'is-accent' : undefined}
                    x={x(note.index) - 1.5}
                    y={note.velocityResidual > 0 ? mid - h : mid}
                    width={3}
                    height={Math.max(0.5, h)}
                  />
                );
              })}
            </g>
          )}
        </svg>
        {hover && (
          <p className="deviation-tip" style={{ left: `${hover.x}%` }} aria-hidden="true">
            {label(hover.note)}
          </p>
        )}
      </div>
      <p id={`${id}-desc`} className="help">
        {t(loud ? 'scales.chart.desc.loud' : 'scales.chart.desc')}
      </p>
      <details className="history-details">
        <summary>{t('scales.table')}</summary>
        <div className="hm-table-scroll">
          <table className="history-table deviation-table">
            <thead>
              <tr>
                <th scope="col">{t('scales.table.note')}</th>
                <th scope="col">{t('scales.table.key')}</th>
                <th scope="col">{t('scales.table.finger')}</th>
                <th scope="col">{t('scales.table.timing')}</th>
                {loud && <th scope="col">{t('scales.table.velocity')}</th>}
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.index}>
                  <th scope="row">{note.index + 1}</th>
                  <td>{names[note.index]}</td>
                  <td>{note.finger ?? '–'}</td>
                  <td>
                    {timing(note)}
                    {note.hesitation !== null &&
                      ` · ${t('scales.note.hesitation', { ms: Math.round(note.hesitation) })}`}
                  </td>
                  {loud && <td>{loudness(note) || '–'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

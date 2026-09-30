import { useMemo } from 'react';
import { CELLS, timeSignature, type RhythmMeter } from '../../core/rhythmCells.ts';
import { barNotes, type TappedBar } from '../../core/rhythmEar.ts';
import type { CellNote } from '../../core/rhythmCells.ts';
import { inTime } from '../../core/rhythmRead.ts';
import { TICKS_PER_QUARTER } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import type { StaffNote } from '../engraving/EngravedStaff.tsx';
import { RhythmLine, type Beat } from '../engraving/RhythmLine.tsx';

// Rhythm dictation's bars and cells, drawn by the lessons' rhythm line (lessons 4 and 8 write
// rhythms the same way): the bars to choose from, the bar after an answer with each note inked by
// how it was tapped (as Rhythm on Read inks a line), and a cell alone as a small figure for the
// confusion table's headings.

type Tone = NonNullable<StaffNote['tone']>;

/** The lessons count twelve ticks to a quarter. */
const LESSON_TICKS = TICKS_PER_QUARTER / 12;

function beatOf(n: Pick<CellNote, 'type' | 'dot' | 'rest' | 'tie' | 'triplet'>): Beat {
  return {
    duration: n.type === '16th' ? 'sixteenth' : n.type,
    dotted: n.dot,
    rest: n.rest,
    tie: n.tie,
    triplet: n.triplet,
  };
}

/** How a note was tapped, as Rhythm on Read inks it: in time, early, late or missed. */
function timingTone(deviation: number | null): Tone {
  if (deviation === null) return 'bad';
  if (inTime(deviation)) return 'good';
  return deviation < 0 ? 'accent' : 'warn';
}

/**
 * A bar of cells on a one-line staff. With `tapped`, each note is inked by how its onset was
 * tapped (a tie's second note as its first), each onset not in time gets its arrow and ms over it
 * and each tap too many a +.
 */
export function BarFigure({
  cells,
  meter,
  label,
  tapped = null,
  counts = false,
  className,
}: {
  cells: readonly string[];
  meter: RhythmMeter;
  label: string;
  tapped?: TappedBar | null;
  counts?: boolean;
  className?: string;
}) {
  const t = useT();
  const notes = useMemo(() => barNotes(cells, meter), [cells, meter]);
  const beats = useMemo(() => notes.map(beatOf), [notes]);
  const ink = useMemo(() => {
    if (!tapped) return null;
    const byTick = new Map(tapped.onsets.map((o) => [o.tick, o.deviation]));
    const tones = notes.map((n): Tone | undefined => {
      if (n.rest || n.tied) return undefined;
      return timingTone(byTick.get(n.tick) ?? null);
    });
    const marks = [
      ...tapped.onsets.flatMap((o) => {
        const tone = timingTone(o.deviation);
        if (tone === 'good') return [];
        const text =
          o.deviation === null
            ? '×'
            : o.deviation < 0
              ? `←${Math.abs(o.deviation)}`
              : `${o.deviation}→`;
        return [{ tick: o.tick / LESSON_TICKS, text, tone }];
      }),
      ...tapped.extras.map((e) => ({
        tick: e.tick / LESSON_TICKS,
        text: '+',
        tone: 'bad' as const,
      })),
    ];
    return { tones, marks };
  }, [tapped, notes]);
  return (
    <RhythmLine
      rhythm={beats}
      time={timeSignature(meter)}
      label={label}
      counts={counts}
      bracket
      words={{ trip: t('rhythm.count.trip'), let: t('rhythm.count.let') }}
      tones={ink?.tones}
      marks={ink?.marks}
      className={className}
    />
  );
}

/** A figure has no counts. */
const NO_WORDS = { trip: '', let: '' };

/**
 * A cell alone, drawn small: its notes without a line. A cell tied from the note before shows
 * that note faint, with the tie.
 */
export function CellFigure({ cell, label }: { cell: string; label: string }) {
  const def = CELLS[cell];
  const figure = useMemo(() => {
    if (!def) return null;
    const own = def.notes.map(beatOf);
    if (!def.notes[0]?.tied) return { beats: own, tones: undefined };
    const ghost: Beat = { duration: 'quarter', tie: true };
    return {
      beats: [ghost, ...own],
      tones: ['faint', ...own.map(() => 'ink')] as Tone[],
    };
  }, [def]);
  if (!def || !figure) return <span>{cell}</span>;
  return (
    <RhythmLine
      rhythm={figure.beats}
      time={def.compound ? [6, 8] : [4, 4]}
      label={label}
      tones={figure.tones}
      words={NO_WORDS}
      bare
      className="cell-figure"
    />
  );
}

import { MIDDLE_C, pitchToMidi, type Pitch } from '../../core/note.ts';
import { EngravedStaff, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { PlayButton } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import { keyName, usePlaySequence, useStaticPage } from './lesson.ts';
import { pitch, pitchName } from './notes.ts';

// The glossary's figures for intervals (docs/GLOSSARY.md): two notes on the staff, one after the
// other and then together, over the keyboard with the half steps between them counted; two names
// for one key; and the intervals in a table, each to be heard.

/** The keyboard's reach: C3–B5, or wider when the notes need it. */
function rangeFor(keys: readonly number[]): [number, number] {
  const low = Math.min(48, ...keys.map((k) => k - (k % 12)));
  const high = Math.max(83, ...keys.map((k) => k - (k % 12) + 11));
  return [low, high];
}

/** The staff that holds the notes: treble from A3 up, else the grand staff. */
const staffFor = (pitches: readonly Pitch[]) =>
  pitches.every((p) => pitchToMidi(p) >= MIDDLE_C - 3) ? ('treble' as const) : ('grand' as const);

const clefOf = (p: Pitch, system: 'treble' | 'grand') =>
  system === 'treble' || pitchToMidi(p) >= MIDDLE_C ? ('treble' as const) : ('bass' as const);

/**
 * Two notes and the interval between them: written one after the other and then together, and on
 * the keyboard with every half step from the lower to the upper counted on its key.
 */
export function IntervalPair({
  low,
  high,
  label,
  readout,
}: {
  low: string;
  high: string;
  /** The staff's name for assistive technology. */
  label: string;
  /** What the interval is, beside its two notes: "7 half steps". */
  readout: string;
}) {
  const listen = usePlaySequence();
  const lo = pitch(low);
  const hi = pitch(high);
  const keys = [pitchToMidi(lo), pitchToMidi(hi)] as const;
  const system = staffFor([lo, hi]);
  const tone = (i: number, together = false) =>
    listen.at === i || (together && listen.at === 2) ? ('accent' as const) : ('ink' as const);
  const notes: StaffNote[] = [
    { id: 'a', pitch: lo, clef: clefOf(lo, system), x: 110, tone: tone(0) },
    { id: 'b', pitch: hi, clef: clefOf(hi, system), x: 170, tone: tone(1) },
    { id: 'c', pitch: lo, clef: clefOf(lo, system), x: 240, tone: tone(2, true) },
    { id: 'd', pitch: hi, clef: clefOf(hi, system), x: 240, tone: tone(2, true) },
  ];
  const names = new Map<number, string>([[keys[0], keyName(keys[0])]]);
  for (let k = keys[0] + 1; k <= keys[1]; k++) names.set(k, String(k - keys[0]));
  const classes = new Map<number, string>([
    [keys[0], 'lk-named'],
    [keys[1], 'lk-named'],
  ]);

  return (
    <>
      <p className="plate-readout is-small">
        <span className="plate-readout-name">
          {pitchName(lo)} → {pitchName(hi)}
        </span>
        <span className="plate-readout-label">{readout}</span>
      </p>
      <EngravedStaff
        system={system}
        width={300}
        className={system === 'grand' ? 'plate-staff is-grand' : 'plate-staff'}
        label={label}
        notes={notes}
        bars={[205]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play([keys[0], keys[1], [keys[0], keys[1]]], 700)} />
      </div>
      <LessonPiano range={rangeFor(keys)} keyNames={names} keyClasses={classes} />
    </>
  );
}

/** One key under two names: both written on the staff, the key marked once. */
export function EnharmonicPair({ a, b, label }: { a: string; b: string; label: string }) {
  const listen = usePlaySequence();
  const first = pitch(a);
  const second = pitch(b);
  const key = pitchToMidi(first);
  const classes = new Map([[key, 'lk-named']]);
  return (
    <>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={label}
        notes={[
          {
            id: 'a',
            pitch: first,
            clef: 'treble',
            x: 118,
            tone: listen.at === 0 ? 'accent' : 'ink',
          },
          {
            id: 'b',
            pitch: second,
            clef: 'treble',
            x: 196,
            tone: listen.at === 1 ? 'accent' : 'ink',
          },
        ]}
        labels={[
          { clef: 'treble', position: -5, x: 126, text: pitchName(first) },
          { clef: 'treble', position: -5, x: 204, text: pitchName(second) },
        ]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play([key, key], 700)} />
      </div>
      <LessonPiano range={rangeFor([key])} keyClasses={classes} />
    </>
  );
}

export interface IntervalRow {
  /** The interval's name, as the Ear page gives it in this language. */
  name: string;
  /** Its short name: m3, P5. */
  short: string;
  halfSteps: number;
  /** An example from C: its upper note, "Eb4". */
  upper: string;
}

/**
 * The intervals in a table, smallest first: name, half steps, an example from middle C. Each row
 * plays its example; on a page without scripts the table alone.
 */
export function IntervalTable({
  rows,
  head,
}: {
  rows: readonly IntervalRow[];
  /** The columns' headings: the interval, its half steps, an example. */
  head: readonly [string, string, string];
}) {
  const staticPage = useStaticPage();
  const listen = usePlaySequence();
  const c = pitchToMidi(pitch('C4'));
  return (
    <table className="term-table">
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const example = `C4 → ${pitchName(pitch(row.upper))}`;
          const upper = pitchToMidi(pitch(row.upper));
          return (
            <tr key={row.short}>
              <th scope="row">
                {row.name} <span className="term-table-short">{row.short}</span>
              </th>
              <td className="term-table-number">{row.halfSteps}</td>
              <td>
                {staticPage ? (
                  example
                ) : (
                  <button
                    type="button"
                    className="term-table-play"
                    onClick={() => listen.play([c, upper, [c, upper]], 600)}
                  >
                    {example}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

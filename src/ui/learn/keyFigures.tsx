import { useState, type KeyboardEvent } from 'react';
import { signatureTonic } from '../../core/keys.ts';
import { pitchToMidi, type Pitch } from '../../core/note.ts';
import { formatMessage } from '../../i18n/locale.ts';
import { EngravedStaff, type StaffLabel, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart, KEY_STEP, keySignatureX } from '../engraving/geometry.ts';
import { Choices, PlayButton } from './kit.tsx';
import { usePlaySequence, useStaticPage } from './lesson.ts';
import { majorScale, pitch, pitchName, tonicName } from './notes.ts';

// The glossary's figures for keys (docs/GLOSSARY.md): the circle of fifths, the sharps and flats
// in their order, a scale with its degrees, a tune in three keys, and a modulation heard as chords.

// The circle of fifths -------------------------------------------------------------------------

/**
 * The twelve places of the circle, clockwise from C at the top: each a key signature, and at the
 * bottom a second spelling of the same keys (B or C♭, F♯ or G♭, D♭ or C♯), as circles print it.
 */
const PLACES: readonly { fifths: number; also?: number }[] = [
  { fifths: 0 },
  { fifths: 1 },
  { fifths: 2 },
  { fifths: 3 },
  { fifths: 4 },
  { fifths: 5, also: -7 },
  { fifths: 6, also: -6 },
  { fifths: -5, also: 7 },
  { fifths: -4 },
  { fifths: -3 },
  { fifths: -2 },
  { fifths: -1 },
];

const C = 160;
const R_OUT = 150;
const R_MID = 106;
const R_IN = 66;

/** A point at `r` from the centre, `place` twelfths of a turn clockwise from the top. */
function polar(r: number, place: number): [number, number] {
  const a = ((place * 30 - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

/** One twelfth of a ring, between two radii, centred on its place. */
function wedge(place: number, r0: number, r1: number): string {
  const [x0, y0] = polar(r1, place - 0.5);
  const [x1, y1] = polar(r1, place + 0.5);
  const [x2, y2] = polar(r0, place + 0.5);
  const [x3, y3] = polar(r0, place - 0.5);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

/** A signature as printed on the circle: 2♯, 3♭, nothing for C. */
const count = (fifths: number) =>
  fifths === 0 ? '' : `${Math.abs(fifths)}${fifths > 0 ? '♯' : '♭'}`;

const majorOf = (fifths: number) => signatureTonic(fifths, 'major');
const minorOf = (fifths: number) => signatureTonic(fifths, 'minor');

/** A natural minor scale's keys, from its relative major's scale: from the 6th note up. */
function minorKeys(major: string): number[] {
  const up = majorScale(major).map((n) => n.midi);
  const keys = [up[5]!, up[6]!, up[7]!, up[1]! + 12, up[2]! + 12, up[3]! + 12, up[4]! + 12];
  return [...keys, up[5]! + 12].map((k) => k - 12);
}

export interface CircleLabels {
  /** '{tonic} major'. */
  major: string;
  /** '{tonic} minor'. */
  minor: string;
  /** A key signature in words, for the readout and assistive technology. */
  signature: (fifths: number) => string;
  /** The circle's name. */
  circle: string;
  /** The staff's name. */
  staff: string;
}

/**
 * The circle of fifths: the major keys round the outside, their relative minors inside, each with
 * its signature. Choose a key to see its signature on the staff and hear its scale. `near` marks
 * the keys one step either way and their relatives: the closely related keys.
 */
export function CircleOfFifths({ labels, near = false }: { labels: CircleLabels; near?: boolean }) {
  const staticPage = useStaticPage();
  const listen = usePlaySequence();
  const [chosen, setChosen] = useState<{ place: number; mode: 'major' | 'minor' }>({
    place: 0,
    mode: 'major',
  });
  const fifths = PLACES[chosen.place]!.fifths;
  const major = majorOf(fifths);
  const minor = minorOf(fifths);
  const keys = chosen.mode === 'major' ? majorScale(major).map((n) => n.midi) : minorKeys(major);
  const nearby = new Set([(chosen.place + 11) % 12, (chosen.place + 1) % 12]);

  const choose = (place: number, mode: 'major' | 'minor') => {
    setChosen({ place, mode });
    const tonic = majorOf(PLACES[place]!.fifths);
    listen.play(mode === 'major' ? majorScale(tonic).map((n) => n.midi) : minorKeys(tonic), 260);
  };
  /** A ring's twelfth, chosen by a click, a tap, Enter or Space; only a picture without scripts. */
  const control = (place: number, mode: 'major' | 'minor', name: string) =>
    staticPage
      ? {}
      : {
          role: 'button',
          tabIndex: 0,
          'aria-label': name,
          'aria-pressed': chosen.place === place && chosen.mode === mode,
          onClick: () => choose(place, mode),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose(place, mode);
            }
          },
        };
  const state = (place: number, mode: 'major' | 'minor') => {
    if (chosen.place === place && chosen.mode === mode) return 'is-chosen';
    if (chosen.place === place) return 'is-home';
    if (near && (nearby.has(place) || (place === chosen.place && mode !== chosen.mode)))
      return 'is-near';
    return '';
  };

  return (
    <>
      <svg
        className="fifths-circle"
        viewBox="-14 -14 348 348"
        role={staticPage ? 'img' : 'group'}
        aria-label={labels.circle}
      >
        {PLACES.map(({ fifths: f, also }, place) => {
          const majorName = tonicName(majorOf(f));
          const minorName = tonicName(minorOf(f)).toLowerCase();
          const [mx, my] = polar((R_OUT + R_MID) / 2 + 6, place);
          const [cx, cy] = polar((R_OUT + R_MID) / 2 - 12, place);
          const [nx, ny] = polar((R_MID + R_IN) / 2, place);
          const [ax, ay] = polar(R_OUT + 13, place);
          return (
            <g key={place}>
              <g
                className={`fifths-major ${state(place, 'major')}`}
                {...control(
                  place,
                  'major',
                  `${formatMessage(labels.major, { tonic: majorName })}, ${labels.signature(f)}`,
                )}
              >
                <path d={wedge(place, R_MID, R_OUT)} />
                <text
                  x={mx}
                  y={my}
                  className="fifths-name"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {majorName}
                </text>
                <text
                  x={cx}
                  y={cy}
                  className="fifths-count"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {count(f)}
                </text>
              </g>
              <g
                className={`fifths-minor ${state(place, 'minor')}`}
                {...control(
                  place,
                  'minor',
                  `${formatMessage(labels.minor, { tonic: tonicName(minorOf(f)) })}, ${labels.signature(f)}`,
                )}
              >
                <path d={wedge(place, R_IN, R_MID)} />
                <text
                  x={nx}
                  y={ny}
                  className="fifths-name is-minor"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {minorName}
                </text>
              </g>
              {also !== undefined && (
                <text
                  x={ax}
                  y={ay}
                  className="fifths-also"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {tonicName(majorOf(also))}
                </text>
              )}
            </g>
          );
        })}
        <text
          x={C}
          y={C - 6}
          className="fifths-centre"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {chosen.mode === 'major' ? tonicName(major) : tonicName(minor).toLowerCase()}
        </text>
        <text
          x={C}
          y={C + 16}
          className="fifths-centre-count"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {count(fifths)}
        </text>
      </svg>
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {formatMessage(labels.major, { tonic: tonicName(major) })} ·{' '}
          {formatMessage(labels.minor, { tonic: tonicName(minor) })}
        </span>
        <span className="plate-readout-label">{labels.signature(fifths)}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={220}
        className="plate-staff is-card"
        label={labels.staff}
        fifths={fifths}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(keys, 260)} />
      </div>
    </>
  );
}

// The order of sharps and flats ----------------------------------------------------------------

/** All seven sharps, or all seven flats, each named under its sign. */
function SevenSigns({ fifths, label }: { fifths: 7 | -7; label: string }) {
  const order = fifths > 0 ? 'FCGDAEB' : 'BEADGCF';
  const sign = fifths > 0 ? '♯' : '♭';
  const labels: StaffLabel[] = [...order].map((letter, i) => ({
    clef: 'treble',
    position: -3,
    x: keySignatureX('treble') + i * KEY_STEP + 5,
    text: letter,
  }));
  return (
    <>
      <p className="plate-readout is-small">
        <span className="plate-readout-name">
          {[...order].map((letter) => `${letter}${sign}`).join(' ')}
        </span>
      </p>
      <EngravedStaff
        system="treble"
        width={150}
        className="plate-staff is-card"
        label={label}
        fifths={fifths}
        labels={labels}
      />
    </>
  );
}

/** The seven sharps, then the seven flats, in the order a key signature adds them. */
export function SharpsAndFlats({ labels }: { labels: { sharps: string; flats: string } }) {
  return (
    <div className="key-orders">
      <SevenSigns fifths={7} label={labels.sharps} />
      <SevenSigns fifths={-7} label={labels.flats} />
    </div>
  );
}

// Scale degrees --------------------------------------------------------------------------------

/** The C major scale with each note's number under it, and the degrees named beside, in order. */
export function DegreeScale({ names, label }: { names: readonly string[]; label: string }) {
  const listen = usePlaySequence();
  const scale = majorScale('C');
  const start = bodyStart('treble') + 8;
  const step = (320 - 20 - start) / 8;
  const notes: StaffNote[] = scale.map((n, i) => ({
    id: `${i}`,
    pitch: n.pitch,
    clef: 'treble',
    x: start + i * step,
    tone: listen.at === i ? 'accent' : 'ink',
  }));
  const numbers: StaffLabel[] = scale.map((_, i) => ({
    clef: 'treble',
    position: -5,
    x: start + i * step + 6,
    text: String((i % 7) + 1),
  }));
  return (
    <>
      <EngravedStaff
        system="treble"
        width={320}
        className="plate-staff"
        label={label}
        notes={notes}
        labels={numbers}
      />
      <ol className="degree-list">
        {names.map((name, i) => (
          <li key={name} className={listen.at === i ? 'is-current' : undefined}>
            <span className="degree-number">{i + 1}</span>
            <span className="degree-note">{pitchName(scale[i]!.pitch, false)}</span>
            <span>{name}</span>
          </li>
        ))}
      </ol>
      <div className="plate-actions">
        <PlayButton
          onClick={() =>
            listen.play(
              scale.map((n) => n.midi),
              420,
            )
          }
        />
      </div>
    </>
  );
}

// Transposition --------------------------------------------------------------------------------

/** Twinkle, Twinkle's first phrase in three keys: the same steps from another first note. */
const TUNES = {
  C: { fifths: 0, notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'] },
  G: { fifths: 1, notes: ['G4', 'G4', 'D5', 'D5', 'E5', 'E5', 'D5'] },
  F: { fifths: -1, notes: ['F4', 'F4', 'C5', 'C5', 'D5', 'D5', 'C5'] },
} as const;
type TuneKey = keyof typeof TUNES;

/** One phrase in C, G or F major: the notes move, the tune stays. */
export function Transposed({ keyName, label }: { keyName: string; label: string }) {
  const listen = usePlaySequence();
  const [key, setKey] = useState<TuneKey>('C');
  const { fifths, notes: written } = TUNES[key];
  const tune: Pitch[] = written.map(pitch);
  const start = bodyStart('treble', fifths, true) + 10;
  const unit = (330 - 30 - start) / 7.5;
  const xs = tune.map((_, i) => start + (i + (i >= 4 ? 0.5 : 0)) * unit);
  const notes: StaffNote[] = tune.map((p, i) => ({
    id: `${i}`,
    pitch: p,
    clef: 'treble',
    x: xs[i]!,
    duration: i === tune.length - 1 ? 'half' : 'quarter',
    inKey: true,
    tone: listen.at === i ? 'accent' : 'ink',
  }));
  return (
    <>
      <Choices
        value={key}
        onChange={(next) => {
          setKey(next);
          listen.stop();
        }}
        options={(Object.keys(TUNES) as TuneKey[]).map((k) => ({
          value: k,
          label: formatMessage(keyName, { tonic: k }),
        }))}
      />
      <EngravedStaff
        system="treble"
        width={330}
        className="plate-staff"
        label={label}
        notes={notes}
        fifths={fifths}
        time={[4, 4]}
        bars={[(xs[3]! + xs[4]!) / 2 + 4]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(tune.map(pitchToMidi), 420)} />
      </div>
    </>
  );
}

// Modulation -----------------------------------------------------------------------------------

/**
 * From C major to G major: I, IV, then A minor (vi in C, ii in G), D7 and G. The chord the two
 * keys share is where the key turns.
 */
const MODULATION: readonly { bass: string; upper: readonly string[] }[] = [
  { bass: 'C3', upper: ['E4', 'G4', 'C5'] },
  { bass: 'F3', upper: ['F4', 'A4', 'C5'] },
  { bass: 'A2', upper: ['E4', 'A4', 'C5'] },
  { bass: 'D3', upper: ['F#4', 'A4', 'C5'] },
  { bass: 'G2', upper: ['D4', 'G4', 'B4'] },
];

/** The five chords on the grand staff, each named under it (`numerals`), heard one by one. */
export function Modulation({ numerals, label }: { numerals: readonly string[]; label: string }) {
  const listen = usePlaySequence();
  const start = bodyStart('grand') + 10;
  const step = 52;
  const chords = MODULATION.map(({ bass, upper }) => [pitch(bass), ...upper.map(pitch)]);
  const notes: StaffNote[] = chords.flatMap((chord, i) =>
    chord.map((p, j) => ({
      id: `${i}-${j}`,
      pitch: p,
      clef: j === 0 ? ('bass' as const) : ('treble' as const),
      x: start + i * step,
      tone: listen.at === i ? ('accent' as const) : ('ink' as const),
    })),
  );
  const names: StaffLabel[] = numerals.map((text, i) => ({
    clef: 'bass',
    position: -5,
    x: start + i * step + 6,
    text,
  }));
  return (
    <>
      <EngravedStaff
        system="grand"
        width={start + chords.length * step + 10}
        className="plate-staff is-grand"
        label={label}
        notes={notes}
        labels={names}
        below={10}
      />
      <div className="plate-actions">
        <PlayButton
          onClick={() =>
            listen.play(
              chords.map((c) => c.map(pitchToMidi)),
              900,
            )
          }
        />
      </div>
    </>
  );
}

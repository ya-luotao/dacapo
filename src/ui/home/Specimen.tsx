import { useEffect, useState } from 'react';
import {
  isBlack,
  ledgerLineCount,
  midiToPitch,
  MIDDLE_C,
  parsePitch,
  pitchToMidi,
  staffPosition,
  type Clef,
  type Pitch,
} from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState } from '../input/context.ts';
import { BRACE, F_CLEF, G_CLEF, SHARP, WHOLE_NOTE } from './glyphs.ts';

// The specimen on the home page: a grand staff with one whole note, and under it the keys from C3
// to C6 with the key that plays it. It walks through a few notes on its own; a key held on the
// player's keyboard takes its place. Drawn in SVG units of 10 per staff space.

const SPACE = 10;
/** Font units (1000 per em, four spaces) to SVG units. */
const GLYPH = (SPACE * 4) / 1000;
const TREBLE_BOTTOM = 80;
const BASS_BOTTOM = 160;
const STAFF_LEFT = 24;
const STAFF_RIGHT = 284;
const NOTE_X = 176;
const NOTE_WIDTH = 1.688 * SPACE;
const LEDGER_OVERHANG = 0.4 * SPACE;
const WIDTH = 296;
const HEIGHT = 186;

const LOW = 48; // C3
const HIGH = 84; // C6
const WHITE_W = 20;
const WHITE_H = 92;
const BLACK_W = 12;
const BLACK_H = 58;
/** Where each black key's left edge sits past the white key before it, in white-key widths. */
const BLACK_OFFSET: Record<number, number> = { 1: 0.62, 3: 0.78, 6: 0.6, 8: 0.7, 10: 0.8 };

const DEMO = ['E4', 'C5', 'A3', 'F4', 'D3', 'C6', 'B3', 'G4', 'E3', 'A4', 'F3', 'C4'].flatMap(
  (text) => {
    const pitch = parsePitch(text);
    return pitch && inRange(pitchToMidi(pitch)) ? [pitch] : [];
  },
);
const STEP_MS = 2400;

function inRange(midi: number): boolean {
  return midi >= LOW && midi <= HIGH;
}

function clefFor(pitch: Pitch): Clef {
  return pitchToMidi(pitch) >= MIDDLE_C ? 'treble' : 'bass';
}

/** The y of a staff position (0 = bottom line, one step per line or space). */
function yOf(position: number, clef: Clef): number {
  return (clef === 'treble' ? TREBLE_BOTTOM : BASS_BOTTOM) - (position * SPACE) / 2;
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

interface Key {
  midi: number;
  x: number;
  black: boolean;
}

const KEYS: readonly Key[] = (() => {
  const keys: Key[] = [];
  let white = 0;
  for (let midi = LOW; midi <= HIGH; midi++) {
    if (isBlack(midi)) {
      keys.push({ midi, x: (white - 1 + BLACK_OFFSET[midi % 12]!) * WHITE_W, black: true });
    } else {
      keys.push({ midi, x: white * WHITE_W, black: false });
      white++;
    }
  }
  return keys;
})();
const KEYS_WIDTH = KEYS.filter((k) => !k.black).length * WHITE_W;

/** The note the specimen shows: the demo's, or the highest key held within its range. */
function useShownPitch(): { pitch: Pitch; played: boolean } {
  const { held } = useHubState();
  const [step, setStep] = useState(0);

  let played: number | null = null;
  for (const midi of held.keys())
    if (inRange(midi) && (played === null || midi > played)) played = midi;

  useEffect(() => {
    if (played !== null || prefersReducedMotion()) return;
    const id = setInterval(() => setStep((s) => (s + 1) % DEMO.length), STEP_MS);
    return () => clearInterval(id);
  }, [played]);

  return played === null
    ? { pitch: DEMO[step]!, played: false }
    : { pitch: midiToPitch(played, 'sharp'), played: true };
}

export function Specimen() {
  const t = useT();
  const { pitch, played } = useShownPitch();
  const clef = clefFor(pitch);
  const position = staffPosition(pitch, clef);
  const y = yOf(position, clef);
  const midi = pitchToMidi(pitch);
  const name = `${pitch.letter}${pitch.accidental === 1 ? '♯' : ''}${pitch.octave}`;

  const ledgers: number[] = [];
  const count = ledgerLineCount(position);
  for (let i = 1; i <= count; i++) {
    ledgers.push(position < 0 ? yOf(-2 * i, clef) : yOf(8 + 2 * i, clef));
  }

  const staffLines = [0, 2, 4, 6, 8].flatMap((p) => [yOf(p, 'treble'), yOf(p, 'bass')]);

  return (
    <figure className="specimen" data-played={played || undefined}>
      <div className="specimen-sheet">
        <p className="specimen-name" aria-hidden="true" key={name}>
          {name}
        </p>
        <svg
          className="specimen-staff"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t('home.specimen.label')}
        >
          <g className="specimen-lines">
            {staffLines.map((ly) => (
              <line key={ly} x1={STAFF_LEFT} x2={STAFF_RIGHT} y1={ly} y2={ly} />
            ))}
            <line
              className="specimen-bar"
              x1={STAFF_LEFT}
              x2={STAFF_LEFT}
              y1={yOf(8, 'treble')}
              y2={BASS_BOTTOM}
            />
            <line
              className="specimen-bar"
              x1={STAFF_RIGHT - 7}
              x2={STAFF_RIGHT - 7}
              y1={yOf(8, 'treble')}
              y2={BASS_BOTTOM}
            />
          </g>
          <rect
            className="specimen-final"
            x={STAFF_RIGHT - 4}
            y={yOf(8, 'treble')}
            width={4}
            height={BASS_BOTTOM - yOf(8, 'treble')}
          />
          <path
            d={BRACE}
            transform={`translate(${STAFF_LEFT - 12} ${BASS_BOTTOM}) scale(${(BASS_BOTTOM - yOf(8, 'treble')) / 997})`}
          />
          <path
            d={G_CLEF}
            transform={`translate(${STAFF_LEFT + 8} ${yOf(2, 'treble')}) scale(${GLYPH})`}
          />
          <path
            d={F_CLEF}
            transform={`translate(${STAFF_LEFT + 8} ${yOf(6, 'bass')}) scale(${GLYPH})`}
          />
          <g className="specimen-ledgers" key={`${clef}${position}`}>
            {ledgers.map((ly) => (
              <line
                key={ly}
                x1={NOTE_X - LEDGER_OVERHANG}
                x2={NOTE_X + NOTE_WIDTH + LEDGER_OVERHANG}
                y1={ly}
                y2={ly}
              />
            ))}
          </g>
          <g className="specimen-note" style={{ transform: `translateY(${y}px)` }}>
            {pitch.accidental === 1 && (
              <path d={SHARP} transform={`translate(${NOTE_X - 15} 0) scale(${GLYPH})`} />
            )}
            <path d={WHOLE_NOTE} transform={`translate(${NOTE_X} 0) scale(${GLYPH})`} />
          </g>
        </svg>
      </div>
      <svg
        className="specimen-keys"
        viewBox={`0 0 ${KEYS_WIDTH} ${WHITE_H}`}
        aria-hidden="true"
        focusable="false"
      >
        {KEYS.filter((k) => !k.black).map((k) => (
          <rect
            key={k.midi}
            className={k.midi === midi ? 'is-lit' : undefined}
            x={k.x + 0.5}
            y={0}
            width={WHITE_W - 1}
            height={WHITE_H}
            rx={2}
          />
        ))}
        {KEYS.filter((k) => k.black).map((k) => (
          <rect
            key={k.midi}
            className={k.midi === midi ? 'is-black is-lit' : 'is-black'}
            x={k.x}
            y={0}
            width={BLACK_W}
            height={BLACK_H}
            rx={1.5}
          />
        ))}
        <circle
          className="specimen-middle-c"
          cx={((MIDDLE_C - LOW) / 12) * 7 * WHITE_W + WHITE_W / 2}
          cy={WHITE_H - 10}
          r={2}
        />
      </svg>
      <figcaption className="specimen-caption">{t('home.specimen.caption')}</figcaption>
    </figure>
  );
}

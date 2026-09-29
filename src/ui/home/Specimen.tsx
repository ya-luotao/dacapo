import { useEffect, useState } from 'react';
import {
  midiToPitch,
  MIDDLE_C,
  parsePitch,
  pitchToMidi,
  type Clef,
  type Pitch,
} from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import { EngravedStaff } from '../engraving/EngravedStaff.tsx';
import { useHubState } from '../input/context.ts';
import { BLACK_LENGTH, pianoLayout } from '../piano/layout.ts';

// The specimen on the home page: a grand staff with one whole note, and under it the keys from C3
// to C6 with the key that plays it. It walks through a few notes on its own; a key held on the
// player's keyboard takes its place.

const WIDTH = 296;
const NOTE_X = 176;

const LOW = 48; // C3
const HIGH = 84; // C6
const KEYS = pianoLayout(LOW, HIGH);
/** SVG units per white key, and a white key's length. */
const WHITE_W = 20;
const WHITE_H = 92;

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

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** The note the specimen shows: the demo's, or the highest key held within its range. */
function useShownPitch(): { pitch: Pitch; played: boolean } {
  const { held } = useHubState();
  const [step, setStep] = useState(0);

  let played: number | null = null;
  for (const midi of held.keys()) {
    if (inRange(midi) && (played === null || midi > played)) played = midi;
  }

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
  const midi = pitchToMidi(pitch);
  const name = `${pitch.letter}${pitch.accidental === 1 ? '♯' : ''}${pitch.octave}`;
  const middleC = KEYS.keys.find((k) => k.midi === MIDDLE_C)!;

  return (
    <figure className="specimen" data-played={played || undefined}>
      <div className="specimen-sheet">
        <p className="specimen-name" aria-hidden="true" key={name}>
          {name}
        </p>
        <EngravedStaff
          system="grand"
          width={WIDTH}
          className="specimen-staff"
          label={t('home.specimen.label')}
          notes={[
            {
              id: 'note',
              pitch,
              clef: clefFor(pitch),
              x: NOTE_X,
              tone: played ? 'accent' : 'ink',
            },
          ]}
        />
      </div>
      <svg
        className="specimen-keys"
        viewBox={`0 0 ${KEYS.width * WHITE_W} ${WHITE_H}`}
        aria-hidden="true"
        focusable="false"
      >
        {[false, true].flatMap((black) =>
          KEYS.keys
            .filter((k) => k.black === black)
            .map((k) => (
              <rect
                key={k.midi}
                className={
                  (black ? 'is-black' : '') + (k.midi === midi ? ' is-lit' : '') || undefined
                }
                x={k.left * WHITE_W + (black ? 0 : 0.5)}
                y={0}
                width={k.width * WHITE_W - (black ? 0 : 1)}
                height={black ? WHITE_H * BLACK_LENGTH : WHITE_H}
                rx={black ? 1.5 : 2}
              />
            )),
        )}
        <circle
          className="specimen-middle-c"
          cx={(middleC.left + 0.5) * WHITE_W}
          cy={WHITE_H - 10}
          r={2}
        />
      </svg>
      <figcaption className="specimen-caption">{t('home.specimen.caption')}</figcaption>
    </figure>
  );
}

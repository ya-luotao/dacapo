import {
  EnharmonicPair,
  IntervalPair,
  IntervalTable,
  type IntervalRow,
} from '../intervalFigures.tsx';
import { Plate } from '../kit.tsx';
import { StepExplorer } from '../theoryFigures.tsx';
import type { TermTexts } from './index.ts';

const ROWS: readonly IntervalRow[] = [
  { name: 'Minor second', short: 'm2', halfSteps: 1, upper: 'Db4' },
  { name: 'Major second', short: 'M2', halfSteps: 2, upper: 'D4' },
  { name: 'Minor third', short: 'm3', halfSteps: 3, upper: 'Eb4' },
  { name: 'Major third', short: 'M3', halfSteps: 4, upper: 'E4' },
  { name: 'Perfect fourth', short: 'P4', halfSteps: 5, upper: 'F4' },
  { name: 'Tritone', short: 'TT', halfSteps: 6, upper: 'F#4' },
  { name: 'Perfect fifth', short: 'P5', halfSteps: 7, upper: 'G4' },
  { name: 'Minor sixth', short: 'm6', halfSteps: 8, upper: 'Ab4' },
  { name: 'Major sixth', short: 'M6', halfSteps: 9, upper: 'A4' },
  { name: 'Minor seventh', short: 'm7', halfSteps: 10, upper: 'Bb4' },
  { name: 'Major seventh', short: 'M7', halfSteps: 11, upper: 'B4' },
  { name: 'Octave', short: 'P8', halfSteps: 12, upper: 'C5' },
];

/** Two notes on the staff and the keyboard, with a caption that says what to listen for. */
function Pair({ low, high, readout }: { low: string; high: string; readout: string }) {
  return (
    <Plate caption="Listen: the two notes one after the other, then together. The numbers count the half steps.">
      <IntervalPair
        low={low}
        high={high}
        readout={readout}
        label={`${low} and ${high} on the staff`}
      />
    </Plate>
  );
}

const TEXTS: TermTexts = {
  interval: () => (
    <>
      <p>
        Count the letters from the lower note to the upper, both included: C, D, E is three letters,
        so C to E is a <strong>third</strong>. On the staff a third goes from a line to the next
        line, or a space to the next space.
      </p>
      <p>
        The number alone does not say how far apart the keys are. C to E and C to E♭ are both
        thirds, four half steps and three. The word before the number, major or minor, tells them
        apart.
      </p>
      <Pair low="C4" high="E4" readout="A third: 4 half steps" />
    </>
  ),

  'half-step': () => (
    <>
      <p>
        On the staff a half step is either the same line or space with a sharp or a flat (C to C♯),
        or the next line or space up (E to F). Most half steps go to or from a black key; E–F and
        B–C are the only two between white keys.
      </p>
      <Plate caption="Play or click any key: the keys a half step either side of it are marked.">
        <StepExplorer />
      </Plate>
    </>
  ),

  'whole-step': () => (
    <>
      <p>
        A whole step crosses one key on its way: C to D crosses C♯, and E to F♯ crosses F. So a
        whole step can start on a white key and end on a black one.
      </p>
      <p>
        A major scale is whole steps with two half steps in it: whole, whole, half, whole, whole,
        whole, half.
      </p>
      <Pair low="C4" high="D4" readout="2 half steps" />
    </>
  ),

  enharmonic: () => (
    <>
      <p>
        Every black key has two names: the key between F and G is F♯ or G♭. A few white keys have a
        second name too: E is also F♭, and C is also B♯.
      </p>
      <p>
        Which name is written depends on the key. D major has F♯, because its scale already has a G;
        D♭ major has G♭, because it already has an F.
      </p>
      <Plate caption="F♯ and G♭: two notes on the staff, one key.">
        <EnharmonicPair a="F#4" b="Gb4" label="F sharp and G flat on the treble staff" />
      </Plate>
    </>
  ),

  'interval-quality': () => (
    <>
      <p>
        Seconds, thirds, sixths and sevenths come in two sizes: <strong>major</strong>, and a half
        step smaller, <strong>minor</strong>. Unisons, fourths, fifths and octaves have one usual
        size, called <strong>perfect</strong>.
      </p>
      <p>
        Widen a major or perfect interval by a half step and it is <strong>augmented</strong>;
        narrow a minor or perfect one and it is <strong>diminished</strong>. C to F♯ is an augmented
        fourth and C to G♭ a diminished fifth: both are six half steps.
      </p>
      <Plate caption="Every interval up to the octave, from middle C.">
        <IntervalTable rows={ROWS} head={['Interval', 'Half steps', 'From C']} />
      </Plate>
    </>
  ),

  'minor-second': () => (
    <>
      <p>
        Played together the two notes rub against each other: no interval is more dissonant. One
        after the other it is the smallest step a tune can take, like the leading note rising to the
        tonic, B to C. Turned upside down it is a major seventh.
      </p>
      <Pair low="E4" high="F4" readout="1 half step" />
    </>
  ),

  'major-second': () => (
    <>
      <p>
        Most steps of a scale are major seconds. On the staff it goes from a line to the next space
        or a space to the next line, and the keys are two half steps apart. Turned upside down it is
        a minor seventh.
      </p>
      <Pair low="C4" high="D4" readout="2 half steps" />
    </>
  ),

  'minor-third': () => (
    <>
      <p>
        Three half steps, three letters: A–C, E–G, D–F. A minor chord has a minor third at its
        bottom, and that is most of what makes it sound minor. Turned upside down it is a major
        sixth.
      </p>
      <Pair low="A4" high="C5" readout="3 half steps" />
    </>
  ),

  'major-third': () => (
    <>
      <p>
        The bottom of a major chord: C–E in C major, G–B in G major. A minor third on top of it
        completes the chord. Turned upside down it is a minor sixth.
      </p>
      <Pair low="C4" high="E4" readout="4 half steps" />
    </>
  ),

  'perfect-fourth': () => (
    <>
      <p>
        Four letters: C–F, G–C, D–G. It sounds open and not quite finished. Many tunes begin with
        it, rising from the dominant to the tonic, as Amazing Grace does from D to G. Turned upside
        down it is a perfect fifth.
      </p>
      <Pair low="D4" high="G4" readout="5 half steps" />
    </>
  ),

  tritone: () => (
    <>
      <p>
        The name counts its whole steps: three of them, F–G–A–B. It splits the octave exactly in
        half, so turned upside down it is still a tritone.
      </p>
      <p>
        It is the tense interval inside a dominant seventh chord. In G7 it lies between B and F,
        which want to move to C and E. Written F up to B it is an augmented fourth; B up to F, a
        diminished fifth.
      </p>
      <Pair low="F4" high="B4" readout="6 half steps" />
    </>
  ),

  'perfect-fifth': () => (
    <>
      <p>
        Five letters, line to line or space to space: C–G, D–A, F–C. After the octave it is the most
        stable interval, and every major and minor chord has one between its root and its fifth.
        Violins and cellos are tuned in fifths.
      </p>
      <p>The circle of fifths steps through the keys by this interval.</p>
      <Pair low="C4" high="G4" readout="7 half steps" />
    </>
  ),

  'minor-sixth': () => (
    <>
      <p>
        Six letters, eight half steps: E up to C, A up to F. It is a major third turned upside down.
        Played together it is a consonance, a little darker than the major sixth.
      </p>
      <Pair low="E4" high="C5" readout="8 half steps" />
    </>
  ),

  'major-sixth': () => (
    <>
      <p>
        C up to A, G up to E: nine half steps. It is a minor third turned upside down. Thirds and
        sixths are the intervals two voices most often move in together.
      </p>
      <Pair low="C4" high="A4" readout="9 half steps" />
    </>
  ),

  'minor-seventh': () => (
    <>
      <p>
        A whole step short of the octave. In G7 (G, B, D, F) it lies between G and F, and it gives
        the chord its pull towards C. Turned upside down it is a major second.
      </p>
      <Pair low="G4" high="F5" readout="10 half steps" />
    </>
  ),

  'major-seventh': () => (
    <>
      <p>
        A half step short of the octave: C to B, F to E. Played alone the two notes clash sharply;
        in a major seventh chord, C E G B, the notes between soften it. Turned upside down it is a
        minor second.
      </p>
      <Pair low="C4" high="B4" readout="11 half steps" />
    </>
  ),

  octave: () => (
    <>
      <p>
        Two notes an octave apart sound so alike that they share a name. Every C on the keyboard is
        a C, numbered by its octave: middle C is C4. The upper note vibrates exactly twice as fast
        as the lower.
      </p>
      <p>
        Octaves in the left hand make the bass fuller. An 8va over the notes saves writing them an
        octave higher.
      </p>
      <Pair low="C4" high="C5" readout="12 half steps" />
    </>
  ),

  'interval-inversion': () => (
    <>
      <p>
        The two numbers always add up to nine: a second becomes a seventh, a third a sixth, a fourth
        a fifth. The quality turns over as well: major becomes minor, minor major, augmented
        diminished, and perfect stays perfect.
      </p>
      <p>
        C up to E, a major third, becomes E up to C, a minor sixth. Four half steps and eight make
        the twelve of an octave.
      </p>
      <Pair low="C4" high="E4" readout="Major third: 4 half steps" />
      <Pair low="E4" high="C5" readout="Minor sixth: 8 half steps" />
    </>
  ),

  'compound-interval': () => (
    <>
      <p>
        Take away seven to find the interval inside it: a ninth is an octave and a second (9 − 7 =
        2), a tenth an octave and a third, a twelfth an octave and a fifth. Its quality is the
        smaller interval’s: C up to D an octave higher is a major ninth.
      </p>
      <p>A tenth in the left hand is a stretch for most hands, and is often played broken.</p>
      <Pair low="C4" high="D5" readout="Major ninth: 14 half steps" />
    </>
  ),

  'consonance-and-dissonance': () => (
    <>
      <p>
        Consonant: octaves, fifths and fourths, thirds and sixths. Dissonant: seconds, sevenths and
        the tritone. The fourth is the odd one: consonant between two upper voices, but treated as a
        dissonance over the bass in older music.
      </p>
      <p>
        A dissonance wants to move. It usually resolves by step to a consonance, as the tritone B–F
        of G7 goes to C–E.
      </p>
      <Pair low="C4" high="G4" readout="Perfect fifth: consonant" />
      <Pair low="B4" high="F5" readout="Tritone: dissonant" />
    </>
  ),
};

export default TEXTS;

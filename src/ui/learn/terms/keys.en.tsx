import {
  CircleOfFifths,
  DegreeScale,
  Modulation,
  SharpsAndFlats,
  Transposed,
  type CircleLabels,
} from '../keyFigures.tsx';
import { Plate } from '../kit.tsx';
import { KeySignatures, MajorAndMinor, RelativeMinor, ScaleBuilder } from '../theoryFigures.tsx';
import type { TermTexts } from './index.ts';

const CIRCLE: CircleLabels = {
  major: '{tonic} major',
  minor: '{tonic} minor',
  signature: (fifths) => {
    if (fifths === 0) return 'No sharps or flats';
    const n = Math.abs(fifths);
    return fifths > 0
      ? `${n} ${n === 1 ? 'sharp' : 'sharps'}`
      : `${n} ${n === 1 ? 'flat' : 'flats'}`;
  },
  circle: 'The circle of fifths',
  staff: 'The key signature on the treble staff',
};

const TEXTS: TermTexts = {
  key: () => (
    <>
      <p>
        Most tunes come home to one note at the end. That note is the <strong>tonic</strong>, and
        the scale built on it, with its sharps or flats, is the key. A piece in G major uses the
        notes of the G major scale, with F♯, and sounds finished on G.
      </p>
      <p>
        A key is heard over a phrase rather than in a single chord: a set of notes, and one of them
        as home.
      </p>
      <Plate caption="Choose a key: its scale, written with sharps and flats or with the key signature.">
        <ScaleBuilder
          staffLabel="The major scale on the treble staff"
          labels={{
            tonic: 'Key',
            accidentals: 'Sharps and flats',
            signature: 'Key signature',
            steps: 'The steps of the scale',
            whole: 'W',
            half: 'H',
          }}
        />
      </Plate>
    </>
  ),

  'key-signature': () => (
    <>
      <p>
        With sharps, the key is a half step above the last sharp: F♯ C♯ gives D major. With flats,
        the second-to-last flat names it: B♭ E♭ A♭ gives E♭ major. One flat is F major.
      </p>
      <p>
        Each signature also belongs to a minor key, three half steps below the major: two sharps are
        D major or B minor. The music, and above all its last chord, tells which.
      </p>
      <Plate caption="Choose a key to see its signature on both staves, its sharps or flats named in order.">
        <KeySignatures staffLabel="A key signature on the grand staff" none="No sharps or flats" />
      </Plate>
    </>
  ),

  'order-of-sharps-and-flats': () => (
    <>
      <p>
        Each new sharp is a fifth above the one before (F, C, G…), and each new flat a fifth below
        (B, E, A…). So a signature never skips one: three sharps are always F♯, C♯ and G♯.
      </p>
      <p>
        Some players remember the sharps as Father Charles Goes Down And Ends Battle, and the flats
        as the same sentence backwards.
      </p>
      <Plate caption="Seven sharps, then seven flats, each named under its sign.">
        <SharpsAndFlats
          labels={{
            sharps: 'The seven sharps on the treble staff',
            flats: 'The seven flats on the treble staff',
          }}
        />
      </Plate>
    </>
  ),

  'circle-of-fifths': () => (
    <>
      <p>
        Read clockwise from C at the top: G has one sharp, D two, A three. Read the other way, F has
        one flat, B♭ two, E♭ three. At the bottom the two sides meet, and F♯ major and G♭ major are
        the same keys under two names.
      </p>
      <p>
        Inside each major key is its relative minor, with the same signature. Keys side by side on
        the circle share all their notes but one, so music moves most easily between neighbours.
      </p>
      <Plate caption="Choose a key, major outside or minor inside: its signature appears on the staff and its scale plays.">
        <CircleOfFifths labels={CIRCLE} />
      </Plate>
    </>
  ),

  'relative-keys': () => (
    <>
      <p>
        The relative minor starts on the 6th note of the major scale: A in C major, E in G major.
        Three half steps down from a major tonic finds it; three up from a minor tonic finds its
        relative major.
      </p>
      <p>
        Minor pieces usually raise the 7th (G♯ in A minor), written as an accidental. That sharp is
        the quickest way to tell the minor key from its relative major.
      </p>
      <Plate caption="Choose a major key, then switch to its relative minor: the same notes and signature, from another first note.">
        <RelativeMinor
          staffLabel="A major scale or its relative minor, with the key signature"
          labels={{
            key: 'Major key',
            majorName: '{tonic} major',
            minorName: '{tonic} minor',
            readout: {
              major: '{minor} minor starts on the 6th note of {major} major.',
              minor: 'The notes and the key signature of {major} major, from {minor} to {minor}.',
            },
          }}
        />
      </Plate>
    </>
  ),

  'parallel-keys': () => (
    <>
      <p>
        Same tonic, different notes. C minor lowers three notes of C major: E, A and B become E♭, A♭
        and B♭. The third is the one heard most: C–E is major, C–E♭ minor.
      </p>
      <p>
        Composers move between the two often: a piece in C minor that ends on a C major chord, or a
        tune brought back in the minor for a darker verse.
      </p>
      <Plate caption="Frère Jacques in C major and in C minor: one note changes, E to E♭.">
        <MajorAndMinor
          staffLabel="Frère Jacques on the treble staff"
          labels={{ major: 'C major', minor: 'C minor' }}
        />
      </Plate>
    </>
  ),

  'scale-degrees': () => (
    <>
      <p>
        Three of them carry most of the harmony. The <strong>tonic</strong> (1) is home. The{' '}
        <strong>dominant</strong> (5) pulls back to it, and the chord built on it leads to the last
        chord of nearly every piece. The <strong>subdominant</strong> (4) has the chord of the
        “amen” at the end of a hymn.
      </p>
      <p>
        The <strong>leading note</strong> (7) sits a half step under the tonic and rises to it. In
        minor it is usually raised to make that half step.
      </p>
      <Plate caption="The C major scale: each note’s number under it, its name in the list.">
        <DegreeScale
          label="The C major scale on the treble staff"
          names={[
            'Tonic',
            'Supertonic',
            'Mediant',
            'Subdominant',
            'Dominant',
            'Submediant',
            'Leading note',
          ]}
        />
      </Plate>
    </>
  ),

  transposition: () => (
    <>
      <p>
        Every note moves by the same interval, so the steps between them stay as they were and the
        tune is still the same tune. Moved from C to G, it takes G major’s signature, one sharp.
      </p>
      <p>
        Singers transpose a song to suit their voice. In dacapo, a piece can be moved up or down by
        half steps on its page.
      </p>
      <Plate caption="The first phrase of Twinkle, Twinkle in three keys: the notes move, the tune stays.">
        <Transposed keyName="{tonic} major" label="Twinkle, Twinkle on the treble staff" />
      </Plate>
    </>
  ),

  modulation: () => (
    <>
      <p>
        A modulation is heard when a new note keeps coming back, F♯ in place of F in a piece in C
        major, and then a cadence settles in G. A major key most often moves to its dominant, a
        minor key to its relative major.
      </p>
      <p>
        The easiest way across is a chord both keys have. A minor is vi in C major and ii in G
        major; after it, D7 belongs to G alone, and G sounds like home.
      </p>
      <Plate caption="From C major to G major. A minor belongs to both keys; D7 belongs to G alone.">
        <Modulation
          label="Five chords on the grand staff, from C major to G major"
          numerals={['C: I', 'IV', 'vi = ii', 'G: V7', 'I']}
        />
      </Plate>
    </>
  ),

  'closely-related-keys': () => (
    <>
      <p>
        For C major they are G major and F major, its neighbours on the circle, and A minor, E minor
        and D minor, the relative minors of the three. Each differs from C major by one sharp or
        flat at most.
      </p>
      <p>A minor has the same five: E minor, D minor, C major, G major and F major.</p>
      <Plate caption="Choose a key: its closely related keys are shaded.">
        <CircleOfFifths labels={CIRCLE} near />
      </Plate>
    </>
  ),
};

export default TEXTS;

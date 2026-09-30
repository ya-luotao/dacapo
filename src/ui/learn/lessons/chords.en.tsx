import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { cadenceSound, chordKeys, type Cadence } from '../harmony.ts';
import {
  Cadences,
  ChordBuilder,
  ChordQuiz,
  KeyChords,
  PreludeHarmony,
  Resolution,
  SymbolCard,
  type BuilderLabels,
  type ChordItem,
} from '../harmonyFigures.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const QUALITIES = {
  major: 'Major',
  minor: 'Minor',
  diminished: 'Diminished',
  augmented: 'Augmented',
  dom7: 'Dominant 7th',
  maj7: 'Major 7th',
  min7: 'Minor 7th',
  hdim7: 'Half-diminished',
};

const BUILDER: BuilderLabels = {
  root: 'Root',
  qualities: QUALITIES,
  steps: {
    major: 'a major third, then a minor third',
    minor: 'a minor third, then a major third',
    diminished: 'two minor thirds',
    augmented: 'two major thirds',
    dom7: 'a major triad and a minor 7th',
    maj7: 'a major triad and a major 7th',
    min7: 'a minor triad and a minor 7th',
    hdim7: 'a diminished triad and a minor 7th',
  },
  inversions: ['Root position', '1st inversion', '2nd inversion'],
  bass: '{note} in the bass',
};

const CADENCE_NAMES: Record<Cadence, string> = {
  authentic: 'Authentic',
  plagal: 'Plagal',
  half: 'Half',
  deceptive: 'Deceptive',
};

const TRIAD_ITEMS: readonly ChordItem[] = (
  [
    ['a major triad on F', ['F4', 'A4', 'C5'], 'F A C'],
    ['a minor triad on D', ['D4', 'F4', 'A4'], 'D F A'],
    ['a major triad on G', ['G4', 'B4', 'D5'], 'G B D'],
    ['a minor triad on E', ['E4', 'G4', 'B4'], 'E G B'],
    ['a diminished triad on B', ['B3', 'D4', 'F4'], 'B D F'],
    ['an augmented triad on C', ['C4', 'E4', 'G#4'], 'C E G♯'],
  ] as const
).map(([chord, notes, answer]) => {
  const keys = chordKeys(notes);
  return { ask: `Play ${chord}.`, keys, answer, given: keys[0] };
});

const SYMBOL_ITEMS: readonly ChordItem[] = (
  [
    ['Am', ['A3', 'C4', 'E4'], 'A C E'],
    ['G7', ['G3', 'B3', 'D4', 'F4'], 'G B D F'],
    ['F/A', ['A3', 'C4', 'F4'], 'F A C, with A lowest', true],
    ['B°', ['B3', 'D4', 'F4'], 'B D F'],
    ['Cmaj7', ['C4', 'E4', 'G4', 'B4'], 'C E G B'],
    ['E–', ['E4', 'G4', 'B4'], 'E G B'],
    ['Bø7', ['B3', 'D4', 'F4', 'A4'], 'B D F A'],
    ['Gsus4', ['G3', 'C4', 'D4'], 'G C D'],
  ] as const
).map(([symbol, notes, answer, bass]) => ({
  ask: 'Play this chord.',
  keys: chordKeys(notes),
  answer,
  bass: bass ?? false,
  figure: <SymbolCard symbol={symbol} />,
}));

const OPTIONS = ['Authentic: V → I', 'Plagal: IV → I', 'Half: it stops on V', 'Deceptive: V → vi'];
const ORDER: readonly Cadence[] = ['authentic', 'plagal', 'half', 'deceptive'];
const HEARD: readonly ChoiceQuestion[] = (
  [
    ['authentic', 0],
    ['half', 5],
    ['deceptive', 0],
    ['plagal', -3],
    ['half', -2],
    ['authentic', -5],
    ['plagal', 2],
    ['deceptive', -4],
  ] as const
).map(([cadence, shift], i) => ({
  id: `${cadence}-${i}`,
  question: 'Listen: how does the phrase end?',
  figure: null,
  options: OPTIONS,
  answer: ORDER.indexOf(cadence),
  sound: cadenceSound(cadence, shift),
  gap: 850,
}));

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Play three notes together and you have a <strong>chord</strong>. Most music is a tune over
        chords, and the chords give it its colour and its sense of going somewhere and arriving.
        This lesson builds chords, names them, and finds them in a piece.
      </p>

      <Section id="triads" title="Triads: chords in thirds">
        <p>
          Take any note, add the note a third above it and the note a third above that: C, E and G.
          Three notes stacked in thirds make a <strong>triad</strong>, the most common chord there
          is. On the staff it is easy to spot: three notes on three lines in a row, or three spaces.
        </p>
        <p>
          The bottom note is the <strong>root</strong> and names the chord. The others are its{' '}
          <strong>third</strong> and its <strong>fifth</strong>, counted up from the root. Which
          thirds you stack gives the triad its quality:
        </p>
        <ul>
          <li>
            <strong>Major</strong>: a major third (four half steps), then a minor third (three).
            Bright and settled. C E G.
          </li>
          <li>
            <strong>Minor</strong>: a minor third, then a major third. Darker. C E♭ G.
          </li>
          <li>
            <strong>Diminished</strong>: two minor thirds. Tense and unstable. C E♭ G♭.
          </li>
          <li>
            <strong>Augmented</strong>: two major thirds. Strange and unresolved. C E G♯.
          </li>
        </ul>
        <Plate
          wide
          caption="Choose a root and a quality. The notes are written one after another, then stacked; listen to them broken, then together."
        >
          <ChordBuilder
            qualities={['major', 'minor', 'diminished', 'augmented']}
            labels={BUILDER}
            staffLabel="A triad on the treble staff"
          />
        </Plate>
        <p>
          Major and minor triads are everywhere. Diminished ones turn up now and then, and augmented
          ones rarely. Their names are not about size: all four span about a fifth.
        </p>
      </Section>

      <Section id="inversions" title="Inversions and the bass">
        <p>
          The notes of a chord can come in any order. With the root at the bottom, the chord is in{' '}
          <strong>root position</strong>. Move the root up an octave and the third is at the bottom:
          the <strong>first inversion</strong>, E G C. Move the third up as well and the fifth is at
          the bottom: the <strong>second inversion</strong>, G C E.
        </p>
        <p>
          It is still a C major chord, but it does not sound quite the same. The lowest note, the{' '}
          <strong>bass</strong>, colours the whole chord. Root position sounds solid; the first
          inversion lighter, on its way somewhere; the second inversion unsettled, and it usually
          passes quickly.
        </p>
        <Plate
          wide
          caption="Choose a position and listen for the bass: the same three notes, a different one at the bottom."
        >
          <ChordBuilder
            qualities={['major', 'minor']}
            inversions
            labels={BUILDER}
            staffLabel="A triad on the treble staff"
          />
        </Plate>
        <Aside title="By ear">
          <p>
            The <Link href="/ear">Ear</Link> page plays triads for you to name or play back: major
            and minor first, then diminished and augmented, then inversions, where the bass counts.
          </p>
        </Aside>
      </Section>

      <Section id="key" title="The chords of a key">
        <p>
          Build a triad on every note of the C major scale, using only the notes of the scale, and
          you get seven chords. They are the chords of the key, and most music in C major is made of
          them.
        </p>
        <p>
          Each is named by a <strong>roman numeral</strong> for the note of the scale it stands on,
          so the name works in every key. A capital means major, a small numeral minor, and a small
          circle diminished: I ii iii IV V vi vii°. Choose another key and the notes change, but the
          pattern never does.
        </p>
        <Plate
          wide
          caption="The seven triads of a major key, with their symbols above and their numerals below. Pick one to hear it, or Listen to hear them all in turn."
        >
          <KeyChords
            labels={{
              key: 'Key',
              qualities: { major: 'major', minor: 'minor', diminished: 'diminished' },
            }}
            staffLabel="The seven triads of the key on the treble staff"
          />
        </Plate>
        <p>
          Three of them do most of the work: I, IV and V, the <strong>primary chords</strong>. I is
          the <strong>tonic</strong>, home. V is the <strong>dominant</strong>, the chord that leads
          home most strongly. IV is the <strong>subdominant</strong>, a step away from home. Between
          them they hold every note of the scale, so many simple tunes can be accompanied with just
          these three.
        </p>
        <p>
          A minor key has its chords too. Its tonic and subdominant are minor, i and iv; its V is
          major, because the harmonic minor raises the 7th, the leading note you met in the lesson
          on minor keys.
        </p>
      </Section>

      <Section id="sevenths" title="Seventh chords">
        <p>
          Stack one more third on a triad and you have four notes: a <strong>seventh chord</strong>,
          named after the distance from its root to the top note. The one you will meet most is the{' '}
          <strong>dominant seventh</strong>, built on V: G B D F in C major, written G7. It is a
          major triad with a minor seventh on top.
        </p>
        <Plate wide caption="The four seventh chords you will meet most, on any root.">
          <ChordBuilder
            qualities={['dom7', 'maj7', 'min7', 'hdim7']}
            initialRoot="G"
            labels={BUILDER}
            staffLabel="A seventh chord on the treble staff"
          />
        </Plate>
        <p>
          Why does V7 pull so hard towards I? Look at two of its notes. B is the leading note, a
          half step below C, and wants to rise to it. F, the seventh, wants to fall a half step to
          E. B and F are three whole steps apart, a <strong>tritone</strong>, the most restless
          interval in the key. When they move to C and E, the tension goes, and you are home.
        </p>
        <Plate caption="Listen to V going to I, then to V7 going to I: the added F falls to E as B rises to C.">
          <Resolution
            labels={{ triad: 'V → I', seventh: 'V7 → I' }}
            readouts={{
              triad: 'G B D to C E G: B rises to C.',
              seventh: 'G B D F to C E C: B rises to C, F falls to E.',
            }}
            staffLabel="Two chords on the grand staff: G7 or G, then C"
          />
        </Plate>
      </Section>

      <Section id="cadences" title="Cadences">
        <p>
          The end of a phrase is a <strong>cadence</strong>, the chords that close it. Cadences are
          the punctuation of music, and there are four you will hear again and again:
        </p>
        <ul>
          <li>
            <strong>Authentic</strong>, V (or V7) to I: a full stop. It ends most pieces.
          </li>
          <li>
            <strong>Plagal</strong>, IV to I: softer, the “Amen” at the end of a hymn.
          </li>
          <li>
            <strong>Half</strong>, ending on V: a comma, or a question waiting for an answer.
          </li>
          <li>
            <strong>Deceptive</strong>, V to vi: the ear expects I and gets a minor chord instead. A
            surprise, and the music has to go on.
          </li>
        </ul>
        <Plate caption="A short phrase in C major, ending each way. The last two chords are the cadence.">
          <Cadences
            labels={CADENCE_NAMES}
            readouts={{
              authentic: 'A full stop: home.',
              plagal: 'Amen: home, gently.',
              half: 'A comma: it stops on V and waits.',
              deceptive:
                'Home expected, A minor instead: the bass rises a step, the hands as for I.',
            }}
            staffLabel="Four chords on the grand staff"
          />
        </Plate>
        <Aside title="Question and answer">
          <p>
            Many tunes come in pairs of phrases: the first ends with a half cadence, a question, and
            the second with an authentic cadence, its answer. Listen for it in the Ode to Joy.
          </p>
        </Aside>
      </Section>

      <Section id="symbols" title="Chord symbols">
        <p>
          Songbooks, hymn books and jazz and pop music often print only the tune, with a{' '}
          <strong>chord symbol</strong> over it wherever the chord changes. Such a page is called a{' '}
          <strong>lead sheet</strong>, and the pianist makes up the accompaniment from the symbols.
          A symbol is a root and a few letters:
        </p>
        <ul>
          <li>
            <strong>C</strong>: a letter alone is a major triad, C E G.
          </li>
          <li>
            <strong>Am</strong>: m is minor, A C E.
          </li>
          <li>
            <strong>G7</strong>: 7 alone is the dominant seventh, G B D F.
          </li>
          <li>
            <strong>Cmaj7</strong>: a major seventh, C E G B.
          </li>
          <li>
            <strong>Dm7</strong>: a minor seventh, D F A C.
          </li>
          <li>
            <strong>B°</strong>: diminished, B D F; <strong>C+</strong>: augmented, C E G♯.
          </li>
          <li>
            <strong>Bm7♭5</strong>: half-diminished, B D F A.
          </li>
          <li>
            <strong>Csus4</strong>: the third suspended, replaced by the fourth, C F G; Csus2 has
            the second instead, C D G.
          </li>
          <li>
            <strong>F/A</strong>: a slash names the bass, here F major with A at the bottom, its
            first inversion.
          </li>
        </ul>
        <p>
          The symbols are spelled in more than one way, so expect these too: Δ or M7 for maj7 (CΔ7),
          – or min for m (C–), ø for m7♭5 (Bø7), dim for ° and aug for +.
        </p>
      </Section>

      <Section id="in-a-piece" title="Finding the harmony in a piece">
        <p>
          A written piece rarely prints its chords, but they are there. To find them, look first at
          the <strong>bass</strong>, the lowest note, which is often the root. Then gather the notes
          on the strong beats and stack them in thirds. Notes that do not fit, between two chord
          notes, are passing through.
        </p>
        <p>
          Bach’s Prelude in C is the clearest example: every bar is one chord, broken into the same
          pattern of notes. Fold a bar up and you can play it as a chord.
        </p>
        <Plate caption="The first four bars of the Prelude in C, each folded into one chord: C, then D minor 7 over C, G7 over B, and C again. Listen as Bach wrote them, then as chords.">
          <PreludeHarmony
            labels={{ written: 'As written', chords: 'As chords' }}
            staffLabel="Four chords on the grand staff: the first bars of Bach’s Prelude in C"
          />
        </Plate>
        <p>
          The four bars are I, ii7, V7, I: out from home and back, over a bass that barely moves.
          Knowing the chords makes a piece easier to learn and to remember: in the{' '}
          <Link href="/pieces/bach-prelude-in-c">Pieces</Link>, try naming each bar’s chord before
          you play it.
        </p>
      </Section>

      <Section id="try-it" title="Try it">
        <p>
          Play triads from their root, then chords from their symbols, in any octave, the notes
          together or one at a time. Then name a few cadences by ear.
        </p>
        <Plate>
          <ChordQuiz items={TRIAD_ITEMS} />
        </Plate>
        <Plate>
          <ChordQuiz items={SYMBOL_ITEMS} />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="Cadences." questions={HEARD} onComplete={complete} />
        </Plate>
        <p>
          On the <Link href="/ear">Ear</Link> page, chords are played for you to name or play back,
          from major and minor triads to inversions and the four seventh chords of this lesson.
        </p>
      </Section>
    </>
  );
}

import { ChoiceQuiz, KeyQuiz, SequenceExercise, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { phraseIn, scaleKeys, scaleUp } from '../notes.ts';
import {
  LeadingNote,
  MajorAndMinor,
  MinorScaleBuilder,
  MinorScaleCard,
  RelativeMinor,
  SignatureCard,
  SnippetCard,
  TellTheKey,
  ThirdAndChord,
  type MinorKind,
} from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 83]; // C3–B5
const A_HARMONIC = scaleKeys('harmonicMinor', 'A');

const BUILDER = {
  tonic: 'Key',
  natural: 'Natural',
  harmonic: 'Harmonic',
  melodic: 'Melodic',
  accidentals: 'Sharps and flats',
  signature: 'Key signature',
  steps: 'The steps of the scale',
  up: 'The steps going up',
  down: 'The steps coming down',
  whole: 'W',
  half: 'H',
  augmented: '1½',
};

// A major key's signature, and its relative minor's tonic.
const RELATIVES: readonly [string, number][] = [
  ['G', 64], // E
  ['F', 62], // D
  ['D', 59], // B
  ['C', 69], // A
  ['Bb', 67], // G
  ['A', 66], // F♯
  ['Eb', 60], // C
];

const KINDS = ['Natural minor', 'Harmonic minor', 'Melodic minor'];
const KIND_INDEX: Record<MinorKind, number> = {
  naturalMinor: 0,
  harmonicMinor: 1,
  melodicMinor: 2,
};
const SEEN = 'Which minor scale is written here?';
const HEARD = 'Listen: which minor scale is it?';
const WHICH_MINOR: readonly ChoiceQuestion[] = (
  [
    ['harmonicMinor', 'A', true],
    ['naturalMinor', 'E', true],
    ['melodicMinor', 'D', true],
    ['harmonicMinor', 'C', false],
    ['melodicMinor', 'A', false],
    ['naturalMinor', 'G', false],
  ] as const
).map(([kind, tonic, seen]) => ({
  id: `${kind}-${tonic}`,
  question: seen ? SEEN : HEARD,
  figure: seen ? <MinorScaleCard kind={kind} tonic={tonic} label="A minor scale" /> : null,
  options: KINDS,
  answer: KIND_INDEX[kind],
  sound: scaleUp(kind, tonic),
}));

const WHICH_KEY: readonly ChoiceQuestion[] = (
  [
    ['A', 'minor', ['C major', 'A minor']],
    ['G', 'major', ['G major', 'E minor']],
    ['D', 'minor', ['F major', 'D minor']],
    ['D', 'major', ['D major', 'B minor']],
    ['G', 'minor', ['B♭ major', 'G minor']],
    ['F', 'major', ['F major', 'D minor']],
  ] as const
).map(([tonic, mode, options]) => ({
  id: `${tonic}-${mode}`,
  figure: <SnippetCard snippetKey={{ tonic, mode }} label="A phrase on the grand staff" />,
  sound: phraseIn({ tonic, mode }).sound,
  options,
  answer: mode === 'major' ? 0 : 1,
}));

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Every scale so far has been major. Its partner is the minor, darker and sadder, and many of
        the pieces you will play are in a minor key. Each minor key shares its notes with a major
        key, but has a home of its own, and its scale comes in three forms.
      </p>

      <Section id="sound" title="The sound of minor">
        <p>
          Play a tune you know twice, once in major and once in minor. Only one note changes: the
          third note of the scale, E in C major, is a half step lower in C minor, E♭. That one key
          turns a bright tune dark.
        </p>
        <Plate caption="Listen in C major, then switch to C minor and listen again. Only E changes.">
          <MajorAndMinor
            staffLabel="Frère Jacques on the treble staff"
            labels={{ major: 'C major', minor: 'C minor' }}
          />
        </Plate>
        <Aside title="Mahler did it too">
          <p>
            In the third movement of his First Symphony, Mahler puts Frère Jacques into a minor key
            and slows it down to a funeral march.
          </p>
        </Aside>
        <p>
          What you hear is the distance from the <strong>tonic</strong>, the scale’s first note, to
          its third. In major it is four half steps, a <strong>major third</strong>; in minor it is
          three, a <strong>minor third</strong>. Stack the tonic, the third and the fifth note into
          a chord, and it is major or minor for the same reason: C E G sounds bright, C E♭ G sad.
        </p>
        <Plate caption="Switch between major and minor, and listen to the third and to the chord.">
          <ThirdAndChord
            staffLabel="A third and a chord on the treble staff"
            labels={{
              major: 'Major',
              minor: 'Minor',
              third: 'The third',
              chord: 'The chord',
              readout: {
                major: { name: 'C → E', label: 'Four half steps: a major third' },
                minor: { name: 'C → E♭', label: 'Three half steps: a minor third' },
              },
            }}
          />
        </Plate>
      </Section>

      <Section id="relative" title="The relative minor">
        <p>
          Play the white keys again, but from A to A: A B C D E F G A. They are the same seven notes
          as C major, and yet the scale sounds minor, because A is now home. This is A minor, the{' '}
          <strong>relative minor</strong> of C major.
        </p>
        <p>
          Every major key has a relative minor. It starts on the major scale’s 6th note or, counting
          down, a minor third below its tonic: C, B, A. The two share every note, and so they share
          the key signature.
        </p>
        <Plate
          wide
          caption="Choose a major key and listen to its scale, then switch to its relative minor. The notes and the key signature stay; only the first note moves."
        >
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
        <Aside title="Down three half steps">
          <p>
            To find a major key’s relative minor, go down three half steps from its tonic, and two
            letters: G major gives E minor, F major D minor. Up three half steps from a minor tonic
            is its relative major.
          </p>
        </Aside>
      </Section>

      <Section id="natural" title="The natural minor">
        <p>
          The notes from A to A with nothing changed are the <strong>natural minor</strong> scale.
          Measure its steps as you did for the major: whole, half, whole, whole, half, whole, whole.
          The half steps fall in other places, between the 2nd and 3rd notes and between the 5th and
          6th, and that is what makes it minor.
        </p>
        <p>
          Start on any key and follow the pattern, and you get that key’s natural minor. From E it
          needs F♯, from D it needs B♭: the sharps and flats of G major and F major, their relative
          majors.
        </p>
        <Plate
          wide
          caption="Choose a key and a minor: the row shows the steps, the keyboard the scale. Notes raised from the natural minor are coloured. With Key signature, only what the signature does not give is written."
        >
          <MinorScaleBuilder staffLabel="A minor scale on the treble staff" labels={BUILDER} />
        </Plate>
      </Section>

      <Section id="harmonic" title="The harmonic minor">
        <p>
          Play A natural minor to the top and listen to its last step, G to A. It is a whole step,
          and the scale drifts home rather than arriving. Raise the 7th note a half step, to G♯, and
          the last step is a half step: G♯ leans into A the way B leans into C in C major. A 7th a
          half step below the tonic is called the <strong>leading note</strong>, because it leads
          there.
        </p>
        <p>
          The natural minor with its 7th raised is the <strong>harmonic minor</strong>. It is named
          after harmony: at the end of a piece in A minor, the chord on E before the last chord
          needs G♯ to sound final. Most minor pieces raise the 7th like this, so expect to see it.
        </p>
        <Plate caption="Switch between G and G♯, and listen to the top of the scale and to the two chords that end a piece in A minor.">
          <LeadingNote
            staffLabel="The top of the A minor scale, and two chords"
            labels={{
              natural: 'G: natural minor',
              raised: 'G♯: harmonic minor',
              scale: 'The top of the scale',
              chords: 'The two chords',
              readout: {
                natural: { name: 'G → A', label: 'A whole step: the scale drifts home.' },
                raised: {
                  name: 'G♯ → A',
                  label: 'A half step: a leading note. F → G♯ is a step and a half.',
                },
              },
            }}
          />
        </Plate>
        <p>
          Raising the 7th leaves a wide gap below it: F to G♯ is three half steps, a{' '}
          <strong>step and a half</strong>. You hear it as a small leap in the scale. Choose
          Harmonic in the scale above to see the whole pattern: whole, half, whole, whole, half,
          step and a half, half.
        </p>
      </Section>

      <Section id="melodic" title="The melodic minor">
        <p>
          A step and a half is awkward to sing, so a tune climbing to the tonic often raises the 6th
          as well: F♯ and G♯ in A minor. Going up, the <strong>melodic minor</strong> is whole,
          half, whole, whole, whole, whole, half. It differs from A major only in its third note.
        </p>
        <p>
          Coming down there is no leading note to satisfy, so both go back: G, then F. The melodic
          minor comes down as the natural minor, and that is how the Scales page plays it.
        </p>
        <Plate
          wide
          caption="The melodic minor goes up with its 6th and 7th raised and comes down natural. Try another key: in D minor, B♭ becomes B and C becomes C♯ on the way up."
        >
          <MinorScaleBuilder
            initial="melodicMinor"
            staffLabel="The melodic minor up and down on the treble staff"
            labels={BUILDER}
          />
        </Plate>
        <Aside title="Three minors, one key">
          <p>
            Which minor is a piece in? All three: they are one key, A minor, with one key signature.
            The 6th and 7th rise or fall as the tune needs, and a raised note is always written as
            an accidental.
          </p>
        </Aside>
      </Section>

      <Section id="signatures" title="Minor key signatures">
        <p>
          A minor key uses its relative major’s key signature. A minor has none, like C major; E
          minor has one sharp, like G major; D minor one flat, like F major. The raised 6th and 7th
          are never in the signature: they are written as accidentals where they occur.
        </p>
        <p>
          So one signature fits two keys. To tell which one a piece is in, look at its end, and look
          for the raised 7th. A piece nearly always ends on its tonic, with the tonic in the bass:
          one that ends on A over A is in A minor, one that ends on C in C major. And a G♯ that
          keeps appearing, the raised 7th, says A minor; C major has no use for it.
        </p>
        <Plate caption="Two phrases, neither with sharps or flats in the signature. Switch between them: the one in A minor ends on A, over A in the bass, with G♯ on the way.">
          <TellTheKey
            staffLabel="A phrase on the grand staff"
            keys={[
              { tonic: 'C', mode: 'major' },
              { tonic: 'A', mode: 'minor' },
            ]}
            labels={[
              { name: 'C major', label: 'It ends on C, over C in the bass. No G♯.' },
              {
                name: 'A minor',
                label: 'It ends on A, over A in the bass, after G♯: the raised 7th.',
              },
            ]}
          />
        </Plate>
        <p>
          C minor is not C major’s relative. It is its <strong>parallel minor</strong>: the minor
          key on the same tonic, with another signature, three flats, B♭ E♭ A♭. The tune at the top
          of this lesson went from C major to its parallel minor.
        </p>
      </Section>

      <Section id="try-it" title="Try it">
        <p>
          Find relative minors from their signatures, then play a harmonic minor scale, then tell
          the three minors apart and name the key of a few phrases.
        </p>
        <Plate>
          <KeyQuiz
            range={RANGE}
            anyOctave
            items={RELATIVES.map(([tonic, key]) => ({
              key,
              ask: 'The minor key with this signature: play its tonic.',
              figure: <SignatureCard tonic={tonic} label="A key signature" />,
            }))}
          />
        </Plate>
        <p>
          Play A harmonic minor with the right hand, up and back down, following the fingers marked
          on the keys. Going up, the thumb passes under after the third finger, onto D.
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={A_HARMONIC.keys}
            fingers={A_HARMONIC.fingers}
            prompt="A harmonic minor, right hand, up and down: mind the G♯."
          />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="Which minor is it?" questions={WHICH_MINOR} />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="Which key is the phrase in?"
            questions={WHICH_KEY}
            onComplete={complete}
          />
        </Plate>
        <p>
          On the Scales page every minor key waits in all three forms, one to four octaves, both
          hands, with Hanon’s fingering for the harmonic and melodic minors.
        </p>
      </Section>
    </>
  );
}

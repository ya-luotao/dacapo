import { ChoiceQuiz, SequenceExercise } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { majorScaleRun } from '../notes.ts';
import { KeySignatures, ScaleBuilder, SignatureCard } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [53, 83]; // F3–B5
const G_MAJOR = majorScaleRun('G');
const F_MAJOR = majorScaleRun('F');
const KEYS = ['C major', 'G major', 'D major', 'F major', 'B♭ major'];
const SIGNATURES: readonly [string, number][] = [
  ['G', 1],
  ['F', 3],
  ['D', 2],
  ['Bb', 4],
  ['C', 0],
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        A scale is a ladder of notes from one key up to the same letter an octave higher. The major
        scale is the one most tunes are made of, and every major scale, from any key, is built the
        same way.
      </p>

      <Section id="pattern" title="Whole, whole, half, whole, whole, whole, half">
        <p>
          Play the white keys from C to C: C D E F G A B C. Now measure each step. Whole, whole,
          half (E–F), whole, whole, whole, half (B–C). That pattern <em>is</em> the major scale.
        </p>
        <p>
          Start on any other key and follow the same pattern, and you get that key’s major scale.
          From G the pattern needs F♯ instead of F; from F it needs B♭ instead of B.
        </p>
        <Plate
          wide
          caption="Choose a key: the keyboard marks the scale, the row shows its steps, and Listen plays it."
        >
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
        <Aside title="Each letter once">
          <p>
            A major scale uses each of the seven letters exactly once. That is why G major has F♯
            and not G♭: G is already taken, by the key itself.
          </p>
        </Aside>
      </Section>

      <Section id="key-signature" title="The key signature">
        <p>
          A piece in G major would need a sharp before every F. Instead, the sharp is written once,
          at the start of every line, right after the clef: the <strong>key signature</strong>. It
          means every F is F♯, in every octave, unless a natural says otherwise.
        </p>
        <p>
          Sharps are always added in the same order, <strong>F C G D A E B</strong>, and flats in
          the reverse order, <strong>B E A D G C F</strong>. G major has one sharp, D major two; F
          major has one flat, B♭ major two.
        </p>
        <Plate caption="The key signatures of seven keys, on the grand staff. Switch to Key signature on the scale above to see the notes lose their sharps and flats.">
          <KeySignatures
            staffLabel="A key signature on the grand staff"
            none="No sharps or flats"
          />
        </Plate>
        <Aside title="To tell the key">
          <p>
            With sharps, the key is a half step above the last sharp: F♯ gives G major, C♯ gives D
            major. With flats, the second-to-last flat names the key: B♭ E♭ gives B♭ major. One flat
            is F major; learn that one by heart.
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="Try it">
        <p>
          Play two scales with the right hand, up and back down, following the fingers marked on the
          keys. Going up, the thumb passes under to the next key: after the third finger in G major,
          after the fourth (on B♭) in F major.
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={G_MAJOR.keys}
            fingers={G_MAJOR.fingers}
            prompt="G major, right hand, up and down."
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={F_MAJOR.keys}
            fingers={F_MAJOR.fingers}
            prompt="F major, right hand: mind the B♭."
          />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="Which major key has this signature?"
            questions={SIGNATURES.map(([tonic, answer]) => ({
              id: tonic,
              figure: <SignatureCard tonic={tonic} label="A key signature" />,
              options: KEYS,
              answer,
            }))}
            onComplete={complete}
          />
        </Plate>
        <p>
          Scales, in dacapo, go further: every major and minor key, one to four octaves, both hands,
          with a measure of how evenly you play them.
        </p>
      </Section>
    </>
  );
}

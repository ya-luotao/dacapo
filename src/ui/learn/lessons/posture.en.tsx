import { SequenceExercise } from '../exercises.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { FingerNumbers, FingeringOnStaff, FivePosition } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 71]; // C3–B4

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        How you sit and hold your hands decides what your fingers can do. Good habits are easier to
        build at the start than to mend later, and they keep playing comfortable for as long as you
        practise.
      </p>

      <Section id="sitting" title="Sitting at the piano">
        <Picture
          src="learn/posture-from-the-side.webp"
          alt="A pianist seen from the side on a piano bench, forearms level with the keys, back upright and feet flat on the floor."
          caption="From the side: forearms level with the keys, elbows a little in front of the body, back upright, feet flat."
        />
        <ul>
          <li>Sit on the front half of the bench, facing middle C.</li>
          <li>
            <strong>Height</strong>: your forearms roughly level with the keys. Too low and the
            wrists sag below the keys; too high and the shoulders creep up. Raise the bench, or sit
            on a firm cushion.
          </li>
          <li>
            <strong>Distance</strong>: with your hands on the keys, your elbows are a little in
            front of your body. If they press into your sides, move the bench back.
          </li>
          <li>
            Back upright, leaning very slightly forward from the hips; shoulders low and loose.
          </li>
          <li>Both feet flat on the floor, the right one near the pedal.</li>
        </ul>
        <Picture
          src="learn/seated-at-middle-c.webp"
          alt="A pianist seen from behind, sitting at the centre of an upright piano with a hand either side of the middle of the keyboard."
          caption="From behind: at the middle of the keyboard, one hand either side of middle C."
        />
      </Section>

      <Section id="hand-shape" title="The shape of the hand">
        <Picture
          src="learn/curved-hand.webp"
          alt="A right hand on the piano keys seen from the side: fingers gently curved, fingertips on the keys, wrist level with the hand."
          caption="Curved fingers, as if holding a small ball; the thumb plays on the side of its tip; the wrist level with the hand."
        />
        <p>
          Let your arm hang at your side, then bring the hand up to the keys without changing its
          shape: the fingers fall into a natural curve. Play on the fingertips, not the flat pads,
          and on the outer corner of the thumb. Keep the wrist level, neither dropped below the keys
          nor raised above the hand.
        </p>
        <Aside title="Stay loose">
          <p>
            If your hand, wrist or shoulder feels tight, stop and shake it out. Tension makes
            playing harder, and playing through pain can injure you.
          </p>
        </Aside>
      </Section>

      <Section id="finger-numbers" title="Finger numbers">
        <p>
          Piano music numbers the fingers the same way in both hands: the thumb is{' '}
          <strong>1</strong>, the index finger <strong>2</strong>, the middle finger{' '}
          <strong>3</strong>, the ring finger <strong>4</strong>, the little finger{' '}
          <strong>5</strong>.
        </p>
        <FingerNumbers
          alt="Two hands, palms down, fingers spread, the thumbs towards each other."
          left="Left hand"
          right="Right hand"
          caption="Thumbs are 1 and little fingers 5, in both hands: the numbers mirror each other."
        />
        <p>A score prints them over the notes where a particular finger is suggested:</p>
        <Plate caption="Fingers 1 to 5 over C, D, E, F and G: the right hand’s first position.">
          <FingeringOnStaff label="Five notes with finger numbers above them" />
        </Plate>
      </Section>

      <Section id="five-fingers" title="The five-finger position">
        <p>
          Put each finger of the right hand over its own white key, the thumb on middle C: 1 on C, 2
          on D, 3 on E, 4 on F, 5 on G. The left hand mirrors it an octave lower, the little finger
          on C3 and the thumb on G3. This is the <strong>C position</strong>, and many first pieces
          never leave it.
        </p>
        <Plate caption="Each key marked with the finger that plays it.">
          <FivePosition labels={{ left: 'Left hand', right: 'Right hand', both: 'Both' }} />
        </Plate>
      </Section>

      <Section id="try-it" title="Try it">
        <p>
          One finger to each key, up and back down, keeping the curve. Watch the marked finger, not
          just the key.
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[60, 62, 64, 65, 67, 65, 64, 62, 60]}
            fingers={[1, 2, 3, 4, 5, 4, 3, 2, 1]}
            prompt="Right hand, from the thumb on middle C."
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[48, 50, 52, 53, 55, 53, 52, 50, 48]}
            fingers={[5, 4, 3, 2, 1, 2, 3, 4, 5]}
            prompt="Left hand, from the little finger on C3."
            onComplete={complete}
          />
        </Plate>
        <p>
          Keep this shape and everything that follows comes easier. From here, Play, Read and the
          first Pieces put it all to work.
        </p>
      </Section>
    </>
  );
}

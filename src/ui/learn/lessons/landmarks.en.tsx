import { ChoiceQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { StaffQuiz, type Card } from '../staffFigures.tsx';
import { IntervalCard, IntervalExplorer, LandmarkMap } from '../theoryFigures.tsx';

const LANDMARK_CARDS: readonly Card[] = [
  { pitch: 'G4', clef: 'treble' },
  { pitch: 'F3', clef: 'bass' },
  { pitch: 'C5', clef: 'treble' },
  { pitch: 'C4', clef: 'bass' },
  { pitch: 'C3', clef: 'bass' },
  { pitch: 'C6', clef: 'treble' },
  { pitch: 'C4', clef: 'treble' },
  { pitch: 'C2', clef: 'bass' },
];

const NEIGHBOUR_CARDS: readonly Card[] = [
  { pitch: 'D4', clef: 'treble' },
  { pitch: 'B4', clef: 'treble' },
  { pitch: 'E3', clef: 'bass' },
  { pitch: 'A4', clef: 'treble' },
  { pitch: 'G3', clef: 'bass' },
  { pitch: 'D5', clef: 'treble' },
  { pitch: 'B2', clef: 'bass' },
  { pitch: 'E4', clef: 'treble' },
];

const OPTIONS = ['2nd', '3rd', '4th', '5th', 'Octave'];
const PAIRS: readonly [string, string, number][] = [
  ['E4', 'F4', 0],
  ['G4', 'B4', 1],
  ['C4', 'G4', 3],
  ['A4', 'B4', 0],
  ['D4', 'F4', 1],
  ['E4', 'A4', 2],
  ['F4', 'C5', 3],
  ['C4', 'C5', 4],
];
const MIDI: Record<string, number> = {
  C4: 60,
  D4: 62,
  E4: 64,
  F4: 65,
  G4: 67,
  A4: 69,
  B4: 71,
  C5: 72,
};

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Counting lines from the bottom of the staff every time is slow, and it never gets faster.
        Good readers do something else: they know a handful of notes on sight, and read everything
        else as a short step or skip from the nearest one.
      </p>

      <Section id="landmarks" title="A few notes you know at once">
        <p>These are the landmarks. Learn them until you no longer have to think:</p>
        <ul>
          <li>
            <strong>Middle C</strong> (C4): the ledger line between the two staves.
          </li>
          <li>
            <strong>Treble G</strong> (G4): the line the treble clef curls around.
          </li>
          <li>
            <strong>Bass F</strong> (F3): the line between the bass clef’s two dots.
          </li>
          <li>
            <strong>Treble C</strong> (C5): the third space of the treble staff, and{' '}
            <strong>bass C</strong> (C3): the second space of the bass staff.
          </li>
          <li>
            <strong>High C</strong> (C6): two ledger lines above the treble staff, and{' '}
            <strong>low C</strong> (C2): two ledger lines below the bass staff.
          </li>
        </ul>
        <Plate
          wide
          caption="The seven landmarks. Pick one to hear it and see its key: the five Cs are an octave apart, from C2 to C6."
        >
          <LandmarkMap label="The landmark notes on the grand staff" />
        </Plate>
        <Aside title="A mirror">
          <p>
            Treble C and bass C lie the same distance from middle C, one above and one below. Count
            the spaces away from middle C, and each is the third space of its staff: up from the
            bottom of the treble staff, down from the top of the bass staff. Learn them as a pair.
          </p>
        </Aside>
      </Section>

      <Section id="intervals" title="Steps and skips">
        <p>
          The distance between two notes is an <strong>interval</strong>. It is counted in letters,
          both ends included: C to D is a 2nd, C to E a 3rd, C to G a 5th, C to the next C an
          octave.
        </p>
        <p>On the staff, intervals have shapes you can see without naming either note:</p>
        <ul>
          <li>
            A <strong>2nd</strong> is a <strong>step</strong>: from a line to the next space, or a
            space to the next line. On the keyboard, the next white key.
          </li>
          <li>
            A <strong>3rd</strong> is a <strong>skip</strong>: line to the next line, or space to
            the next space. One white key is skipped.
          </li>
          <li>
            Odd intervals (3rd, 5th) stay on the same kind, line to line or space to space. Even
            ones (2nd, 4th, octave) change, line to space.
          </li>
        </ul>
        <Plate caption="Choose an interval and listen. Another moves both notes; the shape stays the same.">
          <IntervalExplorer
            staffLabel="Two notes on the treble staff"
            labels={{ 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 8: 'Octave' }}
            shapes={{
              2: 'a step: line to space',
              3: 'a skip: line to line, or space to space',
              4: 'three steps: line to space',
              5: 'four steps: line to line, or space to space',
              8: 'the same letter, eight notes up',
            }}
          />
        </Plate>
      </Section>

      <Section id="from-a-landmark" title="Reading from a landmark">
        <p>
          Now put the two together. For a note you don’t know on sight, find the nearest landmark
          and count the steps: a step above middle C is D4, a skip above treble G is B4, a step
          below bass F is E3.
        </p>
        <p>
          It feels slow at first. Within a week or two, the notes in between become landmarks of
          their own, and you stop counting.
        </p>
      </Section>

      <Section id="try-it" title="Try it">
        <p>
          First the landmarks themselves, then intervals by their shape, then the notes near them.
        </p>
        <Plate>
          <StaffQuiz cards={LANDMARK_CARDS} ask="Play the landmark on the staff." />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="What is the interval?"
            questions={PAIRS.map(([low, high, answer]) => ({
              id: `${low}${high}`,
              figure: <IntervalCard low={low} high={high} label={`${low} and ${high}`} />,
              options: OPTIONS,
              answer,
              sound: [MIDI[low]!, MIDI[high]!],
            }))}
          />
        </Plate>
        <Plate>
          <StaffQuiz
            cards={NEIGHBOUR_CARDS}
            ask="Find the nearest landmark, count the steps, and play the note."
            onComplete={complete}
          />
        </Plate>
        <p>
          Read trains exactly this, one note at a time: its levels grow from middle C outwards, and
          it keeps asking for the notes you are slowest to find.
        </p>
      </Section>
    </>
  );
}

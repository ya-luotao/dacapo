import { Link } from 'wouter';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  ClefExplorer,
  GrandStaffLink,
  LinesAndSpaces,
  StaffQuiz,
  StepsUp,
  type Card,
} from '../staffFigures.tsx';

const CARDS: readonly Card[] = [
  { pitch: 'E4', clef: 'treble' },
  { pitch: 'A3', clef: 'bass' },
  { pitch: 'G4', clef: 'treble' },
  { pitch: 'F3', clef: 'bass' },
  { pitch: 'C4', clef: 'treble' },
  { pitch: 'B3', clef: 'bass' },
  { pitch: 'D4', clef: 'treble' },
  { pitch: 'C4', clef: 'bass' },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Written music tells you two things about every note: how high it is, and how long it lasts.
        This lesson is about how high. The keyboard runs from left to right, low to high; the staff
        runs from bottom to top.
      </p>

      <Section id="lines-and-spaces" title="Five lines, four spaces">
        <p>
          The <strong>staff</strong> is five lines with four spaces between them. Both are counted
          from the bottom: the bottom line is the first line, and the space just above it is the
          first space.
        </p>
        <p>
          A note sits either <strong>on a line</strong>, with the line running through its middle,
          or <strong>in a space</strong>, between two lines.
        </p>
        <Plate caption="Point at the staff, or tap it, to find each line and each space.">
          <LinesAndSpaces
            staffLabel="A staff of five lines and four spaces"
            labels={{ lines: 'Lines', spaces: 'Spaces' }}
          />
        </Plate>
      </Section>

      <Section id="steps" title="Up the staff, up the keyboard">
        <p>
          From a line to the space just above it, or from a space to the line just above it, is one
          step up the alphabet: one white key to the right. Line, space, line, space: C, D, E, F,
          and on.
        </p>
        <Plate caption="From C4 to C5 one step at a time. Press Listen, or tap a line or a space to hear it.">
          <StepsUp label="Eight notes climbing the treble staff from C4 to C5" />
        </Plate>
      </Section>

      <Section id="treble-clef" title="The treble clef names G">
        <p>
          A staff on its own doesn’t say which notes its lines are. The <strong>clef</strong> at its
          start does. The <strong>treble clef</strong> grew out of a letter G: its curl wraps around
          the second line, and says that the note on that line is G, the G just above middle C:{' '}
          <strong>G4</strong>.
        </p>
        <p>
          Once one line has a name, the others follow by stepping up and down the alphabet. The
          lines of the treble staff, from the bottom, are <strong>E G B D F</strong>; the spaces
          spell <strong>F A C E</strong>.
        </p>
        <Plate caption="Show the G line, then every line or every space by letter. Point anywhere on the staff to see and hear the note there.">
          <ClefExplorer
            clef="treble"
            staffLabel="The treble staff"
            labels={{ clef: 'The G line', lines: 'Lines', spaces: 'Spaces' }}
          />
        </Plate>
        <Aside title="To remember">
          <p>
            Lines, bottom to top: <strong>E</strong>very <strong>G</strong>ood <strong>B</strong>oy{' '}
            <strong>D</strong>oes <strong>F</strong>ine. Spaces: F-A-C-E, <em>face</em>.
          </p>
        </Aside>
      </Section>

      <Section id="bass-clef" title="The bass clef names F">
        <p>
          Lower notes are written with the <strong>bass clef</strong>, which grew out of a letter F.
          Its two dots sit either side of the fourth line, and say that line is F, the F below
          middle C: <strong>F3</strong>.
        </p>
        <p>
          The lines of the bass staff, from the bottom, are <strong>G B D F A</strong>; the spaces
          are <strong>A C E G</strong>.
        </p>
        <Plate caption="The same, for the bass clef: its F line, its lines, its spaces.">
          <ClefExplorer
            clef="bass"
            staffLabel="The bass staff"
            labels={{ clef: 'The F line', lines: 'Lines', spaces: 'Spaces' }}
          />
        </Plate>
        <Aside title="To remember">
          <p>
            Lines: <strong>G</strong>ood <strong>B</strong>oys <strong>D</strong>o{' '}
            <strong>F</strong>ine <strong>A</strong>lways. Spaces: <strong>A</strong>ll{' '}
            <strong>C</strong>ows <strong>E</strong>at <strong>G</strong>rass.
          </p>
          <p>
            Watch out: the same line is a different note in each clef. The bottom line is E in the
            treble clef and G in the bass clef. Always read the clef first.
          </p>
        </Aside>
      </Section>

      <Section id="grand-staff" title="The grand staff, joined at middle C">
        <p>
          Piano music uses both staves at once, joined by a brace: the <strong>grand staff</strong>.
          The treble staff is mostly for the right hand, the bass staff for the left.
        </p>
        <Picture
          src="learn/hands-either-side.webp"
          alt="Two hands resting on a piano keyboard, the left hand to the left of the middle and the right hand to the right, the thumbs close together."
          caption="Right hand above middle C, left hand below it: the two staves of the grand staff, as two hands."
        />
        <p>
          Middle C sits exactly between the two staves. It needs a short line of its own, a{' '}
          <strong>ledger line</strong>, and it can be written on either staff: just below the treble
          staff, or just above the bass staff. Both are the same key.
        </p>
        <p>
          Ledger lines stretch the staff for any note above or below it, and they count like the
          staff’s own lines. On the first ledger line below the treble staff is C4; in the space
          just under it, B3.
        </p>
        <Plate
          wide
          caption="Hold keys to see where they are written: middle C and above on the treble staff, the keys below it on the bass staff."
        >
          <GrandStaffLink labels={{ play: 'Play', middle: 'Middle C', staff: 'The grand staff' }} />
        </Plate>
      </Section>

      <Section id="try-it" title="Try it: read, then play">
        <p>
          Eight notes from both clefs, all near middle C. Look at the clef, name the note, then play
          it in the right octave.
        </p>
        <Plate>
          <StaffQuiz cards={CARDS} ask="Play the note on the staff." onComplete={complete} />
        </Plate>
        <p>
          Reading like this, one note at a time and a little faster each day, is what{' '}
          <Link href="/read">Read</Link> trains. Its first levels use the notes of this quiz, and it
          remembers the notes that slow you down.
        </p>
      </Section>
    </>
  );
}

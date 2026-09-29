import { isBlack, pitchClass } from '../../../core/note.ts';
import { BlackGroups, FindKeys, KeyQuiz, LetterKeys, NameAnyKey } from '../keyboardFigures.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const THREE_OCTAVES: readonly [number, number] = [48, 83]; // C3–B5

const twoGroup = (midi: number) =>
  isBlack(midi) && pitchClass(midi) <= 3 ? `two${Math.floor(midi / 12)}` : null;
const isC = (midi: number) => (pitchClass(midi) === 0 ? `${midi}` : null);
const isF = (midi: number) => (pitchClass(midi) === 5 ? `${midi}` : null);

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        A piano keyboard looks like a wall of eighty-eight keys. It isn’t. It is one small pattern
        of twelve keys, repeated from the bottom of the piano to the top. Learn that pattern once
        and you can find any key without counting.
      </p>
      <Picture
        src="learn/seated-at-middle-c.webp"
        alt="A pianist seen from behind, sitting at the centre of an upright piano with a hand either side of the middle of the keyboard."
        caption="Sit at the middle of the keyboard, facing middle C: the bench square to the piano, your back upright, your forearms level with the keys."
      />

      <Section id="twos-and-threes" title="Twos and threes">
        <p>
          Look at the black keys first. They are not evenly spaced: they come in{' '}
          <strong>groups of two</strong> and <strong>groups of three</strong>, one after the other,
          all the way along. That pattern is your map. Every white key is named by where it sits
          against a group.
        </p>
        <Plate
          wide
          caption="The black keys in groups of two (blue) and three (amber). The colours only mark the pattern: every key still plays."
        >
          <BlackGroups labels={{ two: 'Twos', three: 'Threes', both: 'Both' }} />
        </Plate>
        <p>
          Your turn: find every group of two on this keyboard. One key from each group is enough.
        </p>
        <Plate>
          <FindKeys
            range={THREE_OCTAVES}
            groupOf={twoGroup}
            prompt="Play one key from every group of two black keys."
          />
        </Plate>
        <Aside title="Feel it">
          <p>
            On a real piano you can find the groups without looking: slide a finger along the black
            keys and feel the wider gap after every two and every three.
          </p>
        </Aside>
      </Section>

      <Section id="seven-letters" title="Seven letters">
        <p>
          The white keys are named with the first seven letters of the alphabet, A to G; after G
          comes A again. Musicians count from C, so we will too: <strong>C D E F G A B</strong>,
          then C again.
        </p>
        <p>Two landmarks are enough to find all the others:</p>
        <ul>
          <li>
            <strong>C</strong> is the white key just to the left of a group of two black keys.
          </li>
          <li>
            <strong>F</strong> is the white key just to the left of a group of three.
          </li>
        </ul>
        <p>
          From C, walk up the alphabet: D sits between the two black keys, E just after them. From
          F, G and A sit between the three, and B just after them.
        </p>
        <Plate caption="C sits beside the twos and F beside the threes; the other five follow in order.">
          <LetterKeys labels={{ c: 'C', f: 'F', all: 'All seven' }} />
        </Plate>
        <Plate>
          <FindKeys range={THREE_OCTAVES} groupOf={isC} prompt="Play every C on this keyboard." />
        </Plate>
        <Plate>
          <FindKeys range={THREE_OCTAVES} groupOf={isF} prompt="Now play every F." />
        </Plate>
      </Section>

      <Section id="middle-c" title="Middle C, and octaves">
        <p>
          From one C to the next is an <strong>octave</strong>: eight white keys, counting both Cs.
          Leave out the upper C and you have the pattern itself, twelve keys with the black ones,
          before it starts again. The names repeat with it, so to tell the Cs apart, each octave has
          a number.
        </p>
        <p>
          The C nearest the middle of the piano is <strong>C4</strong>, called{' '}
          <strong>middle C</strong>. The keys from it up to the next B are all in octave 4: D4, E4,
          and so on to B4. The next C starts octave 5, C5. Going down, the B just below middle C is
          B3.
        </p>
        <p>
          Middle C is your home. Sit facing it, and it is where your hands meet: the right hand
          usually plays from middle C upwards, the left hand below it.
        </p>
        <Plate
          wide
          caption="All 88 keys, every C named. Play any key to see its name, and where the same letter falls in the other octaves."
        >
          <NameAnyKey />
        </Plate>
        <Aside title="On a smaller keyboard">
          <p>
            A full piano runs from A0 to C8. Many keyboards have 61 or 49 keys; middle C is still
            C4, just nearer the left end. If in doubt, play the C you think it is and check its name
            above.
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="Try it: keys by name">
        <p>
          Now put it together. Each prompt names a key and its octave. Find it by its group and its
          octave, not by counting from the end.
        </p>
        <Plate>
          <KeyQuiz
            range={THREE_OCTAVES}
            keys={[60, 62, 64, 67, 57, 53, 72, 71, 55, 65]}
            ask={(name) => `Play ${name}`}
            onComplete={complete}
          />
        </Plate>
        <p>
          That is the whole keyboard: one pattern, seven letters and a number for the octave. Next,
          the staff, and how a note written on five lines tells you which of these keys to play.
        </p>
      </Section>
    </>
  );
}

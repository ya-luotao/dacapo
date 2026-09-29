import { ChoiceQuiz } from '../exercises.tsx';
import { InsideAction, type InsideCopy } from '../InsideAction.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const COPY: InsideCopy = {
  label: 'One key of a grand piano’s action, in cross-section, moving as the key is played',
  speeds: { real: 'Real speed', slow4: '4× slower', slow10: '10× slower' },
  touch: { key: 'Your touch', soft: 'Soft', loud: 'Loud' },
  names: 'Names',
  sustain: 'Sustain pedal',
  play: 'Play a note',
  pressed: 'Key',
  loudness: 'Loudness',
  pointAt: 'Point at any part to read what it does.',
  parts: {
    key: {
      name: 'Key',
      text: 'a lever on the balance rail: press the front down, and the back end rises.',
    },
    capstan: {
      name: 'Capstan',
      text: 'a small screw on the key that lifts the wippen. Turning it sets how soon the action answers.',
    },
    wippen: {
      name: 'Wippen',
      text: 'a lever that passes the key’s movement on to the jack and the repetition lever.',
    },
    jack: {
      name: 'Jack',
      text: 'pushes the hammer up by its knuckle, then tips out from under it just before the hammer reaches the string.',
    },
    letoff: {
      name: 'Let-off button',
      text: 'when the jack’s toe meets it, the jack tips away: the hammer is let go two or three millimetres below the string.',
    },
    repetition: {
      name: 'Repetition lever',
      text: 'a sprung lever that holds the hammer up while the key rises a little, so the jack can slip back under it and the note can be played again at once.',
    },
    hammer: {
      name: 'Hammer',
      text: 'hard felt on a wooden shank. It flies to the string on its own and bounces straight off, so the string can ring.',
    },
    backcheck: {
      name: 'Backcheck',
      text: 'catches the falling hammer by its tail while the key is held, so it cannot bounce back into the string.',
    },
    damper: {
      name: 'Damper',
      text: 'a felt pad resting on the string. The key lifts it as you play; when you let go, it falls back and stops the sound.',
    },
    string: {
      name: 'String',
      text: 'steel wire pulled very tight. Together, a grand piano’s strings pull with a force of around twenty tonnes.',
    },
    soundboard: {
      name: 'Soundboard',
      text: 'the string’s vibration passes through the bridge into a wide, thin wooden soundboard, which makes it loud enough to fill a room.',
    },
  },
  steps: [
    {
      phase: 'down',
      text: 'The key goes down. The capstan lifts the wippen, and the jack lifts the hammer.',
    },
    {
      phase: 'free',
      text: 'Let-off: the jack’s toe meets its button and the jack tips out. The hammer flies on alone.',
    },
    { phase: 'strike', text: 'The hammer strikes the string and bounces straight back off it.' },
    {
      phase: 'checked',
      text: 'The backcheck catches the hammer. The damper is up: the string rings as long as you hold the key.',
    },
    {
      phase: 'repeat',
      text: 'Let the key up a little: the repetition lever lifts the hammer, the jack slips back under it, and the note can be played again.',
    },
    {
      phase: 'release',
      text: 'Let go: the hammer returns, the damper falls onto the string, and the sound stops.',
    },
  ],
};

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        A piano is a machine for throwing a small felt hammer at a string, and catching it again.
        Between your finger and the string, every key has its own small machine, the{' '}
        <strong>action</strong>: wooden levers, felt, cloth and springs, adjusted to fractions of a
        millimetre. Play a key here or on your own keyboard, and watch it work.
      </p>
      <Picture
        src="learn/inside-a-grand.webp"
        alt="The inside of a grand piano with its lid raised: the iron frame, the strings fanning out over the soundboard, and the tuning pins."
        caption="Under the lid of a grand: the iron frame, the strings over the soundboard, the tuning pins. The action sits under the strings, at the keyboard end."
      />

      <Section id="action" title="One key, in slow motion">
        <p>
          This is one key of a grand piano cut in half, as if seen from the side, with you sitting
          on the left. Press any key and the drawing plays it at the speed you pressed. Real speed
          is too fast to follow, so it starts four times slower. Only the drawing slows down: you
          hear the note at once, before the hammer gets there on the page.
        </p>
        <Plate
          wide
          caption="Press a key on your keyboard or below, or Play a note. Slow it down to see each step; the steps light up as they happen."
        >
          <InsideAction copy={COPY} />
        </Plate>
      </Section>

      <Section id="flying-free" title="The hammer flies free">
        <p>
          The surprising thing about a piano is that you never push the hammer into the string. Just
          before it gets there, the jack tips out from under it (this is the{' '}
          <strong>escapement</strong>), and the hammer travels the last few millimetres on its own.
          It bounces straight off, and that is what lets the string ring.
        </p>
        <p>
          So once the hammer is on its way, nothing you do can change the note. Pressing harder into
          the bottom of the key does nothing at all. What makes a note louder is only how fast the
          hammer is thrown, that is, how quickly you press the key. Try it above: with a MIDI
          keyboard, press slowly, then quickly, and watch the loudness. The computer keys and a
          click always press at the same speed, so choose Soft or Loud instead.
        </p>
        <Aside title="Why it must let go">
          <p>
            A hammer held against the string would stop it at once, like a finger laid on a guitar
            string: you would hear a thud instead of a note.
          </p>
        </Aside>
      </Section>

      <Section id="pedals" title="Dampers and pedals">
        <p>
          Every key but the highest ones has a <strong>damper</strong>. The key lifts it as you play
          and lets it fall when you let go, so a note lasts exactly as long as you hold it.
        </p>
        <ul>
          <li>
            The right pedal, the <strong>sustain pedal</strong>, lifts every damper at once: notes
            ring on after you let go, and other strings ring along with them. Switch it on above and
            let go of a key.
          </li>
          <li>
            The left pedal, the <strong>soft pedal</strong>, slides a grand’s whole action a little
            sideways, so each hammer strikes fewer of its strings: most notes have three. The sound
            is softer and less bright.
          </li>
          <li>
            The middle pedal, on most grands, holds up only the dampers that are already up, so a
            chord can ring while the next notes stay short.
          </li>
        </ul>
      </Section>

      <Section id="upright" title="Grand and upright">
        <p>
          In an upright piano the strings stand on end, so the hammers strike forwards instead of
          up, and springs, not their weight, bring them back. Its action has no repetition lever
          like this one: a note can be played again only once the key has come most of the way up.
          The grand’s double escapement, patented by Sébastien Érard in 1821, lets a pianist repeat
          a note from a key only part way up, which is why fast repeated notes are easier on a
          grand.
        </p>
      </Section>

      <Section id="try-it" title="Test yourself">
        <Plate>
          <ChoiceQuiz
            prompt="Four questions about what you have just watched."
            questions={[
              {
                id: 'loud',
                question: 'What makes a note louder?',
                figure: null,
                options: [
                  'Pressing the key faster',
                  'Pressing harder once the key is down',
                  'Holding the key longer',
                ],
                answer: 0,
              },
              {
                id: 'stop',
                question: 'What stops the sound when you let go of a key?',
                figure: null,
                options: ['The hammer', 'The damper', 'The backcheck'],
                answer: 1,
              },
              {
                id: 'free',
                question: 'Why doesn’t the hammer stay pressed against the string?',
                figure: null,
                options: [
                  'The jack lets go of it just before it strikes',
                  'The damper pushes it away',
                  'The string is too tight',
                ],
                answer: 0,
              },
              {
                id: 'pedal',
                question: 'What does the sustain pedal do?',
                figure: null,
                options: [
                  'Lifts every damper off the strings',
                  'Moves the hammers closer to the strings',
                  'Makes the strings tighter',
                ],
                answer: 0,
              },
            ]}
            onComplete={complete}
          />
        </Plate>
      </Section>
    </>
  );
}

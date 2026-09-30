import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { LegatoPedalling, PedalExercise, PedalledChords } from '../pedalFigures.tsx';

const USES = {
  none: 'No pedal',
  held: 'Held down',
  changed: 'Changed',
  signs: 'Ped. and ✱',
  line: 'Line',
};

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'dampers',
    question: 'Which pedal lifts every damper off the strings?',
    figure: null,
    options: ['The left', 'The middle', 'The right'],
    answer: 2,
  },
  {
    id: 'una-corda',
    question: 'What does “una corda” in a score ask for?',
    figure: null,
    options: ['The left pedal', 'The right pedal', 'One finger only'],
    answer: 0,
  },
  {
    id: 'star',
    question: 'Under the staff, what does ✱ mean after Ped.?',
    figure: null,
    options: ['Let the pedal up', 'Press the pedal', 'Play the note louder'],
    answer: 0,
  },
  {
    id: 'notch',
    question: 'What does a notch in a pedal line ask for?',
    figure: null,
    options: [
      'Up and straight down again: a change',
      'Let the pedal up and leave it',
      'Press it halfway',
    ],
    answer: 0,
  },
  {
    id: 'when-up',
    question: 'In legato pedalling, when does the pedal come up?',
    figure: null,
    options: ['Just after the new chord is played', 'Just before the new chord', 'At the barline'],
    answer: 0,
  },
  {
    id: 'early',
    question: 'You lift the pedal before playing the new chord. What do you hear?',
    figure: null,
    options: ['A gap in the sound', 'The two chords blurred together', 'Nothing different'],
    answer: 0,
  },
  {
    id: 'late',
    question: 'You lift it long after the new chord. What do you hear?',
    figure: null,
    options: ['The two chords blurred together', 'A gap in the sound', 'A softer chord'],
    answer: 0,
  },
  {
    id: 'harmony',
    question: 'When is the pedal usually changed?',
    figure: null,
    options: ['When the harmony changes', 'On every beat', 'Only at the end of a piece'],
    answer: 0,
  },
  {
    id: 'heel',
    question: 'Where is your heel while you pedal?',
    figure: null,
    options: ['On the floor', 'On the pedal', 'In the air'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        A grand piano has three pedals, and the right one is used in nearly every piece written
        since Chopin’s time. Used well, it joins what the hands cannot and makes the piano ring;
        used carelessly, it smears everything together. This lesson shows what each pedal does and
        how to change the right one cleanly.
      </p>

      <Section id="three-pedals" title="Three pedals">
        <ul>
          <li>
            <strong>Right: the sustain pedal</strong>, also called the damper pedal. It lifts every
            damper off the strings at once, as <Link href="/learn/inside">Inside the piano</Link>{' '}
            shows: notes ring on after you let go of the keys, and other strings ring along with
            them. It is the one most music means by “pedal”.
          </li>
          <li>
            <strong>Left: the soft pedal</strong>, or <em>una corda</em> (“one string”). On a grand
            it slides the whole action a little sideways, so each hammer strikes fewer strings: the
            sound is quieter and softer in colour. <em>Tre corde</em> (“three strings”) tells you to
            let it up. On an upright it moves the hammers nearer the strings, which only makes the
            notes quieter.
          </li>
          <li>
            <strong>Middle: the sostenuto pedal</strong>, on most grands. It holds up only the
            dampers that are already raised when you press it: play a bass note, press the middle
            pedal, and that note rings on while everything after it stays clear. On many uprights
            the middle pedal is instead a practice pedal, which lowers a strip of felt between
            hammers and strings to play very quietly.
          </li>
        </ul>
        <p>
          Most digital pianos have a sustain pedal, and some have all three. A MIDI keyboard sends
          its sustain pedal to this app, as it does its keys.
        </p>
        <Aside title="Not a volume knob">
          <p>
            The soft pedal changes the colour of the sound more than its loudness. Playing softly
            still comes from the fingers.
          </p>
        </Aside>
      </Section>

      <Section id="pressing" title="How to press it">
        <ul>
          <li>Use your right foot, with the heel on the floor in front of the pedal.</li>
          <li>
            Press with the ball of the foot, moving from the ankle, and keep the foot on the pedal
            when it comes up, so it never slaps or thumps.
          </li>
          <li>Press it all the way down, and let it all the way up: halfway does neither job.</li>
          <li>Keep the left foot flat on the floor, or near the soft pedal when you need it.</li>
        </ul>
      </Section>

      <Section id="marks" title="Pedal marks">
        <p>
          The sustain pedal is marked under the bass staff. Older scores write <em>Ped.</em> where
          it goes down and a star, ✱, where it comes up. Newer ones draw a line: it starts where the
          pedal goes down, and each notch in it is a change, up and straight down again. Where a
          score marks nothing, the pedal is often still expected, and it is up to you and your
          teacher.
        </p>
        <Plate caption="The same pedalling written two ways: down at the first chord, changed at each new one, up at the end.">
          <PedalledChords
            uses={['changed']}
            marks={['signs', 'line']}
            labels={USES}
            staffLabel="Four chords, C, F, G and C, on the grand staff, with the pedal marked under them"
          />
        </Plate>
      </Section>

      <Section id="legato-pedalling" title="Changing the pedal: legato pedalling">
        <p>
          To join one chord to the next, the pedal has to let go of the old chord and catch the new
          one, with no gap and no blur. The trick is to change it <strong>after</strong> the new
          chord, not with it: play the new chord, then lift the pedal and press it straight down
          again while you hold the keys. The dampers fall for a moment and silence the old chord,
          and the new one, still held by your fingers, is caught by the pedal.
        </p>
        <p>
          The foot moves just after the hands, never together with them: this is called{' '}
          <strong>legato</strong> or <strong>syncopated pedalling</strong>. Lift the pedal before
          the new chord and the sound breaks, a <strong>gap</strong>; lift it too late and the old
          chord rings into the new one, a <strong>blur</strong>.
        </p>
        <Plate
          wide
          caption="Watch four chords with the pedal changed in time, too early and too late: keys at the top, the pedal in the middle, what you hear at the bottom. Play chords with your own keyboard and pedal, and it follows you."
        >
          <LegatoPedalling
            labels={{ clean: 'In time', early: 'Too early', late: 'Too late', watch: 'Watch' }}
            readouts={{
              clean:
                'Up just after each chord and straight down again: every chord rings into the next, each on its own.',
              early:
                'Up before each chord: the sound stops, and the new chord starts after a silence.',
              late: 'Up long after each chord: the old chord goes on ringing under the new one.',
            }}
            live="Your keys and pedal, as you play."
          />
        </Plate>
        <Aside title="Say it as you play">
          <p>
            “Play, up-down.” The chord first, then the foot. Practise it slowly on one chord after
            another until the foot follows the hands by itself.
          </p>
        </Aside>
      </Section>

      <Section id="when" title="When to change it">
        <p>
          Change the pedal whenever the harmony changes, usually with each new chord in the bass.
          Keep it down through one harmony and the notes ring together as they should; keep it down
          into the next and the two chords blur.
        </p>
        <Plate caption="The four chords played without the pedal, with it held all the way through, and changed at each chord. Only the last joins them and keeps them clear.">
          <PedalledChords
            uses={['none', 'held', 'changed']}
            marks={['line']}
            labels={USES}
            readouts={{
              none: 'The hand has to leave each chord to reach the next: gaps between them.',
              held: 'Every chord rings on into the next: a blur.',
              changed: 'Each chord caught by the pedal and let go at the next: joined and clear.',
            }}
            staffLabel="Four chords, C, F, G and C, on the grand staff, with the pedal marked under them"
          />
        </Plate>
        <p>
          Advanced players also lift the pedal only partway, so the dampers just brush the strings:
          this <strong>half pedalling</strong> thins the sound without stopping it.
        </p>
        <p>Leave the pedal up, or nearly, where it would muddy the music:</p>
        <ul>
          <li>in Bach and most music of his time, where the fingers do the joining;</li>
          <li>in fast scales and runs, whose notes would pile up into a smear;</li>
          <li>on staccato notes, which the pedal would make long again.</li>
        </ul>
        <p>When in doubt, listen: if the sound is muddy, change more often, or less deeply.</p>
      </Section>

      <Section id="try-it" title="Try it: four chords">
        <p>
          Play the four chords with your right hand, changing the pedal after each: press it after
          the first chord, then for each new chord, play, up, down. A change is clean when the pedal
          comes up within a quarter of a second of the chord and goes down again within 0.4 seconds.
          This needs a sustain pedal plugged into a MIDI keyboard.
        </p>
        <Plate>
          <PedalExercise
            prompt="C, F, G and C: play each chord, then change the pedal."
            skipTo="test-yourself"
            needsPedal="This one needs a sustain pedal on a MIDI keyboard. Skip it; the questions below finish the lesson."
            summary="{clean} of {total} changes clean."
            verdicts={{
              pending: 'Change {n}: …',
              clean:
                'Change {n}: clean, up {up} ms after the chord and down again {down} ms later.',
              early: 'Change {n}: lifted {ms} ms before the chord, a gap in the sound.',
              late: 'Change {n}: lifted {ms} ms after the chord, a blur.',
              held: 'Change {n}: not lifted before the next chord, the chords blurred.',
              slow: 'Change {n}: down again only {ms} ms later, the chord left unheld.',
              none: 'Change {n}: the pedal was not down.',
            }}
          />
        </Plate>
      </Section>

      <Section id="test-yourself" title="Test yourself">
        <Plate>
          <ChoiceQuiz prompt="The pedals." questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          On Play, the keys held by the pedal stay lit, so you can see what is still ringing. Try
          the chords of any piece there, changing the pedal with each.
        </p>
      </Section>
    </>
  );
}

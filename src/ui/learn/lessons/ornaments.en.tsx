import { ChoiceQuiz, SequenceExercise, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { OrnamentCard, Ornaments, SpreadAndPause } from '../ornamentFigures.tsx';

const RANGE: readonly [number, number] = [60, 83]; // C4–B5

const LABELS = {
  written: 'Written',
  played: 'Played',
  slowly: 'Slowly',
  atTempo: 'At tempo',
  acciaccatura: 'Acciaccatura',
  appoggiatura: 'Appoggiatura',
  mordent: 'Mordent',
  invertedMordent: 'Inverted mordent',
  turn: 'Turn',
  trillUpper: 'From above',
  trillMain: 'From the note',
};

const STAFF_LABELS = {
  acciaccatura: 'G, then A with a crushed B before it, then G',
  appoggiatura: 'G, then A with a leaning B before it, then G',
  mordent: 'Bar 5 of the Minuet in G: a C with a mordent, then D, C, B and A',
  invertedMordent: 'A C with an inverted mordent, then D, C, B and A',
  turn: 'A D with a turn over it, then C and B',
  trillUpper: 'A D trilled, ending with C and D, then C',
  trillMain: 'A D trilled, ending with C and D, then C',
};

const WHICH = 'Which ornament is this?';
const ORNAMENTS = ['Mordent', 'Inverted mordent', 'Turn', 'Trill'];
const GRACES = ['Acciaccatura', 'Appoggiatura'];

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'mordent',
    question: WHICH,
    figure: <OrnamentCard name="mordent" label="A note with an ornament over it" />,
    options: ORNAMENTS,
    answer: 0,
  },
  {
    id: 'turn',
    question: WHICH,
    figure: <OrnamentCard name="turn" label="A note with an ornament over it" />,
    options: ORNAMENTS,
    answer: 2,
  },
  {
    id: 'inverted',
    question: WHICH,
    figure: <OrnamentCard name="invertedMordent" label="A note with an ornament over it" />,
    options: ORNAMENTS,
    answer: 1,
  },
  {
    id: 'trill',
    question: WHICH,
    figure: <OrnamentCard name="trillUpper" label="A note with an ornament over it" />,
    options: ORNAMENTS,
    answer: 3,
  },
  {
    id: 'acciaccatura',
    question: 'Which grace note is this?',
    figure: <OrnamentCard name="acciaccatura" label="A small note before a main note" />,
    options: GRACES,
    answer: 0,
  },
  {
    id: 'appoggiatura',
    question: 'And this one?',
    figure: <OrnamentCard name="appoggiatura" label="A small note before a main note" />,
    options: GRACES,
    answer: 1,
  },
  {
    id: 'mordent-notes',
    question: 'In G major, which notes does this mordent play?',
    figure: <OrnamentCard name="mordent" label="A C with a mordent over it" />,
    options: ['C B C', 'C D C', 'D C B C'],
    answer: 0,
  },
  {
    id: 'baroque-trill',
    question: 'In Bach’s music, where does a trill start?',
    figure: null,
    options: ['On the note above', 'On the written note', 'On the note below'],
    answer: 0,
  },
  {
    id: 'fermata',
    question: 'What does this sign over the last note ask for?',
    figure: <OrnamentCard name="fermata" label="Three notes, the last with a fermata over it" />,
    options: ['Hold it longer than written', 'Play it short', 'Play it with a trill'],
    answer: 0,
  },
  {
    id: 'arpeggio',
    question: 'And this wavy line before a chord?',
    figure: (
      <OrnamentCard name="arpeggio" label="Two chords, the first with a wavy line before it" />
    ),
    options: ['Spread it from the bottom up', 'Play it louder', 'Trill its top note'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Music of Bach’s and Mozart’s time decorates its notes: small notes printed before them, and
        signs over them that stand for a quick group of notes. These are <strong>ornaments</strong>.
        Each is a shorthand, so this lesson writes out under each one the notes it stands for, and
        plays them slowly and at tempo.
      </p>

      <Section id="grace-notes" title="Grace notes">
        <p>
          A <strong>grace note</strong> is a small note printed before a main note. It has no time
          of its own in the bar; it takes it from a note beside it.
        </p>
        <ul>
          <li>
            With a slash through its stem it is an <strong>acciaccatura</strong>, a “crushed” note:
            play it as quickly as you can, just before the beat, so that the main note still seems
            to come on time.
          </li>
          <li>
            Without the slash it is an <strong>appoggiatura</strong>, a “leaning” note: it falls on
            the beat and takes its time from the main note, usually half of it. The main note comes
            late, and a little softer, as if leaning back.
          </li>
        </ul>
        <Plate caption="Each grace note as written, and under it as played. Listen slowly, then at tempo: the crushed note is a flick; the leaning one takes half the A.">
          <Ornaments
            names={['acciaccatura', 'appoggiatura']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
      </Section>

      <Section id="mordents" title="Mordents">
        <p>
          A <strong>mordent</strong> is a quick flick to the next note and back, on the beat: the
          note, its neighbour, the note, then the rest of its length held. The sign with a short
          vertical line through it goes to the note below. Without the line it goes to the note
          above, and is called the <strong>inverted mordent</strong>.
        </p>
        <p>
          The names are a muddle: some books call them the lower and the upper mordent, German calls
          the second a Pralltriller, and some traditions use “mordent” the other way round. Go by
          the sign, not the name. The neighbour is the next note of the key, unless a small sharp or
          flat by the sign says otherwise.
        </p>
        <Plate caption="Bar 5 of the Minuet in G, from the Pieces: its C has a mordent, C B C. Choose the inverted mordent to hear C D C instead.">
          <Ornaments
            names={['mordent', 'invertedMordent']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
        <Aside title="In the Pieces">
          <p>
            The Minuet in G has mordents on the C of bars 3 and 5, and again when they come back; an
            inverted mordent on a B near the end; and a small grace note before the A at the end of
            bar 8. Its companion in G minor has both kinds of mordent too.
          </p>
        </Aside>
      </Section>

      <Section id="turn" title="The turn">
        <p>
          A <strong>turn</strong>, the sign like an S lying on its side, winds round the note: the
          note above, the note, the note below, and the note again. Over a note it starts at once,
          on the beat. Written between two notes, the first is held and the turn played at its end,
          leading into the next.
        </p>
        <Plate caption="A turn over the D: E D C D, then on to the C.">
          <Ornaments names={['turn']} labels={LABELS} staffLabels={STAFF_LABELS} />
        </Plate>
      </Section>

      <Section id="trill" title="The trill">
        <p>
          <strong>tr</strong> over a note, often with a wavy line after it, is a{' '}
          <strong>trill</strong>: go back and forth quickly and evenly between the note and the one
          above it, for as long as the note lasts.
        </p>
        <p>
          Where it starts depends on when the music was written. In Baroque music, Bach’s and
          Handel’s, a trill starts on the note above, on the beat; in music from the nineteenth
          century on, it usually starts on the written note. Two small notes at its end finish it
          with a turn: the note below, then the note, leading into the next.
        </p>
        <Plate caption="The same trill two ways: from the note above, as in Bach, and from the written note, as in later music. Both end with the written turn into the C. At first, play it slowly, four notes to a beat.">
          <Ornaments
            names={['trillUpper', 'trillMain']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
        <Aside title="Even, not fast">
          <p>
            A slow, even trill sounds far better than a fast, lumpy one. Count its notes at first,
            and let them go faster only as long as they stay even.
          </p>
        </Aside>
      </Section>

      <Section id="spread-and-pause" title="Spread chords and the pause">
        <p>
          A wavy vertical line before a chord asks you to spread it, <strong>arpeggio</strong>: play
          its notes quickly one after another from the bottom up, holding each, so that the top note
          sounds last. A <strong>fermata</strong>, the sign like an eye over a note or a rest, is a
          pause: hold it longer than written, often about twice as long, as long as feels right,
          then go on.
        </p>
        <Plate caption="Listen with the sign and without it: the chord spread, then struck together; the last note held, then as written.">
          <SpreadAndPause
            labels={{
              arpeggio: 'Spread chord',
              fermata: 'Pause',
              with: 'With the sign',
              without: 'Without it',
            }}
            staffLabels={{
              arpeggio: 'Two C major chords, the first with a wavy line before it',
              fermata: 'E, F and G, with a fermata over the G',
            }}
          />
        </Plate>
      </Section>

      <Section id="try-it" title="Try it">
        <p>First name the signs, then play two of them written out, slowly and evenly.</p>
        <Plate>
          <ChoiceQuiz prompt="Ornaments." questions={QUESTIONS} />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[72, 71, 72, 74, 72, 71, 69]}
            prompt="The Minuet’s mordent, written out: C B C, then D C B A."
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[76, 74, 72, 74, 72, 71]}
            prompt="A turn on D, written out: E D C D, then C and B."
            onComplete={complete}
          />
        </Plate>
        <p>
          The Pieces draw every ornament of the Minuets and wait for the main note of each: the
          ornament's other notes, and the grace notes, are neither right nor wrong, so you may play
          the ornament or leave it out. After a run, the Ornaments tab of the Expression panel says
          which you played, which in part and which you left out.
        </p>
      </Section>
    </>
  );
}

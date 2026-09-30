import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  CompoundTime,
  RhythmLine,
  RhythmRows,
  RhythmTap,
  ValueCard,
  type Beat,
} from '../rhythmFigures.tsx';

const h: Beat = { duration: 'half' };
const q: Beat = { duration: 'quarter' };
const e: Beat = { duration: 'eighth' };
const s: Beat = { duration: 'sixteenth' };
const t: Beat = { duration: 'eighth', triplet: true };
const hd: Beat = { duration: 'half', dotted: true };
const qd: Beat = { duration: 'quarter', dotted: true };
const ed: Beat = { duration: 'eighth', dotted: true };
const qT: Beat = { duration: 'quarter', tie: true };
const eT: Beat = { duration: 'eighth', tie: true };
const sr: Beat = { duration: 'sixteenth', rest: true };
const qdr: Beat = { duration: 'quarter', dotted: true, rest: true };

const HOW_LONG = 'How many beats does it last?';
const WHICH_COUNT = 'On which count is the coloured note played?';

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'dotted-quarter',
    question: HOW_LONG,
    figure: <ValueCard beat={qd} label="A dotted quarter note" />,
    options: ['¾', '1', '1½', '2'],
    answer: 2,
  },
  {
    id: 'sixteenth',
    question: HOW_LONG,
    figure: <ValueCard beat={s} label="A sixteenth note" />,
    options: ['¼', '½', '¾', '1'],
    answer: 0,
  },
  {
    id: 'sixteenth-rest',
    question: HOW_LONG,
    figure: <ValueCard beat={sr} label="A sixteenth rest" />,
    options: ['¼', '½', '¾', '1'],
    answer: 0,
  },
  {
    id: 'dotted-eighth',
    question: HOW_LONG,
    figure: <ValueCard beat={ed} label="A dotted eighth note" />,
    options: ['¼', '½', '¾', '1'],
    answer: 2,
  },
  {
    id: 'e-s-s',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[e, s, s, q]}
        time={[2, 4]}
        counts={false}
        current={2}
        label="An eighth, two sixteenths and a quarter, the second sixteenth coloured"
      />
    ),
    options: ['1', 'e', '&', 'a'],
    answer: 3,
  },
  {
    id: 'triplet',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[t, t, t, q]}
        time={[2, 4]}
        counts={false}
        current={2}
        label="A triplet and a quarter, the third note of the triplet coloured"
      />
    ),
    options: ['1', 'trip', 'let', '2'],
    answer: 2,
  },
  {
    id: 'syncopation',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[e, q, e]}
        time={[2, 4]}
        counts={false}
        current={1}
        label="An eighth, a quarter and an eighth, the quarter coloured"
      />
    ),
    options: ['1', '1 &', '2', '2 &'],
    answer: 1,
  },
  {
    id: 'six-eight',
    question: 'How many beats are there in a bar of 6/8?',
    figure: (
      <RhythmLine
        rhythm={[e, e, e, e, e, e]}
        time={[6, 8]}
        counts={false}
        label="A bar of six eighths in 6/8"
      />
    ),
    options: ['2', '3', '6'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        In the first rhythm lesson you counted whole beats and halves of them. Real music divides
        the beat more finely, holds notes over it, and sometimes leans against it. This lesson adds
        what you need to read the rhythms of most beginners’ pieces.
      </p>

      <Section id="dotted" title="Dotted notes again">
        <p>
          A dot makes a note half as long again. You have met the dotted half note: 2 + 1 = 3 beats.
          A <strong>dotted quarter note</strong> works the same way: 1 + ½ = 1½ beats.
        </p>
        <p>
          It is nearly always followed by an eighth, which fills the rest of the second beat. Count
          it “1 (2) &amp; 3”: play on 1, hold through 2, and play again on its “and”. Under the
          rhythms here, a count in brackets is one you say but don’t play on.
        </p>
        <Plate
          wide
          caption="The dotted quarter holds through beat 2, and the eighth comes on its “and”. Listen, then say the counts along."
        >
          <RhythmRows
            bracket
            rows={[
              { title: 'Dotted half, quarter', rhythm: [hd, q] },
              { title: 'Dotted quarter, eighth, twice', rhythm: [qd, e, qd, e] },
              { title: 'Dotted quarter, eighth, half', rhythm: [qd, e, h] },
            ]}
          />
        </Plate>
        <Aside title="Hold, don’t wait">
          <p>
            The usual slip is to let go early and wait in silence. Keep the key down through the
            count in brackets: the sound should last until the eighth.
          </p>
        </Aside>
      </Section>

      <Section id="ties" title="Ties">
        <p>
          A <strong>tie</strong> is a curve joining two notes of the same pitch. Play the first,
          then hold it for as long as both last together: the second is not played again.
        </p>
        <p>
          A tie can do what a dot cannot. It joins notes across a beat, and across the barline,
          where a single note would not fit. A quarter tied to an eighth sounds just like a dotted
          quarter.
        </p>
        <Plate
          wide
          caption="Each tied pair is one sound. The second row sounds the same as a dotted quarter and an eighth; the last holds beat 3 over the barline, in 3/4."
        >
          <RhythmRows
            bracket
            rows={[
              { title: 'Two quarters tied', rhythm: [q, qT, q, q] },
              { title: 'A quarter tied to an eighth', rhythm: [qT, e, e, h] },
              { title: 'Tied over the barline', rhythm: [q, q, qT, q, h], time: [3, 4] },
            ]}
          />
        </Plate>
        <Aside title="Tie or slur?">
          <p>
            A <strong>slur</strong> looks like a tie but joins notes of different pitches, to be
            played smoothly, one into the next. A tie only ever joins the same note twice.
          </p>
        </Aside>
      </Section>

      <Section id="sixteenths" title="Sixteenth notes">
        <p>
          A <strong>sixteenth note</strong> has two flags, or two beams. It lasts a quarter of a
          beat: four fill one beat. Count them “1 e &amp; a”, said “one-ee-and-a”. The sixteenth
          rest has two hooks, one more than the eighth rest.
        </p>
        <p>
          Sixteenths often share a beat with an eighth. An eighth and two sixteenths are counted “1
          &amp; a”; two sixteenths and an eighth, “1 e &amp;”. A <strong>dotted eighth</strong>{' '}
          lasts three sixteenths, so the sixteenth after it comes on the “a”, just before the next
          beat.
        </p>
        <Plate
          wide
          caption="Each row is a bar of 2/4. The second beam marks the sixteenths; a short one points to the note it belongs with."
        >
          <RhythmRows
            bracket
            bpm={60}
            rows={[
              { title: 'A quarter, then four sixteenths', rhythm: [q, s, s, s, s], time: [2, 4] },
              { title: 'An eighth, two sixteenths', rhythm: [e, s, s, e, s, s], time: [2, 4] },
              { title: 'Two sixteenths, an eighth', rhythm: [s, s, e, s, s, e], time: [2, 4] },
              { title: 'Dotted eighth, sixteenth', rhythm: [ed, s, ed, s], time: [2, 4] },
            ]}
          />
        </Plate>
        <Aside title="Keep the short one short">
          <p>
            A dotted eighth and sixteenth is easily played lazily, as if the two were nearly equal.
            Hold the dotted eighth for its full three sixteenths and play the sixteenth late, right
            against the next beat.
          </p>
        </Aside>
      </Section>

      <Section id="triplets" title="Triplets">
        <p>
          Sometimes a beat is divided into three instead of two. Three eighths with a 3 over them
          are a <strong>triplet</strong>: three notes in the time of two. They are evenly spaced, a
          third of a beat each.
        </p>
        <p>
          Count them “1 trip let, 2 trip let”. Listen to the difference: straight eighths march,
          triplets roll.
        </p>
        <Plate
          wide
          caption="The same beats divided in two, then in three, then one after the other. The beats line up from row to row."
        >
          <RhythmRows
            bracket
            spacing={88}
            rows={[
              { title: 'Eighths: two to a beat', rhythm: [e, e, e, e], time: [2, 4] },
              { title: 'Triplets: three to a beat', rhythm: [t, t, t, t, t, t], time: [2, 4] },
              { title: 'Two, then three', rhythm: [e, e, t, t, t], time: [2, 4] },
            ]}
          />
        </Plate>
        <Aside title="Three equal notes">
          <p>
            A triplet is not two quick notes and a long one. Say “1 trip let” evenly with the click
            on every number, and let the three notes fill the beat.
          </p>
        </Aside>
      </Section>

      <Section id="syncopation" title="Syncopation">
        <p>
          The strong notes usually start on the beat. <strong>Syncopation</strong> moves them off
          it: a longer note starts between the beats, so the accent falls where you don’t expect it.
          Ragtime, jazz and much popular music are full of it.
        </p>
        <p>
          The commonest pattern is eighth, quarter, eighth: the quarter starts on the “and” of 1 and
          holds through beat 2. A note tied over the beat does the same. Either way, nothing is
          played on the beat itself, and the beat goes on underneath all the same.
        </p>
        <Plate
          wide
          caption="The counts in brackets are the beats with nothing played on them: the note before is held through."
        >
          <RhythmRows
            bracket
            rows={[
              { title: 'Eighth, quarter, eighth', rhythm: [e, q, e, e, q, e] },
              { title: 'Tied over the beat', rhythm: [e, eT, e, e, q, q] },
              { title: 'Off the beat all bar', rhythm: [e, q, q, q, e] },
            ]}
          />
        </Plate>
        <Aside title="Count out loud">
          <p>
            Syncopation is where counting matters most. Say every count, the ones in brackets
            included, and play only where there is a note.
          </p>
        </Aside>
      </Section>

      <Section id="six-eight" title="6/8 time">
        <p>
          A bar of <strong>6/8</strong> holds six eighth notes, but not six beats. They are felt as
          two beats of three eighths each: “1 2 3 4 5 6”, with the weight on 1 and 4. The beat is a
          dotted quarter, three eighths long, and the eighths are beamed in threes to show it.
        </p>
        <p>
          3/4 also holds six eighths a bar, grouped in twos: three beats of two eighths. The notes
          are the same and the beat is not: 3/4 counts in three like a waltz, 6/8 swings in two like
          a jig or a lullaby.
        </p>
        <Plate caption="Six eighths a bar, beamed and clicked two ways. Switch between 3/4 and 6/8 and listen for the beats; add the eighths to hear how they group.">
          <CompoundTime
            labels={{ clicks: 'The click', beats: 'Beats', eighths: 'Beats and eighths' }}
          />
        </Plate>
        <p>
          A quarter and an eighth make the long–short swing of 6/8: the quarter takes two eighths,
          the eighth the third. A dotted quarter fills a whole beat.
        </p>
        <Plate
          wide
          caption="In 6/8 the eighths click too, more quietly than the beats, so you can count all six."
        >
          <RhythmRows
            bracket
            rows={[
              { title: 'Quarter, eighth', rhythm: [q, e, q, e], time: [6, 8] },
              { title: 'Three eighths, dotted quarter', rhythm: [e, e, e, qd], time: [6, 8] },
              {
                title: 'Dotted quarters, and a dotted quarter rest',
                rhythm: [qd, qd, e, e, e, qdr],
                time: [6, 8],
              },
            ]}
          />
        </Plate>
      </Section>

      <Section id="try-it" title="Try it">
        <p>
          First, how long the new notes last and on which count they fall. Then tap them in time.
        </p>
        <Plate>
          <ChoiceQuiz prompt="Read the rhythm." questions={QUESTIONS} />
        </Plate>
        <Plate wide>
          <RhythmTap
            bracket
            bpm={60}
            prompt="Tap any key on every note, counting as you go."
            rhythms={[
              [qd, e, q, q],
              [q, qT, e, e, q],
              [e, s, s, e, s, s, q, q],
              [ed, s, ed, s, h],
              [t, t, t, q, t, t, t, q],
              [e, q, e, q, q],
              { rhythm: [q, e, q, e], time: [6, 8] },
            ]}
            onComplete={complete}
          />
        </Plate>
        <p>
          The Pieces have a rhythm mode that times every note of a real piece this way. When a new
          rhythm will not come, set the Metronome slow and let it click two, three or four times a
          beat; it plays 6/8 too.
        </p>
      </Section>
    </>
  );
}

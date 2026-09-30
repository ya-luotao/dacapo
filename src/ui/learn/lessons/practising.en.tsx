import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { PracticePlan, TempoLadder, type PlanPart } from '../practiceFigures.tsx';

const PARTS: readonly PlanPart[] = [
  {
    id: 'warm-up',
    name: 'Warm up:',
    what: 'a scale or two, slowly and evenly.',
    weight: 15,
  },
  {
    id: 'hard-spots',
    name: 'The hard spots:',
    what: 'a bar or two at a time, slowly, in a loop, then a little faster.',
    weight: 40,
  },
  {
    id: 'new',
    name: 'Something new:',
    what: 'the next lines of a new piece, or some reading or ear training.',
    weight: 15,
  },
  {
    id: 'play-through',
    name: 'Play through:',
    what: 'a piece from start to end without stopping, as if someone were listening.',
    weight: 20,
  },
  {
    id: 'for-fun',
    name: 'For fun:',
    what: 'something you already love to play.',
    weight: 10,
  },
];

/** Moves each question's answer, written first, to a place of its own among the options. */
function vary(questions: readonly ChoiceQuestion[]): ChoiceQuestion[] {
  return questions.map((q, i) => {
    const k = i % q.options.length;
    return {
      ...q,
      options: [...q.options.slice(k), ...q.options.slice(0, k)],
      answer: (q.options.length - k) % q.options.length,
    };
  });
}

const QUESTIONS: readonly ChoiceQuestion[] = vary([
  {
    id: 'same-slip',
    question: 'You keep missing the same note in bar 12. What helps most?',
    figure: null,
    options: [
      'Play bar 12 slowly until it is right several times running',
      'Play the whole piece again from the start',
      'Play bar 12 faster, to get past it',
    ],
    answer: 0,
  },
  {
    id: 'tempo',
    question: 'How fast should you play a passage you are just learning?',
    figure: null,
    options: [
      'Slowly enough to play it without mistakes',
      'At the tempo marked in the score',
      'As fast as you can',
    ],
    answer: 0,
  },
  {
    id: 'daily',
    question: 'Which does more for your playing?',
    figure: null,
    options: ['Twenty focused minutes every day', 'Two hours once a week'],
    answer: 0,
  },
  {
    id: 'start',
    question: 'Where should a practice session usually start work on a piece?',
    figure: null,
    options: [
      'With its hardest passage, while you are fresh',
      'Always at the first bar',
      'With the part you play best',
    ],
    answer: 0,
  },
  {
    id: 'through',
    question: 'When is it time to play a piece through without stopping?',
    figure: null,
    options: [
      'Near the end of a session, and before you play it for someone',
      'Every time you practise it, from the first day',
      'Never: always stop to fix a mistake',
    ],
    answer: 0,
  },
  {
    id: 'slip',
    question: 'You slip while playing for your family. What do you do?',
    figure: null,
    options: [
      'Keep going, and come in again on the next beat',
      'Stop, and start again from the beginning',
      'Stop, and play the bar again until it is right',
    ],
    answer: 0,
  },
  {
    id: 'memory',
    question: 'What makes a piece learnt by heart hold up when you are nervous?',
    figure: null,
    options: [
      'Knowing it several ways: its sound, its harmony, its shape and each hand alone',
      'Playing it so often that the fingers do it by themselves',
      'Picturing the page',
    ],
    answer: 0,
  },
  {
    id: 'pain',
    question: 'Your wrist starts to ache while you practise. What now?',
    figure: null,
    options: [
      'Stop and rest; play more gently later, and ask a teacher or a doctor if it comes back',
      'Play through it: it makes the wrist stronger',
      'Press the keys harder',
    ],
    answer: 0,
  },
  {
    id: 'app',
    question: 'What can’t an app hear?',
    figure: null,
    options: [
      'Your tone, and how you use your arm and wrist',
      'Which keys you play',
      'When you play them',
    ],
    answer: 0,
  },
]);

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Practising is not playing a piece over and over. It is finding what does not work yet and
        making it work, a little at a time, so that next time it is easier. A few habits make the
        same minutes go much further.
      </p>

      <Section id="slowly" title="Slowly">
        <p>
          Your hands learn what they repeat, mistakes included. Play a passage too fast and stumble,
          and you are practising the stumble. Play it slowly enough to get every note, every finger
          and every rhythm right, and that is what they learn.
        </p>
        <p>
          So start at a tempo where you can play it without mistakes, however slow that is. Play it
          right a few times running, then go up a small step. If it falls apart, step back down. It
          feels slow, but it is the quickest way there.
        </p>
        <Plate caption="A ladder to your tempo: the start of the Ode to Joy at 60, 70, 80 and 90 per cent of it, then at the tempo itself. Take a rung only when the one below is clean.">
          <TempoLadder
            labels={{
              target: 'Your tempo',
              rung: '{percent}%: ♩ = {bpm}',
              readout: 'Play it cleanly three times running before you take the next step.',
            }}
            staffLabel="The first four bars of the Ode to Joy on the treble staff"
          />
        </Plate>
        <p>
          The <Link href="/metronome">Metronome</Link> climbs the ladder for you: its tempo trainer
          can speed up from one tempo to another, a few beats per minute every few bars. Its silent
          bars leave the click out now and then, so you keep the beat yourself. In the Pieces, the
          tempo can be set to a share of the score’s, and in wait mode the score waits for each
          note, however long you take.
        </p>
      </Section>

      <Section id="chunks" title="A little at a time">
        <p>
          Work on a bar or two at a time, not the whole page. Play the chunk and the first note of
          the next bar, so the join is practised too. Once two chunks are secure, join them, then
          join the pair to the next.
        </p>
        <p>
          In the <Link href="/pieces">Pieces</Link>, a loop plays the same bars again and again: set
          where it starts and ends. After a few runs, the weak bars show where you slow down or miss
          notes, and can loop the weakest for you.
        </p>
      </Section>

      <Section id="hands" title="Hands separately, then together">
        <p>
          Learn each hand alone until it is easy, then put them together, slowly, a few bars at a
          time. Playing together is a skill of its own, so it needs a slower tempo than either hand
          alone. Give more time to the hand that finds it harder; for most people, that is the left.
          The Pieces let you practise the right hand, the left or both.
        </p>
      </Section>

      <Section id="stop-or-go" title="Stopping, and going on">
        <p>There are two ways to practise a piece, and you need both.</p>
        <ul>
          <li>
            <strong>Stop and fix.</strong> At a mistake, stop. Find out what went wrong (a note, a
            finger, the rhythm), play that spot slowly and right several times, then play it again
            with a bar either side. This is how a piece is learnt, and most of your time goes here.
          </li>
          <li>
            <strong>Play through.</strong> Play from start to end without stopping, whatever
            happens, as you would for a listener. This is how you find out what is secure, and learn
            to keep going.
          </li>
        </ul>
        <p>
          Use the first while you learn a piece, and the second once near the end of a session, and
          more often as a performance comes closer. In the Pieces, wait mode is for stopping and
          fixing: it waits for the right notes. Rhythm mode is for playing through: the score moves
          on in time, and every note is timed.
        </p>
      </Section>

      <Section id="hard-first" title="The hard bar first">
        <p>
          If you always start at the beginning, the first page gets played a hundred times and the
          last hardly at all. Start with the hardest passage, while you are fresh. Start from
          different places: the middle, the last line, the start of each section. The end of a piece
          should be the part you know best.
        </p>
      </Section>

      <Section id="daily" title="Short, spaced and daily">
        <p>
          A little every day beats a lot now and then. Your hands and your brain go on learning
          between sessions, especially while you sleep, so twenty focused minutes a day do more than
          two hours on a Sunday. Focused is the word: twenty minutes on a hard bar do more than an
          hour of playing through what you already know.
        </p>
        <p>
          Plan the session before you sit down, with the hardest work early. Split a long session
          with short breaks. The <Link href="/progress">Progress</Link> page counts the days you
          practise in a row, the streak, and the minutes towards a daily goal.
        </p>
        <Plate caption="A session split into its parts. Choose how long you have; the hard spots get the biggest share.">
          <PracticePlan
            parts={PARTS}
            labels={{
              length: 'Your session',
              minutes: '{n} min',
              total: 'A session of {n} minutes',
            }}
          />
        </Plate>
        <Aside title="Stop while it is going well">
          <p>
            End on something that works. You come back to the piano more willingly the next day, and
            the last thing you played is the one you remember.
          </p>
        </Aside>
      </Section>

      <Section id="by-heart" title="Learning by heart">
        <p>
          The fingers learn a piece by themselves if you play it often enough. But the fingers’
          memory is the first to go when you are nervous, and then there is nothing to fall back on.
          A piece learnt by heart safely is known in several ways at once:
        </p>
        <ul>
          <li>
            <strong>By ear</strong>: you can sing the tune and hear what comes next.
          </li>
          <li>
            <strong>By its harmony and form</strong>: you know the chord of each bar, and which
            phrases come back.
          </li>
          <li>
            <strong>By its shape</strong>: where the hands go on the keyboard, the patterns under
            the fingers.
          </li>
          <li>
            <strong>By each hand alone</strong>: you can play either hand without the other.
          </li>
        </ul>
        <p>A plan for learning a piece by heart, a few bars a day:</p>
        <ol>
          <li>Listen to it, and sing the tune.</li>
          <li>
            Name the chords and mark the sections: where each phrase begins, and what repeats.
          </li>
          <li>Learn a phrase with the music, hands separately, then together.</li>
          <li>Play it without looking, each hand alone, then together. Look only when stuck.</li>
          <li>
            Choose <strong>landmarks</strong>: the start of each phrase and section. Practise
            starting from each of them, in any order.
          </li>
          <li>Away from the piano, play it in your head, and see the hands move.</li>
          <li>The next day, play it from memory before you look at the page again.</li>
        </ol>
      </Section>

      <Section id="performing" title="Playing for others">
        <p>
          Everyone is nervous playing for others; a racing heart and cold hands are normal. It gets
          easier with practice, so practise it too.
        </p>
        <ul>
          <li>
            <strong>Play for someone</strong>: a friend, your family, a call on the phone. Tell them
            you are practising a performance, and play it through.
          </li>
          <li>
            <strong>Record yourself</strong> on your phone and listen back later. You hear things
            you cannot hear while playing: a hurried bar, a tune lost under the chords.
          </li>
          <li>
            <strong>Have a routine</strong> before you begin: set the bench, rest your hands on your
            knees, breathe out slowly, hear the first bar in your head at its tempo, then start.
          </li>
          <li>
            <strong>After a slip, keep going.</strong> Listeners rarely notice a wrong note, but
            everyone hears a stop. Come in again on the next beat, or at the next landmark.
          </li>
        </ul>
      </Section>

      <Section id="healthy" title="Playing without strain">
        <Picture
          src="learn/posture-from-the-side.webp"
          alt="A pianist seen from the side on a piano bench, forearms level with the keys, back upright and feet flat on the floor."
          caption="Sit as in the lesson on posture: forearms level with the keys, back upright, feet flat."
        />
        <p>
          The piano should never hurt. Keep your shoulders low and loose, your wrist free, and let
          the weight of the arm play the keys rather than squeezing them. Once a note has sounded,
          stop pressing: the key only needs to be held, not pushed.
        </p>
        <ul>
          <li>Take a short break every twenty or thirty minutes: stand, shake out your hands.</li>
          <li>
            Pain is a signal to stop, not to push through. Rest, play more gently, and if it comes
            back, ask a teacher or a doctor.
          </li>
          <li>
            Hands come in all sizes. Never force a stretch: spread a chord that is too wide, leave
            out a note that is not the tune or the bass, or share it with the other hand.
          </li>
        </ul>
      </Section>

      <Section id="teacher" title="What an app cannot hear">
        <p>
          dacapo hears which keys you play, when, and with a MIDI keyboard how hard. That is a lot,
          but it is not everything. It cannot hear your tone, the sound in the room, or whether a
          phrase sings. It cannot see your arm, your wrist or your shoulders, and a habit of tension
          is easier to prevent than to cure.
        </p>
        <p>
          A teacher hears and sees all that. Even a few lessons now and then, to check how you sit,
          how you move and how you sound, are worth it; use the app for the practice in between.
        </p>
      </Section>

      <Section id="try-it" title="Try it">
        <p>A few questions on the ideas of this lesson.</p>
        <Plate>
          <ChoiceQuiz prompt="Practising well." questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          Then take a piece in the Pieces, find its hardest bars, and loop them slowly, one rung of
          the ladder at a time.
        </p>
      </Section>
    </>
  );
}

import { ChoiceQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  BeatPulse,
  RhythmRows,
  RhythmTap,
  TimeSignatures,
  ValueCard,
  type Beat,
} from '../rhythmFigures.tsx';

const w: Beat = { duration: 'whole' };
const h: Beat = { duration: 'half' };
const q: Beat = { duration: 'quarter' };
const e: Beat = { duration: 'eighth' };
const hd: Beat = { duration: 'half', dotted: true };
const qr: Beat = { duration: 'quarter', rest: true };
const hr: Beat = { duration: 'half', rest: true };

const VALUES: readonly [Beat, string, number][] = [
  [w, 'A whole note', 4],
  [q, 'A quarter note', 1],
  [h, 'A half note', 2],
  [e, 'An eighth note', 0],
  [hd, 'A dotted half note', 3],
  [hr, 'A half rest', 2],
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        Pitch is where a note is; rhythm is when. Under almost all music runs a steady beat, like a
        pulse, and rhythm is how long each note lasts, counted in those beats.
      </p>

      <Section id="beat" title="The beat">
        <p>
          Tap your foot to a song and you have found its <strong>beat</strong>. It stays steady
          while the notes above it move quickly or slowly. The <strong>tempo</strong> is how fast
          the beat goes, in beats per minute (BPM): at 60, one beat a second.
        </p>
        <Plate caption="Start the beat and tap any key with it. Each tap lands left of the line when early, right when late: aim for the middle.">
          <BeatPulse labels={{ tempo: 'Tempo' }} />
        </Plate>
      </Section>

      <Section id="note-values" title="How long a note lasts">
        <p>A note’s shape says how many beats it lasts:</p>
        <ul>
          <li>
            <strong>Whole note</strong>: open, no stem. Four beats.
          </li>
          <li>
            <strong>Half note</strong>: open, with a stem. Two beats.
          </li>
          <li>
            <strong>Quarter note</strong>: filled in, with a stem. One beat.
          </li>
          <li>
            <strong>Eighth note</strong>: filled in, with a flag, or joined to its neighbour by a
            beam. Half a beat: two eighths fill one beat.
          </li>
        </ul>
        <Plate
          wide
          caption="Each row fills a bar of four beats. Listen: a bar of clicks counts you in, then the piano plays the notes while the click keeps the beat."
        >
          <RhythmRows
            rows={[
              { title: 'Whole note: 4 beats', rhythm: [w] },
              { title: 'Half notes: 2 beats each', rhythm: [h, h] },
              { title: 'Quarter notes: 1 beat each', rhythm: [q, q, q, q] },
              { title: 'Eighth notes: half a beat each', rhythm: [e, e, e, e, e, e, e, e] },
            ]}
          />
        </Plate>
        <Aside title="Count out loud">
          <p>
            Say the count as you play. Quarter notes: “1, 2, 3, 4”. For eighths, put an “and”
            between the beats: “1 and 2 and 3 and 4 and”, written 1 &amp; 2 &amp;. The counts are
            printed under every rhythm here.
          </p>
        </Aside>
      </Section>

      <Section id="rests-and-dots" title="Rests and dots">
        <p>
          A <strong>rest</strong> is a silence, with the same lengths as the notes: a whole rest
          hangs below a line, a half rest sits on it, a quarter rest is a zigzag, an eighth rest a
          small hook. Keep counting through a rest; you just don’t play.
        </p>
        <p>
          A <strong>dot</strong> after a note makes it half as long again: a dotted half note lasts
          2 + 1 = 3 beats.
        </p>
        <Plate
          wide
          caption="Rests are counted like notes. The dotted half fills three beats of the bar."
        >
          <RhythmRows
            rows={[
              { title: 'Quarter, quarter rest, half', rhythm: [q, qr, h] },
              { title: 'Half rest, two quarters', rhythm: [hr, q, q] },
              { title: 'Dotted half, quarter', rhythm: [hd, q] },
            ]}
          />
        </Plate>
      </Section>

      <Section id="time-signature" title="Bars and the time signature">
        <p>
          Music is divided into <strong>bars</strong> by barlines, and the{' '}
          <strong>time signature</strong> at the start says how. The top number is how many beats
          each bar has; the bottom number which note gets one beat (4 means a quarter note). 4/4 has
          four beats a bar, 3/4 three, like a waltz, 2/4 two, like a march.
        </p>
        <p>The first beat of every bar is the strongest. Listen for it.</p>
        <Plate caption="The same quarter notes grouped in fours, threes and twos. The higher click is beat 1.">
          <TimeSignatures />
        </Plate>
      </Section>

      <Section id="try-it" title="Try it">
        <p>First, how long each note and rest lasts. Then tap rhythms in time.</p>
        <Plate>
          <ChoiceQuiz
            prompt="How many beats does it last?"
            questions={VALUES.map(([beat, label, answer], i) => ({
              id: `${i}`,
              figure: <ValueCard beat={beat} label={label} />,
              options: ['½', '1', '2', '3', '4'],
              answer,
            }))}
          />
        </Plate>
        <Plate wide>
          <RhythmTap
            prompt="Tap any key on every note, counting as you go."
            rhythms={[
              [q, q, q, q],
              [h, q, q],
              [q, q, h],
              [q, e, e, h],
              [hd, q],
              [q, qr, q, q],
            ]}
            onComplete={complete}
          />
        </Plate>
        <p>
          In time: after four clicks to count in, the click keeps going under the bar. The Pieces
          have a rhythm mode that times every note of a real piece this way, and the Metronome is
          there whenever you practise.
        </p>
      </Section>
    </>
  );
}

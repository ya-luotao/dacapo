import { KeyQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { StaffQuiz, type Card } from '../staffFigures.tsx';
import { AccidentalExplorer, BarRule, SameKey, StepExplorer } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 83];

const STEPS: readonly { key: number; ask: string }[] = [
  { key: 65, ask: 'A half step above E4' },
  { key: 62, ask: 'A whole step above C4' },
  { key: 59, ask: 'A half step below C4' },
  { key: 66, ask: 'A whole step above E4' },
  { key: 70, ask: 'A half step above A4' },
  { key: 60, ask: 'A whole step below D4' },
  { key: 64, ask: 'A half step below F4' },
  { key: 61, ask: 'A whole step above B3' },
];

const CARDS: readonly Card[] = [
  { pitch: 'F#4', clef: 'treble' },
  { pitch: 'Bb3', clef: 'bass' },
  { pitch: 'C#4', clef: 'treble' },
  { pitch: 'Eb4', clef: 'treble' },
  { pitch: 'G#3', clef: 'bass' },
  { pitch: 'Bb4', clef: 'treble' },
  { pitch: 'F#3', clef: 'bass' },
  { pitch: 'Ab4', clef: 'treble' },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        So far every note has been a white key. The black keys have names too, and to name them you
        need the smallest distance in music: the half step.
      </p>

      <Section id="half-steps" title="Half steps and whole steps">
        <p>
          A <strong>half step</strong> is the distance from one key to the very next, black or
          white, with nothing in between. C to C♯ is a half step; so is E to F, because there is no
          black key between them.
        </p>
        <p>
          A <strong>whole step</strong> is two half steps: C to D, or E to F♯.
        </p>
        <Plate caption="Play or click any key: the keys a half step (or a whole step) either side of it are marked.">
          <StepExplorer />
        </Plate>
        <Aside title="The two white half steps">
          <p>
            E–F and B–C are the only neighbouring white keys with no black key between them: they
            are where the groups of black keys stop. Everywhere else, two white keys are a whole
            step apart.
          </p>
        </Aside>
      </Section>

      <Section id="signs" title="Sharp, flat and natural">
        <p>
          A <strong>sharp</strong> ♯ raises a note a half step: F♯ is the key just right of F. A{' '}
          <strong>flat</strong> ♭ lowers it a half step: B♭ is the key just left of B. A{' '}
          <strong>natural</strong> ♮ cancels either, back to the plain white key.
        </p>
        <p>
          On the staff the sign goes before the note, on the same line or space. In words it comes
          after: “F sharp”, F♯.
        </p>
        <Plate caption="Choose a sign, then tap a line or a space to move the note. The note stays on its line; the key moves a half step.">
          <AccidentalExplorer
            staffLabel="A note with a sharp, a natural or a flat"
            labels={{ flat: 'Flat ♭', natural: 'Natural ♮', sharp: 'Sharp ♯' }}
          />
        </Plate>
      </Section>

      <Section id="two-names" title="One key, two names">
        <p>
          Every black key has two names. The key between C and D is <strong>C♯</strong> (C raised)
          or <strong>D♭</strong> (D lowered). Which one is written depends on the music; the key you
          play is the same.
        </p>
        <Plate caption="C♯ and D♭: two ways to write one key.">
          <SameKey label="C sharp and D flat on the treble staff" />
        </Plate>
      </Section>

      <Section id="to-the-barline" title="An accidental lasts to the barline">
        <p>
          A sharp, flat or natural written in the music is an <strong>accidental</strong>. It
          applies to that note for the rest of the bar, even where it is not written again. The
          barline cancels it.
        </p>
        <Plate caption="The second F is still F♯. After the barline, F is natural again.">
          <BarRule label="F sharp, F, then F after a barline" sounds="Listen" />
        </Plate>
      </Section>

      <Section id="try-it" title="Try it">
        <p>First steps on the keyboard, then sharps and flats on the staff.</p>
        <Plate>
          <KeyQuiz range={RANGE} items={STEPS} />
        </Plate>
        <Plate>
          <StaffQuiz
            cards={CARDS}
            ask="Play the note, sharp or flat included."
            onComplete={complete}
          />
        </Plate>
        <p>
          Level 7 of Read, sharps and flats, draws notes like these; the heatmap then shows which
          ones you find slowest.
        </p>
      </Section>
    </>
  );
}

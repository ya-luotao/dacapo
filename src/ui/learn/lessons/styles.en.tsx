import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { Excerpt, FormTimeline, PeriodTimeline } from '../styleFigures.tsx';
import type { FormName, Period } from '../styles.ts';

const PERIOD_NAMES: Record<Period, string> = {
  baroque: 'Baroque',
  classical: 'Classical',
  romantic: 'Romantic',
  modern: 'Impressionism and after',
};
const COMPOSER_NAMES = {
  petzold: 'Petzold',
  bach: 'J. S. Bach',
  beethoven: 'Beethoven',
  burgmuller: 'Burgmüller',
  chopin: 'Chopin',
  schumann: 'Schumann',
  tchaikovsky: 'Tchaikovsky',
  satie: 'Satie',
};

const PERIOD_OPTIONS = [
  PERIOD_NAMES.baroque,
  PERIOD_NAMES.classical,
  PERIOD_NAMES.romantic,
  PERIOD_NAMES.modern,
];

const FORM_NAMES: Record<FormName, string> = {
  period: 'Ode to Joy',
  binary: 'Minuet in G',
  songForm: 'Old French Song',
  rondoSection: 'Für Elise',
};

const FORM_OPTIONS = ['Binary', 'Ternary', 'Rondo', 'Theme and variations'];

const HEARD = 'Listen: which period does it sound like?';
const QUESTIONS: readonly ChoiceQuestion[] = [
  ...(
    [
      ['bach-musette-in-d', '1', '8', 100, 0],
      ['chopin-prelude-in-c-minor', '1', '4', 42, 2],
      ['beethoven-ode-to-joy', '1', '8', 108, 1],
      ['satie-gymnopedie-1', '5', '13', 72, 3],
      ['petzold-minuet-in-g-minor', '1', '8', 120, 0],
      ['tchaikovsky-morning-prayer', '1', '8', 62, 2],
    ] as const
  ).map(([piece, from, to, bpm, answer]) => ({
    id: piece,
    question: HEARD,
    figure: <Excerpt key={piece} piece={piece} from={from} to={to} bpm={bpm} />,
    options: PERIOD_OPTIONS,
    answer,
  })),
  {
    id: 'ternary',
    question: 'A tune, a different middle section, then the tune again. Which form is it?',
    figure: null,
    options: FORM_OPTIONS,
    answer: 1,
  },
  {
    id: 'binary',
    question: 'Two halves, each played twice; the second starts away from home and comes back.',
    figure: null,
    options: FORM_OPTIONS,
    answer: 0,
  },
  {
    id: 'rondo',
    question: 'A B A C A: the first tune keeps coming back between new ones.',
    figure: null,
    options: FORM_OPTIONS,
    answer: 2,
  },
  {
    id: 'variations',
    question: 'A tune, then the same tune again and again, each time changed.',
    figure: null,
    options: FORM_OPTIONS,
    answer: 3,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        A minuet by Bach’s contemporaries and a prelude by Chopin were written a century apart, for
        different instruments, and they ask to be played differently. Knowing when a piece was
        written tells you much about how to play it; knowing how it is built helps you learn it and
        remember it. This lesson takes the pieces in the library as its examples.
      </p>

      <Section id="periods" title="The periods">
        <p>
          Music history is usually told in periods, each with its own sound. The dates are rough:
          styles change slowly, and composers do not all change at once. The ones a pianist meets
          first are these four.
        </p>
        <Plate
          wide
          caption="The periods and the lives of the composers in the library. Choose a period to pick out its composers."
        >
          <PeriodTimeline
            labels={PERIOD_NAMES}
            composers={COMPOSER_NAMES}
            label="The periods from 1600 to 1950"
          />
        </Plate>
      </Section>

      <Section id="baroque" title="Baroque, about 1600–1750">
        <p>
          The music of Bach and Handel, written for the harpsichord and the clavichord as much as
          for any piano. Its texture is often <strong>counterpoint</strong>: two or more lines at
          once, each a tune of its own, rather than a tune over chords. In the Minuet in G the left
          hand has its own line, not an accompaniment. A harpsichord cannot swell from soft to loud,
          so the dynamics come in steps, a phrase soft and the next loud: <strong>terraced</strong>{' '}
          dynamics.
        </p>
        <ul>
          <li>An even touch and a steady tempo; each line clear.</li>
          <li>Quick notes often slightly detached, slurred pairs joined.</li>
          <li>Little or no pedal: the fingers make the legato.</li>
          <li>Ornaments start on the beat, a trill from the note above.</li>
          <li>Loud and soft in blocks, a whole phrase at a time.</li>
        </ul>
        <Plate caption="The first eight bars of the Minuet in G: two lines, each moving on its own.">
          <Excerpt
            piece="petzold-minuet-in-g"
            from="1"
            to="8"
            bpm={120}
            source="Petzold, Minuet in G major, bars 1–8"
          />
        </Plate>
        <p>
          In the library: Bach’s Prelude in C and the Musette in D, and Petzold’s Minuets in G major
          and G minor.
        </p>
      </Section>

      <Section id="classical" title="Classical, about 1750–1820">
        <p>
          The music of Haydn, Mozart and the young Beethoven. The piano took over from the
          harpsichord, and with it came loud and soft by touch, and every shade between. The music
          is a tune with an accompaniment, in clear, balanced phrases that often come in pairs, a
          question and an answer. A common accompaniment is the <strong>Alberti bass</strong>, a
          chord broken low, high, middle, high: C G E G.
        </p>
        <ul>
          <li>The tune on top, the accompaniment light and even under it.</li>
          <li>Clear phrases, each shaped and ended with a breath.</li>
          <li>Crisp articulation, slurs and staccatos just as written.</li>
          <li>The pedal used sparingly, to join and to colour, never to blur.</li>
        </ul>
        <Plate caption="The start of Für Elise: a tune over broken chords in the left hand, in two balanced phrases.">
          <Excerpt
            piece="beethoven-fur-elise"
            from="0"
            to="8"
            bpm={66}
            source="Beethoven, Für Elise, bars 1–8"
          />
        </Plate>
        <p>
          In the library: Beethoven’s Für Elise and the Ode to Joy. Beethoven wrote the Ode for his
          Ninth Symphony late in life, in 1824, when his music was already reaching into the next
          period.
        </p>
      </Section>

      <Section id="romantic" title="Romantic, about 1820–1900">
        <p>
          The music of Schubert, Schumann, Chopin, Liszt, Brahms and Tchaikovsky, written for
          bigger, richer pianos. It is about feeling: a <strong>singing melody</strong>, harmonies
          that colour and surprise, and wide contrasts from a whisper to full force. Many pieces are
          short and carry a title that names a mood or a scene.
        </p>
        <ul>
          <li>The tune sung out over the rest, as a voice would sing it.</li>
          <li>
            <strong>Rubato</strong>, “robbed” time: the tempo gives a little at the top of a phrase
            and takes it back after. The left hand keeps steadier than the right.
          </li>
          <li>The sustain pedal nearly all the time, changed with the harmony.</li>
          <li>Wide dynamics, from pp to ff, and long crescendos.</li>
        </ul>
        <Plate caption="The start of Tchaikovsky’s Old French Song: a sad tune over a held G.">
          <Excerpt
            piece="tchaikovsky-old-french-song"
            from="0"
            to="8"
            bpm={70}
            source="Tchaikovsky, Old French Song, bars 1–8"
          />
        </Plate>
        <p>
          In the library: Schumann’s Soldiers’ March, Burgmüller’s Arabesque and La Candeur,
          Tchaikovsky’s Old French Song and Morning Prayer, and Chopin’s Prelude in C minor.
        </p>
      </Section>

      <Section id="impressionism" title="Impressionism and after, from about 1890">
        <p>
          The music of Debussy, Ravel and Satie. It paints moods and colours, like the painters of
          the time. A chord is chosen for its own sound, and need not lead anywhere: the Gymnopédie
          rocks gently between two major seventh chords, G and D, and neither needs to resolve.
          Satie wrote it in 1888, a few years before Debussy’s best-known piano music, and Debussy
          later arranged it for orchestra.
        </p>
        <ul>
          <li>Soft, even and unhurried; the sound matters more than the speed.</li>
          <li>The pedal as colour: it blends the harmony into a haze, changed with care.</li>
          <li>Quiet dynamics, and each chord weighed so its notes sound together.</li>
        </ul>
        <Plate caption="The Gymnopédie No. 1, its first thirteen bars: the rocking chords, then the tune.">
          <Excerpt
            piece="satie-gymnopedie-1"
            from="1"
            to="13"
            bpm={72}
            source="Satie, Gymnopédie No. 1, bars 1–13"
          />
        </Plate>
      </Section>

      <Section id="phrases" title="Phrases and periods">
        <p>
          Music is made of <strong>phrases</strong>, like sentences, often four bars long. Two
          phrases that belong together, a question and its answer, make a <strong>period</strong>.
          The question ends open, often on V, a half cadence; the answer begins the same way and
          ends at home, on I.
        </p>
        <p>
          Knowing the phrases helps you play and learn a piece: shape each one, breathe between
          them, and learn it phrase by phrase. The forms below are made of phrases, the way a story
          is made of sentences.
        </p>
      </Section>

      <Section id="forms" title="Forms">
        <p>
          A piece’s <strong>form</strong> is how its sections follow one another: which come back,
          and which are new. Sections are named with letters: A for the first, B for the next new
          one, and A′ for A changed a little. These are the forms you will meet most.
        </p>
        <ul>
          <li>
            <strong>Binary</strong>, A B, each half usually repeated. The first half moves away from
            home, or pauses there; the second goes further and comes back. Most Baroque dances are
            binary, like both Minuets: the one in G minor ends its first half in B♭ major.
          </li>
          <li>
            <strong>Ternary</strong>, A B A: a tune, a contrasting middle, and the tune again.
            Tchaikovsky’s Old French Song is a small one, a a b a; the Musette in D becomes one when
            its first half is played again at the end, as was the custom.
          </li>
          <li>
            <strong>Rondo</strong>, A B A C A: the main tune keeps coming back between new episodes.
            Für Elise is one: its famous tune returns between two contrasting episodes, and the
            library has its first section, itself a small a b a.
          </li>
          <li>
            <strong>Theme and variations</strong>: a tune, then the same tune again and again, each
            time changed, in rhythm, harmony or mood. The Ode to Joy is the theme of variations in
            the finale of Beethoven’s Ninth Symphony.
          </li>
        </ul>
        <Plate
          wide
          caption="Four pieces from the library as they are played, repeats and all, each section as long as its bars. Choose one, and pick a section to hear it."
        >
          <FormTimeline
            forms={['period', 'binary', 'songForm', 'rondoSection']}
            labels={FORM_NAMES}
            readouts={{
              period:
                'A period and more: the first phrase asks, ending on D; the second answers, ending on C. Then a new phrase, and the answer again.',
              binary:
                'Binary: two halves of sixteen bars, each repeated. The second goes to D major and comes home.',
              songForm: 'Ternary, a a b a: the tune twice, a new middle, and the tune once more.',
              rondoSection:
                'The A section of a rondo: the tune, a short middle, the tune again, both halves repeated.',
            }}
          />
        </Plate>
        <p>
          Some names say what a piece is for rather than how it is built. A <strong>prelude</strong>{' '}
          was once played before something else; Bach’s comes before a fugue, while Chopin’s stand
          alone, often on a single idea. An <strong>étude</strong> is a study of one skill, like
          Burgmüller’s even runs. A <strong>character piece</strong> is a short piece with a title
          and a mood, like Schumann’s Soldiers’ March.
        </p>
        <Aside title="Sonata form, in two sentences">
          <p>
            Many first movements of sonatas and symphonies set out two themes, the second in another
            key, then take them through other keys in a development. Then both come back, and this
            time both are in the home key.
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="Try it">
        <p>Listen to a few passages and name their period, then name a few forms.</p>
        <Plate>
          <ChoiceQuiz prompt="Styles and forms." questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          Every piece in the <Link href="/pieces">Pieces</Link> names its period and its form.
          Before you learn one, find its sections and mark where each begins.
        </p>
      </Section>
    </>
  );
}

import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import {
  Accents,
  Articulation,
  Balance,
  CrescendoExercise,
  DynamicLevels,
  Hairpins,
  MarkCard,
  VelocityMeter,
} from '../expressionFigures.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const TOUCHES = {
  legato: {
    name: 'Legato',
    text: 'Each key let go as the next goes down; a breath where the first slur ends.',
  },
  nonLegato: { name: 'Non legato', text: 'Each note held most of its length, a little apart.' },
  staccato: { name: 'Staccato', text: 'Short: about half the note or less, then silence.' },
  tenuto: { name: 'Tenuto', text: 'Held for its whole length, with a little weight.' },
};

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'mp-mf',
    question: 'Which is louder?',
    figure: null,
    options: ['mp', 'mf'],
    answer: 1,
  },
  {
    id: 'p-pp',
    question: 'Which is softer?',
    figure: null,
    options: ['p', 'pp', 'mp'],
    answer: 1,
  },
  {
    id: 'staccato',
    question: 'What does the dot over this note ask for?',
    figure: <MarkCard mark="staccato" label="A note with a dot over it" />,
    options: ['Play it short and detached', 'Hold it a little longer', 'Play it louder'],
    answer: 0,
  },
  {
    id: 'dim',
    question: 'What does this sign under the notes ask for?',
    figure: <MarkCard hairpin="dim" label="Four notes over a hairpin that closes" />,
    options: ['Get gradually louder', 'Get gradually softer', 'Play the first note louder'],
    answer: 1,
  },
  {
    id: 'accent',
    question: 'And this mark over one note?',
    figure: <MarkCard mark="accent" label="A note with an accent over it" />,
    options: [
      'Play this note louder than the others',
      'Get gradually softer',
      'Hold it for its whole length',
    ],
    answer: 0,
  },
  {
    id: 'tenuto',
    question: 'What does the line over this note ask for?',
    figure: <MarkCard mark="tenuto" label="A note with a short line over it" />,
    options: ['Hold it for its whole length', 'Play it short', 'Play it softly'],
    answer: 0,
  },
  {
    id: 'relative',
    question: 'How loud is f?',
    figure: null,
    options: ['Always exactly as loud', 'Loud for this piece, on this piano'],
    answer: 1,
  },
  {
    id: 'balance',
    question: 'A tune in the right hand, chords in the left: which should sound louder?',
    figure: null,
    options: ['The tune', 'The chords', 'Both the same'],
    answer: 0,
  },
  {
    id: 'slur-end',
    question: 'What happens at the end of a slur?',
    figure: null,
    options: [
      'The hand lifts a little, and the phrase breathes',
      'The last note is held longer',
      'The last note is played louder',
    ],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        The same notes can be played loudly or softly, smoothly joined or cleanly apart. Scores mark
        both, and they make much of the difference between playing the notes and playing music. This
        lesson reads the marks and lets you hear them; with a MIDI keyboard, it also shows how you
        play them.
      </p>

      <Section id="loud-and-soft" title="Loud and soft">
        <p>
          Music takes its words for loudness from Italian. <strong>Piano</strong> means soft and{' '}
          <strong>forte</strong> means loud: the piano’s full name, the pianoforte, says it can do
          both. They are written as their initials, in bold italic letters under the staff.
        </p>
        <ul>
          <li>
            <strong>pp</strong>, pianissimo: very soft
          </li>
          <li>
            <strong>p</strong>, piano: soft
          </li>
          <li>
            <strong>mp</strong>, mezzo-piano: moderately soft
          </li>
          <li>
            <strong>mf</strong>, mezzo-forte: moderately loud
          </li>
          <li>
            <strong>f</strong>, forte: loud
          </li>
          <li>
            <strong>ff</strong>, fortissimo: very loud
          </li>
        </ul>
        <p>
          A mark lasts until the next one. The marks are relative, not exact: an f in a lullaby is
          gentler than an f in a march, and your piano and your room change them too. What counts is
          the difference between one level and the next.
        </p>
        <Plate caption="Choose a mark and Listen: the same phrase, softer or louder. The second button plays its first bar at all six, from pp to ff.">
          <DynamicLevels
            staffLabel="The start of the Ode to Joy on the treble staff, with a dynamic under it"
            labels={{
              all: 'pp to ff',
              levels: {
                pp: { name: 'pianissimo', meaning: 'very soft' },
                p: { name: 'piano', meaning: 'soft' },
                mp: { name: 'mezzo-piano', meaning: 'moderately soft' },
                mf: { name: 'mezzo-forte', meaning: 'moderately loud' },
                f: { name: 'forte', meaning: 'loud' },
                ff: { name: 'fortissimo', meaning: 'very loud' },
              },
            }}
          />
        </Plate>
        <p>
          On a piano, loudness comes from how fast the key goes down: a faster key throws the hammer
          harder (<Link href="/learn/inside">Inside the piano</Link> shows why). A MIDI keyboard
          measures it and sends it as a number from 1 to 127, its <strong>velocity</strong>.
        </p>
        <Plate caption="Play a few notes, some gently and some firmly: each bar is how hard you struck one key.">
          <VelocityMeter label="the last note you played" />
        </Plate>
        <Aside title="Soft is harder">
          <p>
            Playing softly and evenly is harder than playing loudly. Keep your fingertips on the
            keys and press them down slowly, but all the way to the bottom.
          </p>
        </Aside>
      </Section>

      <Section id="louder-and-softer" title="Getting louder and softer">
        <p>
          <strong>Crescendo</strong>, written <em>cresc.</em>, means getting gradually louder;{' '}
          <strong>diminuendo</strong> (<em>dim.</em>) or <strong>decrescendo</strong> (
          <em>decresc.</em>), getting gradually softer. The words are followed by a dashed line to
          where the change ends. The same thing is often drawn as a long, thin wedge, a{' '}
          <strong>hairpin</strong>: opening, it gets louder; closing, softer.
        </p>
        <Plate caption="The same swell written two ways: louder up to the G, then softer back down. Listen for the loudness rising and falling.">
          <Hairpins
            staffLabel="Nine notes up to G and back, with a crescendo and a diminuendo under them"
            labels={{ hairpins: 'Hairpins', words: 'Words' }}
          />
        </Plate>
        <Aside title="Leave room to grow">
          <p>
            Start a crescendo soft enough to have somewhere to go. One that is loud after two notes
            has nothing left for the end.
          </p>
        </Aside>
      </Section>

      <Section id="accents" title="Accents">
        <p>
          An <strong>accent</strong>, a small &gt; over or under a note, asks for that one note to
          be louder than those around it. <strong>sf</strong> or <strong>sfz</strong> (sforzando,
          “forcing”) is a sudden, strong accent, often in the middle of something soft. Straight
          after it, the music goes back to the level it had.
        </p>
        <p>
          Don’t mix up an accent with a hairpin. The accent is small and belongs to one note; the
          hairpin stretches under several.
        </p>
        <Plate caption="Accents make two notes stand out of a soft line; an sf is one sudden, forceful note.">
          <Accents
            staffLabel="Nine notes of a C major chord, up and down, marked soft, with accents or an sf"
            labels={{ accents: 'Accents', sf: 'sf' }}
          />
        </Plate>
      </Section>

      <Section id="balance" title="The tune over its chords">
        <p>
          When both hands play, they are rarely equal. One voice carries the tune and the others
          accompany it, so the tune should sound above them: its notes played a little louder than
          the chords struck with them, even under the same dynamic. This is called{' '}
          <strong>balance</strong>. The tune is usually the top note of the right hand, and the left
          hand plays more softly.
        </p>
        <Plate caption="The Ode to Joy over its chords, three ways. Only the first sounds as it should: the tune clear, the chords under it.">
          <Balance
            staffLabel="The Ode to Joy on the grand staff, the tune in the treble over chords in the bass"
            labels={{ balanced: 'Tune on top', even: 'Level', under: 'Chords on top' }}
            readouts={{
              balanced: 'The tune louder than the chords: it sings over them.',
              even: 'Everything at one level: the tune is lost among the chords.',
              under: 'The chords louder than the tune: it is hard to follow.',
            }}
          />
        </Plate>
        <Aside title="One hand at a time">
          <p>
            Play the tune alone. Then the chords alone, at half the loudness. Then put them
            together, keeping the difference.
          </p>
        </Aside>
      </Section>

      <Section id="legato" title="Joined: legato">
        <p>
          <strong>Legato</strong> (Italian for “tied”) means each note joined to the next with no
          silence between them. On the piano the fingers do it: let go of each key just as the next
          goes down, like walking, one foot leaving the ground as the other lands.
        </p>
        <p>
          A <strong>slur</strong>, a curve over or under notes of different pitches, asks for them
          to be played legato. It also groups them into a phrase, as words make a sentence. At the
          end of a slur, lift the hand a little: its last note is a touch shorter, and the music
          breathes before the next phrase.
        </p>
        <p>
          Notes with no slur and no mark are held for most of their length. How closely they join
          depends on the music: in Bach they are often a little apart, <strong>non legato</strong>;
          in later music they are usually nearly joined.
        </p>
        <Plate caption="Listen to both, then play the nine notes yourself on your keyboard. Each bar below is a note, as long as you held it: a green dot joins two notes, red is a gap and amber an overlap, marked in milliseconds.">
          <Articulation
            touches={['legato', 'nonLegato']}
            labels={TOUCHES}
            staffLabel="Nine notes from C up to G and back, under two slurs or without them"
          />
        </Plate>
        <Aside title="Pedal off">
          <p>
            With the sustain pedal down, notes ring on whatever your fingers do. Practise legato
            without it: the fingers have to join the notes on their own.
          </p>
        </Aside>
      </Section>

      <Section id="staccato" title="Detached: staccato and tenuto">
        <p>
          A dot over or under a note means <strong>staccato</strong>, “detached”: play it short,
          about half its length or less, and let the key spring back up. The rest of its time is
          silence, but the dot is not a rest: the next note still comes on time.
        </p>
        <p>
          A short line means <strong>tenuto</strong>, “held”: give the note its whole length,
          sometimes with a little weight. It is the opposite of staccato.
        </p>
        <Plate caption="Staccato leaves wide gaps between the bars, tenuto almost none. Play both yourself and compare.">
          <Articulation
            touches={['staccato', 'tenuto']}
            labels={TOUCHES}
            staffLabel="Nine notes from C up to G and back, with dots or lines over them"
          />
        </Plate>
        <Aside title="Bounce, don’t snatch">
          <p>
            Play staccato with a light, quick bounce of the wrist or the fingertip, and keep the
            hand close to the keys. There is no need to pull it away.
          </p>
        </Aside>
      </Section>

      <Section id="crescendo" title="Try it: a crescendo">
        <p>
          Five notes, on any keys, each a little louder than the one before. This needs a keyboard
          that senses how hard you play; any difference counts, as long as each note is louder than
          the last, or the last clearly the loudest.
        </p>
        <Plate>
          <CrescendoExercise
            prompt="Play five notes, each louder than the last."
            skipTo="test-yourself"
            needsTouch="This one needs a MIDI keyboard that senses touch: the computer keyboard, a click or a tap always plays at one loudness. Skip it; the questions below finish the lesson."
            verdicts={{
              rising: 'A crescendo: every note louder than the one before.',
              overall:
                'A crescendo overall, though not every step: try to make each note a little louder.',
              even: 'All five came at the same loudness. Press each key a little faster than the last.',
              not: 'Not yet a crescendo: some notes came softer than the one before. Start softly and grow.',
            }}
          />
        </Plate>
      </Section>

      <Section id="test-yourself" title="Test yourself">
        <Plate>
          <ChoiceQuiz prompt="Read the marks." questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          Scales measures how evenly loud your notes are, with a MIDI keyboard; Pieces times every
          note of a piece in its rhythm mode. Listen to yourself while you play them: the dynamics
          and the touch are yours to add.
        </p>
      </Section>
    </>
  );
}

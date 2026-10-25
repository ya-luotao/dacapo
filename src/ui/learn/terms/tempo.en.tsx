import type { TempoName } from '../../../core/tempoNames.ts';
import { Articulation, DynamicLevels, Hairpins } from '../expressionFigures.tsx';
import { Plate } from '../kit.tsx';
import { FermataPhrase, TempoChange, TempoScale, type TempoChangeKind } from '../tempoFigures.tsx';
import type { TermTexts } from './index.ts';

const TOUCHES = {
  legato: {
    name: 'Legato',
    text: 'Each key let go as the next goes down; a breath where the first slur ends.',
  },
  nonLegato: { name: 'Non legato', text: 'Each note held most of its length, a little apart.' },
  staccato: { name: 'Staccato', text: 'Short: about half the note or less, then silence.' },
  tenuto: { name: 'Tenuto', text: 'Held for its whole length, with a little weight.' },
};

/** The tempo marks on the metronome's scale, one picked out. */
function Scale({ mark, caption }: { mark: TempoName; caption: string }) {
  return (
    <Plate caption={caption}>
      <TempoScale mark={mark} label="The tempo marks and their beats a minute on a metronome" />
    </Plate>
  );
}

function Change({ kind, caption }: { kind: TempoChangeKind; caption: string }) {
  return (
    <Plate caption={caption}>
      <TempoChange kind={kind} label="Beats on a line, as far apart as they are in time" />
    </Plate>
  );
}

const MARK_CAPTION =
  'Its place among the tempo marks. Press any mark to hear eight beats at its pace.';

const TEXTS: TermTexts = {
  tempo: () => (
    <>
      <p>
        The Italian word says how the music should feel as well as how fast it goes: allegro means
        cheerful before it means quick. A metronome mark fixes the speed; the word gives the
        character.
      </p>
      <p>
        Many pieces have only the word. Then the speed is yours to judge, and the fastest notes you
        have to play cleanly set the limit.
      </p>
      <Scale mark="andante" caption={MARK_CAPTION} />
    </>
  ),

  'metronome-mark': () => (
    <>
      <p>
        The note in the mark is the beat being counted. In 6/8, ♩. = 60 counts dotted quarters; in a
        slow 2/2, a half note = 60 counts half notes.
      </p>
      <p>
        M.M. stands for Maelzel’s Metronome, after the maker who patented it in 1815. Beethoven was
        one of the first composers to put metronome marks in his music.
      </p>
      <Scale
        mark="allegro"
        caption="♩ = 120 is where Allegro begins. Press any mark to hear its pace."
      />
    </>
  ),

  grave: () => (
    <>
      <p>
        Italian for heavy, serious. It is the slowest of the marks, and often stands over a slow,
        weighty introduction before a fast movement, as at the start of Beethoven’s Pathétique
        sonata.
      </p>
      <Scale mark="grave" caption={MARK_CAPTION} />
    </>
  ),

  largo: () => (
    <>
      <p>
        Italian for broad. It asks for a slow tempo and a full, spacious sound that never drags. The
        slow movement of Dvořák’s New World Symphony is a Largo.
      </p>
      <Scale mark="largo" caption={MARK_CAPTION} />
    </>
  ),

  larghetto: () => (
    <>
      <p>
        “A little broad”: the diminutive of largo. Still slow, but lighter and moving on a little
        more. The slow movement of Mozart’s Clarinet Quintet is a Larghetto.
      </p>
      <Scale mark="larghetto" caption={MARK_CAPTION} />
    </>
  ),

  adagio: () => (
    <>
      <p>
        From ad agio, “at ease”. So many slow movements are marked Adagio that the word is also a
        name for one: “the Adagio” of a sonata. The first movement of Beethoven’s Moonlight Sonata
        is Adagio sostenuto.
      </p>
      <Scale mark="adagio" caption={MARK_CAPTION} />
    </>
  ),

  andante: () => (
    <>
      <p>
        From andare, “to go”: a walking pace, unhurried but always moving on. The second movement of
        Haydn’s Surprise Symphony is an Andante.
      </p>
      <p>
        Andantino is usually taken a little faster than andante, though composers have not always
        agreed on that.
      </p>
      <Scale mark="andante" caption={MARK_CAPTION} />
    </>
  ),

  moderato: () => (
    <>
      <p>
        Moderate: neither slow nor fast. It often qualifies another word: allegro moderato is a
        moderate allegro, andante moderato a steady andante.
      </p>
      <Scale mark="moderato" caption={MARK_CAPTION} />
    </>
  ),

  allegro: () => (
    <>
      <p>
        Italian for cheerful, lively; in music it came to mean fast. Most first and last movements
        of sonatas are marked Allegro. Allegretto, “a little allegro”, is lighter and not as fast.
      </p>
      <Scale mark="allegro" caption={MARK_CAPTION} />
    </>
  ),

  presto: () => (
    <>
      <p>
        Italian for quick, ready. It is faster than allegro: the last movement of Beethoven’s
        Moonlight Sonata is Presto agitato.
      </p>
      <Scale mark="presto" caption={MARK_CAPTION} />
    </>
  ),

  prestissimo: () => (
    <>
      <p>
        The superlative of presto: as fast as the notes can still be played cleanly. It is rare, and
        usually kept for a short last section.
      </p>
      <Scale mark="prestissimo" caption={MARK_CAPTION} />
    </>
  ),

  ritardando: () => (
    <>
      <p>
        Ritardando and rallentando both slow down little by little, and most players treat them
        alike. Ritenuto (riten.) is different: held back at once.
      </p>
      <Change
        kind="rit"
        caption="Four steady beats, then a rit.: each gap a little longer than the last."
      />
    </>
  ),

  accelerando: () => (
    <>
      <p>
        Speed up evenly, a little more with each beat. Stringendo, “tightening”, also speeds up,
        usually as the tension rises.
      </p>
      <Change
        kind="accel"
        caption="Four steady beats, then an accel.: each gap a little shorter than the last."
      />
    </>
  ),

  'a-tempo': () => (
    <>
      <p>
        It cancels a rit., an accel. or a rubato: the beat goes back to the speed it had before.
        Tempo primo (Tempo I) goes back to the tempo the piece began in, after a section in another.
      </p>
      <Change kind="atempo" caption="Steady, a rit., then a tempo: the first pace again at once." />
    </>
  ),

  rubato: () => (
    <>
      <p>
        Italian for “robbed”. A note held a little longer takes its time from the notes around it,
        so the phrase stretches and then catches up. The left hand often keeps steadier time than
        the tune above it.
      </p>
      <p>
        It belongs above all to Romantic music, Chopin’s most of all. Too much of it and the beat is
        lost.
      </p>
    </>
  ),

  fermata: () => (
    <>
      <p>
        How long to hold is the player’s choice, often about twice the written length. Over a rest
        it is a silence held; on the last chord of a piece it lets the sound die away.
      </p>
      <Plate caption="A phrase that stops on G, heard with the fermata and without it.">
        <FermataPhrase
          label="C, B, A, then G under a fermata, and C"
          labels={{ held: 'With the fermata', plain: 'Without it' }}
        />
      </Plate>
    </>
  ),

  'dynamic-marks': () => (
    <>
      <p>
        The letters are Italian: p for piano, soft; f for forte, loud; m for mezzo, half. From soft
        to loud: pp, p, mp, mf, f, ff.
      </p>
      <p>
        They are relative. A forte in a lullaby is not a forte in a march, and every instrument and
        room sounds different.
      </p>
      <Plate caption="Choose a dynamic and listen to the same phrase played at it.">
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
    </>
  ),

  crescendo: () => (
    <>
      <p>
        Italian for “growing”. It starts from the dynamic before it and arrives at the one after it;
        when none follows, how far to go is yours to decide. Start soft enough to have room.
      </p>
      <Plate caption="The same swell written as hairpins and as words.">
        <Hairpins
          staffLabel="Nine notes up to G and back, with a crescendo and a diminuendo under them"
          labels={{ hairpins: 'Hairpins', words: 'Words' }}
        />
      </Plate>
    </>
  ),

  diminuendo: () => (
    <>
      <p>
        Italian for “lessening”; decrescendo means the same. A long one, spread over several bars,
        often closes a phrase or a piece.
      </p>
      <Plate caption="The same swell written as hairpins and as words.">
        <Hairpins
          staffLabel="Nine notes up to G and back, with a crescendo and a diminuendo under them"
          labels={{ hairpins: 'Hairpins', words: 'Words' }}
        />
      </Plate>
    </>
  ),

  legato: () => (
    <>
      <p>
        Italian for “tied”. Each key comes up just as the next goes down, so the sound never stops
        between the notes. Where a slur ends, the hand takes a small breath.
      </p>
      <Plate caption="The same line legato and non legato. Play it yourself, and the timeline shows how you joined the notes.">
        <Articulation
          touches={['legato', 'nonLegato']}
          labels={TOUCHES}
          staffLabel="Nine notes from C up to G and back, under two slurs or without them"
        />
      </Plate>
    </>
  ),

  staccato: () => (
    <>
      <p>
        Italian for “detached”. The dot shortens the sound and leaves the beat alone: the next note
        still comes in on time, after a silence. A wedge, staccatissimo, is shorter still.
      </p>
      <Plate caption="The same line staccato and tenuto. Play it yourself, and the timeline shows how long you held each note.">
        <Articulation
          touches={['staccato', 'tenuto']}
          labels={TOUCHES}
          staffLabel="Nine notes from C up to G and back, with dots or lines over them"
        />
      </Plate>
    </>
  ),

  dolce: () => (
    <p>
      Italian for “sweet”. It is about the colour of the sound as much as its loudness: soft, with a
      gentle touch and no hard edges. It often stands at the start of a tune, beside a p.
    </p>
  ),

  cantabile: () => (
    <p>
      Italian for “singable”. Make the tune sing over what is under it: join its notes, shape it as
      a singer would breathe, and keep the accompanying hand lighter. Chopin told his pupils to go
      and hear great singers to learn it.
    </p>
  ),

  espressivo: () => (
    <p>
      It asks for more of what the phrase already has: more rise and fall in loudness, a little more
      time where the music leans. It often marks a single phrase, a solo line, or a tune when it
      comes back.
    </p>
  ),

  modifiers: () => (
    <>
      <p>
        They stand before or after the word they change, and can be put together: poco più mosso, a
        little faster.
      </p>
      <Plate>
        <table className="term-table">
          <thead>
            <tr>
              <th scope="col">Word</th>
              <th scope="col">Meaning</th>
              <th scope="col">For example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">molto</th>
              <td>very, much</td>
              <td>molto rit.: slowing a lot</td>
            </tr>
            <tr>
              <th scope="row">poco</th>
              <td>a little</td>
              <td>poco cresc.: a little louder</td>
            </tr>
            <tr>
              <th scope="row">poco a poco</th>
              <td>little by little</td>
              <td>poco a poco accel.: faster by degrees</td>
            </tr>
            <tr>
              <th scope="row">più</th>
              <td>more</td>
              <td>più mosso: with more motion, faster</td>
            </tr>
            <tr>
              <th scope="row">meno</th>
              <td>less</td>
              <td>meno mosso: with less motion, slower</td>
            </tr>
            <tr>
              <th scope="row">sempre</th>
              <td>always, still</td>
              <td>sempre legato: legato throughout</td>
            </tr>
            <tr>
              <th scope="row">subito</th>
              <td>suddenly</td>
              <td>subito p: soft at once</td>
            </tr>
            <tr>
              <th scope="row">non troppo</th>
              <td>not too much</td>
              <td>allegro ma non troppo: fast, but not too fast</td>
            </tr>
          </tbody>
        </table>
      </Plate>
    </>
  ),
};

export default TEXTS;

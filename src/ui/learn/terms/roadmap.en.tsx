import { Plate } from '../kit.tsx';
import { ROADMAPS } from '../roadmapExamples.ts';
import { Barlines, Ottava, RoadMap } from '../roadmapFigures.tsx';
import type { TermTexts } from './index.ts';

const PLAYED = 'Played:';
const LISTEN =
  'Each bar sounds one note when played, so a jump back is heard as the same notes again.';

const TEXTS: TermTexts = {
  barline: () => (
    <>
      <p>
        Barlines group the beats: in 4/4 each bar holds four, and the first beat after a barline is
        the strongest. A sharp or a flat written in a bar lasts until the next barline.
      </p>
      <p>
        A double barline ends a section, often where the key or the time signature changes. A thin
        line and a thick one end the piece. Put two dots before them and the music goes back: that
        is a repeat sign.
      </p>
      <Plate caption="The four barlines, left to right.">
        <Barlines
          label="Four bars ending with a barline, a double barline, an end repeat and a final barline"
          names={['barline', 'double', 'repeat', 'final']}
        />
      </Plate>
    </>
  ),

  'repeat-sign': () => (
    <>
      <p>
        The sign with its dots after the lines opens the passage; the one with its dots before the
        lines closes it. Play to the closing sign, go back to the opening one, and the second time
        play on past it.
      </p>
      <p>
        When there is no opening sign, go back to the beginning. Unless the score says otherwise,
        the passage is played twice in all.
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.repeat}
          label="Five bars, bars 2 to 4 between repeat signs"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'first-and-second-endings': () => (
    <>
      <p>
        The bars before the brackets are the same both times; only the ending changes. The first
        ending usually leads back to the start of the repeat, and the second leads on, or ends the
        piece.
      </p>
      <p>
        A bracket marked 1. 2. is played both times. A third ending, 3., belongs to a passage played
        three times.
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.endings}
          label="Bars 1 to 3 repeated, bar 3 the first ending and bar 4 the second"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'da-capo': () => (
    <>
      <p>
        The capo is the head: D.C. sends you back to the first bar. On its own it means play the
        piece again to the end. dacapo is named after it.
      </p>
      <p>
        After the jump, repeats are usually played only once and only the last ending is taken. A
        minuet and trio is played this way: the trio ends with “Minuet D.C.”, and the minuet comes
        back without its repeats.
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.daCapo}
          label="Four bars, Fine at the end of bar 2 and D.C. al Fine at the end of bar 4"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'dal-segno': () => (
    <>
      <p>
        The segno is written over the bar the return starts from, often after an introduction that
        is not played again. D.S. al Fine then plays to the word Fine; D.S. al Coda to “To Coda”,
        and from there to the coda.
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.dalSegno}
          label="Four bars, the segno over bar 2, Fine at the end of bar 3 and D.S. al Fine at the end of bar 4"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  fine: () => (
    <>
      <p>
        The first time through, Fine is passed by. It counts only after the D.C. or D.S. that sends
        you back, and often stands at the end of a repeat, which after the jump is played once.
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.fine}
          label="Bars 1 and 2 repeated with Fine at the end of bar 2, then bars 3 and 4 and D.C. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  coda: () => (
    <>
      <p>
        Coda is Italian for tail. Its sign comes in pairs: one, with the words To Coda, marks where
        to leave the music once you have jumped back; the other, over the closing passage, marks
        where to land. The bars between are skipped, however many there are.
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.coda}
          label="Six bars: the segno over bar 2, To Coda at the end of bar 3, D.S. al Coda at the end of bar 4, and the coda from bar 5"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  ottava: () => (
    <>
      <p>
        Notes far above the staff need many ledger lines and are slow to read. Under an 8va line
        they are written an octave lower, where the eye knows them; where the line ends, or at the
        word loco, they are played as written again.
      </p>
      <p>
        8vb, or 8va under the notes, means an octave lower. Col 8va asks for octaves: each note
        played together with the one an octave above.
      </p>
      <Plate caption="The same three notes, written under an 8va line and written where they sound.">
        <Ottava
          label="C5, D5 and E5 under an 8va line, then C6, D6 and E6 as they sound"
          written="written"
          played="played"
        />
      </Plate>
    </>
  ),
};

export default TEXTS;

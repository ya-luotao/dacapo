# dacapo — Expression specification

Status: planned (after [READING.md](READING.md)). This extends [MVP.md](MVP.md) and
[PIECES.md](PIECES.md); their principles and fixed decisions still apply (staff first, measure don't
guess, local data, English of record, every UI language, 3-day dependency cooldown, no backend).

Goal: a piece is judged today on its keys and its timing. A MIDI keyboard also reports how hard each
key is struck, when it is let go and what the pedals do, which is most of what a teacher listens for
after the notes: **dynamics** and the **balance** of melody over accompaniment, **articulation**
(legato, staccato, notes held their length), the **pedal**, and **ornaments**. Measure them, against
the score's markings where it has them, and show where a piece loses them.

What a MIDI keyboard cannot report stays out: tone, the arm and wrist, the sound in the room. The
lesson "Practising well" (LEARN.md) says so.

## The score's markings (`core/musicxml.ts`, `core/score.ts`)

The parser keeps, in performance ticks and by staff:

- **Dynamics** (`<dynamics>`: `ppp`…`fff`, `fp`, `sf`, `sfz`, `sfp`, `rf`, `rfz`, `fz`) at a
  position; **hairpins** (`<wedge>` crescendo / diminuendo / stop) and the words _cresc._,
  _dim._, _decresc._ (`<words>`, a dashed span to the next dynamic when it has no end) as spans.
- **Articulations** on a note (`<staccato>`, `<staccatissimo>`, `<spiccato>`, `<tenuto>`,
  `<detached-legato>`, `<accent>`, `<strong-accent>`) and **slurs** (`<slur>`, by number, per
  voice; a tie is not a slur); **fermatas**.
- **Pedal** (`<pedal>` start / stop / change / continue, `line` or sign; `sostenuto` kept apart);
  _una corda_ / _tre corde_ words.
- **Ornaments** (`<trill-mark>` with or without `<wavy-line>`, `<mordent>`, `<inverted-mordent>`,
  `<turn>`, `<inverted-turn>`, accidentals on them) on a note, and **grace notes** (`<grace>`, with
  `slash` for an acciaccatura) attached to the next principal note of their voice. Grace notes and
  ornaments are no longer left out with a warning (the warnings go); D.C./D.S. still are.

Verovio already draws all of these from the file. The score's checksum does not change, since it
covers the file.

**The library.** Most of our encodings leave these markings out. Each piece gains its source
edition's dynamics, hairpins, slurs, articulations, pedal marks and ornaments (the token lists in
`scripts/pieces/sources/` grow the syntax for them), proofread against the edition like its notes.
Nothing the edition does not print is added.

## Takes: what was played, kept (`takes` store)

Every run (wait and rhythm mode) keeps its raw performance, the source every expression figure is
recomputed from, and what "Play back your run" (PIECES.md) plays:

- **A take**: the run's session id, the piece and checksum, the tempo, and the events in the order
  they happened, times in ms from the run's start: note-on (key, velocity), note-off (key), pedal
  (controller 64, 66 or 67, value 0–127). Each note-on also names the score note it was matched
  to (step and key), or none (an extra).
- Stored compactly (one array of integers per event), and in **chunks** of at most 2,000 events,
  one record each, so a record stays well under sync's 64 KB. Takes sync as the collection `takes`
  (added when the id is not stored, never changed); the export includes them (next version).
- A take is written as the run goes (a chunk when it fills, the rest when the run ends), like the
  step records.

## Loudness is relative

Velocity curves differ between instruments and settings, so nothing is judged on an absolute
velocity. A run's **range** is its velocities' 5th to 95th percentile; every threshold below is a
fraction of that range (at least a floor in velocity units), and a comparison is between passages
or notes of the same run. The fractions are provisional (as S1's are) until runs recorded on real
instruments set them: they sit in `core/expression.ts` with an `ANALYSIS_VERSION`, and the Pieces
page has the development-only "Save this run" button that Scales has.

## Dynamics and balance (X1)

- **Loudness curve.** Per hand, the median velocity per beat, drawn under the bar numbers with the
  score's dynamics and hairpins above it.
- **Against the markings.** Between two passages marked with different levels (at least two beats
  each), the louder marking should be played louder by at least `DYNAMIC_STEP` (0.12 of the range,
  at least 4) per level of difference, `p` to `f` being three. Over a hairpin (at least two beats),
  the fitted slope of the velocities should rise (or fall) by at least one `DYNAMIC_STEP` over its
  span. An **accent**, `sf`, `fz` or `rf` note should stand above its neighbours' median by
  `ACCENT_STEP` (0.18 of the range, at least 8). Each marking is right, too little (the arrow says
  which way) or not played (the wrong way round).
- **Balance.** Where both hands play at once, the melody should sound over the accompaniment: its
  note at least `BALANCE_STEP` (0.08 of the range, at least 3) above the median of the other notes
  struck with it (within 30 ms). The melody is the top note of the right hand by default; a piece
  setting chooses the right hand, the left hand, or the top note of both. Shown per bar: balanced,
  equal, or the accompaniment on top.
- Without dynamics in the score, the curve and the balance are shown, and nothing else is judged.

## Articulation (X2)

- **Held length.** Each note's held time against its written length at the tempo played (rhythm
  mode; in wait mode against the time to the next step's first key). The sustain pedal hides a
  release, so a note released while the pedal is down is not judged.
- **Legato** under a slur: each note's release within `LEGATO_GAP_MS` (20 ms) before, or at most
  `LEGATO_OVERLAP_MS` (80 ms) after, the next note of the slur's voice starts. A gap is "broken", a
  longer overlap is "smudged". The last note of a slur may be shorter.
- **Staccato** (and staccatissimo, spiccato): held at most half its written length (a third for
  staccatissimo). **Tenuto**: at least 0.9 of it. **Plain notes**: "cut short" below 0.7 of their
  length when the next note of the voice is not a rest (a phrase end or a rest may breathe).
- Per bar: the share of notes articulated as written; the bars that lose it, with what went wrong.

## Pedal (X3)

- **What is drawn.** The sustain pedal played, as a line under the score's bars (down, up, half:
  64 and over is down, as MIDI has it; the raw values are kept), with the marks above it.
- **Against the marks.** Down through a marked span. At a marked change: the pedal goes up **after**
  the new note is struck, within `CHANGE_MAX_MS` (250 ms), and down again within `RELEASE_MAX_MS`
  (400 ms) of going up (legato, or syncopated, pedalling). Up before the note: a **gap** in the sound
  (unless the hand holds the notes over). Up too late, or not at all: a **blur**, the old harmony
  ringing over the new one, measured in ms.
- Without pedal marks, the line is drawn and nothing is judged.
- _Una corda_ (67) and sostenuto (66) are drawn when used and checked only against their words.

## Ornaments and grace notes (X4)

- **Realising them** (the demo, the other hand, "Listen"): an acciaccatura just before the beat
  (1/32 of a whole note, at most 80 ms); an appoggiatura on the beat, taking half the principal's
  length (two thirds of a dotted one); a mordent principal–lower–principal and an inverted mordent
  principal–upper–principal, in 32nds (at most 70 ms each) on the beat; a turn upper–principal–
  lower–principal; a trill alternating principal and the upper note of the key (or the accidental
  shown) in 32nds, starting on the principal (a piece setting starts it on the upper note, as in
  Baroque music), with a closing turn when written.
- **Playing them.** In wait mode, the step waits for the principal: the ornament's other notes, in
  any order, count as neither right nor wrong, and the summary says whether it was played. In
  rhythm mode, the principal's timing is judged at its written onset (an appoggiatura's at its
  delayed onset), and notes of the ornament's pitches within its span are not extras.
- The practice keyboard shows an ornament's notes in a lighter mark while the "Show keys" hint is
  on.

## UI

- The Pieces summary gains **Expression**, with a tab per aspect measured on the run: Dynamics,
  Articulation, Pedal. Each shows its line under the bar numbers, the figures, and "bars to look
  at" (the worst three), each of which can be looped as the weakest bars are today.
- Per piece: the melody's hand, the trill start; per browser: which aspects are judged (all on).
- Colour is never the only sign: every judged marking says right, too little, too much or missed
  in words, and the charts have a table view.

## Clarifications (decided during X0)

- **The model.** Articulations, ornaments and grace notes stay on their note (`ScoreNote`
  `articulations`, `ornaments`, `graces`, absent when there are none); dynamics, hairpins, pedal
  marks, slurs (by note ids) and fermatas are in `Score.markings` (`core/markings.ts`), with their
  part and staff, in written ticks like note onsets. `performedMarks` and `performedSpans` lay them
  out in performance ticks through the repeats; a hairpin whose written end is not reached before
  the play order jumps (a repeat, a skipped first ending) ends where it jumps. The checksum covers
  the notes only, so every record made before stays valid, and grace notes are no step in wait or
  rhythm mode until X4.
- **Grace notes** lead to the next note of their voice in the part, across barlines and over rests;
  a grace chord (`<chord/>` on grace notes) is struck at once. Grace notes after the last note of
  their voice lead to nothing and are dropped.
- **Ornament neighbours** are the next letter up and down from the note, altered as the bar's
  earlier notes on that staff and octave alter it, else as the key signature does; an
  `<accidental-mark>` in the same `<ornaments>` wins (above: the upper note, below: the lower;
  without a placement the upper one, but the lower one under a mordent). A long mordent
  (`long="yes"`) alternates twice. `delayed-turn` and `delayed-inverted-turn` are read too; other
  ornaments (a shake, a schleifer, a tremolo) sound as their note, as before, without a warning.
- **Words.** _cresc._ and _dim._ (also _decresc._, _diminuendo_, anywhere in the text: "poco a poco
  cresc.") start a span to their `<dashes>` stop, from the same direction or one at the same place
  right after it; without one, to the next dynamic of the part on the same staff, else on any
  staff, else to the end. _Una corda_ (_u.c._) and _tre corde_ (_tutte le corde_, _t.c._) are the
  left pedal's start and stop.
- **Pedal.** `start` and `resume` put the sustain pedal down, `sostenuto` the middle one; `stop` and
  `discontinue` lift the sostenuto only when it is down under that `number` and the sustain is not,
  otherwise the sustain. `change` and `continue` are kept as marked.
- **Realising them.** Timed on the tempo there (a thirty-second is an eighth of a quarter at that
  point of the timeline, at the demo's tempo), as "Ornaments and grace notes" says. Decided too: a
  group of two or more grace notes is played before the beat like acciaccaturas, a thirty-second
  (at most 80 ms) each, even unslashed (the appoggiatura is a single unslashed grace note or chord);
  mordents and turns use at most a third (a quarter, a fifth) of a short note per short note, so the
  principal always sounds last; a trill too short for three thirty-seconds is an inverted mordent,
  and a turn written with a trill closes it (lower–principal). **Nothing sounds before the start of
  what is played**: a grace note that would come before the demo's first bar, or (in wait mode's
  other hand) before the step it belongs to has been completed, starts there and its note comes
  after it. A grace note or ornament on a tied continuation is not realised (the tie's first note
  carries it). The trill starts on the principal; `realise` takes a `trillStart` for X4's
  per-piece setting. The velocity stays the demo's: dynamics do not change how it plays.
- **Import report.** `grace-notes` and `ornaments` are no longer reported. Pieces imported before
  keep them in their stored warnings (so their synced copies stay the same) and they are not shown.

## Milestones

1. **X0 Markings and takes** — markings in the parser and score, grace notes and ornaments
   realised in playback, the `takes` store (synced, exported), the library's markings.
2. **X1 Dynamics and balance** — curve, markings, balance, the Expression panel.
3. **X2 Articulation** — held lengths, slurs, staccato, tenuto.
4. **X3 Pedal** — the pedal line, changes, gaps and blurs.
5. **X4 Ornaments** — accepted in wait and rhythm mode, the keyboard hint.

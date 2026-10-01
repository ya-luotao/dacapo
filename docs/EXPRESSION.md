# dacapo — Expression specification

Status: X0 is built (the markings, their sound in playback, takes, the library's markings), X1
(dynamics and balance, the Expression panel, a piece's past runs), X2 (articulation), X3 (the
pedal) and X4 (ornaments played in wait and rhythm mode). This extends [MVP.md](MVP.md) and
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
  one record each, so a record stays well under sync's 64 KB. (An improvisation over a backing on
  the Harmony page keeps its take in the same store, under its session: HARMONY.md, "Clarifications
  (decided during H6)".) Takes sync as the collection `takes`
  (added when the id is not stored, never changed); the export includes them (format 8).
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
  Articulation, Pedal, Ornaments. Each shows its line under the bar numbers, the figures, and "bars to look
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
  otherwise the sustain. `change` and `continue` are kept as marked, and a `stop` followed by a
  `start` of the same pedal at one place is a `change` too (a bracket line with a notch is often
  written so).
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
- **A take's events** are arrays of integers: `[ms, 1, key, velocity, step]` a key down,
  `[ms, 0, key]` a key up, `[ms, 64 | 66 | 67, value]` a pedal. The step is an index into the run's
  steps (for its hands and repeats, which the take keeps with its piece, checksum, tempo and mode);
  the key it was matched to is the event's own, since a key only matches its own pitch. A key
  pressed again on the step it belongs to still names it; a wrong key, an extra one, and one in
  the count-in or before the first window name −1. Times are rounded to whole ms.
- **Time 0** is the run's first key in wait mode, and the start of the span (the first bar's
  downbeat on the run's clock) in rhythm mode, so the count-in's keys are negative and a key's
  time minus its step's due time is its deviation; the take keeps the `latency` the run was timed
  with and its times stay raw. `startedAt` is time 0 in epoch ms. A pedal already down when the
  take starts is written at 0.
- **Written as the run goes**: a chunk (`sessionId:take:000`, `:001`, …) as soon as 2,000 events
  wait, the rest once the run is over _and_ the keys held then are let go (so the last releases
  are in it; keys pressed after the end are not), or when the run is replaced (a restart, other
  hands, bars, mode) or the page is left. Nothing is written before the run's first step, so a
  take never outlives a run that left no session; a tab closed mid-run keeps only the chunks
  already written. Keys played while the demo plays are no part of the run, nor of its take.
- **Pedals.** The keyboard's raw positions of CC 64, 66 and 67 reach the take through the input
  hub, which passes each position on once, whatever port sends it (the sustain pedal's down and up
  for sounding stays as it was). The Apple app's MIDI bridge already forwarded every controller.
  Takes of a piece go with its step records: `deletePiece` with its records deletes them, and so
  does a pulled deletion `withSteps`. IndexedDB version 7 adds the `takes` store (by piece, by
  session), never read at startup; `SYNC_SCHEMA` 5 makes a build that learns them pull everything
  again once.
- **The library's markings** are read from the same Mutopia LilyPond file as the notes (named in
  each source's comment), and checked against its PDF: the Musette, Für Elise, La Candeur, Old
  French Song, Morning Prayer, the Prelude in C minor and the Gymnopédie gained what their editions
  print. The Minuets in G and G minor print only the ornaments and the grace note they had; the
  Ode to Joy is our own arrangement; the three PDMX files keep what they had (the Arabesque's
  dynamics, hairpins, slurs and staccatos, the Soldiers' March's dynamics; the Prelude in C has
  none). **Chopin's pedal** is a bracket line, as the edition draws it, each change written as
  the line's end and a new start on the beat (the generator's `pedal_lines`). Verovio 6.3 draws a
  line's MusicXML `change` wrongly (it drops the spans after the first); with Ped. and ✱ signs the
  five signs of bars 1–2 ran into one another at every size, and `pedalStyle: altpedstar` spaced
  them only a little while turning every imported piece's bracket lines into signs, so no Verovio
  option is set: the brackets read cleanly from 375 px to focus mode's largest staff and nothing
  else changes. Other drawings differ from the page and mean the same: phrasing slurs are slurs; a slur the LilyPond file ends on a rest (Morning Prayer, bar 22) ends
  on the note before it, where the printed one ends; a slur printed twice on a chord (above and
  below) is one. What a LilyPond file hides or does not print (an mp in Morning Prayer, a
  crescendo on an inner chord note in La Candeur) is left out. A hairpin that ends on a downbeat
  is written to end at the barline before it (the same moment), as an engraver ends it: otherwise
  Verovio draws a stray piece of it at the start of the next system when a line breaks there.
  `library.test.ts` locks every piece's markings, counted, beside its notes.
- **Import report.** `grace-notes` and `ornaments` are no longer reported. Pieces imported before
  keep them in their stored warnings (so their synced copies stay the same) and they are not shown.

## Clarifications (decided during X1)

- **Reading the take.** Each key down that names a step is matched to the note of that step with
  its key; wrong and extra keys are left out. A key struck again on its step before the step was
  complete (wait mode) counts once, as its last stroke. A key up ends the key's last stroke, and a
  second key down with no key up between ends the first there. The sustain pedal is down from 64
  (as MIDI has it) and a note is "held by the pedal" when it was down at its key up, in the order
  the take has them. The rounds of a loop: in wait mode a step earlier than the one before starts a
  new round; in rhythm mode a key goes to the round whose due time (the take's time less the
  latency) is nearest.
- **Velocity measured**, as Scales decides it: some key down has a velocity different from the
  others. Without it (the computer keyboard, the on-screen keys, a fixed touch) the Dynamics tab
  says so and shows and judges nothing on loudness.
- **The range** is P5–P95 of the velocities of the run's notes of the score (wrong and extra keys
  left out). The steps (`DYNAMIC_STEP`, `ACCENT_STEP`, `BALANCE_STEP`) are its shares, at least
  their floors, as specified. Everything is judged only within what the run played: from its first
  note of the score to its last, so a rhythm run stopped early is not judged on what was never
  reached. The panel tells apart a stretch the score marks nothing in (only the curve and the
  balance), one that keeps a single level with no hairpin or accent (nothing to judge: the
  Soldiers' March's repeated `f`), and markings too short or too little played to judge.
- **The curve's beats** are the click's (the dotted beat in 6/8, 9/8, 12/8), each hand's median of
  the notes begun in the beat, over the bars from the run's first note to its last, round after
  round; a beat without a note is a gap. The dynamics, hairpins (a wedge, or _cresc._ and _dim._
  with their dashes) and accents are drawn above the bar numbers; a dynamic that would run into
  the one before is left out of the drawing only.
- **Levels.** A dynamic applies to its whole part, whichever staff it is written on (piano
  editions print one between the staves). The same level written again, or on both staves at one
  place, is no change; `fp`, `sfp`, `sfzp` and `sfpp` accent their note and leave `p` (`pp`) in
  force. A passage's loudness is the median velocity of its notes, both hands, without the notes
  under a hairpin and the accented ones (a passage marked `p` that grows into `f` is not a soft
  passage). Both passages need two beats and three written notes, else the change is not judged;
  with fewer than three notes played either side it is **missed**. The change is heard across the
  mark: its bars are the bar before a mark on a barline and the mark's bar.
- **The wrong way round** is a change the other way of at least a whole step
  (`WRONG_WAY_SHARE`); less, or none, is **too little**.
- **Too much.** A change of level is too much when it takes more of the run's range than its share
  of the levels marked in what was played plus `TOO_MUCH_SHARE` (0.3): mp to mf in a piece marked
  from p to f (a third of its levels) is too much from 0.63 of the range. The widest contrast
  marked is never too much, since the range is the run's own; nor are hairpins and accents (an
  accent's height has no upper bound the run can set).
- **Hairpins** are judged on the hand of the staff they are written on (Morning Prayer's
  diminuendo in bar 17 is the left hand's), and not when that hand is not practised. The line is a
  Theil–Sen fit through the loudest note of each of that hand's steps (a chord's melody) from the
  hairpin's start to its end, the arrival included, accented steps left out, every round
  together; its rise is the slope times the hairpin's length. A hairpin needs two beats and three
  steps of its hand, all within what the run played. The same hairpin on two staves of one hand is
  one.
- **Accents.** `accent` and `strong-accent` are on their note, and accent its hand's chord there;
  `sf`, `sfz`, `sffz`, `fz`, `rf`, `rfz` (and the `fp` family) the chord of their staff's hand at
  that place, else of the other hand of the part struck there. The chord's loudest note (an accent
  on an inner note lifts the chord as heard) is compared with the median of the loudest note of up
  to three steps of the same hand on each side that carry no accent; over the rounds of a loop,
  the median. Not above the neighbours it is **not accented**; an accented chord not played is
  **missed**.
- **Balance.** At each step (per round) where the melody's hand plays, the melody is its top note
  (or the top of all the notes, "top of both hands"); the notes struck with it are every other
  note within 30 ms, which must include one of the other hand, so the balance is measured with
  both hands only. Per bar, the median of melody − median(the others): balanced (at least a
  `BALANCE_STEP`), equal, or the accompaniment on top. The figure "Melody on top" is the share of
  those places balanced. The melody's hand is kept with the piece's other preferences in this
  browser (`melody` in `dacapo.pieces.byPiece`) and chosen in the Dynamics tab.
- **Bars to look at**: every judged marking not right (the wrong way round 3, too little, too much
  and missed 2) and every bar where the accompaniment is on top (2) or equally loud (1), summed
  per place; a place is a marking's bars or a bar of the balance. The three heaviest, then in the
  order of the score, each with what went wrong there and a button that loops those written bars
  (as "Loop the weakest bars" does).
- **Where a marking is** reads as its bars, with the beat when it starts inside a bar
  ("bar 13, beat 3") and "(repeat)" on a repeat's later passes.
- **The panel** closes both summaries, below their own figures; its tabs are an ARIA tab list
  (arrow keys, Home, End). Its table view lists the judged markings with their change and the
  least change needed in velocity units, and every bar played with each hand's median and the
  balance.
- **Past runs.** Options has **Your runs**, a sheet over the score listing the piece's runs, most
  recent first (when, mode, hands, bars, tempo, time), ten at a time. Each row's actions are
  open-ended (P5's Play back joins Expression there). Opening one reads its take then (by session)
  and computes its expression with the hands, repeats, loop and tempo of its session and the
  latency of its take; the start bar is not needed, since time 0 is the span's start. A run from
  before takes, or of another version of the notes (the take's checksum), says so.
- **Development export.** In a development build the panel ends with "Save this run
  (development)", which downloads the run's take with a reference to its score (piece id and
  checksum, title), its settings (mode, hands, repeats, loop, tempo, latency, start), the MIDI
  inputs connected and `ANALYSIS_VERSION`, as `piece-take-<piece>-<start>.json`.
- **Thresholds are provisional**: the shares above wait for runs recorded on real instruments (the
  MP11SE first), as S1's do.

## Clarifications (decided during X2)

- **Which touch a note has.** Staccato, staccatissimo and spiccato (spiccato as staccato), then
  tenuto, then a slur, then none. A note marked with both a tenuto and a staccato, or
  `detached-legato` (portato), is not judged; a staccato under a slur is judged as staccato. Every
  note of a chord is judged on its own.
- **Slurs.** A slur holds the struck notes of its voice (part, staff, voice) from its first note's
  onset to before its last's; each is joined to the voice's next struck note (a chord: its first
  key), played on a later step of the same round. The slur's last notes are not judged (they may
  be shorter), unless they carry a staccato or a tenuto. Not judged either: a pair whose next note
  has the same key (it has to be struck again), a next note not played, and a join a loop's end
  cuts. The join is the next note's key down less this key's up: over 20 ms **broken**, below
  −80 ms **smudged**.
- **Written lengths.** A note's length includes the notes tied to it (same part, staff and key,
  each starting where the one before ends). In rhythm mode it is taken at the tempo the run was
  started with (the click's), not the player's own drift. In wait mode it runs until the run
  reached the note's written end: the first key of the step there, or, between two steps, the time
  shared out by their ticks; a note whose end comes after the round's last step played is not
  judged. The shares against it are as specified: staccato at most ½ (else **held too long**),
  staccatissimo ⅓, tenuto at least 0.9 (else **not held**), a plain note at least 0.7 (else **cut
  short**).
- **A plain note may breathe** (it is not judged) when its voice has no next note, rests before
  it (the next struck note starts after this one's written end), a fermata is on it, or it is on
  the run's last step.
- **The pedal.** A note whose key comes up while CC 64 is at 64 or over is not judged, and counted
  ("under the pedal"): the pedal hides its release.
- **Per bar**: each bar played (and round) has its share of the notes judged that were right, and
  its counts of each fault. The bars to look at add up the faults per written bar, passes and rounds
  together, so looping it covers them all; each lists what went wrong ("Legato (under a slur):
  broken, 2 notes").
- **No velocity needed.** Articulation is judged from key downs and ups alone, so it works with the
  computer keyboard too; the chart draws the slurs, staccato dots and tenuto lines over the bars.
- **Aspects.** Options has "Judge dynamics" and "Judge articulation", kept in this browser (the
  aspects turned off, `dacapo.expression.off`, so an aspect added later starts on). An aspect off
  has no tab; with none on, the summary has no Expression panel and "Your runs" offers no
  expression.
- **The lessons agree**: `LEGATO_GAP_MS` and `LEGATO_OVERLAP_MS` live in `core/expression.ts` and
  the lesson on touch (`ui/learn/expression.ts`) takes them from there.

## Clarifications (decided during X3)

- **The pedal line** is the take's CC 64 as played, raw (0–127), down from 64 (`PEDAL_DOWN`); a
  half pedal is drawn and counts as up. Placed in the score by the run's own times: in rhythm
  mode by its clock (the latency added back, since a take's times are raw), in wait mode by each
  step's first key per round, a moment between two steps shared out by their ticks (`runTimes`).
- **No pedal in the take**: a take without any CC 64 event (none connected, or never touched)
  draws nothing and judges nothing, and the tab says so, as Dynamics does without velocities; a
  pedal that moved but never went down is used, and its marks are missed. The same holds for una
  corda (CC 67) and the sostenuto (CC 66) on their own.
- **Where a mark is heard.** Sustain marks of the parts practised, through the repeats; a mark is
  judged at the first key of the run's step at or after it (not after the next mark), in its round:
  a mark whose note the run did not play (a note missed in rhythm mode, a mark on the other hand's
  note with nothing of the practised hand before the next mark) is drawn, not judged. A stop and a
  start heard on the same note are one change there (Für Elise's ✱ just before the bar line and
  its Ped. on the downbeat).
- **The rules, in the order the marks are struck** (`n` the note, the next mark's note or the end
  of the take the bound; the pedal's state carries over from one round of a loop to the next):
  - **Start**: down at `n` already, or within `RELEASE_MAX_MS` after it: clean. Later: clean when a
    key sounded all along, else a gap (the longest silence from `n` to the pedal going down). Not
    down before the next mark: missed.
  - **Change**: down at `n`, it must come up within `CHANGE_MAX_MS` after it (later, or not before
    the next mark: a blur, from `n` to the lift or the next mark's note) and go down again within
    `RELEASE_MAX_MS` of coming up (later: clean if a key sounded all along, else a gap; not again
    before the next mark: missed). Already up at `n` since a lift before it: a gap when nothing
    sounded for longer than `PEDAL_GAP_MS` (20 ms, legato's own gap) between the lift and the note,
    measured as that silence; when the hand held the notes over, it counts from the note like a
    start. Not down since the last mark at all: judged like a start.
  - **Stop**: up within `CHANGE_MAX_MS` after `n`, else a blur to the lift (or the next mark, or
    the end of the take); lifted before `n`, a gap where the sound broke, else clean; not down at
    all since its span began (its start was missed), not judged.
  - **A lift inside a span** (a start or change to the next mark) that is pressed again before the
    next note is a **lift** judgement where it happened, a gap, only when the sound broke; placed
    to the nearest sixteenth.
- **Una corda and sostenuto** are judged per span of their marks (start to the next stop, or the
  round's end), from the start's note to the stop's: down at least `CORDA_HELD` (0.9) of it held,
  some of it partly, none missed. Una corda used where nothing marks it is not judged.
- **Figures**: the marks clean of those judged, the gaps and blurs, and the share of the run's
  time (its first key to its last release) with the pedal down; per bar, the share down and the
  marks' verdicts. Bars to look at: each gap, blur or missed mark 2, una corda partly 1, missed 2.
- **The chart** draws the marks as the edition's bracket line (a hook down at a start, a notch at
  a change, a hook up at a stop) above the bar numbers, each judged mark's sign above it: a tick
  clean, two bars a gap, a wave a blur, a cross missed, named in the legend; the sostenuto and una
  corda get lanes of their own when used.
- **Long lists.** A full run of Für Elise judges 34 pedal marks. In the Pedal tab, and among the
  Dynamics tab's markings, those that need attention (a gap, a blur, missed; anything not right)
  come first and in full; when more than three were played right, those fold into one line ("31
  more marks played cleanly") that opens to list them. The table view keeps every one.
- **Aspects**: Options has "Judge the pedal" beside the others (`pedal` in `dacapo.expression.off`
  when turned off). `ANALYSIS_VERSION` stays 1: the pedal adds figures and changes none.
- **The lessons agree**: `CHANGE_MAX_MS` and `RELEASE_MAX_MS` live in `core/expression.ts`, and the
  lesson on the pedals (`ui/learn/expression.ts`) takes them from there; its own judge, per chord
  with no marks, stays the lesson's.

## Clarifications (decided during X4)

- **Steps name their ornaments.** A step lists its notes with grace notes or an ornament
  (`Step.ornaments`: the note, its principal key and the other keys it adds, `ornamentKeys`: the
  keys its realisation plays besides the note, so a trill closing with a turn adds its lower note
  and a long mordent nothing more). Grace notes are still no steps: step indices, step records and
  the checksum are unchanged, so every record and take made before stays valid.
- **Wait mode.** The step completes on its keys as before, the principal among them; a grace
  note, an upper-note trill's first note or a turn's played before the principal is an ornament key
  of the current step. After the step, its ornaments' keys and its principals stay neither right
  nor wrong (`WaitState.carry`) until a key of a later step that is none of them is played; a
  wrong key does not end them. An ornament's key that is also the next step's key completes that
  step (a mordent whose lower note comes next moves the cursor on early); the ornament still goes
  on, so the same key struck again is no wrong note. Once the run has finished, keys are ignored as
  before.
- **Rhythm mode.** The principal is due where the ornament strikes it, realised at the run's
  tempo with the piece's trill start, as the demo plays it: on the beat after an acciaccatura, for
  a mordent and a trill from the note; a thirty-second later for a turn (at most 70 ms) and a trill
  from the note above; after an appoggiatura, half the note (two thirds of a dotted one). Its
  deviation is measured from there and its step stays open until that window has closed. The
  ornament's span is its figure's first onset to its last (a tied note's figure over the tie),
  widened by the step's window; within it, a key of the ornament (or the principal struck again)
  that matches no due key is an ornament key, not an extra. A due key is always matched first.
- **In the take**, an ornament's other key names its ornamented step (as the step's own keys do);
  the principal struck again after its step names −1, so the take's reading (X1) keeps the
  principal's first stroke. A take's −1 therefore means a key matched to nothing: a wrong or extra
  one, one in the count-in, or a principal struck again within its ornament.
- **Records made before.** Before X4 an ornament's keys counted as wrong notes in wait mode and as
  extra notes in rhythm mode; those records stay as they are (the bar heatmap mixes them with the
  new ones) and their takes read on: an ornament key matched to nothing counts for its ornament when
  it falls between the step before's first key and the step after's (wait mode), or within the
  figure's span give or take 150 ms (rhythm mode), where a take made since X4 has none but its
  wrong keys.
- **Played or left out.** Per ornament (grace notes and an ornament on one note are one) and round,
  on a note the run played: **played** when every other key it adds was played around its principal,
  **played in part** when some were, **left out** when none. The run's last note struck is not
  judged: the run ends with it, and a figure going on after it is not in the take. The Ornaments tab
  (Options: "Judge ornaments") lists each with its bar, the three bars to look at (left out 2, in
  part 1) and a table of the keys asked and played; it has no chart. It is shown only when the score
  has ornaments or grace notes in the hands practised. Those left out or played in part come
  first; more than three played fold into one line, as in the Pedal tab.
- **The tabs** stay in one row: on a phone, where four do not fit, it scrolls sideways (the tab cut
  at the edge shows there is more), the arrow keys move between them as before and the chosen one
  is scrolled into view.
- **Articulation.** A note with grace notes or an ornament is held as its figure plays it: its
  held length is not judged, nor a legato join into it (its figure may start before it).
  `ANALYSIS_VERSION` is 2.
- **The keyboard hint.** With Show keys, the current step's ornament keys (not keys of the step
  itself) have a dashed outline, lighter than the keys to play, and their own label for screen
  readers ("B4, a note of the ornament"); not while the demo plays.
- **The trill start** is kept with the piece's other preferences in this browser (`trillStart`
  in `dacapo.pieces.byPiece`: `principal`, the default, or `upper`), offered in Options only when
  the piece has a trill. The demo, the other hand and rhythm mode's timing use it; wait mode takes
  the keys in any order either way.

## Milestones

1. ✓ **X0 Markings and takes** — markings in the parser and score, grace notes and ornaments
   realised in playback, the `takes` store (synced, exported), the library's markings.
2. ✓ **X1 Dynamics and balance** — curve, markings, balance, the Expression panel.
3. ✓ **X2 Articulation** — held lengths, slurs, staccato, tenuto.
4. ✓ **X3 Pedal** — the pedal line, changes, gaps and blurs.
5. ✓ **X4 Ornaments** — accepted in wait and rhythm mode, the keyboard hint.

# dacapo — Reading in time specification

Status: R1 (Rhythm on Read) is built; R2 and R3 are planned. This extends [MVP.md](MVP.md),
[PIECES.md](PIECES.md) and [EAR.md](EAR.md); their principles and fixed decisions still apply (staff
first, measure don't guess, local data, English of record, every UI language, 3-day dependency
cooldown, no backend).

Goal: close the gap between Read and Pieces. Read asks for one note (or, with E3, one interval,
chord or key) and waits; a piece asks for two hands, at tempo, without stopping. In between a
learner needs to read **rhythm** on its own, to **hear** a rhythm and know how it is written, and to
**sight-read** short, new music in time, looking ahead of where the hands are.

## Where it lives

Read gains a choice of what to read (E3 adds intervals, key signatures and chords as cards). Two
more choices read **in time**: **Rhythm** and **Sight-reading**. They share Read's level list,
suggested level and mastery rule, but a session is a run of bars instead of a stack of cards. The
choice is built as rows of groups (`READ_CHOICE_GROUPS` in `src/ui/read/prefs.ts`): the cards are
one row today, and the choices read in time join as a second row of their own.
Rhythm dictation is a family of the **Ear** page.

While a run is in time, the header's metronome is paused (as rhythm mode does) and practice is
marked (`beginPractice`), so sync waits.

## Timing, shared

- The click, the count-in, the matching window and the latency offset are rhythm mode's
  (`core/rhythm.ts`, `core/metronome.ts`, `core/calibration.ts`): a note-on belongs to the due
  onset within `matchWindow` of it (40–150 ms, half the gap to the nearer neighbour), minus the
  stored calibration offset. A tap in time is within `IN_TIME_MS` (50 ms) of its onset.
- The count-in is one bar. The click goes on under the run, or, with **Count-in only**, stops after
  it (the pulse is then the player's own).
- The tempo is chosen per level from 40 to 160 per beat, 72 by default (60 for levels with
  sixteenths); it is remembered per browser.

## Rhythm (R1)

A line of rhythm on a one-line staff, no pitch, drawn by Verovio from generated MusicXML like the
scale exercises (`core/scaleXml.ts`), with the counts under it on request. The player taps it on
any key. **Hands** levels use two lines: the right hand taps the upper line on any key from middle C
up, the left the lower one below it.

### Cells and levels

A rhythm is built from **cells**, one beat long (two in compound time's half bar, see below), each
with a key: `q` quarter, `qr` quarter rest, `ee` two eighths, `er-e` eighth rest and eighth, `h`
half (a cell of two beats), `hd` dotted half, `w` whole, `qd-e` dotted quarter and eighth (two
beats), `ssss` four sixteenths, `e-ss`, `ss-e`, `ed-s` dotted eighth and sixteenth, `trip` eighth
triplet, `e-q-e` the syncopation over two beats, `tie-q-e` a note tied over the beat, and in 6/8
`c:qe`, `c:eq`, `c:eee`, `c:qd`, `c:qdr`. A cell's key names its written shape, so two cells that
sound alike (`h` and `q` tied to `q`) are separate items.

| Level | Adds                                                     | Meters        |
| ----- | -------------------------------------------------------- | ------------- |
| R1    | `q` `qr` `h` `w`                                         | 4/4, 3/4, 2/4 |
| R2    | `ee` `er-e`                                              | 4/4, 3/4, 2/4 |
| R3    | `hd` `qd-e`                                              | 4/4, 3/4      |
| R4    | ties within the bar and over the barline                 | 4/4, 3/4      |
| R5    | `ssss` `e-ss` `ss-e` `ed-s`                              | 4/4, 2/4      |
| R6    | `trip`                                                   | 4/4, 2/4      |
| R7    | `e-q-e` `tie-q-e` and runs starting off the beat         | 4/4           |
| R8    | 6/8: `c:qe` `c:eq` `c:eee` `c:qd` `c:qdr`                | 6/8           |
| R9    | two hands: the left keeps the beat, the right the rhythm | 4/4, 3/4      |
| R10   | two hands in different rhythms, then two against three   | 4/4, 2/4      |

- An exercise is four bars (two in R9–R10 at first), built from the level's cells by the item model
  (the next cell favours the ones missed or played unevenly, never the same one three times in a
  row), in one meter. It ends with a note on the downbeat of a fifth bar, so the run ends on a beat.
- A session is 4, 8 or 16 exercises, each one count-in, run and result, with **Again** (the same
  exercise) and **Next**.

### Judging

- Every written onset is matched as above; a tie's second note and a rest have no onset. A note-on
  that matches no onset is an extra.
- A **cell is right** when every onset in it is played in time and nothing extra falls in its span.
  Its record keeps each onset's deviation (ms, after the offset; null when missed) and the extras.
- The result shows every onset on the line: in time, early, late (the arrow and the ms), missed,
  extra; and the run's figures: cells right, the median absolute deviation, the tendency (rushing or
  dragging, `core/rhythmRun.ts`'s rule).
- Mastery: ≥ 90 % of the level's last 40 cells right.

### Records

One answer per cell (the `answers` store of EAR.md): family `rhythm`, item the cell key and meter
(`rhythm:ed-s:4/4`), prompt the cell's onsets in beats, answer the deviations and extras, correct,
the tempo. Sessions are kind `rhythm` (a summary like an ear session's plus the tempo); the public
profile counts them as reading until the service knows the kind.

### Clarifications (decided during R1)

- **Where.** Read's "What to read" has a second row, what is read in time: **Rhythm** (Sight-reading
  joins it with R3). Its setup is Read's: the levels with their progress and the suggested one, then
  the tempo, exercises per session (4, 8 by default, or 16), **Count-in only**, **Show the counts**
  and the latency with **Calibrate** (Pieces' calibration and its stored offset).
- **Cells, as written.** One beat each unless longer: `h` `qd-e` `e-q-e` `tie-q-e` two, `hd` three,
  `w` four; the 6/8 cells one dotted-quarter beat. A `~` in front of a key is that cell with its
  first note tied from the last note of the cell before, within the bar or over the barline (R4's
  ties: `~q` `~h` `~ee` `~qd-e`), so `h` and `q` + `~q` are separate items and a tied-into cell may
  have no onset at all. `tie-q-e` is `e-q-e` with its quarter written as two eighths tied over the
  beat (e e⌒e e). A two-hand cell is `right|left`, the left hand's one-beat cell repeated under the
  right hand's: R9's `h|q` is a half note over two quarters.
- **Levels.** R1–R7 each add their cells to the ones before (R5–R7 draw sixteenths, so they start at
  60); R8 draws its five 6/8 cells only; R9 the right hand's cells of R1–R3 over the left hand's
  beat; R10 two different one-beat cells of `q qr ee er-e trip` at once, `trip|ee` and `ee|trip`
  being two against three. "Runs starting off the beat" (R7): half of R7's exercises begin with
  `er-e`. "Two bars at first" (R9–R10): until the level's first 40 cells (its mastery window) have
  been played, and R10 leaves the triplet out until then ("then two against three").
- **Drawing an exercise.** A meter of the level at random; then cell by cell, among those that fit
  where it starts (never across the barline; `w` on the downbeat; the syncopations `e-q-e` and
  `tie-q-e` on beat 1 or 3, so the middle of a 4/4 bar shows), weighted by the weakness model keyed
  by item (a cell missed counts as an error; a cell right by the mean distance of its onsets from
  the beat, against a 25 ms target), the level's new cells three times, cells with nothing to play
  (a rest, a tie's continuation) a third as often and never two in a row; never one cell three
  times in a row; a tie only after a note and never after another tie; the first cell starts with a
  note; every bar has a note to play.
- **The final note** fills the bar after the cells (a whole note in 4/4, a dotted half in 3/4 and
  6/8, a half in 2/4). The plan gives its bar one beat, so the run and the click end a beat after
  its downbeat. It is timed and inked like any onset but is no cell: it is not recorded and not in
  the figures.
- **Tempo** is beats a minute, the beat being the click's: a dotted quarter in 6/8 (the quarter
  tempo is then 1.5 times it). The click is rhythm mode's own sound at its volume; the 6/8 count-in
  is its two dotted-beat clicks, not lesson 8's subdivided eighths.
- **Taps.** Each line is one key to rhythm mode's matcher (the pitch it is written at: E4 on the
  upper line, G2 on the lower); a note-on goes to the right hand's line, or in R9–R10 to the left
  hand's below middle C. Note-ons of one line within 30 ms of each other are one tap (a chord, or a
  finger catching two keys). During a run the computer keyboard's notes are off and every letter
  and the space bar taps; in two hands the left half of the letters (Q–T, A–G, Z–B) is the left
  hand and the right half with the space bar the right. A pad under the line (two in R9–R10) is
  tapped with a finger or the mouse. Taps along with the count-in are not judged.
- **Judging.** Deviations are rounded to whole milliseconds first, and everything is judged on
  them (the stored value), so an import judges the same way: in time is |deviation| ≤ 50 ms. The
  matcher only sees the onsets near a tap, so a tap it finds nothing for anywhere from the first
  onset's window to the last's is an extra here even in a long rest; it belongs to the cell whose
  span holds it (the first before it starts; after the last cell it counts for nothing but the
  drawing).
- **After a run** every note is inked (in time, early, late, missed; a tie's second note as its
  first), each onset not in time gets its arrow and ms (above the upper line, below the lower), an
  extra tap a +; the figures are the cells right, the median |deviation| and rhythm mode's tendency
  (a trimmed mean; under 10 ms neither rushing nor dragging). **Again** plays the same exercise at
  once; **Next** shows the next line and waits for Start, and after the last one ends the session.
  While a run lasts a beat cursor moves over the line, the count heard is lit and the header's
  metronome is paused (for `reading`); the practice is marked and the screen kept on.
- **Records.** Only a run played to its end is kept; a stopped or interrupted one (another page,
  the page hidden) keeps nothing. An answer is `family: 'rhythm'`, `level`, `item`, `prompt` (the
  cell's onsets in beats, one list per line), `answer: { deviations, extras }` (deviations per
  line, null when missed), `correct`, `bpm`, `exercise` and `run` (their index in the session) and
  `at`, when the cell's span ended in the run. A session is kind `rhythm`: the level, the tempo,
  the exercises planned and played, the runs, cells and cells right, the accuracy, the median
  |deviation|, the tendency and the items missed with how often; it is rebuilt from its answers
  after a closed tab. Imports and sync check every answer's prompt against its item and judge it
  again; `SYNC_SCHEMA` 7, the export file needs no new version; the public profile counts these
  sessions as reading.
- **Counts** are drawn by the page over Verovio's drawing, as lesson 8 writes them: each beat as
  finely as its notes and rests need, counts not played on in brackets; a beat of two against three
  is counted where something starts ("1 trip & let"). The triplet's words follow the lessons (连 音
  in Simplified Chinese, 連 音 in Traditional); Japanese and Korean keep "trip let" beside the
  Latin e, & and a.
- **Drawing.** A one-line staff per line with its clef hidden, spacing nearly proportional to the
  durations (Verovio's `spacingNonLinear` 0.9, `spacingLinear` 0.15, set only for this page), beams
  by the beat (by three eighths in 6/8), the sixteenths' second beam or its hook, a triplet's 3
  without a bracket over its beam, rests centred on the line, and a final barline.

## Rhythm dictation (R2, on Ear)

- One bar is played on one key (E4 by default), after a one-bar count-in click, at the level's
  tempo. The items and levels are Rhythm's (R1–R8; the two-hand levels are left out).
- **Tap it back**: after the bar, a second count-in, then tap it; judged as in Rhythm.
- **Choose it**: three or four written bars, the right one among bars that differ from it in one
  cell (a cell the learner confuses with it first, from the confusion counts).
- The confusion table of EAR.md applies: `ed-s` heard as `qd-e`'s half, `trip` as `ee`.

## Sight-reading (R3)

Short music never seen before, generated, drawn on the grand staff by Verovio from MusicXML, played
once through.

### Fragments

- A **fragment** is 4 bars (8 from F5), in a key and meter of the level, generated by rules with an
  injected rng and a generator version, so the stored seed and version give the same fragment
  again: a melody that moves mostly by step, with leaps limited by level, over a harmony chosen bar
  by bar from I, IV, V (and ii, vi from F6), ending on a cadence to the tonic; strong beats take a
  chord tone; the left hand is a bass note per bar, then per half bar, then chords or broken chords.
  Hand positions are five-finger positions until F5, and a position change happens only between
  phrases.
- Fingering is not printed (the positions make it obvious); the first note of each hand is.

| Level | Hands and texture                               | Keys and notes          | Rhythm |
| ----- | ----------------------------------------------- | ----------------------- | ------ |
| F1    | right hand, C position, steps                   | C major                 | R1     |
| F2    | left hand, C position, steps                    | C major                 | R1     |
| F3    | hands in turn (the melody passes between them)  | C, G major              | R1     |
| F4    | melody over held bass notes                     | C, G, F major           | R1–R2  |
| F5    | melody with skips, bass per half bar            | + D, B♭ major, A minor  | R1–R3  |
| F6    | two moving hands, fifths and sixths in the bass | + E minor, D minor      | R1–R3  |
| F7    | position shifts, accidentals                    | up to 3 sharps or flats | R1–R4  |
| F8    | chords and broken chords in the left hand       | up to 4 sharps or flats | R1–R5  |

### Playing

- **In time** (default): count-in, then the cursor moves in time and nothing waits, as in rhythm
  mode; notes are matched by key and time. **Wait**: as wait mode, for a first look.
- **Read ahead**: the bar being played is covered as its first beat arrives, so what is played has
  to have been read already. Off, on (cover the current bar), or hard (cover from the half bar
  before).
- Before a run the fragment can be looked at for 10–30 s (a setting, 20 by default) with a
  countdown, as in a sight-reading exam; **Start** skips it.

### Result and records

- Per bar: notes right and in time, wrong or missed notes, extras; per run: the share of notes right
  and in time, the tendency, and **Play it back** (E-series playback, when built) or **Listen** to
  hear it as written.
- A session is 4 or 8 fragments; its record is kind `sight` with the level, seed and generator
  version of each fragment, and each run's figures; not the notes played (a run can be played
  again from the seed, and its per-note detail is not needed for progress). A level is mastered
  when the last 5 fragments in time each have at least 90 % of their notes right and in time.

## Milestones

1. ✓ **R1 Rhythm** — the choice of what to read on Read, cells, levels R1–R10, generated rhythm lines,
   judging, records, sessions, mastery; the Rhythm II lesson before it (LEARN.md).
2. **R2 Rhythm dictation** — on Ear: tap it back and choose it, confusions.
3. **R3 Sight-reading** — fragments F1–F8, in time and wait, read ahead, the look before, records.

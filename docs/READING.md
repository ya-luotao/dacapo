# dacapo — Reading in time specification

Status: planned (after E1–E4 of [EAR.md](EAR.md)). This extends [MVP.md](MVP.md),
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

1. **R1 Rhythm** — the choice of what to read on Read, cells, levels R1–R10, generated rhythm lines,
   judging, records, sessions, mastery; the Rhythm II lesson before it (LEARN.md).
2. **R2 Rhythm dictation** — on Ear: tap it back and choose it, confusions.
3. **R3 Sight-reading** — fragments F1–F8, in time and wait, read ahead, the look before, records.

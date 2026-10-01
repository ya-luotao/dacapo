# dacapo — Pieces specification

Status: P0–P7 are built (after MVP 0.1.0, not yet in a release). This extends [MVP.md](MVP.md); its principles and fixed
decisions still apply (staff first, local data, English of record, i18n in every UI language, 3-day
dependency cooldown, no backend).

Goal: practise real pieces on the real score — first slowly and correctly (wait mode), one hand
or both, a few bars at a time, then in time with a metronome — and see where in the piece you
stumble.

## Content and copyright

- **Built-in library**: a small graded set of public-domain beginner pieces (for example
  Petzold's Minuet in G, the _Ode to Joy_ theme, the opening of _Für Elise_, Burgmüller and
  Czerny studies). Only encodings we may redistribute: CC0 / public-domain encodings, or
  encodings made for this project and released under the repo licence. Every piece carries
  provenance metadata: composer, work, source edition, encoder, licence.
- **Import**: the user imports their own MusicXML (`.musicxml`, `.xml`, compressed `.mxl`), e.g.
  exported from MuseScore. This is how pop arrangements get in. Imported files stay in the
  browser; they are never bundled or uploaded.
- No copyrighted arrangements in the repository, ever.

## Model (`core/score.ts`, pure)

MusicXML is parsed once into an internal model that everything else uses; the renderer is only
for drawing.

- Time in integer ticks (a fixed resolution per quarter note), plus measure index and beat.
- A piece has measures (number, time signature, tempo marks) and note events: onset, duration,
  MIDI pitch, spelled pitch, staff, hand (`right` / `left`; staff 1 = right, staff 2 = left by
  default, overridable per piece), voice, tie flags. A tied continuation is not a new key press.
- **Steps**: the ordered list of distinct onsets per hand selection (right, left, both); a step
  is the set of pitches that start together. Grace notes and ornaments are no steps of their own
  (the parser keeps them on their note, the demo and the other hand play them, and since X4 a
  step names the keys they add, see [EXPRESSION.md](EXPRESSION.md)), repeats handled as decided in
  the spike.
- Mapping from steps to renderer positions so the cursor and highlights line up.

## Practice modes

### Wait mode (default)

- The cursor sits on the current step. The step is complete when every required pitch has been
  pressed since the step appeared (any order; a key already held from the previous step does
  not count again unless the score repeats it). Wrong notes are counted and shown, never block.
  A step with grace notes or an ornament waits for its principal: the ornament's other keys, in
  any order, count as neither right nor wrong, before the principal and after it until a key of
  the steps that follow (X4).
- Hand selection: right, left, both. Loop: choose a measure range (A–B); after the last step the
  cursor returns to A. "Start from measure n".
- Per step: time to complete and wrong notes, used for the measure heatmap.

### Playback and accompaniment (Web MIDI output)

- Choose a MIDI output (the MP11SE); dacapo sends note on/off so the instrument itself sounds.
  Without one, the built-in piano (sampled; see "Built-in piano" below) plays instead.
- **Demo**: play the selection (hands, loop range) at a chosen tempo with the cursor following.
- **Accompaniment**: when practising one hand, the other hand is played by the instrument — in
  wait mode, its notes belonging to the current step sound when the step is completed (with
  their relative timing at the current tempo); in rhythm mode, in time.
- All notes off on stop, pause, route change, device loss and page hide. Verify the MP11SE does
  not echo received notes back to its USB MIDI input; if it does, filter them.

### Rhythm mode

- Metronome (count-in plus click), tempo slider, the cursor moves in time. Each played note is
  matched to the nearest expected note of the step (pitch + time window); deviation in ms early
  / late, missed and extra notes. A principal with an ornament is due where the ornament strikes
  it (an appoggiatura's half its length later), and the ornament's keys within its span are no
  extra notes (X4).
- Latency calibration (tap along to the click) stored as a preference.
- The click is a short Web Audio click, or a MIDI click on the instrument if it supports it —
  decide in the spike.

## Measure heatmap and records

- Per piece: per measure, hesitation (step completion time) and wrong notes in wait mode; timing
  deviation in rhythm mode. Shown as a tint behind each measure on the score, with a legend,
  details on hover/focus and a table alternative (same standards as the note heatmap).
- Piece sessions count towards daily minutes and the streak; they appear in the session list.
- Storage: IndexedDB version 2 migration adding `pieces` (imported MusicXML text + parsed
  metadata), piece sessions, and per-measure stats; export/import includes imported pieces.

## UI

- A new **Pieces** route: the library (built-in by level, then imported) and Import.
- The practice screen keeps the Read page's rules: the score is the hero, the whole practice
  surface fits on one laptop screen, the current step is unmistakable, controls are quiet.
- Everything follows the engraved-score design system (see `src/ui/styles.css` tokens).

## Clarifications (decided in P0–P4)

- **Renderer: Verovio 6.3.0.** It is loaded only on the Pieces routes, and the library prefetches
  it while idle. Its two npm files ship unmodified as separate assets, with the LGPL and GPL texts
  in `public/licenses/verovio/` (see `THIRD_PARTY_NOTICES.md`). `smuflTextFont` is never set to
  `linked`, so nothing is fetched from verovio.org.
- **Drawing.** Part names are hidden, and a tempo is drawn only if the file has one. Verovio's
  timemap is taken in written order (`expandNever`). Onsets are measured from the start of their
  measure, so a bar the engine measures differently cannot shift the rest.
- **Placing notes on the score.** Our notes are matched to Verovio's by written tick and pitch.
  Notes left over go to the nearest drawn note of the same key within an eighth. What still has
  no match is reported as "n notes could not be placed" and is practised all the same.
- **Hands.** The piano is the first part with two staves (a piano-like name or MIDI program
  preferred): staff 1 is the right hand, the rest the left. Failing that, two single-staff piano
  parts are right and left hand; failing both, the first two parts, with a warning. Other parts
  (a voice, a violin) are drawn lighter and never practised. An imported piece can reassign every
  staff to right, left or not practised.
- **Repeats.** Performance order by default (`|: :|` with `times`, numbered voltas, a first ending
  without its `:|`). "Skip" plays every written bar once and takes the last ending. D.C./D.S. are
  read as written, with a warning.
- **Loop A–B** is chosen in written bars. It resolves to the first run from an occurrence of A to
  the next occurrence of B that stays within bars A–B. So "bars 7–9 (2nd ending)" loops the second
  pass, while the whole piece keeps both passes. "Start from bar n" is its first occurrence, inside
  the loop if one is set.
- **Wait mode.** Only key-downs count, so a key still held from the step before never completes a
  step: the score must ask for it again and it must be struck again. The clock starts at the first
  key of a run, not when the page opens. Without a loop the run finishes after its last step; with
  a loop it goes round until Finish. Each step's time is capped at 60 s in the summary. "Slowest
  bars" ranks written bars by mean time per step, both passes together.
- **Records.** Per-step records (step, written bar, pass, ms, wrong, time) are kept in memory in
  P1, shaped for P3's measure heatmap.
- **Storage moved forward.** Imported pieces persist from P1 on: IndexedDB version 2 adds a
  `pieces` store (id, title, composer, file name, MusicXML text, import date, hands, parse
  warnings). Export format version 2 includes them; version 1 files still import. Piece sessions
  and measure statistics stay in P3.
- **Built-in library:** our own encodings of Mutopia public-domain editions, our own _Ode to Joy_
  (in C, for the right hand's C position), and CC0 MuseScore files from PDMX with fingering
  removed. Each is checked against an independent MIDI file where one exists
  (`scripts/pieces/`), and its notes are locked by a checksum test. Since H3 it also holds lead
  sheets (`leadSheet: true`): our own encodings of a public-domain print of a tune, with chord
  symbols of our own and an empty bass staff, proofread blind against the scan where no oracle
  exists ([HARMONY.md](HARMONY.md), "Clarifications (decided during H3)"). The Pieces page lists
  them after the graded pieces, under their own heading.

- **MIDI output (P2).** Input and output share one `MIDIAccess` (one permission prompt). The
  output is the one named like the connected keyboard unless the user picks another, or None; the
  choice is remembered by name. Notes go out with `send(data, timestamp)` at most 80 ms ahead;
  everything later can still be cancelled. The instrument is silenced (note-offs for our notes,
  then CC64 = 0, CC123 and CC120 on 16 channels) on stop, pause, a new run, a route change, output
  loss, a hidden page and `pagehide`. Note-ons arriving within 30 ms of one we sent to the output of
  the same name are ignored as echoes.
- **Demo.** It plays the selected hands (Both: the whole score) from the start bar to the end of
  the span, round and round for a loop, at 40–200 % of the score's tempo marks (90 ♩/min without
  one); velocity 72; ties joined; a repeated key released up to 30 ms early. Keys do not count
  while it plays or is paused.
- **Accompaniment (wait mode, one hand).** The notes of the other hand and of unpractised parts
  that start from a step's onset up to the next practised step sound when that step is completed,
  with their timing at the current tempo. A note ends at its written length, or earlier when the
  player completes the step where it ends in the score. Notes before the first step of a loop are
  its lead-in, played after the last step; without a loop they are not played.
- **Records (P3).** Raw step records are the source of truth; every figure is recomputed from them.
  A step record holds a stable id (`session:n`), the session, the piece, the piece's checksum
  (FNV-1a over each note's written onset, key, length and hand, so another hand assignment is
  another version; a transposed run keeps the checksum of the written key, see H4), the hands, the written bar and pass, the time, the wrong notes and when.
  IndexedDB version 3 adds a `pieceSteps` store with indexes by piece and by session; it is never
  read at startup, only one piece at a time when a page needs it. With a run's first step its
  header (piece, title, hands, loop, repeats, tempo, start) is saved in `meta`; the session
  replaces it when the run ends (finished, Finish, restart, other hands or bars, leaving the
  page). A header still there on the next load is turned into a session from its steps.
- **Session time** is the sum of the step times, each capped at 60 s. Starting the demo restarts
  the current step's clock at the next key, so listening is neither practice time nor hesitation.
- **Measure heatmap.** Per written bar, for the selected hands, from the last 5 runs that played
  the bar (both passes together): the median time per step, on a fixed scale with edges at 0.5,
  0.75, 1, 1.5, 2 and 3 s around a 1 s anchor (a comfortable step, quarter notes at ♩ = 60), in the
  note heatmap's 7-step ramp; and wrong notes per step as a number. Fewer than 2 runs or 3 steps is
  "not enough data". A bar is steady when its last 3 runs had a median under 1 s and no wrong
  note. "Loop the weakest bars" loops the weakest bar, with a neighbour played right before or
  after it when that one is weak too (slower than the anchor or with wrong notes). Records with
  another checksum are kept, left out and counted in a note.
- **Per piece in this browser**: the hands and the tempo (`localStorage`). Built-in pieces carry
  their checksum and bar counts in the library index (locked by a test); imported pieces store
  them at import and when opened.
- **Export format 3** adds piece sessions and `pieceSteps`; formats 1 and 2 still import.

- **Rhythm mode (P4).** One origin on the `performance.now()` clock drives everything: the cursor,
  the other hand (sent over MIDI from the timeline, 80 ms ahead) and the click. The click is a Web
  Audio blip scheduled on the AudioContext clock by a 25 ms timer with a 100 ms lookahead, mapped
  with `getOutputTimestamp()` (the median of recent readings; before a new context gives
  timestamps, `currentTime` plus `baseLatency` and `outputLatency`). It clicks every beat of the
  time signature, the dotted beat in compound meters (6/8, 9/8, 12/8: the beat that is conducted and
  counted), accented on the first. The count-in is one full bar in the start bar's meter and tempo,
  plus the beats before a pickup. Click: on, count-in only, or off; volume in Options and Settings.
- **Matching.** A note-on goes to the nearest due key of the same pitch whose window holds it,
  first come first served; each key of a chord separately. The window is half the gap to the nearer
  neighbouring step of the practised hands (whatever its keys), at most ±150 ms and at least ±40 ms,
  so it follows the tempo and a note always belongs to the step it is closer to. A key not played
  in its window is missed; a note-on that matches nothing is extra, counted on the step nearest in
  time. Notes before the first window (the count-in) are ignored. The latency from calibration is
  taken off every note.
- **Calibration.** 16 clicks at ♩ = 90; each tap goes to the nearest click within half a beat; the
  first four clicks do not count; at least 8 of the other 12 need a tap; the offset is the median
  of tap − click, refused when the interquartile range is over 60 ms. Stored per browser
  (`localStorage`), not exported. Offered once before the first rhythm run.
- **After a run.** Notes hit and within ±50 ms (shares of the notes due), missed, extra; the
  tendency is the 20 %-trimmed mean deviation (under 10 ms is "on the beat"); rushing and dragging
  come from Theil–Sen lines through every stretch of 2–8 bars (in the order played, rounds of a
  loop counted apart): a stretch is reported when its line moves at least 30 ms, the notes of its
  last bar have moved at least 30 ms from its first, and the change is at least 5 standard errors
  from noise; the clearest wins, and a shorter one inside it nearly as clear and steeper is
  preferred. A drift over the whole run is reported as such when it is the clearest.
- **Expression (EXPRESSION.md, X1).** Both summaries, wait and rhythm, end with the run's
  Expression panel, computed from its take: the Dynamics tab (the loudness per hand and beat under
  the bar numbers with the score's dynamics above, every dynamic, hairpin and accent judged in
  words, the balance of melody over accompaniment, the bars to look at, each loopable, and a table
  view) and, with X2, the Articulation tab (each note's held length against its slur, staccato,
  tenuto or none, per bar), with X3, the Pedal tab (the sustain pedal as played against the
  score's pedal marks: clean changes, gaps and blurs) and, with X4, the Ornaments tab (each
  ornament and grace note, played or left out). Options has **Your runs**: the piece's
  past runs, each with its Expression panel, and a choice of the aspects judged.
- **Rhythm records.** Rhythm steps go into the same `pieceSteps` store with `mode: 'rhythm'` and
  `notes` (each key's deviation in whole ms, or null when missed); `ms` is the step's share of the
  run at its tempo and `wrong` its extra notes, so session time and the log work unchanged. No
  store or index changed, so the database stays at version 3; records without a mode are wait
  mode's. Rhythm sessions carry `mode` and the counts of notes, hits and notes in time. A rhythm run
  is recorded once a key has been played. Export format 4; formats 1–3 still import.
- **Timing heatmap.** Weak bars by Hesitation or Timing. Timing is the median distance from the
  beat of the notes played in the bar, with missed and extra notes per note as the number, over
  the same last 5 runs and with the same not-enough-data rule (2 runs, 3 notes); edges at 10, 20,
  30, 50, 75 and 100 ms around a 30 ms anchor at the hesitation anchor's place in the ramp. A bar
  whose every note was missed takes the last colour. Steady: the last 3 runs under 30 ms with
  nothing missed or extra.
- **Controls.** The mode (Wait / Rhythm), hands, loop and tempo stay in the control row; start bar,
  repeats, other hand, show keys, weak bars and the click are under Options (a disclosure); Listen,
  Start/Stop and Restart sit under the score. The weak-bar details are laid over the page, placed
  against the window.
- **Focus mode.** A Focus button next to the piece's name hides the header and folds the control
  row away; one row is left above the score: back, the name, smaller and larger notes (0.85–2 ×
  the usual staff, `ui/focus/focus.ts`), the on-screen keyboard on or off, Settings (unfolds the
  control row), the metronome chip, full screen where the browser offers it (not in the Apple app)
  and Exit focus. Escape folds Settings first, then leaves; a panel or dialog open on the page takes
  Escape before it. The choice, the size and the keyboard are remembered in this browser and shared
  with the Scales page. The page may run wider than usual (100rem).
- **Fingering on the keyboard.** The parser keeps the first printed finger of a note (not an
  `alternate` or `substitution` one, in any of its `<notations>`; "3-1" starts with 3) as
  `ScoreNote.finger`. With Show keys, a marked key carries its finger in place of the triangle.
  Only imported pieces can have fingering: the built-in files have none (see Clarifications). The
  checksum leaves the finger out, so records made before stay valid.
- **The screen stays on in a browser too**, through the Screen Wake Lock API where there is one,
  taken again when the page comes back into view (the app keeps doing it natively).

## Built-in piano (after P4)

- **Samples.** The Salamander Grand Piano V3 (Yamaha C5, Alexander Holm, CC BY 3.0): layers
  4, 9 and 13 of 16 (standing for velocities 40, 68 and 100), every minor third from A0 to C8,
  trimmed to 1 ms before their first sound, cut from 8 s (A0) to 2.5 s (C8), faded and encoded as
  VBR MP3 by `scripts/piano/build.ts` (90 files, 3.8 MB in `public/piano/`). A key plays the
  nearest sample (as the SFZ maps them) at its pitch and the retuned SFZ's cents; the nearest
  layer, or another while it loads; gain = velocity / layer velocity × √(velocity / 127). Key up
  damps with a time constant from 0.2 s (A0) to 0.08 s (C8), except from F♯6 up; the pedal holds
  the strings; a key struck again damps its ringing string; at most 64 voices; a limiter on the
  master. Samples are fetched only when the piano becomes the output or a key is to sound (the
  middle layer first, 6 at a time) and decoded on an OfflineAudioContext.
- **As an output** it is an `OutPort` to the scheduler: timestamps map to the AudioContext with the
  click's mapping, note-off and sustain are kept, CC120 stops everything at once (a note already
  handed over but not started never sounds), CC123 lets the keys up. "Auto" takes it when no
  output is named like a connected input, once MIDI access was granted or refused or 1.5 s have
  passed; notes sent to it are never recorded for the echo guard. The AudioContext is made or
  resumed on the first click, tap or key press while the piano is in use.
- **The player's keys** go to the piano through a second input hub fed by taps on the sources: the
  computer keyboard and the on-screen piano unless turned off, a MIDI keyboard when turned on (both
  remembered in `localStorage`). They are a part of their own, with their own pedal: the
  scheduler's panic does not stop them; a hidden page does.

## Practising a piece over weeks (after P4)

Planned with [EXPRESSION.md](EXPRESSION.md), whose takes these build on.

### Play back your run (P5)

- Every run keeps its take (EXPRESSION.md). The summary, and each run in the piece's progress, has
  **Play back**: the take plays through the output as it was played — velocities, releases, pedal —
  with the cursor on the score following the notes as matched, a wrong note shown where it fell.
  Pause, resume, from a bar, and **Compare**: the written version (the demo at the run's tempo),
  then the run, bar by bar or the loop.
- Playing back is listening: it is not practice time, and it silences on route change and hidden
  page as the demo does.

### Review schedule (P6)

- A piece once practised to the end is in **review**. Its next review falls after an interval that
  grows while runs go well: 1, 2, 4, 7, 14, 30, 60 days. A run to the end with at most one wrong or
  missed note per 50 notes (in rhythm mode, with at least 80 % in time) and no bar slower than
  twice its median in wait mode doubles the interval (to the next step); a worse run keeps it; a run
  with more than one wrong note in 10 halves it. Runs before the date count only for the figures.
- **Due** pieces are listed first on the Pieces page and on the home page ("Due for review: 3
  pieces"), each with how long it has been. A piece can be taken out of review (and put back).
- Computed from the step records and sessions (`core/review.ts`, pure), so it syncs and imports with
  them; only "taken out" is stored, per piece, on the piece record (`review: false`).

### Memorising (P7)

- **Memory** is a practice mode beside Wait and Rhythm (it waits, like Wait). The score is **faded**
  in stages the player chooses: all bars shown; every other bar hidden; only each phrase's first bar
  shown (a phrase: 4 bars, or the score's own rehearsal marks and double bars); nothing but the
  first bar. A hidden bar shows its barline and its number. A wrong key shows the step's notes for a
  moment (and counts as a **prompt**); **Peek** (a key: P) shows the bar while held, also a prompt.
- A hand at a time or both, the loop, and the start bar work as in Wait. The summary: prompts per
  bar, the bars that needed them; the weak-bars heatmap gains **Memory** (prompts per run).
- **Start anywhere**: a random phrase start to play from, as a teacher asks at a lesson; its first
  bar is shown for two seconds, then faded.
- Records: steps as Wait's, with `mode: 'memory'`, `prompts` and the stage.

## Clarifications (decided during P5)

- **Playing back** goes through the demo player and the scheduler, as Listen does: each key down of
  the take with its own velocity, released at its key up (a key struck again with no key up between
  ends where it is struck again; one the take never lets go of sounds to the take's end, at least
  400 ms), and the pedals (CC 64, 66 and 67) at the values recorded, from time 0 (or a rhythm run's
  count-in before it) to the take's last event, then 1.2 s for the last notes to ring before the
  instrument is silenced. The scheduler queues control changes as it queues notes (handed over 80 ms
  ahead, dropped on stop; a pedal already handed over for later is let up again just after it).
  Starting inside the take sends each pedal's position at that moment first. Pause, resume, a hidden
  page (it pauses) and a route change (it stops) work as for the demo. Keys do not count while it
  plays or is paused, nothing is recorded, and a wait-mode run in progress has its step's clock
  restarted, as for the demo: listening is not practice time.
- **The cursor** is on each step from its first key in the take, read as X1 reads it (the rounds of
  a loop in turn); the step's keys struck so far are inked as played, and the keyboard shows the keys
  down. A key matched to nothing is a **wrong note** (on the keyboard and the cursor in the wrong
  colour, and named under the score while it sounds, at least 0.4 s), unless it is in a rhythm
  run's count-in, or is an ornament's principal struck again (in a take from before X4, any key of
  the ornament) on the step the run was on or the one before. In wait mode a wrong key moves the
  cursor on to the step the run was waiting for: that is where it fell.
- **From bar** lists the bars in the order the run first reached them; playing starts at that bar's
  first key.
- **Compare** plays the run's first time round (a loop's first round), **bar by bar** or **all at
  once**. As written: the demo's notes of the run's hands (with both, the whole score), at the run's
  tempo and the piece's trill start and the demo's velocity, those that start in the bar, cut at its
  end. Then, after 0.7 s, as played: the run's keys that start from the bar's first key (in rhythm
  mode its downbeat on the run's clock, when that is earlier, so an early first note is in it) to the
  next bar's (for the last bar, the next round or the end of the take), cut there, with the pedals as
  they were at its start and as they moved; at its end every pedal comes up, and 0.7 s later the next
  bar begins. All at once is the same with the whole round as one bar.
- **Where.** Play back is in both summaries, on every row of Your runs and on a past run opened
  there, whenever there is an output (as for Listen). While it plays, the summary or Your runs gives
  way to the score and the status line becomes the transport: play and pause, from bar, Compare and
  Close, which brings the sheet back. Anything that silences the instrument (other hands, bars or
  mode) closes it. A run from before takes, or of another version of the notes, says so instead.

## Clarifications (decided during P6)

- **A run to the end** is a session completed without a loop, whose hands play every note of the
  piece (both, or the only hand that has notes), and whose step records, when they are here, cover
  every bar those hands play (a run from bar 9 to the end is not one). Wait, rhythm and later
  memory runs all count; so do runs of an earlier version of the notes, since what is reviewed is
  the player's hold on the piece.
- **The schedule** (`core/review.ts`): the first run to the end puts the piece in review, due one
  calendar day after the day it was played (local days, as the streak counts them). From then on
  the first run to the end on or after the date due is the review: it moves the interval a step up
  (doubles it: 1, 2, 4, 7, 14, 30, 60 days, no further), keeps it, or a step down (halves it: 60
  to 30, 30 to 14, …, 2 to 1, not below), and the next date is that many days after its own day;
  a late review counts all the same. Runs between two dates count only for the figures.
- **The grade.** Wrong notes, and in rhythm mode missed ones too (extra notes are rhythm mode's
  wrong notes), are counted against the run's notes: in rhythm mode the notes due; in wait mode
  the keys the whole piece asks for with its repeats played or skipped, which the piece's facts now
  carry (`PieceFacts.notes`, locked for the library by its test, filled in for an imported piece
  when it is next listed; until then the run's step count stands in, which is stricter). At most
  one in 50, and in rhythm mode at least 80 % of the notes in time, and in wait mode no bar whose
  mean time per step is over twice the run's median step (each step capped at 60 s), moves it up;
  more than one in 10 moves it down; anything else keeps it. A wait run whose step records are not
  here can keep the interval, not move it up.
- **Due** is the day of the date or later. The Pieces page lists the due pieces first, the longest
  overdue at the top, each with how long since it was last played through (the review that set the
  date) and "Take out of review"; each library card says "review due", "review in n days" or "out
  of review". The home page says "Due for review: n pieces" with the first three and how long it
  has been. A piece's Options have "Review schedule" (on or off) with where it stands.
- **Taken out of review.** An imported piece carries `review: false` on its record: a change of the
  piece (it sets `updatedAt`), so it syncs and imports; `SYNC_SCHEMA` 16 makes builds that stripped
  the field pull everything again. A built-in piece has no record of its own, so its choice is a
  `meta` entry (`review:off:<id>`) on this device, kept beside the deletions. Its schedule goes on
  being computed; putting it back shows it as it stands.
- **Known limit: a built-in piece is taken out of review on one device only.** Its `meta` entry is
  neither synced nor exported, so the piece stays in review on the user's other devices and comes
  back in review after an import into a new browser. A small synced record for it (like a piece
  deletion's) can follow later.
- **Reading the records.** The Pieces page and the home page read the step records of each piece
  with a completed run without a loop (the Pieces page's cards read them already); they stay in
  the store's cache for the page's life.

## Clarifications (decided during P7)

- **Memory mode** runs on wait mode's engine (the same steps, keys, loop, start bar, other hand and
  takes). Its stage is chosen first under Options ("Score": all shown, every other bar, first bar of
  each phrase, first bar only), so the control row stays one row, kept per piece in this browser with the hands and tempo; changing
  it starts a new run. Show keys marks nothing in memory mode.
- **Phrases** (`core/memory.ts`). The parser now keeps a measure's double or final barline
  (`doubleBar`, also one drawn at the start of the next measure) and its rehearsal mark
  (`rehearsal`); the checksum covers the notes only, so records stay valid. A section begins at the
  first bar, after a double bar or a `:|`, at a `|:`, at a rehearsal mark and where a volta begins;
  within a section a phrase is four written bars. An upbeat (a first bar shorter than its time
  signature) belongs to the first phrase, which is counted from the bar after it.
- **The stages.** Every other bar is counted within each phrase, so each phrase starts shown; the
  first bar of each phrase shows the upbeat with it; first bar only is the run's first bar (the
  start bar, or the loop's), and with an upbeat the bar after it. The run's first bar is shown at
  every stage.
- **Hidden** is drawn on Verovio's own drawing: a hidden bar's notes, rests, beams, ledger lines and
  markings are hidden; its staff lines, barline, clefs, key and time signatures (and the system's
  own bar number) stay, and its number stands in the middle of its staff. A slur or tie drawn from
  a hidden bar is hidden whole.
- **Prompts.** A wrong key on a step of a hidden bar is a prompt (and still a wrong note): that
  step's notes show through, and its keys on the keyboard, for 1.5 s. **Peek** (the P key, or the
  button, held; P plays no note) shows the bar the run is on while held, one prompt per press. In a
  bar that is shown neither counts. Prompts are kept per step.
- **Start anywhere** picks at random a phrase start among the bars practised (the loop's, if one
  is set), another than the one the run starts from when there is one, makes it the start bar and
  shows that bar for 2 s.
- **Records.** Steps have `mode: 'memory'`, `prompts` and `stage`; the session has `mode: 'memory'`
  and `memory: { stage, prompts }`; the take `mode: 'memory'` (read as wait mode's). Validation is
  strict both ways: a memory step must have both, any other none. Older builds refuse them, so
  `SYNC_SCHEMA` 17 makes a build that learns them pull everything again; the export format stays at
  8, since they are new kinds of record in lists the file has (an older build reports them as
  records it could not read and imports the rest).
- **The summary** adds the prompts and the bars that needed them, most first; its loop button
  loops the bar with the most prompts (else the slowest). Your runs and the practice log name
  memory runs, with the stage and the prompts.
- **Weak bars by Memory**: per written bar, the prompts per run over the last 5 memory runs that
  played it (both passes together), on a scale with edges at 0.1, 0.25, 0.5, 1, 2 and 3 around a
  0.5 anchor (a prompt every other run) at the other anchors' place, with the same data rules (2
  runs, 3 steps); the mark is wrong notes per step. Steady: no prompt in the last 3 memory runs.
  Hesitation keeps counting wait mode's records only.
- **The review schedule** counts a memory run to the end as a wait run (its wrong notes and its
  bars' times); prompts are not counted against it.

## Lead sheets (H3 of [HARMONY.md](HARMONY.md))

What a lead sheet changes on the practice page; the rules are HARMONY.md's ("Clarifications
(decided during H3)").

- **Left hand** (Options, when the score has chord symbols): as written, or a pattern made from
  the symbols and written into the score on the bass staff. The piece with a pattern is another
  piece of notes: it has its own checksum, so its steps, weak bars, steady bars and takes are its
  own, and a run's session carries the pattern (`leftHand`).
- **Hands.** A hand the piece has no notes for is disabled, and a piece last practised with it is
  practised with the other one; with a lead sheet's left hand as written, Both is the right hand.
- **The review schedule** uses the written piece's facts (the melody): see HARMONY.md.

## Transposing (H4 of [HARMONY.md](HARMONY.md))

What the Key control changes on the practice page; the rules are HARMONY.md's ("Clarifications
(decided during H4)").

- **Key** (Options, on every piece but a progression): up to six semitones up or down. The score
  is the written file transposed in our own code and then drawn and parsed, so the cursor, Listen,
  the other hand, wait, rhythm and memory mode, play back and the on-screen keyboard are all in
  the new key.
- **Records.** A transposed run keeps the piece's checksum (the written key's) and says how far it
  was moved (`transpose` on its steps, its session and its take). Weak bars and the library's
  steady bars count runs in the written key unless **All keys** is ticked; Your runs names each
  run's transposition and plays any of them back.
- **The review schedule** (P6) counts runs in the written key only.

## A take as a MIDI file (G6b)

Status: planned. A run is kept as a take (EXPRESSION.md, X0) and played back in the app (P5), and
that is as far as it goes: it cannot be heard in another program, put into a notation program or
sent to a teacher as sound.

- **Save as MIDI** on each of **Your runs** that has a take, and on the run just played (beside
  **Play back**); on Improvise's takes too (the player's keys; the backing is not in the take).
- The file is a Standard MIDI File, format 0: one track, 480 ticks to the quarter note, on
  channel 1, with every key down and up with its velocity and the three pedals as the take has
  them (controllers 64, 66 and 67). Time 0 is the take's first event.
- **Tempo.** A run in rhythm mode was played against a click: the file carries the score's
  tempo marks times the run's percent (and its time signatures), so the bars line up in a
  notation program; the run's count-in is left out and a key before the first bar is moved to
  time 0. A run in wait or memory mode has no beat: the file is at ♩ = 120 with every event at
  its own time, and no time signature claimed.
- Named `<title> <yyyy-mm-dd hh.mm>.mid` (the characters a file name cannot have are left out),
  with the piece's title as the track name. Made on the device and saved by the browser; in the
  Apple app handed to the share sheet or the save panel, as the backup is.
- `core/smfWrite.ts`, pure, with tests that read the bytes back.

## Milestones

1. ✓ **P0 Spike** — choose the renderer (OpenSheetMusicDisplay vs Verovio vs other), prove
   MusicXML → model → steps → cursor on two real pieces, research redistributable sources for
   the built-in library, decide repeats and the click. Report; no production UI.
2. ✓ **P1 Pieces + wait mode** — library, import, score view, wait mode, hands, loop.
3. ✓ **P2 MIDI output** — output selection, demo playback, accompaniment.
4. ✓ **P3 Records** — persistence (DB v3), measure heatmap, log and streak integration, export.
5. ✓ **P4 Rhythm mode** — metronome, calibration, timing analysis.
6. ✓ **P5 Play back** — takes played back with the cursor; compare with the written version.
7. ✓ **P6 Review schedule** — review intervals, due pieces on Pieces and Home.
8. ✓ **P7 Memorising** — memory mode, fading stages, prompts, start anywhere.

# dacapo — Pieces specification

Status: planned (after MVP 0.1.0). This extends [MVP.md](MVP.md); its principles and fixed
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
  is the set of pitches that start together. Grace notes and ornaments are skipped in the first
  version (documented), repeats handled as decided in the spike.
- Mapping from steps to renderer positions so the cursor and highlights line up.

## Practice modes

### Wait mode (default)

- The cursor sits on the current step. The step is complete when every required pitch has been
  pressed since the step appeared (any order; a key already held from the previous step does
  not count again unless the score repeats it). Wrong notes are counted and shown, never block.
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
  / late, missed and extra notes.
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
  (`scripts/pieces/`), and its notes are locked by a checksum test.

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
  another version), the hands, the written bar and pass, the time, the wrong notes and when.
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

## Milestones

1. ✓ **P0 Spike** — choose the renderer (OpenSheetMusicDisplay vs Verovio vs other), prove
   MusicXML → model → steps → cursor on two real pieces, research redistributable sources for
   the built-in library, decide repeats and the click. Report; no production UI.
2. ✓ **P1 Pieces + wait mode** — library, import, score view, wait mode, hands, loop.
3. ✓ **P2 MIDI output** — output selection, demo playback, accompaniment.
4. ✓ **P3 Records** — persistence (DB v3), measure heatmap, log and streak integration, export.
5. ✓ **P4 Rhythm mode** — metronome, calibration, timing analysis.

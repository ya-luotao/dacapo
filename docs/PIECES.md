# dacapo — Pieces specification

Status: planned (after MVP 0.1.0). This extends [MVP.md](MVP.md); its principles and fixed
decisions still apply (staff first, local data, English of record, i18n en + zh-CN, 3-day
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
  No audio synthesis in the app for notes.
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
- The click is the one exception to "no audio": a short Web Audio click, or a MIDI click on the
  instrument if it supports it — decide in the spike.

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

## Milestones

1. **P0 Spike** — choose the renderer (OpenSheetMusicDisplay vs Verovio vs other), prove
   MusicXML → model → steps → cursor on two real pieces, research redistributable sources for
   the built-in library, decide repeats and the click. Report; no production UI.
2. **P1 Pieces + wait mode** — library, import, score view, wait mode, hands, loop.
3. **P2 MIDI output** — output selection, demo playback, accompaniment.
4. **P3 Records** — persistence (DB v2), measure heatmap, log and streak integration, export.
5. **P4 Rhythm mode** — metronome, calibration, timing analysis.

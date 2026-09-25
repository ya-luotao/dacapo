# Changelog

All notable changes to dacapo are listed here. Versions follow
[Semantic Versioning](https://semver.org/); the export file format has its own version number,
which is noted when it changes.

## Unreleased

Export format version 4: the file now includes imported pieces (from version 2), piece practice
sessions and their step records (from version 3), and rhythm-mode steps with their timings.
Version 1, 2 and 3 files still import.

### Pieces and wait mode (P1)

- A **Pieces** page. The built-in library has six public-domain pieces, by level from Initial to
  grade 5: Beethoven's Ode to Joy and Für Elise (A section), Petzold's Minuet in G, Burgmüller's
  Arabesque, Schumann's Soldiers' March and Bach's Prelude in C. Each is checked note for note
  against an independent source where one exists, has no fingering, and records its provenance.
- **Import** MusicXML (`.musicxml`, `.xml`, compressed `.mxl`) with a button or by drag and drop.
  The report lists what was left out (grace notes, ornaments, D.C./D.S.) and how many notes could
  not be placed on the drawn score. Imported pieces can be renamed or deleted, and their hands
  reassigned staff by staff. In a score with a voice or other instruments, only the piano part is
  practised.
- **Wait mode** on the real score, drawn by Verovio. The current step is marked on the score and
  its notes turn green as you play them; a wrong key flashes on a keyboard of the piece's range.
  You can practise the right hand, the left or both, loop bars A–B, start from any bar, and play
  or skip the repeats; the score scrolls with you. A "Show keys" hint marks the keys to play.
  When you finish you get the time, the wrong notes and the slowest bars.
- Imported pieces are stored in the browser (IndexedDB version 2) and included in the export.
- Settings has an About section with the licences of the third-party software, fonts and music
  ([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).

### Sound from the instrument (P2)

- **Listen**: the instrument plays the selected hands and bars over MIDI (the app itself makes no
  sound), with the cursor and the score following. Tempo from 40 % to 200 % of the score's, with
  the resulting ♩ = value shown. A loop goes round until stopped; pause and resume keep the place.
- **Other hand**: practising one hand in wait mode, the instrument plays the other hand (and any
  other parts) each time you complete a step, in time with the written rhythm at the chosen tempo.
- Settings has a **Sound** section: the MIDI output (by default the keyboard's own), a test note,
  and the volume of the other hand. The Play page names the output when it is not the keyboard.
- The instrument is silenced whenever playback stops, the output changes or goes away, or the page
  is hidden or left. Notes our own output might echo back are not counted as key presses.

### Practice records and the measure heatmap (P3)

- Every completed wait-mode step is stored (IndexedDB version 3, a `pieceSteps` store read one
  piece at a time), and every run becomes a **piece session** in the log: hands, bars, tempo, time
  and wrong notes. Piece sessions count towards today's minutes and the streak, and a run cut off
  by a closed tab is recovered on the next visit. Listening to the demo is not practice time.
- **Weak bars** on the practice view: each bar is tinted by the median time per step in your last
  five runs with those hands, with wrong notes per step marked in the corner. Details on hover,
  focus or tap, a table sorted weakest first, and **Loop the weakest bars**. Runs recorded on an
  older version of a score are kept but left out, with a note.
- Library cards show when a piece was last practised, how many runs, and how many bars are steady.
- The tempo and the hands are remembered per piece. Deleting an imported piece can also delete its
  practice records; its sessions stay in the log.

### Rhythm mode (P4)

- A **Wait / Rhythm** switch on the practice view. In rhythm mode a metronome gives one bar of
  count-in and the cursor moves in time over the chosen hands, bars, repeats and tempo; a loop goes
  round until Stop. The click is a short tick from the computer (the one sound dacapo makes
  itself), on every beat, the dotted beat in 6/8, 9/8 and 12/8, accented on the first; it can play
  throughout, only for the count-in, or not at all, at the volume you choose. Practising one hand,
  the instrument plays the other hand in time.
- Every note is timed against the beat (each key of a chord on its own): early or late by how many
  milliseconds, missed, or extra. While you play, a small mark shows how the last note was timed.
  Afterwards a sheet shows how many notes you hit and how many were within ±50 ms, missed and extra
  notes, whether you tend to play early or late, where you sped up or slowed down, and every note on
  a chart (with a table).
- **Latency calibration** (Settings → Sound, and offered before the first rhythm run): tap along
  with 16 clicks; the delay of your speakers and keyboard is measured and taken off every note.
  Settings explains how to hear the click through the MP11SE (LINE IN) and why not to use
  Bluetooth.
- Rhythm runs are stored with their timings and appear in the log ("Piece, in rhythm", with the
  share of notes in time); they count towards the minutes and the streak. **Weak bars** can show
  hesitation (wait mode) or timing (rhythm mode): the median distance from the beat per bar, with
  missed and extra notes marked.
- The practice controls are tidier: the mode, the hands, the loop and the tempo in one row, the
  settings that change rarely (start bar, repeats, other hand, show keys, weak bars, the click) under
  **Options**, and Listen, Start and Restart under the score. The weak-bar details now always show
  in full, also for a bar on the first line of the score.

## 0.1.0 — 2026-09-25

The first release: the MVP described in [docs/MVP.md](docs/MVP.md). Export format version 1.

### Visual design

- "Engraved score" look: warm paper and ink, hairline rules, one urtext-blue accent, and a
  concert-hall dark theme in warm charcoal and ivory.
- Source Serif 4 and Source Sans 3, self-hosted (Latin subsets, about 78 KB); Chinese uses
  system Song and PingFang fonts.
- The flashcard is a sheet on a music stand, sized so a live session always fits on one screen;
  the on-screen piano is drawn as ivory and ebony keys under a felt strip.
- Refined Play, Progress, heatmap, Settings, banners and empty states.

### Scaffold (M1)

- Vite, React and TypeScript (strict) with pnpm; ESLint, Prettier, Vitest and a GitHub Actions
  workflow that runs typecheck, lint, tests and the build.
- English and Simplified Chinese from a typed dictionary: a missing or extra key is a compile
  error. The language follows the browser and can be changed in Settings.
- Play, Read, Progress and Settings routes; light and dark themes following the system, with a
  manual override.

### Input and live keyboard (M2)

- Web MIDI input with hot-plugging, the computer keyboard as a fallback (two rows like a piano,
  `Z`/`X` for the octave) and click or touch on the on-screen piano, all merged into one stream
  of notes.
- Play page: an 88-key piano with velocity shading, a sustain pedal indicator, the notes just
  played and the MIDI device status with help when something is missing.

### Sight-reading flashcards (M3)

- Seven levels, from middle C position (L1) to ledger lines (L6) and sharps and flats (L7).
- One whole note on a grand staff drawn with VexFlow 5 and the bundled Bravura font (no CDN).
- The key must be pressed in the right octave. Every first answer is scored with its reaction
  time, measured from the moment the card is painted.
- Cards are drawn by a weakness model: slow, often-missed and new notes come up more often.
- Optional letter-name hint, 10/20/50-card sessions, a summary with the slowest and missed
  notes, and a mastery rule (90 % correct, median under 2 s over the last 40 cards).

### Practice data and log (M4)

- Everything is saved in IndexedDB, with an in-memory fallback and a warning when storage is
  not available. Open tabs stay in step.
- Free play on the Play page is recorded as practice time.
- Progress page: today's minutes, the current and longest streak (5 minutes a day, by local
  date), a 30-day chart with a table view, and the list of sessions.
- Export all data and preferences to a JSON file; import it with validation, a preview and a
  merge that never drops existing data.

### Weakness heatmap (M5)

- Progress page: every practised note on a grand staff (wrapping into several systems on
  narrow screens) or on the keyboard, coloured by typical reaction time on a fixed scale around
  the 1.5 s target, with a bar for the wrong answers among the last 10.
- Notes with too few answers are marked as "not enough data" instead of being coloured.
- Details on hover, tap or keyboard focus (arrow keys move between notes), the three weakest
  notes by the same weight the card sampler uses, a filter by level and a sortable table.
- Updates live as you practise, in the same tab or another one.

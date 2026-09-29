# Changelog

All notable changes to dacapo are listed here. Versions follow
[Semantic Versioning](https://semver.org/); the export file format has its own version number,
which is noted when it changes.

## Unreleased

Export format version 5: the file now includes imported pieces (from version 2), piece practice
sessions and their step records (from version 3), rhythm-mode steps with their timings (from
version 4), and scale sessions with every scale run as played. Version 1 to 4 files still import.

### A new address: [playdacapo.com](https://playdacapo.com/)

- The web app moves from `ya-luotao.github.io/dacapo` to **playdacapo.com**, served by Cloudflare
  with the sync service. Every link to the old address, routes included, now goes to the new one.
- A browser keeps what it stores per address, so practice kept at the old address without an
  account does not come along; with an account, signing in at the new address brings it back.
- playdacapo.com counts visits with Cloudflare Web Analytics: no cookies, no personal data,
  nothing about practice. Only the official site has it; the Apple app and any other build do not.

### Accounts and sync, under way ([docs/SYNC.md](docs/SYNC.md))

- An optional **account** in Settings: sign in with your email address and a 6-digit code sent to
  it, and your sessions, answers, pieces, piece practice records and scale runs sync between your
  devices. The account section shows when the last sync was, syncs now on request, signs out
  (your practice stays on the device) and deletes the account with everything on the service.
  Without an account nothing changes and no request is made. Only the official builds have it.
- Syncing waits while you practise, so it never touches the timing of what is being measured, and
  runs at start, when practising stops, a little after a change, when the app comes back to the
  front, and every 5 minutes.
- A **public profile**, off until you turn it on ([docs/PROFILE.md](docs/PROFILE.md)): choose a
  username in Settings → Account, and `playdacapo.com/<username>` shows your year of practice as a
  grid of weeks, your streaks and your total time, like a GitHub profile. "Grid only" keeps what
  you practised private; "Grid and activity" also lists each day's reading, free play, pieces and
  scales, with piece titles only if you turn them on. Accuracy, reaction times and your email
  address are never public; search engines are asked not to list the page, and every page has a
  link to report it.
- Storage moves to IndexedDB version 5 (an outbox of records to send, used only while signed in).
- A deleted piece stays deleted: importing an export file made before the deletion no longer
  brings it back, nor, if its records were deleted with it, its step records. Importing the
  MusicXML file again adds it as a new piece.
- A reload after an import no longer finishes a piece run that is still being played in another
  tab.

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
  round until Stop. The click is a short tick from the computer, on every beat, the dotted beat in 6/8, 9/8 and 12/8, accented on the first; it can play
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

### Built-in piano

- dacapo can play the piano itself: a Yamaha C5 grand sampled by Alexander Holm (the Salamander
  Grand Piano V3, CC BY 3.0), three of its velocity layers every minor third, retuned as its
  retuned SFZ does, with dampers that stop a string when its key comes up (none from F♯6 up, as
  on a real piano). Its samples (about 4 MB of MP3) are loaded only once it is needed.
- **Built-in piano** is a new choice under Settings → Sound → Sound out through, and "Automatic"
  (formerly "Same as the keyboard") takes it when no connected keyboard has a MIDI output, after
  waiting a moment for MIDI access. Demos, the other hand in wait and rhythm mode and the test note
  play through it exactly as through an instrument, in time with the click, and it is silenced in
  the same cases.
- **The keys you play** sound on the built-in piano: the computer keyboard and the on-screen keys
  by default, and a MIDI keyboard when you turn that on (for one without a sound of its own),
  with the sustain pedal. Stopping a demo does not cut the notes you are holding.
- Settings has the built-in piano's volume and a test chord; the About page credits the samples
  with their licence.

### Metronome

- A **Metronome** page: a walnut-and-brass Maelzel metronome whose pendulum crosses the centre on
  the beat you hear (the output latency the browser reports, and the latency calibration where it
  makes the sound later). The weight slides to where it sits on a real one (the scale is spaced by
  the physics of the pendulum, Maelzel's marks carried from 20 to 300, with the Italian tempo marks
  engraved beside them); the rod is released on the first beat, settles when stopped, and a glint
  crosses the weight on accented beats. The beats are studs inlaid in the walnut stand it
  stands on.
  20–300 BPM with − / +, a slider, the arrow keys and tap tempo (the median of the last taps); the
  Italian tempo mark with its range; time signatures from 2/4 to 12/8 (compound meters click the
  dotted beat); each beat accented, plain or muted; subdivisions in 2, 3 or 4; four synthesized
  sounds (wood, click, beep, and a mechanical one: an escapement's tick and tock, with a small
  bell on the accent), volume and a visual-only mode; a **tempo trainer** that speeds up by a
  few BPM every few bars, or plays some bars and leaves some silent. With reduced motion the
  pendulum stays in its clip and the studs keep time. Keys: Space, ← / → or − / + (Shift: by 10) and
  T; the computer keyboard does not play notes on this page.
- The clicks are scheduled on the audio clock, every one computed from the start of its tempo (never
  by adding up intervals), so the metronome does not drift, tempo changes land on the next beat, and
  it keeps time in a background tab.
- A **metronome chip in the header** on Play, Read and Pieces: start and stop, the beats, the tempo;
  its panel has − / +, tap tempo, "Piece tempo" in wait mode (the piece's tempo at the chosen
  percentage, in its meter) and a link to the page. A rhythm run or a latency calibration pauses
  the metronome, and the chip says so. Settings are kept in this browser.
- In the Apple app the metronome keeps the screen on while it runs and stops when the app goes to
  the background; in a browser a hidden tab keeps ticking.

### Scales (S1)

- A **Scales** page: major, natural, harmonic and melodic minor and chromatic scales in every key
  (one spelling each, as exam syllabuses list them), one to four octaves, right or left hand. The
  scale is drawn on the score with its key signature, accidentals up to double sharps, clef
  changes, 8va and 15ma lines and **Hanon's fingering** (The Virtuoso Pianist, Nos. 39 and 40,
  G. Schirmer 1900, transcribed twice and checked digit by digit; natural minor has none, as
  Hanon prints none).
- Play at your own tempo, no click: the run starts at the scale's first key and the next run
  starts when you play it again. Wrong, missed and extra notes are sorted out by aligning what you
  played with the scale, so one slip costs one note.
- **How even it was**: the spread of the time between notes, judged against your own tempo (a run
  that speeds up is not called uneven for it), as the literature measures it, against the
  professional pianists' 8–9 ms; hesitations apart; the tempo and whether it moved; each note's
  deviation from the line through its neighbours on a chart (with the fingering, the turn and the
  crossings), in a table and as colour on the score; where the thumb crossings run late or
  early; and, from a MIDI keyboard, accents and how even the loudness was. Runs are not saved yet
  (S2).
- The navigation gains a **More** menu for the items the header has no room for, fitted to the
  width in every language; below tablet width the header takes two rows.

### Scales hands together, and legato (S3)

- **Both hands**, an octave apart: the cursor waits for each pair of keys, the run starts at either
  tonic, and afterwards each hand has its figures and its chart. How far apart the hands were, and
  whether one comes ahead on average, judged so that chance in a loose player is not called a
  habit.
- **Legato**: how each key joins the next, from the releases recorded since S2 — held into the next
  or a gap, the notes where the line breaks (most often before the thumb), detached playing, and
  a word when the pedal joins the sound anyway. A new row on the chart.
- The hands-together alignment keeps to a band: a four-octave run takes about a millisecond instead
  of 20–35, and at most half a megabyte. Places over the runs of hands together are named at
  stricter thresholds, so a steady player is not told of problems twice as often.

### Scale records and progress (S2)

- Every scale run is kept (IndexedDB version 4): all its keys, their releases and the pedal, the
  raw data every figure is recomputed from. Scale sessions join the practice log, today's minutes
  and the streak.
- **This scale so far**: its runs, the latest and the best spread, the last day played, a chart of
  the timing spread over the last 30 days against the professional reference, and the places that
  come late or early every time over the last runs — the thumb passing under going up, say, or a
  note of the scale where there is no fingering. Places are judged by groups of notes over the
  runs, so a steady player is not told of problems that are only chance.
- **Your scales**: every scale played, least even first, with the one to play next.
- Export format 5 includes the scale runs; formats 1–4 still import.

### Focus mode and fingering on the keyboard

- **Focus mode** on a piece and on the Scales page: the header and the settings give way, and one
  row above the score keeps the way back, larger or smaller notes, the keyboard on or off,
  Settings (unfolds the controls), the metronome, full screen and Exit focus (or Escape). It is
  remembered in this browser.
- **Fingering on the keyboard.** Imported pieces with fingering show the finger on each key marked
  by Show keys. On the Scales page the keys to start on carry their finger, and **Show the next
  key** marks each next key with its finger and names a thumb crossing just ahead.
- In a browser, the screen now stays on during practice too, where it supports the Screen Wake
  Lock API.

### A year of practice on the Progress page

- The practice history can switch from the 30-day bars to a **year grid**: a column per week, a
  square per day, shaded from a little practice to 30 minutes or more, with the daily goal as the
  step between the palest shade and the next. Weeks start on Monday in Simplified Chinese and on
  Sunday otherwise; on a phone the grid scrolls and opens on today. "Show as a table" lists the
  months. The choice is remembered in this browser.

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

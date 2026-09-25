# Changelog

All notable changes to dacapo are listed here. Versions follow
[Semantic Versioning](https://semver.org/); the export file format has its own version number,
which is noted when it changes.

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

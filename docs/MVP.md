# dacapo — MVP specification

dacapo is an open-source web app that helps a self-taught beginner learn the piano
with a MIDI keyboard. The MVP focuses on the first real bottleneck for beginners:
**reading the grand staff and finding the key fast**, and on making progress visible.

## Principles

- **Staff first.** Notes are shown on a real grand staff. No Synthesia-style falling notes.
- **The user owns the data.** Everything stays local (IndexedDB); export/import as JSON.
- **Measure, don't guess.** Every answer records correctness and reaction time; the app
  practises what you are weakest at.
- **Small and dependable** beats feature-rich. No backend, minimal dependencies.

## Fixed technical decisions

| Area | Decision |
|---|---|
| Build | Vite + TypeScript (`strict`), React, **pnpm** |
| Notation | VexFlow **5.x** — read the installed package's README/types; do not use 4.x APIs from memory |
| Storage | IndexedDB via `idb` (thin, typed, promise-based) |
| Tests | Vitest (+ `fake-indexeddb` for storage tests), Testing Library only where it pays off |
| Quality | ESLint (flat config) + Prettier + `.editorconfig`; GitHub Actions CI: typecheck, lint, test, build |
| Audio | **None** in the MVP — the piano makes the sound |
| Browsers | Chrome / Edge recommended. Support is decided by feature detection (`navigator.requestMIDIAccess`), never by browser name; without it the app shows a clear notice and still works with the fallback input |
| Pitch naming | Letter names in every UI language (no solfège or numbered notation in the MVP), scientific pitch notation: C4 = middle C = MIDI 60 |
| i18n | English (`en`, source of truth) and Simplified Chinese (`zh-CN`). Tiny typed dictionary, no i18n library. Missing keys must be a compile error. Auto-detect from `navigator.language`, user toggle persisted in `localStorage` (wrapped in try/catch) |
| License | MIT |
| Language of record | English for all code, comments, commits, docs and issues |

## Architecture

```
src/
  core/        pure, framework-free domain logic (100% unit-testable)
    note.ts        MIDI number <-> name/octave/staff position, white/black key, ranges
    levels.ts      sight-reading level definitions
    weakness.ts    per-note stats update + weighted next-card sampling
    session.ts     session state machine and summary stats
    streak.ts      daily totals and streak computation (local-date aware)
  input/       NoteInput abstraction
    types.ts       NoteInput interface, NoteEvent {type:'on'|'off', midi, velocity, time}
    webmidi.ts     Web MIDI implementation
    keyboard.ts    computer-keyboard fallback
    pointer.ts     click/tap on the on-screen piano
    hub.ts         merges sources, tracks held notes + sustain pedal
  storage/     IndexedDB schema, migrations, repositories, export/import
  i18n/        dictionaries + useT() hook + locale switcher
  lib/         small shared utilities (e.g. the guarded localStorage wrapper for preferences)
  ui/          React components and screens
```

Rules: `core/` imports nothing from `ui/`, `input/`, `storage/` or React. UI reads
domain state through small hooks. The `rng` and the clock are injected into `core/`
functions so tests are deterministic.

### Input

- `NoteInput` emits `NoteEvent`s; `hub.ts` merges all active sources so the app never
  cares where a note came from.
- Web MIDI: request access without sysex; subscribe to every input; re-subscribe on
  `onstatechange` (hot-plug); treat `0x90` with velocity 0 as note-off; track CC64
  (sustain) state. Expose device status: `pending` / `unsupported` / `no-permission` /
  `no-device` / `connected(names[])`. Sources emit an `InputEvent` union (note, sustain,
  reset) tagged with a port, so the hub can merge holders across devices and pointers.
- Keyboard fallback: two rows mapped like a piano (`A W S E D F T G Y H U J K` =
  C..C, black keys on the upper row), `Z`/`X` shift octave down/up, default octave 4.
  Ignore `event.repeat`. Disabled while focus is in a text input.
- Pointer: clicking a key on the on-screen piano sends on/off.
- **React StrictMode** mounts effects twice — subscriptions must be idempotent and
  cleaned up; there must never be two MIDI listeners after a remount.
- **Timing**: reaction time = `performance.now()` at key press − `performance.now()`
  captured when the card is actually painted (take it in a `requestAnimationFrame`
  after render). MIDIMessageEvent `timeStamp` is on the same clock and may be used
  for the press side; keyboard/pointer events use `event.timeStamp`.

## Features

### F1 — Live keyboard

- 88-key on-screen piano (A0–C8), responsive; on small screens it can scroll or show a
  window around the active range, never horizontal page scroll.
- Pressed keys light up; opacity/shade follows velocity. Sustain pedal indicator.
- Readout of the last note(s) pressed (e.g. `C4`, chord shows all held notes).
- Device status indicator with the connected device name, plus help text when
  unsupported / no permission / no device.

### F2 — Sight-reading flashcards

- One note at a time on a grand staff (treble + bass, brace, whole note).
- The user presses the key; **exact octave** required. Result: correct/wrong, reaction ms.
- Feedback: correct → brief positive flash, next card after ~400 ms. Wrong → show the
  pressed note in red and the target key highlighted on the on-screen piano; the card
  stays until the correct key is pressed (the first attempt is what gets scored).
- Optional "show letter name" hint toggle (off by default; hinted answers are recorded
  but excluded from reaction-time stats).
- Session length: 20 cards by default (10 / 20 / 50 selectable).
- Levels (natural notes only until L7):

| Level | Name | Notes |
|---|---|---|
| L1 | Treble: middle C position | C4–G4 |
| L2 | Treble: C4–C5 | C4–C5 |
| L3 | Bass: middle C position | F3–C4 (bass clef) |
| L4 | Bass: C3–C4 | C3–C4 |
| L5 | Grand staff | G2–G5, clef by range (C4 may appear on either staff) |
| L6 | Ledger lines | C2–C6 including ledger lines |
| L7 | Sharps & flats | L5 range with ♯/♭ (both spellings of the same key are correct presses) |

- A level shows as "mastered" at ≥ 90 % accuracy and median reaction < 2 s over the
  last 40 cards of that level; the next level is suggested, never forced.

### Weakness model (`core/weakness.ts`)

Not FSRS. One record per (level-independent) written note, keyed by pitch spelling +
staff (e.g. `C4@treble`, `C4@bass` are separate — reading them is a different skill):

```ts
{ key, attempts, correct, errors, ewmaMs, lastSeen, recent: boolean[] /* last 10 */ }
```

- `ewmaMs` uses α = 0.3 over correct, un-hinted answers.
- Sampling weight for candidate notes of the current level:
  `w = base(novelty) × (1 + errorRate × 3) × clamp(ewmaMs / targetMs, 0.5, 3)`,
  where unseen notes get a high novelty weight, `targetMs` = 1500.
- Never show the same note twice in a row. Pure function, `rng` injected, unit-tested
  for determinism and distribution sanity.

### F3 — Weakness heatmap

- Per-note visualization for all notes ever practised: laid out on the grand staff
  (primary) and on the keyboard (secondary), colour = mean reaction time,
  marker = error rate. Tooltip / tap shows attempts, accuracy, ms.
- Legend with units; works in light and dark themes; readable in both languages.

### F4 — Practice log

- Every flashcard session is saved: start, end, active duration, level, cards,
  accuracy, median reaction.
- "Free play" time on the Play route also counts (a session starts on the first
  note played while Play is open and ends after 60 s of inactivity or on leaving Play).
- Today's total minutes, current streak (days with ≥ 5 min, local date), 30-day history
  view.
- Export all data to a JSON file (versioned schema) and import it back
  (validate; merge by id; never silently drop data). The export includes user
  preferences (locale, theme, input options) alongside the IndexedDB data.

### Storage

- `idb` database `dacapo`, explicit `version` with an `upgrade` switch that handles
  every older version in order.
- Stores: `noteStats` (key: note key), `sessions` (key: id, index by start),
  `attempts` (raw per-card attempts; key: auto, index by session and by note), `meta`.
- Raw attempts are kept so stats can be recomputed if the model changes.
- If IndexedDB is unavailable (private mode, blocked), the app still works with an
  in-memory store and shows a non-blocking warning.

## UI

- Screens: **Play** (live keyboard), **Read** (flashcards), **Progress** (heatmap +
  log), **Settings** (language, input options, data export/import).
- Light/dark via `prefers-color-scheme` plus a manual override. Accessible: keyboard
  navigable, visible focus, colour is never the only signal (icons/text too).
- Designed so it can sit on a laptop or tablet next to the piano: large staff, large
  feedback, minimal chrome.

## Milestones

Each milestone ends green (typecheck, lint, test, build) and is committed separately.

1. **M1 Scaffold** — Vite/React/TS/pnpm, ESLint/Prettier/editorconfig, Vitest, CI
   workflow, i18n skeleton (en + zh-CN) with locale switcher, app shell with the four
   routes (placeholders), README (what/why, requirements, dev setup), CONTRIBUTING.
2. **M2 Input + live keyboard** — `core/note.ts`, `input/*`, F1.
3. **M3 Flashcards** — VexFlow grand staff, `core/levels.ts`, `core/weakness.ts`,
   `core/session.ts`, F2 (in-memory first).
4. **M4 Persistence + log** — `storage/*`, F4, export/import, free-play tracking.
5. **M5 Heatmap** — F3.

## Out of scope for the MVP

Audio output, rhythm/metronome, scale evenness analysis, piece practice / wait mode,
theory and ear training, accounts/sync, AI coaching. These are the roadmap after the
MVP is used daily.

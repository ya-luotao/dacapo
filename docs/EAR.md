# dacapo — Theory and ear training specification

Status: planned (after Pieces). This extends [MVP.md](MVP.md) and [PIECES.md](PIECES.md); their
principles and fixed decisions still apply (staff first, measure don't guess, local data, English of
record, every UI language, 3-day dependency cooldown, no backend).

Goal: hear what is played and know what is written — intervals, chords, keys and short melodies —
and answer the way a pianist does: **on the keyboard**. Buttons exist for what a keyboard cannot say
(a chord's name, an interval's quality), never as the only way to answer something that can be
played.

## Sound

Prompts sound through the output the rest of the app uses (`output/output.ts`): the instrument over
MIDI, or the built-in piano. No new audio code. With the output set to None the Ear page explains
why it needs sound and links to Settings → Sound; the theory drills (on the staff) need none.

- Prompts are scheduled on the scheduler like the demo, velocity 72, with the same silencing on
  stop, route change and hidden page.
- **The prompt is never the answer.** Keys pressed while a prompt plays do not count, as keys during
  the demo do not; the echo guard (`output/echo.ts`) drops our own notes coming back from an
  instrument. The answer clock starts when the prompt's last note ends.
- "Hear again" replays the prompt (a key: Space); replays are counted and recorded, never penalised
  in the score, but left out of the time figures.

## Ear training — a new **Ear** route

Each family has levels, like Read's L1–L7: a level is a pool of items, the next item favours the
ones you miss or answer slowly (the `weakness.ts` pattern, keyed by item instead of by note), and a
level is "mastered" at ≥ 90 % over its last 40 answers without a replay. A session is 10, 20 or 50
items.

### Intervals

- The app plays two notes: melodic up, melodic down, or together (harmonic). Levels grow the set: P8
  P5 M3 → + P4 m3 → + M2 m2 → + M6 m6 → + M7 m7 → + tritone, then compound intervals. The lower note
  is random within a comfortable range (C3–C5 by default).
- **Play it**: the lower note is shown on the on-screen keyboard; play the upper one (melodic down:
  the upper note is shown, play the lower). Correct is the exact key. This trains hearing and the
  hand together, and needs no terminology.
- **Name it**: buttons with the interval names (and number keys). Correct is the interval class; a
  wrong name is kept, so the app can show which intervals are confused.

### Chords

- Triads in root position: major / minor → + diminished / augmented → inversions → dominant, major,
  minor and half-diminished sevenths. Played block, or broken then block.
- **Play it**: the root is shown; play the chord. Any voicing and octave with exactly the chord's
  pitch classes is correct (the root need not be lowest, except in the inversion levels, where the
  bass must match).
- **Name it**: the quality (and inversion) by buttons.

### Echo (melodic dictation)

- A short melody — 3 notes, stepwise, in the first five notes of a major key, growing to 8 notes
  with leaps within an octave, then minor keys, then chromatic notes. The key is set by a tonic
  chord first, and the first note is shown on the keyboard.
- Play it back; correct is every key in order. A wrong key ends the attempt and shows where it went
  wrong (the melody is drawn on the staff after the answer, with your notes over it). Timing is not
  judged; rhythm dictation is a later milestone.

### Records and figures

- Per item: accuracy over the last 10, the median time to answer, replays. Per family: a **confusion
  table** of what was played against what was answered ("m6 answered as P5 in 4 of 12"), with the
  colour-plus-text rules of the note heatmap and a table view.

## Theory on the staff — new kinds of card on **Read**

Read already drills single notes. It gains a choice of what to read; each is a set of levels with
the same session, weakness and mastery rules.

- **Intervals** — two notes on one staff (melodic or harmonic): name the interval (number and
  quality). Spelling matters: C–D♯ is an augmented second, C–E♭ a minor third; the item is keyed by
  the written interval, so the two are separate items even though they sound alike.
- **Key signatures** — a key signature on the grand staff: play the tonic of the major key (any
  octave), then, in a later level, of its relative minor. Answered on the keyboard.
- **Chords** — a triad (later a seventh) on the staff: play it (exact keys, as written), or name its
  root and quality by buttons.

VexFlow draws the single-note cards today (`ui/staff/draw.ts`); it draws two notes, chords and key
signatures just as well, so the staff code grows rather than changing renderer. Spelled pitches use
`SpelledPitch` (`alter` −2…2), since augmented and diminished intervals need double sharps and
flats.

## Records

- Raw answers are the source of truth. An **answer** record: id, session, family (`interval`,
  `chord`, `echo`, `readInterval`, `keySignature`, `readChord`), level, item key (for example
  `int:M3:up`, `chord:min:1st`, `ks:3b:major`), how it was answered (`play` or `name`), the prompt
  (its keys, or the written notes), the answer (keys played or the name chosen), correct, ms,
  replays, when.
- IndexedDB, next version: an `answers` store with indexes by session and by item. Per-item stats
  are recomputed from it when the page opens (the records are small; the note stats' incremental
  update is not needed here). Export format, next version, includes answers; older files still
  import. Read's existing note cards keep their `attempts` store unchanged.
- Ear and theory sessions join the `SessionRecord` union, so minutes, the streak and the log count
  them. Progress gains a section per family: level mastery, the weakest items, the confusion table.

## UI and wording

- One card at a time, large, with the keyboard below; the result shows for ~400 ms (right) or until
  the next key (wrong, with the answer drawn and played once), as on Read.
- Interval, chord and key names are theory terms each language says its own way
  — 長3度 (ja), 大三度 (zh-CN, zh-TW), 장3도 (ko), major 3rd — so they get glossary rows in
  [TRANSLATING.md](TRANSLATING.md) and a review by a native speaker per language. Note names stay
  letter names everywhere.
- Navigation: Ear joins the nav with its More menu (see [SCALES.md](SCALES.md)).

## Milestones

1. **E0 Spike** — prompts through the scheduler on the MP11SE and the built-in piano, with the
   "prompt is not the answer" rules checked (keys during a prompt, echoes, a held key from the
   prompt), and whether the answer may start at the prompt's last note-on rather than its end (a
   learner echoes while the note still rings); VexFlow drawing of intervals, chords and key
   signatures with double accidentals; the answer buttons at 375 px in all five languages; the item
   keys and levels written out. Report; no production UI.
2. **E1 Intervals and chords by ear** — the Ear page, both ways of answering, levels, weakness
   sampling, mastery, the `answers` store, sessions and export.
3. **E2 Echo** — melodic dictation, drawing the melody with the answer after it.
4. **E3 Theory on Read** — interval, key-signature and chord cards.
5. **E4 Progress** — per-family progress and the confusion table.

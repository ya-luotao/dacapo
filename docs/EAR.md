# dacapo — Theory and ear training specification

Status: E1 and E2 are built (the Ear page: intervals, chords and melodies by ear); the instrument checks of E0 are
still to do on the MP11SE. This extends [MVP.md](MVP.md) and [PIECES.md](PIECES.md); their
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

### Clarifications (decided during E2)

- **Levels.** Each level is a kind of melody, drawn fresh every time by rules with an injected rng:
  EC1 3 notes, by step, within degrees 1–5 of C, G or F major · EC2 4 notes, steps and thirds,
  degrees 1–5 · EC3 5 notes, steps and thirds, degrees 1–8 (the octave, the 7th leading up) · EC4 6
  notes, leaps up to a fifth and the octave, majors up to two sharps or flats · EC5 8 notes, any
  leap within the octave · EC6 5–6 notes in natural and harmonic minor (A, E, D minor) · EC7 6–8
  notes with one or two chromatic neighbour or passing notes. A melody starts on 1, 3 or 5, ends on
  1 (EC1–EC5) or on any degree of the tonic chord, never repeats a note, and never leaps twice the
  same way in a row; after a leap of more than a third it turns back or moves by step.
- **Range and tempo.** The tonic is chosen so the melody lies within G3–E5. The key is set by the
  tonic triad (block, 900 ms), then a quarter's rest, then the melody in quarters at ♩ = 100 (each
  note 540 ms of its 600 ms). The answer window opens at the melody's last note-on.
- **Answering.** The first note is marked on the keyboard and is played too: every note counts, in
  order. The first wrong key ends the attempt; it is then drawn on the staff (the key signature,
  the melody in quarters, your notes up to the wrong one tinted over it, the wrong one marked),
  and the melody is played again once. Right: all keys in order. Hear again replays the chord and
  the melody and is counted; keys played before it stand (the answer goes on where it was).
- **Records.** One answer per melody: family `echo`, item `echo:<level>`, prompt the melody's keys,
  answer the keys played (up to and including the wrong one), `correct`, `ms` from the window
  opening to the last key, and the melody's key (`key`: its tonic as `scales.ts` names it and its
  scale, `major`, `naturalMinor` or `harmonicMinor`; required on echo answers, one of the level's
  keys), so the summary and the confusion table spell notes as the session did (B♭4 in F major,
  not A♯4). The confusion table (E4) uses the melodic interval into the first wrong note, as asked
  against as played ("up a 4th played as up a 5th").
- **Mastery** of an echo level is over its last 20 melodies without a replay, ≥ 90 % right; a
  session is 5, 10 or 20 melodies.
- **Words of the rules, as built.** "Never repeats a note" is never the same key twice in a row
  (EC1 would otherwise have no melody: as written it has exactly two, 1–2–1 and 3–2–1). "Starts
  on 1, 3 or 5" and "ends on 1" count those degrees in any octave. A **step** is a 2nd, a **skip**
  a 3rd, a **leap** a 4th or more. Skips may follow each other the same way at most twice, so a
  triad is outlined (1–3–5, 5–3–1) but three thirds the same way are not. The leap rules are for
  leaps only: never two leaps the same way in a row, and after a leap the melody turns back or
  moves by step. The 7th leading up is EC3's rule only.
- **Where the spec is silent (decided during E2).** From EC4 on a melody spans from the 5th
  below the tonic to the 3rd above the octave, and the range G3–E5 bounds it further. EC6 leaps
  as EC4 does, EC7 as EC5 in the keys of EC4. A minor melody is in the natural or the harmonic
  form throughout (the augmented 2nd of the harmonic form is allowed). No tritone leaps in EC4
  and EC6, where the leaps are "up to a fifth"; EC5 and EC7 allow any. Chromatic notes: a
  passing note between two degrees a whole step apart, raised going up and lowered going down
  (C–C♯–D, D–D♭–C); a neighbour, a semitone from the note it leaves and returns to (G–F♯–G,
  G–A♭–G); never two side by side; one that would be a white key with a sign is written as that
  white key (B–C♮–C♯, not B–B♯–C♯). Steps are likelier than leaps.
- **Sound, as built.** The tonic triad is in root position on the tonic the melody counts from.
  Hear again plays the chord and the melody; the replay after a wrong answer plays the melody
  alone.
- **On screen, as built.** Dots show the melody's notes, filling as they are played. After a
  wrong key only the note that was asked is marked on the keyboard, and the wrong key flashes.
  The melody is drawn on the treble or the bass staff, whichever needs fewer ledger lines, or on
  the grand staff when the wrong key lies on the other staff's side; notes played right are
  green, the wrong key red, drawn in the same column. The key's accidentals follow the bar rule
  across the line; the wrong key gets its own sign and does not change what follows. The summary
  tells each miss by the interval into the wrong note, both named with the key played.

### Records and figures

- Per item: accuracy over the last 10, the median time to answer, replays. Per family: a **confusion
  table** of what was played against what was answered ("m6 answered as P5 in 4 of 12"), with the
  colour-plus-text rules of the note heatmap and a table view.

### Clarifications (decided during E1)

- **When answers count.** Keys count from the prompt's **last note-on**, not its end: a learner
  echoes while the note still rings, and the case the rule guards against (our own notes coming
  back) is the echo guard's. A key already held at that moment does not count until it is pressed
  again. The answer clock starts at the last note-on. "Hear again" closes the answer window until
  its own last note-on; a replay started after a wrong answer is not counted.
- **Directions** are a setting for intervals — Up, Down, Together or Mixed (default Up) — and part
  of the item key (`int:M3:up`, `int:M3:down`, `int:M3:harm`). A level is mastered over its answers
  in any direction.
- **Interval levels.** I1 P8 P5 M3 · I2 + P4 m3 · I3 + M2 m2 · I4 + M6 m6 · I5 + M7 m7 · I6 +
  tritone (every simple interval but the unison) · I7 compound: the whole of I6 plus m9 M9 m10 M10
  P11 P12. The lower note is uniformly random in C3–C5 with the upper note at most C6. Names use
  the tritone as `TT`; on the staff (E3) it is spelled as A4 or d5.
- **Chord levels.** C1 major and minor triads · C2 + diminished and augmented · C3 major and minor
  triads in root position, first and second inversion (augmented inversions sound like another
  augmented triad, so they are left out) · C4 dominant, major, minor and half-diminished sevenths in
  root position · C5 all of C2 and C4. The root is random with the lowest note at or above C3 and
  the highest at most C5 (triads) or C6 (sevenths). Voicing is close position.
  A setting plays chords **block** or **broken, then block** (default broken, then block).
- **Playing an interval.** The key shown is neither right nor wrong (a learner often plays it
  first, or with the answer); the first other key is the answer.
- **Playing a chord.** Correct as soon as the keys held down (not the pedal) have exactly the
  chord's pitch classes, with the right bass in C3. Wrong as soon as a key outside those pitch
  classes is pressed, or, in C3, when all pitch classes are held over the wrong bass.
- **Naming.** Buttons for the level's items only, in the order of the levels; digits 1–9 and 0 press
  the first ten. In C3 the buttons name quality and position together ("Major, 1st inversion").
- **After an answer.** Right: the next item after about 400 ms. Wrong: the answer is marked on the
  keyboard and drawn on a small staff, played once, and the item stays until **Next** (Enter) or any
  key; only the first answer is scored.
- **Mastery** is over the level's last 40 answers given without a replay, ≥ 90 % right; the time is
  shown but not part of mastery. The weight of an item is the note model's formula over its answers,
  with `targetMs` 2000 ms.
- **Levels only grow.** Stored answers are checked against the levels (an item must belong to
  its level, and `correct` must agree with the rules), so an item once in a level stays in it.
- **Records.** Ear answers and sessions sync as the collection `answers` and as sessions of kind
  `ear` (see [SYNC.md](SYNC.md)). The public profile has no day kind for ear training yet: its time
  counts as reading until the service learns an `ear` kind.
- **Instrument checks still open** (E0's hardware half, to do on the MP11SE): echoes of prompts sent
  to the instrument, a key held from before a prompt, and whether answering from the last note-on
  feels right.

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
   keys and levels written out. Report; no production UI. The software half is done with E1 (the
   item keys and levels, prompts through the scheduler to the instrument or the built-in piano,
   the answer buttons in every language, intervals and chords drawn with single accidentals); the
   checks on the MP11SE are still open, and key signatures and double accidentals come with E3.
2. ✓ **E1 Intervals and chords by ear** — the Ear page, both ways of answering, levels, weakness
   sampling, mastery, the `answers` store, sessions and export.
3. ✓ **E2 Echo** — melodic dictation, drawing the melody with the answer after it.
4. **E3 Theory on Read** — interval, key-signature and chord cards.
5. **E4 Progress** — per-family progress and the confusion table.

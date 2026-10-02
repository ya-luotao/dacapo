# dacapo — Theory and ear training specification

Status: E1 to E4 are built (the Ear page: intervals, chords and melodies by ear; Read's
intervals, key signatures and chords on the staff; their progress per family on the Progress
page), cadences by ear joined the Ear page with H2 ([HARMONY.md](HARMONY.md)), rhythm
dictation joined it with R2 ([READING.md](READING.md): a bar tapped back or chosen, family
`rhythmEar`, sessions of kind `ear`), and tunes played by ear with H5 ([HARMONY.md](HARMONY.md):
the lead sheets' melodies phrase by phrase, family `tune`); the instrument checks of E0 are
still to do on the MP11SE.
This extends [MVP.md](MVP.md) and [PIECES.md](PIECES.md); their
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
items. Its summary also says what to work on next: a level mastered just now, a level too far, and
**Practise these**, a short session of the items missed ([ADVICE.md](ADVICE.md), "Cards").

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
the same session, weakness and mastery rules, and the same advice at the end of a session
([ADVICE.md](ADVICE.md), "Cards").

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

### Clarifications (decided during E3)

- **What to read.** Read's setup gains a choice above the levels: **Notes** (L1–L7, as before),
  **Intervals**, **Key signatures** and **Chords** (and later Rhythm and Sight-reading,
  [READING.md](READING.md)). Each has its own levels, suggested level and mastery. The choice is
  remembered per browser. Notes keeps its `attempts` store; the others record answers.
- **Intervals.** Two whole notes on one staff, melodic (side by side) or harmonic (stacked), up or
  down; the lower note on the staff's lines and spaces with at most one ledger line (two in RI4).
  RI1 the number only (2nd–octave), natural notes, treble · RI2 number and quality, natural notes
  (so B–F is a diminished 5th and F–B an augmented 4th), treble and bass · RI3 one sharp or flat on
  either note, every quality from diminished to augmented of the 2nd to the 7th, and the perfect
  octave (its augmented and diminished forms left out) · RI4 double sharps and flats, two ledger
  lines, both staves. Answered by two rows of buttons, the quality (diminished, minor, perfect,
  major, augmented; hidden in RI1) and the number (2nd … octave), in either order; the digits
  2–8 choose the number and the keys D m P M A (case as printed) the quality. Items
  `ri:<quality><number>:<up|down|harm>` (`ri:A2:up`); a spelling that sounds alike is a different
  item (C–D♯ `A2`, C–E♭ `m3`).
- **Key signatures.** A key signature alone on the grand staff; play the tonic, any octave.
  KS1 majors with up to two sharps or flats · KS2 up to four · KS3 all fifteen (C♯ and C♭ majors
  included; any key of the tonic's sound is right) · KS4 the relative minors of KS2 (a small "minor"
  above the staff says which is asked) · KS5 all fifteen minors. Items `ks:<n><s|f>:<major|minor>`
  (`ks:3f:minor`, `ks:0:major`).
- **Chords.** A chord of whole notes on one staff, in close position. RC1 the root-position triads
  of C major on the treble staff (C, Dm, Em, F, G, Am, B°) · RC2 major and minor triads with sharps
  and flats, either staff · RC3 their inversions · RC4 the four sevenths, root position · RC5 RC2–RC4
  together. **Play it** (default): exactly the written keys, octave included, correct as soon as
  exactly those keys are held, wrong at the first other key; **Name it**: the root (letter and
  accidental buttons) and the quality (and in RC3 the position) by buttons. Items
  `rc:<quality>:<inversion>`; the root is drawn at random.
- **Timing and mastery** are Read's: the clock starts when the card is painted; mastery is ≥ 90 %
  over the last 40 answers with a median under 3 s (intervals, key signatures) or 4 s (chords); the
  weight's `targetMs` is 2000 ms (intervals, key signatures) and 3000 ms (chords). Hints: "Show
  letter names" names the notes under each note (and hides nothing else); hinted answers count for
  accuracy only.
- **Records.** Answers with families `readInterval`, `keySignature`, `readChord` in the `answers`
  store; `by` is `name` or `play`; the prompt is the written notes as spelled pitches
  (`C4`, `D#4`, `Ebb5`), or the key signature (`3f`); the answer is the name chosen or the keys
  played. Sessions are kind `theory`, counted as reading on the public profile.
  `SYNC_SCHEMA` goes up.
- **Drawing** is VexFlow's, from `SpelledPitch` (double sharps and flats), with key signatures.
- **Keys for names, as built (a change from the draft).** D and A are note keys of the computer
  keyboard (A plays C, D plays E), so while a card is answered by name the computer keyboard plays
  no notes (`suspend()`, as the Metronome page does) and every letter is free; a MIDI keyboard
  still sounds but answers nothing. A letter counts as typed (so AZERTY's A is A), falling back to
  the physical key on a non-Latin layout; `m` is minor and `M` (Shift) major, D, P and A in either
  case. A chord's root is its letter (A–G, either case), its sign − (flat), # or + (sharp) and N
  (natural), and the chord the digits 1–9 and 0, as on the Ear page. On a phone the keys are not
  printed on the buttons.
- **Naming, as built.** An interval's answer is given when both a quality and a number are chosen
  (RI1: the number alone); a number the chosen quality cannot have (a perfect 3rd, a major 5th, an
  augmented octave) is not offered, and choosing a button again takes it back. A chord's answer is
  given when a letter and a chord are chosen; its sign is natural unless ♭ or ♯ is chosen first,
  as one says it ("F sharp minor"). The quality and the position are one button, as on the Ear
  page's C3 ("Minor, 1st inversion"), in RC3 and in RC5's triads, so no answer waits on a default
  position. The name answered is `m3` (`3` in RI1) or `F#:min:1st` (the root as written:
  G♭ minor is not F♯ minor).
- **Where the draft is silent (decided during E3).** Every interval level mixes up, down and
  harmonic (no setting). "At most one ledger line" holds for both notes, and a sharp or flat in RI3
  (a double one in RI4) may be on either or both notes, E♯, B♯, C♭ and F♭ included. RI1's items
  keep their quality (`ri:m3:up`, `ri:M3:up`), though only the number is asked. A card is drawn by
  choosing its staff first, each of the level's equally often, then one of the item's writings on
  it. RC2–RC5 roots are any letter with at most one sharp or flat whose chord needs no double sharp
  or flat (so G♯ major and D♭ minor are written, D♯ major is not); every note of a chord lies
  within one ledger line of its staff. The augmented triad is left out, as the draft's levels do.
  The 40 answers of mastery are the level's last 40 given without the hint, and its median is over
  the right ones answered within 30 s, as Read counts them.
- **On screen, as built.** An interval or a chord is written on one staff, treble or bass, in a
  box every such card shares (room for two ledger lines and a sign either side); a key signature on
  the cards' grand staff. Every key-signature card says "Major key" or "Minor key" in the sheet's
  corner. The hint names each note under its column (a stack low to high), and a key signature's
  sharps or flats in the order written (F♯ C♯ G♯), which is what there is to name; its line is kept
  below every card, so showing it moves nothing. After a wrong answer the right one is marked on
  the buttons and on the keyboard (a chord's or an interval's written keys; a key signature's tonic
  nearest the key played) and said in words, and the card stays until it is given: a chord played
  wrong is right once exactly its keys are held, so letting go of the wrong key is enough. On a
  wide screen the answer buttons stand beside the sheet.
- **Records, as built.** A theory answer keeps `hinted` instead of Ear's `replays`, and the staff
  of an interval or a chord (`clef`), which its spelled notes do not say and which the checks of an
  imported or synced answer need (the ledger lines). A stored answer is checked as the session
  drew and judged it: the notes must be a card of its item at its level, and `correct` must agree.
  A `theory` session keeps Read's figures (cards, accuracy, median of the timed answers) with the
  slowest items and every card missed with what was answered. The export format stays at version
  7: its lists are the same, and an older build lists the new records among those it could not
  read. `SYNC_SCHEMA` 5.
- **Settings, as built.** The session length and the hint are the page's, shared with Notes (and,
  as for Notes, not remembered); the choice of what to read and how chords are answered are
  remembered per browser.

## Records

- Raw answers are the source of truth. An **answer** record: id, session, family (`interval`,
  `chord`, `echo`, `readInterval`, `keySignature`, `readChord`; `rhythm` and `rhythmEar` of
  [READING.md](READING.md); `cadence` and `tune` of [HARMONY.md](HARMONY.md)), level, item key (for example
  `int:M3:up`, `chord:min:1st`, `ks:3f:major`), how it was answered (`play` or `name`), the prompt
  (its keys, or the written notes), the answer (keys played or the name chosen), correct, ms,
  replays, when.
- IndexedDB, next version: an `answers` store with indexes by session and by item. Per-item stats
  are recomputed from it when the page opens (the records are small; the note stats' incremental
  update is not needed here). Export format, next version, includes answers; older files still
  import. Read's existing note cards keep their `attempts` store unchanged.
- Ear and theory sessions join the `SessionRecord` union, so minutes, the streak and the log count
  them. Progress gains a section per family: level mastery, the weakest items, the confusion table.

### Clarifications (decided during E4)

- **Where.** Progress gains a part "Ear training and theory" after "Note by note": a section for
  each family that has answers, Ear's intervals, chords and melodies, then Read's intervals, key
  signatures and chords; with no answers yet, a pointer to the Ear page. Each section folds under
  its heading. At first only the family practised last (the one with the latest answer) is open,
  the others folded; a section opened or folded by hand stays so, remembered per browser
  (`dacapo.progress`). Everything is
  recomputed from the `answers` store (`core/answerProgress.ts`); no record, sync or export
  changes.
- **Levels.** One compact row of the family's levels with their page's mastery
  (`earLevelProgress`, `theoryLevelProgress`): mastered, or the accuracy and the answers in the
  window (`78% · 40/40`, `55% · 20/20` melodies), or not practised yet; a thin bar shows how full
  the window is.
- **Filters.** The weakest items, the table of items and the confusion table are over a level (all,
  or one that has answers) and, where the family was answered both ways, over how (all, played,
  named). Not remembered, as the note heatmap's level is not.
- **Per item** (docs: "accuracy over the last 10, the median time to answer, replays"): all three
  over the item's last 10 answers, as the heatmap's "lately": the share right, the median of the
  timed ones among them (right, without a replay or the hint, within 30 s), and "Hear again"
  pressed (Ear, summed) or cards answered with the hint (Read); with every answer counted beside.
  Items are the weakness model's: an interval with its direction (`int:m6:up`), a melody by its
  level (`echo:EC3`). **The weakest three** are by the model's weight (the family's `targetMs`)
  among items with at least 3 answers, as notes are ranked; of equal weight the less accurate
  lately, then the slower, then the earlier in the levels. "Every item" lists them all, weakest
  first, then those with fewer answers.
- **The confusion table.** A row for each thing asked, a column for each thing asked or answered,
  in the family's order, and **Other** last for an answer that fits no column. What counts:
  - Intervals by ear: by the interval's name, the direction aside (the name answered has none),
    by size. Named: the name chosen. Played: the interval from the key shown to the key played,
    in the direction asked; a key on the wrong side of the shown one, or a distance without a
    name here (18 semitones, beyond 19), is Other.
  - Chords by ear and on the staff: by quality and position (`min:1st`), the root aside. Named:
    the chord chosen. Played: the keys held when the chord went wrong, read on the root asked.
    A chord is wrong at its first key outside it, so what is held is part of it and the wrong
    key, rarely a whole other chord: "the chord it makes" is taken as the chord of the level that
    contains all of them (where the position is named, C3, RC3 and RC5, with the lowest key as its
    bass), the one sharing most tones with the chord asked, then the first; none is Other. So C–E♭
    for C major reads as minor, and C major's notes over E in C3 as its 1st inversion.
  - Melodies: the melodic interval into a note, in signed semitones, as asked against as played.
    Every step reached counts: a melody played right puts all its steps on the diagonal; one
    played wrong, the steps before the wrong note on the diagonal and the step into it as played,
    and nothing after it. A wrong first note has no step into it and is left out; the same key
    again, or a leap past the octave, is Other.
  - Intervals on the staff: by quality and number as written (`A2`, `d5`); RI1, which asks for the
    number alone, by its number (`3`), asked and answered, so its rows stand beside the others'
    in "All levels" (the level filter separates them).
  - Cadences (H2, [HARMONY.md](HARMONY.md)): the cadence named, in the order of the levels
    (authentic, plagal, half, deceptive), headed by its two chords (`V–I`, `IV–I`, `…–V`,
    `V–vi`).
  - Tunes (H5, [HARMONY.md](HARMONY.md)): as melodies, by the step into each note, with the
    same note again a step of its own (headed `P1`): a tune repeats notes, a melody of Echo
    never does. Only a leap past the octave is Other.
  - Key signatures: the key played is the key whose tonic it is, major or minor as asked, with the
    fewest sharps or flats (C♯ played is D♭ major, not C♯ major); of the two with six (F♯ and G♭
    major, D♯ and E♭ minor), the one on the side of the key asked (sharps from C major and A
    minor).
- **The diagonal is the right answers**, and only they: a wrong answer that reads as the item
  asked (a chord named on a wrong root; a chord's own notes in a wrong octave, or with the same
  bass) counts as Other.
- **Colour and text**, as the note heatmap's: the right answers are marked apart (green, on the
  diagonal), off the scale. A wrong cell is coloured by its share of its row on the heatmap's
  seven colours (under 5 %, 5–10 %, 10–20 %, 20–30 %, 30–40 %, 40–50 %, 50 % or more), with its
  count printed in the ink or the paper, whichever keeps 4.5 : 1 on that colour in either theme.
  A row with **fewer than 5 answers** is not enough data: its counts stand in the hollow dashed
  mark of "not enough data yet". A cell never answered is blank; a total ends each row.
- **Headings** are short, the same in every language as note names are: `m6`, `TT`, `↑P4`, `A2`,
  `3`, E♭ for a major key and c♯ for a minor one, chord symbols without their root in the Harmony
  page's one style (maj, m, °, +, 7, maj7, m7, m7♭5; `maj` for the major triad, whose symbol is its
  root alone; decided during H1) with an inversion's figured bass (⁶, ⁶₄). Each heading's full name is in its hidden text and tooltip,
  and each cell's tooltip says what it counts ("minor 6th answered as perfect 5th: 4 of 12").
- **The table view** ("Show as a table") lists the confusions in words, the most frequent first,
  then the larger share: asked, answered as, and how often ("minor 6th · perfect 5th · 4 of 12
  (33%)"); the first 10, with how many there are in all.
- **On a phone** the grid scrolls sideways within its sheet, its row headings kept in view; the
  page itself never scrolls sideways.

## UI and wording

- One card at a time, large, with the keyboard below; the result shows for ~400 ms (right) or until
  the next key (wrong, with the answer drawn and played once), as on Read.
- Interval, chord and key names are theory terms each language says its own way
  — 長3度 (ja), 大三度 (zh-CN, zh-TW), 장3도 (ko), major 3rd — so they get glossary rows in
  [TRANSLATING.md](TRANSLATING.md) and a review by a native speaker per language. Note names stay
  letter names everywhere (since: or do re mi for those who ask, see [PERSONAL.md](PERSONAL.md)).
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
4. ✓ **E3 Theory on Read** — interval, key-signature and chord cards.
5. ✓ **E4 Progress** — per-family progress and the confusion table.

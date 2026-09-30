# dacapo — Harmony, accompaniment and making music specification

Status: H1 is built (the Harmony page with Chords: chord symbols to play, five levels, their
answers and progress), and H2's Progressions (generated scores practised as pieces); cadences by
ear and H3 to H6 are planned (after [EXPRESSION.md](EXPRESSION.md)). This extends
[MVP.md](MVP.md),
[PIECES.md](PIECES.md) and [EAR.md](EAR.md); their principles and fixed decisions still apply
(staff first, measure don't guess, local data, English of record, every UI language, 3-day
dependency cooldown, no backend).

Goal: play from chords, not only from notes. Most music a learner wants to play with others — songs,
hymns, pop — comes as a melody with chord symbols; accompanying it, playing a tune heard but never
seen, moving it to another key and making something up over a chord loop are skills of their own,
and each can be practised on a MIDI keyboard and partly measured.

## A new **Harmony** page

Three practices: **Chords** (symbols to keys), **Progressions** (chords in time, in a pattern) and
**Improvise** (a backing to play over). Lead sheets are pieces, in the Pieces library. Playing by
ear is a family of the Ear page; transposing is an option of every piece.

## Chords (H1)

- A chord symbol is shown large (`C`, `Am`, `G7`, `F/A`, `B°`, `Csus4`, `Cmaj7`, `Dm7♭5`), with a
  small keyboard below; play it. Correct as soon as the keys held down have exactly the chord's
  pitch classes, the bass matching a slash chord's bass (and, for a plain symbol, any inversion);
  wrong as soon as a key outside them is struck. Timed from the symbol being painted, as Read's
  cards are.
- Items are keyed by symbol (`sym:Dm7`); the item model, sessions (10/20/50), mastery (≥ 90 % over
  the last 40, median under 3 s) and the `answers` store (family `chordSymbol`) are Read's and
  EAR.md's.

| Level | Symbols                                                         |
| ----- | --------------------------------------------------------------- |
| H1    | the triads of C, G and F major (I ii iii IV V vi)               |
| H2    | major and minor triads on all twelve roots                      |
| H3    | `7`, `maj7`, `m7` on all roots                                  |
| H4    | slash chords: inversions (`C/E`, `G/B`) and bass notes (`Am/G`) |
| H5    | `°`, `+`, `sus2`, `sus4`, `m7♭5`, `°7`, `6`, `m6`, `add9`       |

- Symbols are spelled as lead sheets spell them (`B♭`, not `A♯`; `F♯m`, not `G♭m`) by key, and
  written in one style everywhere (`maj7` not `Δ`, `°` for diminished); the Learn lesson on chords
  lists the other spellings a learner will meet.

### Clarifications (decided during H1)

- **Names.** The levels are `H1`–`H5`, as the table has them; the milestones H1–H6 below share the
  letter, so a level is always written with its word ("level H2") where it could be read as a
  milestone. The page is `/harmony`, between Ear and Scales in the navigation (and the home page's
  contents); it moves into the More menu early on a narrow screen (priority 2.5). Chords is a
  section under its own heading; since H2 a chooser above the practices picks it or Progressions
  (`ui/harmony/practices.ts`), and Improvise joins them with H6. Lesson 13 (chords) now practises
  here.
- **The symbols** are one style everywhere (`core/chordSymbols.ts`): a root (C D E F G A B, ♭ or ♯),
  then nothing (major), `m`, `°`, `+`, `sus2`, `sus4`, `7`, `maj7`, `m7`, `m7♭5`, `°7`, `6`, `m6`
  or `add9`, then `/` and a bass other than the root. Nothing else parses (`Bb`, `A#`, `CM7`,
  `Cdim`, `Cø7` are refused), so an item has one spelling. A symbol is set as a lead sheet sets
  it: the root and its sign, `m`, `°` and `+` on the line, the extension raised (`7`, `maj7`,
  `7♭5`, `sus4`, `add9`), the bass after the slash; assistive technology reads it in words ("D
  minor 7th chord", "C major triad over E"), the qualities in the Ear page's terms. Where a chord
  is named without its root (the Ear page's and Read's chords as Progress heads them), it is the
  same suffix, and `maj` for the major triad, whose symbol is its root alone: maj, m, °, +, 7,
  maj7, m7, m7♭5 (E4 wrote M, M7 and ø7).
- **Spelling by key.** A root is never E♯, F♭, B♯ or C♭. Of a black key's two names, the one
  whose chord needs the fewest sharps and flats (a double one counting two) wins: B♭ not A♯, F♯m not
  G♭m, D♭ not C♯, C♯m not D♭m, D♯° not E♭° (E♭ G♭ B𝄫), F♯7 not G♭7. On a tie, the one whose key
  (major, or minor for a chord with a minor third) has the smaller signature (G♯m6, not A♭m6); still
  tied, the flat: **G♭** (not F♯) major and **E♭m** (not D♯m). A tone can take a double sign only on
  a natural root (C°7 is C E♭ G♭ B𝄫, B+ is B D♯ F𝄪), as the theory writes it.
- **Levels.** H1: the ten triads of C, G and F major's I ii iii IV V vi (C Dm Em F G Am Bm D Gm B♭).
  H2: major and minor triads on all twelve roots (24). H3: `7`, `maj7`, `m7` on all twelve (36).
  H4: on all twelve roots, the major and minor triads over their 3rd and their 5th (`C/E`, `C/G`,
  `Am/C`, `Am/E`), and three bass notes of a moving bass line outside the chord: a major triad over
  its major 7th (`C/B`) and over its 2nd (`F/G`), a minor triad over its minor 7th (`Am/G`) (84).
  H5: `°`, `+`, `sus2`, `sus4`, `m7♭5`, `°7`, `6`, `m6`, `add9` on all twelve roots (108). A level is
  its own symbols only, as the table lists them. Items are `sym:<symbol>`, the symbol as written
  (`sym:Dm7`, `sym:B♭`, `sym:C/E`).
- **Judging.** The keys pressed since the card was painted and still held (a key let go no longer
  counts): wrong at the first one outside the symbol's pitch classes; right once they are exactly
  its pitch classes, in any octave, voicing and inversion, doubled notes allowed. A slash chord's
  pitch classes include its bass (`Am/G` is A C E G), which must be the lowest key. **All the notes
  held over another bass is not wrong but not yet right** ("Now E in the bass"), because the bass
  often comes a moment after the right hand, or the left hand re-strikes it; this differs from the
  Ear page's inversions, where the whole chord is one prompt played together. After a wrong answer
  the card stays: letting go of the wrong keys with the right ones held, or playing it again, is
  right; only the first answer is scored.
- **The card.** The symbol large on a sheet, a keyboard of three octaves (C3–B5) under it; a MIDI
  keyboard answers in any octave. The clock starts on the frame the symbol is painted; 400 ms after
  a right answer the next card comes, never the same symbol twice in a row. A wrong answer names
  the keys played, the chord tone by tone ("B♭ D F A♭", "C E G, with E lowest") and marks it on the
  keyboard: the chord from its root at or above middle C, a slash chord's bass below it. **Show the
  notes** writes the chord's notes under the symbol and tints those keys; hinted answers count for
  accuracy only.
- **A mouse or a finger can build a chord.** On the screen's keyboard a click or a tap latches a
  key down (shown held) and a second one lets it go, so a chord is built one key at a time and
  judged as held keys are; the keys latched for a card are let go when the next card comes. A line
  under the keyboard says so. A MIDI keyboard and the computer keyboard are unchanged.
- **Figures.** The item model's `targetMs` is 2500; mastery is ≥ 90 % over the last 40 answers
  without the hint, with a median under 3 s; 10, 20 or 50 cards; the summary is Read's (cards,
  correct, median, the slowest cards, the missed ones with what was played).
- **Records.** Answers of family `chordSymbol` in the `answers` store: `by` is always `play`, the
  prompt the symbol as written, the answer the keys held when judged (low to high), and `hinted`.
  Sessions are kind `harmony` (with `family: 'chordSymbol'`), rebuilt from their answers after a
  closed tab, and count as **reading** on the public profile (the service knows no harmony kind;
  cards by level are nearest to Read's). Imports and sync judge every answer again. `SYNC_SCHEMA`
  8; the export file needs no new version.
- **Progress.** Chord symbols is a family of the Progress page: its levels, weakest items ("Dm7 ·
  D minor 7th chord") and what is answered instead: a row for each symbol asked, a column for the
  keys held read as a symbol on the root asked (the chord on that root containing them that shares
  most with the one asked; for a slash chord asked, a lowest key other than the root is read as the
  bass, so "C7/E" for G B♭ over E), Other when no chord on the root holds them. With every level
  together the grid can have many rows; the level filter narrows it.

## Progressions (H2)

- A progression in a key — roman numerals and symbols together (`I–IV–V–I`, `I–vi–IV–V`,
  `ii–V–I`, the 12-bar blues, `i–iv–V–i` in minor, the circle of fifths `vi–ii–V–I`) — is written out
  as a generated score (MusicXML, like the scale exercises): the left hand in a **pattern**, the
  right hand in close-position chords voiced to move as little as possible from one chord to the
  next, each hand shown on its staff. Patterns: block chords on the 1; root and fifth; waltz
  (bass, chord, chord); broken (Alberti); arpeggio up; stride (bass on 1 and 3, chord on 2 and 4).
- It is practised with the Pieces machinery (wait mode, rhythm mode, the demo, hands separate,
  loops), keyed by the generator's parameters instead of a file, so its steps and weak bars are
  recorded as a piece's are, under a piece id that names the progression, key and pattern.
- **Cadences by ear** join the Ear page: authentic, plagal, half and deceptive, each heard as the
  last two chords of a short progression in a key set by its tonic chord; named by buttons.

### Clarifications (decided during H2)

- **The page.** Chords and Progressions are chosen by a row above them (Practice), remembered in
  this browser with every choice of Progressions (`dacapo.harmony`). A progression is practised on
  its own page, `/harmony/progressions/<progression>/<key>/<pattern>` (the key escaped: `F%23m`),
  whose back link returns to Harmony; the navigation keeps Harmony lit there.
- **The progressions** (`core/progressions.ts`), one chord to a bar: `I–IV–V–I`; `I–vi–IV–V` (the
  fifties progression); `ii7–V7–Imaj7` with its I held a second bar (the jazz ii–V–I is of seventh
  chords); `vi–ii–V–I` (the circle of fifths, as a pop or hymn turnaround plays it: triads);
  `i–iv–V–i` in minor, V major with the raised leading note of harmonic minor; the 12-bar blues of
  dominant sevenths, `I7 I7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 I7`, ending at home (no
  turnaround). A progression has one mode: the major ones in the twelve major keys, `i–iv–V–i` in
  the twelve minor ones, each list round the circle of fifths as the Scales page spells its tonics
  (C G D A E B F♯ D♭ A♭ E♭ B♭ F; A E B F♯ C♯ G♯ E♭ B♭ F C G D minor).
- **Spelling.** Each chord is spelled from the key by letter (`noteAbove` from the tonic), not by
  H1's rule for a symbol alone: D♯m in F♯ major, D♯ with its F𝄪 in G♯ minor, C♭ in E♭ minor's iv.
  Symbols are H1's one style (`B♭m`, `Dm7`, `Cmaj7`, `E♭7`); numerals are upper case major, lower
  case minor, `7` and `maj7` as the figure (`ii7`, `V7`, `Imaj7`), raised on the page.
- **Patterns** of the left hand, each a bar: **block chords** (the chord on the 1, root position,
  held; a seventh chord as root, 3rd and 7th), **root and fifth** (together, held), **waltz** (in
  3/4: the root, then the chord on 2 and 3), **Alberti** (eighths low, high, middle, high on the
  block chord's three keys), **arpeggio up** (quarters 1–5–8–10; 1–5–7–10 for a seventh chord),
  **stride** (the root on 1, the fifth on 3 — a fourth below where that stays above C2, else a
  fifth above — and the chord on 2 and 4). The waltz's and the stride's chords are the triad, or a
  seventh chord without its root, in close position in the tenor (up to B3), voiced as the right
  hand's are. Registers: the root of block chords and Alberti from F2, of the others from C2; the
  left hand stays within C2–D♯4 (the top only for a seventh chord's 7th or the arpeggio's 10th);
  the right hand's chords in C4–C6, always wholly above everything the left hand plays in the bar,
  so no key is ever the two hands' at once.
- **Voice leading** (`core/voiceLeading.ts`): the right hand plays the whole chord in close
  position (three keys for a triad, four for a seventh chord, every inversion), struck anew each
  bar and held through it (common tones are kept in their voice, not tied: a chord is played as
  the symbol changes). Of all the sequences of voicings in range, the one moving least is taken,
  exactly: each voice's semitones summed, parallel fifths or octaves costing 40 between the bass
  and the top voice and 14 between any other two, a little for straying from G4. `I–vi–IV–V`,
  ending away from home, is voiced round the loop (its V to its I counts); the others end on their
  tonic and are voiced for themselves. Across every progression, key and pattern there are no
  parallel fifths or octaves between the bass and any voice of the right hand, nor within it (a
  test checks them all). The result is the textbook one where there is one:
  `C–F–G–C` as E G C, F A C, D G B, E G C; `Dm7–G7–Cmaj7` as D F A C, D F G B, C E G B.
- **The score** (`core/progressionXml.ts`): a grand staff, the right hand on the treble staff, the
  left on the bass staff (given to the parser as hands, never guessed), the key signature, the time
  signature, a tempo mark, the chord symbols above as `<harmony>` (root, alter, kind with its
  printed text) and the numerals below as upright `<words>`; eighths beamed by the half bar; every
  sign written out (a courtesy one after a bar that altered the note). Verovio draws it and
  `parseMusicXml` reads it back note for note without warnings; a test locks every progression's
  checksum per pattern.
- **Tempo.** 60, 72, 80 (the default), 96 or 112 to the quarter, chosen on the Harmony page and
  written into the score as its tempo mark; it is not part of the id, so records survive a change
  of tempo (the checksum leaves it out too). Opening a progression from the setup sets the
  practice page's own tempo to 100 %, so the tempo chosen is the tempo practised; the practice
  page's control then works as on any piece. The tempo last opened is kept per progression.
- **Records.** A progression is a piece to the Pieces machinery: its steps and runs are recorded
  under `prog:<progression>:<key>:<pattern>` (`prog:I-IV-V-I:C:block`, `prog:i-iv-V-i:F#m:alberti`),
  with the score's checksum, as a built-in piece's are; weak bars, Your runs, the summaries and the
  piece's preferences all work unchanged. Nothing new is stored, synced or exported: `pieceSteps`
  and piece sessions already take any piece id. The session list and Progress name a progression
  in the current language from its id (`I–IV–V–I in C major · Alberti bass`); the public profile
  counts it as a piece without a title, as it does a built-in one.
- **Your progressions** lists the progressions practised, the latest first (at most eight), each
  with its pattern, its tempo and the piece's progress line (last practised, runs, steady bars).

## Lead sheets (H3)

- A lead sheet is a MusicXML piece with a melody and chord symbols (`<harmony>`). The parser keeps
  the symbols (root, kind, bass, at a position). The library gains lead sheets of public-domain
  tunes (folk songs, hymns, spirituals), the melody from a public-domain source and the symbols our
  own (MIT), each in a singable key. Imported MusicXML with symbols is a lead sheet too.
- On a lead sheet, the left hand can be **as written** (a lead sheet usually has none) or **from the
  symbols**: a pattern of H2 generated under the melody, drawn on the bass staff, so it is
  practised, heard and judged like any written left hand. Changing the pattern makes new steps; the
  records keep the pattern.

## Transposing (H4)

- Every piece has a **Key** control: up to six semitones up or down, with the key's name. The score
  is redrawn transposed (Verovio's transposition, with a sensible spelling: the key signature with
  fewer accidentals of the two enharmonic ones), and everything plays and is judged in the new key;
  symbols transpose with it.
- A run's header records the transposition; the weak-bars heatmap and progress by default count
  runs in the written key only, with a toggle for all keys.

## Playing by ear (H5, on Ear)

- **Tunes**: the lead sheets' melodies, phrase by phrase. The key is set by its tonic chord and
  the first note is given; play the phrase back. Correct is every key in order; timing is not
  judged. Phrases come in order through the tune, then the whole tune; **In another key** starts
  the tune on another note (the first note given again), which is transposing by ear.
- Items are keyed by tune and phrase; the `answers` store (family `tune`); mastery as Echo's.

## Improvise (H6)

- Choose a **backing** — a progression of H2 (the 12-bar blues in C, F or G; `I–vi–IV–V`; `ii–V–I`;
  a two-chord modal vamp) — a feel (straight or swing eighths) and a tempo. The backing plays on
  the output: bass and chords in a pattern, in a loop, with the click if wanted. The current chord
  and the next are shown large, with its symbol, and a suggested scale (the key's major scale, its
  pentatonic, the blues scale) marked lightly on the keyboard.
- **Call and response**: the backing plays a two-bar phrase, the player answers in the next two.
- **Feedback, not a score.** Improvising has no right answer, so nothing is marked wrong. During
  the loop, each note played is tinted on the keyboard as a chord tone, a scale tone or outside;
  after it: the share of notes on strong beats that were chord tones, the range used, notes per
  bar, how much of the time was silence (phrasing), and how much was repeated. The loop can be
  recorded as a take (EXPRESSION.md) and played back with its backing.
- Sessions are kind `improv` (time and the figures), for the log and the streak.

## Milestones

1. ✓ **H1 Chords** — the Harmony page, symbols, levels, answers.
2. **H2 Progressions** — generated progressions and patterns on the Pieces machinery; cadences
   on Ear.
3. **H3 Lead sheets** — symbols in the parser, the library's lead sheets, the left hand from the
   symbols.
4. **H4 Transposing** — the Key control on every piece.
5. **H5 Playing by ear** — tunes on Ear.
6. **H6 Improvise** — backings, feedback, call and response.

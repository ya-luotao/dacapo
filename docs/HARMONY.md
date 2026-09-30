# dacapo — Harmony, accompaniment and making music specification

Status: H1 is built (the Harmony page with Chords: chord symbols to play, five levels, their
answers and progress); H2 to H6 are planned (after [EXPRESSION.md](EXPRESSION.md)). This extends
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
  contents); it moves into the More menu early on a narrow screen (priority 2.5). Chords is its
  only practice for now: a section under its own heading, with a chooser above the practices once
  Progressions or Improvise joins it (`ui/harmony/practices.ts`). Lesson 13 (chords) now practises
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

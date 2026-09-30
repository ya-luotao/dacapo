# dacapo — Harmony, accompaniment and making music specification

Status: planned (after [EXPRESSION.md](EXPRESSION.md)). This extends [MVP.md](MVP.md),
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

1. **H1 Chords** — the Harmony page, symbols, levels, answers.
2. **H2 Progressions** — generated progressions and patterns on the Pieces machinery; cadences
   on Ear.
3. **H3 Lead sheets** — symbols in the parser, the library's lead sheets, the left hand from the
   symbols.
4. **H4 Transposing** — the Key control on every piece.
5. **H5 Playing by ear** — tunes on Ear.
6. **H6 Improvise** — backings, feedback, call and response.

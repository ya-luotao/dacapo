# dacapo — Harmony, accompaniment and making music specification

Status: H1 is built (the Harmony page with Chords: chord symbols to play, five levels, their
answers and progress), H2 (Progressions, generated scores practised as pieces, and cadences by
ear on the Ear page), H3 (lead sheets: chord symbols in the parser, eight tunes in the library,
the left hand made from the symbols), H4 (transposing: the Key control of every piece), H5
(playing by ear: the lead sheets' melodies played back phrase by phrase on the Ear page, in their
key or another) and H6 (Improvise: backings to play over, feedback, call and response, the take
played back with its backing).
This extends [MVP.md](MVP.md), [PIECES.md](PIECES.md) and [EAR.md](EAR.md); their principles and fixed decisions still apply
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
  (`ui/harmony/practices.ts`), and Improvise joined them with H6. Lesson 13 (chords) now practises
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
- **Cadences by ear** are a fourth family of the Ear page, **Cadences**, after Echo, with EAR.md's
  rules (`core/cadences.ts`). A prompt is four block chords a second apart, the last held longer:
  the tonic chord (which sets the key), then one of the same few chords whatever the cadence (IV,
  ii or vi; iv or VI in minor), then the two chords that are the cadence. Authentic `…–V–I`,
  plagal `…–IV–I`, half `…–V` (from vi–IV, IV–I or vi–ii; VI–iv or iv–i in minor), deceptive
  `…–V–vi` (`V–VI` in minor), each from a list of whole progressions (`I–IV–V–I`, `I–vi–IV–I`,
  `I–vi–IV–V`, `I–ii–V–vi` …), so nothing before the last two chords gives the answer away.
  Four voices: the root in the bass from F2, a close triad above it in A3–A5, the first voicing
  drawn among the three near G4 and the others led as the progressions' right hand is (no
  parallel fifths or octaves between the bass and the top, tested). The key is drawn from the
  twelve major keys (and in CA4 the twelve minor ones, V with its leading note).
- **Levels.** CA1 half and authentic (the question and the answer) · CA2 + plagal · CA3 +
  deceptive · CA4 all four in major and minor keys. Items `cad:authentic`, `cad:plagal`,
  `cad:half`, `cad:deceptive`. Named only, by buttons in that order (digits 1–4), each with its
  two chords under its name (`V–I`, `IV–I`, `…–V`, `V–vi`, the same in every language); a key on
  the keyboard answers nothing. The answer window opens at the last chord's note-on; "Hear again"
  plays the four chords again. Sessions of 10, 20 or 50; mastery over the last 20 answered
  without "Hear again", ≥ 90 % right, as Echo's melodies (a prompt is a phrase, not a note).
- **After the answer** the card names the cadence and writes the progression in its key, the last
  two numerals set apart, its chords under them (`i VI iv i`, `G♯ minor: G♯m E C♯m G♯m`); nothing
  is marked on the keyboard (sixteen keys would say nothing). The summary lists each miss with
  its progression (`I–IV–V–vi in D major: D G A Bm`).
- **Records.** Ear answers of family `cadence`: `by` is always `name`, the prompt the sixteen keys
  (four chords, bass first), the answer the cadence named, and `key` the key it was in (its
  tonic and `major` or `harmonicMinor`, one of the level's), so a stored answer is judged again
  on import and sync: its keys must read as one of the cadence's progressions in that key, in
  this app's voicing. Sessions are kind `ear`. `SYNC_SCHEMA` 11; the export file needs no new
  version. Progress gains **Cadences by ear** (the E4 figures; the confusion table headed by the
  two chords, `V–I` against `V–vi`).

## Lead sheets (H3)

- A lead sheet is a MusicXML piece with a melody and chord symbols (`<harmony>`). The parser keeps
  the symbols (root, kind, bass, at a position). The library gains lead sheets of public-domain
  tunes (folk songs, hymns, spirituals), the melody from a public-domain source and the symbols our
  own (MIT), each in a singable key. Imported MusicXML with symbols is a lead sheet too.
- On a lead sheet, the left hand can be **as written** (a lead sheet usually has none) or **from the
  symbols**: a pattern of H2 generated under the melody, drawn on the bass staff, so it is
  practised, heard and judged like any written left hand. Changing the pattern makes new steps; the
  records keep the pattern.

### Clarifications (decided during H3)

The symbols in the parser and the library's lead sheets came first; the left hand from the symbols
and the Library's heading for the lead sheets after them (from "Left hand" on, below).

- **The parser** keeps each `<harmony>` with a root as `Score.harmonies` (`HarmonyMark` in
  `core/markings.ts`): part, staff, written bar and tick (the cursor plus `<offset>`, as a
  direction's), the root and the bass (step and alter), MusicXML's `<kind>` value as written, the
  `<degree>`s, the text printed and the app's symbol. MusicXML gives a symbol a staff but no voice.
  The text is the root, the kind's `text` attribute and the bass (`B♭maj7`, `D/F♯`); without a
  `text`, the app's symbol; else the root and the kind's value. The symbol comes from
  `symbolFromMusicXml` (`core/chordSymbols.ts`): `major` … `minor-sixth` map one to one to H1's
  qualities, a major triad with an added 9th to `add9`; anything else (`dominant-ninth`, `power`,
  another degree, a root such as E♯, a bass on the root) has none, and is kept with its text. A
  `<harmony>` with no root (a numeral or a function alone) is skipped. The list is sorted by tick,
  then part and staff, and laid out through the repeats by `performedMarks`, as the markings are.
  It is absent from a score with no symbols. The symbols are not notes: steps, records and the checksum
  ignore them, so no existing piece's checksum changes. H2's progressions now write their kinds
  from the same table (`MUSICXML_KIND`), byte for byte as before, and read back with their symbols.
- **The lead sheets** are our own encodings (`scripts/pieces/sources/`, a new `@h:` token for a
  symbol in the app's style, written in ASCII: `@h:Bb`, `@h:F#m`, `@h:D/F#`, `@h:Bm7b5`, `dim`
  and `aug` for `°` and `+`): the melody on the treble staff, note for note from one public-domain
  print of the tune, and the bass staff left empty (whole-bar rests), so the left hand from the
  symbols can be drawn there later and the hands stay right and left. A symbol stands where the
  chord changes, and the first over the first full bar. No lyrics (the parser has no use for them
  yet), no fingering, and of the edition's markings only fermatas. Each `<kind>` carries the house
  style as its `text` (`m`, `7`, `°`, `m7♭5`), which Verovio prints as written; a ♭ in a root is
  the root's `<root-alter>`, drawn as the flat sign.
- **The eight**, chosen because a clean public-domain source could be found and read note for note
  (melody: the source's tune as printed; symbols: ours, I, IV, V, V7, ii and vi only, simple and
  idiomatic):

  | Lead sheet                    | Source (scan on the Internet Archive)                  | Key              |
  | ----------------------------- | ------------------------------------------------------ | ---------------- |
  | Twinkle, Twinkle, Little Star | Franklin Square Song Collection (1881), p. 95          | G, 2/4           |
  | Frère Jacques                 | Weckerlin, Chansons et rondes enfantines (1885), p. 85 | F, 2/4           |
  | Row Your Boat (E. O. Lyte)    | Franklin Square Song Collection (1881), p. 69          | D, 6/8           |
  | Amazing Grace (New Britain)   | Excell, Coronation Hymns (1910), No. 282               | G, 3/4           |
  | Jingle Bells (Pierpont)       | Heart Songs (1909), pp. 148–149                        | G (from A♭), 4/4 |
  | Oh! Susanna (Foster)          | Heart Songs (1909), pp. 172–173                        | G, 2/4           |
  | Auld Lang Syne                | Franklin Square Song Collection (1881), p. 104         | G, 2/4           |
  | Swing Low, Sweet Chariot      | Heart Songs (1909), p. 251                             | F, 2/4           |

  Where the print differs from the tune as it is sung today, the print wins and the source file
  says so (Row Your Boat's bar 3, Auld Lang Syne's Scotch snaps, Frère Jacques's first voice with
  its four closing bars). Jingle Bells is moved from the print's A♭ (four flats) to G. Swing Low's
  D.C. al Fine is written out; Auld Lang Syne's chorus repeats from its own pickup bar. Not taken
  this time: the Londonderry Air (Petrie's 1855 print is a piano setting whose ornamented tune
  could not be read note for note with confidence); Scarborough Fair, When the Saints, Home on the
  Range, Old MacDonald, Shenandoah and Greensleeves were not attempted (for several of them the
  tune sung today has no print before 1929 that we could check).

- **Checked** without an oracle: each melody was read from the scan bar by bar, and read again
  blind by a second reader; every difference was settled against the scan. A test locks each
  checksum and the symbols, and checks that every symbol parses into a known chord in the house
  style and that most of the melody under each symbol is its chord's tones.
- **In the library** a lead sheet is a built-in piece with `leadSheet: true` and a level (Initial
  to grade 2 for the melody alone). The Pieces page lists them after the graded pieces under a
  heading of their own, **Lead sheets**, the easiest first, each card with its level. The review
  schedule, the due list and Your pieces treat a lead sheet as any piece.
- **Left hand: as written, or from the symbols.** An option of the piece (Options, "Left hand"),
  shown when the score has chord symbols: "As written", or one of H2's patterns that the score's
  meter takes. Until the player chooses, it is block chords for a score whose left hand has no
  notes, and as written otherwise; the choice is kept per piece in this browser. A progression of
  H2 is not offered it (its pattern is part of its id). Imported MusicXML with `<harmony>` gets the
  same option.
- **One document.** `core/leadSheet.ts` makes the pattern's notes from the score, and
  `core/leadSheetXml.ts` writes them into the score's own MusicXML document on the left hand's
  staff, in a voice of its own: note values (tied where one value cannot say a length),
  accidentals (against the key and the bar, a courtesy sign after a bar that altered the note) and
  beams (by the half bar in two and four, by the bar in three, by the dotted beat). That one
  document is then drawn by Verovio and read by the parser (`pieces/derive.ts`), so the left hand
  is practised, heard (Listen, the other hand), judged and recorded exactly as a written one, and
  the melody, the symbols, the bars and the repeats are untouched. The left hand's staff is the
  first one the score gives the left hand; failing that, the second staff of the right hand's
  part, which is added with a bass clef to a part of one staff (an imported lead sheet on a single
  staff). What the staff held is taken out (notes, rests, grace notes, and its clef changes: it
  stays in the bass clef), so on an imported piano score with symbols "from the symbols" takes the
  place of the written left hand. Where the pattern needs finer values than the file's
  `divisions`, they are multiplied through the part.
- **Symbols to chords.** A symbol stands until the next one in the score _as written_: the left
  hand is written once per bar, so repeats are not unrolled (a second ending goes on from the
  first's last symbol). The chord is the symbol's `<kind>` as one of H1's qualities; `<degree>`s
  are left out (`C7♯9` is played as C7); a ninth, eleventh or thirteenth is played as its seventh
  chord, a minor chord with a major seventh as its triad, an augmented seventh as its triad. Under
  a symbol with no chord to play (`none`, `power`, `other`, an augmented sixth) the left hand
  rests until the next symbol, as it does before the first. A slash chord's bass is the lowest
  note: the chord's other tones stand in close position above it (`C/E` as E G C, `Am/G` as G A C
  E), root and fifth becomes the bass and the root, and the stride's and the waltz's bass is the
  slash bass.
- **The patterns by meter.** A meter is two, three or four beats (2/4, 3/4, 4/4, 2/2, 3/8), dotted
  beats of three (6/8, 9/8, 12/8), or anything else (5/4, 7/8, 6/4). A score is offered the
  patterns every one of its bars takes:

  | Pattern        | 2 beats           | 3 beats                     | 4 beats                   | Dotted beats                    | Other |
  | -------------- | ----------------- | --------------------------- | ------------------------- | ------------------------------- | ----- |
  | Block chords   | held              | held                        | held                      | held                            | held  |
  | Root and fifth | held              | held                        | held                      | held                            | held  |
  | Waltz          | –                 | bass, chord, chord          | –                         | bass, chord, chord in each beat | –     |
  | Alberti        | low high mid high | low high mid high, mid high | low high mid high, twice  | low, middle, high in each beat  | –     |
  | Arpeggio up    | 1–5–8–10          | 1–5–8                       | 1–5–8–10                  | 1–5–8, then 10–8–5              | –     |
  | Stride         | bass, chord       | –                           | bass, chord, fifth, chord | –                               | –     |

  A held chord sounds from its symbol to the next (or the bar's end) and is struck again in each
  bar. Alberti moves in half beats, the arpeggio in beats (half beats in two), stride and the
  waltz in beats; in a compound meter all three move in the eighths of the dotted beat, the
  waltz's bass the root on one beat and the fifth on the next. The keys are H2's: block chords and
  Alberti on root, 3rd and 5th (a seventh chord's root, 3rd and 7th) from F2; the others from C2;
  the arpeggio 1–5–8–10 (1–5–7–10); the stride's second bass the fifth, a fourth below where that
  stays above C2; the chords on the off-beats in close position in the tenor (up to B3, a seventh
  chord without its root), led from one to the next as H2's are.

- **Where a symbol takes effect.** Under a held pattern, where it stands (on the next sixteenth
  when it stands between two): Swing Low's F on the last three sixteenths of a bar is struck with
  the melody note it harmonises. Under a moving pattern, on the pattern's next note, and the
  pattern starts over there with the new chord (a chord that lasts less than the pattern gets its
  beginning; the same symbol printed again within a bar goes on). A symbol that falls after the
  pattern's last note of the bar would start the next bar, where that bar's own symbol takes its
  place: under stride, Auld Lang Syne's D7 on the last eighth of bar 7 is not heard, while block
  chords and Alberti play it.
- **Short bars.** A bar shorter than its time signature is an upbeat when it is the first bar, or
  the second part of a bar divided in two by a repeat sign or a double bar: it ends on the
  barline, and the left hand rests in it until a symbol stands in it. Any other short bar (a last
  bar that completes the upbeat) starts on the 1 and gets the pattern's beginning.
- **Under the melody.** Every key of the left hand lies below the lowest key the right hand plays
  anywhere in the piece, so the hands never cross and no key is asked of both at once. A pattern
  that would reach the melody is played an octave lower where its bass then stays at or above C2;
  failing that, its keys above the limit are left out (a single note takes the highest chord tone
  under the limit, and nothing is played where even the bass would reach it). The off-beat chords
  are voiced under the same limit. A test holds every lead sheet and pattern to it.
- **Records.** The piece with a pattern is another piece of notes, so its checksum (which covers
  the notes as practised) is its own: each (piece, pattern) has one, locked by a test for the
  library's, and the weak bars, the steady bars and "Your runs" compare runs of the same checksum
  only, as they always have. The run's header carries the pattern (`leftHand`, absent when as
  written), validated strictly; older builds strip it, so `SYNC_SCHEMA` is 18; steps and takes are
  unchanged, and the export file needs no new version. Runs with another left hand are not
  counted in Weak bars, and not reported there as runs of an older version; "Your runs" names
  each run's pattern, and a run with another left hand than the one chosen says so instead of
  opening. The library card counts its steady bars for the left hand chosen (the practice page
  leaves the checksum and bar counts of the piece as practised in this browser's preferences).
- **Hands.** A hand with no notes cannot be chosen (the control is disabled, with a line saying
  that Options can make a left hand); a piece last practised with it is practised with the other.
  On a lead sheet with its left hand as written, Both is the right hand.
- **The review schedule** judges a lead sheet by its melody, whatever the left hand: its facts
  are the written piece's, so a run of the right hand alone or of both hands to the end counts,
  and a run of the left hand alone does not. A wait or memory run with a left hand from the
  symbols is graded against its own steps, since the piece's facts count the melody's keys only.

## Transposing (H4)

- Every piece has a **Key** control: up to six semitones up or down, with the key's name. The score
  is redrawn transposed (Verovio's transposition, with a sensible spelling: the key signature with
  fewer accidentals of the two enharmonic ones), and everything plays and is judged in the new key;
  symbols transpose with it.
- A run's header records the transposition; the weak-bars heatmap and progress by default count
  runs in the written key only, with a toggle for all keys.

### Clarifications (decided during H4)

- **Our own transposition, not Verovio's.** The MusicXML document is transposed in our code
  (`core/transpose.ts` for the arithmetic, `core/transposeXml.ts` for the document), then the one
  document is drawn by Verovio and read by the parser (`pieces/derive.ts`), as the left hand from
  the symbols is: what is drawn, what Listen and the other hand play, what is judged and what
  the symbols say cannot differ, because they are read from the same file. Verovio's `transpose`
  option moves only its own drawing (our parser, the steps and the symbols would have to follow it
  by a second set of rules), and its toolkit, shared by every page, keeps an option it is not
  given again. A test reads every library piece in all twelve other keys, and the app was run in
  Chrome over every piece and key (and the lead sheets' patterns): no note is drawn at another
  pitch or time than the parser reads.
- **The Key control** is under Options, first (the control row stays one row): the thirteen keys
  from six semitones up to six down, each by name with its distance (`B minor (+2)`, `A minor (as
written)`). The key is kept per piece in this browser. While a piece is transposed a line under
  the score says so: the key, how far, the written key, and that runs in this key are kept apart
  and do not count for the review schedule. A progression of H2 has no Key control: its key is
  part of its id, chosen on the Harmony page.
- **The new key** is the one with fewer signs of the two that name it: D♭ major (five flats), not
  C♯ major (seven sharps). Where both have six, the sharps: in F♯ major and D♯ minor every common
  chord has a root the app writes symbols on, while G♭ major's IV and E♭ minor's VI stand on C♭.
  So the signatures used run from five flats to six sharps, and six semitones up and six down are
  the same key an octave apart.
- **Spelling.** Every note moves by the interval between the two keys (letters and semitones:
  A minor to B minor is a major second), so it keeps its place in its key: the leading note
  stays the leading note (Für Elise's D♯ becomes E♯ in B minor, not F), and a note takes a double
  sign where the new key asks for one (E minor's D♯ is F𝄪 in G♯ minor). A sign printed in the
  written key is printed in the new one, changed to the sign the note now has, and nowhere else:
  a note needs a sign in the new key exactly where it needed one before, so courtesy signs and
  their brackets stay as the edition has them. A note that would need more than a double sign is
  written on the next letter, with its sign. Stems drawn up or down for the written pitch are
  left to Verovio again; beams, slurs, fingering and everything else stay.
- **A piece that changes key** is moved section by section: each key signature goes to the simpler
  of its two keys, and the notes under it by that key's interval (A♭ major then E major, a
  semitone up, are A major then F major, not A major then E♯ major).
- **What moves.** The key signatures (per staff where a staff has its own; a `<cancel>` is
  dropped), every pitch (chords, grace notes, tied notes), the signs printed with the notes and
  with ornaments (`<accidental-mark>`: the sign of the upper or lower note in the new key, so a
  trill's neighbours move with it), and each chord symbol's root and bass. A symbol's kind and
  its printed text stay. A left hand made from the symbols is made in the written key and moved
  with the rest, so it is the same pattern in every key and stays below the melody.
- **The key's name** needs the mode. A file that names it (`<mode>`) is believed. Otherwise the
  piece's ending is read, where the piece keeps one signature: the root of its last chord symbol,
  or else the lowest note it ends on, is the tonic of the signature's major key or of its minor
  key. Where it is neither (or the signature changes), both keys are named (`G major / E minor`).
  The parser keeps the key signatures for this (`Score.keys`), outside the steps and the
  checksum. Every library piece is named by its ending except the Musette in D, which ends on
  its dominant (its first half is played again to end): its file names its mode.
- **Records.** A transposed run is a run of the same piece: its steps, its session and its take
  carry the checksum of the piece in its written key and `transpose`, the semitones it was moved
  by (−6 … 6, never 0: the written key is its absence), validated strictly. Step indices, bars
  and passes are the same in every key; a take's keys are the keys played. Older builds strip
  the field, so it rides on `SYNC_SCHEMA` 18 with H3's `leftHand` (the two ship together); the
  export file needs no new version.
- **Written key by default.** Weak bars count the runs in the written key; **All keys** (in the
  Weak bars row, shown once the piece has a run in another key or is in one now, kept in this
  browser) counts them all. While the piece is transposed and All keys is off, the row says that
  what it shows are the runs in the written key. The library card's steady bars follow the same
  choice; its date and its number of runs count every run. On the Progress page, "pieces" (steps
  right the first time) counts steps in the written key only, with no toggle: reading a piece in
  a new key is another task. "In time" counts every rhythm-mode note, whatever the key.
- **The review schedule** (P6) counts runs in the written key only: a run in another key is
  practice at transposing, not a review of the piece as written. It never puts a piece in
  review, and never moves its interval.
- **Memory mode, play back and the expression panels** work in any key: they read the transposed
  score. A run in another key than the one shown can still be played back and opened from Your
  runs (which names each run's transposition): its take is read against the piece in the run's
  key, the keyboard shows the keys as played, and the cursor moves on the score as shown, since
  the steps are the same in every key.
- **The on-screen keyboard** spans the transposed notes.

## Playing by ear (H5, on Ear)

- **Tunes**: the lead sheets' melodies, phrase by phrase. The key is set by its tonic chord and
  the first note is given; play the phrase back. Correct is every key in order; timing is not
  judged. Phrases come in order through the tune, then the whole tune; **In another key** starts
  the tune on another note (the first note given again), which is transposing by ear.
- Items are keyed by tune and phrase; the `answers` store (family `tune`); mastery as Echo's.

### Clarifications (decided during H5)

- **Where.** Tunes is a family of the Ear page, between Cadences and Rhythm: Intervals, Chords,
  Echo, Cadences, Tunes, Rhythm, on Ear, on Progress and among an assignment's level tasks. Its
  levels are the library's eight lead sheets, in the library's order, each named by its title (a
  number stands where a level's id does); the suggested one is the first not learnt. There is no
  session length and no way of answering to choose: the one choice is the key.
- **No MusicXML at run time.** `core/tuneData.ts` holds each melody as it is sung (repeats played,
  a D.C. written out), one phrase to a line, with its key signature, its meter and the tempo it is
  played at; `core/tunes.ts` reads it into keys, bars and phrases. A test
  (`src/pieces/library/tunes.test.ts`) reads the eight library files and holds the table to them
  note for note (pitch and spelling, length, ties, rests, bars), and its keys to the keys a run of
  the piece presses. So the Ear page, the summaries and the validators of imported and synced
  answers need neither the files nor the parser. Only `core/tuneList.ts` (the ids, how many
  phrases each has, the item keys) is loaded when the app starts; the melodies come with the Ear
  page, and Verovio when a tune is played (the test of what the start loads holds this).
- **Phrases** are the table's own: a line of the song as it is sung, from its upbeat where it has
  one, 5 to 15 keys. Twinkle 6 of 4 bars; Frère Jacques 5 of 4 bars; Row Your Boat 4 of 2 bars;
  Amazing Grace its 4 lines of 4, 3, 4 and 3 bars; Jingle Bells 8 of 2 bars; Oh! Susanna 8 of 4
  bars (the chorus twice); Auld Lang Syne 12 half lines of 2 bars (the chorus twice); Swing Low 12
  calls and responses of 2 bars (refrain, verse, refrain). A repeated section's phrases are asked
  again where they are sung again, and the whole tune has them.
- **Tempo.** Each tune at a pace of its own, kept moderate, in quarters a minute: Twinkle 96,
  Frère Jacques 92, Row Your Boat 90 (its dotted quarter at 60), Amazing Grace 84, Jingle Bells
  108 (the print's 132 is for playing it), Oh! Susanna 100, Auld Lang Syne 60, Swing Low 50 (the
  print writes the song's quarters as eighths).
- **The prompt.** The tonic triad, block, 900 ms, in root position, its root the highest tonic
  that is not above the tune's lowest note (so the same chord sounds before every phrase, under
  the tune); a beat's rest (a dotted quarter in 6/8); then the phrase in its own rhythm, its
  rests kept, each note sounding 90 % of its length so that a note struck again is heard again.
  The whole tune is played through once the same way. Answers count from the last note-on, as
  everywhere on Ear.
- **Answering** is Echo's: the first note is marked on the keyboard and is played too; every key
  counts, in order, and a note that comes twice is struck twice; the first wrong key ends the
  attempt, and only the first attempt is scored; timing is not judged. Dots show the phrase's
  notes filling as they are played; the whole tune (more than 24 notes) has a bar and a count
  instead. Hear again before the answer plays the chord and the phrase, is counted, and keeps the
  keys already played.
- **After a wrong key** the phrase is drawn and played again, alone: without the chord, and of
  the whole tune only the phrase it went wrong in, which the result names with the note's number
  in it ("Phrase 3, note 4: you played C♯5, not D5"). Hear again then plays that phrase again
  and is not counted. This differs from Echo, whose Hear again after a wrong answer plays the
  chord too: a tune's key has been in the ear since its first phrase.
- **The drawing** is Verovio's, through `ScoreView` (`ui/ear/TuneStaff.tsx`, loaded on demand;
  the engine is fetched while the first phrase plays). `core/tuneXml.ts` writes the phrase as
  MusicXML: one treble staff, the key and time signatures, the phrase in its own rhythm from its
  first note to the end of its last (an upbeat and a last bar cut short are short bars; beams by
  the beat, ties and rests as the lead sheet has them), in the session's key. The key played
  wrong stands beside the note that was asked, as a chord with it, in red; the keys played right
  before it are green; what follows stays black. The wrong key has its own sign where it is not
  a note of the key, which changes nothing of what follows; on the asked note's own line or space
  (F for F♯) both notes are given their signs. A key far off the staff is drawn where it is, on
  its ledger lines. The phrase is drawn at the largest of three sizes that keeps it on one system,
  stretched across the card; a phrase too long for any of them (a long one on a phone) takes two
  systems at the middle size, the second at its own width. Echo's staff (VexFlow) writes quarters
  only, which a tune's rhythm is not.
- **In another key** is a choice of the setup (In its key, the default, or In another key,
  remembered in this browser) and a button of the summary. One key is drawn for the session, from
  its first phrase to the whole tune: 1 to 6 semitones up or down, each of the eleven other keys
  as likely as the next (six up and six down are one key an octave apart, so each of the two is
  drawn half as often as another distance), named by H4's rule (the simpler signature, F♯ rather
  than G♭). The tunes lie within C4–F5, so every key lies within F♯3–B5. **Again** on the summary
  keeps the choice: the tune's own key again, or another one drawn anew.
- **Records.** An answer per phrase and one for the whole tune: family `tune`, `level` the
  tune's id in the library (`trad-amazing-grace`), item `tune:<id>:<n>` (the phrases as sung,
  counted from one) or `tune:<id>:whole`, `by: 'play'`, the prompt the keys asked, the answer the
  keys played up to and including the wrong one, `ms` from the window opening to the last key,
  `replays`, and `key`, `{ tonic, scale: 'major' }`: the key it was played in. Its ear session has
  the family `tune`, `length` the tune's phrases and one, and the session's `key`. Validation, on
  import and sync, holds every answer to the table again: its keys must be the item's part of the
  tune moved by 0 to 6 semitones either way, its key the one that distance names, and `correct`
  what the keys say; a session's key is one of the twelve, its misses are of its own tune in its
  key. `SYNC_SCHEMA` 20 (older builds skip `tune` answers and sessions); the export file needs no
  new version. The phrases are therefore part of the records: an item names a phrase by its
  number and a session's length is their count, so a tune phrased otherwise later, or a lead
  sheet whose melody changes, needs the stored answers and sessions migrated with it.
- **Learnt, not mastered by a share** (a change from "mastery as Echo's"). Echo's window is its
  last 20 melodies, each a new one; a tune's phrases are always the same. A tune is learnt when
  the latest answer given without Hear again to each of its phrases and to the whole tune is
  right, in any key: one answer to each (7 for Twinkle, 13 for Auld Lang Syne), all of them
  right, where Echo's 90 % would let a phrase stay wrong. A part missed since makes the tune not
  learnt until it is played right again. The level's figure is "5 of 7 right without a replay".
- **Summary and log.** The summary names the tune and its key, the phrases asked, the share
  right, whether the whole tune was right, and the replays; each miss by its phrase and note (of
  the whole tune, the phrase it went wrong in) with the step asked and the step played, named in
  the session's key. No time is shown, here or after a right answer: a phrase takes as long as it
  is. The session list says "Tunes by ear", the tune in its key, its phrases and the whole tune.
- **Progress.** A section "Tunes by ear" after the cadences: a tile per tune under its title;
  the items, each phrase and the whole tune, without a time and weighed by their misses alone;
  and the confusion table as Echo's, the step into each note asked against played, except that
  the same note again is a step of its own (`0`, headed `P1`), since tunes repeat notes, and only
  a leap past the octave is Other. Under "How you are doing" tune answers count in the Ear chart
  (right without Hear again), each tune compared with itself as a level is.
- **Assignments.** A level task may name a tune (the family Tunes, the tune by its title): a
  number of sessions, each played as far as the whole tune, in any key, or **Learn the tune**
  ([ASSIGNMENTS.md](ASSIGNMENTS.md)). Its button opens Ear on the tune.

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

### Clarifications (decided during H6)

- **The page.** Improvise is the chooser's third practice. Its choices are remembered in this
  browser (`dacapo.harmony.improv`): the backing chosen last and, for each backing, its key, scale,
  left hand and feel; the tempo, the click, call and response and the MIDI channel for all. Start
  turns the page into the loop's screen; Stop (or the route changing, or the page hidden) ends it
  and shows the feedback, whose **Change the backing** returns to the setup.
- **The backings** (`core/improv.ts`), one chord to a bar, all in 4/4 (so the strong beats are
  always the 1 and the 3; the waltz is not offered): the **12-bar blues** of H2 with `V7` in its
  last bar, the turnaround that takes a loop round (H2's ends at home, which looped gives six bars
  of `I7`), in C, G or F; **`I–vi–IV–V`** and **`ii7–V7–Imaj7`** (its I held a second bar, as H2's)
  in C, G, D, B♭ or F; and the **two-chord modal vamp** `i7–IV7` of a Dorian mode, a bar each
  (Dm7–G7 in D Dorian), in A, E, G or D Dorian. The keys are listed round the circle of fifths,
  the chords spelled from the key by letter as H2's are.
- **The left hand only.** The backing is a pianist's left hand: H2's patterns (`leftHand` in
  `core/progressions.ts`, shared with the scores) — **stride**, **arpeggio up** and **Alberti
  bass** — and, over the blues only, the **blues shuffle**: the root with its fifth, sixth, seventh
  and sixth, a dyad struck twice a beat (long–short when swung), the root from D2. The right
  hand's chords are not played, so the player's register (C4 up) is theirs: the backing stays
  within C2–D♯4 (only the arpeggio's tenth reaches above B3), the shuffle and the stride within
  B3. Defaults: the shuffle for the blues, stride for `ii–V–I`, the arpeggio for the others. The
  loop is always voiced going round. Each note ends a moment before its written end (6 % of a
  beat, at most 30 ms) so a key struck again sounds again; the stride's chords on 2 and 4 are
  short (0.55 of a beat).
- **Feel and tempo.** Straight eighths fall halfway through the beat; swung ones two thirds in, the
  long and the short eighth 2:1 (a triplet feel), each note's end mapped the same way. Swing is the
  default for the blues and `ii–V–I`, straight for the others. Tempo 60, 72, 80 (the default), 96,
  112 or 132 to the quarter.
- **On the instrument.** The backing goes through the output's scheduler as the demo does, a bar
  at a time queued a second ahead (a bar is generated as it is queued, so the calls come with it),
  and is silenced on Stop, a route change and a hidden page. Its levels follow Settings'
  accompaniment level: the bass at it, the chords 8 below, the off-beat eighths 6 lighter again,
  the calls 8 above, so the player's own playing is on top. It goes on MIDI channel 1 unless
  another is chosen (1–16, offered only for a MIDI output): channel 1 sounds on every instrument,
  and the app cannot know which other channels one listens on; the built-in piano keeps the
  backing's voices apart from the player's keys whatever the channel. One bar of count-in clicks
  always comes first; the click through the loop (every beat, the 1 accented) is a choice, off by
  default. The header's metronome is paused while a loop or a playback lasts (pause reason
  `improv`).
- **The scales**, spelled from the key by letter: the major scale, the major pentatonic, the blues
  scale (1 ♭3 4 ♭5 5 ♭7, its blue note written as a ♭5: F A♭ B♭ C♭ C E♭), the Dorian mode and the
  minor pentatonic. The blues offers the blues scale (the default) and the major pentatonic;
  `I–vi–IV–V` the major pentatonic (the default) and the major scale; `ii–V–I` the major scale (the
  default) and its pentatonic; the vamp its Dorian mode (the default), the minor pentatonic and
  the blues scale.
- **The screen.** The chord now and the next bar's, large, with the numeral of the chord now;
  under them the loop's bars four to a line as a lead sheet lays them out, the bar playing lit and
  the calls' bars in italics; the bar and beat, or the count-in, above; the scale's name and notes;
  a keyboard of four octaves from C3 with a small dot on every key of the scale and a larger green
  one, on a pale green key, on the tones of the chord now; each key held tinted green (a chord
  tone), blue (a tone of the scale) or amber (outside) — never red, as nothing is wrong — with a
  legend.
- **How a note is heard**: a chord tone of the chord sounding when it was struck, else a tone of
  the scale, else outside. The time is the key's less the calibrated latency, as rhythm mode takes
  it; a note up to a sixteenth before a bar's 1 belongs to that bar (an anticipation is heard with
  the chord it leads into); a note in the count-in is heard with the first chord.
- **Call and response.** Phrases of two bars from the first: the even ones the backing's calls,
  the odd ones the player's answers (in the blues a call and its answer to each four-bar line). A
  call is generated: one of eight two-bar rhythms (pickups, syncopations, runs of eighths), its
  notes moving mostly by step of the scale with now and then a third or a fourth, within C4–C6
  (kept to D4–A5), every note on a 1 or a 3 a tone of the chord then, the last the root, 3rd or 5th
  if one lies within a third (else the nearest chord tone), over by the second bar's last eighth so
  the answer starts from a breath. Each loop draws a seed, stored with its session, so the same
  calls play again when its take is played back.
- **The figures** (`core/improvFigures.ts`), over the player's bars (every bar, or the answers):
  the notes heard as chord tones, scale tones and outside; of those on a strong beat (within a
  sixteenth of the 1 or the 3) the chord tones; the range, lowest to highest key; notes a bar;
  silence, the share of the time nothing sounded (a key held, or let go under the sustain pedal
  until its lift); repetition, the share of the melody's notes (of keys struck within 30 ms the top
  one) in a figure of four whose shape — the semitones from each note to the next, at any pitch —
  was played before; and with call and response the calls answered (a call counts once its answer
  has begun, answered with at least a note). The feedback says them in sentences, three of them
  large, and draws the share of chord tones in each bar of the loop, every time round, under its
  chord. Feedback, not a score: no figure is called good or bad.
- **Records.** A session of kind `improv`: Start and stop, the active time (as the other kinds', a
  pause between keys longer than a minute counting as a minute), the backing, key, scale, pattern,
  feel, tempo, click, call and response and the calls' seed, and the figures as counts (with the
  chord tones and notes of each bar of the loop), checked on import and sync. Recorded only when a
  key was struck from the first bar's 1 on: a backing only listened to is not practice. It is
  stored again every 30 seconds while the loop goes on, and before each chunk of its take, so a
  closed tab keeps most of it; of two copies the one with more notes, then the later, wins.
- **The take** goes in the `takes` store under the session's id, in EXPRESSION.md's format and
  chunks: piece id `improv:<backing>:<key>` (`improv:blues:F`), the checksum of the backing's left
  hand and feel (`fnv1a`, so a backing generated otherwise since is known), hands `both`, repeats
  `play`, tempo 100 (the session has the tempo), mode `rhythm` (time 0 is the first bar's 1, the
  count-in negative) with the latency, and every key's step −1 (there is no score). It is written
  once its session is, the rest after Stop once the keys held then are let go. It validates as any
  take, so older builds keep it. `SYNC_SCHEMA` 15 (14 is R2's); the export file needs no new
  version.
- **Played back with its backing.** P5's playback follows a score and Improvise has none (it was
  built before P5, too), so Improvise plays its own takes:
  **Play back with the backing** on the feedback and on each of **Your improvisations** (the six
  latest, with when, how long and the share of chord tones on 1 and 3). The take's keys play with
  their velocities and the sustain pedal in their lengths (the scheduler sends notes, not
  controllers; sostenuto and una corda are not played back), their times less the latency, with
  the backing generated again from the session (its calls from the seed), without the click, to
  where the loop stopped; the screen follows it, the keys tinted as they were heard. It is
  listening, not practice, and is silenced as the demo is. A take not on this device (one not yet
  synced) says so.
- **Elsewhere.** The session list names an improvisation by its backing and key, with the notes
  played and the share of chord tones on 1 and 3. The public profile (version 2) publishes the kind
  as `improv`, which the service folds into "Other practice" until its page names it; with a
  service before version 2 it counts as free play.

## Milestones

1. ✓ **H1 Chords** — the Harmony page, symbols, levels, answers.
2. ✓ **H2 Progressions** — generated progressions and patterns on the Pieces machinery;
   cadences on Ear.
3. ✓ **H3 Lead sheets** — symbols in the parser, the library's lead sheets, the left hand from the
   symbols.
4. ✓ **H4 Transposing** — the Key control on every piece.
5. ✓ **H5 Playing by ear** — tunes on Ear, phrase by phrase, in their key or another.
6. ✓ **H6 Improvise** — backings, feedback, call and response.

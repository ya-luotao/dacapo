# Changelog

All notable changes to dacapo are listed here. Versions follow
[Semantic Versioning](https://semver.org/); the export file format has its own version number,
which is noted when it changes.

## Unreleased

Export format version 9: the file now includes imported pieces (from version 2), piece practice
sessions and their step records (from version 3), rhythm-mode steps with their timings (from
version 4), scale sessions with every scale run as played (from version 5), ear-training answers
and sessions (from version 6; the theory cards', Read's rhythm, rhythm dictation's, the tunes'
and the chord symbols' answers and sessions go in the same lists), the
click's tempo and grid of scale runs played with it (from version 7), the takes of piece runs
(from version 8), and assignments and kept reports (from version 9). Version 1 to 8 files still
import.

### Offline (G6a, [docs/OFFLINE.md](docs/OFFLINE.md))

- The web app **opens and works without a network** once it has been opened with one. A service
  worker stores the app (about 4 MB) in the background after the first load; with a network, a
  new release is still what the next load shows.
- The notation engine of Pieces and Scales, the built-in piano's samples, the lessons' pictures,
  the other languages and the licence texts are stored when they are first used. **Settings →
  Your data → Offline** says what is stored, and **Store everything** stores the rest at once
  (about 12 MB), with a count as it goes, and again after each release.
- Your practice data is where it was (IndexedDB) and is not touched. The Apple app carries the
  app inside it and has no worker; nor does `pnpm dev`.
- For a build or a host of your own: the build writes `sw.js` at its root, to be served without
  caching (`public/_headers`); `scripts/offline/sw-remove.js` is the worker that withdraws it.

### The first visit (G4, [docs/START.md](docs/START.md))

- **Start**: the first page's button opens a short page before the first practice. **Where are
  you starting from?** New to the piano: the lessons begin with the keyboard itself, and Today
  proposes them. Playing already: every practice is open at once, the lessons are left out of
  Today (Learn stays where it is), and you say what you read without counting lines, which sets
  where Read's notes begin (L3, L5 or L7). The levels before it are not marked as mastered.
- **What will you play on?** The page listens and says what it finds: your MIDI keyboard by name,
  or that none is connected, that this browser has no MIDI, or that MIDI is blocked, with what to
  do. Press a key, on the instrument, the computer keyboard or the screen, and a small keyboard
  lights it: “It is heard.” One button plays a note through the output in effect.
- Neither question has to be answered, and nothing is locked: the page is reached from the first
  visit's button alone, and **Your starting point** in Settings changes the answer. It is kept in
  this browser, not synced and not exported.
- **Every practice page says what is playing** when no MIDI keyboard is connected: “No MIDI
  keyboard connected: the computer keys play, A to K.” on Read, Ear, Harmony, Scales and a
  piece's page. The line can be dismissed, and comes back if the reason changes. On a phone or a
  tablet, which has no computer keys, it names the keys on the screen, and the start page draws
  a keyboard to play by touch instead of the computer keys' letters.

### First pieces, with fingering (G5a, [docs/PIECES.md](docs/PIECES.md))

- **Ten first pieces** in the library, so that the way from the lessons to the Minuet in G has
  steps. At Initial: Türk's _Aller Anfang ist schwer_, _Der muntere Knabe_, _Hans ohne Sorgen_
  and _Ich bin so matt und krank_ (from his sixty Handstücke for beginners), Czerny's Op. 599
  No. 11 and Beyer's _Kinderlied_, Op. 101 No. 24. At grade 1: Türk's _Bey der Wiege zu singen_,
  Beyer's _Abendlied_ (No. 58) and Allegretto in 6/8 (No. 66), and Schumann's _Melodie_,
  Op. 68 No. 1.
- They carry **their editions' fingering**, on the notes where the edition prints it: Türk's
  own (the edition of 1797), Ruthardt's Edition Peters print of Beyer, Buonamici's Schirmer
  edition of Czerny, and Klauser's fingering of Schumann (Schuberth, 1867). The figures are
  drawn in the score, and with Show keys a marked key carries its finger. The older built-in
  pieces still have none.
- Each was read from a scan of its public-domain edition and proofread blind by a second
  reader, fingering included; the _Melodie_ also matches an independent MIDI file note for note.

### Today, and where you are (G1, [docs/TODAY.md](docs/TODAY.md))

- **Today**: once you have practised here, the home page opens on a plan for the day, made from
  your own records: a warm-up (the scale to play next, or the next new one), the piece in hand
  (or the next piece to begin), something new (the next lesson, and the suggested level of the
  practices you have left alone longest) and the pieces due for review, to play through. Each
  step is a link that starts it, with a line saying why it is there, and it ticks itself once it
  is played.
- The plan is for **10, 20, 30 or 45 minutes** (20 unless you choose). It is made once a day
  from what you had played before today, so it stays as it is while you play it.
- A lesson of Learn **opens** the practices it prepares (lesson 3 the intervals and the pieces,
  lesson 4 rhythm and sight-reading, lesson 6 the scales, key signatures and tunes, lesson 13 the
  chords), and a practice you went to on your own is open too: only what is open is proposed.
  Nothing is locked: every page is one click away as before.
- While an **assignment** has open tasks, the home page shows it in the plan's place.
- “Your practice” and “Due for review” on the home page are part of Today now. A first visit
  sees the title page as before.
- **Where you are**, on Progress: each practice on a line, how far it has got (lessons read,
  levels mastered, scales played, pieces in review and played to the end per grade) and its next
  step as a link.
- Both are worked out on the device from what is stored. Nothing new is recorded, synced or
  exported.

### Assignments on paper (G6b, [docs/ASSIGNMENTS.md](docs/ASSIGNMENTS.md))

- **Print** on an assignment's page and on a report: the browser's own print dialog, and a page
  laid out for paper, in black on white whatever the theme, without the header, the buttons and
  the ways to share it. The checklist prints with its ticks and figures as they stand, a report
  with each task's figures and the minutes of each day. A task is never split across two pages,
  and the pages are numbered where the browser can.
- A report kept under an assignment is printed alone.
- Not in the Apple apps, whose web view does not print.

### A run as a MIDI file (G6b, [docs/PIECES.md](docs/PIECES.md))

- **Save as MIDI**, beside Play back on both summaries and on each of Your runs, and on
  Improvise's feedback and Your improvisations: the run as a Standard MIDI File, every key with
  its velocity and its release and the three pedals, to hear in another program, open in a
  notation program or send to a teacher.
- A rhythm-mode run carries the score's tempo at the run's percent and its time signatures, a
  pickup as a bar of its own length, so its bars line up in a notation program; the count-in is
  left out. A wait or memory run has no beat: it is at ♩ = 120 with every key at its own time.
- An improvisation is in 4/4 at its backing's tempo. The backing is not in the file.
- The file is made on the device and named after the piece and the time of the run. Nothing
  stored, synced or exported changes.

### Tunes by ear (H5, [docs/HARMONY.md](docs/HARMONY.md))

- **Tunes**, a sixth practice on the Ear page: the melodies of the library's eight lead sheets,
  played back by ear. The chord of the key sounds, then a phrase of the tune in its own rhythm,
  its first note marked on the keyboard; play it back note by note. The phrases come in order,
  as the song is sung, then the whole tune. Timing is not judged.
- **In another key**: the same tune starting on another note, in a key drawn anew for each
  session, up to six semitones up or down. That is transposing by ear; the summary offers it for
  the tune just played.
- After a wrong note the phrase is drawn on the staff in its rhythm and its key, the notes
  played right in green and the wrong key in red beside the note it should have been, and the
  phrase is played again; of the whole tune, the phrase it went wrong in.
- A tune is **learnt** once every phrase of it and the whole tune were last played right without
  “Hear again”, in any key. Progress has a section for the tunes, with each phrase's figures and
  the steps played for the steps asked, and the Ear chart of “How you are doing” counts them,
  each tune compared with itself.
- An assignment's level task can name a tune: a number of sessions, or **Learn the tune**.
- Tune answers sync and are exported with the other ear answers (older builds skip them); the
  export format is unchanged.

### Reports (T2, [docs/ASSIGNMENTS.md](docs/ASSIGNMENTS.md))

- **Send a report**, under an assignment's checklist, turns it into a report for whoever set it:
  each task with its figure, whether it is done, the best and the last run, and the minutes of
  each day, with your name and a note if you like. Figures only: no recordings, and nothing
  outside the assignment.
- It is shared the same way, as a link to copy or a file, and dacapo sends it nowhere.
- The teacher opens it and reads it task by task, next to the assignment it answers, and can
  **keep** it: kept reports are listed under their assignment, the latest first. A report whose
  assignment is not on the device can still be read.

### Assignments (T1, [docs/ASSIGNMENTS.md](docs/ASSIGNMENTS.md))

- A new page, **Assignments** (from Progress and the More menu): set a week's practice as tasks,
  with a title, a note, your name, a start and a due date. A task is a **piece** with its bars,
  hands, mode and tempo, and a number of runs (or runs with at least so many of the notes right,
  or in time); a **scale** or technique exercise, free or with the click at a tempo; a **level**
  of Read, Ear or Harmony, for a number of sessions or until it is mastered; a **lesson** to
  read; or **minutes** a day on so many days.
- **Shared without a server**: as a link to copy (the assignment is packed into the link itself,
  after the `#`, which no server sees) or as a file. An assignment that names a piece you
  imported goes as a file, which carries the score; a piece that is already there is not added
  twice.
- Whoever opens the link or the file sees the assignment, with the name its teacher typed,
  before anything is stored, and adds it to theirs. It is then a **checklist** worked out from
  what they practise between its dates: each task with its figure ("2 of 3 runs", "Best 94% in
  time"), a tick when it is met, and a button that starts it with its settings: the piece with
  its bars looped and its hand, mode and tempo set, the scale with its click, the level chosen.
  Three times round a loop are three runs. A piece may be a lead sheet, with whatever left hand
  each player has made from its chord symbols; a run counts in the piece's written key.
- The **home page** shows the current assignment's open tasks.
- Assignments are stored on the device, exported and imported with everything else, and synced
  between your own devices when you are signed in. dacapo sends an assignment to no one: you do.
- A damaged or foreign link or file is refused in a sentence. A task set with a later version
  than yours is shown as such, and the rest of the assignment still works.

### Transposing (H4, [docs/HARMONY.md](docs/HARMONY.md))

- Every piece has a **Key** under Options: move it up to six semitones up or down, each key by
  its name (`B minor (+2)`). The score is redrawn in the new key, in the simpler of its two
  signatures (D♭, not C♯), every note spelled as that key spells it (Für Elise's D♯ is E♯ in B
  minor), chord symbols and a left hand made from them included. Listen, the other hand, wait,
  rhythm and memory mode, play back and the on-screen keyboard all follow.
- Runs in another key are kept apart: **Weak bars** and the library's steady bars count the runs
  in the written key, and **All keys** counts them all; Your runs names each run's transposition
  and plays any of them back. The review schedule counts runs in the written key only.
- A transposed run's steps, session and take say how far it was moved (`transpose`); it rides on
  `SYNC_SCHEMA` 18.

### Lead sheets (H3, [docs/HARMONY.md](docs/HARMONY.md))

- **The left hand from the chord symbols.** A piece with chord symbols has a **Left hand** option:
  as written, or a pattern made from the symbols — block chords, root and fifth, a waltz, Alberti
  bass, an arpeggio or stride, whichever fit its meter (2/4, 3/4, 4/4, 6/8 …). The pattern is
  written on the bass staff under the melody, always below it, so you practise it, hear it (Listen,
  or as the other hand), and have it judged and recorded like a written left hand. A lead sheet
  starts with block chords. Each pattern keeps its own records, weak bars and runs.
- **Lead sheets have their own heading** on the Pieces page, after the graded pieces, each with
  its level. Imported MusicXML with chord symbols gets the same Left hand option.
- A hand a piece has no notes for can no longer be chosen.
- A run's session carries its left hand (`leftHand`); `SYNC_SCHEMA` 18.
- **Eight lead sheets** join the built-in pieces: a public-domain tune on the treble staff with
  chord symbols of our own (MIT) above it, the bass staff left for a left hand made from the
  symbols. Twinkle, Twinkle, Little Star, Row Your Boat and Auld Lang Syne from the Franklin Square
  Song Collection (1881); Frère Jacques from Weckerlin's Chansons et rondes enfantines (1885);
  Amazing Grace from Excell's Coronation Hymns (1910); Jingle Bells (moved from A♭ to G),
  Oh! Susanna and Swing Low, Sweet Chariot from Heart Songs (1909). Each melody is the print's,
  note for note, read from a scan and proofread blind; keys of at most two sharps or flats,
  Initial to grade 2. Titles, composers, notes and forms in all five languages.
- **Chord symbols in the parser.** A score's `<harmony>` elements are kept as its symbols: root,
  kind, bass and degrees at their bar and tick, the text printed, and the app's symbol where it has
  one (H1's qualities, `add9` from an added 9th). They are laid out through the repeats like the
  markings and leave the notes, the steps and the checksum alone, so every record stays valid.
  Imported MusicXML with symbols has them too. H2's progressions read back with theirs.
- **Pieces tools.** `scripts/pieces/` writes a symbol from an `@h:` token (`@h:G7`, `@h:D/F#`),
  its kind's text in the app's style.

### Memorising (P7, [docs/PIECES.md](docs/PIECES.md))

- **Memory** is a third practice mode beside Wait and Rhythm: the score fades while you play from
  memory, in stages you choose: all shown, every other bar hidden, only the first bar of each
  phrase, or nothing but the first bar. A phrase is four bars, or less where the score marks a
  section with a double bar, a repeat sign or a rehearsal mark. A hidden bar keeps its barline and
  shows its number.
- A wrong key in a hidden bar shows the notes for a moment; **Peek** (hold P, or the button) shows
  the bar. Each is a **prompt**. **Start anywhere** starts from a random phrase, its first bar
  shown for two seconds.
- The summary lists the prompts and the bars that needed them; Weak bars gains **Memory**, the
  prompts per run in each bar.

### Review schedule (P6, [docs/PIECES.md](docs/PIECES.md))

- A piece you have played to the end comes back for **review** after 1, 2, 4, 7, 14, 30 and 60
  days. A run to the end with at most one wrong or missed note in 50 (and in rhythm mode at least
  80 % in time, in wait mode no bar much slower than the rest) moves it to the next interval; one
  with more than one wrong note in 10 moves it back; other runs keep it.
- **Due for review** comes first on the Pieces page, each piece with how long since you last
  played it through, and on the home page ("Due for review: 3 pieces"). The library says when
  each piece is due.
- A piece can be **taken out of review** and put back (the Pieces page and the piece's Options).
  For an imported piece this syncs between your devices; for a built-in piece it is kept on the
  device.
- The schedule is worked out from your runs, so it follows them through sync and import.

### Play back your run (P5, [docs/PIECES.md](docs/PIECES.md))

- **Play back** a run on your instrument (or the built-in piano) as you played it: each key as
  hard and as long as you held it, and the sustain, sostenuto and una corda pedals as you moved
  them. The cursor follows the notes on the score, the keys light up on the keyboard, and a wrong
  note shows in red where it fell, with its name under the score.
- Pause and go on, start **from a bar**, and **Compare**: each bar as written (the demo at the
  run's tempo), then as you played it, bar by bar or all at once.
- It is in both summaries and on every run in **Your runs**. Listening is not practice time, and
  it stops on another page and pauses when the page is hidden, as the demo does.

### Improvise on Harmony (H6, [docs/HARMONY.md](docs/HARMONY.md))

- Harmony gains a third practice, **Improvise**: a backing plays a loop of chords on your
  instrument (or the built-in piano) — the 12-bar blues in C, G or F with its turnaround,
  `I–vi–IV–V`, `ii7–V7–Imaj7` or a two-chord Dorian vamp — its left hand a blues shuffle, stride,
  arpeggio or Alberti bass below your register, straight or swung 2:1, at 60 to 132, after a bar of
  count-in, with the click if you want it. Its level follows Settings' accompaniment level, under
  your playing; a MIDI output can take it on another channel.
- The chord now and the next are shown large over the loop's bars as a lead sheet lays them out,
  and the keyboard marks a suggested scale lightly (the major scale, its pentatonic, the blues
  scale with its ♭5, Dorian), the chord's own tones a shade darker. Each key you play is tinted
  as a chord tone, a scale tone or outside — nothing is marked wrong.
- **Call and response**: the backing plays a two-bar phrase, made up from the scale and landing
  on the chord, and you answer it in the next two.
- When you stop: feedback, not a score — the share of notes on the 1 and the 3 that were chord
  tones, how every note was heard, the range, notes a bar, how much was silence, how much repeated
  a figure played before, the calls answered, and the chord tones bar by bar. The loop's take is
  kept and **plays back with its backing**, there and from **Your improvisations**.
- Sessions of kind `improv` count for the minutes, the streak and the session list; they sync
  (`SYNC_SCHEMA` 15) and export with their takes. The public profile names them from version 2
  and counts them as free play before it. Every string in five languages (即兴, 即興, 即興演奏,
  즉흥 연주).

### How you are doing (Q1, [docs/PROGRESS.md](docs/PROGRESS.md))

- Progress gains **How you are doing**, above the sessions: a small chart for each practice with
  three weeks or more of enough practice, a figure per week over the last 26 weeks (your week, as
  the year grid has it): reading notes (median time to a right answer), sight-reading (notes right
  and in time at first sight), reading theory (share right), ear and rhythm by ear (share right
  without "Hear again"), chord symbols (share right), in time (median distance from the beat of
  pieces in rhythm mode, rhythm lines, rhythms tapped back by ear and scales with the click),
  scales (median timing spread of scale and arpeggio runs as a share of a note; technique is left
  out) and pieces (steps right the first time in wait mode).
- Under each, a sentence compares the last four weeks with the four before, in words and with
  both figures ("Faster than a month ago: 1.5 s against 1.7 s"; "About the same" within 5 % for
  a time or a spread, within 2 percentage points for a share). Where
  levels differ, the comparison is made level by level within the levels both periods have, and
  the share of each level is shown under the chart.
- A practice with too few weeks gets a line saying what a week needs and how far this week is.
  Each chart has a table of every week. Nothing new is stored: piece steps and clicked scale runs
  of those weeks are read when the page opens.

### Rhythm dictation on Ear (R2, [docs/READING.md](docs/READING.md))

- **Ear** gains a fifth family, **Rhythm**: a bar of count-in, then one bar played on one key at
  the level's tempo (the same tempo as Rhythm on Read, kept per level), in Rhythm's levels R1–R8.
- **Tap it back**: after the bar, a second bar of count-in, then tap it with the click on any key,
  the pad or any letter, timed and judged as a line on Read (the latency calibration taken off);
  the bar is then drawn with its counts, every note inked in time, early or late (with the arrow
  and the ms) or missed, and taps too many marked.
- **Choose it**: three or four bars written out, big buttons with keys 1–4, the right one among
  bars that differ from it in one cell, the cells you confuse it with first (a triplet with two
  eighths before you have any); never two that sound alike.
- **Hear again** (Space) is counted before the answer and starts a bar to tap over; a wrong answer
  plays the bar again and waits for Next (Enter). Mastery at 90% of the level's last 40 answers
  without a replay; sessions of 5, 10 or 20 bars with a summary of the cells to work on.
- On **Progress**, "Rhythm by ear (dictation)" shows its levels, weakest cells and what each cell
  is chosen or tapped as, the cells drawn small as the table's headings.
- Answers of the family `rhythmEar` (one per cell tapped back, one per bar chosen), sessions of
  kind `ear`; imports and sync check and judge every answer again. `SYNC_SCHEMA` 14; the export file
  needs no new version.

### Sight-reading on Read (R3, [docs/READING.md](docs/READING.md))

- **Read**'s row of what is read in time gains **Sight-reading**: short music never seen before,
  generated on the grand staff and drawn by Verovio, four bars (eight from F5, in two phrases).
  Look at it for 10 to 30 seconds with a countdown, as in an exam (Start skips it), then play it
  through once **in time** (a bar of count-in, and nothing waits) or note by note in **Wait** for a
  first look. **Read ahead** covers each bar as its first beat arrives (Hard: half a bar sooner).
- Eight levels: the right hand in C position by step; the left hand; the hands in turn; a melody
  over held bass notes; skips and a bass note each half bar (eight bars, D and B♭ major, A minor);
  two moving hands with fifths and sixths in the bass (E and D minor); position shifts,
  accidentals and ties (up to three sharps or flats); chords, broken chords and Alberti basses in
  the left hand with sixteenths in the right (up to four). Each fragment is made by rules from a
  seed: a harmony of I, IV and V (ii and vi from F6) ending on a cadence, chord tones on the strong
  beats, steps mostly and leaps limited by level, hand positions, never parallel fifths or
  octaves; only each hand's first note is fingered.
- After a run every note is inked in time, early, late or missed, each bar shows its notes right
  and in time (a table gives wrong, missed and extra notes), and the run its share right and in
  time, the distance from the beat and whether you rush or drag; **Listen** plays it as written,
  **Again** plays it again, **Next** brings a new one. Sessions are 4 or 8 fragments; the tempo is
  kept for each level.
- A session is stored as one record of kind `sight` with each fragment's level, seed and generator
  version and each run's figures (not the notes), again after every run, so a closed tab loses
  nothing; the minutes, the streak and the session list count it (the public profile as reading).
  A level is mastered when the last five fragments played in time each had 90% of their notes
  right and in time at first sight. `SYNC_SCHEMA` 13; the export file needs no new version.

### Harmony: progressions (H2)

- Harmony gains a second practice, **Progressions**: choose a progression (`I–IV–V–I`,
  `I–vi–IV–V`, `ii7–V7–Imaj7`, `vi–ii–V–I`, `i–iv–V–i` in minor, the 12-bar blues), a key round the
  circle of fifths, the left hand's pattern (block chords, root and fifth, waltz, Alberti bass,
  arpeggio up, stride) and a tempo, and it is written out as a score: the chord symbols above,
  the roman numerals below, the right hand in close-position chords that move as little as they
  can (common tones kept, no parallel fifths or octaves against the bass), each hand on its staff
  ([docs/HARMONY.md](docs/HARMONY.md)).
- It is practised as a piece: wait and rhythm mode, a hand at a time, loops, Listen, weak bars and
  Your runs, with its runs and steps recorded, exported and synced as a piece's are. **Your
  progressions** lists the ones practised lately with how far you got, and the session list names
  them in your language.
- **Cadences by ear** join the Ear page as a fourth family: four chords, the first setting the
  key, and you name the cadence the last two make (authentic, plagal, half or deceptive) by the
  buttons. Four levels, from half and authentic to all four in minor keys too; after each answer
  the progression is written out in its key. Answers and sessions are kept, exported and synced
  like the other ear answers, and Progress has a section for them with what you hear instead.

### Ornaments (X4, [docs/EXPRESSION.md](docs/EXPRESSION.md))

- **Wait mode** waits for an ornament's note: the ornament's other notes (a mordent's lower note,
  a trill's upper one, a grace note), in any order, are neither right nor wrong, before the note
  and after it until you play on.
- **Rhythm mode** times the note where the ornament strikes it (after an appoggiatura, half its
  length later; after a turn or a trill from above, a thirty-second later), and the ornament's
  notes within its span are no extra notes.
- The Expression panel gains an **Ornaments** tab: each ornament and grace note on the notes you
  played, played, played in part or left out, the bars to look at and a table. Options can turn it
  off. A note with an ornament is no longer judged for how long it was held. As in the Pedal
  tab, those left out or played in part come first, and the ones played fold into one line when
  there are more than three.
- With **Show keys**, the keyboard marks an ornament's notes with a lighter, dashed outline.
- On a phone the Expression panel's tabs stay in one row that scrolls sideways.
- A piece with a trill has **Trills start on** in Options: on the note, or on the note above as in
  Baroque music, for the demo, the other hand and rhythm mode.
- Records made before stay as they are: there, an ornament's notes counted as wrong or extra.

### The pedal (X3, [docs/EXPRESSION.md](docs/EXPRESSION.md))

- The Expression panel gains a **Pedal** tab: the sustain pedal as you played it, drawn under the
  bar numbers from how far it was down (a half pedal shows, and counts as up), with the score's
  pedal marks above as the edition draws them.
- Each mark is judged in words. At a change the pedal should come up after the new note, within
  250 ms, and go down again within 400 ms: coming up before the note leaves a **gap** in the sound
  (unless your hand holds the notes over), coming up too late or not at all **blurs** the old
  harmony into the new, both measured in ms; a pedal never put down is **missed**. A lift inside
  a marked span that breaks the sound is a gap there. Una corda and the sostenuto pedal are drawn
  when you use them and checked against their words.
- The figures (marks clean, gaps, blurs, the share of the run with the pedal down), the three bars
  to look at, each loopable, and a table; also for a past run in Your runs. Without marks the line
  is drawn and nothing is judged; a run without the pedal says so.
- Options can turn the judging of the pedal off, in this browser.
- In the Pedal tab, and among the Dynamics tab's markings, the marks to look at come first; when
  more than three were played right, they fold into one line that opens to list them.
- The lesson on the pedals takes its change window from the Pieces.

### Technique II (S7)

- The rest of the **Technique** group, from Hanon's The Virtuoso Pianist as printed: the
  **diminished and dominant sevenths** in arpeggios (Nos. 42 and 43, a section on each of seven
  roots), **repeated notes** (Nos. 44 and 47, and No. 45 in each of its six fingerings), the
  **trill** (No. 46's first six bars), **thirds** (No. 50's scale in legato thirds and its
  chromatic scale in minor thirds) and **octaves** (No. 51's preparatory lines, and No. 53's scales
  in octaves in the 24 keys, with his footnote's fourth finger on the black keys). Each was
  transcribed twice independently from the scan and diffed, and the drawn scores compared with the
  plates; one digit both readings took for a 4 is a 1 on a staff line, and No. 50's chromatic scale
  takes the three naturals its plate leaves out and ends on its printed rest.
- A **trill on any pair of fingers** (1–2 to 4–5, and 1–3, 2–4, 3–5) in any major key, for 4, 8 or
  16 bars, either hand or both with the mirror fingers. After a trill: its rate in notes a second,
  and over time on a small chart; whether it slowed or hurried; and whether the two fingers were
  even, or which key the next note comes late after.
- After repeated notes: how long each key was up before it was struck again, typically and at the
  shortest, and before which note.
- Thirds and octaves are measured as chords: how far apart each one's keys came, the top key's
  balance, and the legato of each voice.

### Technique I (S6)

- **Technique** on the Scales page, a second group in the list of exercises: the **five-finger
  pattern** in every major and minor key (1 2 3 4 5 4 3 2 four times over, then the tonic, the
  finger the degree); **Hanon's first twenty exercises** exactly as printed in The Virtuoso Pianist
  (G. Schirmer 1900), notes, bars and fingering, chosen by number; and the key's triad in **block
  chords** and **broken chords**, root position and both inversions, up two or three octaves and back
  (broken, one or two).
  Each keeps its own records and progress, plays with the click and loops like the scales.
- Hanon Nos. 1–20 were transcribed twice independently from the scan and diffed; the drawn scores
  were compared with the plates bar by bar. His fingering is shown as he prints it: in full in the
  first bars, then only the fingers each exercise trains, and no digit elsewhere.
- **Chords, measured**: each chord's **spread** (how far apart its keys came; beyond 30 ms it is
  heard as broken) and the **balance** of its top key against the others, relative to the run's
  own range of loudness; the chords' timing as the scales' notes are, their connection voice by
  voice, the hands against each other. A chord with a wrong key is one mistake. The chart gains a
  row for each, and scrolls sideways for long runs.
- In a pattern (Hanon, broken chords, the five-finger group) the place named after a run is the
  same note of every group ("note 4 of each group comes 25 ms late"), found by the same rules as
  the scales' crossings with a stricter threshold, simulated.
- The public profile counts the technique exercises instead of naming them, as it does the
  arpeggios: the service names only the scales. Sync schema 9: a build that learns these exercises
  pulls everything again.

### Harmony: chords from their symbols (H1)

- A new **Harmony** page. Its first practice, **Chords**, shows a chord symbol as a lead sheet
  prints it (`Am`, `G7`, `F/A`, `B°`, `Csus4`, `Cmaj7`, `Dm7♭5`), set large with its extension
  raised; play its notes on your keyboard, in any octave, voicing or inversion, a slash chord's bass
  lowest ([docs/HARMONY.md](docs/HARMONY.md)).
- Five levels: the triads of C, G and F major; major and minor triads on all twelve roots; `7`,
  `maj7` and `m7`; slash chords (inversions such as `C/E` and bass notes such as `Am/G`); and `°`,
  `+`, `sus2`, `sus4`, `m7♭5`, `°7`, `6`, `m6` and `add9`. Symbols are spelled as lead sheets spell
  them (`B♭`, not `A♯`; `F♯m`, not `G♭m`) and written one way everywhere (`maj7`, `°`, `m7♭5`).
- Read's rules: the clock starts when the symbol is on screen, the first answer counts, and the
  card stays until you play it right; a wrong answer names what you played and the chord note by
  note, and marks it on the keyboard. **Show the notes** names the chord's notes and marks them
  lightly. Sessions of 10, 20 or 50 cards, a suggested level and mastery (90 % over 40 cards, a
  median under 3 s), and a summary with the slowest and missed cards.
- The answers and sessions are kept, exported and synced like the other cards, count as reading
  on a public profile, and Progress has a section for **Chord symbols** with its weakest symbols
  and what you play instead ("Dm7 played as D7"). The lesson on chords now practises here.
- With a mouse or a finger, a click or a tap on the screen's keyboard holds a key down until it is
  clicked again, so a chord can be built one key at a time.
- Progress heads the chords of Ear and of Read's cards in the same style, without their root:
  maj, m, °, +, 7, maj7, m7, m7♭5 (before: M, M7, ø7).

### Rhythm on Read (R1, [docs/READING.md](docs/READING.md))

- **Read** gains a second row of what to read, what is read in time: **Rhythm**. A line of rhythm
  on a one-line staff, drawn from generated MusicXML; press Start, hear a bar of clicks, then tap
  each note on any key (a MIDI keyboard's, the pad under the line, or any letter or the space bar)
  while the click goes on, or with **Count-in only** keeping the beat yourself.
- Ten levels: quarters, halves and wholes; eighths; dotted notes; ties within the bar and over the
  barline; sixteenths and the dotted eighth; triplets; syncopation, some lines starting off the
  beat; 6/8; then two hands, one line each (the right hand from middle C up, the left below it):
  the left keeping the beat, then two rhythms at once and two against three. Each exercise is four
  bars (two at first with two hands) and a final note on the next downbeat; the next cells favour
  the ones you miss or play unevenly, never the same one three times in a row.
- Timing is rhythm mode's: the same count-in, click, matching windows and latency calibration
  (Calibrate is on the setup and the session). After a run every note is inked in time, early or
  late (with the arrow and the ms) or missed, extra taps are marked, and you see the cells right,
  the median distance from the beat and whether you rush or drag; **Again** or **Next**. The counts
  can be shown under the line, as the lessons write them ("1 (2) & 3", "1 e & a", "1 trip let"),
  the count heard lit as it goes.
- The tempo (40–160, 72 to start, 60 with sixteenths) is kept for each level, sessions are 4, 8
  or 16 exercises, and a level is mastered at 90% of its last 40 cells right.
- Every cell of every run played to its end is an answer in the answers store; sessions of kind
  `rhythm` join the log, the minutes and the streak (the public profile counts them as reading)
  and are rebuilt from their answers after a closed tab. Imports and sync check and judge every
  answer again. `SYNC_SCHEMA` 7; the export file needs no new version. The header's metronome
  pauses while a run is timed.

### Progress by family: what you answer instead (E4)

- **Progress** gains a part for ear training and the theory cards: a section for each kind of
  question you have answered (intervals, chords and melodies by ear; intervals, key signatures and
  chords on the staff), each folding under its heading: the one you practised last opens, and a
  section you open or fold stays so in this browser ([docs/EAR.md](docs/EAR.md)).
- Each shows its levels in one row (mastered, or the accuracy and how full the window is), the
  three weakest items with their figures over the last 10 answers (correct, median time, replays
  or hints), and every item in a table.
- **What you answer instead**: a grid of what was asked against what was answered, the count in
  each cell, the right answers on the diagonal in green and every wrong one coloured by its share
  of the row on the note heatmap's scale; rows with fewer than 5 answers are marked as not enough
  data yet. A key played is read as the interval or chord it makes, a melody by the interval into
  its first wrong note, a key signature by the key whose tonic you played. "Show as a table" lists
  the most frequent confusions in words ("minor 6th · perfect 5th · 4 of 12").
- A level and, where you answered both ways, played or named can be chosen. On a phone the grid
  scrolls within its box. Nothing new is stored: it is all worked out from the answers you have.

### Theory on Read: intervals, key signatures and chords on the staff (E3)

- **Read** asks what to read: **Notes** as before, or three new kinds of card, each with its own
  levels, suggested level and mastery ([docs/EAR.md](docs/EAR.md)).
- **Intervals**: two notes on one staff, one after the other or stacked, up or down; name the
  interval with two rows of buttons, its quality and its number, or with the keys (d m P M A and
  2–8). Four levels, from the number alone on natural notes to every quality with double sharps,
  double flats and two ledger lines. Spelling counts: C–D♯ is an augmented 2nd, C–E♭ a minor 3rd.
- **Key signatures**: a key signature alone on the grand staff; play the tonic, in any octave.
  Five levels, from majors with two sharps or flats to all fifteen minor keys (C♯ and C♭ majors
  and their relative minors included).
- **Chords**: a close-position chord on the treble or bass staff, from the triads of C major to
  inversions and the four seventh chords; **play it** exactly as written, octave included, or
  **name it** by its root as written, its sign and the chord.
- As on Read: the clock starts when the card is drawn, a right answer moves on after 400 ms and a
  wrong one shows the answer (on the keyboard, the buttons and in words) until it is given; the
  next card favours what you miss or answer slowly, and a level is mastered at 90% over its last
  40 cards without the hint, with a median under 3 s (4 s for chords). "Show letter names" names
  each note under it, or a key signature's sharps or flats.
- While a card is named, the computer keyboard plays no notes, so its letters choose names.
- Every answer is kept in the answers store, with the notes as written; theory sessions join the
  log, the minutes and the streak (the public profile counts them as reading), and a session left
  open is rebuilt from its answers. Sync learns them (`SYNC_SCHEMA` 6): a device that updates
  pulls everything again once. The export file needs no new version for them.

### Articulation (X2, [docs/EXPRESSION.md](docs/EXPRESSION.md))

- The Expression panel gains an **Articulation** tab: how long you held each note against what
  the score asks. Under a slur each note should be let go as the next one begins (a gap is
  "broken", holding on too long "smudged"); a staccato note at most half its length (a
  staccatissimo a third), a tenuto at least nine tenths, and an unmarked note at least seven tenths,
  unless a rest or the end of a slur lets it breathe. Lengths are taken at the run's tempo in
  rhythm mode and as you went in wait mode. A note let go under the sustain pedal is not judged,
  since the pedal hides its release.
- Per bar, the share of notes held as written, drawn under the bar numbers with the slurs,
  staccatos and tenutos above; what went wrong, the three bars to look at (each loopable) and a
  table. It needs no velocity, so it works with the computer keyboard too.
- Options can turn the judging of dynamics or of articulation off, in this browser.
- The lesson on touch and the Pieces now share their legato thresholds.

### Dynamics and balance (X1, [docs/EXPRESSION.md](docs/EXPRESSION.md))

- **Expression** after every run of a piece, in wait and rhythm mode: the Dynamics tab draws how
  loud each hand played, beat by beat, under the bar numbers with the score's dynamics and
  hairpins above, and says of every marking in words whether it was played right, too little, too
  much, the wrong way round or missed: each change of level (p to f), each crescendo and
  diminuendo, each accent and sf. Loudness is judged against your own range in the run, never an
  absolute velocity, since keyboards differ; the computer keyboard and the on-screen keys measure
  none, and the panel says so.
- **Balance**: where both hands play together, whether the melody sounds over the accompaniment,
  per bar. The melody is the top note of the right hand, or of the left hand or of both, a choice
  kept per piece.
- **Bars to look at**: the three places where the dynamics went furthest astray, each with a
  button to loop them, and a table view of every marking and bar.
- **Your runs** (under Options on a piece): the piece's past runs, each with its Expression panel,
  computed from its take when you open it.
- The thresholds are provisional until runs recorded on real instruments set them; a development
  build can save a run's take for that.

### The score's markings, and takes (X0, [docs/EXPRESSION.md](docs/EXPRESSION.md))

- Pieces now keep what the score marks besides the notes: dynamics and hairpins (and _cresc._ or
  _dim._ written out), slurs, staccato, tenuto and accents, fermatas, the pedal marks (sustain,
  sostenuto, _una corda_ and _tre corde_), ornaments and grace notes, by staff. Nothing is judged
  on them yet; they are what the expression figures to come compare a run with. The notes, and so
  every piece's records, are unchanged.
- **Listen and the other hand play the ornaments**: an acciaccatura just before the beat, an
  appoggiatura on it, mordents, turns and trills in thirty-seconds, each with the neighbouring
  notes of the key and the bar (or the accidental printed with the ornament). In wait mode a grace
  note of the other hand sounds once you complete the step. Grace notes are still no step to play:
  accepting ornaments when you play them is X4, above.
- The import report no longer says that grace notes and ornaments are left out.
- **The library's markings**: the Musette, Für Elise, La Candeur, Old French Song, Morning Prayer,
  Chopin's Prelude in C minor and the Gymnopédie No. 1 now show the dynamics, hairpins, slurs,
  staccatos and accents, fermatas and pedal marks of the editions their notes come from, read
  from the same Mutopia files and checked against them; nothing the editions do not print. The
  notes are unchanged, so your records of them stay valid.
- **Takes**: every run of a piece, in wait and rhythm mode, now keeps what you played as you
  played it: each key with how hard it was struck and when it was let go, and the pedals as the
  keyboard reports them (sustain, sostenuto and una corda, half-pedalling included), each key
  matched to the note of the score it played or marked as a wrong or extra note. It is what the
  expression figures and "Play back your run" will be computed from. Takes are stored in chunks as
  the run goes (IndexedDB version 7, a `takes` store read only when needed), sync with an account,
  and are in the export; deleting a piece with its practice records deletes its takes too.

### Arpeggios and contrary motion (S5)

- A public profile with arpeggios among the day's scales is published again: the service names
  only the scales it knows, so arpeggios are counted with the day's other scales instead of named.
- **Arpeggios**: the major and minor triad in root position in every key, one to four octaves,
  either hand or both, drawn three notes to the beat with **Hanon's fingering** from The Virtuoso
  Pianist, No. 41 (G. Schirmer 1900), transcribed twice independently and checked digit by digit:
  no difference between the two readings. The digits he left unprinted are filled by rules his
  printed ones follow, each marked in the transcription.
- **Contrary motion** for the majors, the harmonic minors and the chromatic scales, one to three
  octaves: both hands start on one tonic near middle C, the right hand going up while the left
  goes down, each hand fingered as it plays that way in parallel motion. The shared key at the
  start and the end is struck once for both hands, and the analysis, the hands-apart figure, the
  cursor and the loops know it; the left hand's figures follow its own direction, and its chart
  marks its turn at the bottom. Contrary motion keeps its own records and progress.

### Scales with the click, and focus loops (S4)

- **With the click**: beside free tempo, a scale can be played with the click at ♩ = 40–160, two,
  three or four notes to the beat (drawn as eighths, triplets or sixteenths). Start gives one bar
  of count-in, and the click sounds with the metronome's own sound and volume while the metronome
  pauses. It is rhythm mode's plan, matcher and latency calibration, unchanged.
- After a clicked run, the evenness figures as before (the run against its own line) and, beside
  them, the run against the click: whether you came early or late on average and how many notes
  fell within ±50 ms. Both are recomputed from the run's raw keys and the grid it keeps.
- **Focus loops**: the weakest place of a run, any place named over your last runs and any note of
  the per-note table can be looped: three notes either side, drawn between repeat signs, the
  cursor waiting for each key, round and round until you go back to the scale. A drill: nothing is
  timed or recorded.

### Ear training: intervals, chords and melodies by ear ([docs/EAR.md](docs/EAR.md))

- A new **Ear** page plays two notes or a chord through your instrument or the built-in piano, and
  you answer the way a pianist does: **play it** back on the keyboard (the first note, or the
  chord's root, is marked; any voicing and octave of a chord counts, with the right bass in the
  inversion level), or **name it** with buttons and the number keys.
- Twelve levels: seven of intervals, from the octave, fifth and major third to the tritone and
  compound intervals, played up, down, together or mixed; five of chords, from major and minor
  triads to inversions and the four seventh chords, played broken then block, or block.
- Keys count from the prompt's last note-on, so the prompt is never the answer; "Hear again"
  (Space) replays it, and replays are counted but left out of the times. A wrong answer is marked
  on the keyboard, drawn on the staff and played once, until Next (Enter) or any key.
- The next question favours the items you miss or answer slowly, as the note model does on Read. A
  level is mastered at 90% over its last 40 answers without a replay; the first one not mastered
  is suggested. The summary lists what was missed and what was answered instead.
- Every answer is kept (IndexedDB version 6, an `answers` store), and ear sessions join the log,
  the minutes and the streak (the public profile counts them as reading). Answers sync with an
  account; a device whose update learns a new kind of record pulls everything again once, so
  nothing another device sent before the update is missed.
- **Echo**, a third family: the chord of a key, a quarter's rest, then a short melody at ♩ = 100,
  to play back on the keyboard note by note from its first note, which is marked. Seven levels,
  each a kind of melody drawn fresh every time: three notes by step, steps and thirds, up to the
  octave, leaps to the fifth and the octave in keys up to two sharps or flats, any leap within the
  octave, A, E and D minor (natural and harmonic), and chromatic neighbour and passing notes.
- Dots fill as the notes are played; keys played before "Hear again" stand. The first wrong key
  ends the melody: it is drawn on the staff that suits it, in its key signature, with the notes
  you played right in green and the wrong one in red at its pitch, and played once more. The
  summary names each miss by the interval into it ("Note 3: perfect 4th up (F4), played as
  perfect 5th up (G4)"). A level is mastered at 90% over its last 20 melodies without a replay;
  a session is 5, 10 or 20 melodies.
- Sync learns the new family (`SYNC_SCHEMA` 3): a device that updates pulls everything again
  once, so the melodies an older build skipped arrive.

### Seven more pieces

- The built-in library grows from six pieces to thirteen, and grade 4 is no longer empty: the
  Minuet in G minor (Petzold, grade 1), the Musette in D major (from Anna Magdalena Bach's
  notebook), Burgmüller's La Candeur and Tchaikovsky's Old French Song (grade 2), Tchaikovsky's
  Morning Prayer (grade 3), Chopin's Prelude in C minor, Op. 28 No. 20, and Satie's Gymnopédie
  No. 1 (grade 4). Each is our own encoding of a public-domain Mutopia edition, checked note for
  note against its MIDI file, with no fingering.
- Where two voices of one hand share a key at the same moment (one notehead with two stems), the
  proofreading script counts one key press, as the app always has.

### The basics: lessons for beginners ([docs/LEARN.md](docs/LEARN.md))

- **Learn** has fifteen short lessons for your first weeks at the piano, in English and
  Simplified Chinese: finding your way around the keyboard; the staff and the clefs; landmark
  notes and intervals; rhythm and the beat; sharps, flats, whole and half steps; the major scale
  and key signatures; posture, hand shape and fingering; dots, ties, triplets and syncopation;
  minor scales and minor keys; loud and soft, joined and detached; the pedals; ornaments;
  chords and harmony; practising well; and styles and forms.
- The second rhythm lesson reads the rhythms of most beginners' pieces: the dotted quarter and its
  eighth, ties over the beat and the barline, sixteenths and the dotted eighth, triplets against
  straight eighths, syncopation, and 6/8 set beside 3/4. Every rhythm is engraved with its beams,
  ties and triplet brackets, counted under the notes ("1 (2) & 3", "1 e & a", "1 trip let"), and
  played with the click; then you tap seven bars in time, 6/8 included.
- The minor keys lesson plays a tune in major and then in minor, and the major and minor third
  and chord; finds each major key's relative minor, with the same notes and key signature; builds
  the natural, harmonic and melodic minor from any key, the steps and the raised notes marked;
  lets you hear the leading note pull into the tonic; and shows how to tell a piece in A minor
  from one in C major. You then play the relative minor from its signature and A harmonic minor
  with its fingering, and tell the three minors and the keys of a few phrases apart.
- The lesson on touch reads the dynamics from pp to ff and plays one phrase at each; draws
  crescendo and diminuendo as hairpins and as words, accents and sf, all engraved; plays the Ode
  to Joy with its tune over its chords, level with them and under them; and shows legato and its
  slurs, the breath at a slur's end, non legato, staccato and tenuto. With a MIDI keyboard it
  shows how hard you struck each key, and a timeline under the line shows every note you play,
  how long you held it and whether it joined the next, left a gap or overlapped it. It ends with
  five notes to play louder and louder (skippable without a keyboard that senses touch) and nine
  questions on the marks.
- The pedals lesson explains the sustain, soft and sostenuto pedals (and an upright's), how to
  press them, and the pedal marks, Ped. and its star or a line with a notch at each change, all
  engraved; plays four chords without the pedal, with it held through and with it changed; and
  shows legato pedalling on a timeline of keys, pedal and sound, from your MIDI keyboard and its
  pedal or from a demo changed in time, too early or too late, with each gap or blur marked. It
  ends with four chords to pedal, each change timed (skippable without a pedal), and nine
  questions.
- The ornaments lesson engraves the acciaccatura and the appoggiatura, the mordent and the
  inverted mordent (bar 5 of the Minuet in G), the turn and the trill, from the note above or
  from the note itself and with its written ending, each over the notes it stands for, written
  out and beamed, and plays both slowly and at tempo; then a spread chord and a fermata, with the
  sign and without. It ends with ten ornaments to name, and a mordent and a turn to play written
  out.
- The lesson on chords builds a triad on any root, major, minor, diminished or augmented, written
  one note after another and then stacked, and heard broken and together; turns it upside down to
  its first and second inversions; engraves the seven chords of a major key under their symbols and
  over their roman numerals, the primary chords I, IV and V among them; builds the four seventh
  chords and shows why V7 pulls home, B rising to C as F falls to E; plays a phrase ending with each
  cadence, authentic, plagal, half and deceptive; reads chord symbols and their other spellings
  (Δ, –, ø, sus, a slash for the bass); and folds the first bars of Bach's Prelude in C into their
  chords. You then play triads and chord symbols on the keyboard, the notes together or one at a
  time, and name eight cadences by ear.
- The lesson on practising explains slow practice, with the Ode to Joy on a ladder of tempos up to
  the one you aim for (as the Metronome's tempo trainer climbs it); small chunks and loops, and the
  Pieces' weak bars; hands separately, then together; when to stop and fix and when to play
  through; starting with the hardest bar; short, daily practice, with a session of any length
  split into its parts; learning a piece by heart in several ways at once, with a plan; playing for
  others, recording yourself and going on after a slip; playing without strain; and what an app
  cannot hear, which a teacher can. Nine questions on its ideas finish it.
- The lesson on styles and forms sets the Baroque, Classical, Romantic, and Impressionism and after
  on a line of years with the lives of the library's composers, and says how each sounds and how
  to play it, with a passage of a library piece from each played from its own file: the Minuet in
  G, Für Elise, the Old French Song and the Gymnopédie. It explains phrases and periods, binary,
  ternary and rondo form, theme and variations, the prelude, the étude and the character piece,
  and sonata form in two sentences, and draws four pieces as rows of their sections, repeats and
  all, each section heard alone or the whole in turn. Six passages to place in their period and
  four forms to name finish it. Every piece in the library now names its period and form beside
  its note, in every language.
- Every figure is the app's own keyboard or an engraved staff: colour the black-key groups, point
  at a line to hear its note, hold keys to see where they are written, build a major scale from
  any key, tap along with a beat and see how early or late you are. Each lesson ends with
  exercises answered on your keyboard: find every C, name an interval, play a scale with its
  fingering, tap a rhythm in time. Etched illustrations show how to sit, the hand's shape and the
  finger numbers.

### Inside the piano

- A page beside the lessons shows one key of a grand piano's action in cross-section, moving as
  you play: the key, the wippen, the jack that throws the hammer and lets it go, the hammer's
  flight to the string and back, the backcheck, the repetition lever, the damper, the string
  ringing. Any key, on your keyboard or on the page, drives it at the speed you pressed, four or
  ten times slower if you like; the steps light up as they happen, and pointing at a part says
  what it does. The sustain pedal lifts the damper. With a short quiz, in English and Simplified
  Chinese.

### A home page, and a sharper look

- The app starts with about a third less to download: Progress, Settings and About load when
  opened, the rules that check imported and synced records load only when a file is imported or a
  sync brings something, Hanon's fingering and exercises only with the Scales page, and React sits
  in a file of its own that stays cached between releases.
- ♭, ♮ and ♯ in the text are set in a small font of their own (five glyphs of Bravura Text), so
  they sit close to their letter in every language (B♭4, not B ♭4).
- The About page credits all thirteen built-in pieces.
- dacapo opens on a **home page**: what it is, the way into each practice as a contents page, and
  a grand staff with a keyboard under it that shows any key you hold on the staff. **Play** moves
  to its own address, `#/play`; old links to `#/` now open the home page.
- The header stays at the top while the page scrolls, and the pages use the width of a large
  screen: Read puts the session beside the levels, and Settings sets each section's title in the
  margin. The web app has a footer with the licences, the source and the privacy policy.
- The window title names the page you are on.
- For search engines: a description of every practice, structured data, a sitemap and
  `robots.txt`.

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
- The public profile names everything practised, once the service says it can (profile version
  2): theory cards, rhythm lines, ear training and harmony each have their own line instead of
  counting as reading, and the arpeggios and every technique exercise are listed by name instead
  of counted. Until then, and with an older service, the profile is published as before. The page
  shows a kind or an exercise it does not know yet as "Other practice" or "Exercise on C", so a
  new one never stops the profile from publishing.
- Storage moves to IndexedDB version 5 (an outbox of records to send, used only while signed in).
- A device whose older version kept a synced record without a field it did not know yet (the
  click of a scale run) takes the full record back after the update, and never sends the shorter
  copy over it.
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

# The basics (Learn)

Short lessons for someone who has never read music, at `#/learn`. Each lesson teaches one thing
with prose, figures to play with and an exercise at the end. They are part of the app, so every
figure uses the app's own keyboard: it sounds on the built-in piano and answers to a MIDI keyboard,
the computer keyboard, a click or a tap, like the Play page.

## Lessons

| #   | Slug               | Lesson                               | State   |
| --- | ------------------ | ------------------------------------ | ------- |
| 1   | `keyboard`         | Finding your way around the keyboard | written |
| 2   | `staff`            | The staff and the clefs              | written |
| 3   | `landmarks`        | Landmark notes and intervals         | written |
| 4   | `rhythm`           | Rhythm and the beat                  | written |
| 5   | `sharps-and-flats` | Sharps, flats, whole and half steps  | written |
| 6   | `major-scale`      | The major scale and key signatures   | written |
| 7   | `posture`          | Posture, hand shape and fingering    | written |
| 8   | `rhythm-2`         | Dots, ties, triplets and syncopation | written |
| 9   | `minor-keys`       | Minor scales and minor keys          | written |
| 10  | `dynamics`         | Loud and soft, joined and detached   | written |
| 11  | `pedals`           | The pedals                           | written |
| 12  | `ornaments`        | Ornaments                            | written |
| 13  | `chords`           | Chords and harmony                   | written |
| 14  | `practising`       | Practising well                      | written |
| 15  | `styles`           | Styles and forms                     | written |

Beside them, not numbered: **Inside the piano** (`inside`), one key of a grand piano's action in
cross-section, moving as you play. Its motion comes from `src/core/pianoAction.ts`: the key, the
jack that lets the hammer go at let-off, the hammer's free flight and rebound, the backcheck, the
repetition lever, the damper and the string, stepped a half-millisecond at a time and drawn by
`PianoActionDrawing.tsx`, each part turning about its own pivot. Every key pressed anywhere drives
it, at the speed pressed, slowed down four or ten times if asked; a slowed-down tap is kept down
long enough to play out.

The list, with titles, summaries, reading times and where to practise, is `src/learn/lessons.ts`
(`LESSONS`, and `EXTRAS` for pages like this).
A planned lesson is listed as "In preparation" and cannot be opened.

## Languages

Lessons are written in English, Simplified Chinese and Traditional Chinese as written in Taiwan:
`src/ui/learn/lessons/<slug>.en.tsx`, `<slug>.zh-CN.tsx` and `<slug>.zh-TW.tsx`, loaded when
opened (`lessons/index.ts`). zh-CN and zh-TW each read their own Chinese; Japanese and Korean
read the English, with a line saying so in their own language. A lesson's title and summary
(`src/learn/lessons.ts`) are in the same three languages, wherever they are shown: the Learn
page, a lesson's page and its pager, today's plan, Where you are, the line on a practice's page,
an assignment's lesson task and the week's recap. The page around a lesson (titles of the page,
contents, next and previous) is in the app's dictionaries like any other text; the words inside
figures (Start, "3 of 8", "That was E4") follow the lesson's language (`LESSON_WORDS` in
`src/ui/learn/lesson.ts`; Taiwan's are in `lessonWords.zh-TW.ts`).

The three versions say the same things with the same figures and exercises, in the same order.
The Chinese is written, not translated: mnemonics that only work in English ("Every Good Boy Does
Fine") are replaced by what works in Chinese. The Traditional Chinese is written from the
Simplified one, in Taiwan's terms and usage, not converted from it character by character: the
terms are those of the zh-TW dictionary and of [TRANSLATING.md](TRANSLATING.md)'s glossary (小節,
升記號, 連結線, 漣音, 斷奏 and 持音, 平台鋼琴, 樂曲 for the Pieces page, 古典樂派, 二段式), the
pieces are named as the library names them, in 〈〉, the beat is counted "1 and 2 and", and
sentences that read as mainland Chinese are said as Taiwan says them. The code around the text is
the same in both Chinese versions (the same components, props, ids and order). It awaits native
review, like the zh-TW strings; the names of the parts of the action (Inside the piano) most of
all.

## Writing a lesson

- Sections (`Section`, with an `id`) make the contents beside the lesson on a wide screen.
- Figures go on numbered plates (`Plate`, `wide` for a full keyboard), with a caption that says
  what to do with them.
- `Aside` holds a rhyme, a tip or a warning; `Picture` an illustration.
- Figures: `keyboardFigures.tsx` (the keyboard), `staffFigures.tsx` (the staff and clefs),
  `theoryFigures.tsx` (landmarks, intervals, steps and accidentals, scales and key signatures,
  fingers, and for lesson 9 the minor: a tune in major and minor, the relative minor, a builder
  for the natural, harmonic and melodic minor from any key, the leading note, and phrases whose
  key is told by their end and their raised 7th) and `rhythmFigures.tsx` (the beat, rhythms on a line, time signatures, 3/4 against
  6/8). A rhythm line beams by the beat (in threes in 6/8), draws ties, sixteenths and triplets
  with their bracket, and counts each beat as finely as its notes need ("1 e & a", "1 trip let");
  lesson 8 puts the counts not played on in brackets, "1 (2) & 3". Its time is in ticks, twelve
  to a quarter note, so triplets and sixteenths fall exactly, and in 6/8 the click also sounds
  the eighths, more quietly than the beats. Exercises share
  one frame (`exercises.tsx`): a key quiz (a figure to answer from, such as a key signature, and a
  note asked for in any octave, when it needs them), a line of keys to play in order, multiple
  choice, and in the rhythm lesson a bar to tap in time, judged against the click. Scales are
  spelled by `core/scales.ts`, as on the Scales page; a minor whose harmonic form needs a double
  sharp (G♯) is left out of the figures. Staves are drawn by
  `ui/engraving/EngravedStaff.tsx` from Bravura's outlines (notes of every value, rests, key and
  time signatures), so no music font is loaded; `ui/engraving/marks.tsx` draws what is written
  around the notes (dynamics in Bravura's letters, hairpins and the words for them, accents,
  staccato dots and tenuto lines, slurs, and the pedal as Ped. and its star or as a line with a
  notch at each change).
- `expressionFigures.tsx` has lesson 10's: a phrase at any dynamic from pp to ff, a swell as
  hairpins or words, accents and sf, the Ode to Joy's tune over its chords (balanced or not),
  the velocity of each key struck, and a line played legato, non legato, staccato or tenuto with
  a timeline under it of every note heard, yours or the figure's: how long each was held, and
  whether it joined the next, left a gap or overlapped it, by the thresholds EXPRESSION.md plans
  for the Pieces (`expression.ts`). A figure plays its notes with their own times, lengths and
  loudness (`usePlayNotes`); the built-in piano sounds them at that velocity.
- `pedalFigures.tsx` has lesson 11's: four chords on the grand staff with the pedal marked both
  ways, heard without it, held through and changed with each chord; and a timeline of keys,
  pedal and sound (a key rings on while the pedal is down) that follows your keyboard and its
  sustain pedal, or plays a demo of the pedal changed in time, too early or too late, and marks
  each change's gap or blur. The figures never press the app's pedal: a demo holds its keys as
  long as the pedal would, so the player's own pedal and Inside the piano's are left alone. The
  exercise's four chords are judged by X3's numbers (`judgePedalChanges`): up within 250 ms after
  each new chord, down again within 400 ms. Timelines are drawn a unit to a pixel at the width
  they are given, so they stay legible on a phone.
- `ornamentFigures.tsx` has lesson 12's: each ornament engraved as written (grace notes small,
  slashed or not; the mordent, the inverted mordent, the turn, tr with its wavy line and its
  ending; a spread chord's wavy line; the fermata, all from Bravura's outlines) over the notes it
  stands for, written out in sixteenths (a crushed note as a 32nd) and beamed, both lit as they
  play, slowly or at tempo. The examples are in the style of the library's minuets; the mordent
  is bar 5 of the Minuet in G. The line (`OrnamentStaff`) beams any group of eighths, sixteenths
  and 32nds, one way by the group's average, lengthening the stems to the beam.
- `harmonyFigures.tsx` has lesson 13's: a chord built in thirds on any root (C, D, E, F, G, A or
  B♭, whose every triad and seventh chord is spelled without a double sharp or flat), written one
  note after another and then stacked, heard broken and together, in root position or either
  inversion; the seven triads of a major key after its signature, each under its symbol and over
  its roman numeral; chords on the grand staff (a phrase ending with each cadence, V and V7 going
  to I, and the first four bars of Bach's Prelude in C folded into chords and heard as written);
  and the exercise that asks for a chord (`ChordQuiz`). It judges as the Ear page does
  (`judgeChordKeys`), by pitch classes in any voicing and octave, with the bass lowest for a slash
  chord, but on every key pressed since the question began rather than the keys held, so a chord
  can be clicked a note at a time; keys still arriving from a judged chord (250 ms) are not the
  next answer. `harmony.ts` spells, inverts, names and judges the chords. The staff staggers the
  accidentals of a chord (a sixth or closer goes a column further left) and sets the upper note of
  a second beside the lower.
- `practiceFigures.tsx` has lesson 14's, which is mostly prose: the start of the Ode to Joy on a
  ladder of tempos, 60, 70, 80 and 90 per cent of the one you aim for and then that one, as the
  Metronome's tempo trainer climbs it; and a practice session of 10 to 45 minutes split into warm-up,
  hard spots, something new, a play-through and something for fun, in whole minutes that add up
  (`practice.ts`). Its picture is the posture etching of lesson 7; what it says of the app points
  to what exists (the Pieces' loop, weak bars, hands, tempo and modes; the Metronome's tempo
  trainer and silent bars; the Progress page's streak and daily goal), and recording yourself is
  done on a phone.
- `styleFigures.tsx` has lesson 15's: the periods on a line of years (Baroque, Classical,
  Romantic, and Impressionism and after) over the lives of the library's composers, drawn a unit to
  a pixel; a passage of a library piece (`Excerpt`), read from its own MusicXML when the figure first
  needs it and played both hands, repeats unrolled, at a tempo of the lesson's choosing, since four
  of the files give none and the Pieces' 90 is too fast for the Gymnopédie; and a piece's form as a
  row of its sections in the order they are played (`formSegments` in `styles.ts`), each as long as
  its bars, any one heard alone or all in turn with the one sounding lit: the Ode to Joy (a a′ b
  a′), the Minuet in G (two halves, each repeated), the Old French Song (a a b a) and Für Elise's A
  section (‖: a :‖: b a :‖). The exercise's excerpts sit in `ChoiceQuiz`'s figure. Every built-in
  piece names its period and form beside its note in the library (`library.<id>.style`, in every
  language).
- An exercise that needs something not everyone has (a keyboard that senses touch, a sustain
  pedal) says so when no MIDI keyboard is connected and can always be skipped; the lesson is
  finished by its last exercise, which anyone can do. Lesson 10's crescendo passes when every
  note is louder than the one before, or when the last is the loudest and at least 19 (15% of the
  range of velocities) above the first.
- The rhythm figures use the page's click track; whoever started it last owns it, so one figure
  stopping never silences another.
- Only one exercise listens at a time: starting one (or clicking a key on it) stops the others, so
  a key played for one never answers another. The last exercise marks the lesson done
  (`useCompleteLesson`), shown as a tick on the list; the tick is a record of the practice store,
  exported and synced like the rest ("The tick is a record", below).
- Nothing a lesson says may be browser-only in the Apple app, which shows the same lessons.
- A lesson is also drawn once, without scripts, as a page of the site ([SITE.md](SITE.md)): its
  text and its figures as they first appear. So a figure must draw without a browser (what it
  needs of one goes in an effect), and what only a script can answer is left out there: `Choices`
  and `PlayButton` leave themselves out, an `ExerciseFrame` becomes one line, the keyboard is a
  picture, and a control a figure draws itself (a button, a `<select>`) is wrapped in
  `useStaticPage()` (`lesson.ts`). `src/site/render.test.ts` draws every lesson and fails on any
  control left in.

## Lessons and practice, joined (G3)

Status: built. A lesson ended with **Practise it**, which opened a page and left the reader to
find the level; no practice said which lesson explains it; the Learn page did not say which
lesson comes next; and the tick stayed on one device. G3 joins them, by the table in
[TODAY.md](TODAY.md) (`core/curriculum.ts`: which lesson opens which practice).

- **Practise it goes to the thing itself.** A lesson names one or two practices (`practice` in
  `src/learn/lessons.ts` becomes a list), each opened with its settings as a task's button does
  (`ui/startParams.ts`), and labelled with what it opens ("Practise it: Read, rhythm, level 1"):

  | Lesson             | Practise it                                                                                         |
  | ------------------ | --------------------------------------------------------------------------------------------------- |
  | `keyboard`         | Play                                                                                                |
  | `staff`            | Read: notes, the level suggested                                                                    |
  | `landmarks`        | Read: notes, the level suggested · Read: intervals on the staff, the level suggested                |
  | `rhythm`           | Read: rhythm, the level suggested · the Metronome                                                   |
  | `sharps-and-flats` | Read: notes, the level with sharps and flats                                                        |
  | `major-scale`      | Scales: the next rung of the ladder (C major, one octave, right hand, at first) · key signatures    |
  | `posture`          | Scales: the five-finger pattern in C, right hand · Play                                             |
  | `rhythm-2`         | Read: rhythm, the first level with dotted notes or ties (the level suggested once that is mastered) |
  | `minor-keys`       | Scales: A harmonic minor, one octave, right hand · key signatures, the first level with minor keys  |
  | `dynamics`         | Pieces: Soldiers' March (its dynamics are judged)                                                   |
  | `pedals`           | Pieces: Für Elise (its pedal marks are judged) · Play                                               |
  | `ornaments`        | Pieces: the Minuet in G                                                                             |
  | `chords`           | Harmony: chord symbols, the level suggested · Ear: chords, the level suggested                      |
  | `practising`       | Pieces: the piece in hand, or the next piece (TODAY.md)                                             |
  | `styles`           | Pieces                                                                                              |
  | `inside`           | Play                                                                                                |

  "The level suggested" is the family's own rule at the moment the lesson is read; a link that
  names a level or a piece the build does not have falls back to the page.

- **A practice names its lesson.** The setup of each family of Read, Ear and Harmony, the Scales
  page and the library show one quiet line with the lesson that opens it ("New to this? Lesson 4,
  Rhythm and the beat"), until the lesson is ticked or the practice has a level mastered (Scales:
  five runs; Pieces: a piece played to its end): someone who knows it is not told again. In a
  language without the lessons' text the line says so as the Learn page does.
- **The next lesson.** On the Learn page the first lesson not ticked is marked **Next** and the
  page opens with a way to it ("Continue: lesson 5, Sharps and flats"); a lesson's own page offers
  **Next lesson** as before.
- **The tick is a record.** A new store `lessons` (database version 9) holds one record per lesson
  finished: its slug and when (`doneAt`, epoch ms). The ticks kept in the browser
  (`dacapo.learn.done`) are moved into it once, with no time (`doneAt` 0: before anything else),
  and the preference is then left alone. It is exported (format 10, the list `lessons`) and synced
  (the collection `lessons`, a record per slug, `SYNC_SCHEMA` 21): a tick is never taken back, so
  two copies merge as the union, the earlier time kept. An older build ignores what it does not
  know, as for every collection added since. The checklist's lesson task and Today read the store.
- **The level last chosen is kept.** Each family remembers the level picked (in the browser, with
  its other choices) and opens on it, until that level is mastered: then it opens on the level
  suggested again. A page opened with settings (a task, a lesson's button, Today) still takes
  those, and stores nothing until a choice is changed.
- **Lessons in Traditional Chinese.** `LessonLanguage` gains `zh-TW`: each lesson's text written
  from the Simplified Chinese one in Taiwan's terms and usage ([TRANSLATING.md](TRANSLATING.md)'s
  glossary; 小節 not 小节, 升記號, 音程 …), with the same figures and exercises in the same order,
  awaiting native review like the zh-TW strings. Its title and summary and the words inside its
  figures are in Traditional Chinese too, so a zh-TW reader is no longer told the lessons are in
  English ("Languages", above). Japanese and Korean go on reading the English, with the line
  that says so; the line now names the three languages the lessons are written in.

## Clarifications (decided during G3)

- **The record** is `LessonDone { slug, doneAt }` (`core/lessonRecords.ts`), in the store
  `lessons`, keyed by the slug. Database version 9 creates the store and touches nothing else.
  `doneAt` is the first time the lesson's last exercise was done: finishing a lesson again
  changes nothing. The pages beside the lessons (`inside`) are ticked the same way.
- **One rule everywhere.** Storing a tick, the move, an import and a pull all go by it: a lesson
  that is not stored is added, and a stored one gives way only to an earlier time (0 is before
  any other). So two copies merge as their union, the same whichever is merged into the other,
  and nothing takes a tick back or moves it later.
- **The move.** When the practice store starts (`load` in `ui/practice/store.ts`, beside the
  other repairs made only at startup), each slug in `dacapo.learn.done` is stored as a tick with
  `doneAt` 0, by that rule, before the stored data is shown: today's plan is never made without
  them. The preference is only ever read, never written and never removed. "Once" is by the
  rule, not by a mark that the move was made: a start that finds every slug stored writes
  nothing, and a slug the preference gains later (a tab of the earlier version, still open) is
  taken in at the next start. A lesson stored with a time that is also in the preference gets
  0: it was finished before ticks had a time. Should the write fail, the ticks are shown all the
  same, the storage notice says that saving failed, and the next start tries again. They stay on
  screen through every later read of the stored data too (a sync pull, an import, here or in
  another tab): reading again merges the preference in as the start does, and writes nothing.
  When the stored data cannot be read at all, the preference's ticks are shown with whatever
  this tab has earned.
- **An earlier version on the new database** cannot open it (9 is later than its 8): it works in
  memory and shows the storage notice, and a tab of it open while the upgrade runs is asked to
  reload. Its ticks are still in the preference, which this version leaves as it was. The
  notice that build shows is the one for a browser that does not let dacapo save ("a private
  window, or site data blocked?"), which is wrong and cannot be mended in a build already out.
- **A later version's database, from this version on.** A build that finds a database of a
  higher version than its own (the open fails with a `VersionError`) knows it for what it is:
  the notice is the one an outdated tab gets, with **Reload**, and not the private window's. The
  app runs in memory as before. Nothing of the stored database is read, written or deleted,
  nothing is queued and nothing syncs (the memory repository has no sync storage), no other tab
  is told anything, and Settings says the page is older than the data stored here (not that the
  browser refuses to store). The start page's Begin, the home page and today's plan treat the
  records as unknown rather than empty (below).
- **The offline worker's window is accepted for this release.** The worker keeps the app's
  files on the device ([OFFLINE.md](OFFLINE.md)), so a release that raises the database
  version can meet a stored page of the release before: another tab, or the app opened before
  the new worker has installed, upgrades the database, and the stored page then finds a later
  version. From this version on that page says to reload, and the reload brings the new files.
  For this release the stored page is the one before it, which shows the wrong notice (above);
  it runs in memory, loses nothing that is stored, and is replaced at the next visit.
- **The database version is a one-way door**: once a build with a higher version has shipped,
  only roll forward ([SYNC.md](SYNC.md), "Builds").
- **Not durable while the database is unavailable.** In memory mode (no storage to use, a
  database of a later version) and in an outdated tab a tick is on screen and gone with the
  tab, like every other record made there.
- **A field added to the record later needs its own schema step.** `compareLessons` has no
  tie-break beyond the time (two copies with the same `doneAt` are the same record to it), and
  `validateLesson` keeps only `slug` and `doneAt`. A build that learns another field would
  therefore neither keep it from a pull nor prefer the copy that has it: it needs a
  `SYNC_SCHEMA` step and a rule for which copy wins, as the other collections have.
- **A returning player without a jump.** The home page decides before the records are read from
  what the browser keeps: `dacapo.returning` (TODAY.md), which is now set the moment a lesson is
  ticked, the earlier version's preference, read as before, and an answer given on the start
  page ([START.md](START.md)). Whoever has only a tick never sees the first visit's page. No
  copy of the ticks is kept beside the records. The flag is removed only by records that were
  read and found empty: when they cannot be read (no storage to use, a database of a later
  version, a read that failed) what was known goes on deciding, and the flag stays as it was.
- **Begin on the start page** works out where to go when it is pressed, from the store as it
  is then: the next lesson for a newcomer. Pressed while the ticks are not known (the records
  are not read yet, the read failed, or the database is a later version's) it opens the Learn
  page, which marks the next lesson once it knows; never lesson 1 for someone with ticks. Where
  there is no storage to read (a private window) this tab holds all there is, and it opens the
  next lesson as usual.
- **Today's plan over records that cannot be seen** (a database of a later version, a read
  that failed) is made and shown, and not kept: kept, it would stand for the rest of the day
  once a reload has the records ([TODAY.md](TODAY.md)). Where there is no storage to read it is
  kept as ever. One function says which is which for the plan and for Begin (`recordsKnown` in
  `ui/practice/store.ts`).
- **Before the records are read** the Learn page shows its list at once, and each lesson's
  line (its minutes, or ✓ Done) holds its place empty until the ticks are in. The checklist,
  today's plan and Where you are wait for the ticks as they wait for the sessions, and then
  follow the store: a lesson finished in another tab, on another device or in an imported file
  ticks them without a reload. (Today's plan stays the plan it was: TODAY.md.)
- **A slug this build does not know** (a lesson a later build added) is kept when it has a
  slug's shape (lower-case letters, digits and hyphens, at most 64): stored, exported and synced
  as it came, counted and shown nowhere. Anything else is refused like any invalid record, as is
  a `doneAt` that is not a time (a number, 0 or more).
- **Export and import.** Format 10 has the list `lessons`, every tick by slug. A file of format
  1 to 9 has none and imports as before; an earlier version refuses a format 10 file as made by
  a later one, as it does any later format. The preview counts as new the ticks the import will
  write (a lesson not ticked here, or ticked here later than in the file), the rest as there
  already; importing never removes or delays a tick. A hand-made file is held to the same
  shape: a `lessons` list in a file of format 1 to 9 is not read (no count, no row, nothing
  imported); of several copies of a slug the one kept is the one the rule keeps (the earliest;
  of equal times the first), the others listed as duplicates; and a list of more than 1,000 is
  refused with the whole file, the import saying why (an export holds one per lesson).
- **Sync.** The collection `lessons`, one record per lesson under its slug, the body as stored;
  `SYNC_SCHEMA` 21, so a signed-in device pulls everything once more ([SYNC.md](SYNC.md)). The
  service needed no change: it keeps bodies as text under any collection name of 1 to 32
  letters and any id of up to 128 characters. Signing in sends every tick stored; signing out
  or deleting the account leaves them on the device, like every record.
- **Other tabs** are told of a tick as of any write, and merge it by the same rule.
- **The week's recap** ([PERSONAL.md](PERSONAL.md), "Your week") reads the ticks from the store
  (`ui/today/lessonTicks.ts`): a lesson counts for the week of its `doneAt`, wherever it was
  finished, and a tick moved without a time (0) counts for none.
- **The links are data.** A lesson's `practice` is a list of one or two plain descriptions (a
  page; a family with `suggested` or the level that has what the lesson is about; a scale by
  its exercise key, or `next`; a piece by its id, or `inHand`). `core/lessonLinks.ts` resolves
  them against where the reader stands when the lesson is read: the state today's plan is made
  from (`curriculumState`), as it is now. `practiceLinkPath` in `ui/startParams.ts` builds the
  route. Resolving takes the mastery rule of every practice, so the links are loaded apart from
  the lesson's text, as today's plan is loaded apart from the start; until the records are read
  each leads to its page.
- **The levels are found in the levels' own data**, and a test holds each to the level the table
  names: Read's first level with a note that has a sharp or a flat (L7), the first rhythm level
  that adds a cell with a dot or a tie (R3: it adds the dotted notes, R4 the ties), the first
  key-signature level in minor (KS4).
- **Which level, when.** "Key signatures" in lesson 6's row is Read's key signatures at the
  level suggested. The level with sharps and flats (lesson 5) and the first with minor keys
  (lesson 9) are named whatever is mastered: they are what the lesson is about. Only lesson 8's
  moves on, as its row says: R3 until R3 is mastered, then Read's rhythm at the level suggested.
  The level suggested of a family whose every level is mastered is its last, as on its page.
  For Read's notes it is the Read page's own, with the floor of a player's starting point
  ([START.md](START.md)): the first level not mastered from the floor on, and the last level
  once those all are; a test holds the link to `suggestedLevel` with its floor.
- **The scales.** The next rung is TODAY.md's (`nextRung`); once every rung was played the link
  leads to the Scales page. The five-finger pattern is `majorFiveFinger:C:1:right`, A harmonic
  minor `harmonicMinor:A:1:right`. A scale opens at free tempo, as today's warm-up opens it.
- **The pieces.** A piece opens as it was left, with no settings in its route, like a piece
  step of today's plan. "The piece in hand, or the next piece" are TODAY.md's: the next piece
  is proposed once Pieces is open (lesson 3 ticked, or a piece played or imported), no more
  than a grade above what was played to its end; with neither, the link leads to the library.
- **What a link says.** "Practise it: Read · Rhythm · R1": the page, the family and the level
  as the checklist names a level task; a scale by its name ("C major, 1 oct. · Right hand"), a
  piece by its title, a page by its name. With two links both say "Practise it"; the first is
  the filled button. On a phone each takes the width.
- **A practice names its lesson** with `LessonLine` (`ui/learn/`), by `lessonToRead` in
  `core/curriculum.ts`: under the introduction of Read (for what is chosen), of Ear (for the
  family shown), of Harmony's Chords and of the library, and under the picker on Scales.
  Read's notes are open from the start and Harmony's Progressions and Improvise are opened by
  no lesson: they have no line. "A level mastered" is any level of the family (a tune learnt,
  for the tunes); "five runs" are five scale runs recorded in all, of whatever exercise; "a
  piece played to its end" is a piece in review, taken out of it or not. The line is not shown
  until the records are read, and goes the moment its lesson is ticked.
- **Someone who plays already** (the start page's answer, START.md) has every practice open, as
  for today's plan and Where you are: the line is on none of them, for nobody who said so is
  "new to this". A newcomer's answer, or none, changes nothing. Where the input notice
  (START.md) is shown too, it comes first and the lesson's line after it.
- **The line and the fold.** At 1280 × 800 two setups have their Start button on the first
  screen: Read's notes, which have no line, and Ear's Echo, where it stays there with the line.
  On the others the button was below the fold already. On Scales the keyboard and its hint
  still fit.
- **Where the lessons are read in English** (Japanese, Korean, and Traditional Chinese until
  its texts are in), the line names the lesson by its English title and adds "(in English)" in
  the page's language.
- **The next lesson** is the first of the fifteen not ticked (`nextLesson`), whatever was
  finished out of order; the pages beside the lessons are never next. Its row says "Next"
  before its minutes, in the ink of the text, and is the list's current step for a screen
  reader. Over the list: "Begin: lesson 1, …" while no lesson is ticked, "Continue: lesson 5,
  …" after, nothing once all fifteen are. The line's place is kept while the ticks are read.
- **The level kept** (`core/levelChoice.ts`) is stored with the page's other choices: `levels`,
  by family, in `dacapo.read` and `dacapo.ear`, and `level` in `dacapo.harmony`. It is written
  when a level is picked on the setup, and by a summary's **Next level**, which is a pick too;
  Start, **Again** and a page opened with settings write nothing. On opening, a page takes the
  settings it was opened with, else the level kept while that level is one of the family's and
  not mastered, else the level suggested. A level mastered is not forgotten, only passed over:
  should its mastery lapse (it is judged on the latest answers), the page opens on it again. A
  level picked or started stays chosen for as long as the page is open, as before. Scales and
  the pieces have no levels: they keep what they kept (the exercise, each piece's settings).
  For Read's notes the level suggested is the one with a player's floor (START.md), and a
  level picked below the floor is kept like any other: the pick wins until it is mastered,
  and the page then opens on the floor's suggestion.

## Pictures

The etchings in `public/learn/` were painted by GPT Image 2.5 (`gpt-image-2.5-sunburst`, high
quality, 1536×1024) with the Herdstead painter skill, then scaled to 1200×800 WebP. The style prompt
asks for a copperplate etching in dark brown ink on cream paper (#231d18 on #f8f4ec), with no text,
numbers or notation. The model does not draw a keyboard reliably, so:

- `seated-at-middle-c.webp`: generated, then edited to put the pianist at the centre of the
  keyboard, which the lesson says to do.
- `hands-either-side.webp`: an edit of a keyboard drawn in code with the black keys in their real
  groups of two and three, the model adding the hands and the etching.
- `posture-from-the-side.webp`, `curved-hand.webp`: generated, the better of two each.
- `inside-a-grand.webp`: generated, the first of two; atmosphere only, the action itself is drawn.
- `two-hands.webp`: generated with no keyboard and no numbers; the finger numbers are laid over it
  in code (`FingerNumbers`), at positions measured on the picture.

The prompts and the reference keyboard are in `scripts/learn/`.

Check every new picture for what the lesson teaches (the black-key pattern, five fingers, where the
player sits) before using it. Anything exact (a staff, a note, a key's name) is drawn in code, never
painted.

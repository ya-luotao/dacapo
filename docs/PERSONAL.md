# dacapo — Personal settings specification (your keyboard, your goal, your note names, your week)

Status: G6c (the instrument's keys), G6d (the daily goal), G6e (note names) and G6f (your week)
are built, and the decisions made while building them are under "Clarifications". This
extends [MVP.md](MVP.md) and the later specifications; their principles and fixed decisions
still apply, with one of them changed on purpose (note names, below).

Goal: dacapo treats every player alike in four places where players differ: it assumes 88 keys,
a goal of five minutes a day, and letter names for the notes, and it never looks back over a week
with them. Each of these gets a setting or a page of its own, kept on the device.

## The instrument's keys (G6c)

- **Settings → Sound → Your keyboard**: 88 keys (A0–C8, as before), 76 (E1–G7), 73 (E1–E7), 61
  (C2–C7), 49 (C2–C6), or **Other**: press the lowest key, then the highest. Kept per device
  (`dacapo.instrument.range`), neither synced nor exported: it is the instrument in front of this
  device. It concerns the keys the player has; the computer keys and the keys on the screen reach
  every note as before.
- **Nothing is taken away; what does not fit is said, and the app plays it.**
  - _Pieces_: a card and the piece's page say when the piece goes beyond the keyboard ("Goes
    below your keyboard, to A1"). In wait, memory and rhythm mode the notes beyond it are **played
    for you** with their step, as the other hand's are, and are not waited for or counted; a step
    with nothing left to play is passed. The summary says how many were played for you. The
    run counts as any other (for the review, for an assignment): its figures are those of the
    notes the player had.
  - _Scales_: the octaves and hands that run beyond the keyboard are marked ("beyond your
    keyboard") in the setup and are not proposed by Today's ladder or as the next scale; they can
    still be chosen.
  - _Read_: a card for a note beyond the keyboard is not drawn (every level's notes lie within
    C2–C6, so this matters only for **Other**); a level left with fewer than five notes says so.
  - _Ear, Harmony, sight-reading_ keep within C2–C6 already; an answer asked for beyond a smaller
    keyboard is accepted in any octave.
- The keyboard on the screen shows the instrument's keys by default on Play; a page that draws
  the music's own span keeps doing so.

## The daily goal (G6d)

- **Settings → Your data** (beside the storage status) gains **Daily goal**: 5, 10, 15, 20, 30 or
  45 minutes; 5 as before.
- **A change never rewrites the past.** The preference keeps each change with the day it was made
  (`dacapo.goal`: `[[day, minutes], …]`); a day is judged by the goal in force on it, so a streak
  earned at five minutes stays earned when the goal becomes twenty. The streak, the goal line on
  the 30-day chart (a step where it changed), Today's line and the year grid's shades (1×, 3×,
  6× the goal of each day) read it through one function (`goalOn(day)`; `core/streak.ts` already
  takes a goal).
- Per device, and exported with the preferences (the export file's `preferences` gains `goal`; an
  older file has none and keeps five). Not synced: preferences are not (SYNC.md). The public
  profile's grid keeps the service's own shades.

## Note names (G6e)

The MVP fixed letter names in every language (`MVP.md`, `TRANSLATING.md`: "no do-re-mi"). Most
learners in China, Taiwan, Japan, Korea, and in French-, Italian- and Spanish-speaking countries
learn the notes as do re mi, and a teacher there says "re", not "D". The rule becomes: **letter
names by default, do-re-mi for those who ask**.

- **Settings → Language → Note names**: **C D E** (as before) or **Do Re Mi**. Per device,
  exported with the preferences (`noteNames`).
- **Fixed do**: C is Do, whatever the key. Do, Re, Mi, Fa, Sol, La, Si; the accidental after it
  and the octave after that, as with letters: Do4, Fa♯3, Si♭. Written per language: Do Re Mi Fa
  Sol La Si in English and both Chinese; ド レ ミ ファ ソ ラ シ in Japanese; 도 레 미 파 솔 라
  시 in Korean.
- **It names notes and keys of the keyboard**: the labels on the keyboard, Read's names on a card
  and in its answers and summaries, the heatmap with its tables and weakest notes, Play's readout,
  the notes named in Ear's and theory's answers, the keys a Scales verdict points at ("before
  Fa♯4"), a piece's "Goes below your keyboard, to La1", and the words screen readers get for the
  same.
- **It does not rename what is a name of its own**: keys and scales (C major, A harmonic minor),
  key signatures' answers, chords and chord symbols (Am, G7, F/A), roman numerals, a piece's
  title, the computer keys' letters (A W S E are the keys of a typewriter), and the lessons, which
  teach the letters (their figures keep them too). Movable do and numbered notation stay out.
- `core/note.ts` keeps `letterName` and its stable forms (`pitchId`, storage, routes) as they
  are; a naming is a display choice made in `ui/` (one hook, `useNoteNames`, that every formatter
  goes through), so no stored record, link or key changes.
- `TRANSLATING.md`'s rule and `MVP.md`'s line are reworded with this.

## Your week (G6f)

- **Progress → Last week**, above **How you are doing**: the week that ended (the owner's week,
  as the year grid has it), with **This week so far** beside it. Facts, not trends (Q1 has the
  trends): the days practised of seven and the time, each against the week before; then one line
  per thing that happened, most telling first, at most six: lessons finished; levels mastered
  (named); pieces that came into review, moved up or fell back; a piece's tempo reached (after
  G2a); scales played for the first time; the practice that had most of the time and the one that
  had none though it is open (TODAY.md).
- Worked out from the records by their times (the state at the week's end against the state at
  its start, as Today does for a day): `core/recap.ts`, pure. Nothing is stored.
- **Home**, on the first two days of a week: one line under Today's figures, "Last week: 5 days,
  1 h 40 min, two levels mastered", linking to it.

## Clarifications (decided during G6d/G6f)

- **Code (the goal).** `core/goal.ts` has the goals to choose from, the history (`[day,
minutes]` pairs, oldest first), `goalOn(history, day)`, `withGoal` for a change, and the
  reading back (`parseGoalHistory`, strict, for an export file; `readGoalHistory` for the
  preference). `core/streak.ts` takes a goal that is one figure or each day's own (`DayGoal`):
  the streaks, the practice log, a month's days at goal; `goalSteps` is the chart's line and
  `levelOn` a day's shade. `ui/progress/goal.ts` reads and writes `dacapo.goal`; it and
  `core/goal.ts` load with the start (Home's line towards the goal reads them).
- **A change counts from its own day.** Today is judged by the new goal at once: a day that had
  reached five minutes has not reached twenty, so today leaves the streak until it does. The
  streak up to yesterday stands, since today never breaks one.
- **Changes on one day.** The last is kept. A change back to the goal of the day before leaves
  no change at all (5 → 20 → 5 in one sitting is no history). A change dated after today (a
  clock set back, a history from a device a day ahead) is dropped when the goal is next chosen:
  the choice counts from today.
- **The preference** is read field by field: a list of pairs, each a day the calendar has and
  one of the six goals; given out of order it is put in order. Anything else is no history, and
  the goal is five minutes for every day. With the goal at five throughout, nothing is kept.
- **The 30-day chart.** Each bar is dark when its day reached its own goal. The goal line runs
  level over each stretch of days with one goal and a riser joins two levels; the margin names
  today's goal, and the table names each day's when the goal changed within the 30 days ("5 min
  · ✓ Reached"). The chart is scaled so that the highest goal shown sits at most halfway up.
- **The year grid.** Each day is shaded against its own goal, and a month's "days at goal" are
  counted the same way. The legend is in the minutes of today's goal; when a day shown had
  another, a line under it says so.
- **Home and Progress.** The line towards the goal counts down to today's goal, and the
  contents' "5 minutes a day" names it. On Progress the sentence under the figures names today's
  goal and links to Settings.
- **The control** is a row of six segments ("5 min" … "45 min"), in one row on a phone too: the
  widest label (zh-TW's) has room to spare at 375 px and fits at 320, so no select was needed.
- **Export and import.** A file always has `preferences.goal`, an empty list when no goal was
  chosen. The file's version stays: a build from before reads the language and the theme from
  `preferences` and leaves any other field, so it imports the file and its goal stays as it was.
  On import, "Also apply the preferences" puts the file's history in place of the device's,
  whole, with its days (the line names the goal the file has today). A file without `goal` says
  nothing of the goal and changes none. A goal that cannot be read is listed with the invalid
  records, as a bad language is, and none of the file's preferences is applied.
- **Not for others.** The public profile publishes what it did (`core/profile.ts` is built with
  five minutes a day, and a test holds it to that), and an assignment's minutes a day are the
  teacher's, not the goal.
- **Code (the week).** `core/recap.ts` has the week (`lastWeek`, `weekSoFar`), the lines
  (`RECAP_KINDS`, at most `RECAP_LINES`), `weekRecaps` for Progress and `lastWeekRecap` for the
  home page's line. `weekStart` moved from `core/trends.ts` (which still exports it) to
  `core/streak.ts`, with `dayOfWeek`: the recap would otherwise bring the trends, and with them
  the exercises' rules, to the home page. `recordsBefore` is exported from `core/today.ts`. The
  section is `ui/progress/WeekRecap.tsx`, its words `ui/progress/recapFormat.ts`, the home
  page's line `ui/today/WeekLine.tsx`, and the lessons' ticks come from `ui/today/lessonTicks.ts`
  (the practice store's records, each with its time: [LEARN.md](LEARN.md), "The tick is a
  record").
- **The state at a moment** is the state when a day began, from the records before it, as
  today's plan has it (TODAY.md, "Before today": a session by the day it began, a scale run by
  its own first key, an answer by its time), with the lessons ticked by then. The week that ended
  runs from the state when its first day began to the state when the week under way began; the
  week under way from there to now.
- **Days and time.** A day practised is a day with any practice, as the year grid counts "days
  with practice": the goal is not asked for here. The time is the active time of the sessions
  begun on the week's days, in hours and whole minutes ("1 h 40 min").
- **Against the week before.** Its two figures stand under the week's own ("The week before: 4
  of 7"), without a word for more or less. A first week, with nothing practised before it began,
  is set against nothing. **This week so far** counts the days so far ("4 of 6") and is set
  against no week: the week before it is the whole week beside it.
- **No last week** is shown while nothing was practised and no lesson finished before the week
  under way began: This week so far stands alone. A week without practice after that is said so
  ("No practice last week."), and so is a week under way without any yet.
- **The lines** are one for each kind of thing, in this fixed order, the most telling first:
  lessons finished; levels mastered; tunes learnt; pieces that came into review; pieces that
  moved up in review; pieces that fell back; pieces brought to a higher tempo; scales played for
  the first time; the practice that had most of the time; the open practice that had none. The
  first six that apply are shown, so the two about where the time went are the first to give way.
  A line says how many ("2 levels mastered") and names them, one to a row.
- **Lessons finished** are the fifteen, by the time of their tick. A tick without a time (one
  made before G3 keeps times, moved into the store with `doneAt` 0) is ticked from before
  anything else: it opens its practices and is never a week's lesson.
- **Levels mastered** are those mastered at the week's end and not at its start, each by the rule
  of its own page (`levelsMastered`). A level no longer mastered is not said. A tune learnt is a
  level in the code and is said as the app says it ("1 tune learnt"), on a line of its own.
- **Review.** Of the pieces practised in the week (those taken out of review, and an imported
  piece whose facts are not kept yet, are passed over): one with no schedule at the start and one
  at the end came into review; one whose interval is a step longer moved up, a step shorter fell
  back, and the line names the interval now ("now every 7 days"). A piece that came into review
  and moved up in the same week came into review.
- **A tempo reached** is the tempo ladder's (ADVICE.md), for each hands a rhythm run of the week
  was played with: higher at the end than at the start. A piece is named once, with both hands
  when their ladder went up, else with the hand that got further (the right on a tie): "Ode to
  Joy: clean at 70%", "…, right hand: clean at 80%".
- **Scales played for the first time** are the scales and arpeggios with a run in the week and
  none before it, in the order first played. Technique is left out, as the Scales trend leaves
  it out (PROGRESS.md).
- **Most of the time** is by practice: the fifteen that can be proposed, free play and
  Improvise. It is said when two or more had time (with one it would say the week's time again);
  equals go by the order of the contents.
- **Open, with no practice** is one practice: open at the week's end (its lesson ticked by then,
  a record of it, or a player's starting point), without a session in the week, and not mastered
  throughout. Of those, the one left alone longest, one never practised before all others, equals
  in the order of the contents: the turn a family takes in today's plan. It is said of a week
  that ended and had practice, not of the week under way, which is not over.
- **Home's line** is there on the first two days of the owner's week: the days practised, the
  time, and the first line when it is about what happened ("Last week: 6 days, 1 h 21 min, 1
  level mastered"; the two lines about the time are Progress's). It leads to Progress opened on
  the week (`#/progress?show=week`: a route's setting, since the route itself is the fragment).
  It comes with the plan's rows and its room is kept from the start, one line (two on a phone),
  also when there is nothing to say (no practice last week): the plan under it stays put.
- **On Progress** the two weeks stand side by side from about 800 px and one under the other on
  a phone, as rows in the manner of "Where you are", under "Ear training and theory" and above
  "How you are doing". They are shown to whoever has the page, with ticks alone too. The days of
  a week are written as the language writes a span of days (`Intl`'s `formatRange`).

## Clarifications (decided during G6e)

- **Code.** `core/noteNames.ts` is the pure formatter: `noteName` (a letter, its sign, its
  octave, in a naming and a language), `createNoteNames` (the names for the app's two
  spellings: a key's `formatPitch`, `letterName`, `midiName`, a written note's `spelledName`,
  `letterOf`) and `fillNoteNames` (the notes in a dictionary's string). `core/note.ts` is
  untouched. `ui/noteNames.ts` has the hook, `useNoteNames`; `ui/LetterNames.tsx` pins the
  letters for what is inside it. `ui/noteNames.test.ts` fails when a file of `ui/` takes
  `letterName`, `formatPitch` or `midiName` from `core/note.ts`, or writes a ♯ or ♭ itself,
  outside two short lists (the lessons; a chord's root, a chord symbol, a scale's tonic, the
  accidental drawn on a staff): new code cannot name a note past the setting.
- **Where the choice is kept.** Beside the language, in the same provider (`noteNaming` and
  `setNoteNaming` of `useI18n`), because the dictionaries' strings need it too: `t` fills a
  note's placeholder as it reads the string. The hook in `ui/` is what formatters call.
  `dacapo.noteNames` holds `solfege`; letters keep nothing, as following the browser's language
  keeps nothing. A change shows at once on every page; another tab follows when it is loaded
  again, as with the language.
- **Notes in the dictionaries.** A string that names a note or a key of the keyboard writes it
  as a placeholder: `{C4}`, `{C}`, `{A0}` (the letter, `s` or `b` for a sharp or a flat, the
  octave if any), filled by `t` itself, so no call site can leave it out: "Treble: {C4} to
  {C5}", "middle {C} position", "Piano keyboard, {A0} to {C8}". Ten strings have one, the same
  in every language (`i18n.test.ts` lists them).
- **Middle C** follows the setting wherever the app says it ("middle Do", 中央 Do, 中央ド, 가운데
  도): it names a key by its note, as "C position" does.
- **Read's hint** is "Show letter names" while notes are letters and "Show note names" once
  they are do re mi (`settings.noteNames.hint` and the two labels a screen reader hears); 音名
  and 음이름 say both. A key signature's hint names the notes it raises or lowers (Fa♯ Do♯
  Sol♯), and "its tonic is Fa" names the key to press, so both follow; the key itself stays
  "F major".
- **Chords.** A chord's symbol and its name in words keep their letters, the bass of a slash
  chord in them too (C/E, "C major triad over E"). Its notes follow ("C is Do Mi Sol", the
  hint, the keys played), and so does the bass where it is the key to put lowest ("Play this
  chord with Mi lowest"). On Read, the buttons that name a chord's root stay C D E F G A B: they
  are the chord's name, and the computer keys that choose them are those letters.
- **Improvise.** A scale's notes ("Fa La♭ Si♭ Do♭ Do Mi♭") and the range played follow; the
  scale's and the key's names and the backing's symbols do not.
- **A piece's entry in the library** stays as written, its description with its title ("long
  bass notes with F♯ in the left"): a programme note in each language's own convention, which
  in Japanese already names a drone's notes ニ, イ, ホ.
- **The lessons.** `LessonProvider` wraps the whole lesson page in `LetterNames`: the text, the
  figures, the keyboard's labels and what it says to a screen reader. The names the figures
  print come from `learn/lesson.ts` and `learn/notes.ts`, which are letters by construction.
  The list of lessons and the links to a lesson are words, with no note in them.
- **Signs and octaves.** A double sharp or flat is written as before, after the syllable
  (Fa𝄪5). In Chinese the syllables are Latin, as the letters were, with the same spaces round
  them. A language the app does not have would get the Latin ones.
- **A name stays in one piece.** Japanese may end a line between any two kana, and between a
  kana and a sign or a digit, which would leave ファ at the end of one line and ♯4 at the start
  of the next. The Japanese names carry a word joiner (U+2060: it shows nothing and is not read
  aloud) between their parts, so a name goes to the next line whole, as a letter name does.
  Korean wraps between words already, and the Latin syllables are words.
- **The export file.** `preferences.noteNames` is `letters` or `solfege`, written by every
  export from now on. No new export version: a build from before reads the language and the
  theme of `preferences` and leaves any field it does not know, so the file imports there as it
  did. A file without the field means letters: applying its preferences sets letters, and the
  import preview says so with the language ("English, C D E, Dark"). (The goal differs: a file
  without one changes none, since a goal is a history and a naming is a state.) A value this build does
  not know makes the preferences invalid, as an unknown language does; the records import all
  the same.
- **Not synced**, as no preference is; the public profile is the service's page and keeps the
  letters.
- **Korean particles.** Letter names all end in a vowel when read; 솔 does not. Two sentences
  that ended a list of a chord's notes with 예요 now end it with (이)에요, as the dictionary
  already writes 을(를) after a note: the only change to a string that a reader with C D E sees.
- **Widths.** Sol♯4, ファ♯4 and 솔♯4 are wider than G♯4. One thing ran out of its box at
  375 px: the mark on middle C (Do4, ド4, 도4) on a keyboard whose keys are narrower than 18 px,
  a piece's on a phone. There the mark leaves out its octave with do re mi ("Do" under its
  dot), by the key's own width; with letters it is as it was. The rest fits in the five
  languages: the mark on Play's and Read's keyboards and the heatmap's labels on the C keys
  keep their octave, Ear's answer buttons name intervals and chords and are unchanged, and
  sentences, lists and table cells wrap as they did. Play's readout wraps to a second line one
  or two notes sooner than with letters, as it always has for a larger chord.
- **The keys beyond the keyboard** (G6c's "Goes below your keyboard, to La1") are named
  through `useNoteNames`, as are the keys of a keyboard in Settings ("49 keys (Do2–Do6)").

## Clarifications (decided during G6c)

- **Code.** `core/instrument.ts` is the pure part: a keyboard as its lowest and highest key
  (`KeyRange`), the five sizes, the preference read back, the two keys pressed for **Other**,
  what of a piece lies beyond a keyboard, the keys of a scale, Read's cards on a keyboard, and
  the answer in any octave. `ui/instrument.ts` reads and writes `dacapo.instrument.range` and
  has the hook, `useInstrumentKeys`. The control is `ui/settings/KeyboardBlock.tsx`.
- **The preference** is `{"low": 36, "high": 84}`, two MIDI numbers. It is read field by field:
  two whole numbers within A0–C8, the highest at least an octave over the lowest; anything else
  is 88 keys. With 88 keys nothing is kept. A change shows at once on every page of the tab;
  another tab follows when it is loaded again.
- **The control** is a select (six choices do not fit a row of segments on a phone): the five
  sizes, each with its keys ("49 keys (C2–C6)"), and **Other**. Choosing Other asks for the
  lowest key, names it, then asks for the highest ("Lowest key: C3. Now press the highest
  key."); the two are taken in whichever order they come, and the choice then reads "Other: 25
  keys (C3–C5)" with **Set again**. A second key less than an octave from the first is no
  keyboard: the highest key is asked for again. **Cancel** (or Escape) leaves the keyboard as
  it was. Only the keys of a MIDI keyboard count (`onMidiKey` of the input system, the MIDI
  source alone before it is merged with the others); without one connected the panel says so.
  A keyboard captured as one of the five sizes' keys is that size.
- **A piece's steps stay the same steps** (`buildSteps` with a keyboard): none is left out, so a
  step's index, bar and pass mean the same on every keyboard, and a take made on one is read on
  another. Each step has its keys beyond the keyboard set apart (`given`); its `midis` are the
  player's, and with none left the step is passed. **The checksum is the piece's**: its notes
  did not change, only whose they are.
- **Wait and memory mode.** A step is complete with the keys the player has. A key the app
  plays, struck all the same (the keys on the screen reach every note), is neither right nor
  wrong: on the step it belongs to, on the steps passed since the last one completed, and just
  after its own step. A step with none of the player's keys is never waited on: it is recorded
  as the run goes by it, with no time and no wrong note; the steps passed before the run's
  first key go into the records with its first step. Bars in which every step is the app's
  have nothing to play, and the page says so ("Every note of these bars is beyond your
  keyboard"); so has a start bar from which every step to the end is the app's (the run does
  not go back to an earlier bar; round a loop it begins at the loop's first step of the
  player's). In memory mode the bar shown at the start is the first one the player has a step
  in.
- **Rhythm mode.** Every step is due at its time, with the windows of 88 keys; the keys due are
  the player's. A step with none settles with no note, nothing missed; an extra note near it is
  an extra note as anywhere. A key the app plays, struck within its step's window, is neither a
  hit nor an extra note.
- **Sound.** The notes beyond the keyboard go the way the other hand's go (PIECES.md,
  "Accompaniment"): in wait and memory mode a step's own sound when it is completed, and those
  of the steps passed after it follow at the tempo, to be dropped if the player plays on before
  they have begun, as the other hand's are; those before a loop's first key are its lead-in,
  and before the first key of a run without a loop they are not played. In rhythm mode they
  are played in time. They sound whether or not **Other hand** is on, at the other hand's
  volume (Settings names both), through the output in use, and with none they are silent and
  still not waited for. Notes sent to the player's own instrument are kept from coming back as
  the player's keys by the guard every note the app sends has.
- **An ornament on a note the app plays** is played by the app with its note; its keys are
  neither right nor wrong, as an ornament's are, and nothing is judged of it.
- **What a run stores** (PIECES.md, "Records on a keyboard with fewer keys"): a record for
  every step, the piece's checksum, and in rhythm mode the keys that were the player's. A step
  passed has an empty list of keys (`notes: []`) in every mode, so it is told from a step that
  took no time (a run's first step has none either). The session's `steps` are the steps the
  player had, and `given` the notes played for them. The session has the keyboard too, `keys`,
  its lowest and highest key, whenever it had fewer than 88: a reader goes by it, whatever
  keyboard the device has now. The take has the player's keys alone, and a key of the app's
  that the player struck matches nothing in it. A step passed has no time, no wrong note and
  no prompt in wait and memory mode, and a file or a service that says otherwise is refused,
  as is a keyboard that is not two keys of the piano, the lower first, or a count of notes
  played for the player beyond 100,000.
- **Sync and files.** A build from before refuses a step with an empty list of keys and keeps
  the session without `given` and `keys`: `SYNC_SCHEMA` 22, so an updated build pulls
  everything again, the steps passed come to it, and a session kept without them is replaced
  by the copy that has them (the longer one wins; SYNC.md). The export format stays at 10: a
  build from before lists the steps passed among the records it could not read and imports the
  rest. The database stays at version 9. The device's choice of keyboard is in no record; a
  run's session has the keyboard it was played on.
- **The run counts as any other.** Every reader that counts steps to tell a pass or a round has
  the steps passed among them: an assignment's runs through its bars, the rounds of a loop for
  the weak bars' map, a phrase in time for the plan, the bars a run to the end goes through.
  Every reader that judges the playing leaves them out, or has them as what they were:
  - _the review_ counts wrong notes against the piece's keys without those played for the
    player (in rhythm mode, against the notes due, which are the player's), and a run's median
    step and its bars' are of the steps the player had;
  - _an assignment_'s notes right are of the steps the player had, and in rhythm mode its notes
    right and in time of the notes the player had;
  - _weak bars_ are judged on the steps the player had: a bar's time per step and its wrong
    notes per step are of those. A bar that is all the app's has none: it is not coloured, held
    nobody up, and is steady once it has been gone through three times, in time as in
    hesitation. The timing map is of the player's notes;
  - _the plan_ is made for the keyboard of the device: a hand whose every step of a phrase is
    the app's has no stage there (nobody can play it, and it is not asked for), Together and
    In time stay while the phrase has a step of the player's, a phrase with none is left out,
    and a piece with none has no plan. The stages that stay are reached as on 88 keys, the
    steps passed counting as gone through. Today's plan and "Next for you" read the same
    plan;
  - _a run to the end_ has at least one step of the player's: a session with none brings
    nothing into review;
  - _the tempo ladder_ climbs with a clean run to the end as on 88 keys;
  - _the advice_, the summaries and the trend of first tries are of the player's steps and
    notes, and the summaries say how many notes were played for the player;
  - _the expression_ judges nothing of a note that was the app's (an accent on it is not one
    the player missed).
- **A past run is read on any keyboard** (`core/runKeys.ts`): with the keyboard its session
  keeps. **Play back** plays the player's keys and the notes the app played for them, as they
  sounded (in rhythm mode from the bar the run began in). **Save as MIDI** saves the player's
  keys, as a take has them.
- **A session without its keyboard** is one a build from before kept (it strips `keys`, and
  the copy with it comes back with the next round of sync). When such a session says notes
  were played for the player, which they were is read off the run. In rhythm mode a step's
  record lists the player's keys, so the step's other keys were the app's (the step records
  are on the piece's page). In wait and memory mode a step is complete only with every key the
  player has, so a key of a completed step without a stroke in the take was the app's, and so
  was every key of a step with a record that says it was passed, or gone by without a stroke;
  the last step of a run played to its end without a loop was completed too. That gives the
  keyboard as far as the run's own notes go.
- **Known limits**, both of a wait or memory run without its keyboard. The last step its take
  reaches says nothing when the run was stopped or went round a loop: the run may have stopped
  on it. Round a loop in which the player has a single step, the take does not tell one time
  round from the next, and says nothing of that step. A note of such a step that the app
  played is then not played back, and counts as one the player left out. A rhythm run without
  its keyboard is told from its step records, exactly; without them (they are read with the
  piece's page) it is read as a run on 88 keys.
- **A run cut off by a closed tab** is put together from its steps: it has its keyboard, and no
  count of the notes played for the player, so its summary gives none (it is no run to the
  end, and nothing counts against it).
- **The card and the page.** A piece's facts gain `keys`, its lowest and highest key (built-in
  pieces have them in the library's index, locked by its test; an imported piece gets them when
  it is next listed, as it got its count of notes). A card says "Goes below your keyboard, to
  A1", "Goes above your keyboard, to E6", or both in one sentence; the page says the same under
  the score, of the piece in the key it is shown in, and adds that those notes are played for
  the player. Nothing is said with 88 keys or of a piece that stays on the keyboard.
- **Scales.** In the setup an octave count or a hand that would run beyond the keyboard has a
  mark (`*`), explained under the row ("* Runs beyond your keyboard") and read out with the
  option ("4, beyond your keyboard"); it can be chosen all the same. Such an exercise is not
  the Scales page's suggestion, nor today's warm-up, nor the ladder's next rung, which goes on
  to the next that fits. Today's plan and Where you are know a scale's keys without the
  exercises' rules (`scaleKeys`, held to the notes themselves by a test); a technique exercise
  is judged on the Scales page only. A plan already made for today stays as it is.
- **Read.** A level's cards are those whose key the keyboard has. A level with fewer than five
  of its notes on the keyboard says how many ("Only 1 of its notes is on your keyboard"), and
  one with none cannot be started. One note left is drawn again and again, as a session of one
  note is; **Practise these** (ADVICE.md) draws of its notes those the keyboard has. The
  mastery rule is unchanged.
- **Ear, the chord cards, sight-reading.** Where a key is asked for at its own octave (a
  melody's or a tune's next key and an interval's note on Ear, a written chord's notes on Read,
  a sight-reading fragment's notes), a key the keyboard lacks is answered by the same note in
  any octave, and the answer is recorded as the key asked for, so its record is the same on
  every keyboard. Chords by ear, chord symbols and a key signature's tonic were right in any
  octave already. A progression on Harmony is practised as a piece: its notes beyond the
  keyboard are played for the player. Read's rhythm for two hands still splits the keys at
  middle C, so a keyboard wholly to one side of it taps one line only.
- **Play** draws the instrument's keys, each end out to the next white key, no wider than they
  want, and has **Show all 88 keys** under it (not kept: the page opens on the instrument's
  keys). Every other page draws what it drew.

## Milestones

1. ✓ **G6c The instrument's keys** — `core/instrument.ts`, Your keyboard in Settings, the notes
   beyond it played for the player in a piece, its steps passed and the notes given in the
   records (`SYNC_SCHEMA` 22), the marks in Scales, Read's cards, Play's keyboard.
2. ✓ **G6d The daily goal** — `core/goal.ts`, each day by the goal it had, the control in
   Settings, the goal in the export file's preferences.
3. ✓ **G6e Note names** — `core/noteNames.ts`, `useNoteNames`, the notes in the dictionaries'
   strings as placeholders, Settings' control, the export's `noteNames`.
4. ✓ **G6f Your week** — `core/recap.ts`, Last week and This week so far on Progress, Home's line.

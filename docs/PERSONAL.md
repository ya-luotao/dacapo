# dacapo — Personal settings specification (your keyboard, your goal, your note names, your week)

Status: G6d (the daily goal) and G6f (your week) are built; the instrument's keys and note
names are planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply, with one of them changed on purpose (note names, below).

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
  page's line `ui/today/WeekLine.tsx`, and the lessons' ticks come from `ui/today/lessonTicks.ts`.
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
  made before G3 keeps times) is ticked from before anything else: it opens its practices and is
  never a week's lesson.
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

## Milestones

1. **G6c The instrument's keys**
2. ✓ **G6d The daily goal** — `core/goal.ts`, each day by the goal it had, the control in
   Settings, the goal in the export file's preferences.
3. **G6e Note names**
4. ✓ **G6f Your week** — `core/recap.ts`, Last week and This week so far on Progress, Home's line.

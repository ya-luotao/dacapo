# dacapo — Today specification (what to practise next)

Status: G1 (the curriculum, today's plan, Home for a returning player, the kept plan, the length)
and G1b (Where you are) are built. This extends [MVP.md](MVP.md) and the later specifications;
their principles and fixed decisions still apply — in particular **the next step is suggested,
never forced**: nothing here locks a level, a piece or a page, and everything stays one click
away as before.

Goal: every practice has its own way of saying what comes next (a level marked Suggested, the
scale to play next, the pieces due for review), and nothing puts them together. A player who opens
dacapo has to know which of eight pages today's practice is on. **Today** is a short plan for the
day, made from the player's own records: a warm-up, the piece in hand, something new, and a piece
or two to play through; each a link that starts it, each ticking itself once it is played.
**Where you are** shows the same state for every practice on the Progress page: how far each has
got, and its next step.

No model, no account and no new record: both are worked out on the device from what is stored.

## The curriculum (`core/curriculum.ts`)

One table says which lesson of Learn opens which practice. It is the only place that joins lessons
and practices (G3's links between them read it too).

| Practice                     | Opens with the lesson            |
| ---------------------------- | -------------------------------- |
| Read: notes                  | always open                      |
| Read: intervals on the staff | Landmark notes and intervals (3) |
| Read: rhythm                 | Rhythm and the beat (4)          |
| Read: sight-reading          | Rhythm and the beat (4)          |
| Read: key signatures         | The major scale (6)              |
| Read: chords on the staff    | Chords and harmony (13)          |
| Ear: intervals               | Landmark notes and intervals (3) |
| Ear: rhythm                  | Rhythm and the beat (4)          |
| Ear: Echo (melodies)         | The major scale (6)              |
| Ear: tunes                   | The major scale (6)              |
| Ear: chords                  | Chords and harmony (13)          |
| Ear: cadences                | Chords and harmony (13)          |
| Harmony: chord symbols       | Chords and harmony (13)          |
| Scales                       | The major scale (6)              |
| Pieces                       | Landmark notes and intervals (3) |

- A practice is **open** once its lesson is ticked, or once the player has a record of it (a
  session, an answer, a run; for Pieces an imported piece too, which someone means to play):
  someone who went there on their own is not sent back to a lesson. A third way opens every
  practice at once: the visitor said on the start page that they play already
  ([START.md](START.md)). Open only decides what Today and Where you are _propose_; no page
  reads it.
- Harmony's Progressions and Improvise, the metronome and free play have no levels and no record
  of how far one has got: they are never proposed.
- **The scale ladder**, for the next scale never played: the keys in the order C, G, F, D, A, E,
  B♭, E♭, B, A♭, F♯, D♭, each as three rungs: major, one octave, right hand; the same, left hand;
  major, two octaves, both hands. Once the lesson on minor keys (9) is ticked, each major key's
  three rungs are followed by its relative harmonic minor in the same three. A rung is an
  exercise key (`major:C:1:right`, `harmonicMinor:A:2:both`; a test holds every rung to
  `parseExerciseKey`), and is _played_ once it has a recorded run. (Arpeggios, contrary motion and
  technique are the player's choice.)
- **The next piece**, when none is in hand, goes by where the player is ([PIECES.md](PIECES.md),
  "Next for you"; until G5b it was the first by grade): of the built-in pieces written for two
  hands that have no session at all, the first, in the library's order, at the highest grade of
  a built-in piece played to its end; when that grade has none left, the first of the grade
  above; the first of Initial when none has been played to its end. So it never goes back below
  the grade reached, and never more than one grade up. When no piece is left within that, there
  is no next piece (the library is the player's to choose from). Lead sheets and imported pieces
  are not proposed.

## Today's plan (`core/today.ts`, pure)

`todayPlan(records, { today, minutes, lessonsDone, timeZone })` returns the steps, and
`planProgress(plan, records)` says which are done.

- **The plan is made from the records before today began** (the first minute of today on the
  player's calendar), and **ticked from today's records**. So it does not change as it is played:
  a level mastered at ten o'clock is still the step it was at nine, now ticked.
- **Made once a day, and kept.** The first time Home is opened on a day, the plan is made and kept
  in the browser (`dacapo.today`: the day, the length, the steps, and the lessons ticked at that
  moment); for the rest of the day Home shows the kept plan, so records arriving from another
  device do not reshuffle it, and a lesson ticked today stays the step it was (the plan keeps
  the lessons ticked when it was made). Changing the length makes the plan again, from the records before today and the lessons
  kept. It is per device and not synced: two devices may show two plans, each of them a good one.
- **Steps are tasks where a task fits.** A scale, a level and the lesson are an assignment's
  `ScaleTask` (at any tempo, one run), `LevelTask` (one session) and `LessonTask`
  (`core/assignmentRecords.ts`) with today as their window: `taskProgress` ticks them, and Home
  names and starts them as it does an assignment's tasks. A piece step is a step of its own (a
  `PieceTask` wants bars, hands, a tempo and the steps of a pass; the piece in hand is opened on
  the next step of its plan, and five minutes on it count).
- **Length.** 10, 20, 30 or 45 minutes (the lengths of lesson 14's figure), 20 unless chosen;
  kept per device (`dacapo.today.minutes`). The length sets how many steps each part has:

  | Minutes | Warm-up | Work | New                     | Play through |
  | ------- | ------- | ---- | ----------------------- | ------------ |
  | 10      | 1       | 1    | 1 (see "the lesson")    | 1            |
  | 20      | 1       | 1    | 1 level and the lesson  | 2            |
  | 30      | 1       | 1    | 2 levels and the lesson | 2            |
  | 45      | 2       | 1    | 3 levels and the lesson | 3            |

  Steps have no minutes of their own: the plan says "about 20 minutes", not how long a scale takes.

- **Warm-up** (when Scales is open): the scale to play next by the Scales page's own rule
  (`suggestedExercise`: the least even of those played in the last 14 days). The next rung of the
  ladder takes its place when there is no such scale, or when every exercise played in the last 14
  days has at least five runs (the runs its figure is taken over): the scales in hand have had
  their work, so a new one joins. The second warm-up of the 45-minute plan is the other of the two.
  Done: a run of that exercise recorded today.
- **Work**: the **piece in hand** — the piece practised most recently in the last 14 days that has
  not been played to its end (`isRunToTheEnd`), built-in or imported. Its step opens the next step
  of the piece's plan ([PIECES.md](PIECES.md), "A piece's plan": the bars, the hands, the mode and
  the tempo of the first stage not done when the day began), and its line names it ("Bars 5–8,
  left hand · Last played 2 days ago"); until G5c it opened the piece as it was left, as it still
  does for a piece whose score cannot be read. Done: a run to its end today, or at least five
  minutes on it today. Without a piece in hand, and when Pieces is open: **the next piece**
  (above), opened as it is and done the same way.
- **New.** A _level_ step is the suggested level (the family's own rule: its first level not
  mastered) of an open family that is not mastered throughout. Of those families, the one whose
  last session is longest ago comes first, one never practised before all others, equals in the
  order the pages list them (`LEVEL_FAMILIES`); so the families take turns from day to day
  without a rota. Done: a session of that level played to its end today (a level task's rule in
  ASSIGNMENTS.md). **The lesson** is the first of the fifteen not ticked. In the 10-minute plan it
  takes the level's place while fewer than seven lessons are ticked (the first weeks belong to the
  lessons) and is left out after; the longer plans have it beside the levels. Done: ticked (it
  was not when the plan was made). Someone who said they play already ([START.md](START.md)) has
  no lesson in the plan at any length (Learn stays where it is): the 10-minute plan has a level.
- **Play through**: the pieces due for review (PIECES.md, P6; those taken out of review are not),
  the longest overdue first. Done: a run to the end today.
- **Order.** Warm-up, work, new (the lesson, then the levels), play through: lesson 14's session.
- **Nothing to propose** (a part with no candidate) leaves the part out. A plan with no step at
  all says so: "Nothing is waiting today. Play what you like." with the way to Play.
- **An assignment comes first.** While an assignment for me is current and has open tasks, Home
  shows it as today (as T1 built it) and Today's steps are not shown: a teacher's plan is not set
  beside one the app made up. Once its tasks are met, or without one, Today is shown.

## Home

- **A returning player** (a session stored, a lesson ticked, or the start page answered,
  [START.md](START.md)) gets Today in place of the hero and of the blocks "Your practice" and
  "Due for review", which it takes in:
  the day as the eyebrow, the heading "Today", the figures the block "Your practice" had (minutes
  today, the streak, the longest), then the plan as a numbered programme in the manner of the
  contents below it: each row its part (Warm-up, Work, New, Play through), the step's name as the
  link that starts it, one muted line saying why it is there, and a tick once done. Under it the
  line towards the daily goal, the length (10 · 20 · 30 · 45) and the link to Progress. The
  contents, the principles and the questions follow as before; the tagline, the lede and the
  specimen are for a first visit.
- **Why it is there**, one line per step, from the figures the rule used: "The least even of the
  scales you played lately" · "New: the next scale" · "Last played 2 days ago" · "A new piece" ·
  "Not practised for 6 days" · "Not practised yet" · "Lesson 5 of 15" · "Due for review since 3
  days". No advice in these lines (that is G2's).
- **When every step is ticked**: "Today's plan is done." in the goal's colour; the steps stay,
  ticked.
- **Without a jump.** Whether the visitor is a returning player is kept in the browser
  (`dacapo.returning`, set once a session or a tick exists), so the page is laid out right before
  the records are read. Today's rules take every practice's mastery rule, so they are loaded apart
  from the start, like the assignment's block: the heading and the figures draw at once, the rows
  when the rules are in, in a space kept for them. The test that holds the start
  (`ui/assignments/startup.test.ts`) holds `core/today.ts` and `core/curriculum.ts` out of it too.
- The part names follow lesson 14's figure of a session (Warm up, Hard spots, Something new, Play
  through; the lesson's text is not in every language, so the names are new strings in all five,
  with the lesson's own words in English, Simplified Chinese and Traditional Chinese).
- A name of a scale is put together from its exercise key alone, as the assignment's block does it
  (no `core/scales.ts` at the start).

## Where you are (Progress)

A section under the day's figures, above the charts: one row per practice, in the order of the
contents.

- **Learn**: lessons ticked of fifteen; next, the first not ticked.
- **Read, Ear, Harmony**: each family that is open or has records: levels mastered of its levels
  (a tune learnt counts as a level), and its suggested level as the link that starts it. A family
  not open is one muted row: "After lesson 13, Chords and harmony", linking to the lesson. A
  family mastered throughout says so and has no link.
- **Scales**: exercises played, the weakest lately (the link), and the next rung of the ladder.
- **Pieces**: how many are in review and how many due; per grade, built-in pieces played to the
  end of those the grade has; the piece in hand or the next piece as the link.

It is the state Today is made from (`curriculumState` in `core/today.ts`), as it is now (not as
it was before today). On a phone each row stacks: the practice, its figure, its link.

## Records, sync, export

Nothing new is stored but three preferences in the browser (the length, the day's plan,
returning). Nothing is synced or exported for this, and `SYNC_SCHEMA` stays. (The lessons' ticks
the plan reads became records of their own with G3, synced and exported: LEARN.md.)

## Clarifications (decided during G1)

- **Code.** `core/curriculum.ts` has the table, the ladder and the next piece; `core/today.ts`
  where every practice stands (`curriculumState`), the plan (`todayPlan`, `planOf` from a state,
  `planProgress`, `planFor` for the kept plan, `readPlan` to read it back) and
  `assignmentComesFirst`; `core/todayRecords.ts` the plan as plain data (its lengths, its counts
  per part, its steps), which is all the start needs of it. `planProgress` takes, beside the
  plan and the records, the lessons ticked now and the time zone. The ranking of the scales
  (`scaleProgress`, `suggestedExercise` and their constants) moved out of
  `core/scaleProgress.ts` into `core/scaleRanking.ts`, which the former exports as before: the
  places over runs need the exercises' rules, the ranking does not, and so the plan's rows load
  without `core/scales.ts`, like the assignment's block. `core/assignments.ts` now exports
  `untilDue` (the line where today began is the end of yesterday), `levelsMastered` (the mastery
  of many levels at once, by the checklist's own reading of each page's rule) and `openTasks`.
  Since G5b where the pieces stand (played to the end, in review, in hand, next) is worked out
  in `core/piecesStanding.ts`, which `curriculumState` reads and the Pieces page reads on its own.
  The hooks and components are in `ui/today/` and `ui/home/Today.tsx`; the section on Progress is
  `ui/progress/WhereYouAre.tsx`.
- **Before today.** A session belongs to the day it began; a scale session grows run by run, so
  each of its runs goes by its own first key (one begun before midnight keeps its runs from
  before for the plan, and its later runs tick); an answer by its own time; a piece's step
  records go with their session.
- **Open.** A record is a session of the practice, an attempt or an answer of it (a tab closed
  before its session was stored leaves answers alone), a scale run, a run of any piece (one
  deleted since, too), or an imported piece. Free play and Improvise open nothing.
- **A family's turn.** "Its last session" is the start of its latest session. Its suggested level
  is its first level not mastered, mastery being the level's own on its page (what an assignment's
  "until mastered" asks); a family whose every level is mastered is left out, and so is one that
  is not open.
- **The ladder's keys** are spelled as the Scales page spells them: `Bb`, `Eb`, `Ab`, `F#`, `Db`;
  F♯ major's relative minor is the page's E♭ minor (the keys of D♯ minor), B major's G♯ minor.
  The rungs of the minors join the ladder where their major's rungs end, so ticking lesson 9
  after the majors were played makes A harmonic minor the next rung.
- **The warm-up's fourteen days** are the Scales page's: today and the thirteen days before it
  on the calendar (the plan has no record of today, so thirteen days of records). **Five runs**
  are the runs recorded of the exercise in all, as the page counts them, not only the last
  days'. When the scales in hand have had their work and no rung is left, the least even stays
  the warm-up; the 45-minute plan has a second warm-up only when there are two to propose.
- **The piece in hand** is looked for among the pieces on this device, by the start of each
  piece's latest session, within today and the thirteen days before. A run to the end is told as
  the review schedule tells it (`isRunToTheEnd`, with the step records when they are here); for
  an imported piece whose facts are not kept yet, a completed run without a loop, in the written
  key, with both hands. A piece ever played to its end is in review and never in hand again. A
  lead sheet can be in hand: its melody is the whole of it.
- **The next piece.** "A built-in piece played to its end" is any built-in piece, a lead sheet
  among them; "no session at all" is no run of the piece of any kind.
- **Five minutes on it** is the active time of the piece's runs begun today, added up, whatever
  their hands, loop, mode or key.
- **Play through.** The schedule is worked out from the records before today, and a piece is due
  when its date is today or earlier; the line counts the days past the date. An imported piece
  whose facts are not kept yet waits, as on the Pieces page. A piece due and played through today
  stays in the plan, ticked.
- **The lesson.** The fifteen are counted, not the pages beside them. In the 20, 30 and 45-minute
  plans the lesson stays until all fifteen are ticked.
- **The kept plan** is `dacapo.today` as JSON: `{ day, minutes, steps, lessonsDone }`. It is read
  back field by field (the day, a length of the four, each step's part, reason and task: an
  exercise key, a level its family has, a lesson of the fifteen); anything else is no plan, and
  the plan is made again. Since G5c the work step of the piece in hand also keeps the step of
  the piece's plan it opens (`step`: a stage, its bars with their printed numbers, the hands, the
  mode, a tempo or none), read back field by field too; a plan kept before has none and stands as
  it was ([PIECES.md](PIECES.md), "Clarifications (decided during G5b/G5c)"). It is made and kept
  even while an assignment hides its steps. It is
  not kept when it was made over records that are there and cannot be seen (a database of a
  later version of dacapo, a read that failed: [LEARN.md](LEARN.md), "Clarifications (decided
  during G3)"): the reload that has the records makes the day's plan. A piece
  step whose imported piece was deleted since stays, without a link.
- **Returning.** `dacapo.returning` is `1` or absent. The flag stands in for the sessions and
  the lessons' ticks until they are read (since G3 a tick is a record like a session:
  [LEARN.md](LEARN.md), "The tick is a record"); it is set the moment a lesson is ticked, and
  ticks an earlier version kept in the browser's preferences still say "returning" at once, as
  they did when they were read directly. Once the records are read, they decide: the flag is
  set when there is a session or a tick, and removed when there is neither (the data was
  deleted), and the first visit's page comes back. Records that could not be read (no storage
  to use, a database of a later version, a read that failed) decide nothing: the flag stays as
  it was, and is only ever set there. An answer on the start page counts as a tick
  does, and is read at once ([START.md](START.md)). A first visit with an assignment added still
  has it under the hero, as T1 built it.
- **The part names** are lesson 14's: Warm up, Hard spots, Something new, Play through (热身、
  难点、新内容、完整弹一遍); "Work" and "New" above are these. A part is named on the row
  where it begins; the rows after it are under the same name (a screen reader hears it on each).
- **The lines' words.** English has no "since 3 days": "Due for review for 3 days", "Due for
  review since yesterday", "Due for review today"; "Last played yesterday"; "Not practised for 1
  day". The plan's heading is "A plan for about 20 minutes".
- **A step's name** is the task's, as the assignment's block names it ("Lesson: The staff and
  the clefs", "C major, 1 oct. · Right hand"), but for a level, whose id ("KS1") says nothing
  to a learner: its name is its practice ("Read · Key signatures"), and the line under it leads
  with the level's own name, then why it is there ("Major keys to two sharps or flats · Not
  practised yet"). A tune is named with its title ("Ear · Tunes · Amazing Grace"). The name is
  the link, and the whole row answers to it. A done step has a tick in place of its arrow, with
  "Done" for a screen reader, and its name steps back.
- **Home.** "Today" is the page's heading; the day above it is the weekday, the day and the
  month. "Today's plan is done." stands beside the plan's heading. The length is a row of
  segments ("10 min" … "45 min", its legend for a screen reader) between the goal's line and the
  link to Progress, loaded with the start; it is not shown while an assignment hides the steps.
  The assignment's block (T1's, unchanged) stands in the plan's place while it has open tasks;
  once they are met it stays above the plan with "Every task is done."
- **The room kept for the rows** is that of the kept plan when it is today's at this length
  (the plan that will be shown), else of the last plan of this length, else the most a plan of
  this length has (4, 6, 7 and 10 rows). Row heights are fixed in rem, so on a wide screen the
  room is the rows' to the pixel. On a phone a name may wrap, which the room cannot know. **Known
  limit:** with a current assignment that has open tasks, the room kept for the rows is given
  up when the checklist is in, and what is below moves up once.
- **Nothing waiting** is rare: Read's notes are always open, so the plan is empty only when all
  fifteen lessons are ticked, every family is mastered throughout, no rung of the ladder is left
  with no scale played lately, no piece is in hand or next, and none is due.
- **Where you are** has sixteen rows: Learn, the thirteen families each with its page ("Read ·
  Notes"), Scales and Pieces. A level's link reads "L2 · Treble: C4 to C5", a tune's its title.
  Scales counts every exercise played, technique too; "in review" leaves out the pieces taken
  out; a grade's pieces are all its built-in pieces, lead sheets among them. A practice not open
  links to its lesson by "After lesson 13, Chords and harmony" (the title in the lesson's
  language). It is shown once there is a session or a ticked lesson (or the start page
  answered, [START.md](START.md)): with ticks alone the page has the day's figures and this
  section, and the charts once there are sessions.
- **The start.** The files `index.html` loads were 895,774 bytes (272,952 gzipped) before and are
  900,387 (273,041) with Today: about 4 kB of styles, the 36 strings in English, and the plan's
  heading, figures and length, less the review schedule, which the home page no longer loads
  with the app. The plan's rows are 55 kB more (22 kB gzipped), most of it what the assignment's
  block loads too (the checklist's rules), and only for a returning player.

## Milestones

1. ✓ **G1 Today** — `core/curriculum.ts`, `core/today.ts`, Home for a returning player, the kept
   plan, the length.
2. ✓ **G1b Where you are** — the section on Progress.

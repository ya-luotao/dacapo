# dacapo — Today specification (what to practise next)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply — in particular **the next step is suggested, never forced**: nothing
here locks a level, a piece or a page, and everything stays one click away as before.

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
  someone who went there on their own is not sent back to a lesson. Open only decides what Today
  and Where you are _propose_; no page reads it.
- Harmony's Progressions and Improvise, the metronome and free play have no levels and no record
  of how far one has got: they are never proposed.
- **The scale ladder**, for the next scale never played: the keys in the order C, G, F, D, A, E,
  B♭, E♭, B, A♭, F♯, D♭, each as three rungs: major, one octave, right hand; the same, left hand;
  major, two octaves, both hands. Once the lesson on minor keys (9) is ticked, each major key's
  three rungs are followed by its relative harmonic minor in the same three. A rung is an
  exercise key (`major:C:1:right`, `harmonicMinor:A:2:both`; a test holds every rung to
  `parseExerciseKey`), and is _played_ once it has a recorded run. (Arpeggios, contrary motion and
  technique are the player's choice.)
- **The next piece**, when none is in hand: of the built-in pieces written for two hands that have
  no session at all, the first by grade and then by the library's order, no more than one grade
  above the highest grade of a built-in piece played to its end; Initial only, when none has been.
  When no piece is left within that, there is no next piece (the library is the player's to choose
  from). Lead sheets and imported pieces are not proposed.

## Today's plan (`core/today.ts`, pure)

`todayPlan(records, { today, minutes, lessonsDone, timeZone })` returns the steps, and
`planProgress(plan, records)` says which are done.

- **The plan is made from the records before today began** (the first minute of today on the
  player's calendar), and **ticked from today's records**. So it does not change as it is played:
  a level mastered at ten o'clock is still the step it was at nine, now ticked.
- **Made once a day, and kept.** The first time Home is opened on a day, the plan is made and kept
  in the browser (`dacapo.today`: the day, the length, the steps, and the lessons ticked at that
  moment); for the rest of the day Home shows the kept plan, so records arriving from another
  device do not reshuffle it, and a lesson ticked today (a tick has no time) stays the step it
  was. Changing the length makes the plan again, from the records before today and the lessons
  kept. It is per device and not synced: two devices may show two plans, each of them a good one.
- **Steps are tasks where a task fits.** A scale, a level and the lesson are an assignment's
  `ScaleTask` (at any tempo, one run), `LevelTask` (one session) and `LessonTask`
  (`core/assignmentRecords.ts`) with today as their window: `taskProgress` ticks them, and Home
  names and starts them as it does an assignment's tasks. A piece step is a step of its own (a
  `PieceTask` wants bars, hands, a tempo and the steps of a pass; the piece in hand is opened as it
  was left, and five minutes on it count).
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
  not been played to its end (`isRunToTheEnd`), built-in or imported. Its step opens the piece as
  it was left. Done: a run to its end today, or at least five minutes on it today. Without a piece
  in hand, and when Pieces is open: **the next piece** (above), done the same way.
- **New.** A _level_ step is the suggested level (the family's own rule: its first level not
  mastered) of an open family that is not mastered throughout. Of those families, the one whose
  last session is longest ago comes first, one never practised before all others, equals in the
  order the pages list them (`LEVEL_FAMILIES`); so the families take turns from day to day
  without a rota. Done: a session of that level played to its end today (a level task's rule in
  ASSIGNMENTS.md). **The lesson** is the first of the fifteen not ticked. In the 10-minute plan it
  takes the level's place while fewer than seven lessons are ticked (the first weeks belong to the
  lessons) and is left out after; the longer plans have it beside the levels. Done: ticked (it
  was not when the plan was made).
- **Play through**: the pieces due for review (PIECES.md, P6; those taken out of review are not),
  the longest overdue first. Done: a run to the end today.
- **Order.** Warm-up, work, new (the lesson, then the levels), play through: lesson 14's session.
- **Nothing to propose** (a part with no candidate) leaves the part out. A plan with no step at
  all says so: "Nothing is waiting today. Play what you like." with the way to Play.
- **An assignment comes first.** While an assignment for me is current and has open tasks, Home
  shows it as today (as T1 built it) and Today's steps are not shown: a teacher's plan is not set
  beside one the app made up. Once its tasks are met, or without one, Today is shown.

## Home

- **A returning player** (a session stored, or a lesson ticked) gets Today in place of the hero
  and of the blocks "Your practice" and "Due for review", which it takes in:
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
  through; the lesson's text is in two languages, so the names are new strings in all five, with
  the lesson's own words in English and Simplified Chinese).
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
returning). Nothing is synced or exported for this, and `SYNC_SCHEMA` stays.

## Milestones

1. **G1 Today** — `core/curriculum.ts`, `core/today.ts`, Home for a returning player, the kept
   plan, the length.
2. **G1b Where you are** — the section on Progress.

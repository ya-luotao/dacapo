# dacapo — Assignments specification (teacher and student)

Status: T1 (assignments, their links and files, the checklist, starting a task, Home) is built;
T2 (reports) is next. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply — in particular **no backend is required**: nothing here goes through
the sync service, and nothing leaves a device unless its owner shares it.

Goal: a teacher sets a week's practice — pieces with bars, hands, mode and tempo; scales; reading
and ear levels; lessons to read; minutes a day — and the student sees it as a checklist that ticks
itself from what they actually play. At the next lesson the student sends back a report of how it
went. Anyone can be the teacher: a piano teacher, a parent, or a learner setting their own week.

## An assignment

- **Made** on a new page, **Assignments** (`#/assignments`, reached from Progress and the More
  menu): a title, a note, a start date and a due date, and **tasks**:
  - _Piece_: a built-in piece, or an imported one (see "Sharing"), with bars (A–B), hands, mode
    (wait, rhythm, memory), a target tempo (% of the score's) and a goal: a number of
    runs to the end, or "N runs with at least X % of notes right / in time".
  - _Scale_ or technique exercise (SCALES.md): the exercise, free or with the click at a tempo,
    and a number of runs.
  - _Reading_, _theory_ or _ear_ level: a number of sessions, or mastery.
  - _Lesson_: read it (the lesson's tick).
  - _Minutes_: practise at least N minutes on at least D days.
- Stored on the device that made it (a new `assignments` store, exported, synced as a collection
  whose later copy wins by `updatedAt`, like pieces), listed as **Set by me**.

## Sharing, without a server

- **A link.** The assignment is serialized (canonical JSON), deflated (`fflate`, already a
  dependency) and base64url-encoded into the fragment of a link:
  `https://playdacapo.com/#/assignments/open/<data>`. The fragment never reaches a server. A link
  holds only what fits in about 8 KB (hundreds of tasks); it never holds a MusicXML file.
- **A file.** When a task names an imported piece, the assignment is shared as a file instead
  (`.dacapo-assignment.json`, the same content plus the pieces' MusicXML), through the share sheet
  or a download.
- **Opening** a link or file shows the assignment read-only with its teacher's name (typed by the
  teacher, never an account), and **Add to my assignments**. Imported pieces in a file are added
  to the student's pieces (a duplicate by checksum is not added twice). The student's copy is
  listed as **For me**; editing it is not possible (the teacher sends a new one).

## The checklist

- Each task's progress is computed from the student's own records between the start and the due
  date (`core/assignments.ts`, pure): runs of the piece with the task's hands and bars (a run
  counts when its loop, or its span, covers the task's bars), at or above the tempo, and their
  figures against the goal; scale runs of the exercise; sessions and mastery of the level; the
  lesson's tick; minutes per day from the log.
- Shown as a checklist with each task's figure ("2 of 3 runs at 90 % in time"), a tick when met,
  and a button that starts the task with its settings (the piece page with bars, hands, mode and
  tempo set; the Scales page with the exercise; the level on Read or Ear). Home shows the current
  assignment's open tasks.

## The report

- **Send a report** turns the student's checklist into a report: per task the figure, the goal,
  met or not, the best and the last run's figures, and the minutes per day; plus an optional note
  from the student. Only figures, never raw records or anything outside the assignment.
- Shared the same way as an assignment (a link or a file). The teacher opens it next to the
  assignment it answers (matched by the assignment's id) and can keep it (listed under the
  assignment), or just read it.

## Privacy

Nothing is sent anywhere by the app. A link or a file contains what its owner chose to share; a
report contains only the figures listed above. The teacher's name is whatever they type.

## Clarifications (decided during T1/T2)

- **One record, two lists.** An assignment is stored once, with `made` (set here: it can be
  edited and shared, and is listed under **Set by me**) and `following` (listed under **For me**:
  its checklist is worked out from the records here). A learner setting their own week ticks "I
  will practise this myself" and has both; a teacher opening their own link is offered the same.
  Removing an assignment from For me deletes the student's copy; the teacher's stays with the
  teacher.
- **Tasks** (`core/assignmentRecords.ts`). Each has an id of its own within the assignment. A
  _piece_ task names the piece (its id, its title and composer as the teacher saw them, and the
  checksum of its notes), the bars (written measures, with their printed numbers; none: the whole
  piece), hands, mode, tempo (one the piece page offers: 40–200 % in tens), a number of runs, and
  optionally "at least X % of the notes right" or, in rhythm mode, "in time" (50–100 %). A _scale_
  task names the exercise by its key, free or with the click (a tempo and the notes to the beat).
  A _level_ task names a family and a level: Read's notes, intervals, key signatures, chords,
  rhythm and sight-reading; Ear's intervals, chords, melodies, cadences and rhythm; Harmony's
  chord symbols; with a number of sessions, or mastery. Harmony's progressions and Improvise have
  no levels and are not tasks. An assignment has at most 100 tasks, a title of 120 characters, a
  note of 2,000, a name of 80, a window of a year, and 24 KB serialized: some seventy pieces, and
  small enough that its report, which carries every task with its figures, always fits the 64 KB
  a synced record may have (a report may be 60 KB). So the size, not the link's 8 KB, is what
  limits an assignment; a link is refused only for one that barely compresses.
- **A run of a piece is one pass through the task's bars**, with the task's hands and mode, at
  its tempo or faster, in a session begun in the window. The task keeps how many steps one pass
  takes with its hands (`pass`, the repeats played and skipped, worked out from the score when the
  task is made). Of each such session whose loop is the task's bars or takes them in (or which had
  no loop), the step records in the task's bars are counted and divided by that number: three
  times round a loop are three runs, a run through the whole piece is one for any of its bars, a
  loop stopped halfway is none, and a task for the whole piece wants a run without a loop from its
  first bar. Each run's figures are its own steps': **notes right** is the notes played in their
  window over the notes due (rhythm mode), or one minus the wrong notes per step, never below
  zero (wait and memory mode); **in time** is rhythm mode's notes within ±50 ms over the notes
  due. A goal is met by a share that rounds to its whole percent or more. Where a session's step
  records are not on the device, or were made on other notes (another checksum), the session
  counts as one run if it was played to its end, with the session's own figures. The **best** run
  is the one with the highest share (of what the goal measures; notes right without a goal), the
  latest of equals; the **last** is the latest.
- **Other keys, and a left hand made from the chord symbols.** A run counts only in the piece's
  written key: a run moved to another key (HARMONY.md, H4) is practice at transposing, as it is
  for the review schedule, and a task's button opens the piece in its written key. A piece task
  may name a lead sheet (H3). It names no left hand: its button leaves the left hand the player
  has chosen for the piece, and on a lead sheet the editor offers the left hand and both although
  nothing is written for them. A run with a left hand made from the symbols was played on other
  notes than the written ones (its records have another checksum for each pattern). For a task
  for the right hand that changes nothing, the melody being as written: its passes are counted
  from the step records as for any piece. For the left hand or both, the steps a pass takes
  depend on the pattern, so such a run counts as one when it was played to its end, however often
  a loop went round (the editor says so when it applies). A task for the left hand of a lead sheet
  is met only with a left hand made from the symbols, which is what a lead sheet opens with: with
  the left hand as written there is nothing to play, and the page practises the right hand.
- **The same piece** is the one with the task's id, or any piece on the device with the same
  notes (`pieceChecksum`: every note's onset, key, length and hand). So an imported piece is found
  whatever id it has on the student's device, and a file's piece that is already there (the same
  notes, a built-in piece included) is not added again. A piece added from a file gets an id of
  its own, as any import does.
- **A scale task** counts the recorded runs of the exercise (those that pass the Scales page's
  own check of being a scale run) whose first key fell in the window. Free: every run counts,
  clicked or not. With the click: runs with the same notes to the beat, at the tempo or faster.
  The best run is the most even one (the lowest timing spread).
- **A level task** counts sessions of the level that were played to their end (every card,
  exercise, bar or fragment planned), begun in the window, whatever their length. **Mastery** is
  the level's own, by the rules of its page, judged on everything answered up to the end of the
  due day, the answers from before the start among them: mastery is a state, not a count.
- **A lesson task** is met by the lesson's tick on the device. The tick has no date and is not
  synced (LEARN.md), so it counts whenever it was earned, and on another device the lesson reads
  as not read until it is finished there.
- **Minutes** are the practice log's: every kind of session, by the day it began, in whole
  minutes.
- **The window** is from the first minute of the start day to the last of the due day, on the
  calendar of whoever practises.
- **The link** (`core/assignmentShare.ts`). The data in `#/assignments/open/<data>` is base64url
  of one byte for the format's version (1) and then the JSON `{"assignment": …}` (or
  `{"report": …}`), its keys in sorted order, deflated (raw deflate, fflate). At most 8,192 bytes
  of data (about 11,000 characters); what does not fit goes as a file. The link is made with the
  address of the page it is made on (so a fork's or a local build's links open that build), and
  with `https://playdacapo.com/` in the Apple app, whose own address opens nowhere else. A link
  tapped on a phone opens the browser, not the app, so the Assignments page also has **Open a link
  or a file**: a field to paste the link into, and a file chooser.
- **Reading a link or a file trusts nothing.** The data's length is checked before it is decoded,
  inflating stops at 64 KB (more is refused, never read), and what comes out is checked field by
  field: types, bounds, counts, string lengths, dates the calendar has, each task's values against
  what the app has (the exercise key, the family's levels, the lesson, the tempo). Only known
  fields are kept. A task this version cannot read (a kind added later, or a known kind naming
  something this version does not have) does not refuse the rest: it is kept as it came, up to
  2 KB, as `{ kind: 'unknown', id, raw }`, shown as "a task this version of dacapo does not
  know", never met, and read again from `raw` by a version that knows it. What is refused is
  refused in a sentence: not one of ours or damaged, too large, made by a later version, or not a
  valid assignment.
- **The file** is `<title>.dacapo-assignment.json`: `{ format: 'dacapo-assignment', version: 1,
assignment, pieces }`, each piece as importing it kept it (title, composer, file name, hands,
  MusicXML), checked like an imported piece's record; at most 20, and only those a task names.
  An assignment that names an imported piece has no link, only the file; the page says why. A
  piece that is no longer among the teacher's pieces cannot travel, and the page says which.
- **A new version.** An assignment carries its own `updatedAt`. Editing one that was shared
  changes nothing on the student's device: the teacher sends the link (or file) again, and the
  student's page offers **Update my copy** when what is opened is later than what is stored, says
  so when it is the same, and keeps the stored one when it is the later.
- **Storage.** Database version 8 adds the store `assignments`, keyed by id, for assignments and
  for kept reports (`type`). The later copy wins by the record's `updatedAt`, which every change
  made on a device sets later than the copy it changes; of two changed at the same moment their
  text decides, as for a piece. **Deleting** leaves the record in place with `deleted: true` and
  nothing else of it, rather than a deletion kept apart as for a piece: the deletion then syncs
  as one more change, and the same link can be added again later (a later copy than its
  deletion). The collection `assignments` syncs these records as they are (`SYNC_SCHEMA` 19; 18
  is H4's). The export file is format 9, with the list `assignments` (deleted ones left out);
  importing adds the ones whose id is not stored (one deleted here is stored still, and is not
  added again) and lists invalid ones like any other record.
- **Starting a task.** A practice page can be opened with settings after a `?` in its route:
  `#/pieces/<id>?bars=5-8&hands=left&mode=rhythm&tempo=80` (bars by their place in the score),
  `#/scales?exercise=major:D:2:both&click=72x4` (or `click=off`), `#/read?family=notes&level=L3`,
  `#/ear?…`, `#/harmony?…` (`ui/startParams.ts`). The page reads them once, when it opens, in
  place of what it remembers, leaves what it cannot use as it was, and stores nothing until a
  choice is changed. The router keeps the `?…` inside the fragment (`ui/hashRoute.ts`). A lesson
  opens at its page; minutes have no button.
- **Home** shows the current assignment: of those for me that today falls in, the one due
  soonest, with up to four of its open tasks, each a link that starts it, and how many more
  there are. It is loaded only when there is one (the checklist takes the rules of every
  practice), and then with the app, so it does without the exercises' rules (`core/scales.ts`,
  with Hanon's plates): it names a scale task from its exercise key alone — the name, the octaves
  of a scale or an arpeggio, the hands — where the Assignments pages name it by the rules
  (`ui/assignments/taskFormat.ts` and `format.ts`; a test holds the start to this).
- **Navigation.** Assignments is the first item to move into More when the header is narrow, and
  the Progress page links to it under its title.
- **Code.** `core/assignmentRecords.ts` has the records (and what the app needs of them at
  startup), `core/assignments.ts` the checklist, `core/assignmentShare.ts` the link, the file and
  the reading of both; the last two are loaded only when an assignment is looked at.
- **Privacy.** The app sends nothing: the link is put together on the device and shown, copied
  when Copy link is pressed; the file is saved by the browser (in the Apple app, handed to the
  share sheet or the save panel). Whoever shares it chooses where it goes. Sharing never goes
  through the sync service; signed in, a user's own assignments sync between their own devices
  like their other records, and reach no one else.

## Milestones

1. ✓ **T1 Assignments** — the page, making and editing, the `assignments` store, links and files,
   opening, the checklist, starting a task, Home.
2. **T2 Reports** — the report, sharing it, opening it next to its assignment.

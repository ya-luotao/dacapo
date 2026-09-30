# dacapo — Assignments specification (teacher and student)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
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
    (wait, rhythm, memory when built), a target tempo (% of the score's) and a goal: a number of
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

## Milestones

1. **T1 Assignments** — the page, making and editing, the `assignments` store, links and files,
   opening, the checklist, starting a task, Home.
2. **T2 Reports** — the report, sharing it, opening it next to its assignment.

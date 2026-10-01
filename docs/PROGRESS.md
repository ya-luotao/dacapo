# dacapo — Progress over time specification

Status: Q1 is built (the section "How you are doing" on Progress: nine practices' weekly figures
over 26 weeks, each compared in words, with table views). This extends [MVP.md](MVP.md) and the
later specifications; their principles and fixed decisions still apply (measure don't guess, local
data, English of record, every UI language, no backend).

Goal: the Progress page shows how much you practise (minutes, the streak, the year of weeks) and
where you are weak today (the note heatmap, and with E4 the ear and theory tables). Before Q1 it did
not show whether you are **getting better**: reading faster, hearing more surely, playing more in time,
more evenly. Every figure needed is already in the stored records; this page draws them over
weeks.

## Trends (Q1)

A section **How you are doing** on the Progress page, above the log, with one small chart per
practice that has enough records, each a line of weekly values over the last 26 weeks (a week is
the owner's week, as the year grid has it) and a sentence comparing the last four weeks with the
four before:

| Practice       | Weekly value                                                                                                         | Better is |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| Reading notes  | median reaction time of correct, un-hinted, timely answers (`attempts`)                                              | lower     |
| Reading theory | share right, over the week's theory answers (E3)                                                                     | higher    |
| Ear            | share right without a replay, over the week's ear answers                                                            | higher    |
| In time        | median distance from the beat of notes played in rhythm mode (pieces), rhythm reading (R1) and scales with the click | lower     |
| Scales         | median timing spread as a share of the note length, over the week's runs                                             | lower     |
| Pieces         | share of notes right on the first try (wait mode), over the week's runs                                              | higher    |

- A week counts when it has at least 20 answers (reading, theory, ear), 50 timed notes (in time),
  3 runs (scales, pieces). A chart needs 3 counted weeks; with fewer it is left out and a line says
  what would bring it in ("Play a few more scales this week to see a trend").
- The sentence: "Faster than a month ago: 1.4 s against 1.7 s" / "About the same" (a time or a
  spread within 5 % of the earlier figure, a share within 2 percentage points) /
  "Slower than a month ago", in words, never colour alone. Levels differ in difficulty, so a figure
  that mixes levels is shown with the share of each level under the chart (reading and ear), and
  the comparison is made within the levels both periods have.
- Computed in `core/trends.ts` (pure, tested) from records already loaded or loaded on demand
  (piece steps and scale runs are loaded for the weeks shown only). No new records.
- Charts follow the app's chart rules (the scales' trend chart): a table view, units, light and
  dark, readable in every language.

## Clarifications (decided during Q1)

- **Where.** The section comes right above the log of sessions ("Sessions"), after "Ear training
  and theory": the page goes from how much you practise to where you are weak today to whether you
  are getting better, and then the sessions themselves.
- **Weeks.** The owner's week as the year grid has it: weeks start on the language's first day
  (`FIRST_DAY`: Monday in Simplified Chinese, Sunday otherwise), records count for the local date
  they were made on. The 26 weeks end with the week under way, which is drawn like the others once
  it reaches the minimum.
- **What counts in a week.** Reading notes counts the answers its figure is over (right, without
  the hint, not timed out), so a week of mostly wrong answers is not a median of three; theory,
  ear, rhythm by ear and chord symbols count every answer; in time counts the notes played (a
  missed note has no distance from the beat); sight-reading, scales and pieces count runs (3 a
  week). Wait mode keeps no number of keys per
  step, only its wrong notes, so **Pieces** is the share of _steps_ (a note or a chord) played
  without a wrong note, over the week's wait-mode runs.
- **In time** pools four sources: the notes of rhythm-mode piece runs (their step records), the
  onsets of Read's rhythm lines (R1), the onsets of the cells of rhythm dictation tapped back (R2:
  the same click, the same latency taken off, judged by the same rule as a line on Read, so they
  pool consistently; a bar chosen has no timing), and the notes of scale runs played with the
  click, technique among them, whose timing is recomputed from the run's keys and grid exactly as
  the Scales page computes it after the run. A distance is the absolute deviation. Sight-reading
  stays out: its session keeps each run's median distance, not each note's, and a median of medians
  would not pool with the rest; its own chart counts the notes in time.
- **Scales** uses the spread share each run's headline keeps on its session (the weaker hand's,
  as the scales' list ranks them; figures of another analysis version are left out), so no raw
  run is read for it. Only the scale and arpeggio types count (major, the minors, chromatic, the
  arpeggios): technique (five-finger patterns, Hanon, block and broken chords, sevenths, repeated
  notes, trills, thirds, octaves) is left out, so the weekly median stays comparable from week to
  week whatever was practised alongside; a technique chart is not needed now. The figure is shown
  to a tenth of a percent, or a change of 5 % would not show.
- **Loading.** Only the piece runs and the clicked scale sessions of the 26 weeks are read, by
  session (`sessionPieceSteps`, `sessionScaleRuns`), reduced at once to the figures and not kept;
  a run that grows or an import reads that session again. While they load, In time and Pieces wait
  under a line saying so.
- **The comparison.** The last four weeks are the week under way and the three before (shaded on
  the chart); the four before are the four weeks before those. Each period needs a counted week,
  and its figure is pooled over all its records (not an average of weekly figures). "About the
  same" is, for a time or a spread (reading notes, in time, scales), a change within 5 % of the
  earlier figure; for a share (sight-reading, theory, ear, rhythm by ear, chord symbols, pieces), a
  change within 2 percentage points: near 90 %, 5 % of the figure is 4 or 5 points, a real change
  (87 % → 91 % is better, 87 % → 89 % about the same). The sentence gives both figures in the practice's unit, e.g. "Faster than a month ago:
  1.5 s against 1.7 s", "More even than a month ago: 6.2% against 8.5%"; colour is not used for it.
- **Levels.** Reading notes, sight-reading, theory, ear, rhythm by ear and chord symbols have
  levels (and theory and ear several families, whose level ids are distinct). A level is compared
  when each period has at least 5 answers of it (sight-reading: 2 fragments), and the shared levels
  together at least a week's minimum in each; each level's figure is weighted by its count in both
  periods, so moving from L2 to L4 does not read as slower reading. Under the sentence: which levels were compared and which were left out. With no
  shared level: "No level was practised enough in both …". Under the chart, the share of each level
  over the counted weeks, as a bar split by level and the same in words; the table lists each
  week's answers per level.
- **Not enough yet.** A practice with records in the 26 weeks but fewer than 3 counted weeks gets a
  line: how many weeks it has, what a week needs, and what this week has so far. A practice not
  practised in those weeks is not named.
- **Charts.** As the scales' trend chart: one series, so no legend; the axis need not start at
  zero (three round ticks around the counted weeks, at least a set span apart, shares capped at
  100 %), hover for a week's figure and count, and a table of every week with records (a week
  under the minimum shows its figure marked "too few to count"). Two or three to a row on a wide
  screen, one on a phone.
- **More practices.** Three charts beyond the table's six, in the order reading, ear, playing:
  - **Sight-reading** (R3), after reading notes: the share of notes right and in time over each
    fragment's first run in time, as its mastery counts (a fragment only looked at in wait mode
    says nothing about reading in time; a second run is no longer at first sight), pooled over the
    week's notes, counted in those runs, with levels F1–F8.
  - **Rhythm by ear** (R2, dictation), after ear: the share right without "Hear again" of its
    answers, a cell tapped back or a bar chosen alike (as its mastery), with levels.
  - **Chord symbols** on Harmony: the share played right (the notes shown or not, as theory
    cards), by level.

  Harmony's progressions are practised as pieces (`prog:` ids), so their runs are in Pieces and In
  time already.

## Milestones

1. ✓ **Q1 Trends** — the section, the charts, the comparisons, the table views.

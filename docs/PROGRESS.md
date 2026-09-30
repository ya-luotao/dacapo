# dacapo — Progress over time specification

Status: planned (after E4 of [EAR.md](EAR.md)). This extends [MVP.md](MVP.md) and the later
specifications; their principles and fixed decisions still apply (measure don't guess, local data,
English of record, every UI language, no backend).

Goal: the Progress page shows how much you practise (minutes, the streak, the year of weeks) and
where you are weak today (the note heatmap, and with E4 the ear and theory tables). It does not yet
show whether you are **getting better**: reading faster, hearing more surely, playing more in time,
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
- The sentence: "Faster than a month ago: 1.4 s against 1.7 s" / "About the same" (within 5 %) /
  "Slower than a month ago", in words, never colour alone. Levels differ in difficulty, so a figure
  that mixes levels is shown with the share of each level under the chart (reading and ear), and
  the comparison is made within the levels both periods have.
- Computed in `core/trends.ts` (pure, tested) from records already loaded or loaded on demand
  (piece steps and scale runs are loaded for the weeks shown only). No new records.
- Charts follow the app's chart rules (the scales' trend chart): a table view, units, light and
  dark, readable in every language.

## Milestones

1. **Q1 Trends** — the section, the six charts, the comparisons, the table views.

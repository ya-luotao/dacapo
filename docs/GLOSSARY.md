# dacapo — Glossary specification (music theory terms)

Status: G1 built (the list, the pages in the app and on the site, the intervals written). G2–G4
are the other groups' texts and figures.

Goal: the words of theory a beginner meets in a score or a lesson, each explained in a few lines
with an example to hear, in the app and as pages a search engine can find ("what is a perfect
fifth", "D.C. al Fine meaning", "五度圈"). The lessons teach in order; the glossary is where a
single word is looked up. It extends [LEARN.md](LEARN.md) and [SITE.md](SITE.md); their rules
hold (written, not translated; figures drawn in code; every figure drawn without a browser).

## The terms

Four groups, 63 terms, listed with their names, other names, one-line definitions and links in
`src/learn/terms.ts` (`TERMS`, `TERM_GROUPS`):

| Group                       | Terms                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intervals                   | interval, half and whole step, enharmonic notes, interval quality, each interval from the minor second to the octave, inversion, compound intervals, consonance and dissonance                    |
| Keys and key signatures     | key, key signature, the order of sharps and flats, the circle of fifths, relative and parallel keys, scale degrees, transposition, modulation, closely related keys                               |
| Finding your way in a score | barline, repeat sign, first and second endings, D.C., D.S., Fine, coda, 8va                                                                                                                       |
| Tempo and expression        | tempo, metronome mark, the nine tempo marks of the metronome, rit., accel., a tempo, rubato, fermata, dynamics, cresc., dim., legato, staccato, dolce, cantabile, espressivo, molto/poco/più/meno |

- **Languages**: the lessons' three, English, Simplified and Taiwan's Chinese; Japanese and
  Korean read the English, as they read the lessons. The names are the app's own where it has
  them: the Ear page's interval names (纯五度 / 純五度), the metronome's tempo marks (柔板 / 慢板),
  TRANSLATING.md's table for zh-TW (反覆, 一房, 斷奏, 彈性速度, 同音異名).
- **A term** has a slug (never a lesson's), its group, its name, the names and signs it is also
  searched by, a definition of one sentence (the entry's first line and its page's description),
  the lessons that teach it and the terms beside it. A tempo mark's range is the metronome's
  (`core/tempoNames.ts`), written into its definition from there.
- **Its text** is a few short paragraphs and one or two plates, in
  `src/ui/learn/terms/<group>.<language>.tsx`: a record of the group's terms by slug. No
  sentence repeats the definition; nothing closes with a summary.

## In the app

- `#/learn/terms`: the terms by group, each with its definition, in framed lists. The Learn page
  lists it after Inside the piano, with the number of terms.
- `#/learn/terms/<slug>`: the term's name, its other names, its definition, its text, then "See
  also" and "In the lessons". Its group's texts load when it is opened (`terms/index.ts`); a
  term not yet written shows its definition and links alone.
- The routes come before a lesson's in `App.tsx`, which would take `terms` for a lesson.

## On the site

- `/learn/terms/` and `/learn/terms/<slug>` in English, `/zh-cn/…` and `/zh-tw/…`, beside the
  lessons; `/ja/` and `/ko/` lead to the English, as for the lessons. Under `learn/`, which is
  already a reserved username, so no new name is reserved.
- Titles "{term} · music theory glossary · dacapo" in each language; the definition is the
  description. Structured data: `DefinedTerm` (with `alternateName`, `inDefinedTermSet`) and
  `DefinedTermSet` for the list, the trail dacapo › Lessons › Glossary › term.
- The sitemap and `llms.txt` (its section Glossary) list them; the Apple app leaves them out
  (`--exclude /learn/terms/`).

## Figures

Drawn in code, like the lessons' (no picture files: a file under `learn/` would be stored for
offline).

- **Intervals** (`intervalFigures.tsx`): `IntervalPair`, two notes written one after the other and
  then together, heard the same way, over the keyboard with each half step from the lower note
  counted on its key; `EnharmonicPair`, two names on the staff and one key; `IntervalTable`, the
  intervals to the octave from middle C, each example heard when clicked. Half steps use the
  lessons' `StepExplorer`.
- G2–G4 add a circle of fifths, the sharps and flats in order, a strip of bars showing the order a
  score with repeats and jumps is played in (`core/roadmap.ts`), and the tempo marks on the
  metronome's scale, each heard at its tempo.

## Milestones

1. ✓ **G1** The list, the pages in the app and on the site, the intervals.
2. **G2** Keys and key signatures.
3. **G3** Finding your way in a score.
4. **G4** Tempo and expression.

## Clarifications

- The dynamics term is `dynamic-marks`: `dynamics` is lesson 10's slug.

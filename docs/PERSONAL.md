# dacapo — Personal settings specification (your keyboard, your goal, your note names, your week)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
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

## Milestones

1. **G6c The instrument's keys**
2. **G6d The daily goal**
3. **G6e Note names**
4. **G6f Your week**

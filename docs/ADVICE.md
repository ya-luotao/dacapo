# dacapo — Advice specification (what to work on next)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply — **measure, don't guess** above all: every sentence of advice rests
on a figure the summary already shows, and says which.

Goal: a summary says what happened ("You speed up in bars 5–8", "Bar 7: 2.4 s per step, 3 wrong")
and stops there. A teacher would go on: _so loop those bars_, _so take it at 60 %_, _that is clean:
now 80 %_. This adds that one sentence to each summary, with the button that does it; a tempo
ladder for pieces; what a run did to the piece's review; a way to practise just what was missed;
and a word when a level is mastered. It is rule-based: no model, nothing sent anywhere.

## Principles

- **One piece of advice, the most telling.** A summary gets at most one sentence, chosen by a
  fixed order of rules; the figures, lists and charts stay as they are. When no rule applies there
  is no sentence: nothing is said for the sake of saying something.
- **It names its figure and its action.** "Under 80 % in time at 90 %: take it at 80 % first."
  The action is a button beside it that sets the page up (the tempo, the hands, the loop, the
  mode) and starts; the buttons a summary already has (Loop bar 7) are the same buttons, now with
  their reason.
- **No new thresholds.** The rules use the lines the app already draws: the review's
  (`CLEAN_NOTES`: at most 1 wrong in 50; `POOR_NOTES`: more than 1 in 10; `IN_TIME_SHARE`: 80 %
  within ±50 ms; `SLOW_BAR`: a bar at twice the run's median step), rhythm mode's `TENDENCY_MS`,
  a level's mastery, and the Scales page's own verdict. Nothing is advised from loudness, pedal
  or articulation figures while their thresholds are provisional (EXPRESSION.md, SCALES.md S1).
- **Plain words, no praise and no blame**, as the summaries already speak; in every language.
- `core/advice.ts`, pure: each summary's figures in, one `Advice` out (a rule's name, the values
  its sentence takes, and the action as data) or null. The UI turns it into words and a button.

## Pieces

### The tempo ladder (`core/tempoLadder.ts`)

- Rhythm mode is played at a percent of the score's tempo (40–200 in tens). For a piece and hands,
  **the tempo reached** is the highest tempo of a run to the end (`isRunToTheEnd`'s rule, for those
  hands: a run with one hand counts for that hand) in rhythm mode that the review would grade
  _better_: clean and in time (`gradeRun`). **The next rung** is ten more, up to 100 % (the score's
  tempo is the goal; beyond it is the player's own choice and is never advised). Without such a
  run, the ladder starts at 60 % (lesson 14's ladder), or at the tempo of the last rhythm run less
  ten if that is lower.
- Shown: on the piece's card and page, with its progress ("Both hands: clean at 70 %"); in the
  tempo control, the rung reached is marked; in the advice below.
- Worked out from the stored sessions; nothing new is stored. Runs in another key (H4), with a
  loop, or with a left hand made from chord symbols count for nothing here, as for the review.

### After a run in wait or memory mode

In this order; the first that applies:

1. **Many wrong notes** (more than 1 in 10 steps), with both hands: "Many wrong notes ({wrong} in
   {steps}): one hand at a time first." — **Right hand** (the hand with more wrong notes when the
   step records tell; the right otherwise).
2. **Many wrong notes**, one hand: "…: a few bars at a time." — **Loop** the bar with most wrong
   notes and the bar either side.
3. **A bar that held you up** (its mean step over twice the run's median; memory mode: the bar
   that needed most prompts): "Bar 7 took twice as long as the rest: loop it until it goes like
   the others." — **Loop bar 7** (the button the summary has).
4. **Clean and even**, a run to the end (what the review grades _better_): "Clean and even. Now in
   time: rhythm mode at {tempo} %." — **Rhythm mode at {tempo} %**, the ladder's next rung. In
   memory mode, when the stage is not the last: "…Now with more of the score hidden." — the next
   stage.

### After a run in rhythm mode

1. **Notes went missing** (missed and wrong over 1 in 10): "{n} of {notes} notes missed at
   {tempo} %: take it at {lower} %." — **Again at {lower} %** (twenty less, not under 40).
2. **Not in time** (under 80 % within ±50 ms): "{percent} % in time at {tempo} %: {lower} % first."
   — **Again at {lower} %** (ten less).
3. **A stretch that moved** (the summary's first drift that can be looped): "You speed up in bars
   5–8: loop them with the click." — **Loop bars 5–8** (the button the summary has).
4. **Always early or late** (the tendency beyond `TENDENCY_MS`, the run otherwise steady): when
   the latency was never calibrated, "{ms} ms late throughout: if it felt in time, the delay is
   the computer's — calibrate it." — **Calibrate**; when it was, "{ms} ms late throughout: place
   each note a little earlier, on the click rather than after it." (no button; early: likewise).
5. **Clean and in time** (the review's _better_), a run to the end: under 100 %, "Clean and in time
   at {tempo} %: next, {next} %." — **Again at {next} %**; at 100 % or more, "Clean and in time at
   the score's tempo." and, when the piece was not yet in review, the review line below.

### What the run did to the review

After a run to the end (PIECES.md, P6), one line under the advice, from the schedule before and
after it: "It is in review now and comes back tomorrow." · "Reviewed: it went well, so it comes
back in 7 days." · "Reviewed: it comes back in 4 days, as before." · "Reviewed: too many wrong
notes, so it comes back in 2 days." · (taken out of review: nothing).

## Scales and technique

The verdict of a run has up to three sentences, the most telling first. The first gets its
advice, by what it says:

| The verdict says                                   | Advice                                                                                            | Action                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Too many mistakes to measure                       | "Slower, until every note is right: evenness comes after."                                        | the click, 20 % under the run's tempo |
| A crossing comes late or early (thumb under, over) | "Loop around {key}, slowly, and move the thumb under while the finger before it plays."           | Loop around {key} (the button it has) |
| A note of each group comes late or early (pattern) | "Loop around {key}: the same finger each time."                                                   | Loop around {key}                     |
| Hesitated before {keys}                            | "Loop around {key} until it runs through."                                                        | Loop around {key}                     |
| Sped up / slowed down                              | "With the click at ♩ = {bpm}, {n} a beat: the tempo you started at."                              | the click at that tempo               |
| The hands apart (often, or at places)              | "Each hand alone, then together slowly."                                                          | the same exercise, right hand         |
| Before or after the click                          | as rhythm mode's tendency, with the calibration when it was never done                            | Calibrate                             |
| Even throughout (no problem found)                 | with the click: "Even at ♩ = {bpm}: next, ♩ = {bpm + 8}."; without: "Even. Next, with the click." | the click at that tempo               |

A trill's, a chord's and repeated notes' verdicts get no advice yet (their thresholds are
provisional).

## Cards (Read, Ear, Harmony)

- **Mastered, just now.** When the session's answers took the level from not mastered to
  mastered, the summary says so once ("Level 3 is mastered.") and **Next level** is the primary
  button, the one focused on arrival (it is **Again** otherwise, as before). After a family's last
  level, the next step is the family that TODAY.md's rules would put first (open, not mastered
  throughout; the same page's before another's): "Next: intervals on the staff."
- **Practise these.** When the session has missed or slow items (the lists the summary shows), a
  button **Practise these** starts a short session of just those items (at least three: the
  list is filled up with the level's weakest by the usual weights; ten cards, or twice the items
  when that is more). It is a session of the level like any other: its answers are kept and count
  for the level's figures and mastery. Offered where a session draws its items by weight: Read's
  notes, intervals, key signatures and chords; Ear's intervals and chords; Harmony's chord
  symbols; and Read's rhythm for its cells to work on.
- **From Progress.** The heatmap's weakest notes and each family's weakest items get the same
  button: it opens the level's page with those items (`?family=…&level=…&items=…`, as a task's
  button does; `ui/startParams.ts`).
- **A level too far.** When under 60 % of a session's answers were right and the level below is
  not mastered: "{percent} % right, and {below} is not mastered yet: that first." — **{below}**.

## Records, sync, export

Nothing new is stored: the ladder, the review line and the advice are worked out from the
sessions and their figures, and a session of chosen items is stored as a session of its level.
`SYNC_SCHEMA` and the export format stay.

## Milestones

1. **G2a Pieces** — `core/tempoLadder.ts`, `core/advice.ts` for wait, memory and rhythm runs, the
   review line, the ladder on the card and in the tempo control.
2. **G2b Scales** — the advice for a run's verdict.
3. **G2c Cards** — mastered just now, Practise these, the buttons on Progress, a level too far.

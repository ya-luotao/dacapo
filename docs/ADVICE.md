# dacapo — Advice specification (what to work on next)

Status: built. G2a (Pieces: the tempo ladder, the advice after a run, the review line), G2b
(Scales: the advice for a run's verdict) and G2c (Cards: mastered just now, Practise these, the
buttons on Progress, a level too far). This extends [MVP.md](MVP.md)
and the later specifications; their principles and fixed decisions still apply — **measure, don't guess** above all: every
sentence of advice rests on a figure the summary already shows, and says which.

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

## Clarifications (decided during G2a/G2b)

- **Read at once, from the run itself.** The summary reads the run as its records will have it:
  the recorder's own mapping (`recordedRun` in `ui/pieces/record.ts`) gives its session and step
  records before they are stored, and `afterRun` (`ui/pieces/advice.ts`) sets them among the
  piece's stored runs. So the advice, the ladder and the review line are there when the summary
  appears, they agree with what the card and the review will say, and nothing new is kept.
- **A run to the end, for those hands** (`core/review.ts`, `isWholeRun`): completed, without a
  loop, in the written key, through every bar its hands play. The review's `isRunToTheEnd` is
  that with hands that play every note. The ladder also leaves out a left hand made from the
  chord symbols (`countsForLadder`), which the review counts.
- **The ladder** (`core/tempoLadder.ts`). Its rungs are the tempo control's choices (40–200 % in
  tens, now in the core). The next rung is the first choice above the tempo reached, and none
  once that is 100 % or more. Before a clean run in time it starts at 60 %, or ten under the last
  rhythm run of the piece as written with those hands, ended or stopped, when that is lower, and
  not under 40 %. The advice reads the ladder with the run just played counted: after a clean run
  at 60 % of a piece already clean at 80 %, the next rung is 90 %.
- **Clean, with one hand of two.** The review counts wrong notes against the keys of the whole
  piece, both hands'. A run with one hand of two is counted against its own steps, as the review
  counts a run whose notes it does not know: a little stricter.
- **Many wrong notes** are counted against the run's steps, as the rule says, whatever the hands.
  "One hand at a time" is said only when the piece has notes for each hand: a lead sheet with its
  left hand as written is taken a few bars at a time, also with Both chosen. The step records
  keep no hand for a wrong note, so the hand to start with is told by the steps only one hand
  plays: a wrong note there is that hand's, and a step both hands play tells nothing. The left
  hand comes first only when it has more of them.
- **A few bars at a time** are the bar with most wrong notes (the earliest of equals) and the bar
  played before and after it, of the bars the run played. A run that played nothing outside them
  (a loop of three bars or fewer) is not told to cut down to what it is: the rules after it have
  their say.
- **A bar that held you up** is the slowest of the bars over the line (the first of the summary's
  list), and needs a run of more than one bar: a single bar has no rest to be slower than. In
  memory mode the bar that needed most prompts is named with them ("Bar 7 needed 3 prompts: loop
  it until it comes from memory."), since "twice as long" would not be true of it; a memory run
  without a prompt is read as a wait run. Its button is the summary's own "Loop bar 7": it is not
  shown twice.
- **Clean and even** in memory mode at the last stage advises rhythm mode, as after a wait run.
  When the ladder is climbed (the score's tempo is reached) nothing is advised.
- **Notes went missing** counts missed and extra notes, as the review does (extra notes are
  rhythm mode's wrong notes). The sentence names the extra ones when there are any: "21 of 62
  notes missed and 5 extra at 90%: take it at 70%." At the slowest tempo (40 %) there is nothing
  slower to take, so this rule and "not in time" do not apply there, and the rules after them
  have their say.
- **A stretch that moved** is the summary's own: the first stretch within one time round and in
  written order, and none when the tempo moved through the whole run. A stretch of one bar reads
  "loop it". The click is left as the player has set it.
- **Always early or late** is a tendency of 10 ms or more (under it the summary says "on the
  beat") in a run with no stretch reported. Never calibrated is what this browser has stored when
  the summary is shown. The calibration is offered for a run that was late only: no delay makes a
  note early, so an early run gets the plain sentence, calibrated or not.
- **Clean and in time** names the ladder's next rung. A clean run under the score's tempo of a
  piece that has reached it already is told nothing.
- **Runs not to the end.** A looped run, a run from a later bar and a rhythm run stopped early get
  the advice their figures give by every rule but the last, which wants a run to the end.
- **The review line** is for a run that set a date: the first run to the end, or the first on or
  after the date due. A run before the date counts only for the figures and gets no line, nor
  does one hand of two. It waits for the piece's other step records, which the other runs'
  grades need. An interval of one day reads "tomorrow".
- **The buttons.** Other hands, a loop or another stage in wait and memory mode start a new run,
  which begins at the first key as every run there does. In rhythm mode, and for "Rhythm mode at
  60%", the page is set up and then does what Start does: the count-in begins, or the calibration
  is offered first to a player it was never offered to. "Calibrate" opens the calibration, whose
  own button starts the run. A stage of a piece's plan ([PIECES.md](PIECES.md), "A piece's
  plan") is started the same way, with its bars, hands, mode and tempo set at once.
- **On the summaries.** After a wait or memory run the sentence stands beside the bars that held
  the run up (under them on a phone) with its button under it, and the summary's own buttons
  stay one row; "Saved…" moved under that row, so the buttons still show on a 1280 × 800 screen.
  After a rhythm run it stands under the verdict with its button beside it. "Again" steps down
  to an ordinary button only when the advice has a button.
- **The ladder shown.** On a card, after the steady bars, which name the hands last chosen
  ("right hand: 8 of 16 bars steady · clean at 70%"). On the piece's page it is the mark in the
  tempo control ("70% · clean", for the hands chosen): no line of its own, so the control row
  stays one row.
- **Scales: what each sentence says is data.** The summary builds the verdict's sentences as
  before, each with its kind (`ScaleFinding` in `core/advice.ts`), and `scaleAdvice` reads the
  kinds: the wording and the order of the sentences are unchanged.
- **Scales: the first sentence with a row.** The verdict says in a fixed order things the table
  has no row for: that the run stopped, that the notes kept to the click, that the hands kept
  together, how the keys were joined, the pedal, the loudness. These are passed over, and the
  advice is for the first sentence shown that names something to work on. Read to the letter,
  "the first" would leave the row for a tempo that moved out of reach, since how the keys were
  joined is said before it in every run with releases. A problem the verdict has no room to show
  (after its three sentences) is not advised on.
- **Scales: even** is said when no sentence of the whole verdict names a problem and the run was
  played to its end; with the click, when the verdict says the notes kept to it (too few notes in
  time to tell is not "even at ♩ = 60"). It is the verdict's finding, not a line drawn on the
  spread, whose bands wait for S1.
- **Scales: the place and the hands.** A crossing where the thumb passes under gets the sentence
  above; one where a finger crosses over, "…and bring the finger over while the thumb plays." The
  key named is the summary's own loop place (the note furthest off, or the first hesitation), and
  what a loop is stands under the sentence, where the loop's button was. "The hands apart" takes
  in a hand that comes ahead every time.
- **Scales: the click's tempo.** Notes a second become beats a minute at the notes to the beat
  the click has, or would have with the picker as it is. "Slower" is a fifth under the run's
  tempo, no faster than ♩ = 160, and without a button when that is under ♩ = 40 or the tempo
  could not be measured. "The tempo you started at" is the click's own in a run with the click,
  and is not said when the click cannot be set to it (outside ♩ = 40–160). "Next, ♩ = 68" stops
  at ♩ = 160.
- **Scales: the buttons.** A button that sets the click starts the run as Start would (the
  count-in, or the calibration offered first); "Right hand" at free tempo starts at the first
  key. Before or after the click reads as rhythm mode's tendency, with the calibration for a run
  that was late and never calibrated.
- **Words.** A tempo reads "60%", as the tempo control writes it. In the Apple apps the delay is
  "the device's" (`pieces.advice.late.calibrate.app`): they have no computer to speak of.

## Clarifications (decided during G2c)

- **One sentence, and Practise these beside it.** A summary of cards says one sentence at most:
  mastered just now, else a level too far. **Practise these** has no sentence; it is a button
  whenever the session left something to practise, beside the sentence's button too and never
  the primary one. The sentence's button leads the summary's row and is the one focused; without
  one that is **Again**, as before.
- **Mastered just now** is the family's own rule over the level's answers without the session's
  and with them (`sessionMastery`): Read's notes by their attempts, the theory cards, Read's rhythm, Ear's families,
  rhythm dictation and the chord symbols by their answers, sight-reading by its sessions. The
  sentence stands where the summary's "…is mastered. Try the next level whenever you are ready."
  stands, in its place for that summary; the next session of the level shows that line again, and
  **Again** first. A tune is learnt, not mastered: its summary is as it was.
- **Next level** is the button the summary always had, now first: it starts the next level and
  keeps it as the level picked (LEARN.md, G3).
- **After the last level** (`familyAfter`): of the families that are open and not mastered
  throughout, one of the same page before one of another, then the one longest left alone (one
  never practised before all), then the pages' order; never the family just finished, whatever
  its lower levels. The sentence names it as today's plan does ("Next: Read · Intervals.") and
  the button, with the same name, opens its page on the level it suggests. With no such family
  the sentence stands alone. Scales and Pieces are not families of cards and are not proposed
  here.
- **A level too far.** "Right" is the summary's own figure (cards; cells for Read's rhythm; cells
  tapped or bars chosen for rhythm dictation; melodies for Echo), and under 60 % means under:
  6 of 10 is not (`TOO_FAR_SHARE`). The level below is the one before it in its family. It is
  said of a session played to its end, or stopped with at least ten answers, the shortest
  session's length (`TOO_FAR_MIN_ANSWERS`): a session stopped after two cards says nothing of the
  level. The button is the level's name; it starts that level with the setup's settings and
  keeps it as the level picked. Sight-reading has no such figure, and a tune no level below:
  neither is told.
- **Practise these: something to practise.** The summary always lists its three slowest items,
  however fast they were, so the list alone offers nothing. The button is there when the session
  has a missed item, or an item that was slow in fact: its slowest timed answer not under the
  line the family's mastery draws for the median (`toPractise`: Read's notes 2 s,
  `MASTERY_MEDIAN_MS`; the theory cards 3 s, chords 4 s, `theoryMasteryMedianMs`; the chord
  symbols 3 s, `HARMONY_MASTERY_MEDIAN_MS`). An answer at the line is slow, as a median at it is
  not mastered. Ear's mastery draws no line for the time: its missed items alone. A session with
  nothing missed and every answer under the line has no button. Read's rhythm keeps its own
  list, the cells to work on (five at most).
- **Practise these: the items** are the missed ones, then those slow ones, each once. Fewer than
  three are filled up with the level's weakest by the weights its sessions draw by, the heaviest
  first and of equals the earlier in the level; Ear's intervals only in the directions the
  session had. The session is ten cards, or twice the items when that is more.
- **Practise these: the session** draws by the same weights within those items, never one twice
  in a row; a single item is asked again and again, and so is one key written on both staves. It
  takes the setup's settings (the hint, how a chord or an interval is answered); Ear's intervals
  are played in the directions the items have. For Read's rhythm it is four lines, the shortest
  session, in a meter the cells have: a line is built of those cells wherever one can stand, and
  of the level's others only where none can. Its record is a session's and an answer's like any
  other, so **Again** after it is the level as usual.
- **From Progress.** The button stands under the heatmap's weakest notes and under a family's
  weakest items where Practise these is offered: Ear's intervals and chords, Read's intervals,
  key signatures and chords, the chord symbols; not Echo, cadences, tunes or rhythm dictation.
  Its link names the level chosen in the section's filter when that level has any of the items,
  else the first level that has them all, else the first that has the first of them
  (`practiceStart`), and the items as they are stored, joined by commas
  (`#/read?family=notes&level=L2&items=B4@treble,G4@treble`).
- **On arrival** the page keeps the items the level has (it reads fifty at most), fills them up
  to three (Ear's intervals in the directions the items have), and starts the session as soon as
  the stored answers are in, with the settings it remembers. Nothing is stored for having come
  this way. With no item of the level left, or without a sound for Ear, the page opens on the
  level as a task's link does.
- **One implementation.** `ui/SummaryEnd.tsx` is the end of all seven summaries (the standing
  line, the sentence, the buttons), `ui/cardAdvice.ts` joins the rules to a page's records, and
  `core/practiceLevels.ts` says what each level draws from: one list for the summary's check,
  the link's and the fill-up.

## Milestones

1. ✓ **G2a Pieces** — `core/tempoLadder.ts`, `core/advice.ts` for wait, memory and rhythm runs, the
   review line, the ladder on the card and in the tempo control.
2. ✓ **G2b Scales** — the advice for a run's verdict.
3. ✓ **G2c Cards** — mastered just now, Practise these, the buttons on Progress, a level too far.

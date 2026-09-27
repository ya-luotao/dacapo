# dacapo — Scales specification

Status: planned (after Pieces). This extends [MVP.md](MVP.md) and [PIECES.md](PIECES.md); their
principles and fixed decisions still apply (staff first, measure don't guess, local data, English of
record, every UI language, 3-day dependency cooldown, no backend).

Goal: play scales and see, note by note, how even they are — in time, in loudness and in connection
— where the unevenness sits (a thumb crossing, the turn at the top, one hand against the other),
whether it is the same every time, and whether it gets better over the weeks.

## Why this is measurable

A MIDI keyboard reports every key's onset, release and velocity to the millisecond, which is enough
to measure what a teacher hears in a scale. Temporal evenness of scale playing measured this way is
an established method: Jabusch, Vauth and Altenmüller (2004, _Movement Disorders_ 19(2)) took the
standard deviation of inter-onset intervals of two-octave C major scales in sixteenths at ♩ = 120 on
a MIDI piano, and studies using the method put healthy professional pianists at about 8–9 ms. van
Vugt, Jabusch and Altenmüller (2012, _Frontiers in Psychology_ 3:495) fitted a straight line to note
rank against onset time and separated the mean deviation of each note from the line over many trials
(**irregularity**: a bump in the same place every time) from the spread of those deviations
(**instability**: jitter). Both ideas are used here, with robust statistics (`core/robust.ts`).

## Exercises (`core/scales.ts`, pure)

- **Scale types.** Major; natural, harmonic and melodic minor (melodic: raised 6th and 7th going up,
  natural going down); chromatic. Arpeggios (major and minor triads, root position) follow in S4.
- **Keys.** One spelling each, as graded exam syllabuses list them: majors on C G D A E B F♯ D♭ A♭
  E♭ B♭ F; minors on A E B F♯ C♯ G♯ E♭ B♭ F C G D. Notes are spelled from the key signature (seven
  letters from the tonic), so harmonic G♯ minor has F𝄪: the model uses `SpelledPitch` (`alter` −2…2)
  from `core/score.ts`, not `note.ts`'s `Pitch`. Spellings are locked by a test.
- **Range and shape.** 1, 2, 3 or 4 octaves, up and back down, ending on the tonic (the top note
  once). The right hand starts on the lowest tonic at or above C4 for one and two octaves, at or
  above C3 for three and four; the left hand an octave lower.
- **Hands.** Right, left, or together an octave apart (parallel motion). Contrary motion from a
  unison tonic is S4.
- **Fingering.** Standard fingering per scale and hand, drawn on the score and used to mark the
  crossings (thumb under, finger over). Taken from a public-domain edition we can cite and check
  against a scan — Hanon, _The Virtuoso Pianist_ Nos. 39 (major and minor scales) and 40 (chromatic)
  — with the edition recorded per scale and locked by a test. Scales without a sourced fingering are
  offered without one. Fingering is shown, never enforced: MIDI cannot see fingers.
- An exercise is a value (`{ type, tonic, octaves, hands }`) with a stable key (`major:D:2:both`),
  so records and trends group by it.

## Playing a scale

The scale is drawn as a short score (generated MusicXML, drawn by Verovio as on the Pieces pages,
with the key signature and the fingering), and the notes turn green as they are played.

### Free tempo (default)

- No click. The run starts at the first key of the scale and ends at the last note, or after 3 s
  without a key, or on Stop.
- Notes are matched to the scale by **sequence alignment** (a small edit-distance DP of the played
  note-ons against the expected sequence, per hand), so a wrong, missed or extra note costs one
  note, not the rest of the run. Hands together: each expected step is a pair; a played note is
  aligned against both hands' sequences and goes to the one it fits (the same key can belong to
  either hand at different moments in a scale of two octaves or more). Held keys from before the run
  and notes outside the scale's range are ignored.
- The tempo is the player's own: timing is judged against a line fitted to the notes themselves,
  never against a grid.

### With the click

- The metronome counts in one bar and clicks the beat; 2, 3 or 4 notes to the beat at ♩ = 40–160.
  This reuses Pieces' rhythm mode: the scale is a `Score`, so `rhythmPlan`, `createMatcher`, the
  click track and the latency calibration apply unchanged.
- The run is analysed both ways: against the click (early / late, as in rhythm mode) and against its
  own line (evenness), since a player can be steadily late and perfectly even, or on the beat on
  average and uneven.

## Analysis (`core/evenness.ts`, pure)

All figures come from the raw notes of the run (see Records) and are recomputed when shown.

- **Timing.** Two figures, each for what it is good at (chosen in S0 by simulation, see
  Clarifications). The run's **spread** is the standard deviation of its inter-onset intervals, each
  taken against the median of the intervals around it in the same direction, so a run that speeds up
  or slows down is not called uneven for it; in ms, the measure the literature uses, and as a share
  of the median interval (so a slow scale and a fast one compare). A **hesitation** — an interval
  far longer than its neighbours — is counted apart and left out of the spread, so one stop does not
  hide how even the rest was. A note's **deviation** (ms, early −, late +) is its onset against a
  Theil–Sen line through the notes around it, the note itself left out: this is what places a bump.
  Drift is reported apart, as the tempo at the start and at the end. The intervals into and out of
  the turning note are shown but left out of the figures: a turn is allowed to breathe.
- **Loudness.** Key velocity, relative within the run: the robust spread (IQR) of velocities after
  the same detrend, and **accents** — notes at least 12 velocity units above the median of their
  neighbours (S0 checks the threshold on the MP11SE and the built-in piano). MIDI velocity curves
  differ between instruments, so loudness figures compare runs on the same instrument only; the run
  records the input's name. The computer keyboard and the on-screen piano have no velocity: loudness
  is "not measured", never zero.
- **Connection.** Legato is the overlap between a key's release and the next key's onset (positive:
  overlap, negative: a gap). Reported as the median overlap and the notes with a gap of more than 30
  ms, where most beginners break the line at the thumb. With the sustain pedal down during the run
  the figure is shown but marked (the sound joins what the fingers do not).
- **Hands together.** Asynchrony per pair (right − left onset, ms): the median (which hand leads)
  and the notes more than 30 ms apart.
- **Where.** Every figure is also reported per position in the scale (degree and direction) and per
  crossing, so a summary can say "the thumb after the 3rd finger going up is 25 ms late and
  accented". Over the last runs of the same exercise (at least 3), the mean deviation per position
  is the **irregularity** and the IQR per position the **instability**; a position is named when its
  irregularity is at least 2 standard errors from zero and 15 ms or more.
- **Reference points.** The summary gives the spread with a plain scale around it, anchored on the
  published professional value (about 8–9 ms at eight notes a second), in ms and in percent of the
  note length; the bands are set in S1 from recorded runs.

## After a run

- The score with each note tinted by its deviation (the note heatmap's ramp, early and late in two
  hues, colour never the only signal: the value is in the details and the table).
- A **profile chart**: one mark per note in the order played, deviation up and down from the line,
  crossings and the turn marked on the axis; velocity and connection as two thin rows under it;
  hands together as two series. Hover or focus shows a note's figures; a table lists them. (Shaped
  like `DeviationChart.tsx`, which is the starting point.)
- Three sentences at most: the timing figure, the clearest problem place (from this run, or from the
  last runs when they agree), and loudness or connection when they stand out.
- Again (the same exercise), change the tempo or the hands, or pick the weakest position as a
  **focus**: the scale is cut to the few notes around it, a loop in wait mode's sense, played until
  Stop.

## Records and progress

- Raw data is the source of truth. A **scale run** record holds: id, session, the exercise key, mode
  (free or click), tempo when clicked, the input's name, whether velocity was measured, and every
  note-on and note-off of the run (key, velocity, time in ms from the first key, pedal changes),
  plus when it started. A four-octave run hands together is about 120 notes, so one record per run.
- IndexedDB, next version: a `scaleRuns` store with indexes by exercise and by session, read one
  exercise at a time, never at startup. Each run's headline figures (exercise, mode, tempo, timing
  unevenness in ms and %, whether loudness was measured) are also kept on its session, so lists and
  trends come from the sessions loaded at startup and `scaleRuns` is opened only for a run's profile
  or the per-position figures. Export format, next version: includes scale runs; older files still
  import. A run is recorded once it has 8 matched notes, and only if its missed and extra notes
  together are at most a third of the notes it asked for (the share is checked in S1): a restart or
  playing around before the tonic is "not a scale run", said so and not recorded.
- Scale sessions (one per visit to the page while scales are played) join the `SessionRecord` union,
  so today's minutes, the streak and the log count them. Active time follows the idle rule of every
  other session.
- **Progress per exercise**: timing unevenness (median per day) over the last 30 days, the best run,
  and the positions still irregular. A **Scales** list shows every exercise played with its latest
  figure, weakest first, and suggests which to play.

## UI

- A new **Scales** route: pick type, key (a circle-of-fifths order), octaves and hands, free or with
  the click; the last choice is remembered (`localStorage`). The practice screen follows the Read
  page's rules: the score is the hero, everything fits on one 1280 × 800 screen, the controls are
  quiet.
- **Navigation: a More menu.** The nav has six items and no room for more on a 375 px phone. It
  gains a **More** menu at its end: items that do not fit the width move into it, the lowest
  priority first (Settings, then Metronome, Progress, Ear, Scales, Pieces; Play and Read always
  stay), and More is marked as the current page when the page's item is inside it. The header chip
  still opens the metronome. The menu is a disclosure button with a list of links, operable from the
  keyboard, closed by Escape and by choosing an item.
- The Apple app: the screen stays awake during a run, and the page's usual silencing on hide
  applies. Every string in all five languages; scale and mode names need glossary rows in
  [TRANSLATING.md](TRANSLATING.md) (장조/단조, 長調/短調, 和声短音阶 …).

## Clarifications (decided in S0)

The spike's scripts and figures are summarised here; the numbers are from 400 simulated runs per
case (onset jitter σ, a tempo drift over the run, a thumb note late by a fixed amount, hesitations
that delay everything after them by 150 ms). Interval figures are divided by √2 so that every figure
reads σ for a steady player.

- **Drawing: Verovio, from generated MusicXML.** A scale parses back through `parseMusicXml`
  unchanged (G♯ harmonic minor, two octaves, hands together: 58 notes, no warnings, F𝄪 as MIDI 67,
  79 and 91) and Verovio draws every note with its fingering above the right hand and below the
  left. Verovio does not infer accidentals from `<alter>`: the generator writes `<accidental>`
  wherever a note departs from the key signature or from an earlier accidental in the bar. Notes are
  tinted by the ids of the timemap, as the Pieces heatmap maps them. Ledger lines are kept in check
  per beat group: the left hand changes to the treble clef for a group lying wholly at or above C4,
  and the right hand takes an 8va over consecutive groups lying wholly at or above C6, from the
  first such group to the last, and only for two groups or more (one group under a bracket looked
  odd in the spike); 15ma and 8vb were added in S1, with the new range rule. MusicXML pitches stay
  sounding pitches under an octave shift, so the parser needs no change. Scales are drawn in
  sixteenths beamed by four with a hidden time signature, ending on a quarter note (in S1: on the
  note that fills the last beat); in click mode 2 notes to the beat are eighths, 3 are triplet
  eighths and 4 are sixteenths.
- **Timing figures.** One line per direction counts drift as unevenness: σ = 10 ms slowing by 30 %
  over four octaves reads 36 ms. SD(IOI) doubles there too (20 ms). Intervals against the median of
  the 8 around them in the same direction read 11.8 ms, and read about 12 % above SD(IOI) for a
  steady player (the neighbours' median has noise of its own), so the spread is scaled by a constant
  that makes a steady player's figure equal SD(IOI); a test locks it within ±5 % on simulated runs.
  Two hesitations double every figure but a robust one, hence hesitations first: an interval longer
  than its neighbours' median by at least 40 % of it and by 3 robust standard deviations (1.4826 ×
  the MAD of the run's excesses) is a hesitation; the spread is the standard deviation of the rest
  (more efficient than the MAD, which varies 50 % more from run to run). In 500 runs per case this
  finds 80 % of 150 ms stops on 250 ms notes (σ = 20), 98 % of 400 ms stops for a loose player (σ
  = 40) and half of 60 ms stops at 125 ms notes, and flags an interval in about 11 % of runs of a
  steady beginner (σ = 40, or σ = 25 at 125 ms) — intervals that do stand out by 3 SDs and 40 %;
  dropping one of some 26 lowers the spread by about 5 %. At 4 SDs only half the 150 ms stops were
  found. A spread needs at least 12 intervals per direction (two octaves): a one-octave run's figure
  varies ±50 % (σ = 20: 16–34 ms, 10–90 %) and is shown as rough; the per-position figures over runs
  are what one octave gets instead.
- **Deviation per note.** A Theil–Sen line through the 7 notes around the note (in its direction,
  shifted at the ends, the note left out) recovers a thumb delayed by 25 ms as 25–27 ms with or
  without a 25 % drift; one line per direction shrinks it to 21 ms. A hesitation is a step in the
  onsets that breaks such a line, so its excess is taken off every later onset before the deviations
  are computed: with two 150 ms stops in the run, a 25 ms thumb bump then reads 24 ms with a 10–90 %
  range of 4–40 ms instead of −8–53 ms, and a 400 ms stop no longer scatters the thumb figure (±37
  ms instead of ±68 ms for a steady player).
- **Alignment.** One hand: edit distance (match 0; a wrong key, a missed or an extra note 1 each).
  Hands together: a DP over (played note, right-hand note, left-hand note), where a played note
  matches the next note of its key in either hand or is extra, and every move of a hand while the
  hands are more than one note apart costs 0.6 per note of difference; that settles which hand a key
  shared by both belongs to. Checked on 600 runs of two and three octaves, played in a random hand
  order within each pair, with 4 % missed notes, 3 % wrong keys and 3 % extra notes: of 39,783 notes
  played as asked, none was given to the wrong hand or note, and 30 (0.08 %) were taken for extras
  where a neighbouring wrong key tied with them. S1's tests assert each played note's hand and
  index, not only its pitch. A wrong key in hands together shows as a missed note and an extra one
  at the same place, and is reported as a wrong key. Four octaves hands together (114 notes) aligns
  in 22 ms.
- **Fingering: Hanon, as printed** (`scripts/scales/hanon/`). Nos. 39 and 40 of the G. Schirmer
  edition [1900] (IMSLP #91547; public domain in the US and the EU) were transcribed twice,
  independently, and diffed digit by digit: no difference in No. 39, one in No. 40, settled at 1200
  dpi; the doubtful digits and how they were read are listed there. Hanon prints the harmonic and
  the melodic minor, not the natural one, so natural minor is offered without fingering. His
  fingering is the commonly taught one through the middle of every run; it differs at the start on
  black-key tonics (the right hand starts on 2 where most books start on 3) and at the left hand's
  turn at the top, and dacapo shows his, since it is the one we can cite. F♯ major takes his G♭
  major (the same keys). One correction: D major, left hand, the E before the repeat is printed 1 on
  both copies of the plate, where the pattern and the 5 on the following D need 4; dacapo uses 4.
  Hanon's runs repeat into the start, so the closing tonic, which he never prints, takes his
  starting finger. Chromatic scales take No. 40's fingering at the octave. When the fingering ships
  (S1), Hanon's edition joins `THIRD_PARTY_NOTICES.md` and the About page with the other music
  sources.
- **Navigation: a More menu** (see UI).
- **Still open for S1**: the accent threshold and loudness spread need recorded runs on real
  instruments (the MP11SE and a second one); S1 ships a development-only "save this run" button to
  collect them, and the thresholds are set from them before S1 ends. Input events carry no source
  today (`NoteEvent` has no device), so S1 decides how a run learns that its notes came from the
  computer keyboard or the on-screen piano (loudness not measured).

## Clarifications (decided in S1)

- **Range.** The right hand starts on the lowest tonic at or above C4 for one and two octaves, and
  at or above C3 for three and four (C major four octaves is C3–C7, as in Hanon); the left hand an
  octave lower; hands separate use the same octave. Every exercise stays within A0–C8 (tested).
- **Drawing.** One hand is one staff (treble for the right hand, bass for the left, with clef
  changes), both hands a grand staff. Octave lines: 8va over beat groups wholly at or above C6, 15ma
  at or above C7, 8vb at or below C2, each over two groups or more; the page asks Verovio for
  "8va"/"15ma" text (`octaveAlternativeSymbols`), since a bare "8" collides with the fingering. All
  bars have quarter-note beats; the last note fills its beat (a quarter, or an eighth when the beat
  is not full). Short scales are drawn larger (1.6× at one octave, 1.3× at two, 1.15× at three) and
  a system at least half full is stretched across the sheet. The page tells `parseMusicXml` which
  hand each staff is (`scaleHands`), so a scale never depends on how an imported piece's hands are
  guessed.
- **Fingering data** lives in `src/core/scaleFingering.ts`, generated by
  `scripts/scales/fingering.ts` from `hanon.json` with the D major correction, as digit strings
  grouped by octave so they can be read against the scan; a test regenerates it and locks a
  checksum. Fewer than four octaves keep Hanon's start and top turn and his periodic middle, joined
  where his pattern repeats; every result is checked (no thumb on a black key, thumbs 3 or 4 notes
  apart, no finger twice on neighbouring keys) and four octaves equal Hanon exactly. Chromatic
  scales from C are Hanon's; from other keys, the finger per key from his middle octaves.
- **A run** starts at the scale's first key (anything played before is not the run), ends at the
  last note, after 3 s without a key or on Stop, and the first key again starts the next run: no
  button between runs. The cursor on the score follows the notes, looking up to three skipped notes
  ahead (the nearest wins); a wrong key that happens to be one of them is taken as a skip, so the
  cursor moves on and the true next note flashes, but the figures come from the alignment of all the
  keys either way. Loudness counts as measured unless every key had the same velocity (the computer
  keyboard, the on-screen keys, a fixed-touch instrument).
- **Timing, as built.** The spread is scaled by 1 / 1.14 (simulated: 1.13 at two octaves, 1.14–1.15
  at three and four under onset jitter; about 5 % low if the jitter is in the intervals instead). An
  interval counts only between two neighbouring notes of the run played with the right key and
  nothing extra between them (a slip is a mistake, not unevenness). The spread is "rough" with fewer
  than 24 intervals in the whole run (so one octave, or two with more than one miss). The top note
  is fitted with the ascent. A problem place needs at least two notes of the same crossing, hand and
  direction; its standard error comes from the hand's robust spread; none is named for a run that is
  not a scale run.
- **On the score after a run** each note is inked by the size of its deviation in the heatmap's ramp
  (under 10, 20, 35, 60 ms and beyond), missed and wrong notes in the error colour; which way it
  went is in the chart, its tooltip and the table, so colour is never the only signal.
- **Left for later milestones.** A run finishes at the last note-on, so the last key's release (and
  any key still down) is not recorded: S2's records and S3's connection need the run to wait for it.
  The hands-together alignment builds its whole (played × right × left) table, up to 28 MB and 70 ms
  at the cap for four chromatic octaves: before S3 relies on it, restrict it to a band of a few
  notes around the diagonal (the drift cost makes the rest useless) or move the analysis off the
  main thread. The score's loading and failure overlay borrows the Pieces strings and styles; it
  moves to `ui/notation/` when a third page draws a score.
- **Navigation.** Below 48rem the header is two rows (brand and metronome chip, then the navigation
  across the width); the bar fits as many items as the width allows, measured per language, and the
  rest go into More.

## Milestones

1. ✓ **S0 Spike** — generate the scale MusicXML and draw it with fingering and per-note tints in
   Verovio (or decide on VexFlow); alignment of played notes against a scale (hands separate and
   together) on recorded runs with mistakes; the detrend window and the reference bands from
   simulated and recorded runs (a steady player, a thumb bump, a drift); velocity thresholds on two
   instruments; transcribe and check Hanon's fingerings. Report; no production UI.
2. **S1 Free-tempo scales** — the exercise model, the Scales page, free-tempo runs, timing and
   loudness analysis, the profile chart, hands separate.
3. **S2 Records** — `scaleRuns` storage, export, sessions in the log and streak, irregularity and
   instability over runs, progress per exercise.
4. **S3 Hands together, connection and the click** — hands together with asynchrony, legato
   analysis, click mode through rhythm mode's plan and matcher, focus loops.
5. **S4 More shapes** — arpeggios, contrary motion, chromatic in contrary motion if there is demand.

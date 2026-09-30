# The basics (Learn)

Short lessons for someone who has never read music, at `#/learn`. Each lesson teaches one thing
with prose, figures to play with and an exercise at the end. They are part of the app, so every
figure uses the app's own keyboard: it sounds on the built-in piano and answers to a MIDI keyboard,
the computer keyboard, a click or a tap, like the Play page.

## Lessons

| #   | Slug               | Lesson                               | State   |
| --- | ------------------ | ------------------------------------ | ------- |
| 1   | `keyboard`         | Finding your way around the keyboard | written |
| 2   | `staff`            | The staff and the clefs              | written |
| 3   | `landmarks`        | Landmark notes and intervals         | written |
| 4   | `rhythm`           | Rhythm and the beat                  | written |
| 5   | `sharps-and-flats` | Sharps, flats, whole and half steps  | written |
| 6   | `major-scale`      | The major scale and key signatures   | written |
| 7   | `posture`          | Posture, hand shape and fingering    | written |
| 8   | `rhythm-2`         | Dots, ties, triplets and syncopation | written |
| 9   | `minor-keys`       | Minor scales and minor keys          | written |
| 10  | `dynamics`         | Loud and soft, joined and detached   | written |
| 11  | `pedals`           | The pedals                           | written |

Beside them, not numbered: **Inside the piano** (`inside`), one key of a grand piano's action in
cross-section, moving as you play. Its motion comes from `src/core/pianoAction.ts`: the key, the
jack that lets the hammer go at let-off, the hammer's free flight and rebound, the backcheck, the
repetition lever, the damper and the string, stepped a half-millisecond at a time and drawn by
`PianoActionDrawing.tsx`, each part turning about its own pivot. Every key pressed anywhere drives
it, at the speed pressed, slowed down four or ten times if asked; a slowed-down tap is kept down
long enough to play out.

The list, with titles, summaries, reading times and where to practise, is `src/learn/lessons.ts`
(`LESSONS`, and `EXTRAS` for pages like this).
A planned lesson is listed as "In preparation" and cannot be opened.

## Languages

Lessons are written in English and Simplified Chinese: `src/ui/learn/lessons/<slug>.en.tsx` and
`<slug>.zh-CN.tsx`, loaded when opened (`lessons/index.ts`). zh-CN reads the Chinese; every other
language reads the English, with a line saying so in its own language. The page around a lesson
(titles of the page, contents, next and previous) is in the app's dictionaries like any other text;
the words inside figures (Start, "3 of 8", "That was E4") follow the lesson's language
(`src/ui/learn/lesson.ts`).

The two versions say the same things with the same figures and exercises, in the same order. The
Chinese is written, not translated: mnemonics that only work in English ("Every Good Boy Does
Fine") are replaced by what works in Chinese.

## Writing a lesson

- Sections (`Section`, with an `id`) make the contents beside the lesson on a wide screen.
- Figures go on numbered plates (`Plate`, `wide` for a full keyboard), with a caption that says
  what to do with them.
- `Aside` holds a rhyme, a tip or a warning; `Picture` an illustration.
- Figures: `keyboardFigures.tsx` (the keyboard), `staffFigures.tsx` (the staff and clefs),
  `theoryFigures.tsx` (landmarks, intervals, steps and accidentals, scales and key signatures,
  fingers, and for lesson 9 the minor: a tune in major and minor, the relative minor, a builder
  for the natural, harmonic and melodic minor from any key, the leading note, and phrases whose
  key is told by their end and their raised 7th) and `rhythmFigures.tsx` (the beat, rhythms on a line, time signatures, 3/4 against
  6/8). A rhythm line beams by the beat (in threes in 6/8), draws ties, sixteenths and triplets
  with their bracket, and counts each beat as finely as its notes need ("1 e & a", "1 trip let");
  lesson 8 puts the counts not played on in brackets, "1 (2) & 3". Its time is in ticks, twelve
  to a quarter note, so triplets and sixteenths fall exactly, and in 6/8 the click also sounds
  the eighths, more quietly than the beats. Exercises share
  one frame (`exercises.tsx`): a key quiz (a figure to answer from, such as a key signature, and a
  note asked for in any octave, when it needs them), a line of keys to play in order, multiple
  choice, and in the rhythm lesson a bar to tap in time, judged against the click. Scales are
  spelled by `core/scales.ts`, as on the Scales page; a minor whose harmonic form needs a double
  sharp (G♯) is left out of the figures. Staves are drawn by
  `ui/engraving/EngravedStaff.tsx` from Bravura's outlines (notes of every value, rests, key and
  time signatures), so no music font is loaded; `ui/engraving/marks.tsx` draws what is written
  around the notes (dynamics in Bravura's letters, hairpins and the words for them, accents,
  staccato dots and tenuto lines, slurs, and the pedal as Ped. and its star or as a line with a
  notch at each change).
- `expressionFigures.tsx` has lesson 10's: a phrase at any dynamic from pp to ff, a swell as
  hairpins or words, accents and sf, the Ode to Joy's tune over its chords (balanced or not),
  the velocity of each key struck, and a line played legato, non legato, staccato or tenuto with
  a timeline under it of every note heard, yours or the figure's: how long each was held, and
  whether it joined the next, left a gap or overlapped it, by the thresholds EXPRESSION.md plans
  for the Pieces (`expression.ts`). A figure plays its notes with their own times, lengths and
  loudness (`usePlayNotes`); the built-in piano sounds them at that velocity.
- `pedalFigures.tsx` has lesson 11's: four chords on the grand staff with the pedal marked both
  ways, heard without it, held through and changed with each chord; and a timeline of keys,
  pedal and sound (a key rings on while the pedal is down) that follows your keyboard and its
  sustain pedal, or plays a demo of the pedal changed in time, too early or too late, and marks
  each change's gap or blur. The figures never press the app's pedal: a demo holds its keys as
  long as the pedal would, so the player's own pedal and Inside the piano's are left alone. The
  exercise's four chords are judged by X3's numbers (`judgePedalChanges`): up within 250 ms after
  each new chord, down again within 400 ms. Timelines are drawn a unit to a pixel at the width
  they are given, so they stay legible on a phone.
- An exercise that needs something not everyone has (a keyboard that senses touch, a sustain
  pedal) says so when no MIDI keyboard is connected and can always be skipped; the lesson is
  finished by its last exercise, which anyone can do. Lesson 10's crescendo passes when every
  note is louder than the one before, or when the last is the loudest and at least 19 (15% of the
  range of velocities) above the first.
- The rhythm figures use the page's click track; whoever started it last owns it, so one figure
  stopping never silences another.
- Only one exercise listens at a time: starting one (or clicking a key on it) stops the others, so
  a key played for one never answers another. The last exercise marks the lesson done
  (`useCompleteLesson`), shown as a tick on the list; that is kept per browser, not synced.
- Nothing a lesson says may be browser-only in the Apple app, which shows the same lessons.

## Pictures

The etchings in `public/learn/` were painted by GPT Image 2.5 (`gpt-image-2.5-sunburst`, high
quality, 1536×1024) with the Herdstead painter skill, then scaled to 1200×800 WebP. The style prompt
asks for a copperplate etching in dark brown ink on cream paper (#231d18 on #f8f4ec), with no text,
numbers or notation. The model does not draw a keyboard reliably, so:

- `seated-at-middle-c.webp`: generated, then edited to put the pianist at the centre of the
  keyboard, which the lesson says to do.
- `hands-either-side.webp`: an edit of a keyboard drawn in code with the black keys in their real
  groups of two and three, the model adding the hands and the etching.
- `posture-from-the-side.webp`, `curved-hand.webp`: generated, the better of two each.
- `inside-a-grand.webp`: generated, the first of two; atmosphere only, the action itself is drawn.
- `two-hands.webp`: generated with no keyboard and no numbers; the finger numbers are laid over it
  in code (`FingerNumbers`), at positions measured on the picture.

The prompts and the reference keyboard are in `scripts/learn/`.

Check every new picture for what the lesson teaches (the black-key pattern, five fingers, where the
player sits) before using it. Anything exact (a staff, a note, a key's name) is drawn in code, never
painted.

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
| 3   | `landmarks`        | Landmark notes and intervals         | planned |
| 4   | `rhythm`           | Rhythm and the beat                  | planned |
| 5   | `sharps-and-flats` | Sharps, flats, whole and half steps  | planned |
| 6   | `major-scale`      | The major scale and key signatures   | planned |
| 7   | `posture`          | Posture, hand shape and fingering    | planned |

The list, with titles, summaries, reading times and where to practise, is `src/learn/lessons.ts`.
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
- Keyboard figures and exercises are in `keyboardFigures.tsx`, staff figures in
  `staffFigures.tsx`; staves are drawn by `ui/engraving/EngravedStaff.tsx` from Bravura's outlines,
  so no music font is loaded.
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

The prompts and the reference keyboard are in `scripts/learn/`.

Check every new picture for what the lesson teaches (the black-key pattern, five fingers, where the
player sits) before using it. Anything exact (a staff, a note, a key's name) is drawn in code, never
painted.

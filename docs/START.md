# dacapo — Starting specification (the first visit)

Status: G4 (the start page, the starting point in the curriculum and in Read's suggested level,
Settings' block, the line on the practice pages) is built. This extends [MVP.md](MVP.md) and the
later specifications; their principles and fixed decisions still apply: no account, nothing sent
anywhere, and nothing forced — every page stays reachable without answering anything.

Goal: a first visitor presses **Start reading** and lands on a list of seven levels, whoever they
are: someone who has never touched a piano and someone who has played for ten years get the same
page, and neither is told whether their keyboard is heard. The message that a browser cannot use
MIDI shows on Play and in Settings only. This adds one short page between the first click and the
first practice: where you start from, and whether your keys arrive; and says on every practice
page what is playing when no MIDI keyboard is.

## The start page (`#/start`)

The hero's primary button becomes **Start** and opens it (the hero itself stays as it is: it is
what a first visitor and a search engine read). **Or just play** stays beside it. The page has
two parts on one screen, and a button.

1. **Where are you starting from?**
   - **I am new to the piano** — "The lessons begin with the keyboard itself." Begins at the
     first lesson; Today (TODAY.md) proposes the lessons and opens each practice as its lesson is
     read.
   - **I play already** — "Everything is open, and nothing is explained unless you ask." Every
     practice is open at once (the curriculum's third way of being open, beside a lesson's tick
     and a record); the lessons are not put into Today (Learn stays where it is). One more
     question follows: **What do you read without counting lines?** — _the treble staff_ · _both
     staves_ · _ledger lines, sharps and flats_ · _I would rather find out_. It sets where Read's
     notes begin: the level suggested is the later of the first level not mastered and L3, L5 or
     L7. The levels below it are not marked mastered (nothing was measured); they are just not
     where the page opens.
2. **What will you play on?** The page listens while it is open and says what it finds:
   - a MIDI keyboard connected: its name, "Press any key", and a small keyboard that lights the
     key pressed: "It is heard.";
   - none connected, in a browser that has MIDI: "Connect a MIDI keyboard with a USB cable and it
     appears here", and **the computer keys** drawn with their letters (A to K, Z and X for the
     octave), which light the same keyboard;
   - a browser without MIDI: "This browser cannot use a MIDI keyboard; Chrome or Edge on a
     computer can. The computer keys and the keys on the screen work here.";
   - MIDI blocked for the site: how to allow it.
   - **Sound**: one button plays a note through the output in effect (the instrument, or the
     built-in piano), with "Nothing heard?" leading to Settings' Sound.
3. **Begin** goes to the first lesson (new) or to Home, which now shows Today (I play already).

- **Kept in the browser** (`dacapo.start`: the answer and the reading level), not synced and not
  exported: it is a preference of the device, and Settings has **Your starting point** to change
  it. Answering makes the visitor a returning player for Home (`dacapo.returning`).
- **Never in the way.** A visitor who opens any other page first never sees it; a returning
  player (a session stored, or a lesson ticked) never does; the page has no step that cannot be
  left.
- In the Apple app the second part says what the app hears (Core MIDI), without the browser's
  sentences.

## What is playing, on every practice page

On the setups of Read, Ear, Harmony and Scales and on a piece's page, when no MIDI keyboard is
connected, one line says so and what plays instead, with the same words as the start page: none
connected ("No MIDI keyboard connected: the computer keys play, A to K."), no MIDI in this
browser, or MIDI blocked. It can be dismissed, per device and per reason (`dacapo.input.notice`);
it goes when a keyboard connects and comes back if the reason changes. Play and Settings keep
their fuller help.

## Clarifications (decided during G4)

- **Code.** `core/startingPoint.ts` has the answer as data (`{ from: 'new' }`, or
  `{ from: 'player', reads }` with `reads` one of `treble`, `both`, `ledger`, `unknown`), how it
  is read back, and the floor it gives Read (`readingFloor`). `isOpen` in `core/curriculum.ts`
  takes it as a fourth argument; `curriculumState`, `todayPlan` and `planOf` in `core/today.ts`
  take it as `start` in their options; `suggestedLevel` in `core/mastery.ts` takes the floor. The
  page is `ui/start/StartPage.tsx`, its first part `ui/start/StartingPointFields.tsx`, which
  Settings shares (`ui/settings/StartSection.tsx`); the line is `ui/input/InputNotice.tsx`, its
  rule `ui/input/notice.ts`. The page is loaded on demand: the start has the answer as data and
  where it is kept (`ui/start/prefs.ts`), nothing more, and the test that holds the start holds
  that too.
- **The answer kept.** `dacapo.start` is the answer as JSON, read back field by field; anything
  else is no answer. It is written when Begin is pressed, and at once when it is changed in
  Settings; leaving the page without Begin keeps nothing. The page opens with "I am new to the
  piano" chosen (what the app does unasked) and, for a player, "I would rather find out"; someone
  who comes again finds their answer.
- **Returning.** An answer counts as a ticked lesson does: the home page reads it at once, shows
  Today, and keeps `dacapo.returning` set while the answer is kept, with or without a session.
  Progress has the day's figures and Where you are for a visitor who answered and has no record
  yet, as it has with ticks alone.
- **Begin**, for a newcomer, opens the first lesson not ticked: the first lesson on a first
  visit. Where it goes is worked out when it is pressed; pressed before the ticks are known
  (the records not read yet, or not readable) it opens the Learn page, which marks the next
  lesson ([LEARN.md](LEARN.md), "Clarifications (decided during G3)"). Enter in either question
  begins too (the page is one form).
- **Never in the way.** Only the first visit's button leads to the page ("Start", in place of
  "Start reading"). Settings' block has the question itself, not a link to the page. Nothing
  bars the address: someone who types `#/start` finds the page, with their answer if they gave
  one.
- **Open.** A player's starting point opens every practice whatever the lessons and the records
  say. "New", and no answer, change nothing: `isOpen` gives its other callers what it gave.
- **The lesson step** is left out of a player's plan at every length; in the 10-minute plan a
  level takes its place, however few lessons are ticked. Where you are still counts the lessons
  and names the next.
- **Read's level.** "The later of the first level not mastered and the floor" cannot be read as
  a plain maximum: for someone who never plays the levels below the floor, the first level not
  mastered stays L1, so the maximum would hold the page at the floor after the floor is
  mastered. It is the first level not mastered **from the floor on**; once every level from the
  floor on is mastered, the last level, as when all seven are. The page never opens below the
  floor by itself. Today and Where you are take the same floor for Read's notes (a level step is
  "the family's own rule"), with one difference: once every level from the floor on is
  mastered, they name the first level not mastered below it. A mastered L7 cannot be the day's
  "something new", and the family is not mastered throughout.
- **Nothing below the floor is mastered.** Mastery stays each level's own: the Read page, Where
  you are ("0 of 7 levels mastered" for a player who has not played yet), today's plan and an
  assignment's "until mastered" count only what was measured. Tests hold each.
- **A changed answer** in Settings: Read follows the next time its page opens. Today's kept plan
  stands; the next plan made (another day, or another length) follows.
- **The second part** uses Play's own status line and help (`DeviceStatus`, `DeviceHelp`, with
  "Try again" when MIDI is blocked), so the two pages say the same: the sentences for "none
  connected", "no MIDI here" and "blocked" are Play's, and "The computer keys and the keys on
  the screen work here." is said beside "Press any key." whenever no keyboard is connected.
  Under them, a keyboard of three octaves (C3 to C6) at the width of its column, which grows by
  octaves to reach a key beyond it; once a key arrives, from any keyboard, its name and "It is
  heard."; and the computer keys as Play draws them (now a `Keycaps` both pages use), a cap lit
  while its key is held. They are shown as on Play: not with a keyboard connected, and not in
  the first 1.5 s of looking.
- **Sound.** The button is Settings' "Play a test note", through the output in effect; the
  status line above names that output when it is not the keyboard itself. The built-in piano's
  sound is loaded as before, when it becomes the output (a moment after the app starts, when no
  instrument takes the notes): the page asks for nothing of its own, and when the sound is not
  in yet the note plays once it is.
- **In the app** the status and the help are the app's variants. `midi.help.noDevice` has one
  now (it names no USB cable), and the two new sentences that name the computer keys name the
  keys on the screen first.
- **The line** stands once on each page, where its setups are: under the introduction on Read,
  Ear and each practice of Harmony (so every setup has it, and a running session never does),
  above the picker on Scales (not in focus mode), and among the notes beside the status on a
  piece's page. It reads "{status}: the computer keys play, A to K." with Play's words for the
  status. While the browser is still looking there is no reason to give, so nothing flashes as
  a page loads.
- **Played by touch alone.** A phone or a tablet in a browser has no computer keys to speak of.
  It is told by what the device says of its own input, `(hover: none) and (pointer: coarse)`,
  never by its name (`ui/input/touchOnly.ts`; read when the page opens, and again when an answer
  changes). There the line reads "{status}: the keys on the screen play.", in the app too; the
  start page leaves out the computer keys' letters and the Z and X row and says "Press any key:
  the keys on the screen play here."; and its keyboard has keys a finger wide (30 px, as on
  Play) and scrolls sideways within itself, middle C in view. A computer with a touch screen
  (it hovers, with a fine pointer) keeps the computer keys' wording, and so does a narrow window.
- **Dismissed.** `dacapo.input.notice` keeps the one reason dismissed (`no-device`,
  `unsupported` or `no-permission`). The line stays away while that is the reason, also after a
  keyboard was plugged in and taken away again; another reason brings it back, and dismissing
  that one forgets the first. The button is a cross, named "Dismiss" as the storage notice's is.
- **One screen.** At 1280 × 800 both parts and Begin are on the screen in every state (a
  player's four reading levels open, none connected, no MIDI, blocked), in English and
  Simplified Chinese; on a phone the second part follows the first.
- **The start.** The files `index.html` loads were 911,201 bytes (275,013 gzipped) before and
  are 918,585 (277,841) now: about 4 kB of styles, the 30 strings in English, and the answer as
  data with where it is kept. The page itself, its questions and the line are chunks of their
  own (3.5, 1.8 and 1.2 kB), loaded when they are shown.

## Milestones

1. ✓ **G4 Starting** — the start page, the starting point in the curriculum and in Read's
   suggested level, Settings' block, the line on the practice pages.

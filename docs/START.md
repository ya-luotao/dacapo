# dacapo — Starting specification (the first visit)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply: no account, nothing sent anywhere, and nothing forced — every page
stays reachable without answering anything.

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

## Milestones

1. **G4 Starting** — the start page, the starting point in the curriculum and in Read's
   suggested level, Settings' block, the line on the practice pages.

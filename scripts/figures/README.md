# Figures

`grand-piano.mjs` draws the grand piano section of the lesson Inside the piano: one octave, C4 to
B4, from the keys to the soundboard, with its three pedals. Its geometry and physics are in
`src/core/grandPiano.ts`; the script draws them at rest with the [Anatomy](https://github.com/wheresryan22/anatomy)
kit, settles the painter's order from every part's true shape, and writes
`public/learn/grand-piano.svg`. The lesson's figure (`src/ui/learn/GrandPiano.tsx`) loads that
drawing and moves it with the action model (`src/core/pianoAction.ts`).

```sh
node scripts/figures/grand-piano.mjs           # rewrites public/learn/grand-piano.svg
node scripts/figures/grand-piano.mjs --audit   # and proves the geometry: nothing sunk, floating or drawn out of order
```

Run it after changing `src/core/grandPiano.ts`, and commit the drawing with the change: the output
is deterministic. The audit must end `audit passed`.

`anatomy/` is the kit's `kit/` folder (MIT, `anatomy/LICENSE`), copied as it was at commit
`689dcf9`. The few functions the app needs to move the drawing are ported to
`src/ui/learn/grandPiano/draw.ts`, and `draw.test.ts` holds them to the kit's output.

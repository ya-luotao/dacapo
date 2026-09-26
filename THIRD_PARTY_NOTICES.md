# Third-party notices

dacapo itself is released under the [MIT License](LICENSE). It ships the software, fonts, sounds and
music listed here, each under its own licence. Nothing is loaded from a CDN: everything below is part of
the build or of this repository.

The app shows these credits on its About page (`#/about`, linked from Settings), with the licence
texts it ships in [`public/licenses/`](public/licenses/): copies of each package's own licence
file (a test keeps them equal), Verovio's texts, and the notices of the libraries Verovio contains
(`public/licenses/verovio/THIRD-PARTY.txt`).

## Software shipped in the app

### Verovio 6.3.0: LGPL-3.0-or-later

[Verovio](https://www.verovio.org) draws the score on the Pieces pages. Copyright © Laurent Pugin
and the Verovio contributors, RISM Digital Center.

- **Licence:** GNU Lesser General Public License, version 3 or later. The texts ship with the app
  in [`public/licenses/verovio/`](public/licenses/verovio/): `COPYING.LESSER` (LGPL-3.0) and
  `COPYING` (GPL-3.0, which the LGPL builds on). Both are copied from Verovio's repository at the
  tag `version-6.3.0`.
- **Source:** <https://github.com/rism-digital/verovio/tree/version-6.3.0>. The npm package we use
  is [`verovio@6.3.0`](https://www.npmjs.com/package/verovio/v/6.3.0).
- **Unmodified, as its own files.** The app loads two files of the npm package by URL, only on the
  Pieces pages. The build copies them byte for byte into `dist/assets/`, with a content hash in the
  name. They are never re-minified or merged into dacapo's own code:

  | npm file                                                    | Built as                           | SHA-256                                                            |
  | ----------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
  | `dist/verovio.mjs` (the toolkit wrapper)                    | `assets/verovio-<hash>.mjs`        | `3db61c94295aeb4983baff06b5e03b2fc0e397fa405fa2461f81427954ec874b` |
  | `dist/verovio-module.mjs` (the engine, WebAssembly inlined) | `assets/verovio-module-<hash>.mjs` | `cd7c77d0738e9359b9f77956ae398556bf9949f35e4c5b3471ab3198fd660431` |

- **Using your own build.** Replace those two files in `dist/assets/` with a build of Verovio 6.3.0
  (or a compatible modified version), keeping the file names. Or change the `verovio` dependency in
  `package.json` and run `pnpm build`.
- **Libraries inside the engine.** Verovio contains pugixml (MIT), a JSON library by Hong Jiang
  (MIT), tuning-library (MIT), zip_file (MIT), midifile (BSD-2-Clause) and a public-domain CRC
  module. Their notices, taken from the tag `version-6.3.0` (midifile's from its own repository,
  since the vendored copy has no licence file), are in
  [`public/licenses/verovio/THIRD-PARTY.txt`](public/licenses/verovio/THIRD-PARTY.txt).
- **Fonts inside the engine.** The module embeds the music fonts Verovio ships (Leipzig, Bravura,
  Gootville, Petaluma, Leland) and the Liberation text font. All of them are under the SIL Open
  Font License 1.1 (see Verovio's
  [`fonts/README.md`](https://github.com/rism-digital/verovio/blob/version-6.3.0/fonts/README.md)).
  dacapo sets `smuflTextFont` to `embedded`, so no font is fetched from verovio.org.

### VexFlow 5: MIT

[VexFlow](https://github.com/vexflow/vexflow) draws the flashcards on the Read page. Copyright ©
Mohit Muthanna Cheppudira and the VexFlow contributors. MIT License.

### Other libraries

- [React](https://react.dev) 19 (`react`, `react-dom`): MIT, © Meta Platforms, Inc. and affiliates
- [wouter](https://github.com/molefrog/wouter): The Unlicense
- [idb](https://github.com/jakearchibald/idb): ISC, © Jake Archibald
- [fflate](https://github.com/101arrowz/fflate), for reading `.mxl` files: MIT, © Arjun Barrett

## Fonts

- **Bravura**, the music font of the Read page (`@vexflow-fonts/bravura`). Copyright © 2019
  Steinberg Media Technologies GmbH. SIL Open Font License 1.1.
- **Source Serif 4** and **Source Sans 3**, Latin subsets in `src/ui/fonts/`. Copyright © Adobe,
  with Reserved Font Name "Source". SIL Open Font License 1.1; the licence text is in
  [`src/ui/fonts/OFL.txt`](src/ui/fonts/OFL.txt).

## Sounds (the built-in piano)

- **Salamander Grand Piano V3** (the FreePats edition of 2020-06-02), a Yamaha C5 recorded by
  Alexander Holm. [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/);
  the legal code and the sound bank's own README ship in
  [`public/licenses/salamander/`](public/licenses/salamander/). Source:
  <https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html>.
- **Changes:** the dacapo project took three of its sixteen velocity layers (4, 9 and 13), trimmed
  each sample to its start, shortened it with a fade-out and encoded it as MP3
  (`public/piano/`); the tuning comes from the bank's retuned SFZ. `scripts/piano/build.ts` makes
  them from the original files (see `scripts/piano/README.md`).

## Music (built-in pieces)

All six works are in the public domain. Each file in `src/pieces/library/` records its own source
in `<identification>`.

- **Encoded by the dacapo project, MIT:** Petzold's _Minuet in G major_ and Beethoven's _Für Elise_.
  Both were taken from public-domain editions typeset by the [Mutopia Project](https://www.mutopiaproject.org)
  (pieces 75 and 931). The _Ode to Joy_ arrangement (key, left hand) is also ours.
- **CC0 encodings from MuseScore, via PDMX.** Each was dedicated to the public domain by its
  uploader; the dacapo project removed the fingering:
  - Burgmüller's _Arabesque_, Op. 100 No. 2, by PianoXML:
    <https://musescore.com/user/9292486/scores/5849868>
  - Schumann's _Soldatenmarsch_, Op. 68 No. 2, by jadr:
    <https://musescore.com/user/31901603/scores/5860733>
  - Bach's Prelude in C major, BWV 846 (the prelude only), from the Open Well-Tempered Clavier
    score by OpenGoldberg: <https://musescore.com/user/9836/scores/719631>

  They come from the **PDMX** dataset: Phillip Long, Zachary Novack, Julian McAuley and Taylor
  Berg-Kirkpatrick, _PDMX: A Large-Scale Public Domain MusicXML Dataset for Symbolic Music
  Processing_, <https://zenodo.org/records/15571083>. It is licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Checks only, never shipped

The Mutopia MIDI files that the built-in pieces were checked against (see
`scripts/pieces/README.md`) are not part of the repository or the app. One of them, Schumann Op. 68
No. 2, is CC BY-SA and was used only for comparison.

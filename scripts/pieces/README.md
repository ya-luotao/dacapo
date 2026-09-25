# Built-in pieces

The pieces in `src/pieces/library/` are MusicXML files we may redistribute: our own encodings of
public-domain music (MIT, like the rest of the repository) or CC0 encodings, with where they come
from written into each file. This folder holds the tools that make and check them. Every command
runs from the repository root.

## Rules

- **Only redistributable encodings.** Our own encodings of public-domain editions, or encodings
  dedicated to the public domain (CC0). Never a copyrighted arrangement, and never an encoding
  under CC BY-SA or a non-commercial licence. A MuseScore upload's licence is the uploader's claim:
  use it only when it is CC0 _and_ the notes check out against an independent source.
- **Provenance in the file.** `<identification>` names the composer (`<creator type="composer">`),
  the licence (`<rights>`), the encoder (`<encoding><encoder>`) and the source edition with a URL
  (`<source>`); `<work>` has the catalogue number and title. The library's `index.ts` repeats
  them for the app.
- **No fingering** unless it has been checked against a public-domain edition. Fingering in
  uploaded files is of unknown origin; `prepare-pdmx.ts` removes all of it.
- **Checked against an oracle.** Where an independent source exists (usually the MIDI file of a
  public-domain Mutopia edition), `verify.ts` must match it note for note. Without one, a second
  person proofreads the file against a public-domain scan.
- **Locked.** `src/pieces/library/library.test.ts` holds a checksum of each piece's notes, so any
  later change to a file is deliberate.

Commands use `--experimental-strip-types` so they also run on Node 22 (it is a no-op on Node 24).

## Our own encodings

`generate.py` (Python 3, standard library only) builds MusicXML from compact token lists, one
source file per piece in `sources/<id>.py`. The token format is described at the top of
`musicxml_gen.py`: `c4/4` is a quarter-note C4, `[c3,e3,g3]/8` a half-note chord, `fs5/2` an
eighth-note F♯5, `r/4` a rest, `s/4` an invisible spacer; durations are in sixteenths.

```sh
python3 scripts/pieces/generate.py              # write every generated piece
python3 scripts/pieces/generate.py --check      # fail if a committed file is out of date
```

The output is deterministic: regenerating must reproduce the committed files byte for byte.

## CC0 encodings from PDMX

[PDMX](https://zenodo.org/records/15571083) (Long et al., 2025; the dataset is CC BY 4.0) has
MuseScore uploads re-exported as MusicXML, with each uploader's licence. Only files marked
`cc-zero` without a licence conflict are candidates. `pdmx/<id>.json` records the PDMX id, the
file's path in `mxl.tar.gz` and its SHA-256, the title, composer, uploader and score URL, the
edition it was checked against, and optionally a measure to cut after (one movement of a larger
file) and text directions to drop (dedications that are not part of the music).

```sh
node --experimental-strip-types scripts/pieces/prepare-pdmx.ts <id> <file.mxl>
```

It checks the input's SHA-256, removes every `<fingering>` (and any `<technical>` or
`<notations>` left empty), the page credits and the dropped directions, cuts if asked, writes the
provenance, and checks that the result still parses. The notes are otherwise left exactly as
exported.

To fetch a file again, stream `mxl.tar.gz` from the Zenodo record and extract the path in the
JSON file; the SHA-256 must match.

## Checking against an oracle

```sh
node --experimental-strip-types scripts/pieces/verify.ts <file.musicxml> <oracle.mid> \
  [--order document|play|skip] [--bars A-B] [--midi-at Q] [--grid N]
scripts/pieces/verify-library.sh <dir with the oracle MIDI files>
```

`verify.ts` reads the file with dacapo's own parser and compares every key press (onset and
pitch; tied continuations are not presses) with the MIDI file, which is independent of both the
encoding and the parser. `--order document` (the default) takes every written bar once with all
its endings, as a LilyPond MIDI file without `\unfoldRepeats` plays them; `--order play` unrolls
the repeats. `--bars` and `--midi-at` compare part of a file with another part of the oracle.
Notes the oracle plays off the sixteenth grid (grace notes, ornaments) are listed, not compared.
It prints `matched/total`, every difference with its bar, and exits non-zero on any difference.

`verify-library.sh` runs the check for every built-in piece and lists where to download the
oracles; they are not in the repository.

## Adding a piece

1. Pick one public-domain edition (a Mutopia source edition or an IMSLP scan marked public
   domain) and, if one exists, an oracle for it.
2. Encode it: a `sources/<id>.py` for `generate.py`, or a `pdmx/<id>.json` for `prepare-pdmx.ts`.
3. Run `verify.ts` until it matches; settle every difference against the edition and note any
   editorial decision in the file's comment.
4. Add the piece to `src/pieces/library/index.ts` (metadata, level) and its strings to both
   dictionaries in `src/i18n/`.
5. Add it to `library.test.ts`: a checksum line and a test of its structure (bars, repeats).
6. Add the oracle to `verify-library.sh`, and a line to `THIRD_PARTY_NOTICES.md` if the encoding
   is not ours.

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
- **No fingering** unless it is a public-domain edition's, read from that edition and checked
  against it: on the notes where the edition prints it, and nowhere else. The first pieces added
  with G5a carry theirs (the source file names the edition and its editor); the older pieces have
  none. Fingering in uploaded files is of unknown origin; `prepare-pdmx.ts` removes all of it.
- **Checked against an oracle.** Where an independent source exists (usually the MIDI file of a
  public-domain Mutopia edition), `verify.ts` must match it note for note. Without one, a second
  reader transcribes the piece blind from the same public-domain scan (pitch, rhythm, fingering
  and markings), the two transcriptions are compared mechanically, and every difference is
  settled against the scan. A MIDI file says nothing about fingering, so a fingered piece gets
  the second reading either way. The source file says which method verified the piece.
- **Locked.** `src/pieces/library/library.test.ts` holds a checksum of each piece's notes, so any
  later change to a file is deliberate.

Commands use `--experimental-strip-types` so they also run on Node 22 (it is a no-op on Node 24).

## Our own encodings

`generate.py` (Python 3, standard library only) builds MusicXML from compact token lists, one
source file per piece in `sources/<id>.py`. The token format is described at the top of
`musicxml_gen.py`: `c4/4` is a quarter-note C4, `[c3,e3,g3]/8` a half-note chord, `fs5/2` an
eighth-note F♯5, `r/4` a rest, `s/4` an invisible spacer; durations are in sixteenths.

The edition's markings go into the same token lists, and only those the edition prints. On a
note: `(` and `)` start and end a slur, `~` starts a tie, `!st` `!te` `!ac` `!ma` `!sts` are
staccato, tenuto, accent, strong accent and staccatissimo, `!fe` a fermata, `!m` `!p` `!tr`
`!trw`/`!w` `!t` `!it` the ornaments (mordent, inverted mordent, trill, trill with a wavy line
and its end, turn, inverted turn) with `!^s`-style accidental marks, `!c` a cautionary
accidental; `!f3` is the edition's finger for the note, on a chord one figure per note in the
order the chord is written (`[c4,e4,g4]/16!f421`, `_` for a note without one), and `!f4-5` a
change of finger on the held key; `g:` and `a:` before a note make it a grace note with and
without a slash. Between
notes, `@` tokens are directions at that place in the voice, on its staff: `@p` (any dynamic),
`@<` `@>` `@!` (hairpins), `@w:cresc.` (words, `_` for a space), `@dashes[`/`@dashes]`, and
`@Ped` `@Ped*` `@Ped*Ped` (the sustain pedal down, up and changed: Ped. and ✱ signs, or a
bracket line in a piece with `'pedal_lines': True`); `^` puts one above the staff
and `+N` moves it N sixteenths later (`@Ped*+5.5` in a piece with `'divisions': 8`), for a mark
that falls inside a note. For example `'@p g5/2( e5/2 d5/2 c5/2)'` is a slurred group marked
piano, and `'@Ped @Ped*+5.5 a2/1 e3/1 a3/1 r/1 r/2'` a bar pedalled until a thirty-second before
its end. A hairpin end (`@!`) that opens a bar is written at the end of the bar before, the same
moment, so it ends at the barline. Each source's comment says which markings come from which
edition file.

A lead sheet's chord symbols are tokens too: `@h:G7` puts a `<harmony>` at that place in the
voice, above its staff (`+N` as for directions). The symbol is the app's one style
(docs/HARMONY.md) in ASCII: a root (`C`, `Bb`, `F#`), then nothing, `m`, `dim`, `aug`, `sus2`,
`sus4`, `7`, `maj7`, `m7`, `m7b5`, `dim7`, `6`, `m6` or `add9`, then `/` and a bass (`D/F#`). The
`<kind>` gets the printed form as its `text` (`F♯°`, `Bm7♭5`), which Verovio draws as written.

A piece whose written end does not tell the mode of its key names it: `'mode': 'major'` (or
`'minor'`) writes `<mode>` into the key signature, which the Key control reads to name the key
(docs/HARMONY.md, "Transposing (H4)"). Only the Musette in D needs it: it ends on its dominant.

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
pitch; tied continuations are not presses, and two voices sounding one key together are one
press) with the MIDI file, which is independent of both the
encoding and the parser. `--order document` (the default) takes every written bar once with all
its endings, as a LilyPond MIDI file without `\unfoldRepeats` plays them; `--order play` unrolls
the repeats. `--bars` and `--midi-at` compare part of a file with another part of the oracle.
Notes the oracle plays off the sixteenth grid (grace notes, ornaments) are listed, not compared.
It prints `matched/total`, every difference with its bar, and exits non-zero on any difference.

`verify-library.sh` runs the check for every built-in piece and lists where to download the
oracles; they are not in the repository. The lead sheets have no oracle: each melody was read from a scan of
its source, bar by bar, and proofread blind by a second reader. Nor have the first pieces from
Türk, Beyer and Czerny (G5a): each was read from a scan of its edition and proofread the same
way, fingering included.

## Adding a piece

1. Pick one public-domain edition (a Mutopia source edition, or a scan marked public domain on
   IMSLP, at the Internet Archive or in a library's digital collection; for fingering, an
   edition whose editor died more than seventy years ago) and, if one exists, an oracle for it.
2. Encode it: a `sources/<id>.py` for `generate.py`, or a `pdmx/<id>.json` for `prepare-pdmx.ts`.
3. Run `verify.ts` until it matches, or have the piece read blind a second time; settle every
   difference against the edition and note any editorial decision in the file's comment.
4. Add the piece to `src/pieces/library/index.ts` (metadata, level) and its strings to every
   dictionary in `src/i18n/`.
5. Add it to `library.test.ts`: a checksum line, a markings line, a fingering line if it has
   any, and a test of its structure (bars, repeats).
6. Add the oracle to `verify-library.sh`, and a line to `THIRD_PARTY_NOTICES.md` if the encoding
   is not ours.

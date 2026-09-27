# Scale fingerings from Hanon

The fingering the Scales page shows (see [docs/SCALES.md](../../../docs/SCALES.md)) comes from
Charles-Louis Hanon, _The Virtuoso Pianist_, Nos. 39 (the major and minor scales) and 40 (the
chromatic scales), transcribed digit by digit from a public-domain scan. This folder holds the
transcription and the tools that check and expand it. Every command runs from this folder.

## Source

- **Edition:** G. Schirmer, New York, n.d. [1900], plate 15538 (LMC 925), English text by Theodore
  Baker; no editor named. Public domain in the US (published before 1930) and in the EU (Hanon died
  in 1900, Baker in 1934). IMSLP marks it public domain. Not compared with the 1873 French original.
- **Scan:** IMSLP #91547, 600 dpi,
  <https://imslp.org/wiki/The_Virtuoso_Pianist_(Hanon,_Charles-Louis)> (file
  `PMLP03129-Hanon_Final.pdf`, sha1 `f53906b31b484493f8fd3433c6496cf073bac239`). No. 39 is on
  printed pages 50–61 (PDF 51–62), No. 40 on printed pages 62–64 (PDF 63–65).
- **Second copy of the same plate:** IMSLP #00875 (Part II, 300 dpi), used only to settle damaged
  glyphs.

## What Hanon prints

- No. 39: the twelve majors in fourths (C F B♭ E♭ A♭ D♭ G♭ B E A D G), each followed by its relative
  minor twice: "1." harmonic and "2." melodic (raised 6th and 7th going up, natural going down).
  Hands an octave apart, four octaves, sixteenths in 2/4 with a repeat. He prints the first octave
  in full, then the thumbs and the crossings and some turns. There is no natural minor.
- No. 40: the chromatic scale at the octave (four octaves), at a minor third, a major sixth and a
  minor sixth, in contrary motion from the octave, the minor third and the major third, and "another
  fingering … for legato passages", every note fingered.

## Files

- `pass1/data.py`, `pass1/data40.py` — the first reading: only the digits Hanon printed, by note
  index (0–28 up, 28–55 down; 55 is the second degree before the repeat).
- `pass2/data_A.py`, `data_B.py`, `data_C.py` — a second, independent reading by three readers who
  did not see the first.
- `diff.py` — compares the two readings digit by digit: `python3 diff.py`. No. 39 has no difference;
  No. 40 had one, settled at 1200 dpi (see `uncertain.md`).
- `build.py` — expands a reading into `hanon.json` (`python3 build.py pass1 hanon.json`): digits
  Hanon did not print are filled by the thumb-crossing rule and marked in `printed`; the closing
  tonic takes the printed starting finger. Rebuilding gives the committed file byte for byte.
- `../fingering.ts` — writes `src/core/scaleFingering.ts` from `hanon.json` through the pure
  transform in `src/core/hanonData.ts`, the correction applied: run
  `node --experimental-strip-types scripts/scales/fingering.ts` from the repository root.
- `uncertain.md` — the doubtful digits and how each was read. The crop images it names were made
  from the scan during the transcription and are not kept; any page can be cut again from the PDF.
- `differences.md` — where Hanon differs from the fingering commonly taught (from memory of the
  ABRSM and RCM books, not checked against one).

## How dacapo uses it

Decided in S0 (the reasons are in `docs/SCALES.md`, Clarifications):

- Hanon's fingering as printed, octave by octave, for runs of one to four octaves; the turn at the
  top as he prints it, and the closing tonic with his starting finger.
- One correction: D major, left hand, the E before the repeat is printed 1 (on both copies of the
  plate); the pattern and the 5 on the following D make it 4, and dacapo uses 4.
- F♯ major takes Hanon's G♭ major (the same keys, so the same fingering).
- Natural minor has no fingering (Hanon prints none).
- Chromatic scales take the fingering at the octave from No. 40.

# Hanon: the scale fingerings and the technique exercises

The fingering the Scales page shows (see [docs/SCALES.md](../../../docs/SCALES.md)) comes from
Charles-Louis Hanon, _The Virtuoso Pianist_, Nos. 39 (the major and minor scales), 40 (the
chromatic scales) and 41 (the arpeggios on the triads), transcribed digit by digit from a
public-domain scan; and its technique exercises Hanon Nos. 1–20 are his Part I, transcribed note
by note and digit by digit from the same scan (`part1/`). This folder holds the transcriptions and
the tools that check and expand them. Every command runs from this folder (Part I's from
`part1/`).

## Source

- **Edition:** G. Schirmer, New York, n.d. [1900], plate 15538 (LMC 925), English text by Theodore
  Baker; no editor named. Public domain in the US (published before 1930) and in the EU (Hanon died
  in 1900, Baker in 1934). IMSLP marks it public domain. Not compared with the 1873 French original.
- **Scan:** IMSLP #91547, 600 dpi,
  <https://imslp.org/wiki/The_Virtuoso_Pianist_(Hanon,_Charles-Louis)> (file
  `PMLP03129-Hanon_Final.pdf`, sha1 `f53906b31b484493f8fd3433c6496cf073bac239`). No. 39 is on
  printed pages 50–61 (PDF 51–62), No. 40 on printed pages 62–64 (PDF 63–65), No. 41 on printed
  pages 65–68 (PDF 66–69). Part I: No. n on printed page n + 1 (PDF n + 2), No. 1 running on to
  the top of the next page.
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

- No. 41, "Arpeggios on the Triads, in the 24 Keys": the twelve majors in fourths, each followed by
  its relative minor, four octaves of the root-position triad, hands an octave apart, sixteenths
  in 3/4 (25 notes a hand: the top on the first beat of the second bar, the closing root a half
  note in a bar of its own). He prints the first octave and the crossings, the top, and the
  closing root in most keys.

- Part I, Nos. 1–20: both hands an octave apart, the right hand in octave 3 and the left in
  octave 2 (Nos. 1–11 and 14–19 from C, No. 12 from G, Nos. 13 and 20 from E), in 2/4, sixteenths,
  each bar one group of eight moved a step higher in each bar of the ascending half (14 bars; 15 in
  No. 20) and its mirrored form a step lower in each bar of the descending half (14 bars; 15 in
  Nos. 1, 12 and 20, 13 in No. 17), then a closing half note (No. 20: a chord in each hand). A few
  bars depart from the group: the last ascending bar and the last descending bar end differently
  in Nos. 6, 12, 15, 17 and 20, the last descending bar in No. 9, and No. 12's first bar opens with
  a fifth where its other bars have a sixth. He prints the full fingering in the first bars and
  then, "for brevity" (the footnote to No. 1), only the fingers each exercise trains.

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
- `pass1/data41.py`, `pass2/data41_A.py`, `data41_B.py`, `diff41.py`, `build41.py`,
  `hanon41.json` — the same for No. 41: the first reading of all 24 keys by one reader, the second
  by two others who did not see it (pages 66–67 and 68–69), and `python3 diff41.py` finds no
  difference. `python3 build41.py pass1 hanon41.json` fills the digits Hanon did not print by the
  rules in its header and checks them against what he does print (by the octave, by the same key
  the other way, the top when the hand takes the root with the thumb: the right hand's 5, as in all
  14 keys that start the right hand on the thumb and print the top, the left hand's 1, as in all 15
  keys that put the left thumb on the root and print it; the closing root the starting finger, as
  in all 36 hand-runs that print both). Each filled digit is marked with its rule in `inferred`.
- `uncertain.md` — the doubtful digits and how each was read. The crop images it names were made
  from the scan during the transcription and are not kept; any page can be cut again from the PDF.
- `differences.md` — where Hanon differs from the fingering commonly taught (from memory of the
  ABRSM and RCM books, not checked against one).
- `part1/` — Part I. `passA/` and `passB/` are two independent readings, four readers each, who
  did not see the other reading: per exercise the first bar of each half in full (both hands, at
  sounding pitch), the first note of every bar, every bar that is not its half's first bar moved
  by step (in full), the closing bar, and every printed digit by bar, hand and note, with the
  doubtful places in `uncertain`. `python3 diff_part1.py` compares them (31 differences in the
  first readings, all in bar counts, three irregular bars and two digits); `resolved.py` settles
  each against the plate, and `python3 build_part1.py passA part1.json` expands the reading so
  settled into every note and digit and checks it (every bar starts where it was read, the bars of
  a half a step apart, the hands an octave apart, every digit on a note). Rebuilding gives the
  committed `part1.json` byte for byte. `../hanonPartOne.ts` writes `src/core/hanonPartOne.ts` from
  it (`node --experimental-strip-types scripts/scales/hanonPartOne.ts` from the repository root);
  a test rebuilds and compares, and a checksum locks every note and digit. The drawn scores were
  then compared with the plates bar by bar.

## How dacapo uses it

Decided in S0 (the reasons are in `docs/SCALES.md`, Clarifications):

- Hanon's fingering as printed, octave by octave, for runs of one to four octaves; the turn at the
  top as he prints it, and the closing tonic with his starting finger.
- One correction: D major, left hand, the E before the repeat is printed 1 (on both copies of the
  plate); the pattern and the 5 on the following D make it 4, and dacapo uses 4.
- F♯ major takes Hanon's G♭ major (the same keys, so the same fingering).
- Natural minor has no fingering (Hanon prints none).
- Chromatic scales take the fingering at the octave from No. 40.
- Arpeggios take No. 41 as printed and filled, cut to fewer octaves where his fingering repeats
  (every pair of neighbouring fingers is one he prints on the same notes); F♯ major takes his G♭
  major. Contrary motion (decided in S5) plays each hand's own runs: the right hand as in parallel
  motion, the left hand his descent from the top and then his ascent.
- Part I (decided in S6): every note as printed, and his digits as printed and nowhere else (a
  note he leaves unfingered has no finger), with no correction.

# Uncertain digits and sanity-check findings

Source: G. Schirmer [1900], IMSLP #91547 (`IMSLP91547-PMLP03129-Hanon_Final.pdf`, sha1 f53906b3…, 600 dpi).
A second physical copy of the same plate (IMSLP #00875, `IMSLP00875-Hanpart2.pdf`, Part II, 300 dpi) was used
to settle damaged glyphs. Paths are relative to this folder.

## Verification

Every scale was read twice, independently: pass 1 by me (`pass1/`), pass 2 by three separate readers who
did not see pass 1 (`pass2/data_A.py`, `data_B.py`, `data_C.py`). `diff.py` compares every printed digit,
key, mode and starting pitch.

- No. 39 (36 scales, 2 hands): **0 differences.**
- No. 40 (8 forms, 2 hands): **1 difference**, resolved (item 6 below).

Indices: 0..28 ascending, 28..56 descending (as in `hanon.json`: `rightUp[i]` = index i,
`rightDown[j]` = index 28 + j).

## Uncertain or doubtful digits

| #   | Scale                                          | Hand, index (note)                      | Reading            | Why doubtful                                                                                                                                                                                                                                                                                           | Crops                                                                                      |
| --- | ---------------------------------------------- | --------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | No. 39 D harmonic minor (PDF p. 52)            | LH 31 (A5, bar 4 last note)             | **1**              | Glyph damaged in #91547 (only the top and foot survive). Clean **1** in the second copy #00875. Both readers read 1.                                                                                                                                                                                   | `zoom/p052_Dm1_bar4_LH.png`, `alt/alt30_Dm1_bar4_LH.png`, `pass2/zoomA/t_c52s3b4_lh31.png` |
| 2   | No. 39 D major (p. 61)                         | LH 55 (E2, last note before the repeat) | **1 (as printed)** | Two 1s are stacked; the upper one sits under the D-major LH beam end, the lower one belongs to 1. B minor RH (B5). Both copies show it, so it is on the plate. Musically implausible: the pattern gives 4, and 5 on D2 follows on the repeat. Probably an engraving slip; kept as printed and flagged. | `zoom/p061_D_bar7_end_x3.png`, `alt/alt39_Dmaj_bar7end.png`, `pass2/zoomB/c61_s2b7.png`    |
| 3   | No. 39 B♭ major (p. 53)                        | LH 54 (D2)                              | 1                  | The digit sits low in the gap between systems, just left of the next system's 8va sign; attribution to B♭ major (not G minor) by position, and D=1 fits the pattern. Both readers agree.                                                                                                               | `zoom/p053_Gm1_bar3.png`, `pass2/zoomA/c53_s2_b7.png`                                      |
| 4   | No. 39 B♭ harmonic minor (p. 56)               | LH 55 (C2)                              | 1                  | Near the next system's RH "1"; attributed by position; matches the pattern and the melodic form.                                                                                                                                                                                                       | `pass2/zoomA/c56_s4_b7.png`                                                                |
| 5   | No. 39 A melodic minor (p. 51)                 | LH 28, 31                               | 1                  | Glyphs crossed by a staff line (can look like 4); shape is 1.                                                                                                                                                                                                                                          | `pass2/zoomA/t_c51s5b4_lh.png`                                                             |
| 6   | No. 40 contrary motion from the octave (p. 65) | LH bar 2, note 1 (C3)                   | **1**              | Pass 1 read 4, pass 2 read 1. A bass-staff line crosses the glyph; at 1200 dpi the flag merges into the stem like a 1 and there is no detached diagonal as in a real 4. 1 also fits (B2 = 2 before it). Resolved to 1.                                                                                 | `zoom/p065_con8_bar2_LH.png`, `pass2/zoomC/c8_2start.png`, `pass2/zoomC/qcmp.png`          |
| 7   | No. 40 contrary motion from the major third    | RH bar 2, notes 6, 8, 10 (B4, A4, G4)   | 1                  | Same staff-line-crossed 1s; both readers read 1.                                                                                                                                                                                                                                                       | `pass2/zoomC/gcmp.png`                                                                     |
| 8   | No. 40 contrary motion from the minor third    | RH bar 2, note 12 (E4)                  | 1                  | Same.                                                                                                                                                                                                                                                                                                  | `pass2/zoomC/q_cm3b2p12.png`                                                               |
| 9   | No. 40 legato fingering                        | LH bar 1 note 3; bar 2 notes 1, 3       | 1                  | Same.                                                                                                                                                                                                                                                                                                  | `pass2/zoomC/lcmp.png`, `pass2/zoomC/lgLH2big.png`                                         |
| 10  | No. 39 E major, E minor (pp. 59, 62)           | LH 0                                    | 5                  | The "5" sits low, near the next system's 8va sign; it is on the LH digit baseline.                                                                                                                                                                                                                     | `pass2/zoomB/t59_s1_1.png`                                                                 |

## Digits that are not printed (so the JSON value is inferred)

The `printed` arrays in `hanon.json` mark every literal digit. Notable gaps inside the first octave or at
turning points (all filled by the thumb-crossing rule, see `build.py`):

- C major LH 6 (B2); G melodic minor LH 6–7 (F♯2, G2); A♭ major RH 6–8; D♭ major RH 7; E♭ harmonic minor
  RH 6–7 and LH 7; C♯ and F♯ melodic minor RH 7; F♯ harmonic minor RH 3, 4, 6, 7; B♭ melodic minor LH 27.
- Top notes not printed: A harmonic minor LH (rule gives 1); C melodic minor RH (rule gives 5).
- The closing tonic of every No. 39 run (last element of `rightDown`/`leftDown`) is never printed. The run
  before the repeat ends on the 2nd degree; the JSON uses the printed starting finger. For B♭, E♭ majors and
  B♭, E♭ minors the plain crossing rule would not produce that finger by itself (RH thumb on the 2nd degree,
  then the tonic takes the start finger 2).

## Sanity checks (reported, not fixed)

- **Thumb on a black key:** none, in any scale or form, printed or inferred.
- **Octave groups:** in every No. 39 run (both hands, both directions, printed + inferred) consecutive thumbs
  are 3 or 4 notes apart, i.e. every octave is 1-2-3 + 1-2-3-4 (or the reverse). The left-hand top turn on
  black-key tonics puts the thumb on the note below the top on both sides (e.g. A1 B♭2 A1).
- **Top/bottom fingers:** RH top 5 (C G D A E B majors; A E B D G C minors), 4 (F, B♭ majors; F, B♭ minors),
  3 (E♭, A♭, G♭ majors; E♭, G♯, C♯, F♯ minors), 2 (D♭ major). LH top 1 (white-key tonics), 2 (all black-key
  tonics). Bottom (start) RH 1 on white-key tonics and 2 on black-key tonics; LH 5 (C G D A E F majors and
  their minors), 4 (B, G♭ majors; B, F♯ minors), 3 (B♭ E♭ A♭ D♭ majors; C♯ G♯ minors), 2 (B♭, E♭ minors).
  So "bottom note uses 5" fails for all these left-hand starts on black keys and B; that is Hanon's (and the
  standard) fingering, not a reading error.
- **Descending digits vs reversed ascending pattern:** they agree everywhere except (a) the repeat-leading
  3 on the 2nd degree (A♭ major; G♯, C♯, F♯ minors), (b) the melodic minors whose natural descending form
  needs a different fingering (C♯ and F♯ RH, G♯ LH), and (c) D major LH 55 (item 2).
- **Note counts:** No. 39 = 29 notes up + 27 down + inferred tonic per hand; No. 40 = 12 notes per bar in
  every bar of every form.

## Part I, Nos. 1–20 (PDF pp. 3–22)

Read twice independently (`part1/passA/`, `part1/passB/`, four readers each). `part1/diff_part1.py`
found 31 differences, every one settled on the plate (`part1/resolved.py`):

- **Bar counts.** passA gave Nos. 2, 3 and 4 fifteen descending bars, as No. 1 has; the plates
  have fourteen (systems of 5, 6, 6, 6 and 5 bars and the closing bar), as passB read. passB gave
  No. 12 fourteen; its plate has fifteen (five systems of 5, 6, 6, 6 and 6 bars), as passA read.
  Counted system by system at 130 dpi.
- **Irregular bars.** The last bar before the closing bar of No. 6 ends on E3 (E2) where the group
  moved by step gives C3, and of No. 9 on D3 E3 where it gives C3 D3: passB read both in full,
  passA took them as regular. Checked at 300 dpi.
- **Two digits on the top line of the treble staff.** No. 9 bar 6, the right hand's first note
  (A3): passA read 4, passB 1. No. 13 bar 6, the right hand's second note (A3): passA read 1,
  passB 4. The staff line closes the long flag of a 1 into what looks like a 4's counter, and at
  1200 dpi by eye each looked like a 4. Matched against the clean digits of the same page (its 1s
  and 4s away from any line, the staff line's rows masked), each is a 1: as tall as the 1s (86 px;
  the 4s are 92–96) and overlapping them by 0.65–0.81 against 0.29–0.62 for the 4s; No. 45's
  first fingering has the same glyph on the same line where its pattern needs a 1 (0.83 against
  0.48). The thumb, as the fingering printed in full and every other bar have it. No correction.

The places both readers marked doubtful and read alike: digits crossed by a staff line (1s that
look like 4s, read by the glyph's width and flag: No. 6 bars 5–6, 7 bar 7, 10 bars 12–14, 11 bar
5); damaged digits (No. 3 bar 4 LH 5, bar 17 RH 2; No. 11 bar 21 LH 1, No. 19 bar 26 LH 3); blotted
note heads read by position (No. 3 bar 18 LH D4, No. 16 bar 18 LH D4, bar 24 RH E4); No. 20's
closing chord, whose E3 and C3 heads touch both stems (the up-stem stops at E3: RH E3+C4, LH
C2+C3); and specks taken for dirt (Nos. 2, 3, 6, 7, 9, 10, 11, 17). Digits printed irregularly are
recorded as printed, not filled in: No. 7 bar 14 RH 3 where bars 3–13 have 4, No. 8 bar 28 LH none,
No. 12 bar 20 LH no 3, No. 17 bar 7 RH no 5, No. 18 bar 7 LH only 1, No. 20 bar 7 RH 1 2 4 and a 4.

## Nos. 42–53 (PDF pp. 70–95)

Read twice independently (`s7/passA/`, `s7/passB/`, six readers each). `s7/diff_s7.py` found one
difference in every note, value and digit of the 54 parts: No. 45, first fingering, bar 1, the
left hand's fourth step, which passA read 1 and passB 4. It sits on the bass staff's top line,
which closes a 1's flag into a 4's counter (as Part I's Nos. 9 and 13); matched against the clean
digits of the page at 1200 dpi, the line masked, it is a 1 (overlap 0.83 with the 1s, 0.48 with the
4s), the 1 of the printed 2 1 2 1 2 1. The places the readers marked doubtful and read alike are in
their files' `uncertain` lists; the notable ones: No. 50's legato scale, whose held half notes are
steps like the others (the keys held are named in its marks); No. 53's sections, each running on
into the next key without its tonic; the one printed 4 of No. 53 (A minor's G♯) and its footnote.

Four more readers compared every drawn score with its plate bar by bar (at 300 dpi, 600 where in
doubt): no difference in Nos. 42–44, 46, 47, 51 and 53, and these, each settled in `s7/resolved.py`
or here:

- **No. 45, 5th fingering, bar 1, LH step 3 (E3).** Both passes and the verifier read **4**,
  seeing a 4's closed counter above the bass staff's top line, where the printed pattern 3 1 3 1
  3 1 needs a 1. Measured at 1200 dpi it is a **1**: the tip of its flag touches the line and closes
  the gap under the flag into that counter. It is 88 px tall and 63 wide, as the page's clean 1s
  (82–90 by 54–62) and not its 4s (92–96 by 84–90); its part above the line is 42 px wide, as a
  1's; matched against the clean digits with the line masked, overlap 0.81–0.87 with the 1s and at
  most 0.51 with the 4s. Corrected to 1 (`resolved.py`), the one digit changed from both readings.
- **No. 50, chromatic scale in minor thirds: three naturals the plate leaves out.** Bar 3, step 7
  (both hands): only the flat is printed, after the G♯ of step 5, where bars 1 and 2 print the
  natural (G+B♭); bar 6, step 11 (both hands): only the sharp on C, after the E♭ of step 9, where
  bars 4 and 5 print the natural (C♯+E); bar 6, right hand step 8, E+G on the bass staff after the
  left hand's E♭ at step 0, where bars 4 and 5 print a natural in both hands. Both passes read the
  naturals, and so does dacapo: the scale is in minor thirds throughout, and the plate prints each
  of these naturals in the two bars before.
- **No. 50, chromatic scale, closing bar.** A half-note chord and a quarter rest in each hand
  (3/4); both passes name the rest in the bar's marks, which the steps cannot carry, so
  `resolved.py` adds it and the score draws it (the first version drew a dotted half).
- **No. 42 on F, bar 4, the left hand's first digit** is a damaged glyph; it is read 1, as every
  other section prints there. **No. 43's closing chord** splits E3 G3 C4 (right hand, 1 2 5) and
  C2 E2 G2 C3 (left hand) by the stems and the digits beside the heads; the stems are partly hidden
  by the heads.
- Digits read as 1 though they look like 4s on a staff line, as above (verified at 600 dpi): No. 50's
  legato scale bar 1 RH step 6, and its chromatic scale bar 1 RH step 9, bar 2 RH step 0 and bar 3
  LH step 1.

## No. 41 (arpeggios, PDF pp. 66–69)

Read twice independently: `pass1/data41.py` (all 24 keys) and `pass2/data41_A.py`,
`data41_B.py` (two readers, pages 66–67 and 68–69); `diff41.py` finds **no difference** in any digit,
key, mode or starting note. The doubtful digits, each read the same way by both passes:

| #   | Scale               | Hand, index (note)         | Reading | Why doubtful                                                                                                                                                                                                                                                    |
| --- | ------------------- | -------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | C minor (p. 66)     | LH 21 (C3, bar 2)          | **1**   | Damaged glyph in #91547: a stray diagonal on the left and a gap across the middle, so a broken 4 could not be ruled out at 600 dpi. Clean **1** in the second copy (IMSLP #00875, PDF p. 45), and 1 is the finger of C through every other octave both ways.    |
| 2   | B minor (p. 68)     | RH 3 (B3)                  | 1       | Sits above the right end of the first beam, just left of the next group; given to B3 by position, and the thumb on the root fits every other octave.                                                                                                            |
| 3   | E♭ major (p. 66)    | LH 4 (G3) and 5 (B♭3)      | –, 4    | No digit under G3; the 4 stands under B♭3. Both readers agree. The filled G3 takes 1 by the octave, as every other G of the run.                                                                                                                                |
| 4   | several (pp. 66–69) | digits on or across a line | as read | 1s crossed by a staff or ledger line (they can look like 4s); each was zoomed and has the notched top and no diagonal of a 1, and the 4s their diagonal: C major LH 15; F major LH 18; D minor LH 12–15, 18; B♭ major LH 9, 12–16; B major RH 3; E major LH 18. |

Notable places with no printed digit (filled by the rules of `build41.py`): D minor and A major
RH 12–15 (the top group), C major LH 12, G minor LH 13–14, the closing root of the majors G♭, B,
E, A, D and G, and D♭ major RH 11.

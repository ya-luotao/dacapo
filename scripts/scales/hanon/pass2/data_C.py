# Hanon No. 40 "Chromatic Scales" -- independent pass-2 transcription (reader C)
# Source: IMSLP91547-PMLP03129-Hanon_Final.pdf, PDF pp. 63-65 (printed 62-64).
# Read from 600-dpi renders (pass2/zoomC/z-06N.png) and, for doubtful glyphs, a 1200-dpi
# render of p.65 (pass2/zoomC/zz-065.png). Crops referenced below live in pass2/zoomC/.
#
# Pitch conventions: scientific pitch, C4 = middle C. 8va lines applied (on pp.63/64 the 8va
# covers the whole upper staff, i.e. BOTH voices when RH and LH share the treble staff).
#
# GLYPH WARNING (important for anyone re-checking): in this engraving a "1" whose left flag
# touches a staff line looks like a flat-topped "4" at 300/600 dpi (the staff line closes the
# flag into a triangle). A genuine "4" in this font has a detached slanted top stroke and a
# crossbar extending right of the stem. Every such case was checked at 1200 dpi and is listed
# in `uncertain` (all resolved to 1).

C = []
A12 = lambda s: [int(c) for c in s.split()]

# ---------------------------------------------------------------- p.63 (printed 62)
C.append(dict(variant='octave', header='At an octave.', pdf=63, printed_page=62,
  rh_start='C3', lh_start='C2', octaves=4,
  RH=dict(first='up', bars=[
    A12('1 3 1 3 1 2 3 1 3 1 3 1'),   # b1 C3 up (bass staff, upper voice, digits above)
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b2 C4 up
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b3 C5 up
    A12('2 3 1 3 1 2 3 1 3 1 3 4'),   # b4 C6 up (8va)
    A12('5 4 3 1 3 1 3 2 1 3 1 3'),   # b5 turning top C7 (8va), down
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b6 C6 down
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b7 C5 down (digits below)
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b8 C4 down (bass staff, upper voice)
  ], final=1),                        # half note C3
  LH=dict(first='up', bars=[
    A12('4 3 1 3 2 1 3 1 3 1 3 2'),   # b1 C2 up (bass staff, lower voice, digits below)
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b2 C3 up
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b3 C4 up (treble clef)
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b4 C5 up
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b5 turning top C6, down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b6 C5 down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b7 C4 down (bass clef)
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b8 C3 down (lower voice, digits below)
  ], final=4),                        # half note C2
  uncertain={'RH': {}, 'LH': {}},
  note=''))

C.append(dict(variant='minorThird', header='At a minor third.', pdf=63, printed_page=62,
  rh_start='Eb2', lh_start='C2', octaves=4,
  RH=dict(first='up', bars=[
    A12('3 1 2 3 1 3 1 3 1 2 3 1'),   # b1 Eb2 up (upper voice of the paired noteheads, digits above)
    A12('3 1 2 3 1 3 1 3 1 2 3 1'),   # b2 Eb3
    A12('3 1 2 3 1 3 1 3 1 2 3 1'),   # b3 Eb4 (treble staff)
    A12('3 1 2 3 1 3 1 3 1 2 3 1'),   # b4 Eb5
    A12('3 1 3 2 1 3 1 3 1 3 2 1'),   # b5 turning top Eb6, down
    A12('3 1 3 2 1 3 1 3 1 3 2 1'),   # b6 Eb5
    A12('3 1 3 2 1 3 1 3 1 3 2 1'),   # b7 Eb4 (bass staff)
    A12('3 1 3 2 1 3 1 3 1 3 2 1'),   # b8 Eb3
  ], final=3),                        # half note Eb2
  LH=dict(first='up', bars=[
    A12('4 3 1 3 2 1 3 1 3 1 3 2'),   # b1 C2 up (lower voice, digits below)
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b2 C3
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b3 C4
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b4 C5
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b5 turning top C6, down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b6 C5
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b7 C4
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b8 C3
  ], final=4),                        # half note C2
  uncertain={'RH': {}, 'LH': {}},
  note='No 8va in this form; RH and LH share one staff throughout (RH = upper notehead, stems up, digits above).'))

# ---------------------------------------------------------------- p.64 (printed 63)
C.append(dict(variant='majorSixth', header='At a major sixth.', pdf=64, printed_page=63,
  rh_start='C3', lh_start='Eb2', octaves=4,
  RH=dict(first='up', bars=[
    A12('1 3 1 3 1 2 3 1 3 1 3 1'),   # b1 C3 up
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b2 C4
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b3 C5
    A12('2 3 1 3 1 2 3 1 3 1 3 4'),   # b4 C6 (8va)
    A12('5 4 3 1 3 1 3 2 1 3 1 3'),   # b5 turning top C7 (8va), down
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b6 C6
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b7 C5
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b8 C4
  ], final=1),                        # half note C3
  LH=dict(first='up', bars=[
    A12('3 2 1 3 1 3 1 3 2 1 3 1'),   # b1 Eb2 up
    A12('3 2 1 3 1 3 1 3 2 1 3 1'),   # b2 Eb3
    A12('3 2 1 3 1 3 1 3 2 1 3 1'),   # b3 Eb4 (treble staff, shared with RH, digits below)
    A12('3 2 1 3 1 3 1 3 2 1 3 1'),   # b4 Eb5 (written Eb4 under the staff's 8va)
    A12('3 1 3 1 2 3 1 3 1 3 1 2'),   # b5 turning top Eb6 (8va), down
    A12('3 1 3 1 2 3 1 3 1 3 1 2'),   # b6 Eb5
    A12('3 1 3 1 2 3 1 3 1 3 1 2'),   # b7 Eb4 (bass staff)
    A12('3 1 3 1 2 3 1 3 1 3 1 2'),   # b8 Eb3
  ], final=3),                        # half note Eb2
  uncertain={'RH': {}, 'LH': {}},
  note='Bars 4-5: both voices share the treble staff under one 8va line; applying it to the LH too gives the continuous Eb2..Eb6 line (without it LH b4 would repeat b3).'))

C.append(dict(variant='minorSixth', header='At a minor sixth.', pdf=64, printed_page=63,
  rh_start='C3', lh_start='E2', octaves=4,
  RH=dict(first='up', bars=[
    A12('1 3 1 3 1 2 3 1 3 1 3 1'),   # b1 C3 up
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b2 C4
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b3 C5
    A12('2 3 1 3 1 2 3 1 3 1 3 4'),   # b4 C6 (8va)
    A12('5 4 3 1 3 1 3 2 1 3 1 3'),   # b5 turning top C7 (8va), down
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b6 C6
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b7 C5
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b8 C4
  ], final=1),                        # half note C3
  LH=dict(first='up', bars=[
    A12('5 4 3 1 3 1 3 2 1 3 1 3'),   # b1 E2 up
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b2 E3
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b3 E4 (treble staff, digits below)
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b4 E5 (written E4 under 8va)
    A12('1 3 1 3 1 2 3 1 3 1 3 1'),   # b5 turning top E6 (8va), down
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b6 E5
    A12('2 3 1 3 1 2 3 1 3 1 3 1'),   # b7 E4 (bass staff, digits above)
    A12('2 3 1 3 1 2 3 1 3 1 3 4'),   # b8 E3
  ], final=5),                        # half note E2
  uncertain={'RH': {}, 'LH': {}},
  note=('LH begins E2 with 5 4 (E-F) and ends b8 with 4 on F2 before final 5 on E2. '
        'LH turning bar b5 starts with 1 on E6, whereas the following descending bars b6-b8 start with 2 on E. '
        'Same 8va-on-shared-staff reading as majorSixth.')))

# ---------------------------------------------------------------- p.65 (printed 64)
C.append(dict(variant='contraryOctave', header='In contrary motion, beginning on the octave.', pdf=65, printed_page=64,
  rh_start='C6', lh_start='C2', octaves=2,
  RH=dict(first='down', bars=[
    A12('5 4 3 1 3 1 3 2 1 3 1 3'),   # b1 C6 down
    A12('2 1 3 1 3 1 3 2 1 3 1 3'),   # b2 C5 down
    A12('1 3 1 3 1 2 3 1 3 1 3 1'),   # b3 turning bottom C4, up
    A12('2 3 1 3 1 2 3 1 3 1 3 4'),   # b4 C5 up
  ], final=5),                        # half note C6
  LH=dict(first='up', bars=[
    A12('4 3 1 3 2 1 3 1 3 1 3 2'),   # b1 C2 up (digits below)
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b2 C3 up (digits above)
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b3 turning top C4, down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b4 C3 down (digits below)
  ], final=4),                        # half note C2
  uncertain={'RH': {},
    'LH': {(2, 1): 'Looks like "4" at 300/600 dpi, but at 1200 dpi it is a "1" whose flag touches the bass-staff line (no detached slanted stroke of a real 4). Read as 1. Crops: zoomC/c8_2start.png, zoomC/q_c8b2lh1.png (middle glyph of zoomC/qcmp.png).'}},
  note='LH b2 pos1 is a staff-line-crossed "1" that mimics a 4 at low resolution (see uncertain).'))

C.append(dict(variant='contraryMinorThird', header='In contrary motion, beginning on the minor third.', pdf=65, printed_page=64,
  rh_start='Eb6', lh_start='C2', octaves=2,
  RH=dict(first='down', bars=[
    A12('3 1 3 2 1 3 1 3 1 3 2 1'),   # b1 Eb6 down
    A12('3 1 3 2 1 3 1 3 1 3 2 1'),   # b2 Eb5 down
    A12('3 1 2 3 1 3 1 3 1 2 3 1'),   # b3 turning bottom Eb4, up
    A12('3 1 2 3 1 3 1 3 1 2 3 1'),   # b4 Eb5 up
  ], final=3),                        # half note Eb6
  LH=dict(first='up', bars=[
    A12('4 3 1 3 2 1 3 1 3 1 3 2'),   # b1 C2 up
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b2 C3 up
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b3 turning top C4, down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b4 C3 down
  ], final=4),                        # half note C2
  uncertain={
    'RH': {(2, 12): 'Digit over E4 (last note of b2) looks like "4" at 300/600 dpi; at 1200 dpi it is a "1" crossed by a treble-staff line. Read as 1. Crops: zoomC/cm3_2end.png, zoomC/q_cm3b2p12.png (left glyph of zoomC/qcmp.png).'},
    'LH': {}},
  note='RH b2 pos12 is a staff-line-crossed "1" that mimics a 4 (see uncertain).'))

C.append(dict(variant='contraryMajorThird', header='In contrary motion, beginning on the major third.', pdf=65, printed_page=64,
  rh_start='E6', lh_start='C2', octaves=2,
  RH=dict(first='down', bars=[
    A12('4 3 1 3 2 1 3 1 3 1 3 2'),   # b1 E6 down
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b2 E5 down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b3 turning bottom E4, up
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b4 E5 up
  ], final=4),                        # half note E6
  LH=dict(first='up', bars=[
    A12('4 3 1 3 2 1 3 1 3 1 3 2'),   # b1 C2 up
    A12('1 3 1 3 2 1 3 1 3 1 3 2'),   # b2 C3 up
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b3 turning top C4, down
    A12('1 2 3 1 3 1 3 1 2 3 1 3'),   # b4 C3 down
  ], final=4),                        # half note C2
  uncertain={
    'RH': {(2, 6): 'Over B4, sits on top treble line; looks like "4" at 600 dpi, 1200 dpi shows a line-crossed "1" (flag closed by staff line into a triangle). Read as 1. Crops: zoomC/cM3_2x.png, zoomC/g6.png, zoomC/gcmp.png, zoomC/kcmp2.png (real 4 for comparison = first glyph).',
           (2, 8): 'Over A4, on top treble line; same line-crossed "1" appearance as pos 6. Read as 1. Crops: zoomC/g8.png, zoomC/gcmp.png.',
           (2, 10): 'Over G4, crossed by second treble line; same line-crossed "1" appearance. Read as 1. Crops: zoomC/g10.png, zoomC/gcmp.png.'},
    'LH': {}},
  note=('RH b2 at 300/600 dpi reads "1 3 1 3 2 4 3 4 3 4 3 2"; the three "4"s are staff-line-crossed "1"s (verified at 1200 dpi '
        'against clean 1s in the same bar and the clean 4 at b1 pos1). Recorded as 1 3 1 3 2 1 3 1 3 1 3 2.')))

C.append(dict(variant='legato', header='Another fingering, which we particularly recommend for legato passages.', pdf=65, printed_page=64,
  rh_start='C4', lh_start='C3', octaves=2,
  RH=dict(first='up', bars=[
    A12('1 2 3 4 1 2 3 1 2 3 4 1'),   # b1 C4 up
    A12('2 3 1 2 1 2 3 1 2 3 4 1'),   # b2 C5 up
    A12('3 1 4 3 2 1 3 2 1 2 1 3'),   # b3 turning top C6, down
    A12('2 1 4 3 2 1 3 2 1 4 3 2'),   # b4 C5 down
  ], final=1),                        # half note C4
  LH=dict(first='up', bars=[
    A12('3 2 1 3 2 1 4 3 2 1 3 2'),   # b1 C3 up (bass, digits above)
    A12('1 2 1 3 2 1 4 3 2 1 3 2'),   # b2 C4 up (treble, digits below)
    A12('1 2 3 1 2 3 4 1 2 3 1 2'),   # b3 turning top C5, down (digits below)
    A12('1 2 3 1 2 3 4 1 2 3 1 2'),   # b4 C4 down (bass, digits above)
  ], final=3),                        # half note C3
  uncertain={
    'RH': {},
    'LH': {(1, 3): 'Over D3, sits on top bass-staff line; looks like "4" at 600 dpi but 1200 dpi shows a line-crossed "1" (cf. real 4 at pos 7). Read as 1. Crops: zoomC/lgLH1.png, zoomC/l3.png (first glyph of zoomC/lcmp.png), zoomC/l7.png.',
           (2, 1): 'Under C4, crossed by top bass-staff line; clearly 1 at 1200 dpi. Crop: zoomC/l2_1.png, zoomC/lgLH2big.png.',
           (2, 3): 'Under D4, touching bass-staff line; reads 1 at 1200 dpi. Crop: zoomC/lgLH2big.png.'}},
  note=('Bars are not uniform (recorded exactly as printed): RH b1 starts 1 2 3 4 on C C# D D#, but RH b2 starts 2 3 1 2 on C C# D D#. '
        'RH b3 ends "2 1 3" on Eb D Db, whereas RH b4 ends "4 3 2" on Eb D Db (both clearly printed, above the staff, no line interference). '
        'LH b1 starts 3 2 1 on C C# D, LH b2 starts 1 2 1. Only 4 bars (2 octaves up and back). RH b1 and b2 digit rows re-verified at 1200 dpi (zoomC/lgRH1.png, zoomC/lgRH2.png); both read as recorded.')))

# No. 40 pass-1 transcription: per variant, per hand, per bar digit lists (every note is fingered in No. 40).
# 'up'/'down' refer to pitch direction of that hand. Each run lists bars in playing order plus the turning/final note.
C = []
A12 = lambda s: [int(c) for c in s.split()]
C.append(dict(variant='octave', header='At an octave.', pdf=63, printed_page=62, rh_start='C3', lh_start='C2', octaves=4,
  RH=dict(first='up', up=[A12('1 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 4')], turn=5,
          down=[A12('5 4 3 1 3 1 3 2 1 3 1 3')[1:],A12('2 1 3 1 3 1 3 2 1 3 1 3'),A12('2 1 3 1 3 1 3 2 1 3 1 3'),A12('2 1 3 1 3 1 3 2 1 3 1 3')], final=1),
  LH=dict(first='up', up=[A12('4 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2')], turn=1,
          down=[A12('1 2 3 1 3 1 3 1 2 3 1 3')[1:],A12('1 2 3 1 3 1 3 1 2 3 1 3'),A12('1 2 3 1 3 1 3 1 2 3 1 3'),A12('1 2 3 1 3 1 3 1 2 3 1 3')], final=4)))
C.append(dict(variant='minorThird', header='At a minor third.', pdf=63, printed_page=62, rh_start='Eb2', lh_start='C2', octaves=4,
  RH=dict(first='up', up=[A12('3 1 2 3 1 3 1 3 1 2 3 1')]*4, turn=3, down=[A12('3 1 3 2 1 3 1 3 1 3 2 1')[1:]]+[A12('3 1 3 2 1 3 1 3 1 3 2 1')]*3, final=3),
  LH=dict(first='up', up=[A12('4 3 1 3 2 1 3 1 3 1 3 2')]+[A12('1 3 1 3 2 1 3 1 3 1 3 2')]*3, turn=1, down=[A12('1 2 3 1 3 1 3 1 2 3 1 3')[1:]]+[A12('1 2 3 1 3 1 3 1 2 3 1 3')]*3, final=4)))
C.append(dict(variant='majorSixth', header='At a major sixth.', pdf=64, printed_page=63, rh_start='C3', lh_start='Eb2', octaves=4,
  RH=dict(first='up', up=[A12('1 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 4')], turn=5,
          down=[A12('5 4 3 1 3 1 3 2 1 3 1 3')[1:]]+[A12('2 1 3 1 3 1 3 2 1 3 1 3')]*3, final=1),
  LH=dict(first='up', up=[A12('3 2 1 3 1 3 1 3 2 1 3 1')]*4, turn=3, down=[A12('3 1 3 1 2 3 1 3 1 3 1 2')[1:]]+[A12('3 1 3 1 2 3 1 3 1 3 1 2')]*3, final=3)))
C.append(dict(variant='minorSixth', header='At a minor sixth.', pdf=64, printed_page=63, rh_start='C3', lh_start='E2', octaves=4,
  RH=dict(first='up', up=[A12('1 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 4')], turn=5,
          down=[A12('5 4 3 1 3 1 3 2 1 3 1 3')[1:]]+[A12('2 1 3 1 3 1 3 2 1 3 1 3')]*3, final=1),
  LH=dict(first='up', up=[A12('5 4 3 1 3 1 3 2 1 3 1 3')]+[A12('2 1 3 1 3 1 3 2 1 3 1 3')]*3, turn=1,
          down=[A12('1 3 1 3 1 2 3 1 3 1 3 1')[1:],A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 1'),A12('2 3 1 3 1 2 3 1 3 1 3 4')], final=5)))
C.append(dict(variant='contraryOctave', header='In contrary motion, beginning on the octave.', pdf=65, printed_page=64, rh_start='C6', lh_start='C2', octaves=2,
  RH=dict(first='down', down=[A12('5 4 3 1 3 1 3 2 1 3 1 3'),A12('2 1 3 1 3 1 3 2 1 3 1 3')], turn=1, up=[A12('1 3 1 3 1 2 3 1 3 1 3 1')[1:],A12('2 3 1 3 1 2 3 1 3 1 3 4')], final=5),
  LH=dict(first='up', up=[A12('4 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2')], turn=1, down=[A12('1 2 3 1 3 1 3 1 2 3 1 3')[1:],A12('1 2 3 1 3 1 3 1 2 3 1 3')], final=4),
  uncertain={'LH':{'bar 2 pos 1 (C3)':'glyph crossed by a bass-staff line; at 300/600 dpi it looks like 4, at 1200 dpi the flag merges with the stem like a 1 (no detached diagonal as in a real 4). Read as 1 (second reader, confirmed on re-inspection; 1 also fits the pattern). crops pass2/zoomC/c8_2start.png, pass2/zoomC/qcmp.png, zoom/p065_con8_bar2_LH.png'}}))
C.append(dict(variant='contraryMinorThird', header='In contrary motion, beginning on the minor third.', pdf=65, printed_page=64, rh_start='Eb6', lh_start='C2', octaves=2,
  RH=dict(first='down', down=[A12('3 1 3 2 1 3 1 3 1 3 2 1')]*2, turn=3, up=[A12('3 1 2 3 1 3 1 3 1 2 3 1')[1:],A12('3 1 2 3 1 3 1 3 1 2 3 1')], final=3),
  LH=dict(first='up', up=[A12('4 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2')], turn=1, down=[A12('1 2 3 1 3 1 3 1 2 3 1 3')[1:],A12('1 2 3 1 3 1 3 1 2 3 1 3')], final=4)))
C.append(dict(variant='contraryMajorThird', header='In contrary motion, beginning on the major third.', pdf=65, printed_page=64, rh_start='E6', lh_start='C2', octaves=2,
  uncertain={'RH':{'bar 2 pos 6, 8, 10 (B4, A4, G4)':'1s crossed by treble-staff lines that can look like 4 at low resolution; read 1 by both readers (pass2/zoomC/gcmp.png)'}},
  RH=dict(first='down', down=[A12('4 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2')], turn=1, up=[A12('1 2 3 1 3 1 3 1 2 3 1 3')[1:],A12('1 2 3 1 3 1 3 1 2 3 1 3')], final=4),
  LH=dict(first='up', up=[A12('4 3 1 3 2 1 3 1 3 1 3 2'),A12('1 3 1 3 2 1 3 1 3 1 3 2')], turn=1, down=[A12('1 2 3 1 3 1 3 1 2 3 1 3')[1:],A12('1 2 3 1 3 1 3 1 2 3 1 3')], final=4)))
C.append(dict(variant='legato', header='Another fingering, which we particularly recommend for legato passages.', pdf=65, printed_page=64, rh_start='C4', lh_start='C3', octaves=2,
  RH=dict(first='up', up=[A12('1 2 3 4 1 2 3 1 2 3 4 1'),A12('2 3 1 2 1 2 3 1 2 3 4 1')], turn=3, down=[A12('3 1 4 3 2 1 3 2 1 2 1 3')[1:],A12('2 1 4 3 2 1 3 2 1 4 3 2')], final=1),
  LH=dict(first='up', up=[A12('3 2 1 3 2 1 4 3 2 1 3 2'),A12('1 2 1 3 2 1 4 3 2 1 3 2')], turn=1, down=[A12('1 2 3 1 2 3 4 1 2 3 1 2')[1:],A12('1 2 3 1 2 3 4 1 2 3 1 2')], final=3)))

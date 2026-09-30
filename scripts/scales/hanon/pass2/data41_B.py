# Reader B: Hanon No. 41, Schirmer, PDF pages 68-69 (printed 67-68).
# Printed digits only; index 0-11 = bar 1 (up), 12-23 = bar 2 (down), 24 = closing half note.
S = []

S.append(dict(pdf=68, system=1, key='Gb', mode='major', header='G♭ major.', rh='Gb2', lh='Gb1',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 15:1, 16:3, 19:3, 22:3},
 LH={0:5, 1:3, 2:2, 3:1, 4:3, 7:3, 10:3, 12:1, 15:1, 18:1, 21:1},
 uncertain={'RH': {}, 'LH': {}},
 note='No digits on the closing half notes. RH begins on the bass staff; LH idx0 Gb1 has three ledger lines.'))

S.append(dict(pdf=68, system=2, key='Eb', mode='minor', header='E♭ minor.', rh='Eb3', lh='Eb2',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 13:3, 14:2, 15:1, 16:3, 19:3, 22:3, 24:1},
 LH={0:5, 1:4, 2:2, 3:1, 4:4, 7:4, 10:4, 12:1, 13:2, 14:4, 15:1, 18:1, 21:1, 24:5},
 uncertain={'RH': {3: "zoomed: a '1' with the notched-top serif and a detached ink speck to its right; no diagonal/crossbar of a 4. Read 1 with good confidence."}, 'LH': {}},
 note='8va over the end of bar 1 / start of bar 2 (treble staff). Closing: RH 1 above, LH 5 below.'))

S.append(dict(pdf=68, system=3, key='B', mode='major', header='B major.', rh='B2', lh='B1',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 15:1, 16:3, 19:3, 22:3},
 LH={0:5, 1:3, 2:2, 3:1, 4:3, 7:3, 10:3, 12:1, 15:1, 18:1, 21:1},
 uncertain={'RH': {3: "digit sits inside the treble staff with a staff line through its middle; zoomed: notched-top '1' shape, no diagonal stroke, so read 1 (a 1 crossed by a line could mimic a 4)."}, 'LH': {}},
 note='No digits on the closing half notes.'))

S.append(dict(pdf=68, system=4, key='G#', mode='minor', header='G♯ minor.', rh='G#2', lh='G#1',
 RH={0:2, 1:1, 2:2, 3:4, 4:1, 7:1, 10:1, 12:4, 13:2, 14:1, 15:4, 18:4, 21:4, 24:2},
 LH={0:3, 1:1, 2:4, 3:2, 4:1, 5:4, 8:4, 11:4, 12:2, 13:4, 14:1, 17:1, 20:1, 23:1, 24:3},
 uncertain={'RH': {}, 'LH': {}},
 note="LH idx8 '4' is printed high, just under the start of the LH beat-3 beam and crossing the top bass-staff line (aligned with idx8's stem, not idx7's). Closing: RH 2 above, LH 3 below."))

S.append(dict(pdf=68, system=5, key='E', mode='major', header='E major.', rh='E3', lh='E2',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 15:1, 16:3, 19:3, 22:3},
 LH={0:5, 1:3, 2:2, 3:1, 4:3, 7:3, 10:3, 12:1, 15:1, 18:1, 21:1},
 uncertain={'RH': {}, 'LH': {18: "digit printed inside the bass staff with a staff line through it; zoomed: notched-top '1', no diagonal, read 1."}},
 note='No digits on the closing half notes.'))

S.append(dict(pdf=68, system=6, key='C#', mode='minor', header='C♯ minor.', rh='C#3', lh='C#2',
 RH={0:2, 1:1, 2:2, 3:4, 4:1, 7:1, 10:1, 12:4, 13:2, 14:1, 15:4, 18:4, 21:4, 24:2},
 LH={0:3, 1:1, 2:4, 3:2, 4:1, 5:4, 8:4, 11:4, 12:2, 13:4, 14:1, 17:1, 20:1, 23:1, 24:3},
 uncertain={'RH': {3: "digit crossed by the bottom treble-staff line; zoomed: a diagonal stroke to the lower left and a stem, i.e. a 4 (not a 1 crossed by the line). Read 4."}, 'LH': {}},
 note="LH idx8 '4' is printed high, just under the start of the LH beat-3 beam (aligned with idx8's stem, not idx7's). Closing: RH 2 above, LH 3 below."))

S.append(dict(pdf=69, system=1, key='A', mode='major', header='A major.', rh='A2', lh='A1',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 16:3, 19:3, 22:3},
 LH={0:5, 1:3, 2:2, 3:1, 4:3, 7:3, 10:3, 12:1, 15:1, 18:1, 21:1},
 uncertain={'RH': {}, 'LH': {}},
 note='RH bar 2 first beat (idx12-15, under the 8va) has NO printed digits (checked on a zoom). No digits on the closing half notes.'))

S.append(dict(pdf=69, system=2, key='F#', mode='minor', header='F♯ minor.', rh='F#2', lh='F#1',
 RH={0:2, 1:1, 2:2, 3:4, 4:1, 7:1, 10:1, 12:4, 13:2, 14:1, 15:4, 18:4, 21:4, 24:2},
 LH={0:3, 1:1, 2:4, 3:2, 4:1, 5:4, 8:4, 11:4, 12:2, 13:4, 14:1, 17:1, 20:1, 23:1, 24:3},
 uncertain={'RH': {}, 'LH': {}},
 note="LH idx8 '4' printed inside the bass staff just below the LH beat-3 beam start. Closing: RH 2 above, LH 3 below."))

S.append(dict(pdf=69, system=3, key='D', mode='major', header='D major.', rh='D3', lh='D2',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 16:3, 19:3, 22:3},
 LH={0:5, 1:3, 2:2, 3:1, 4:3, 7:3, 10:3, 12:1, 15:1, 18:1, 21:1},
 uncertain={'RH': {}, 'LH': {}},
 note='RH bar 2 first beat has only the 5 on idx12 (no digits on idx13-15). A small ink speck between the closing half notes is not a digit; no closing digits. A stray dot in the treble staff near the clef is not a digit.'))

S.append(dict(pdf=69, system=4, key='B', mode='minor', header='B minor.', rh='B2', lh='B1',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 13:3, 14:2, 15:1, 16:3, 19:3, 22:3, 24:1},
 LH={0:5, 1:4, 2:2, 3:1, 4:4, 7:4, 10:4, 12:1, 13:2, 14:4, 15:1, 18:1, 21:1, 24:5},
 uncertain={'RH': {}, 'LH': {}},
 note='Closing: RH 1 above, LH 5 below.'))

S.append(dict(pdf=69, system=5, key='G', mode='major', header='G major.', rh='G2', lh='G1',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 13:3, 14:2, 15:1, 16:3, 19:3, 22:3},
 LH={0:5, 1:4, 2:2, 3:1, 4:4, 7:4, 10:4, 12:1, 13:2, 14:4, 15:1, 18:1, 21:1},
 uncertain={'RH': {}, 'LH': {}},
 note='No 8va in this system. No digits on the closing half notes.'))

S.append(dict(pdf=69, system=6, key='E', mode='minor', header='E minor.', rh='E3', lh='E2',
 RH={0:1, 1:2, 2:3, 3:1, 6:1, 9:1, 12:5, 13:3, 14:2, 15:1, 16:3, 19:3, 22:3, 24:1},
 LH={0:5, 1:4, 2:2, 3:1, 4:4, 7:4, 10:4, 12:1, 13:2, 14:4, 15:1, 18:1, 21:1, 24:5},
 uncertain={'RH': {}, 'LH': {7: "digit sits between the two lowest bass-staff lines, touched by them; zoomed: diagonal stroke plus stem clearly a 4. Read 4."}},
 note='Closing: RH 1 above, LH 5 below.'))

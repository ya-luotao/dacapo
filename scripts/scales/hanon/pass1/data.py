# Pass 1 transcription. Index convention per hand: 0..28 ascending (0 = starting tonic, 28 = top tonic),
# 29..55 descending (55 = second degree, last printed note before the repeat). Only digits literally
# printed are recorded here. Each entry: index: finger.
S = []
S.append(dict(num=39, key='C', mode='major', pdf=51, systems=(1,2), rh='C3', lh='C2', header='C major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1},
 note='LH index 6 (B2) has no digit printed in bar 1.'))
S.append(dict(num=39, key='A', mode='harmonicMinor', pdf=51, systems=(3,4), rh='A2', lh='A1', header='1. A minor, relative to C major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1},
 note='LH top note (index 28, A5) has no digit printed.'))
S.append(dict(num=39, key='A', mode='melodicMinor', pdf=51, systems=(5,6), rh='A2', lh='A1', header='2. A minor, relative to C major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}, uncertain={'LH':{28:'crossed by a staff line, shape is 1 (both readers)',31:'crossed by a staff line, shape is 1'}}))
S.append(dict(num=39, key='F', mode='major', pdf=52, systems=(1,2), rh='F3', lh='F2', header='F major.',
 RH={0:1,1:2,2:3,3:4,4:1,5:2,6:3,7:1, 11:1,14:1, 18:1,21:1, 25:1,28:4, 32:4,36:3,39:4, 43:3,46:4, 50:3,53:4},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='D', mode='harmonicMinor', pdf=52, systems=(3,4), rh='D3', lh='D2', header='1. D minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1},
 uncertain={'LH':{31:'damaged glyph in #91547, read as 1 by both readers; confirmed as a clean 1 in the second copy IMSLP #00875 (alt/alt30_Dm1_bar4_LH.png); crop zoom/p052_Dm1_bar4_LH.png'}}))
S.append(dict(num=39, key='D', mode='melodicMinor', pdf=52, systems=(5,6), rh='D3', lh='D2', header='2. D minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='Bb', mode='major', pdf=53, systems=(1,2), rh='Bb2', lh='Bb1', header='B♭ major.',
 RH={0:2,1:1,2:2,3:3,4:1,5:2,6:3,7:4, 8:1,11:1,15:1, 18:1,22:1, 25:1,28:4, 32:3,35:4,39:3, 42:4,46:3, 49:4,53:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,14:3, 17:4,21:3, 24:4,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='LH top Bb5 printed 2 (not 3) with A5=1 on the way down (zoom/p053_Bb_bar4.png). LH index 54 (D2) digit sits low, just above the next system\'s 8va sign (zoom/p053_Gm1_bar3.png).', uncertain={'LH':{54:'digit sits low between systems, left of the next system 8va sign; attributed to this LH by position (both readers); fits the pattern'}}))
S.append(dict(num=39, key='G', mode='harmonicMinor', pdf=53, systems=(3,4), rh='G3', lh='G2', header='1. G minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='G', mode='melodicMinor', pdf=53, systems=(5,6), rh='G3', lh='G2', header='2. G minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1},
 note='LH bar 1: F#3 and G3 (indices 6,7) carry no digit (zoom/p053_Gm2_bar1_LH.png).'))
S.append(dict(num=39, key='Eb', mode='major', pdf=54, systems=(1,2), rh='Eb3', lh='Eb2', header='E♭ major.',
 RH={0:2,1:1,2:2,3:3,4:4,5:1,6:2,7:3, 8:1,12:1,15:1, 19:1,22:1, 26:1,28:3,31:4, 35:3,38:4, 42:3,45:4, 49:3,52:4},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,14:3, 17:4,21:3, 24:4,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='RH starts on 2 (not 3). LH top Eb6 printed 2 with D6=1 on the way down.'))
S.append(dict(num=39, key='C', mode='harmonicMinor', pdf=54, systems=(3,4), rh='C3', lh='C2', header='1. C minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='C', mode='melodicMinor', pdf=54, systems=(5,6), rh='C3', lh='C2', header='2. C minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1},
 note='RH top note C7 (index 28) has no digit printed.'))
S.append(dict(num=39, key='Ab', mode='major', pdf=55, systems=(1,2), rh='Ab2', lh='Ab1', header='A♭ major.',
 RH={0:2,1:3,2:1,3:2,4:3,5:1, 9:1,12:1, 16:1,19:1,23:1, 26:1,28:3,31:3, 34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,14:3, 17:4,21:3, 24:4,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='RH starts Ab=2, Bb=3 (not 3,4); RH bar 1 G3/Ab3 (6,7) and bar 2 Bb3 (8) unprinted. RH last note before the repeat, Bb2 (55), printed 3 (so that Ab=2 follows on the repeat). LH top Ab5=2, G5=1.'))
S.append(dict(num=39, key='F', mode='harmonicMinor', pdf=55, systems=(3,4), rh='F3', lh='F2', header='1. F minor.',
 RH={0:1,1:2,2:3,3:4,4:1,5:2,6:3,7:1, 11:1,14:1, 18:1,21:1, 25:1,28:4, 32:4,36:3,39:4, 43:3,46:4, 50:3,53:4},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='F', mode='melodicMinor', pdf=55, systems=(5,6), rh='F3', lh='F2', header='2. F minor.',
 RH={0:1,1:2,2:3,3:4,4:1,5:2,6:3,7:1, 11:1,14:1, 18:1,21:1, 25:1,28:4, 32:4,36:3,39:4, 43:3,46:4, 50:3,53:4},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='Db', mode='major', pdf=56, systems=(1,2), rh='Db3', lh='Db2', header='D♭ major.',
 RH={0:2,1:3,2:1,3:2,4:3,5:4,6:1, 9:1,13:1, 16:1,20:1,23:1, 27:1,28:2,29:1,30:4, 34:3,37:4, 41:3,44:4, 48:3,51:4,55:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,14:3, 17:4,21:3, 24:4,27:1,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='RH bar 1 Db4 (7) unprinted. LH turns at the top C6(1) Db6(2) C6(1).'))
S.append(dict(num=39, key='Bb', mode='harmonicMinor', pdf=56, systems=(3,4), rh='Bb2', lh='Bb1', header='1. B♭ minor.',
 RH={0:2,1:1,2:2,3:3,4:1,5:2,6:3,7:4, 8:1,11:1,15:1, 18:1,22:1, 25:1,28:4, 32:3,35:4,39:3, 42:4,46:3, 49:4,53:3},
 LH={0:2,1:1,2:3,3:2,4:1,5:4,6:3,7:2, 8:1,9:3,12:4, 16:3,19:4,23:3, 26:4,27:3,28:2,29:3,30:4,31:1, 34:1,38:1, 41:1,45:1, 48:1,52:1,55:1}, uncertain={'LH':{55:'near the next system RH 1; attributed by position (both readers); fits the pattern'}}))
S.append(dict(num=39, key='Bb', mode='melodicMinor', pdf=56, systems=(5,6), rh='Bb2', lh='Bb1', header='2. B♭ minor.',
 RH={0:2,1:1,2:2,3:3,4:1,5:2,6:3,7:4, 8:1,11:1,15:1, 18:1,22:1, 25:1,28:4, 32:3,35:4,39:3, 42:4,46:3, 49:4,53:3},
 LH={0:2,1:1,2:3,3:2,4:1,5:4,6:3,7:2, 8:1,9:3,12:4, 16:3,19:4,23:3, 26:4,28:2,29:3,30:4,31:1, 34:1,38:1, 41:1,45:1, 48:1,52:1,55:1},
 note='LH bar 4: A5 ascending (27) unprinted (harmonic form prints 3 there).'))
S.append(dict(num=39, key='Gb', mode='major', pdf=57, systems=(1,2), rh='Gb3', lh='Gb2', header='G♭ major.',
 RH={0:2,1:3,2:4,3:1,4:2,5:3,6:1,7:2, 10:1,13:1, 17:1,20:1, 24:1,27:1,28:3,29:1,30:3,31:2, 33:4,37:3, 40:4,44:3,47:4, 51:3,54:4},
 LH={0:4,1:3,2:2,3:1,4:3,5:2,6:1,7:4, 11:3,14:4, 18:3,21:4, 25:3,28:2,29:1,30:2, 32:1,36:1,39:1, 43:1,46:1, 50:1,53:1},
 note='RH top Gb7 printed 3 (F1 Gb3 F1 Eb3 Db2); LH top Gb6 printed 2 (F1 Gb2 F1 Eb2). zoom/p057_Gb_bar4.png'))
S.append(dict(num=39, key='Eb', mode='harmonicMinor', pdf=57, systems=(3,4), rh='Eb3', lh='Eb2', header='1. E♭ minor.',
 RH={0:2,1:1,2:2,3:3,4:4,5:1, 8:1,12:1,15:1, 19:1,22:1, 26:1,28:3,31:4, 35:3,38:4, 42:3,45:4, 49:3,52:4},
 LH={0:2,1:1,2:4,3:3,4:2,5:1,6:3, 9:4,13:3, 16:4,20:3,23:4, 27:3,28:2,29:3,30:1, 34:1,37:1, 41:1,44:1, 48:1,51:1,55:1},
 note='RH bar 1 D4/Eb4 (6,7) and LH bar 1 Eb3 (7) unprinted.'))
S.append(dict(num=39, key='Eb', mode='melodicMinor', pdf=57, systems=(5,6), rh='Eb3', lh='Eb2', header='2. E♭ minor.',
 RH={0:2,1:1,2:2,3:3,4:4,5:1,6:2,7:3, 8:1,12:1,15:1, 19:1,22:1, 26:1,28:3,30:1,31:4, 35:3,38:4, 42:3,45:4, 49:3,52:4},
 LH={0:2,1:1,2:4,3:3,4:2,5:1,6:3,7:2, 8:1,9:4,13:3, 16:4,20:3,23:4, 27:3,28:2,29:3,30:1, 34:1,37:1, 41:1,44:1, 48:1,51:1,55:1}))
S.append(dict(num=39, key='B', mode='major', pdf=58, systems=(1,2), rh='B2', lh='B1', header='B major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:4,1:3,2:2,3:1,4:4,5:3,6:2,7:1, 8:3,11:4,15:3, 18:4,22:3, 25:4,28:1, 32:1,35:1,39:1, 42:1,46:1, 49:1,53:1}))
S.append(dict(num=39, key='G#', mode='harmonicMinor', pdf=58, systems=(3,4), rh='G#3', lh='G#2', header='1. G♯ minor.',
 RH={0:2,1:3,2:1,3:2,4:3,5:1,6:2,7:3, 9:1,12:1, 16:1,19:1,23:1, 26:1,28:3,31:3, 34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,14:3, 17:4,21:3, 24:4,27:1,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='RH starts G#=2 (not 3); RH last note before repeat A#3 (55) printed 3. LH turns F##1 G#2 F##1 at the top.'))
S.append(dict(num=39, key='G#', mode='melodicMinor', pdf=58, systems=(5,6), rh='G#3', lh='G#2', header='2. G♯ minor.',
 RH={0:2,1:3,2:1,3:2,4:3,5:1,6:2,7:3, 8:4,9:1,12:1, 16:1,19:1,23:1, 26:1,28:3,29:2,30:1,31:3, 33:1,34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 8:2,9:1,10:4,11:3,12:2,13:1,14:3,15:2, 16:1,17:4,18:3,19:2,20:1,21:3,22:2,23:1, 24:4,25:3,26:2,27:1,28:2,29:3,30:1, 33:1,37:1, 40:1,44:1,47:1, 51:1,54:1},
 note='LH ascending printed in full through bar 4. LH descending (natural form) uses the B-major pattern with thumbs on E and B (G#2 F#3 E1 ... B1 A#? G#? F#? E1), unlike the harmonic form.'))
S.append(dict(num=39, key='E', mode='major', pdf=59, systems=(1,2), rh='E3', lh='E2', header='E major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}, uncertain={'LH':{0:'the 5 sits low near the next system 8va sign; on the LH digit baseline (both readers)'}}))
S.append(dict(num=39, key='C#', mode='harmonicMinor', pdf=59, systems=(3,4), rh='C#3', lh='C#2', header='1. C♯ minor.',
 RH={0:2,1:3,2:1,3:2,4:3,5:1,6:2,7:3, 8:4,9:1,12:1, 16:1,19:1,23:1, 26:1,28:3,31:3, 34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,14:3, 17:4,21:3, 24:4,27:1,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='RH starts C#=2 (not 3); RH D#3 before repeat (55) printed 3.'))
S.append(dict(num=39, key='C#', mode='melodicMinor', pdf=59, systems=(5,6), rh='C#3', lh='C#2', header='2. C♯ minor.',
 RH={0:2,1:3,2:1,3:2,4:3,5:4,6:1, 9:1,13:1, 16:1,20:1,23:1, 27:1,28:3,29:2,30:1,31:3, 34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:3,1:2,2:1,3:4,4:3,5:2,6:1,7:3, 10:4,11:3,14:3, 17:4,21:3, 24:4,28:2,29:1, 33:1,36:1, 40:1,43:1,47:1, 50:1,54:1},
 note='RH ascending differs from the harmonic form: A#=4, thumb on E and B# (C#2 D#3 E1 F#2 G#3 A#4 B#1). RH top C#7 printed 3. RH bar 1 C#4 (7) unprinted.'))
S.append(dict(num=39, key='A', mode='major', pdf=60, systems=(1,2), rh='A2', lh='A1', header='A major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='F#', mode='harmonicMinor', pdf=60, systems=(3,4), rh='F#3', lh='F#2', header='1. F♯ minor.',
 RH={0:2,1:3,2:1,5:1, 9:1,12:1, 16:1,19:1,23:1, 26:1,28:3,31:3, 34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:4,1:3,2:2,3:1,4:3,5:2,6:1,7:4, 11:3,14:4, 18:3,21:4, 25:3,28:2,29:1, 32:1,36:1,39:1, 43:1,46:1, 50:1,53:1},
 note='RH bar 1 prints only F#2 G#3 A1 .. D1; B3,C#4,E#4,F#4 (3,4,6,7) unprinted. RH G#3 before repeat (55) printed 3. LH top F#6=2, E#6=1.'))
S.append(dict(num=39, key='F#', mode='melodicMinor', pdf=60, systems=(5,6), rh='F#3', lh='F#2', header='2. F♯ minor.',
 RH={0:2,1:3,2:1,3:2,4:3,5:4,6:1, 9:1,13:1, 16:1,20:1,23:1, 27:1,28:3,29:2,30:1,31:3, 34:4,38:3, 41:4,45:3, 48:4,52:3,55:3},
 LH={0:4,1:3,2:2,3:1,4:3,5:2,6:1,7:4, 11:3,14:4, 18:3,21:4, 25:3,27:1,28:2,29:1, 32:1,36:1,39:1, 43:1,46:1, 50:1,53:1},
 note='RH ascending differs from the harmonic form: D#=4, thumb on A and E# (F#2 G#3 A1 B2 C#3 D#4 E#1). RH bar 1 F#4 (7) unprinted.'))
S.append(dict(num=39, key='D', mode='major', pdf=61, systems=(1,2), rh='D3', lh='D2', header='D major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1, 55:1},
 uncertain={'LH':{55:'a "1" is printed under the last LH note E2 before the repeat, immediately above a "1" that belongs to the B minor RH in the next system; contradicts the pattern (expected 4, and 5 follows on D2 at the repeat) - possibly a stray/duplicated digit. zoom/p061_D_bar7_end_x3.png'}}))
S.append(dict(num=39, key='B', mode='harmonicMinor', pdf=61, systems=(3,4), rh='B2', lh='B1', header='1. B minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:4,1:3,2:2,3:1,4:4,5:3,6:2,7:1, 8:3,11:4,15:3, 18:4,22:3, 25:4,28:1, 32:1,35:1,39:1, 42:1,46:1, 49:1,53:1}))
S.append(dict(num=39, key='B', mode='melodicMinor', pdf=61, systems=(5,6), rh='B2', lh='B1', header='2. B minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 32:1,33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:4,1:3,2:2,3:1,4:4,5:3,6:2,7:1, 8:3,11:4,15:3, 18:4,22:3, 25:4,28:1, 32:1,35:1,39:1, 42:1,46:1, 49:1,53:1}))
S.append(dict(num=39, key='G', mode='major', pdf=62, systems=(1,2), rh='G3', lh='G2', header='G major.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='E', mode='harmonicMinor', pdf=62, systems=(3,4), rh='E3', lh='E2', header='1. E minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))
S.append(dict(num=39, key='E', mode='melodicMinor', pdf=62, systems=(5,6), rh='E3', lh='E2', header='2. E minor.',
 RH={0:1,1:2,2:3,3:1,4:2,5:3,6:4,7:1, 10:1,14:1, 17:1,21:1, 24:1,28:5, 32:1,33:3,36:4, 40:3,43:4,47:3, 50:4,54:3},
 LH={0:5,1:4,2:3,3:2,4:1,5:3,6:2,7:1, 8:4,12:3,15:4, 19:3,22:4, 26:3,28:1,31:1, 35:1,38:1, 42:1,45:1, 49:1,52:1}))

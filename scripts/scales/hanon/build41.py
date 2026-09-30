"""Build hanon41.json from a pass's printed digits of No. 41 (pass1/data41.py).

No. 41, "Arpeggios on the Triads, in the 24 Keys": four octaves of the root-position triad, hands
an octave apart, 25 notes per hand (index 0 the starting root, 12 the top, 24 the closing root, a
half note Hanon fingers in most keys). Only digits Hanon printed are in the data; the rest are
filled, in this order, and marked as inferred with the rule that gave them:

  octave  the same finger an octave away in the same direction (his fingering repeats every three
          notes between the first note and the top: every key prints the first octave in full and
          then the crossings);
  key     the same finger on the same key the other way, through the middle octaves (in every key
          where Hanon prints both, a key takes the same finger going up and coming down);
  top     the top note, where the hand plays the root with the thumb: the right hand's 5, as in
          every key whose right hand starts on the thumb and prints its top, and the left hand's 1,
          as in every key whose left hand takes the root with the thumb and prints its top (both
          checked below; README.md gives the counts);
  close   the closing root: the starting finger, as in every key that prints both (checked below).

Run from this folder: python3 build41.py pass1 hanon41.json
"""
import json
import os
import sys

base = sys.argv[1] if len(sys.argv) > 1 else 'pass1'
out = sys.argv[2] if len(sys.argv) > 2 else 'hanon41.json'
ns = {}
exec(open(os.path.join(base, 'data41.py')).read(), ns)
S = ns['S']

LETTERS = 'CDEFGAB'
NAT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
ACC = {-2: 'bb', -1: 'b', 0: '', 1: '#', 2: '##'}
EDITION = 'Hanon, The Virtuoso Pianist, G. Schirmer, New York, n.d. [1900], plate 15538 (IMSLP #91547)'


def parse(p):
    letter, rest, alt = p[0], p[1:], 0
    while rest and rest[0] in '#b':
        alt += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return letter, alt, int(rest)


def midi(letter, alt, octave):
    return 12 * (octave + 1) + NAT[letter] + alt


def triad_run(start, minor):
    """The 13 notes from `start` up four octaves of its root-position triad, spelled."""
    letter, alt, octave = parse(start)
    root = midi(letter, alt, octave)
    names = []
    for i in range(13):
        k, octaves = i % 3, i // 3
        li = LETTERS.index(letter) + 2 * k
        l = LETTERS[li % 7]
        o = octave + octaves + li // 7
        semis = [0, 3 if minor else 4, 7][k] + 12 * octaves
        a = root + semis - midi(l, 0, o)
        names.append(f'{l}{ACC[a]}{o}')
    return names


def fill(printed):
    f = dict(printed)
    why = {}
    changed = True
    while changed:
        changed = False
        for i in range(1, 24):
            if i in f or i == 12:
                continue
            up = i < 12
            for j in (i - 3, i + 3):
                if j in (0, 12, 24) or not 0 < j < 24 or (j < 12) != up or j not in f:
                    continue
                f[i], why[i] = f[j], 'octave'
                changed = True
                break
    for i in range(1, 24):
        if i in f or i == 12:
            continue
        j = 24 - i
        if j in f and j not in (0, 12, 24):
            f[i], why[i] = f[j], 'key'
    return f, why


entries = []
for s in S:
    minor = s['mode'] == 'minor'
    runs, printed, inferred = {}, {}, {}
    for hand, start in (('RH', s['rh']), ('LH', s['lh'])):
        f, why = fill(s[hand])
        if 12 not in f:
            if (f[0] if hand == 'RH' else f[9]) != 1:
                raise SystemExit(f"{s['key']} {s['mode']} {hand}: no rule for its top")
            f[12], why[12] = (5 if hand == 'RH' else 1), 'top'
        if 24 not in f:
            f[24], why[24] = f[0], 'close'
        missing = [i for i in range(25) if i not in f]
        if missing:
            raise SystemExit(f"{s['key']} {s['mode']} {hand}: no digit for {missing}")
        up, down = [f[i] for i in range(13)], [f[i] for i in range(12, 25)]
        prefix = 'right' if hand == 'RH' else 'left'
        runs[f'{prefix}Up'], runs[f'{prefix}Down'] = up, down
        printed[f'{prefix}Up'] = [i in s[hand] for i in range(13)]
        printed[f'{prefix}Down'] = [i in s[hand] for i in range(12, 25)]
        inferred[f'{prefix}Up'] = {str(i): why[i] for i in range(13) if i in why}
        inferred[f'{prefix}Down'] = {str(i - 12): why[i] for i in range(12, 25) if i in why}
        # No finger twice in a row on neighbouring notes of an arpeggio.
        seq = up + down[1:]
        for k in range(len(seq) - 1):
            if seq[k] == seq[k + 1]:
                raise SystemExit(f"{s['key']} {s['mode']} {hand}: finger {seq[k]} twice at {k}")
    notes = triad_run(s['rh'], minor)
    notes_left = triad_run(s['lh'], minor)
    entries.append({
        'number': 41,
        'key': s['key'],
        'mode': s['mode'],
        'header': s['header'],
        'octaves': 4,
        'page': s['pdf'] - 1,
        'pdfPage': s['pdf'],
        'system': s['system'],
        'startRight': s['rh'],
        'startLeft': s['lh'],
        'notes': notes,
        'notesDown': notes[::-1],
        'notesLeft': notes_left,
        'notesLeftDown': notes_left[::-1],
        **runs,
        'printed': printed,
        'inferred': inferred,
        'uncertain': {h: {str(k): v for k, v in d.items()} for h, d in s.get('uncertain', {}).items() if d},
        'remarks': s.get('note', ''),
        'edition': f"{EDITION}, printed p. {s['pdf'] - 1} (PDF p. {s['pdf']})",
        'verification': 'read twice independently (pass1/data41.py by one reader, pass2/data41_A.py and data41_B.py by two others who did not see it), diffed digit by digit with diff41.py: no difference; the doubtful digits are in uncertain.md',
    })

# The rules for the top and the close are what Hanon prints wherever he prints them.
for e in entries:
    for hand in ('right', 'left'):
        up, down, pr = e[f'{hand}Up'], e[f'{hand}Down'], e['printed']
        if pr[f'{hand}Up'][0] and pr[f'{hand}Down'][12] and up[0] != down[12]:
            raise SystemExit(f"{e['key']} {e['mode']} {hand}: printed close differs from the start")
    if e['rightUp'][0] == 1 and e['printed']['rightUp'][12] and e['rightUp'][12] != 5:
        raise SystemExit(f"{e['key']} {e['mode']}: a thumb start with a printed top other than 5")
    if e['printed']['leftUp'][12] and e['leftUp'][9] == 1 and e['leftUp'][12] != 1:
        raise SystemExit(f"{e['key']} {e['mode']}: a left thumb on the root, a printed top not 1")

if len(entries) != 24:
    raise SystemExit(f'{len(entries)} arpeggios, expected 24')
json.dump(entries, open(out, 'w'), ensure_ascii=False, indent=1)
open(out, 'a').write('\n')
print(f'wrote {out}: {len(entries)} arpeggios')

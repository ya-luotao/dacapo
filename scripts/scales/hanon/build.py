"""Build hanon.json from a pass's printed-digit data (data.py + data40.py).

No. 39: only digits Hanon actually printed are in the data; everything else is filled by the
thumb-crossing rule and marked as inferred:
  RH ascending / LH descending: after a known digit, the next notes take +1 (thumb-side fingers moving outward)
  RH descending / LH ascending: after a known digit, the next notes take -1 (moving toward the thumb)
The closing tonic of the descending run (index 56) is never printed in the run (the repeat/cadence follows);
it is inferred by the same rule and compared with the printed starting finger.
"""
import json, sys, os

base = sys.argv[1] if len(sys.argv) > 1 else 'pass1'
out = sys.argv[2] if len(sys.argv) > 2 else 'hanon.json'
ns = {}
exec(open(os.path.join(base, 'data.py')).read(), ns)
S = ns['S']
ns40 = {}
exec(open(os.path.join(base, 'data40.py')).read(), ns40)
C40 = ns40['C']

LETTERS = 'CDEFGAB'
NAT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
STEPS = {'major': [2, 2, 1, 2, 2, 2, 1], 'natural': [2, 1, 2, 2, 1, 2, 2], 'harmonic': [2, 1, 2, 2, 1, 3, 1],
         'melodicUp': [2, 1, 2, 2, 2, 2, 1]}
ACC = {-2: 'bb', -1: 'b', 0: '', 1: '#', 2: '##'}


def parse(p):
    letter = p[0]
    rest = p[1:]
    alt = 0
    while rest and rest[0] in '#b':
        alt += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return letter, alt, int(rest)


def midi(letter, alt, octave):
    return 12 * (octave + 1) + NAT[letter] + alt


def scale_degrees(tonic, kind):
    """Spelled degrees (letter, alter) of a 7-note scale, spelled from the tonic letter."""
    letter, alt, _ = parse(tonic + '4')
    li = LETTERS.index(letter)
    pc = (NAT[letter] + alt) % 12
    out = [(letter, alt)]
    for step in STEPS[kind][:-1]:
        pc = (pc + step) % 12
        li = (li + 1) % 7
        l = LETTERS[li]
        a = (pc - NAT[l] + 6) % 12 - 6
        out.append((l, a))
    return out


def run(start, degrees, n, direction):
    letter, alt, octv = parse(start)
    li = LETTERS.index(letter)
    di = 0
    names, midis = [], []
    for i in range(n):
        l, a = degrees[di]
        names.append(f'{l}{ACC[a]}{octv}')
        midis.append(midi(l, a, octv))
        if direction > 0:
            di = (di + 1) % 7
            if degrees[di][0] == 'C':
                octv += 1
        else:
            if degrees[di][0] == 'C':
                octv -= 1
            di = (di - 1) % 7
    return names, midis


BLACK = {1, 3, 6, 8, 10}


def fill(printed, lo, hi, step, seed=None):
    """Fill indices lo..hi (inclusive) from printed digits with +-1 steps after each known digit."""
    vals, status = {}, {}
    prev = seed
    for i in range(lo, hi + 1):
        if i in printed:
            vals[i] = printed[i]; status[i] = 'printed'
        elif prev is None:
            vals[i] = None; status[i] = 'unknown'
        else:
            vals[i] = prev + step; status[i] = 'inferred'
        prev = vals[i]
    return vals, status


def build39(s):
    key, mode = s['key'], s['mode']
    kind = {'major': 'major', 'harmonicMinor': 'harmonic', 'melodicMinor': 'melodicUp'}[mode]
    up_deg = scale_degrees(key, kind)
    down_deg = scale_degrees(key, 'natural') if mode == 'melodicMinor' else up_deg
    remarks, checks = [], []
    res = {}
    for hand in ('RH', 'LH'):
        start = s['rh'] if hand == 'RH' else s['lh']
        up_names, up_midi = run(start, up_deg, 29, +1)
        top = up_names[28]
        dn_names, dn_midi = run(top, down_deg, 29, -1)
        pr = s[hand]
        su = -1 if hand == 'LH' else +1   # step while ascending
        sd = -su
        vu, stu = fill(pr, 0, 28, su)
        vd, std = fill(pr, 28, 56, sd)
        # index 28 is shared: take the ascending pass value (printed or inferred)
        vd[28] = vu[28]; std[28] = stu[28]
        if 28 not in pr:
            # recompute the descending fill from the inferred top
            vd2, std2 = fill(pr, 29, 56, sd, seed=vu[28])
            vd.update(vd2); std.update(std2)
        # closing tonic: never printed in the run; on the repeat it is the first note, fingered as printed at index 0
        rule_val = vd[56]
        vd[56] = vu[0]; std[56] = 'inferred-closing-tonic'
        if rule_val != vu[0]:
            remarks.append(f'{hand}: closing tonic set to the printed start finger {vu[0]} (the crossing rule alone would give {rule_val}).')
        upF = [vu[i] for i in range(29)]
        dnF = [vd[i] for i in range(28, 57)]
        res[hand] = dict(up=upF, down=dnF, upStatus=[stu[i] for i in range(29)],
                         downStatus=[std[i] for i in range(28, 57)], upNotes=up_names, downNotes=dn_names,
                         upMidi=up_midi, downMidi=dn_midi)
        # --- sanity checks (reported, never fixed) ---
        allF = upF + dnF[1:]
        allM = up_midi + dn_midi[1:]
        for i, (f, m) in enumerate(zip(allF, allM)):
            if f is None or not (1 <= f <= 5):
                checks.append(f'{hand} index {i}: finger {f} out of range')
        for i, (f, m) in enumerate(zip(allF, allM)):
            if f == 1 and (m % 12) in BLACK:
                checks.append(f'{hand} thumb on black key at index {i} ({(up_names + dn_names[1:])[i]}), status {(res[hand]["upStatus"] + res[hand]["downStatus"][1:])[i]}')
        f55 = dnF[-2]
        if (hand == 'RH' and not (f55 > dnF[-1] or dnF[-1] == 1 or f55 == 1)) or (hand == 'LH' and not (f55 < dnF[-1] or f55 == 1)):
            checks.append(f'{hand}: last printed-run finger {f55} -> closing tonic {dnF[-1]} is not a normal step or crossing')
        # thumbs per octave (ascending indices 1..28 -> 4 octaves) and group sizes
        thumbs = [i for i in range(29) if upF[i] == 1]
        gaps = [b - a for a, b in zip(thumbs, thumbs[1:])]
        res[hand]['upThumbs'] = thumbs
        res[hand]['upThumbGaps'] = gaps
        dthumbs = [28 + i for i in range(29) if dnF[i] == 1]
        res[hand]['downThumbs'] = dthumbs
        res[hand]['downThumbGaps'] = [b - a for a, b in zip(dthumbs, dthumbs[1:])]
        for g in gaps[1:-1] if len(gaps) > 2 else []:
            if g not in (3, 4):
                checks.append(f'{hand} ascending thumb gap {g} (expected 3 or 4)')
        # descending digits vs reversed ascending pattern (by scale degree), middle octaves only
        up_by_deg = {}
        for i in range(8, 22):
            up_by_deg.setdefault(i % 7, set()).add(upF[i])
        for i in range(29, 56):
            if std[i] == 'printed':
                deg = (56 - i) % 7
                exp = up_by_deg.get(deg)
                if exp and pr[i] not in exp:
                    tag = 'info (repeat-leading finger)' if (i == 55 and pr[i] == 3) else ('info (expected: natural-minor descent)' if mode == 'melodicMinor' else 'check')
                    checks.append(f'{tag}: {hand} descending index {i} ({dn_names[i - 28]}) printed {pr[i]} but ascending uses {sorted(exp)} on that degree')
    unc = s.get('uncertain', {})
    entry = dict(number=39, key=key, mode=mode, header=s['header'], octaves=4,
                 page=s['pdf'] - 1, pdfPage=s['pdf'],
                 startRight=s['rh'], startLeft=s['lh'],
                 notes=res['RH']['upNotes'], notesDown=res['RH']['downNotes'],
                 notesLeft=res['LH']['upNotes'], notesLeftDown=res['LH']['downNotes'],
                 rightUp=res['RH']['up'], rightDown=res['RH']['down'],
                 leftUp=res['LH']['up'], leftDown=res['LH']['down'],
                 printed=dict(rightUp=[st == 'printed' for st in res['RH']['upStatus']],
                              rightDown=[st == 'printed' for st in res['RH']['downStatus']],
                              leftUp=[st == 'printed' for st in res['LH']['upStatus']],
                              leftDown=[st == 'printed' for st in res['LH']['downStatus']]),
                 remarks=' '.join(filter(None, [
                     'Hands an octave apart, four octaves up and down in sixteenths (2/4), with a repeat sign; the run printed before the repeat ends on the 2nd degree, so the closing tonic (last element of rightDown/leftDown) is inferred, not printed.',
                     'Hanon prints the first octave in full and afterwards only the crossing digits and some turning-point digits; the "printed" arrays mark which digits are literally on the page, the rest are expanded by the thumb-crossing rule.',
                     s.get('note', '')] + remarks)),
                 uncertain=unc, checks=checks,
                 thumbs=dict(rightUp=res['RH']['upThumbs'], leftUp=res['LH']['upThumbs'],
                             rightDown=res['RH']['downThumbs'], leftDown=res['LH']['downThumbs']))
    return entry


CHROM_UP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
CHROM_DN = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def chrom_names(start, n, direction):
    letter, alt, octv = parse(start)
    m = midi(letter, alt, octv)
    out = []
    for i in range(n):
        mm = m + direction * i
        pc, o = mm % 12, mm // 12 - 1
        out.append(f'{(CHROM_UP if direction > 0 else CHROM_DN)[pc]}{o}')
    return out, [m + direction * i for i in range(n)]


def build40(c):
    entry = dict(number=40, key='C', mode='chromatic', variant=c['variant'], header=c['header'],
                 octaves=c['octaves'], page=c['printed_page'], pdfPage=c['pdf'],
                 startRight=c['rh_start'], startLeft=c['lh_start'])
    checks = []
    for hand, keyname in (('RH', 'right'), ('LH', 'left')):
        h = c[hand]
        first = h['first']
        second = 'down' if first == 'up' else 'up'
        run1 = sum(h[first], [])
        run2 = sum(h[second], [])
        seq1 = run1 + [h['turn']]
        seq2 = [h['turn']] + run2 + [h['final']]
        n = 12 * c['octaves'] + 1
        if len(seq1) != n or len(seq2) != n:
            checks.append(f'{hand}: length {len(seq1)}/{len(seq2)} != {n}')
        start = c['rh_start'] if hand == 'RH' else c['lh_start']
        d1 = +1 if first == 'up' else -1
        names1, m1 = chrom_names(start, n, d1)
        names2, m2 = chrom_names(names1[-1], n, -d1)
        up, dn = (seq1, seq2) if first == 'up' else (seq2, seq1)
        upN, dnN = (names1, names2) if first == 'up' else (names2, names1)
        upM, dnM = (m1, m2) if first == 'up' else (m2, m1)
        entry[keyname + 'Up'] = up
        entry[keyname + 'Down'] = dn
        entry['notes' + ('Up' if hand == 'RH' else 'Left')] = upN
        entry['notes' + ('' if hand == 'RH' else 'Left') + 'Down'] = dnN
        for seq, mm, nm in ((up, upM, upN), (dn, dnM, dnN)):
            for f, m, name in zip(seq, mm, nm):
                if f == 1 and (m % 12) in BLACK:
                    checks.append(f'{hand} thumb on black key {name}')
        entry[keyname + 'First'] = first
    entry['notes'] = entry.pop('notesUp')
    entry['remarks'] = ('Every note is fingered in No. 40. Pitch spelling here is normalised to sharps ascending / flats descending '
                        '(this matches Hanon for the octave form; the interval and contrary-motion forms mix accidentals). '
                        + ('Hands move in contrary motion: the right hand goes down first and the left hand up, meeting and diverging; '
                           'rightDown/leftUp are therefore played first.' if 'contrary' in c['variant'] else '')
                        + (' "Another fingering, which we particularly recommend for legato passages." (Hanon), two octaves, hands an octave apart.' if c['variant'] == 'legato' else ''))
    entry['checks'] = checks
    entry['uncertain'] = c.get('uncertain', {})
    return entry


out_list = [build39(s) for s in S] + [build40(c) for c in C40]
for e in out_list:
    e['edition'] = (f"Hanon, The Virtuoso Pianist, G. Schirmer, New York, n.d. [1900], plate 15538 (IMSLP #91547), "
                    f"printed p. {e['page']} (PDF p. {e['pdfPage']})")
    e['verification'] = 'read twice independently (two readers, diffed digit by digit: no disagreement after resolving the items in uncertain.md)'
json.dump(out_list, open(out, 'w'), indent=1, ensure_ascii=False)
print(f'wrote {len(out_list)} entries to {out}')
for e in out_list:
    if e['checks']:
        print(e['number'], e['key'], e['mode'], e.get('variant', ''), '->')
        for c in e['checks']:
            print('   ', c)

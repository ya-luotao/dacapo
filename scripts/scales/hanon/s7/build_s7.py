"""Build s7.json from a reading of Hanon's Nos. 42-53 (the parts S7 offers).

    python3 build_s7.py passA s7.json

A reading gives every bar of every part, both hands, as steps (a note `C4`, or a chord `C4+E4`,
lowest first; `X*k` repeats a step, `(X Y)*k` a group), and every digit printed, by bar, hand and
step. This expands the abbreviations, applies the settled differences (resolved.py), and checks
what the plate should show: each bar's steps fill it at the part's value (the closing bars as
their marks say, less a closing rest), both hands have as many steps in each bar, and every digit falls on a step with
a digit for each of its keys. The digits are the printed ones only. Rebuilding gives the committed
s7.json byte for byte.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ['s7_42_43.py', 's7_44_47.py', 's7_45_46.py', 's7_50_51.py', 's7_53a.py', 's7_53b.py']
UNITS = {'sixteenths': 4, '32nds': 8, 'triplet eighths': 3, 'eighths': 2}
NOTE = re.compile(r'^[A-G](bb|b|##|#|x)?-?\d$')


def load(folder):
    out = []
    for name in FILES:
        path = os.path.join(HERE, folder, name)
        if not os.path.exists(path):
            continue
        ns = {}
        exec(open(path).read(), ns)
        out.extend(ns['X'])
    return out


def expand(text):
    """Steps of a bar, abbreviations expanded."""
    out = []
    tokens = re.findall(r'\([^)]*\)\*\d+|\S+', text.strip())
    for token in tokens:
        group = re.fullmatch(r'\(([^)]*)\)\*(\d+)', token)
        if group:
            inner = group.group(1).split()
            out.extend(inner * int(group.group(2)))
            continue
        single = re.fullmatch(r'(\S+?)\*(\d+)', token)
        if single:
            out.extend([single.group(1)] * int(single.group(2)))
        else:
            out.append(token)
    for step in out:
        for key in step.split('+'):
            if not NOTE.match(key):
                raise ValueError(f'not a note: {key!r} in {text!r}')
    return out


def beats_of(time):
    return 4 if time in ('C', '4/4') else int(time.split('/')[0])


def build(e, problems):
    where = f"No. {e['number']} {e['part'] or '(whole)'}"
    beats = beats_of(e['time'])
    per_beat = UNITS.get(e['unit'])
    if per_beat is None and e['part'] == 'close':
        # A closing bar (a whole note, a chord) takes its exercise's division.
        per_beat = e.get('division')
    if per_beat is None:
        problems.append(f"{where}: unit {e['unit']!r}")
        per_beat = 4
    bar = beats * per_beat
    right, left = [], []
    rest = 0
    last = len(e['bars']) - 1
    for b, bar_data in enumerate(e['bars']):
        r, l = expand(bar_data['rh']), expand(bar_data['lh'])
        if len(r) != len(l):
            problems.append(f'{where} bar {b + 1}: {len(r)} steps RH, {len(l)} LH')
        # A rest (in quarters) ends only the last bar; the steps share what is left of it.
        if bar_data.get('rest'):
            if b != last:
                problems.append(f'{where} bar {b + 1}: a rest before the last bar')
            rest = bar_data['rest'] * per_beat
        sounding = bar - (rest if b == last else 0)
        if sounding % len(r) != 0:
            problems.append(f'{where} bar {b + 1}: {len(r)} steps do not divide the bar')
        elif len(r) != bar and not bar_data.get('marks'):
            problems.append(f'{where} bar {b + 1}: {len(r)} steps in a bar of {bar}, no mark')
        right.append(r)
        left.append(l)
    fingers = {h: [[None] * len(s) for s in steps] for h, steps in (('RH', right), ('LH', left))}
    for bar_no, hand, step, digits in e['digits']:
        steps = right if hand == 'RH' else left
        if not 1 <= bar_no <= len(steps) or not 0 <= step < len(steps[bar_no - 1]):
            problems.append(f'{where}: digit {digits} at bar {bar_no} {hand} step {step}: no step')
            continue
        keys = steps[bar_no - 1][step].count('+') + 1
        if len(digits) != keys:
            problems.append(f'{where} bar {bar_no} {hand} step {step}: {digits!r} for {keys} key(s)')
            continue
        if fingers[hand][bar_no - 1][step] is not None:
            problems.append(f'{where} bar {bar_no} {hand} step {step}: two digits')
        fingers[hand][bar_no - 1][step] = digits
    out = {
        'number': e['number'],
        'part': e['part'],
        'page': e['page'],
        'pdf': e['pdf'],
        'beats': beats,
        'perBeat': per_beat,
        'right': right,
        'left': left,
        'rightFingers': [['.' * (s.count('+') + 1) if d is None else d for s, d in zip(steps, ds)]
                         for steps, ds in zip(right, fingers['RH'])],
        'leftFingers': [['.' * (s.count('+') + 1) if d is None else d for s, d in zip(steps, ds)]
                        for steps, ds in zip(left, fingers['LH'])],
    }
    if rest:
        # Divisions of rest after the last step, in both hands.
        out['rest'] = rest
    return out


def resolved(folder):
    ns = {}
    path = os.path.join(HERE, 'resolved.py')
    if os.path.exists(path):
        exec(open(path).read(), ns)
    source = ns.get('SOURCE', {})
    other = {(e['number'], e['part']): e for e in load('passB' if folder == 'passA' else 'passA')}
    out = []
    for e in load(folder):
        key = (e['number'], e['part'])
        if source.get(key) and source[key] != folder:
            e = other[key]
        for fix in ns.get('FIXES', []):
            if (fix['number'], fix['part']) == key:
                e = fix['apply'](e)
        out.append(e)
    return out


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else 'passA'
    target = sys.argv[2] if len(sys.argv) > 2 else 's7.json'
    problems = []
    parts = resolved(folder)
    for e in parts:
        if e['part'] == 'close':
            others = [UNITS.get(x['unit']) for x in parts
                      if x['number'] == e['number'] and x['part'] != 'close']
            e['division'] = next((u for u in others if u), None)
    data = [build(e, problems) for e in parts]
    data.sort(key=lambda d: (d['number'], d['pdf']))
    for p in problems:
        print('CHECK', p)
    with open(os.path.join(HERE, target), 'w') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    print(f'wrote {target}: {len(data)} parts, {len(problems)} check(s) failed')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())

"""Build part1.json from a reading of Hanon's Part I (Nos. 1-20).

    python3 build_part1.py passA part1.json

It builds from the reading with the differences between the two readings settled as resolved.py
says (whole exercises taken from the other reading where one misread the plate's structure, and
the doubtful digits as read at 1200 dpi).

A reading gives, per exercise, the first bar of each half in full (both hands, sounding pitch),
the first note of every bar, the bars that are not the first bar of their half moved by step (in
full), the closing bar and every printed digit. This expands it into every note of every bar:

  a regular bar is the first bar of its half moved by the scale steps (C major, no accidentals)
  from that bar's first note to the bar's first note as read;
  an irregular bar is as read;
  the closing bar is as read, one note or chord a hand held for the whole bar.

and checks what the plate should show: every bar starts where the reading says, the bars of each
half start a step apart (up in the first half, down in the second), the left hand plays the right
hand's notes an octave lower (the closing bar apart), and every digit falls on a note. The digits are the printed ones
only: a note without one has none. Rebuilding gives the committed part1.json byte for byte.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ['part1_01_05.py', 'part1_06_10.py', 'part1_11_15.py', 'part1_16_20.py']
LETTERS = 'CDEFGAB'


def parse(name):
    letter, rest = name[0], name[1:]
    if rest[:1] in ('#', 'b'):
        raise ValueError(f'an accidental in Part I: {name}')
    return LETTERS.index(letter) + 7 * int(rest)


def spell(diatonic):
    return f'{LETTERS[diatonic % 7]}{diatonic // 7}'


def notes(text):
    return text.split()


def shifted(bar, to):
    """The bar moved by scale steps so that it starts on `to`."""
    step = parse(to) - parse(bar[0])
    return [spell(parse(n) + step) for n in bar]


def load(folder):
    out = []
    for name in FILES:
        ns = {}
        exec(open(os.path.join(HERE, folder, name)).read(), ns)
        out.extend(ns['E'])
    return sorted(out, key=lambda e: e['number'])


def resolved(folder):
    """The reading with the differences settled as resolved.py says."""
    ns = {}
    exec(open(os.path.join(HERE, 'resolved.py')).read(), ns)
    other = {e['number']: e for e in load('passB' if folder == 'passA' else 'passA')}
    out = []
    for e in load(folder):
        source = ns['SOURCE'].get(e['number'])
        if source and source != folder:
            e = other[e['number']]
        digits = {(d[0], d[1], d[2]): d[3] for d in e['digits']}
        for (number, bar, hand, index), digit in ns['DIGITS'].items():
            if number == e['number']:
                digits[(bar, hand, index)] = digit
        e = {**e, 'digits': [(b, h, i, d) for (b, h, i), d in sorted(digits.items())]}
        e['corrections'] = [c for c in ns['CORRECTIONS'] if c['number'] == e['number']]
        out.append(e)
    return out


def build(e, problems):
    n = e['number']
    up, down = e['bars_up'], e['bars_down']
    bars = up + down
    beats = int(e['time'].split('/')[0])
    hands = {}
    for hand in ('rh', 'lh'):
        starts = e[f'starts_{hand}']
        if len(starts) != bars:
            problems.append(f'No. {n} {hand}: {len(starts)} bar starts for {bars} bars')
        first = {'up': notes(e[f'up_{hand}']), 'down': notes(e[f'down_{hand}'])}
        out = []
        for b in range(bars):
            number = b + 1
            irregular = e['irregular'].get(number) or e['irregular'].get(str(number))
            if irregular:
                bar = notes(irregular[hand])
            else:
                bar = shifted(first['up' if b < up else 'down'], starts[b])
            if bar[0] != starts[b]:
                problems.append(f'No. {n} {hand} bar {number}: starts {bar[0]}, read {starts[b]}')
            if b > 0 and b != up and not irregular and not (e['irregular'].get(b) or e['irregular'].get(str(b))):
                step = parse(starts[b]) - parse(starts[b - 1])
                want = 1 if b < up else -1
                if step != want:
                    problems.append(f'No. {n} {hand} bar {number}: {starts[b - 1]} to {starts[b]}')
            out.append(bar)
        # The closing bar: one note a hand, or a chord (No. 20), written `E3+C4`.
        out.append(['+'.join(sorted(notes(e[f'close_{hand}']), key=parse))])
        hands[hand] = out
    for b, (r, l) in enumerate(zip(hands['rh'][:-1], hands['lh'][:-1])):
        if len(r) != len(l) or any(parse(x) - parse(y) != 7 for x, y in zip(r, l)):
            problems.append(f'No. {n} bar {b + 1}: the hands are not an octave apart ({r} / {l})')
    fingers = {h: [[None] * len(bar) for bar in hands[h]] for h in ('rh', 'lh')}
    for bar, hand, index, digit in e['digits']:
        h = hand.lower()
        if not 1 <= bar <= bars + 1 or not 0 <= index < len(hands[h][bar - 1]):
            problems.append(f'No. {n}: digit {digit} at bar {bar} {hand} note {index} has no note')
            continue
        if '+' in hands[h][bar - 1][index]:
            problems.append(f'No. {n}: a digit on a chord, bar {bar} {hand}')
        if fingers[h][bar - 1][index] is not None:
            problems.append(f'No. {n}: two digits at bar {bar} {hand} note {index}')
        fingers[h][bar - 1][index] = digit
    return {
        'number': n,
        'page': e['page'],
        'pdf': e['pdf'],
        'beats': beats,
        'up': up,
        'down': down,
        'right': hands['rh'],
        'left': hands['lh'],
        'rightFingers': fingers['rh'],
        'leftFingers': fingers['lh'],
        # Digits printed that dacapo does not use (resolved.py): the fingers above are as printed.
        'corrections': [
            {k: c[k] for k in ('bar', 'hand', 'index', 'printed', 'used', 'reason')}
            for c in e['corrections']
        ],
    }


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else 'passA'
    target = sys.argv[2] if len(sys.argv) > 2 else 'part1.json'
    problems = []
    data = [build(e, problems) for e in resolved(folder)]
    for p in problems:
        print('CHECK', p)
    with open(os.path.join(HERE, target), 'w') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    print(f'wrote {target}: {len(data)} exercises, {len(problems)} check(s) failed')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())

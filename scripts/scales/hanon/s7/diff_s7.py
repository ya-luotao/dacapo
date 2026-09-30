"""Diff the two independent readings of Hanon's Nos. 42-53 (the parts S7 offers):

    python3 diff_s7.py

passA/ and passB/ hold one reading each, made by readers who did not see the other. Both are
expanded (build_s7.expand) and compared part by part: the time and value, every bar's steps in
both hands, and every digit.
"""
import sys

from build_s7 import beats_of, expand, load


def main():
    a = {(e['number'], e['part']): e for e in load('passA')}
    b = {(e['number'], e['part']): e for e in load('passB')}
    differences = 0
    for key in sorted(set(a) | set(b), key=lambda k: (k[0], str(k[1]))):
        x, y = a.get(key), b.get(key)
        where = f'No. {key[0]} {key[1] or "(whole)"}'
        if not x or not y:
            print(f'{where}: missing in {"passA" if not x else "passB"}')
            differences += 1
            continue
        if beats_of(x['time']) != beats_of(y['time']):
            print(f"{where} time: A={x['time']!r} B={y['time']!r}")
            differences += 1
        if x['unit'].rstrip('s') != y['unit'].rstrip('s'):
            print(f"{where} unit: A={x['unit']!r} B={y['unit']!r}")
            differences += 1
        if len(x['bars']) != len(y['bars']):
            print(f'{where}: A {len(x["bars"])} bars, B {len(y["bars"])}')
            differences += 1
        for n, (bx, by) in enumerate(zip(x['bars'], y['bars'])):
            for hand in ('rh', 'lh'):
                sx, sy = expand(bx[hand]), expand(by[hand])
                if sx != sy:
                    at = next((i for i, (p, q) in enumerate(zip(sx, sy)) if p != q), min(len(sx), len(sy)))
                    print(f'{where} bar {n + 1} {hand.upper()}: {len(sx)} / {len(sy)} steps, first '
                          f'difference at step {at}: A={sx[at] if at < len(sx) else None} '
                          f'B={sy[at] if at < len(sy) else None}')
                    differences += 1
        dx = {(d[0], d[1], d[2]): d[3] for d in x['digits']}
        dy = {(d[0], d[1], d[2]): d[3] for d in y['digits']}
        for k in sorted(set(dx) | set(dy)):
            if dx.get(k) != dy.get(k):
                print(f'{where} digit bar {k[0]} {k[1]} step {k[2]}: A={dx.get(k)} B={dy.get(k)}')
                differences += 1
    print('differences:', differences)
    return differences


if __name__ == '__main__':
    sys.exit(1 if main() else 0)

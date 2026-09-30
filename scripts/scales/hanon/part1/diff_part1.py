"""Diff the two independent readings of Hanon's Part I (Nos. 1-20): python3 diff_part1.py

passA/ and passB/ hold one reading each (part1_01_05.py ... part1_16_20.py), made by readers who
did not see the other. Every field is compared: the bar counts, the first bar of each half in
full, the first note of every bar, the irregular bars, the closing bar, and every printed digit.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ['part1_01_05.py', 'part1_06_10.py', 'part1_11_15.py', 'part1_16_20.py']
FIELDS = ['time', 'bars_up', 'bars_down', 'up_rh', 'up_lh', 'down_rh', 'down_lh', 'starts_rh',
          'starts_lh', 'irregular', 'close_rh', 'close_lh']


def load(folder):
    out = {}
    for name in FILES:
        path = os.path.join(HERE, folder, name)
        ns = {}
        exec(open(path).read(), ns)
        for e in ns['E']:
            out[e['number']] = e
    return out


def norm(value):
    """Note lists as lists of names, whitespace-insensitive."""
    if isinstance(value, str):
        return ' '.join(value.split())
    if isinstance(value, list):
        return [norm(v) for v in value]
    if isinstance(value, dict):
        return {(int(k) if str(k).isdigit() else k): norm(v) for k, v in value.items()}
    return value


def main():
    a, b = load('passA'), load('passB')
    differences = 0
    for number in range(1, 21):
        x, y = a.get(number), b.get(number)
        if not x or not y:
            print(f'No. {number}: missing in {"passA" if not x else "passB"}')
            differences += 1
            continue
        for field in FIELDS:
            if norm(x.get(field)) != norm(y.get(field)):
                if field.startswith('starts'):
                    xs, ys = norm(x.get(field)), norm(y.get(field))
                    for i in range(max(len(xs), len(ys))):
                        u = xs[i] if i < len(xs) else None
                        v = ys[i] if i < len(ys) else None
                        if u != v:
                            print(f'No. {number} {field} bar {i + 1}: A={u} B={v}')
                            differences += 1
                else:
                    print(f'No. {number} {field}: A={x.get(field)!r} B={y.get(field)!r}')
                    differences += 1
        da = {(d[0], d[1], d[2]): d[3] for d in x['digits']}
        db = {(d[0], d[1], d[2]): d[3] for d in y['digits']}
        for key in sorted(set(da) | set(db)):
            if da.get(key) != db.get(key):
                print(f'No. {number} digit bar {key[0]} {key[1]} note {key[2]}: '
                      f'A={da.get(key)} B={db.get(key)}')
                differences += 1
    print('differences:', differences)
    return differences


if __name__ == '__main__':
    sys.exit(1 if main() else 0)

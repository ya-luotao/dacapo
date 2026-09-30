"""Diff pass 1 of No. 41 against the independent pass 2 (printed digits only)."""
import os

B = os.path.dirname(os.path.abspath(__file__))


def load(path):
    ns = {}
    exec(open(path).read(), ns)
    return ns['S']


p1 = load(f'{B}/pass1/data41.py')
p2 = []
for part in ('A', 'B'):
    p2 += load(f'{B}/pass2/data41_{part}.py')
k1 = {(s['pdf'], s['system']): s for s in p1}
k2 = {(s['pdf'], s['system']): s for s in p2}
print(f'No. 41: pass1 {len(p1)} systems, pass2 {len(p2)} systems')
nd = 0
for key in sorted(set(k1) | set(k2)):
    a, b = k1.get(key), k2.get(key)
    if not a or not b:
        print('MISSING in', 'pass2' if not b else 'pass1', key)
        continue
    head = f"p{key[0]}/{key[1]} {a['key']} {a['mode']}"
    for fld in ('key', 'mode', 'rh', 'lh'):
        if str(a[fld]) != str(b.get(fld)):
            print(f'{head}: {fld} pass1={a[fld]} pass2={b.get(fld)}')
            nd += 1
    norm = lambda h: str(h).replace('♭', 'b').replace('♯', '#')
    if norm(a['header']) != norm(b.get('header', '')):
        print(f"{head}: header pass1={a['header']!r} pass2={b.get('header')!r}")
    for hand in ('RH', 'LH'):
        A, Bd = a[hand], b.get(hand, {})
        for i in sorted(set(A) | set(Bd)):
            if A.get(i) != Bd.get(i):
                print(f'{head} {hand} idx {i}: pass1={A.get(i)} pass2={Bd.get(i)}')
                nd += 1
print('No. 41 digit/metadata differences:', nd)

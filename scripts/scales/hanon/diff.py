"""Diff pass 1 against the independent pass 2 (printed digits only)."""
import os
B = os.path.dirname(os.path.abspath(__file__))


def load(path, var):
    ns = {}
    exec(open(path).read(), ns)
    return ns[var]


p1 = load(f'{B}/pass1/data.py', 'S')
p2 = []
for part in ('A', 'B'):
    f = f'{B}/pass2/data_{part}.py'
    if os.path.exists(f):
        p2 += load(f, 'S')
k1 = {(s['pdf'], s['systems'][0]): s for s in p1}
k2 = {(s['pdf'], s['systems'][0]): s for s in p2}
print(f'No. 39: pass1 {len(p1)} scales, pass2 {len(p2)} scales')
ndiff = 0
for key in sorted(set(k1) | set(k2)):
    a, b = k1.get(key), k2.get(key)
    if not a or not b:
        print('MISSING in', 'pass2' if not b else 'pass1', key)
        continue
    head = f"p{key[0]} {a['key']} {a['mode']}"
    for fld in ('key', 'mode', 'rh', 'lh'):
        if str(a[fld]) != str(b.get(fld)):
            print(f'{head}: {fld} pass1={a[fld]} pass2={b.get(fld)}'); ndiff += 1
    if a['header'].replace('♭', 'b').replace('♯', '#') != str(b.get('header', '')).replace('♭', 'b').replace('♯', '#'):
        print(f"{head}: header pass1={a['header']!r} pass2={b.get('header')!r}")
    for hand in ('RH', 'LH'):
        A, Bd = a[hand], b.get(hand, {})
        for i in sorted(set(A) | set(Bd)):
            if A.get(i) != Bd.get(i):
                print(f'{head} {hand} idx {i}: pass1={A.get(i)} pass2={Bd.get(i)}'); ndiff += 1
    if b.get('uncertain'):
        print(f'{head}: pass2 uncertain -> {b["uncertain"]}')
    if b.get('note'):
        print(f'{head}: pass2 note -> {b["note"]}')
print('No. 39 digit/metadata differences:', ndiff)

f40 = f'{B}/pass2/data_C.py'
if os.path.exists(f40):
    c1 = load(f'{B}/pass1/data40.py', 'C')
    c2 = load(f40, 'C')
    m2 = {c['variant']: c for c in c2}
    nd = 0
    for c in c1:
        v = c['variant']
        if v not in m2:
            print('No. 40 MISSING in pass2:', v); continue
        d = m2[v]
        for fld in ('rh_start', 'lh_start', 'octaves'):
            if str(c[fld]) != str(d.get(fld)):
                print(f'40 {v}: {fld} pass1={c[fld]} pass2={d.get(fld)}'); nd += 1
        for hand in ('RH', 'LH'):
            h = c[hand]
            first = h['first']; second = 'down' if first == 'up' else 'up'
            bars1 = [list(x) for x in h[first]] + [[h['turn']] + list(h[second][0])] + [list(x) for x in h[second][1:]]
            flat1 = sum(bars1, []) + [h['final']]
            hd = d[hand]
            if hd.get('first') != first:
                print(f'40 {v} {hand}: first direction pass1={first} pass2={hd.get("first")}'); nd += 1
            flat2 = sum([list(x) for x in hd['bars']], []) + [hd['final']]
            if len(flat1) != len(flat2):
                print(f'40 {v} {hand}: length pass1={len(flat1)} pass2={len(flat2)}'); nd += 1
            for i, (x, y) in enumerate(zip(flat1, flat2)):
                if x != y:
                    print(f'40 {v} {hand} note {i} (bar {i // 12 + 1}, pos {i % 12 + 1}): pass1={x} pass2={y}'); nd += 1
        if d.get('uncertain'):
            print(f'40 {v}: pass2 uncertain -> {d["uncertain"]}')
        if d.get('note'):
            print(f'40 {v}: pass2 note -> {d["note"]}')
    print('No. 40 differences:', nd)

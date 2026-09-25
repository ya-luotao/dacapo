"""Builds MusicXML 4.0 (one piano part, two staves) from compact per-measure token lists. Used
for the built-in pieces the dacapo project encodes itself; see README.md.

Token: PITCH/DUR[flags]  PITCH = c4, fs5, bf3, r (rest), s (invisible spacer), [b3,d4] (chord).
DUR in sixteenths. Prefix g: = grace (eighth, slashed). Flags: !m mordent, !p inverted mordent,
~ tie start. clef:G / clef:F changes the clef of the voice's staff before the next note.
"""

from xml.sax.saxutils import escape

DIV = 4  # divisions per quarter: one sixteenth = 1
TYPES = {1: ('16th', 0), 2: ('eighth', 0), 3: ('eighth', 1), 4: ('quarter', 0), 6: ('quarter', 1),
         8: ('half', 0), 12: ('half', 1), 16: ('whole', 0)}
STEPS = 'CDEFGAB'


def parse_pitch(p):
    step = p[0].upper()
    rest = p[1:]
    alter = 0
    while rest and rest[0] in 'sf':
        alter += 1 if rest[0] == 's' else -1
        rest = rest[1:]
    return step, alter, int(rest)


def parse_token(tok):
    grace = tok.startswith('g:')
    if grace:
        tok = tok[2:]
    flags = []
    while tok[-2:] in ('!m', '!p') or tok.endswith('~'):
        if tok.endswith('~'):
            flags.append('tie')
            tok = tok[:-1]
        else:
            flags.append(tok[-2:])
            tok = tok[:-2]
    pitch, dur = tok.split('/')
    dur = int(dur)
    if pitch == 's':
        return {'grace': False, 'pitches': None, 'dur': dur, 'flags': [], 'spacer': True}
    if pitch == 'r':
        pitches = None
    elif pitch.startswith('['):
        pitches = [parse_pitch(x) for x in pitch[1:-1].split(',')]
    else:
        pitches = [parse_pitch(pitch)]
    return {'grace': grace, 'pitches': pitches, 'dur': dur, 'flags': flags}


def beam_groups(events, group_len):
    """Beam states per event index: list of (level, state)."""
    beams = {i: [] for i in range(len(events))}
    pos = 0
    runs = []
    cur = []
    for i, e in enumerate(events):
        if e.get('clef') or e['grace']:
            continue
        start_group = pos // group_len
        beamable = e['pitches'] is not None and e['dur'] < 4 and e['dur'] in (1, 2, 3)
        if cur and (not beamable or cur[0][1] != start_group):
            runs.append(cur)
            cur = []
        if beamable:
            cur.append((i, start_group))
        elif cur:
            runs.append(cur)
            cur = []
        pos += e['dur']
    if cur:
        runs.append(cur)
    for run in runs:
        idx = [i for i, _ in run]
        if len(idx) < 2:
            continue
        for k, i in enumerate(idx):
            beams[i].append((1, 'begin' if k == 0 else 'end' if k == len(idx) - 1 else 'continue'))
        # Second level: consecutive sixteenths.
        k = 0
        while k < len(idx):
            if events[idx[k]]['dur'] != 1:
                k += 1
                continue
            j = k
            while j + 1 < len(idx) and events[idx[j + 1]]['dur'] == 1:
                j += 1
            if j > k:
                for m in range(k, j + 1):
                    beams[idx[m]].append((2, 'begin' if m == k else 'end' if m == j else 'continue'))
            else:
                beams[idx[k]].append((2, 'backward hook' if k > 0 else 'forward hook'))
            k = j + 1
    return beams


class Accidentals:
    def __init__(self, fifths):
        sharps = 'FCGDAEB'
        flats = 'BEADGCF'
        self.key = {s: 0 for s in STEPS}
        for s in (sharps[:fifths] if fifths > 0 else flats[:-fifths]):
            self.key[s] = 1 if fifths > 0 else -1
        self.reset()

    def reset(self):
        self.state = {}

    def need(self, staff, step, alter, octave):
        current = self.state.get((staff, step, octave), self.key[step])
        self.state[(staff, step, octave)] = alter
        if current == alter:
            return None
        return {2: 'double-sharp', 1: 'sharp', 0: 'natural', -1: 'flat', -2: 'flat-flat'}[alter]


def note_xml(e, staff, voice, beams, acc, stem):
    out = []
    pitches = e['pitches'] or [None]
    t, dots = TYPES[2] if e['grace'] else TYPES[e['dur']]
    for n, p in enumerate(pitches):
        x = ['<note>']
        if e['grace']:
            x.append('<grace slash="yes"/>')
        if n > 0:
            x.append('<chord/>')
        if p is None:
            x.append('<rest measure="yes"/>' if e.get('whole_rest') else '<rest/>')
        else:
            step, alter, octave = p
            x.append(f'<pitch><step>{step}</step>' + (f'<alter>{alter}</alter>' if alter else '') +
                     f'<octave>{octave}</octave></pitch>')
        if not e['grace']:
            x.append(f'<duration>{e["dur"]}</duration>')
        if 'tie' in e['flags']:
            x.append('<tie type="start"/>')
        if e.get('tie_stop'):
            x.append('<tie type="stop"/>')
        x.append(f'<voice>{voice}</voice>')
        if not e.get('whole_rest'):
            x.append(f'<type>{t}</type>')
            x += ['<dot/>'] * dots
        if p is not None:
            a = acc.need(staff, *p)
            if a:
                x.append(f'<accidental>{a}</accidental>')
            if stem:
                x.append(f'<stem>{stem}</stem>')
        x.append(f'<staff>{staff}</staff>')
        if n == 0:
            for level, state in beams:
                x.append(f'<beam number="{level}">{state}</beam>')
        notations = []
        if 'tie' in e['flags']:
            notations.append('<tied type="start"/>')
        if e.get('tie_stop'):
            notations.append('<tied type="stop"/>')
        if n == 0 and '!m' in e['flags']:
            notations.append('<ornaments><mordent/></ornaments>')
        if n == 0 and '!p' in e['flags']:
            notations.append('<ornaments><inverted-mordent/></ornaments>')
        if notations:
            x.append('<notations>' + ''.join(notations) + '</notations>')
        x.append('</note>')
        out.append(''.join(x))
    return out


def voice_events(tokens):
    events = []
    for tok in tokens.split():
        if tok.startswith('clef:'):
            events.append({'clef': tok[5:], 'grace': False, 'pitches': None, 'dur': 0, 'flags': []})
        else:
            events.append(parse_token(tok))
    return events


def build(piece):
    parts = []
    acc = Accidentals(piece['fifths'])
    ties_open = set()
    for mi, m in enumerate(piece['measures']):
        acc.reset()
        x = [f'<measure number="{m.get("number", mi + (0 if piece.get("pickup") else 1))}"' +
             (' implicit="yes"' if m.get('implicit') else '') + '>']
        for bar in m.get('left', []):
            x.append(bar)
        if mi == 0:
            x.append(f'<attributes><divisions>{DIV}</divisions><key><fifths>{piece["fifths"]}</fifths>'
                     f'</key><time><beats>{piece["beats"]}</beats><beat-type>{piece["beat_type"]}'
                     f'</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2'
                     f'</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>')
            if piece.get('tempo_text'):
                sound = f'<sound tempo="{piece["bpm"]}"/>' if piece.get('bpm') else ''
                x.append(f'<direction placement="above"><direction-type><words>{escape(piece["tempo_text"])}'
                         f'</words></direction-type><staff>1</staff>{sound}</direction>')
        voices = [(staff, v, tokens) for staff, v, tokens in m['voices']]
        total = None
        for vi, (staff, voice, tokens) in enumerate(voices):
            events = voice_events(tokens)
            length = sum(e['dur'] for e in events if not e['grace'])
            if total is None:
                total = length
            elif vi > 0:
                x.append(f'<backup><duration>{total}</duration></backup>')
            if length != total:
                raise SystemExit(f'measure {mi}: voice {voice} has {length}, expected {total}')
            multi = sum(1 for s, _, _ in voices if s == staff) > 1
            stem = None
            if multi:
                stem = 'up' if voice in (1, 5) else 'down'
            group = piece['beam_group']
            beams = beam_groups(events, group)
            for i, e in enumerate(events):
                if e.get('clef'):
                    sign, line = ('G', 2) if e['clef'] == 'G' else ('F', 4)
                    x.append(f'<attributes><clef number="{staff}"><sign>{sign}</sign><line>{line}'
                             f'</line></clef></attributes>')
                    continue
                if e['pitches']:
                    for p in e['pitches']:
                        key = (staff, voice, p)
                        if key in ties_open:
                            e['tie_stop'] = True
                            ties_open.discard(key)
                        if 'tie' in e['flags']:
                            ties_open.add(key)
                if e.get('spacer'):
                    x.append(f'<forward><duration>{e["dur"]}</duration><voice>{voice}</voice>'
                             f'<staff>{staff}</staff></forward>')
                    continue
                if e['pitches'] is None and e['dur'] == total and len(events) == 1 and not m.get('implicit'):
                    e['whole_rest'] = True
                x += note_xml(e, staff, voice, beams[i], acc, stem)
        for bar in m.get('right', []):
            x.append(bar)
        x.append('</measure>')
        parts.append('\n'.join(x))
    comments = ''.join(f'<!-- {escape(c)} -->\n' for c in piece['comments'])
    work = ''.join([
        f'<work-number>{escape(piece["work_number"])}</work-number>' if piece.get('work_number') else '',
        f'<work-title>{escape(piece["title"])}</work-title>',
    ])
    creators = f'<creator type="composer">{escape(piece["composer"])}</creator>\n'
    if piece.get('arranger'):
        creators += f'<creator type="arranger">{escape(piece["arranger"])}</creator>\n'
    head = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
{comments}<score-partwise version="4.0">
<work>{work}</work>
<identification>
{creators}<rights>{escape(piece['rights'])}</rights>
<encoding><encoder>{escape(piece['encoder'])}</encoder><software>dacapo scripts/pieces/generate.py</software><encoding-date>{piece['encoding_date']}</encoding-date></encoding>
<source>{escape(piece['source'])}</source>
</identification>
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1">
'''
    return head + '\n'.join(parts) + '\n</part>\n</score-partwise>\n'


REPEAT_FWD = '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
REPEAT_BWD = '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'


def ending_start(n):
    return f'<barline location="left"><ending number="{n}" type="start">{n}.</ending></barline>'


def ending_stop_repeat(n):
    return (f'<barline location="right"><bar-style>light-heavy</bar-style><ending number="{n}" '
            f'type="stop"/><repeat direction="backward"/></barline>')


def ending_discontinue(n, final=False):
    style = '<bar-style>light-heavy</bar-style>' if final else ''
    return f'<barline location="right">{style}<ending number="{n}" type="discontinue"/></barline>'



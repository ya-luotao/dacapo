"""Builds MusicXML 4.0 (one piano part, two staves) from compact per-measure token lists. Used
for the built-in pieces the dacapo project encodes itself; see README.md.

Note token: [GRACE]PITCH/DUR[SUFFIXES]. PITCH = c4, fs5, bf3, r (rest), s (invisible spacer),
[b3,d4] (chord). DUR in sixteenths. GRACE: g: = grace note (eighth, slashed: an acciaccatura),
a: = grace note without a slash (an appoggiatura, drawn with DUR's note value).
SUFFIXES, in any order:
  ~        tie start
  ( )      slur start / stop; (N )N with an explicit number (default: the voice's slur number,
           1 for voice 1, 2 for voice 2, 3 for voice 5, 4 for voice 6)
  !m !p    mordent, inverted mordent        !tr !t !it  trill (no wavy line), turn, inverted turn
  !trw !w  trill with a wavy line starting, the wavy line's end
  !^s !^n !^f !_s !_n !_f  accidental mark above / below an ornament (sharp, natural, flat)
  !st !sts !te !ac !ma     staccato, staccatissimo, tenuto, accent, strong accent
  !fe      fermata                          !c   cautionary accidental (printed even if in force)
Marks go on the first note of a chord.

Direction token: @MARK[^][+N], at the voice's position (+N: N sixteenths later, may be x.5 when
the piece has 'divisions': 8), on the voice's staff, below it (^: above it). MARK:
  p pp ppp mp mf f ff fff sf sfz fz fp rf rfz sfp   dynamics
  < > !    crescendo / diminuendo hairpin start, hairpin end
  w:TEXT   words, `_` for a space (cresc., dim., dolce, riten.)
  dashes[ dashes]                                   dashes after words (a cresc. line), their end
  Ped Ped* Ped*Ped                                  sustain pedal down, up, changed: Ped. and *
                                                    signs, or with the piece's 'pedal_lines' a
                                                    bracket line, a change being its end and a new
                                                    start at one place (Verovio 6.3 draws a line's
                                                    'change' from MusicXML wrongly)
Chord symbol token (a lead sheet's symbols): @h:SYMBOL[+N], at the voice's position (+N: N
sixteenths later), above its staff, as a <harmony> with its root, kind and bass. SYMBOL is the
app's one style in ASCII: a root (C, Bb, F#), then nothing (major), m, dim (°), aug (+), sus2,
sus4, 7, maj7, m7, m7b5, dim7, 6, m6 or add9, then /BASS (D/F#, Am/G). The kind's text attribute
prints it as the app writes it (B♭maj7, F♯°, Dm7♭5).

clef:G / clef:F changes the clef of the voice's staff before the next note.
Piece-level 'clefs', e.g. {1: 'F'}, sets a staff's first clef (default: G on staff 1, F on 2);
'divisions' (default 4) the MusicXML divisions per quarter.

A hairpin end (@! or @!^) written before the first note of a bar is emitted at the end of the same
voice in the bar before (the same moment), unless a barline with repeats or endings is between:
the hairpin then ends at the barline, as an engraver ends one on a downbeat, and Verovio draws no
stray piece of it at the start of a new system.
"""

import re
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


SUFFIX = re.compile(r'~|\(\d?|\)\d?|![a-z]+|![\^_][snf]')
DYNAMICS = ('p', 'pp', 'ppp', 'mp', 'mf', 'f', 'ff', 'fff', 'sf', 'sfz', 'fz', 'fp', 'rf', 'rfz',
            'sfp')
NOTE_FLAGS = ('!m', '!p', '!tr', '!trw', '!w', '!t', '!it', '!st', '!sts', '!te', '!ac', '!ma',
              '!fe', '!c', '!^s', '!^n', '!^f', '!_s', '!_n', '!_f')
DIRECTION = re.compile(r'@(?P<mark>w:[^+^]+|dashes[\[\]]|Ped\*Ped|[A-Za-z]+\*?|[<>!])'
                       r'(?P<above>\^)?(?:\+(?P<offset>\d+(?:\.5)?))?$')


def parse_token(tok):
    grace = None
    if tok.startswith('g:'):
        grace, tok = 'slash', tok[2:]
    elif tok.startswith('a:'):
        grace, tok = 'plain', tok[2:]
    pitch, rest = tok.split('/')
    digits = re.match(r'\d+', rest).group(0)
    dur = int(digits)
    suffix = rest[len(digits):]
    flags = []
    slurs = []
    for part in SUFFIX.findall(suffix):
        if part == '~':
            flags.append('tie')
        elif part[0] in '()':
            slurs.append(('start' if part[0] == '(' else 'stop', int(part[1:]) if part[1:] else None))
        elif part in NOTE_FLAGS:
            flags.append(part)
        else:
            raise SystemExit(f'unknown flag {part} in {tok}')
    if ''.join(SUFFIX.findall(suffix)) != suffix:
        raise SystemExit(f'cannot read {tok}')
    if pitch == 's':
        return {'grace': False, 'pitches': None, 'dur': dur, 'flags': [], 'spacer': True}
    if pitch == 'r':
        pitches = None
    elif pitch.startswith('['):
        pitches = [parse_pitch(x) for x in pitch[1:-1].split(',')]
    else:
        pitches = [parse_pitch(pitch)]
    return {'grace': grace, 'pitches': pitches, 'dur': dur, 'flags': flags, 'slurs': slurs}


def parse_direction(tok):
    m = DIRECTION.match(tok)
    if not m:
        raise SystemExit(f'cannot read direction {tok}')
    mark = m.group('mark')
    if not (mark.startswith('w:') or mark in DYNAMICS or mark in ('<', '>', '!', 'Ped', 'Ped*',
                                                                   'Ped*Ped', 'dashes[',
                                                                   'dashes]')):
        raise SystemExit(f'unknown direction {tok}')
    return {'direction': mark, 'above': bool(m.group('above')),
            'offset': float(m.group('offset') or 0), 'grace': False, 'pitches': None, 'dur': 0,
            'flags': []}


# ASCII quality -> (MusicXML kind, the text the symbol prints: docs/HARMONY.md's one style).
HARMONY_KINDS = {
    '': ('major', ''), 'm': ('minor', 'm'), 'dim': ('diminished', '°'),
    'aug': ('augmented', '+'), 'sus2': ('suspended-second', 'sus2'),
    'sus4': ('suspended-fourth', 'sus4'), '7': ('dominant', '7'),
    'maj7': ('major-seventh', 'maj7'), 'm7': ('minor-seventh', 'm7'),
    'm7b5': ('half-diminished', 'm7♭5'), 'dim7': ('diminished-seventh', '°7'),
    '6': ('major-sixth', '6'), 'm6': ('minor-sixth', 'm6'), 'add9': ('major', 'add9'),
}
HARMONY = re.compile(r'@h:(?P<root>[A-G][b#]?)(?P<quality>[a-z0-9]*)(?:/(?P<bass>[A-G][b#]?))?'
                     r'(?:\+(?P<offset>\d+(?:\.5)?))?$')


def parse_harmony(tok):
    m = HARMONY.match(tok)
    if not m or m.group('quality') not in HARMONY_KINDS:
        raise SystemExit(f'cannot read chord symbol {tok}')
    note = lambda n: (n[0], {'': 0, 'b': -1, '#': 1}[n[1:]])  # noqa: E731
    return {'harmony': (note(m.group('root')), m.group('quality'),
                        note(m.group('bass')) if m.group('bass') else None),
            'offset': float(m.group('offset') or 0), 'grace': False, 'pitches': None, 'dur': 0,
            'flags': []}


def harmony_xml(e, staff, scale):
    (step, alter), quality, bass = e['harmony']
    kind, text = HARMONY_KINDS[quality]
    x = ['<harmony print-frame="no" placement="above">',
         f'<root><root-step>{step}</root-step>' +
         (f'<root-alter>{alter}</root-alter>' if alter else '') + '</root>',
         f'<kind text="{text}">{kind}</kind>']
    if bass:
        x.append(f'<bass><bass-step>{bass[0]}</bass-step>' +
                 (f'<bass-alter>{bass[1]}</bass-alter>' if bass[1] else '') + '</bass>')
    if quality == 'add9':
        x.append('<degree><degree-value>9</degree-value><degree-alter>0</degree-alter>'
                 '<degree-type text="">add</degree-type></degree>')
    offset = e['offset'] * scale
    if offset != int(offset):
        raise SystemExit(f'offset {e["offset"]} needs more divisions')
    if offset:
        x.append(f'<offset>{int(offset)}</offset>')
    x.append(f'<staff>{staff}</staff></harmony>')
    return ''.join(x)


def beam_groups(events, group_len):
    """Beam states per event index: list of (level, state)."""
    beams = {i: [] for i in range(len(events))}
    pos = 0
    runs = []
    cur = []
    for i, e in enumerate(events):
        if e.get('clef') or e.get('direction') or e.get('harmony') or e['grace']:
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

    def need(self, staff, step, alter, octave, force=False):
        current = self.state.get((staff, step, octave), self.key[step])
        self.state[(staff, step, octave)] = alter
        if current == alter and not force:
            return None
        return {2: 'double-sharp', 1: 'sharp', 0: 'natural', -1: 'flat', -2: 'flat-flat'}[alter]


ORNAMENTS = [('!tr', '<trill-mark/>'), ('!trw', '<trill-mark/><wavy-line type="start"/>'),
             ('!t', '<turn/>'), ('!it', '<inverted-turn/>'), ('!m', '<mordent/>'),
             ('!p', '<inverted-mordent/>'), ('!w', '<wavy-line type="stop"/>')]
ACCIDENTAL_MARKS = {'s': 'sharp', 'n': 'natural', 'f': 'flat'}
ARTICULATIONS = [('!ac', '<accent/>'), ('!ma', '<strong-accent/>'), ('!st', '<staccato/>'),
                 ('!sts', '<staccatissimo/>'), ('!te', '<tenuto/>')]
SLUR_NUMBERS = {1: 1, 2: 2, 5: 3, 6: 4}


def note_xml(e, staff, voice, beams, acc, stem, scale=1):
    out = []
    pitches = e['pitches'] or [None]
    if e['grace'] == 'plain':
        t, dots = TYPES[e['dur']]
    else:
        t, dots = TYPES[2] if e['grace'] else TYPES[e['dur']]
    flags = e['flags']
    for n, p in enumerate(pitches):
        x = ['<note>']
        if e['grace'] == 'slash':
            x.append('<grace slash="yes"/>')
        elif e['grace']:
            x.append('<grace/>')
        if n > 0:
            x.append('<chord/>')
        if p is None:
            x.append('<rest measure="yes"/>' if e.get('whole_rest') else '<rest/>')
        else:
            step, alter, octave = p
            x.append(f'<pitch><step>{step}</step>' + (f'<alter>{alter}</alter>' if alter else '') +
                     f'<octave>{octave}</octave></pitch>')
        if not e['grace']:
            x.append(f'<duration>{e["dur"] * scale}</duration>')
        if p in e.get('tie_stops', ()):
            x.append('<tie type="stop"/>')
        if 'tie' in flags:
            x.append('<tie type="start"/>')
        x.append(f'<voice>{voice}</voice>')
        if not e.get('whole_rest'):
            x.append(f'<type>{t}</type>')
            x += ['<dot/>'] * dots
        if p is not None:
            a = acc.need(staff, *p, force='!c' in flags)
            if a:
                x.append(f'<accidental>{a}</accidental>')
            if stem:
                x.append(f'<stem>{stem}</stem>')
        x.append(f'<staff>{staff}</staff>')
        if n == 0:
            for level, state in beams:
                x.append(f'<beam number="{level}">{state}</beam>')
        notations = []
        if p in e.get('tie_stops', ()):
            notations.append('<tied type="stop"/>')
        if 'tie' in flags:
            notations.append('<tied type="start"/>')
        if n == 0:
            # Stops before starts, so one slur can end and the next begin on the same note.
            for kind in ('stop', 'start'):
                for k, number in e.get('slurs', []):
                    if k == kind:
                        number = number or SLUR_NUMBERS[voice]
                        notations.append(f'<slur type="{kind}" number="{number}"/>')
            ornaments = [xml for flag, xml in ORNAMENTS if flag in flags]
            for flag in flags:
                if flag[:2] in ('!^', '!_'):
                    place = 'above' if flag[1] == '^' else 'below'
                    ornaments.append(f'<accidental-mark placement="{place}">'
                                     f'{ACCIDENTAL_MARKS[flag[2]]}</accidental-mark>')
            if ornaments:
                notations.append('<ornaments>' + ''.join(ornaments) + '</ornaments>')
            articulations = [xml for flag, xml in ARTICULATIONS if flag in flags]
            if articulations:
                notations.append('<articulations>' + ''.join(articulations) + '</articulations>')
            if '!fe' in flags:
                notations.append('<fermata type="upright"/>')
        if notations:
            x.append('<notations>' + ''.join(notations) + '</notations>')
        x.append('</note>')
        out.append(''.join(x))
    return out


def direction_xml(e, staff, voice, scale, pedal_lines=False):
    mark = e['direction']
    placement = 'above' if e['above'] else 'below'
    number = 1 if staff == 1 else 2
    if mark in DYNAMICS:
        kind = f'<dynamics><{mark}/></dynamics>'
    elif mark in ('<', '>', '!'):
        wedge = {'<': 'crescendo', '>': 'diminuendo', '!': 'stop'}[mark]
        kind = f'<wedge type="{wedge}" number="{number}"/>'
    elif mark.startswith('w:'):
        kind = f'<words font-style="italic">{escape(mark[2:].replace("_", " "))}</words>'
    elif mark.startswith('dashes'):
        kind = f'<dashes type="{"start" if mark[-1] == "[" else "stop"}" number="{number}"/>'
    else:
        if pedal_lines and mark == 'Ped*Ped':
            # A bracket's change: its end and a new start at one place (the parser reads the
            # pair as the change it is).
            return ''.join(direction_xml({**e, 'direction': m}, staff, voice, scale, True)
                           for m in ('Ped*', 'Ped'))
        pedal = {'Ped': 'start', 'Ped*': 'stop', 'Ped*Ped': 'change'}[mark]
        style = 'line="yes" sign="no"' if pedal_lines else 'line="no" sign="yes"'
        kind = f'<pedal type="{pedal}" {style}/>'
    offset = e['offset'] * scale
    if offset != int(offset):
        raise SystemExit(f'offset {e["offset"]} needs more divisions')
    x = [f'<direction placement="{placement}"><direction-type>{kind}</direction-type>']
    if offset:
        x.append(f'<offset>{int(offset)}</offset>')
    x.append(f'<voice>{voice}</voice><staff>{staff}</staff></direction>')
    return ''.join(x)


HAIRPIN_END = re.compile(r'@!\^?$')


def end_hairpins_at_barlines(measures):
    """Moves a hairpin end that opens a bar's voice to the end of that voice in the bar before."""
    out = [dict(m, voices=list(m['voices'])) for m in measures]
    for mi in range(1, len(out)):
        prev, cur = out[mi - 1], out[mi]
        if prev.get('right') or cur.get('left'):
            continue
        for vi, (staff, voice, tokens) in enumerate(cur['voices']):
            first, _, rest = tokens.strip().partition(' ')
            if not HAIRPIN_END.match(first):
                continue
            before = [k for k, (st, vo, _) in enumerate(prev['voices']) if (st, vo) == (staff, voice)]
            if not before:
                continue
            k = before[0]
            st, vo, prev_tokens = prev['voices'][k]
            prev['voices'][k] = (st, vo, f'{prev_tokens} {first}')
            cur['voices'][vi] = (staff, voice, rest)
    return out


def voice_events(tokens):
    events = []
    for tok in tokens.split():
        if tok.startswith('@h:'):
            events.append(parse_harmony(tok))
        elif tok.startswith('clef:'):
            events.append({'clef': tok[5:], 'grace': False, 'pitches': None, 'dur': 0, 'flags': []})
        elif tok.startswith('@'):
            events.append(parse_direction(tok))
        else:
            events.append(parse_token(tok))
    return events


def build(piece):
    parts = []
    acc = Accidentals(piece['fifths'])
    clefs = {1: 'G', 2: 'F', **piece.get('clefs', {})}
    ties_open = set()
    divisions = piece.get('divisions', DIV)
    scale = divisions // DIV
    pedal_lines = piece.get('pedal_lines', False)
    for mi, m in enumerate(end_hairpins_at_barlines(piece['measures'])):
        acc.reset()
        x = [f'<measure number="{m.get("number", mi + (0 if piece.get("pickup") else 1))}"' +
             (' implicit="yes"' if m.get('implicit') else '') + '>']
        for bar in m.get('left', []):
            x.append(bar)
        if mi == 0:
            # The mode is written where the piece's ending does not tell it (a da capo piece
            # whose written end is on the dominant): the Key control names the key from it.
            mode = f'<mode>{piece["mode"]}</mode>' if piece.get('mode') else ''
            x.append(f'<attributes><divisions>{divisions}</divisions><key><fifths>{piece["fifths"]}</fifths>'
                     f'{mode}</key><time><beats>{piece["beats"]}</beats><beat-type>{piece["beat_type"]}'
                     f'</beat-type></time><staves>2</staves>' + ''.join(
                         f'<clef number="{n}"><sign>{sign}</sign><line>{2 if sign == "G" else 4}'
                         f'</line></clef>' for n, sign in ((1, clefs[1]), (2, clefs[2]))) +
                     '</attributes>')
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
                x.append(f'<backup><duration>{total * scale}</duration></backup>')
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
                            e.setdefault('tie_stops', set()).add(p)
                            ties_open.discard(key)
                        if 'tie' in e['flags']:
                            ties_open.add(key)
                if e.get('direction'):
                    x.append(direction_xml(e, staff, voice, scale, pedal_lines))
                    continue
                if e.get('harmony'):
                    x.append(harmony_xml(e, staff, scale))
                    continue
                if e.get('spacer'):
                    x.append(f'<forward><duration>{e["dur"] * scale}</duration><voice>{voice}</voice>'
                             f'<staff>{staff}</staff></forward>')
                    continue
                notes = [e for e in events if not e.get('direction') and not e.get('harmony')]
                if e['pitches'] is None and e['dur'] == total and len(notes) == 1 and not m.get('implicit'):
                    e['whole_rest'] = True
                x += note_xml(e, staff, voice, beams[i], acc, stem, scale)
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



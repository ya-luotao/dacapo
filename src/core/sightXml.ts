// A sight-reading fragment as MusicXML, for Verovio to draw and parseMusicXml to read back: one
// piano part on a grand staff (the right hand's treble staff over the left hand's bass staff, a
// hand with nothing to play resting), the key and time signatures, chords, ties, beams by the
// beat, each hand's first finger, and a final barline. See docs/READING.md ("Sight-reading (R3)").
//
// Verovio draws what the file says and infers nothing, so the file spells out every accidental
// (a bar's alterations holding to its end on their line, a courtesy one in the next bar), the
// beams and the rests.

import { keyAlters } from './keys.ts';
import { type SightFragment, type SightNote } from './sightFragment.ts';
import { barTicks, beatsOf } from './sightLevels.ts';
import { staffKey, TICKS_PER_QUARTER, type Hand, type StaffHands } from './score.ts';

/** Divisions per quarter: a sixteenth is one. */
const DIVISIONS = 4;
const TICKS_PER_DIVISION = TICKS_PER_QUARTER / DIVISIONS;
const divisions = (ticks: number) => ticks / TICKS_PER_DIVISION;

const ACCIDENTALS: Record<number, string> = {
  [-2]: 'flat-flat',
  [-1]: 'flat',
  0: 'natural',
  1: 'sharp',
  2: 'double-sharp',
};

/** A written value from its length in ticks. */
const VALUES: Readonly<Record<number, { type: string; dot: boolean }>> = {
  [4 * TICKS_PER_QUARTER]: { type: 'whole', dot: false },
  [3 * TICKS_PER_QUARTER]: { type: 'half', dot: true },
  [2 * TICKS_PER_QUARTER]: { type: 'half', dot: false },
  [1.5 * TICKS_PER_QUARTER]: { type: 'quarter', dot: true },
  [TICKS_PER_QUARTER]: { type: 'quarter', dot: false },
  [0.75 * TICKS_PER_QUARTER]: { type: 'eighth', dot: true },
  [0.5 * TICKS_PER_QUARTER]: { type: 'eighth', dot: false },
  [0.25 * TICKS_PER_QUARTER]: { type: '16th', dot: false },
};

function valueOf(ticks: number): { type: string; dot: boolean } {
  const value = VALUES[ticks];
  if (!value) throw new Error(`no written value of ${ticks} ticks`);
  return value;
}

/** Which hand each staff is, for parseMusicXml: the right hand's on top. */
export function sightHands(): StaffHands {
  return { [staffKey(0, 1)]: 'right', [staffKey(0, 2)]: 'left' };
}

/** The notes struck together by one hand: a single note or a chord. */
interface Event {
  onset: number;
  duration: number;
  notes: SightNote[];
}

function eventsOf(notes: readonly SightNote[]): Event[] {
  const out: Event[] = [];
  for (const n of notes) {
    const last = out.at(-1);
    if (last && last.onset === n.onset) last.notes.push(n);
    else out.push({ onset: n.onset, duration: n.duration, notes: [n] });
  }
  for (const e of out) e.notes.sort((a, b) => a.midi - b.midi);
  return out;
}

/** The rests filling `from`-`to` within a bar: a whole bar's rest, else by the beat. */
function restsOf(from: number, to: number, bar: number): { at: number; ticks: number }[] {
  const out: { at: number; ticks: number }[] = [];
  let at = from;
  while (at < to) {
    const inBar = at % bar;
    const ticks =
      [2 * TICKS_PER_QUARTER, TICKS_PER_QUARTER, TICKS_PER_QUARTER / 2].find(
        (length) => at + length <= to && inBar % length === 0,
      ) ?? TICKS_PER_QUARTER / 4;
    out.push({ at, ticks });
    at += ticks;
  }
  return out;
}

/**
 * The beams of a bar's events on one staff: notes shorter than a quarter, one after another
 * within a beat, are joined; the second beam joins neighbouring sixteenths, and a sixteenth alone
 * among eighths gets a hook into the beat.
 */
function beamsOf(events: readonly (Event | null)[], bar: number): string[][] {
  const out = events.map(() => [] as string[]);
  const beamable = (e: Event | null) => e !== null && e.duration < TICKS_PER_QUARTER;
  const beatOf = (e: Event) => Math.floor((e.onset % bar) / TICKS_PER_QUARTER);
  const groups: number[][] = [];
  events.forEach((e, i) => {
    if (!e || !beamable(e)) return;
    const last = groups.at(-1);
    const prev = events[i - 1];
    if (last && last.at(-1) === i - 1 && prev && beatOf(prev) === beatOf(e)) last.push(i);
    else groups.push([i]);
  });
  for (const group of groups) {
    if (group.length < 2) continue;
    group.forEach((i, k) => {
      const value = k === 0 ? 'begin' : k === group.length - 1 ? 'end' : 'continue';
      out[i]!.push(`<beam number="1">${value}</beam>`);
    });
    const sixteenth = (i: number | undefined) =>
      i !== undefined && events[i]!.duration === TICKS_PER_QUARTER / 4;
    group.forEach((i, k) => {
      if (!sixteenth(i)) return;
      const prev = sixteenth(group[k - 1]);
      const next = sixteenth(group[k + 1]);
      const value =
        prev && next
          ? 'continue'
          : next
            ? 'begin'
            : prev
              ? 'end'
              : k === group.length - 1
                ? 'backward hook'
                : 'forward hook';
      out[i]!.push(`<beam number="2">${value}</beam>`);
    });
  }
  return out;
}

/** One staff's bars as MusicXML elements. */
function staffBars(fragment: SightFragment, hand: Hand, staff: 1 | 2): string[] {
  const bar = barTicks(fragment.meter);
  const inKey = keyAlters(fragment.fifths);
  const events = eventsOf(fragment.notes.filter((n) => n.hand === hand));
  const out: string[] = [];
  let before = new Map<string, number>();
  for (let m = 0; m < fragment.bars; m++) {
    const start = m * bar;
    const end = start + bar;
    const own = events.filter((e) => e.onset >= start && e.onset < end);
    // What is in the bar, in order: events and the rests between them.
    const items: (Event | { rest: number; at: number })[] = [];
    if (own.length === 0) {
      out.push(
        `<note><rest measure="yes"/><duration>${divisions(bar)}</duration><voice>${staff}</voice><staff>${staff}</staff></note>`,
      );
      before = new Map();
      continue;
    }
    let at = start;
    for (const e of own) {
      for (const r of restsOf(at, e.onset, bar)) items.push({ rest: r.ticks, at: r.at });
      items.push(e);
      at = e.onset + e.duration;
    }
    for (const r of restsOf(at, end, bar)) items.push({ rest: r.ticks, at: r.at });
    const beams = beamsOf(
      items.map((x) => ('notes' in x ? x : null)),
      bar,
    );
    const inForce = new Map<string, number>();
    const parts: string[] = [];
    items.forEach((item, i) => {
      if (!('notes' in item)) {
        const { type, dot } = valueOf(item.rest);
        parts.push(
          `<note><rest/><duration>${divisions(item.rest)}</duration><voice>${staff}</voice>` +
            `<type>${type}</type>${dot ? '<dot/>' : ''}<staff>${staff}</staff></note>`,
        );
        return;
      }
      const { type, dot } = valueOf(item.duration);
      item.notes.forEach((n, k) => {
        const { step, alter, octave } = n.pitch;
        const place = `${step}${octave}`;
        let accidental = '';
        if (!n.tieStop) {
          const expected = inForce.get(place) ?? inKey[step];
          const previous = before.get(place);
          const courtesy = previous !== undefined && previous !== alter && !inForce.has(place);
          if (alter !== expected || courtesy)
            accidental = `<accidental>${ACCIDENTALS[alter]}</accidental>`;
          inForce.set(place, alter);
        }
        const notations: string[] = [];
        if (n.tieStop) notations.push('<tied type="stop"/>');
        if (n.tieStart) notations.push('<tied type="start"/>');
        if (n.finger !== null)
          notations.push(
            `<technical><fingering placement="${hand === 'right' ? 'above' : 'below'}">${n.finger}</fingering></technical>`,
          );
        parts.push(
          '<note>' +
            (k > 0 ? '<chord/>' : '') +
            `<pitch><step>${step}</step>${alter !== 0 ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
            `<duration>${divisions(item.duration)}</duration>` +
            (n.tieStop ? '<tie type="stop"/>' : '') +
            (n.tieStart ? '<tie type="start"/>' : '') +
            `<voice>${staff}</voice><type>${type}</type>${dot ? '<dot/>' : ''}` +
            accidental +
            `<staff>${staff}</staff>` +
            (k === 0 ? beams[i]!.join('') : '') +
            (notations.length > 0 ? `<notations>${notations.join('')}</notations>` : '') +
            '</note>',
        );
      });
    });
    out.push(parts.join(''));
    before = inForce;
  }
  return out;
}

/** MusicXML 4.0 (partwise) for the fragment. */
export function sightMusicXml(fragment: SightFragment): string {
  const bar = barTicks(fragment.meter);
  const right = staffBars(fragment, 'right', 1);
  const left = staffBars(fragment, 'left', 2);
  const measures: string[] = [];
  for (let m = 0; m < fragment.bars; m++) {
    const attributes =
      m === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions>` +
          `<key><fifths>${fragment.fifths}</fifths><mode>${fragment.key.mode}</mode></key>` +
          `<time><beats>${beatsOf(fragment.meter)}</beats><beat-type>4</beat-type></time>` +
          '<staves>2</staves>' +
          '<clef number="1"><sign>G</sign><line>2</line></clef>' +
          '<clef number="2"><sign>F</sign><line>4</line></clef>' +
          '</attributes>'
        : '';
    const final =
      m === fragment.bars - 1
        ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
        : '';
    // The second phrase on a new system, where the page lays the phrases out (verovio.ts).
    const print = m > 0 && fragment.phrases.includes(m) ? '<print new-system="yes"/>' : '';
    measures.push(
      `<measure number="${m + 1}">${print}${attributes}${right[m]!}` +
        `<backup><duration>${divisions(bar)}</duration></backup>${left[m]!}${final}</measure>`,
    );
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('\n')}</part>` +
    '</score-partwise>\n'
  );
}

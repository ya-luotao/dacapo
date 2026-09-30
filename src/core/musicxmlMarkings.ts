// Reads the markings of a MusicXML score (docs/EXPRESSION.md, "The score's markings") while
// musicxml.ts walks it: dynamics, hairpins and the words cresc./dim., pedal marks and the words
// una corda / tre corde, slurs, fermatas and articulations. Positions are collected per written
// measure and anchored on the measure frame at the end, as the notes are.

import {
  ARTICULATIONS,
  emptyMarkings,
  isDynamic,
  type Articulation,
  type DynamicMark,
  type HairpinMark,
  type MarkPlace,
  type Markings,
  type PedalMark,
  type WrittenEnd,
} from './markings.ts';
import type { Measure } from './score.ts';

/** A place before the measure frame is known: `within` ticks from the start of `measure`. */
export interface PendingPlace {
  part: number;
  staff: number;
  measure: number;
  within: number;
}

/** A slur end: a note id, or a grace note's, known once the grace is attached to its note. */
export interface SlurEnd {
  id: string | null;
}

const CRESCENDO = /cresc/i;
const DIMINUENDO = /\bdim(\.|in|\b)|decresc/i;
const UNA_CORDA = /una\s+corda|\bu\.\s*c\./i;
const TRE_CORDE = /tre\s+corde|tutte\s+(le\s+)?corde|\bt\.\s*c\./i;

function child(el: Element, name: string): Element | null {
  for (const c of el.children) if (c.localName === name) return c;
  return null;
}

function childrenNamed(el: Element, name: string): Element[] {
  return [...el.children].filter((c) => c.localName === name);
}

type Pending<T> = Omit<T, 'measure' | 'tick'> & PendingPlace;

interface OpenSpan {
  place: PendingPlace;
  kind: HairpinMark['kind'];
  written: HairpinMark['written'];
}

interface OpenSlur {
  part: number;
  staff: number;
  voice: string;
  number: string;
  from: SlurEnd;
}

export interface MarkingReader {
  /** A `<direction>` at `place` (its offset already added). */
  direction: (el: Element, place: PendingPlace) => void;
  /** The `<notations>` of a note or rest at `place`: fermatas, dynamics, articulations, slurs. */
  notations: (
    note: Element,
    place: PendingPlace,
    slur: { voice: string; end: SlurEnd } | null,
  ) => Articulation[];
  /** Anchors everything on the measure frame. */
  finish: (measures: readonly Measure[]) => Markings;
}

export function createMarkingReader(): MarkingReader {
  const dynamics: Pending<DynamicMark>[] = [];
  const pedals: Pending<PedalMark>[] = [];
  const fermatas: PendingPlace[] = [];
  const spans: { open: OpenSpan; end: PendingPlace | 'next-dynamic' }[] = [];
  const slurs: { part: number; staff: number; voice: string; from: SlurEnd; to: SlurEnd }[] = [];
  // Open wedges and dashed words, by part and number; words without dashes wait for a dynamic.
  const wedges = new Map<string, OpenSpan>();
  const dashes = new Map<string, OpenSpan>();
  const openSlurs: OpenSlur[] = [];
  // Per part: which pedal is down, and under which number (a stop may end either).
  const pedalState = new Map<number, { sustain: string | null; sostenuto: string | null }>();
  let lastWords: { open: OpenSpan; end: 'next-dynamic' } | null = null;

  function pedalMark(el: Element, place: PendingPlace) {
    const type = el.getAttribute('type') ?? '';
    const number = el.getAttribute('number') ?? '1';
    const line = el.getAttribute('line') === 'yes';
    let state = pedalState.get(place.part);
    if (!state) pedalState.set(place.part, (state = { sustain: null, sostenuto: null }));
    const add = (pedal: PedalMark['pedal'], kind: PedalMark['type']) =>
      pedals.push({ ...place, pedal, type: kind, line });
    switch (type) {
      case 'start':
      case 'resume':
        state.sustain = number;
        add('sustain', 'start');
        return;
      case 'sostenuto':
        state.sostenuto = number;
        add('sostenuto', 'start');
        return;
      case 'change':
        state.sustain = number;
        add('sustain', 'change');
        return;
      case 'continue':
        add(
          state.sostenuto !== null && state.sustain === null ? 'sostenuto' : 'sustain',
          'continue',
        );
        return;
      case 'stop':
      case 'discontinue': {
        // A stop ends the sostenuto only when that is the pedal down under this number.
        const sostenuto =
          state.sostenuto !== null &&
          (state.sustain === null || (state.sostenuto === number && state.sustain !== number));
        if (sostenuto) state.sostenuto = null;
        else state.sustain = null;
        add(sostenuto ? 'sostenuto' : 'sustain', 'stop');
        return;
      }
    }
  }

  function words(text: string, place: PendingPlace, directionType: Element[]) {
    if (UNA_CORDA.test(text))
      pedals.push({ ...place, pedal: 'una-corda', type: 'start', line: false });
    if (TRE_CORDE.test(text))
      pedals.push({ ...place, pedal: 'una-corda', type: 'stop', line: false });
    const kind = CRESCENDO.test(text) ? 'crescendo' : DIMINUENDO.test(text) ? 'diminuendo' : null;
    if (!kind) return;
    const open: OpenSpan = { place, kind, written: 'words' };
    // Dashes in the same direction carry the span to their stop; without them it runs to the
    // next dynamic.
    const dash = directionType
      .flatMap((type) => childrenNamed(type, 'dashes'))
      .find((d) => d.getAttribute('type') === 'start');
    if (dash) {
      dashes.set(`${place.part}|${dash.getAttribute('number') ?? '1'}`, open);
    } else {
      const span = { open, end: 'next-dynamic' as const };
      spans.push(span);
      lastWords = span;
    }
  }

  /** Dashes starting in a direction of their own carry on the words just before them. */
  function dashesStart(mark: Element, place: PendingPlace) {
    const words = lastWords;
    lastWords = null;
    const same = words?.open.place;
    if (!words || !same || same.part !== place.part || same.measure !== place.measure) return;
    if (same.within !== place.within) return;
    spans.splice(spans.indexOf(words), 1);
    dashes.set(`${place.part}|${mark.getAttribute('number') ?? '1'}`, words.open);
  }

  return {
    direction(el, place) {
      const types = childrenNamed(el, 'direction-type');
      for (const type of types) {
        for (const mark of type.children) {
          switch (mark.localName) {
            case 'dynamics':
              for (const d of mark.children)
                if (isDynamic(d.localName)) dynamics.push({ ...place, dynamic: d.localName });
              break;
            case 'wedge': {
              const key = `${place.part}|${mark.getAttribute('number') ?? '1'}`;
              const kind = mark.getAttribute('type');
              if (kind === 'crescendo' || kind === 'diminuendo') {
                wedges.set(key, { place, kind, written: 'wedge' });
              } else if (kind === 'stop') {
                const open = wedges.get(key);
                if (open) spans.push({ open, end: place });
                wedges.delete(key);
              }
              break;
            }
            case 'words':
              words(mark.textContent ?? '', place, types);
              break;
            case 'dashes': {
              if (mark.getAttribute('type') === 'start') {
                if (!types.some((t) => child(t, 'words'))) dashesStart(mark, place);
                break;
              }
              if (mark.getAttribute('type') !== 'stop') break;
              const key = `${place.part}|${mark.getAttribute('number') ?? '1'}`;
              const open = dashes.get(key);
              if (open) spans.push({ open, end: place });
              dashes.delete(key);
              break;
            }
            case 'pedal':
              pedalMark(mark, place);
              break;
          }
        }
      }
    },

    notations(note, place, slur) {
      const articulations: Articulation[] = [];
      for (const notations of childrenNamed(note, 'notations')) {
        if (child(notations, 'fermata')) fermatas.push(place);
        for (const group of childrenNamed(notations, 'dynamics'))
          for (const d of group.children)
            if (isDynamic(d.localName)) dynamics.push({ ...place, dynamic: d.localName });
        for (const group of childrenNamed(notations, 'articulations'))
          for (const a of group.children)
            if ((ARTICULATIONS as readonly string[]).includes(a.localName))
              articulations.push(a.localName as Articulation);
        if (!slur) continue;
        const marks = childrenNamed(notations, 'slur');
        // A note may end one slur and begin the next under the same number: stops first.
        for (const mark of marks.filter((s) => s.getAttribute('type') === 'stop')) {
          const number = mark.getAttribute('number') ?? '1';
          const match = (s: OpenSlur) => s.part === place.part && s.number === number;
          // The slur of this voice, else one of another voice (a slur between the staves).
          let i = openSlurs.findLastIndex((s) => match(s) && s.voice === slur.voice);
          if (i < 0) i = openSlurs.findLastIndex(match);
          if (i < 0) continue;
          const { part, staff, voice, from } = openSlurs.splice(i, 1)[0]!;
          slurs.push({ part, staff, voice, from, to: slur.end });
        }
        for (const mark of marks.filter((s) => s.getAttribute('type') === 'start')) {
          openSlurs.push({
            part: place.part,
            staff: place.staff,
            voice: slur.voice,
            number: mark.getAttribute('number') ?? '1',
            from: slur.end,
          });
        }
      }
      return [...new Set(articulations)];
    },

    finish(measures) {
      const tick = (p: { measure: number; within: number }) =>
        measures[p.measure]!.start + p.within;
      const anchor = <T extends PendingPlace>({ measure, within, ...rest }: T) => ({
        ...rest,
        measure,
        tick: tick({ measure, within }),
      });
      const markings = emptyMarkings();
      markings.dynamics = dynamics.map(anchor).sort(byPlace);
      markings.pedals = asChanges(pedals.map(anchor).sort(byPlace));
      const seen = new Set<string>();
      markings.fermatas = fermatas
        .map(anchor)
        .filter((f) => {
          const key = `${f.part}|${f.staff}|${f.tick}`;
          return !seen.has(key) && Boolean(seen.add(key));
        })
        .sort(byPlace);
      const last = measures.at(-1);
      const pieceEnd: WrittenEnd = last
        ? { measure: last.index, tick: last.start + last.duration }
        : { measure: 0, tick: 0 };
      // A dashed span whose stop never came runs to the next dynamic too.
      for (const open of dashes.values()) spans.push({ open, end: 'next-dynamic' });
      markings.hairpins = spans
        .map(({ open, end }): HairpinMark => {
          const start = anchor(open.place);
          let to: WrittenEnd;
          if (end === 'next-dynamic') {
            const later = markings.dynamics.filter(
              (d) => d.part === start.part && d.tick > start.tick,
            );
            const next = later.find((d) => d.staff === start.staff) ?? later[0];
            to = next ? { measure: next.measure, tick: next.tick } : pieceEnd;
          } else {
            to = { measure: end.measure, tick: tick(end) };
          }
          return { ...start, kind: open.kind, written: open.written, end: to };
        })
        .filter((h) => h.end.tick > h.tick)
        .sort(byPlace);
      markings.slurs = slurs.flatMap(({ from, to, ...rest }) =>
        from.id !== null && to.id !== null && from.id !== to.id
          ? [{ ...rest, from: from.id, to: to.id }]
          : [],
      );
      return markings;
    },
  };
}

/**
 * A pedal's stop and a new start of it at one place is a change: a bracket line drawn with a notch
 * is often written that way (and is the way Verovio draws one).
 */
function asChanges(pedals: PedalMark[]): PedalMark[] {
  const out: PedalMark[] = [];
  for (const mark of pedals) {
    const i = out.findLastIndex((m) => m.part === mark.part && m.pedal === mark.pedal);
    const before = out[i];
    if (mark.type === 'start' && before?.type === 'stop' && before.tick === mark.tick) {
      out[i] = { ...before, type: 'change' };
      continue;
    }
    out.push(mark);
  }
  return out;
}

function byPlace(a: MarkPlace, b: MarkPlace): number {
  return a.tick - b.tick || a.part - b.part || a.staff - b.staff;
}

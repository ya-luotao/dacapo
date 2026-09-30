// How grace notes and ornaments sound when the app plays them: the demo, the other hand, "Listen"
// (docs/EXPRESSION.md, "Ornaments and grace notes", "Realising them"). Pure: milliseconds in,
// milliseconds out; and the keys they add, which wait and rhythm mode accept around the note (X4).

import type { GraceNote, Ornament } from './markings.ts';

/** An acciaccatura, and each note of a group of grace notes, lasts at most this long. */
export const GRACE_MAX_MS = 80;
/** Each short note of a mordent or a turn lasts at most this long. */
export const ORNAMENT_MAX_MS = 70;

/** Where a trill starts: on its note (the default) or on the note above, as in Baroque music. */
export type TrillStart = 'principal' | 'upper';

export interface RealiseOptions {
  trillStart: TrillStart;
}

export const DEFAULT_REALISE: RealiseOptions = { trillStart: 'principal' };

/** A key sounding from `on` to `off` (ms). */
export interface Sounding {
  midi: number;
  on: number;
  off: number;
}

export interface Principal extends Sounding {
  /** A thirty-second note (1/32 of a whole note) at the tempo there, in ms. */
  thirtySecond: number;
  /** An appoggiatura's share of the note (half, two thirds of a dotted note), in ms. */
  appoggiatura: number;
  ornaments?: readonly Ornament[];
  graces?: readonly GraceNote[];
}

/**
 * The keys a note with grace notes or ornaments sounds, in order of onset:
 *
 * - One unslashed grace note (a chord counts as one) is an appoggiatura: on the beat, taking
 *   `appoggiatura` ms of the note, which then sounds for the rest.
 * - A slashed one (an acciaccatura), and every note of a group of several, comes just before the
 *   beat: a thirty-second each, at most `GRACE_MAX_MS`, the last one ending on the beat.
 * - A mordent is principal–lower–principal, an inverted mordent principal–upper–principal (a long
 *   one twice), a turn upper–principal–lower–principal, an inverted turn the other way round: in
 *   thirty-seconds of at most `ORNAMENT_MAX_MS`, on the beat, the principal holding the rest. A
 *   delayed turn holds the principal first and turns at the end.
 * - A trill alternates the principal and its upper note in thirty-seconds from the start of the
 *   note (or from the upper note) and ends on the principal, closing with lower–principal when a
 *   turn is written with it.
 *
 * Nothing sounds before `floor` (the start of the span, or of the step in wait mode): a figure that
 * would begin earlier starts there and pushes its note later by as much.
 */
export function realise(
  note: Principal,
  floor = -Infinity,
  options: RealiseOptions = DEFAULT_REALISE,
): Sounding[] {
  const out: Sounding[] = [];
  let on = note.on;
  const graces = strikes(note.graces ?? []);
  if (graces.length === 1 && !graces[0]!.slash) {
    // An appoggiatura on the beat.
    const until = Math.min(note.off, on + note.appoggiatura);
    for (const midi of graces[0]!.midis) out.push({ midi, on, off: until });
    on = until;
  } else if (graces.length > 0) {
    const each = Math.min(note.thirtySecond, GRACE_MAX_MS);
    // Before the beat, unless that is before the floor: then from the floor, the note after.
    const start = Math.max(floor, on - each * graces.length);
    graces.forEach((strike, i) => {
      for (const midi of strike.midis)
        out.push({ midi, on: start + i * each, off: start + (i + 1) * each });
    });
    on = Math.max(on, start + each * graces.length);
  }
  const off = Math.max(on, note.off);
  out.push(...ornamented({ ...note, on, off }, options));
  return out.sort((a, b) => a.on - b.on || a.midi - b.midi);
}

/**
 * The keys a note's grace notes and ornaments play besides the note itself, ascending: what wait
 * and rhythm mode accept around the note without counting them wrong (docs/EXPRESSION.md,
 * "Playing them"). Empty for a note without either.
 */
export function ornamentKeys(note: {
  midi: number;
  ornaments?: readonly Ornament[];
  graces?: readonly GraceNote[];
}): number[] {
  if (!note.ornaments?.length && !note.graces?.length) return [];
  // Realised over a long note, so every figure (a trill, its closing turn) is played in full.
  const sounded = realise({
    midi: note.midi,
    on: 0,
    off: 100_000,
    thirtySecond: 100,
    appoggiatura: 50_000,
    ornaments: note.ornaments,
    graces: note.graces,
  });
  return [...new Set(sounded.map((s) => s.midi).filter((m) => m !== note.midi))].sort(
    (a, b) => a - b,
  );
}

/** The grace notes as struck: a chord of grace notes is one strike. */
function strikes(graces: readonly GraceNote[]): { midis: number[]; slash: boolean }[] {
  const out: { midis: number[]; slash: boolean }[] = [];
  for (const grace of graces) {
    const last = out.at(-1);
    if (grace.chord && last) last.midis.push(grace.midi);
    else out.push({ midis: [grace.midi], slash: grace.slash });
  }
  return out;
}

/** The principal from `on` to `off` with its ornament (the first one it can play). */
function ornamented(note: Principal, options: RealiseOptions): Sounding[] {
  const { midi, on, off } = note;
  const ornaments = note.ornaments ?? [];
  const length = off - on;
  const trill = ornaments.find((o) => o.kind === 'trill');
  if (trill) {
    const closing = ornaments.some((o) => o.kind !== 'trill' && o.kind.includes('turn'));
    return trilled(note, trill, closing, options.trillStart);
  }
  const ornament = ornaments[0];
  if (!ornament || length <= 0) return [{ midi, on, off }];
  const figure = (keys: number[], atEnd = false): Sounding[] => {
    // The short notes, then the principal holding what is left (or first, for a delayed turn).
    const each = Math.min(note.thirtySecond, ORNAMENT_MAX_MS, length / (keys.length + 1));
    if (atEnd) {
      const from = off - each * keys.length;
      return [
        { midi, on, off: from },
        ...keys.map((key, i) => ({ midi: key, on: from + i * each, off: from + (i + 1) * each })),
      ];
    }
    return [
      ...keys.map((key, i) => ({ midi: key, on: on + i * each, off: on + (i + 1) * each })),
      { midi, on: on + each * keys.length, off },
    ];
  };
  const { upper, lower } = ornament;
  switch (ornament.kind) {
    case 'mordent':
      return figure(ornament.long ? [midi, lower, midi, lower] : [midi, lower]);
    case 'inverted-mordent':
      return figure(ornament.long ? [midi, upper, midi, upper] : [midi, upper]);
    case 'turn':
      return figure([upper, midi, lower]);
    case 'inverted-turn':
      return figure([lower, midi, upper]);
    case 'delayed-turn':
      return figure([upper, midi, lower, midi], true);
    case 'delayed-inverted-turn':
      return figure([lower, midi, upper, midi], true);
    case 'trill':
      return [{ midi, on, off }];
  }
}

/** A trill in thirty-seconds over the note, ending on the principal. */
function trilled(
  note: Principal,
  trill: Ornament,
  closing: boolean,
  start: TrillStart,
): Sounding[] {
  const { midi, on, off } = note;
  const count = Math.floor((off - on) / note.thirtySecond);
  // Too short to alternate: an inverted mordent is what a short trill is.
  if (count < 3)
    return ornamented(
      { ...note, ornaments: [{ ...trill, kind: 'inverted-mordent' }] },
      DEFAULT_REALISE,
    );
  const keys: number[] = [];
  for (let i = 0; i < count; i++) {
    const upperFirst = start === 'upper';
    keys.push((i % 2 === 0) === upperFirst ? trill.upper : midi);
  }
  // It ends on the principal: drop a last upper note, then close with lower–principal if written.
  if (keys.at(-1) !== midi) keys.pop();
  if (closing && keys.length >= 4) keys.splice(keys.length - 2, 2, trill.lower, midi);
  return keys.map((key, i) => ({
    midi: key,
    on: on + i * note.thirtySecond,
    off: i === keys.length - 1 ? off : on + (i + 1) * note.thirtySecond,
  }));
}

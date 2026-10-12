// One octave of a grand piano, C4 to B4, as a teaching section: keys, action, strings, bridge,
// soundboard and pedals, true to size in millimetres. Pure geometry and physics: the figure's
// build (scripts/figures/grand-piano.mjs) draws it, and the lesson's figure moves it with the
// action model of pianoAction.ts.
//
// Coordinates are millimetres: `u` runs back from the front of the keys, `y` across the keyboard
// from the bass end of C4, `z` up from the top of the keybed. The drawing's world is `[-u, y, z]`
// times MM, so the player stands at +x and the treble is at +y.

import type { ActionState } from './pianoAction.ts';

export type UZ = readonly [number, number];
export type Point3 = [number, number, number];

export const MM = 0.4;
export const world = (u: number, y: number, z: number): Point3 => [-u * MM, y * MM, z * MM];

export const NOTES = 12;
export const FIRST_MIDI = 60;
export const NAMES = ['C4', 'C♯4', 'D4', 'D♯4', 'E4', 'F4', 'F♯4', 'G4', 'G♯4', 'A4', 'A♯4', 'B4'];
export const BLACK = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];
/** Seven naturals, 23.5 mm apart: one octave of a standard keyboard is 164.5 mm wide. */
export const OCTAVE = 164.5;
/** Behind the key fronts every key lever, hammer and unison sits on an even pitch. */
export const PITCH = OCTAVE / NOTES;
export const noteY = (i: number): number => (i + 0.5) * PITCH;
export const NATURALS = [0, 2, 4, 5, 7, 9, 11];

export const freqOf = (i: number): number => 440 * 2 ** ((FIRST_MIDI + i - 69) / 12);
/** Speaking length, agraffe to bridge: 380 mm at A4, about 1.88 times longer per octave down. */
export const SCALE_A4 = 380;
export const SCALE_STEP = 1.88 ** (1 / 12);
/** The speaking length at a fractional note index, for the curve of the bridge. */
export const speakingAt = (t: number): number => SCALE_A4 * SCALE_STEP ** (9 - t);
export const speakingOf = (i: number): number => speakingAt(i);
/** Plain steel music wire: 1.05 mm up to E4, 1.00 mm from F4. */
export const wireOf = (i: number): number => (i < 5 ? 1.05 : 1.0);
const STEEL = 7850;
/** Tension in newtons that tunes a string, from f = (1 / 2L)·√(T / μ). */
export function tensionOf(i: number): number {
  const L = speakingOf(i) / 1000;
  const d = wireOf(i) / 1000;
  const mu = (STEEL * Math.PI * d * d) / 4;
  return (2 * L * freqOf(i)) ** 2 * mu;
}
export const UNISON = 3;
/** The three strings of a note, 4 mm apart. */
export const stringY = (i: number, s: number): number => noteY(i) + (s - 1) * 4;

// The action. The key lifts the capstan 0.39 of its dip, the wippen lifts the jack 1.77 times
// that, and the hammer's crown moves 6.9 times the knuckle: 10 mm of key dip throws the hammer
// about 47 mm, the blow distance of a regulated grand.
export const KEY = { from: 0, to: 520, bottom: 12, top: 34, dip: 10, head: 50, fall: 145 } as const;
export const BALANCE: UZ = [230, 12];
export const CAPSTAN = { u: 320, r: 5, z0: 34, z1: 46 } as const;
export const WIPPEN_PIVOT: UZ = [270, 58];
export const JACK = { pivot: [358.7, 64] as UZ, tilt: 0.2 } as const;
export const HAMMER = {
  pivot: [342, 108] as UZ,
  knuckle: [358.7, 101] as UZ,
  knuckleR: 3,
} as const;
export const STRING_Z = 202;
export const AGRAFFE_U = 390;
export const PIN_ROWS = [318, 340, 362] as const;
export const SOUNDBOARD = { u0: 570, u1: 1100, z0: 158, z1: 166 } as const;
export const BRIDGE = { half: 13, top: 201.5 } as const;
export const HITCH = { at: 60, z0: 184, z1: 192, pin: 200 } as const;
export const DAMPER = { pivot: [548, 44] as UZ, lift: 6.5, reach: 43 } as const;

/** Where the bridge crosses the line `y`, continuous across the notes. */
export const bridgeU = (y: number): number => AGRAFFE_U + speakingAt(y / PITCH - 0.5);

const KEY_TURN = KEY.dip / BALANCE[0];
const WIPPEN_RATIO = (CAPSTAN.u - BALANCE[0]) / (CAPSTAN.u - WIPPEN_PIVOT[0]);

/** Turns a (u, z) point about a pivot, counter-clockwise with u to the right and z up. */
export function turn([u, z]: UZ, [pu, pz]: UZ, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const du = u - pu;
  const dz = z - pz;
  return [pu + du * c - dz * s, pz + du * s + dz * c];
}

const FELT: readonly UZ[] = [
  [461, 138],
  [477, 138],
  [477, 147],
  [474.5, 152.5],
  [469, 155.5],
  [463.5, 152.5],
  [461, 147],
];
const CROWN: UZ = [469, 155.5];
/** The hammer's turn that brings its crown up against the strings. */
export const HAMMER_MAX = (() => {
  const du = CROWN[0] - HAMMER.pivot[0];
  const dz = CROWN[1] - HAMMER.pivot[1];
  return Math.asin((STRING_Z - 0.5 - HAMMER.pivot[1]) / Math.hypot(du, dz)) - Math.atan2(dz, du);
})();

export interface Pose {
  key: number;
  wippen: number;
  jack: number;
  hammer: number;
  /** How far the damper is lifted, in mm. */
  damper: number;
}

/** Angles and lifts for one note from the action model's state. */
export function poseOf(state: Pick<ActionState, 'key' | 'jack' | 'hammer' | 'damper'>): Pose {
  const key = KEY_TURN * state.key;
  return {
    key,
    wippen: key * WIPPEN_RATIO,
    jack: JACK.tilt * state.jack,
    hammer: HAMMER_MAX * state.hammer,
    damper: DAMPER.lift * state.damper,
  };
}

/** What moves a part: the key, the wippen, the jack on the wippen, the hammer, the damper. */
export type Chain = 'key' | 'wippen' | 'jack' | 'hammer' | 'lever' | 'lift' | 'fixed';

/** A (u, z) point of a part, where its chain has taken it in this pose. */
export function placeUZ(chain: Chain, point: UZ, pose: Pose): [number, number] {
  switch (chain) {
    case 'key':
      return turn(point, BALANCE, pose.key);
    case 'wippen':
      return turn(point, WIPPEN_PIVOT, pose.wippen);
    case 'jack':
      return turn(turn(point, JACK.pivot, pose.jack), WIPPEN_PIVOT, pose.wippen);
    case 'hammer':
      return turn(point, HAMMER.pivot, pose.hammer);
    case 'lever':
      return turn(point, DAMPER.pivot, -pose.damper / DAMPER.reach);
    case 'lift':
      return [point[0], point[1] + pose.damper];
    default:
      return [point[0], point[1]];
  }
}

interface PartBase {
  note: number;
  id: string;
  chain: Chain;
  tone: 'hi' | 'mid' | 'lo';
  /** Drawn in the ebony of a sharp, or the ivory of a natural's top. */
  ebony?: boolean;
  ivory?: boolean;
}
/** A prism along y of a (u, z) profile. */
export interface PrismPart extends PartBase {
  kind: 'prism';
  poly: readonly UZ[];
  y0: number;
  y1: number;
}
/** A round part standing up: a capstan, a let-off button. */
export interface PostPart extends PartBase {
  kind: 'post';
  at: UZ;
  r: number;
  z0: number;
  z1: number;
}
/** A round part lying along y: the knuckle. */
export interface RollPart extends PartBase {
  kind: 'roll';
  at: UZ;
  r: number;
  y0: number;
  y1: number;
}
export type Part = PrismPart | PostPart | RollPart;

const box = (u0: number, u1: number, z0: number, z1: number): UZ[] => [
  [u0, z0],
  [u1, z0],
  [u1, z1],
  [u0, z1],
];

/** The let-off button's face: the jack's toe reaches it at 0.88 of the key's travel. */
export const LETOFF_Z = 73 + (332 - WIPPEN_PIVOT[0]) * KEY_TURN * WIPPEN_RATIO * 0.88;

/** Every part of one note's key, action and damper. */
export function partsOf(i: number): Part[] {
  const y = noteY(i);
  const n = NATURALS.indexOf(i);
  const parts: Part[] = [];
  const prism = (
    id: string,
    chain: Chain,
    poly: readonly UZ[],
    y0: number,
    y1: number,
    tone: Part['tone'],
    extra: Partial<PartBase> = {},
  ) => parts.push({ note: i, id, chain, kind: 'prism', poly, y0, y1, tone, ...extra });
  const post = (
    id: string,
    chain: Chain,
    at: UZ,
    r: number,
    z0: number,
    z1: number,
    tone: Part['tone'],
  ) => parts.push({ note: i, id, chain, kind: 'post', at, r, z0, z1, tone });

  // The key lever with its key top, the capstan and the backcheck.
  prism(
    'lever',
    'key',
    box(BLACK[i] ? 52 : KEY.from, KEY.to, KEY.bottom, KEY.top),
    y - 5.4,
    y + 5.4,
    'mid',
  );
  if (BLACK[i]) {
    const sharp: UZ[] = [
      [54, 34],
      [KEY.fall, 34],
      [KEY.fall, 47],
      [64, 47],
      [54, 41],
    ];
    prism('sharp', 'key', sharp, y - 4.6, y + 4.6, 'hi', { ebony: true });
  } else {
    prism('neck', 'key', box(KEY.head, KEY.fall, KEY.top, KEY.top + 3), y - 5.4, y + 5.4, 'hi', {
      ivory: true,
    });
    prism(
      'head',
      'key',
      box(KEY.from, KEY.head, 14, KEY.top + 3),
      n * 23.5 + 0.5,
      (n + 1) * 23.5 - 0.5,
      'hi',
      { ivory: true },
    );
  }
  post('capstan', 'key', [CAPSTAN.u, y], CAPSTAN.r, CAPSTAN.z0, CAPSTAN.z1, 'mid');
  prism('check-wire', 'key', box(488.8, 491.2, KEY.top, 112), y - 0.9, y + 0.9, 'mid');
  prism(
    'check',
    'key',
    [
      [482, 112],
      [496, 112],
      [496, 134],
      [480, 134],
    ],
    y - 5,
    y + 5,
    'mid',
  );
  // The wippen on its flange, with the jack and the repetition lever it carries.
  prism('wippen-flange', 'fixed', box(264, 276, 48, 54), y - 3, y + 3, 'mid');
  prism(
    'wippen',
    'wippen',
    [
      [262, 54],
      [404, 55.5],
      [404, 62],
      [262, 62],
    ],
    y - 4,
    y + 4,
    'mid',
  );
  prism('heel', 'wippen', box(314, 326, 46, 54), y - 4, y + 4, 'mid');
  prism('rep-post', 'wippen', box(382, 388, 62, 92), y - 2.5, y + 2.5, 'mid');
  prism(
    'rep',
    'wippen',
    [
      [364, 92],
      [406, 92],
      [406, 96],
      [364, 98],
    ],
    y - 3.5,
    y + 3.5,
    'mid',
  );
  prism('jack', 'jack', box(355.2, 362.2, 62, 98), y - 3, y + 3, 'hi');
  prism('toe', 'jack', box(328, 356, 68, 73), y - 3, y + 3, 'hi');
  // The let-off button over the jack's toe, and the hammer on its flange.
  post('letoff-screw', 'fixed', [332, y], 0.9, 84, 92, 'mid');
  post('letoff', 'fixed', [332, y], 3.2, LETOFF_Z, 84, 'lo');
  prism('hammer-flange', 'fixed', box(330, 348, 100, 104), y - 4, y + 4, 'mid');
  prism('shank', 'hammer', box(336, 478, 104, 111), y - 2.5, y + 2.5, 'mid');
  parts.push({
    note: i,
    id: 'knuckle',
    chain: 'hammer',
    kind: 'roll',
    at: HAMMER.knuckle,
    r: HAMMER.knuckleR,
    y0: y - 4,
    y1: y + 4,
    tone: 'lo',
  });
  prism('molding', 'hammer', box(460, 478, 111, 138), y - 5, y + 5, 'mid');
  prism('felt', 'hammer', FELT, y - 5.5, y + 5.5, 'hi');
  // The damper: an underlever on the belly rail, a wire, and a felted head on the strings.
  prism('damper-flange', 'fixed', box(540, 552, 38, 50), y + 2, y + 6.6, 'mid');
  prism('underlever', 'lever', box(500, 540, 37.7, 46), y + 1, y + 7.4, 'mid');
  prism('damper-wire', 'lift', box(504.2, 505.8, 46, 208), y + 5.4, y + 7, 'mid');
  prism('damper-felt', 'lift', box(494, 516, STRING_Z + 1.2, 208), y - 5.4, y + 4.8, 'lo');
  prism('damper', 'lift', box(493, 517, 208, 220), y - 5.6, y + 7.2, 'hi');
  return parts;
}

/** Whether a part slides with the keyframe when the soft pedal is down: all but the dampers. */
export const shiftsWithKeys = (part: Part): boolean =>
  part.chain !== 'lever' && part.chain !== 'lift' && part.id !== 'damper-flange';

export interface StringRun {
  note: number;
  /** 0 to 2, bass to treble. */
  s: number;
  y: number;
  /** From and to, as (u, z). */
  run: readonly [UZ, UZ];
  /** On the speaking length, between agraffe and bridge: the part that swings. */
  speaking: boolean;
}

/**
 * One string from its tuning pin through the agraffe, under the damper, over the bridge to its
 * hitch pin, cut into short runs so it can pass in front of one part and behind the next.
 */
export function stringRuns(i: number, s: number): StringRun[] {
  const y = stringY(i, s);
  const ub = bridgeU(y);
  const hitch = ub + HITCH.at - 2;
  const cuts = [395, 440, 493, 517];
  for (let u = 600; u < ub - BRIDGE.half - 30; u += 90) cuts.push(u);
  cuts.push(ub - BRIDGE.half, ub + BRIDGE.half, hitch);
  const runs: StringRun[] = [
    {
      note: i,
      s,
      y,
      run: [
        [PIN_ROWS[s]! + 3.4, 210.5],
        [385, STRING_Z],
      ],
      speaking: false,
    },
  ];
  for (let c = 0; c < cuts.length - 1; c++) {
    const last = c === cuts.length - 2;
    runs.push({
      note: i,
      s,
      y,
      run: [
        [cuts[c]!, STRING_Z],
        [cuts[c + 1]!, last ? HITCH.pin - 3 : STRING_Z],
      ],
      speaking: cuts[c + 1]! <= ub - BRIDGE.half,
    });
  }
  return runs;
}

/** A string's height along its speaking length at a moment: a half sine of `swing` mm. */
export function stringZ(u: number, i: number, swing: number): number {
  const s = (u - AGRAFFE_U) / speakingOf(i);
  return s <= 0 || s >= 1 ? STRING_Z : STRING_Z + swing * Math.sin(Math.PI * s);
}

/**
 * The strings a hammer strikes: all three, or with the soft pedal down (the keyframe slid 2.5 mm
 * toward the treble) the two on the treble side.
 */
export const struckStrings = (soft: boolean): number => (soft ? 2 : UNISON);
export const UNA_CORDA = 2.5;

// The pedals, on a lyre box in front of the key slip: soft (una corda), sostenuto, sustain, from
// the player's left. Each is a lever on a pivot inside the box; its foot goes down 8 mm.
export const PEDAL_NAMES = ['soft', 'sostenuto', 'sustain'] as const;
export type PedalName = (typeof PEDAL_NAMES)[number];
export const LYRE = { u0: -72, u1: -22, y0: 34, y1: 131, z0: -30, z1: -2 } as const;
export const PEDAL = { pivot: [-46, -16] as UZ, drop: 8, ys: [52, 82.5, 113] } as const;
export const pedalAngle = (amount: number): number =>
  (PEDAL.drop / (PEDAL.pivot[0] + 152)) * amount;

export interface PedalPart {
  pedal: number;
  id: string;
  poly: readonly UZ[];
  y0: number;
  y1: number;
  tone: 'hi' | 'mid';
}
export function pedalParts(p: number): PedalPart[] {
  const y = PEDAL.ys[p]!;
  return [
    {
      pedal: p,
      id: 'pedal',
      poly: [
        [-72, -20],
        [-100, -20],
        [-100, -13.2],
        [-72, -12.5],
      ],
      y0: y - 4.5,
      y1: y + 4.5,
      tone: 'mid',
    },
    {
      pedal: p,
      id: 'foot',
      poly: [
        [-100, -21],
        [-150, -21],
        [-154, -18.5],
        [-152, -15],
        [-100, -15.5],
      ],
      y0: y - 11,
      y1: y + 11,
      tone: 'hi',
    },
  ];
}

/** The damper tray rises 7.4 mm with the sustain pedal, under every underlever. */
export const TRAY_LIFT = 7.4;

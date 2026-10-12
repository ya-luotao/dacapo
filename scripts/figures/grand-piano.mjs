// Draws the grand piano section of the "Inside the piano" lesson (src/core/grandPiano.ts) at rest
// with the anatomy kit (scripts/figures/anatomy/, MIT), settles its painter's order from the
// parts' true shapes, and writes public/learn/grand-piano.svg. The lesson's figure
// (src/ui/learn/GrandPiano.tsx) loads it and moves its keys, action, dampers, strings and pedals.
//
//   node scripts/figures/grand-piano.mjs           # writes the drawing
//   node scripts/figures/grand-piano.mjs --audit   # and proves its geometry (kit/audit.mjs)
//
// The output is deterministic: rebuilding must give it byte for byte.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from './anatomy/iso-kit.mjs';
import * as G from './anatomy/lathe.mjs';
import * as A from './anatomy/audit.mjs';
import * as M from '../../src/core/grandPiano.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../public/learn/grand-piano.svg');

const WIDTH = 760;
const HEIGHT = 440;
const { MM, world: W } = M;

// The bench and the case, in mm (see model.mjs for the axes).
const BASE = { u0: -175, u1: 1160, y0: -62, y1: 232, z0: -52, z1: -30 };
const KEYBED = { u0: -10, u1: 578, y0: -30, y1: 200, z0: -30, z1: 0 };
const SLIP = { u0: -22, u1: -10, y0: -30, y1: 200, z0: -30, z1: 20 };
const CHEEK = { u0: -10, u1: 160, y0: -30, y1: -3, z0: 0, z1: 58 };
const RIM = { u0: 578, u1: 1120, y0: -30, y1: -16, z0: -30, z1: 166 };
const BELLY = { u0: 552, u1: 578, y0: -16, y1: 186, z0: 0, z1: 158 };
const TAIL = { u0: 1100, u1: 1120, y0: -16, y1: 186, z0: -30, z1: 166 };
const BOARD = { u0: 570, u1: 1100, y0: -16, y1: 186, z0: M.SOUNDBOARD.z0, z1: M.SOUNDBOARD.z1 };
const PINBLOCK = { u0: 300, u1: 404, y0: -26, y1: 180, z0: 160, z1: 188 };
const PLATE = { u0: 296, u1: 410, y0: -26, y1: 192, z0: 188, z1: 196 };
const COLUMN = { u: 300, y: 186, r: 6, z0: 0, z1: 188 };
const SPAN = { y0: -14, y1: 180 };

const P = k.fitProjection(
  [
    W(BASE.u0, BASE.y0, BASE.z0 - 8),
    W(BASE.u1, BASE.y0, BASE.z0 - 8),
    W(BASE.u0, BASE.y1, BASE.z0 - 8),
    W(BASE.u1, BASE.y1, BASE.z0 - 8),
    W(RIM.u0, RIM.y0, RIM.z1),
    W(RIM.u1, RIM.y0, RIM.z1),
    W(300, 0, 230),
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 57 },
);
const V = G.viewOf(P);
const R = A.recorder(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const ALONG_Y = { o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };

const planOf = (b, r = 0.6) => ({
  x: -b.u1 * MM,
  y: b.y0 * MM,
  w: (b.u1 - b.u0) * MM,
  d: (b.y1 - b.y0) * MM,
  r,
});
const centreOf = (b) => W((b.u0 + b.u1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
/** A box in mm as a kit slab, recorded. */
function block(
  name,
  b,
  {
    r = 0.6,
    steps = 3,
    bevel = 0,
    tone = 'mid',
    crease,
    inner,
    extra = '',
    bias = 0,
    piece = 'case',
    ground = false,
  } = {},
) {
  const plan = planOf(b, r);
  const svg =
    S(k.slabOf(plan, b.z0 * MM, (b.z1 - b.z0) * MM, P, steps, bevel), { tone, crease, inner }) +
    extra;
  const shape = R.solid(A.slab(plan, b.z0 * MM, (b.z1 - b.z0) * MM, { name, ground }, steps));
  return R.put({ name, at: centreOf(b), bias, svg, shapes: [shape], piece });
}
const prismPaths = (poly, y0, y1) =>
  G.prismOf(
    ALONG_Y,
    poly.map(([u, z]) => [-u * MM, z * MM]),
    y0 * MM,
    y1 * MM,
    P,
  );
const prismShape = (name, poly, y0, y1, meta = {}) =>
  A.prism(
    ALONG_Y,
    poly.map(([u, z]) => [-u * MM, z * MM]),
    y0 * MM,
    y1 * MM,
    { name, ...meta },
  );
const ring = (u, y, r, z, steps = 20) => k.ring(-u * MM, y * MM, r * MM, z * MM, P, steps);
const dot = (u, y, z) => at(W(u, y, z));
const line = (a, b) => k.segment(W(...a), W(...b), P);

// ---------------------------------------------------------------------------------------------
// The bench.
const items = [];
const halo = `<path class="iso-halo" d="${k.haloOf(planOf(BASE, 3), BASE.z0 * MM - 3, (BASE.z1 - BASE.z0) * MM, P)}"/>`;
function bench() {
  const plan = planOf(BASE, 4);
  const feet = k
    .corners(plan, 10)
    .sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) {
    const name = R.nameFor('stand.foot');
    const svg =
      S(k.cylinder(x, y, 5, BASE.z0 * MM - 6, 1.4, P, 24), { tone: 'lo' }) +
      S(k.cylinder(x, y, 3.8, BASE.z0 * MM - 4.6, 4.6, P, 24), { tone: 'mid' });
    R.put({
      name,
      at: [x, y, BASE.z0 * MM - 3],
      svg,
      shapes: [R.solid(A.cylinder(x, y, 5, BASE.z0 * MM - 6, 6, { name, ground: true }))],
      piece: 'stand',
    });
  }
  const screws = k.corners(plan, 6);
  const extra = [
    L(k.planOutline(k.insetPlan(plan, 3.2), BASE.z1 * MM, P, 6), { tone: 'lo' }),
    L(screws.map(([x, y]) => k.ring(x, y, 1.6, BASE.z1 * MM, P, 14)).join(''), { tone: 'lo' }),
    D(
      screws.map(([x, y]) => at([x, y, BASE.z1 * MM])),
      { size: 0.45 },
    ),
  ].join('');
  block('stand.base', BASE, {
    r: 4,
    steps: 8,
    bevel: 1.2,
    tone: 'mid',
    extra,
    piece: 'stand',
    ground: true,
  });
  // A ruler strip in millimetres along the near edge, and the label plate at the front.
  const strip = { u0: -160, u1: 1140, y0: 212, y1: 222, z0: BASE.z1, z1: BASE.z1 + 1.2 };
  const sp = planOf(strip, 0.4);
  const ticks = k.topTicks(sp.x + 1, sp.x + sp.w - 1, 4, 5, sp.y, strip.z1 * MM, [1.4, 2.6], P);
  block('stand.ruler', strip, {
    r: 0.4,
    tone: 'lo',
    crease: 'none',
    extra: L(ticks.minor, { tone: 'lo' }) + L(ticks.major, { tone: 'mid' }),
    piece: 'stand',
  });
  const label = { u0: -165, u1: -125, y0: 150, y1: 200, z0: BASE.z1, z1: BASE.z1 + 1.4 };
  const lp = planOf(label, 0.8);
  const rules = [0, 1, 2]
    .map((n) =>
      k.lineOnTop(
        [lp.x + 3 + n * 3.4, lp.y + 3],
        [lp.x + 3 + n * 3.4, lp.y + lp.d - 3 - n * 4],
        label.z1 * MM,
        P,
      ),
    )
    .join('');
  block('stand.label', label, {
    r: 0.8,
    tone: 'lo',
    crease: 'none',
    extra:
      L(k.planOutline(k.insetPlan(lp, 1.2), label.z1 * MM, P, 3), { tone: 'faint' }) +
      L(rules, { tone: 'lo', free: true }),
    piece: 'stand',
  });
}

// ---------------------------------------------------------------------------------------------
// The case: keybed, key slip, cheek, rim, belly rail, tail, soundboard.
function cassa() {
  const bedTop = KEYBED.z1;
  const screwsBed = [40, 140, 260, 380, 500].map((u) => dot(u, 196, bedTop));
  block('case.keybed', KEYBED, {
    r: 1.2,
    steps: 4,
    bevel: 0.6,
    tone: 'mid',
    extra: D(screwsBed, { size: 0.4, tone: 'lo' }),
  });
  block('case.slip', SLIP, { r: 1, steps: 3, bevel: 0.5, tone: 'mid' });
  block('case.cheek', CHEEK, {
    r: 3,
    steps: 6,
    bevel: 0.8,
    tone: 'mid',
    extra: L(k.planOutline(k.insetPlan(planOf(CHEEK, 3), 1.6), CHEEK.z1 * MM, P, 6), {
      tone: 'faint',
    }),
  });
  const rimLayers = [-26, -22, -18.5]
    .map((y) => k.lineOnTop([-RIM.u0 * MM, y * MM], [-RIM.u1 * MM, y * MM], RIM.z1 * MM, P))
    .join('');
  block('case.rim', RIM, {
    r: 1,
    steps: 4,
    bevel: 0.8,
    tone: 'mid',
    extra: L(rimLayers, { tone: 'faint' }),
  });
  block(
    'case.liner',
    { u0: 578, u1: 1100, y0: -16, y1: -8, z0: 140, z1: M.SOUNDBOARD.z0 },
    { r: 0.4, tone: 'lo' },
  );
  block('case.belly', BELLY, {
    r: 0.8,
    steps: 3,
    bevel: 0.6,
    tone: 'mid',
    extra: D(
      [20, 80, 140].map((y) => dot(BELLY.u0, y, 120)),
      { size: 0.4, tone: 'lo' },
    ),
  });
  block('case.tail', TAIL, { r: 0.8, steps: 3, bevel: 0.6, tone: 'mid' });
  // The soundboard: spruce, 8 mm, its grain running the length of the section.
  const grain = [];
  for (let y = BOARD.y0 + 9; y < BOARD.y1 - 4; y += 11)
    grain.push(k.lineOnTop([-BOARD.u0 * MM, y * MM], [-BOARD.u1 * MM, y * MM], BOARD.z1 * MM, P));
  for (let u = 640; u < BOARD.u1 - 40; u += 110)
    block(
      R.nameFor('board.rib'),
      { u0: u, u1: u + 22, y0: -8, y1: BOARD.y1 - 6, z0: BOARD.z0 - 18, z1: BOARD.z0 },
      { r: 0.4, tone: 'mid', piece: 'board' },
    );
  block('board', BOARD, {
    r: 0.4,
    steps: 2,
    tone: 'hi',
    crease: 'lo',
    extra: L(grain.join(''), { tone: 'faint' }),
    piece: 'board',
  });
}

// ---------------------------------------------------------------------------------------------
// The key frame and the action rails, across the whole octave.
function rails() {
  const frontRail = { u0: 12, u1: 36, y0: CHEEK.y1, y1: SPAN.y1, z0: 0, z1: KEY_REST_BOTTOM() };
  const balance = { u0: 218, u1: 242, y0: SPAN.y0, y1: SPAN.y1, z0: 0, z1: M.KEY.bottom };
  const back = { u0: 470, u1: 512, y0: SPAN.y0, y1: SPAN.y1, z0: 0, z1: M.KEY.bottom - 1.6 };
  shifts(
    block('frame.front', frontRail, {
      tone: 'mid',
      extra: L(
        [...Array(M.NOTES).keys()].map((i) => ring(24, M.noteY(i), 3.4, frontRail.z1, 14)).join(''),
        { tone: 'faint' },
      ),
    }),
  );
  shifts(block('frame.balance', balance, { tone: 'mid' }));
  shifts(block('frame.back', back, { tone: 'mid' }));
  shifts(
    block(
      'frame.back-felt',
      { ...back, z0: back.z1, z1: M.KEY.bottom },
      { tone: 'lo', crease: 'none' },
    ),
  );
  const screws = (u, z) =>
    D(
      [SPAN.y0 + 5, SPAN.y1 - 5].map((y) => dot(u, y, z)),
      { size: 0.4, tone: 'lo' },
    );
  shifts(
    block(
      'action.wippen-rail',
      { u0: 258, u1: 282, y0: SPAN.y0, y1: SPAN.y1, z0: 40, z1: 48 },
      { tone: 'mid', extra: screws(270, 48), piece: 'action' },
    ),
  );
  shifts(
    block(
      'action.hammer-rail',
      { u0: 296, u1: 336, y0: SPAN.y0, y1: SPAN.y1, z0: 92, z1: 100 },
      { tone: 'mid', extra: screws(316, 100), piece: 'action' },
    ),
  );
  // A standard at the bass end holds the rails; the treble end is left open to show the action.
  shifts(
    block(
      'action.standard',
      { u0: 250, u1: 344, y0: SPAN.y0 - 4, y1: SPAN.y0, z0: 0, z1: 100 },
      { tone: 'mid', piece: 'action' },
    ),
  );
  // The damper tray: the sustain pedal lifts it, and it lifts every underlever.
  const tray = block(
    'pedal.tray',
    { u0: 524, u1: 536, y0: SPAN.y0, y1: SPAN.y1, z0: 28, z1: 33 },
    { tone: 'lo', piece: 'tray' },
  );
  tray.svg = `<g data-tray>${tray.svg}</g>`;
  for (const y of [24, 140]) {
    const name = R.nameFor('pedal.rod');
    const svg = S(k.cylinder(-530 * MM, y * MM, 1.4, 0, 28 * MM, P, 16), {
      tone: 'lo',
      crease: 'none',
    });
    R.put({
      name,
      at: W(530, y, 14),
      svg: `<g data-tray>${svg}</g>`,
      shapes: [R.solid(A.cylinder(-530 * MM, y * MM, 1.4, 0, 28 * MM, { name }))],
      piece: 'tray',
    });
  }
}
const shifts = (item) => ((item.svg = `<g data-shift>${item.svg}</g>`), item);
const KEY_REST_BOTTOM = () => M.KEY.bottom - M.KEY.dip * (1 - 24 / M.BALANCE[0]) - 0.2;

// ---------------------------------------------------------------------------------------------
// Every note's key, action and damper: the parts that move, drawn from model.mjs.
const PARTS = [];
function action() {
  for (let i = 0; i < M.NOTES; i++) {
    for (const part of M.partsOf(i)) {
      const index = PARTS.length;
      PARTS.push(part);
      const name = `${part.chain}.${part.id}.${i}`;
      const shifting = M.shiftsWithKeys(part);
      const wrap = (svg) =>
        shifting
          ? `<g data-shift><g data-p="${index}"${part.chain === 'key' ? '' : ' data-act'}>${svg}</g></g>`
          : `<g data-p="${index}" data-act>${svg}</g>`;
      const piece = part.chain === 'fixed' ? 'action' : part.chain;
      if (part.kind === 'prism') {
        const svg = drawPrism(part, part.poly);
        const centre = part.poly.reduce(
          (s, [u, z]) => [s[0] + u / part.poly.length, s[1] + z / part.poly.length],
          [0, 0],
        );
        R.put({
          name,
          at: W(centre[0], (part.y0 + part.y1) / 2, centre[1]),
          svg: wrap(svg),
          shapes: [R.solid(prismShape(name, part.poly, part.y0, part.y1, { owner: `note${i}` }))],
          piece,
        });
      } else if (part.kind === 'post') {
        const [u, y] = part.at;
        const svg = S(
          k.cylinder(-u * MM, y * MM, part.r * MM, part.z0 * MM, (part.z1 - part.z0) * MM, P, 16),
          { tone: part.tone },
        );
        R.put({
          name,
          at: W(u, y, (part.z0 + part.z1) / 2),
          svg: wrap(svg),
          shapes: [
            R.solid(
              A.cylinder(-u * MM, y * MM, part.r * MM, part.z0 * MM, (part.z1 - part.z0) * MM, {
                name,
                owner: `note${i}`,
              }),
            ),
          ],
          piece,
        });
      } else {
        const [u, z] = part.at;
        const F = G.frameAlong(W(u, part.y0, z), [0, 1, 0]);
        const svg = S(G.disc(0, (part.y1 - part.y0) * MM, part.r * MM, F, P), { tone: part.tone });
        R.put({
          name,
          at: W(u, (part.y0 + part.y1) / 2, z),
          svg: wrap(svg),
          shapes: [
            R.solid(
              A.disc(F, 0, (part.y1 - part.y0) * MM, part.r * MM, { name, owner: `note${i}` }),
            ),
          ],
          piece,
        });
      }
    }
  }
}
function drawPrism(part, poly) {
  const svg = S(prismPaths(poly, part.y0, part.y1), {
    tone: part.tone,
    crease: part.tone === 'hi' ? 'lo' : 'faint',
  });
  return part.ebony
    ? `<g class="pn-ebony">${svg}</g>`
    : part.ivory
      ? `<g class="pn-ivory">${svg}</g>`
      : svg;
}

// ---------------------------------------------------------------------------------------------
// The pinblock, the iron plate, its pins, agraffes, struts, hitch rail and the bridge.
function frame() {
  const laminations = [166, 172, 178, 184]
    .map((z) => line([PINBLOCK.u0, PINBLOCK.y1, z], [PINBLOCK.u1, PINBLOCK.y1, z]))
    .join('');
  block('frame.pinblock', PINBLOCK, {
    r: 0.4,
    steps: 2,
    tone: 'mid',
    extra: L(laminations, { tone: 'faint' }),
  });
  const bolts = [
    [304, -8],
    [304, 186],
    [402, -8],
    [402, 186],
    [350, -8],
  ].map(([u, y]) => dot(u, y, PLATE.z1));
  block('plate.front', PLATE, {
    r: 1.2,
    steps: 4,
    bevel: 0.6,
    tone: 'mid',
    extra: D(bolts, { size: 0.55, tone: 'mid' }),
  });
  for (const col of [{ ...COLUMN, y: -24, r: 5.5, z1: PINBLOCK.z0 }]) {
    const name = R.nameFor('plate.column');
    R.put({
      name,
      at: W(col.u, col.y, 90),
      svg:
        S(
          k.cylinder(
            -col.u * MM,
            col.y * MM,
            col.r * MM,
            col.z0 * MM,
            (col.z1 - col.z0) * MM,
            P,
            22,
          ),
          { tone: 'mid' },
        ) + L(k.sideArc(-col.u * MM, col.y * MM, col.r * MM, 20 * MM, P, 16), { tone: 'faint' }),
      shapes: [
        R.solid(
          A.cylinder(-col.u * MM, col.y * MM, col.r * MM, col.z0 * MM, (col.z1 - col.z0) * MM, {
            name,
          }),
        ),
      ],
      piece: 'plate',
    });
  }

  // Struts along both sides to the hitch rail, and posts that hold the frame to the case.
  const hitchFront = (y) => M.bridgeU(y) + M.HITCH.at - 20;
  const hitchBack = (y) => M.bridgeU(y) + M.HITCH.at + 20;
  const struts = [
    [-16, -6],
    [170, 180],
  ];
  for (const [y0, y1] of struts) {
    const name = R.nameFor('plate.strut');
    const ring = [
      [-PLATE.u1 * MM, y0 * MM],
      [-PLATE.u1 * MM, y1 * MM],
      [-hitchFront(y1) * MM, y1 * MM],
      [-hitchFront(y0) * MM, y0 * MM],
    ];
    const h = (PLATE.z1 - M.HITCH.z0) * MM;
    R.put({
      name,
      at: W((PLATE.u1 + hitchFront(y0)) / 2, (y0 + y1) / 2, M.HITCH.z0),
      svg: S(k.extrude(ring, M.HITCH.z0 * MM, h, P, { bevel: 0.4 }), { tone: 'mid' }),
      shapes: [R.solid(A.extruded(ring, M.HITCH.z0 * MM, h, { name }))],
      piece: 'plate',
    });
  }
  // The hitch rail follows the bridge, 40 mm wide.
  const ys = [];
  for (let y = -16; y <= 180.01; y += 6.5) ys.push(y);
  const ringPts = [
    ...ys.map((y) => [-hitchFront(y) * MM, y * MM]),
    ...ys
      .slice()
      .reverse()
      .map((y) => [-hitchBack(y) * MM, y * MM]),
  ];
  const hitchSvg = S(
    k.extrude(ringPts, M.HITCH.z0 * MM, (M.HITCH.z1 - M.HITCH.z0) * MM, P, {
      convex: false,
      bevel: 0.4,
    }),
    { tone: 'mid' },
  );
  R.put({
    name: 'plate.hitch',
    at: W(hitchFront(90) + 20, 90, M.HITCH.z0),
    svg: hitchSvg,
    shapes: [
      R.solid(
        A.extruded(ringPts, M.HITCH.z0 * MM, (M.HITCH.z1 - M.HITCH.z0) * MM, {
          name: 'plate.hitch',
        }),
      ),
    ],
    piece: 'plate',
  });
  for (const [u, y, z0, z1] of [
    [561, -9, BELLY.z1, M.HITCH.z0],
    [561, 175, BELLY.z1, M.HITCH.z0],
    [1110, -9, TAIL.z1, M.HITCH.z0],
  ]) {
    const name = R.nameFor('plate.post');
    const svg = S(k.cylinder(-u * MM, y * MM, 7 * MM, z0 * MM, (z1 - z0) * MM, P, 20), {
      tone: 'mid',
    });
    R.put({
      name,
      at: W(u, y, (z0 + z1) / 2),
      svg,
      shapes: [R.solid(A.cylinder(-u * MM, y * MM, 7 * MM, z0 * MM, (z1 - z0) * MM, { name }))],
      piece: 'plate',
    });
  }
  // The bridge, glued to the soundboard: the strings press on it, and it moves the board.
  const bys = [];
  for (let y = -1; y <= 166.01; y += 5.5) bys.push(y);
  const bridgeRing = [
    ...bys.map((y) => [-(M.bridgeU(y) - M.BRIDGE.half) * MM, y * MM]),
    ...bys
      .slice()
      .reverse()
      .map((y) => [-(M.bridgeU(y) + M.BRIDGE.half) * MM, y * MM]),
  ];
  const pins = [];
  for (let i = 0; i < M.NOTES; i++)
    for (let s = 0; s < M.UNISON; s++) {
      const y = M.stringY(i, s);
      const u = M.bridgeU(y);
      pins.push(dot(u - 7, y - 1.1, M.BRIDGE.top), dot(u + 7, y + 1.1, M.BRIDGE.top));
    }
  const capLine = L(
    k.onTop(
      bys.map((y) => [-(M.bridgeU(y) - M.BRIDGE.half + 3) * MM, y * MM]),
      M.BRIDGE.top * MM,
      P,
    ),
    { tone: 'faint' },
  );
  const bridgeSvg =
    S(
      k.extrude(bridgeRing, BOARD.z1 * MM, (M.BRIDGE.top - BOARD.z1) * MM, P, {
        convex: false,
        bevel: 0.4,
      }),
      { tone: 'mid' },
    ) +
    capLine +
    D(pins, { size: 0.4, tone: 'mid' });
  R.put({
    name: 'board.bridge',
    at: W(M.bridgeU(80), 80, 180),
    svg: bridgeSvg,
    shapes: [
      R.solid(
        A.extruded(bridgeRing, BOARD.z1 * MM, (M.BRIDGE.top - BOARD.z1) * MM, {
          name: 'board.bridge',
        }),
      ),
    ],
    piece: 'board',
  });

  // Agraffes, tuning pins and hitch pins, one per string or note.
  for (let i = 0; i < M.NOTES; i++) {
    const y = M.noteY(i);
    block(
      `plate.agraffe.${i}`,
      { u0: 385, u1: 395, y0: y - 5, y1: y + 5, z0: PLATE.z1, z1: 206 },
      { r: 1, steps: 3, tone: 'mid', piece: 'plate' },
    );
    for (let s = 0; s < M.UNISON; s++) {
      const ys = M.stringY(i, s);
      const u = M.PIN_ROWS[s];
      const name = `plate.pin.${i}.${s}`;
      const coil = [208.5, 210.5, 212.5]
        .map((z) => k.sideArc(-u * MM, ys * MM, 3.4 * MM, z * MM, P, 12))
        .join('');
      const svg = S(
        k.cylinder(-u * MM, ys * MM, 3.4 * MM, PLATE.z1 * MM, (226 - PLATE.z1) * MM, P, 16),
        { tone: 'mid', inner: L(coil, { tone: 'lo' }) },
      );
      R.put({
        name,
        at: W(u, ys, 211),
        svg,
        shapes: [
          R.solid(
            A.cylinder(-u * MM, ys * MM, 3.4 * MM, PLATE.z1 * MM, (226 - PLATE.z1) * MM, { name }),
          ),
        ],
        piece: 'plate',
      });
      const hu = M.bridgeU(ys) + M.HITCH.at;
      const hname = `plate.hitch-pin.${i}.${s}`;
      R.put({
        name: hname,
        at: W(hu, ys, 196),
        svg: S(
          k.cylinder(
            -hu * MM,
            ys * MM,
            2 * MM,
            M.HITCH.z1 * MM,
            (M.HITCH.pin - M.HITCH.z1) * MM,
            P,
            12,
          ),
          { tone: 'mid' },
        ),
        shapes: [
          R.solid(
            A.cylinder(
              -hu * MM,
              ys * MM,
              2 * MM,
              M.HITCH.z1 * MM,
              (M.HITCH.pin - M.HITCH.z1) * MM,
              { name: hname },
            ),
          ),
        ],
        piece: 'plate',
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The strings: from the tuning pin through the agraffe, over the bridge to the hitch pin. Each is
// cut into short runs so it can pass in front of one part and behind the next.
const STRINGS = [];
function strings() {
  for (let i = 0; i < M.NOTES; i++) {
    for (let s = 0; s < M.UNISON; s++) {
      for (const run of M.stringRuns(i, s)) {
        const index = STRINGS.length;
        STRINGS.push(run);
        const points = run.run.map(([u, z]) => W(u, run.y, z));
        const name = `string.${i}.${s}.${index}`;
        R.put({
          name,
          at: G.lerp3(points[0], points[1], 0.5),
          svg: `<path class="iso-line pn-string" data-s="${index}" data-tone="mid" d="${k.pathOf(points.map(at))}"/>`,
          shapes: [R.solid(A.tube(points, 1.2 * MM, { name, limp: true }))],
          piece: 'strings',
        });
      }
    }
  }
}

// The lyre and its three pedals.
const PEDALS = [];
function lyre() {
  const b = M.LYRE;
  const face = (u0, z0, u1, z1, y) =>
    k.pathOf(
      [
        [u0, z0],
        [u1, z0],
        [u1, z1],
        [u0, z1],
      ].map(([u, z]) => at(W(u, y, z))),
      true,
    );
  const slots = M.PEDAL.ys
    .map((y) =>
      k.pathOf(
        [
          [y - 6, -23],
          [y + 6, -23],
          [y + 6, -9],
          [y - 6, -9],
        ].map(([yy, z]) => at(W(b.u0, yy, z))),
        true,
      ),
    )
    .join('');
  const screws = [
    [b.u0 + 8, b.y0 + 6],
    [b.u0 + 8, b.y1 - 6],
    [b.u1 - 8, b.y0 + 6],
    [b.u1 - 8, b.y1 - 6],
  ].map(([u, y]) => dot(u, y, b.z1));
  block('pedal.lyre', b, {
    r: 2,
    steps: 4,
    bevel: 0.8,
    tone: 'mid',
    extra:
      L(slots, { tone: 'lo' }) +
      D(screws, { size: 0.45 }) +
      L(k.planOutline(k.insetPlan(planOf(b, 2), 1.6), b.z1 * MM, P, 4), { tone: 'faint' }),
    piece: 'lyre',
  });
  for (let p = 0; p < 3; p++) {
    for (const part of M.pedalParts(p)) {
      const index = PEDALS.length;
      PEDALS.push(part);
      const name = `pedal.${part.id}.${p}`;
      const svg = S(prismPaths(part.poly, part.y0, part.y1), {
        tone: part.tone,
        crease: part.tone === 'hi' ? 'lo' : 'faint',
      });
      const c = part.poly.reduce(
        (s, [u, z]) => [s[0] + u / part.poly.length, s[1] + z / part.poly.length],
        [0, 0],
      );
      R.put({
        name,
        at: W(c[0], (part.y0 + part.y1) / 2, c[1]),
        svg: `<g data-pedal="${index}">${svg}</g>`,
        shapes: [R.solid(prismShape(name, part.poly, part.y0, part.y1, { owner: `pedal${p}` }))],
        piece: 'lyre',
      });
    }
  }
}

bench();
lyre();
cassa();
rails();
action();
frame();
strings();

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
A.auditOrExit(R, P);

// ---------------------------------------------------------------------------------------------
// The drawing, with its own styles: the kit's tones for the light and the dark theme, keyed on the
// app's `data-theme` when it is inline and on the reader's setting when it is an image.
const KIT_CSS = readFileSync(join(HERE, 'anatomy/iso.css'), 'utf8').split('\n');
const rules = KIT_CSS.slice(
  KIT_CSS.findIndex((line) => line.startsWith('.iso-svg{')),
  KIT_CSS.findIndex((line) => line.startsWith('.iso-figure{')),
).join('\n');
const LIGHT =
  '--anatomy-paper:var(--surface,#fbfbfa);--anatomy-face:#fff;--anatomy-top:#fff;--anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1;--anatomy-lit-top:#fff;--anatomy-lit-shade:#eeeeeb;--anatomy-hi:#26262a;--anatomy-mid:#8a8a8f;--anatomy-lo:#b4b4b8;--anatomy-faint:#d4d4d6;--anatomy-lit:#000;--anatomy-halo:#8a8a80;--anatomy-halo-opacity:.32;--anatomy-dot:#3a3a3e;--anatomy-weight:.6px;--gp-dim-hi:#8a8a8f;--gp-dim-mid:#a9a9ad;--gp-dim-lo:#cacacd;--gp-dim-faint:#e2e2e3';
const DARK =
  '--anatomy-paper:var(--surface,#131313);--anatomy-face:#1b1b1b;--anatomy-top:#1c1c1c;--anatomy-shade-0:#0f0f0f;--anatomy-shade-1:#121212;--anatomy-shade-2:#151515;--anatomy-shade-3:#181818;--anatomy-lit-top:#262626;--anatomy-lit-shade:#1d1d1d;--anatomy-hi:#d4d4d4;--anatomy-mid:#6a6a6a;--anatomy-lo:#3e3e3e;--anatomy-faint:#2a2a2a;--anatomy-lit:#fff;--anatomy-halo:#050505;--anatomy-halo-opacity:.9;--anatomy-dot:#e6e6e6;--gp-dim-hi:#5a5a5a;--gp-dim-mid:#3a3a3a;--gp-dim-lo:#2c2c2c;--gp-dim-faint:#222';
const EBONY_LIGHT =
  '--anatomy-paper:#2b2b2e;--anatomy-face:#2b2b2e;--anatomy-top:#3d3d41;--anatomy-shade-0:#161618;--anatomy-shade-1:#1d1d20;--anatomy-shade-2:#242427;--anatomy-shade-3:#2c2c30;--anatomy-hi:#0c0c0e;--anatomy-lo:#0c0c0e;--anatomy-faint:#4a4a4e';
const EBONY_DARK =
  '--anatomy-paper:#050505;--anatomy-face:#050505;--anatomy-top:#0d0d0d;--anatomy-shade-0:#020202;--anatomy-shade-1:#040404;--anatomy-shade-2:#060606;--anatomy-shade-3:#090909;--anatomy-hi:#8a8a8a;--anatomy-lo:#0c0c0e;--anatomy-faint:#2a2a2a';
const IVORY_DARK =
  '--anatomy-paper:#cfcfca;--anatomy-face:#d8d8d3;--anatomy-top:#e2e2dd;--anatomy-shade-0:#a9a9a4;--anatomy-shade-1:#b4b4af;--anatomy-shade-2:#bfbfba;--anatomy-shade-3:#c8c8c3;--anatomy-lit-top:#f0f0eb;--anatomy-lit-shade:#c6c6c1;--anatomy-hi:#3a3a3a;--anatomy-lo:#7a7a76;--anatomy-faint:#9a9a96;--anatomy-lit:#000';
const darkRules = (scope) =>
  `${scope}{${DARK}}${scope} .pn-ebony{${EBONY_DARK}}${scope} .pn-ivory{${IVORY_DARK}}`;
const STYLE = [
  `.gp-svg{${LIGHT}}`,
  `.gp-svg .pn-ebony{${EBONY_LIGHT}}`,
  darkRules(":root[data-theme='dark'] .gp-svg"),
  `@media (prefers-color-scheme:dark){${darkRules(":root:not([data-theme='light']) .gp-svg")}${darkRules('svg.gp-svg:root')}}`,
  rules,
  // The note in play keeps its tones; every other note's action steps down one.
  '.gp-svg[data-focus] [data-act]:not([data-on]){--anatomy-hi:var(--gp-dim-hi);--anatomy-mid:var(--gp-dim-mid);--anatomy-lo:var(--gp-dim-lo);--anatomy-faint:var(--gp-dim-faint)}',
  ".gp-svg[data-focus] .pn-string[data-tone='mid']{stroke:var(--anatomy-lo)}",
  ".pn-string{stroke-width:.45}.pn-string[data-tone='lit']{stroke-width:.9}",
  '[data-p],[data-pedal]{cursor:pointer}',
].join('\n');

const svg = k
  .figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: 'A teaching section of a grand piano, one octave from C4 to B4.',
    className: 'gp-svg',
    body: [`<style>${STYLE}</style>`, halo, ...R.items.map((item) => item.svg)],
  })
  .replace('<svg ', `<svg data-projection='${JSON.stringify(P)}' `);
writeFileSync(OUT, svg + '\n');
console.log(
  `wrote public/learn/grand-piano.svg · ${R.items.length} items · ${PARTS.length} moving parts · ${STRINGS.length} string runs · ${PEDALS.length} pedal parts`,
);

// The few drawing functions the grand piano figure needs while it moves, ported from the anatomy
// kit (MIT, scripts/figures/anatomy/): the camera, a prism along any axis with its four-tone
// shading, and a solid's SVG. They must give the same markup as the kit, which drew the figure at
// rest; draw.test.ts holds them to it.

export interface Projection {
  origin: readonly [number, number];
  scale: number;
  azimuth: number;
  elevation: number;
}
type Vec = readonly [number, number, number];
type Flat = [number, number];
export interface Frame {
  o: Vec;
  a: Vec;
  u: Vec;
  v: Vec;
}
export interface SolidPaths {
  fill: string;
  outline: string;
  crease: string;
  top: string;
  shades: string[];
}

const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

function cameraOf({ scale, azimuth, elevation }: Projection) {
  const a = azimuth * RADIANS;
  const e = elevation * RADIANS;
  return {
    sinA: Math.sin(a),
    cosA: Math.cos(a),
    sinE: Math.sin(e),
    cosE: Math.cos(e),
    k: scale * UNIT,
  };
}

export function iso([x, y, z]: Vec, P: Projection): Flat {
  const { sinA, cosA, sinE, cosE, k } = cameraOf(P);
  return [
    P.origin[0] + (x * sinA - y * cosA) * k,
    P.origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k,
  ];
}

const tenth = (value: number): string => {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return text === '-0' ? '0' : text;
};

export function pathOf(points: readonly Flat[], closed = false): string {
  if (!points.length) return '';
  return (
    points.map(([x, y], at) => `${at ? 'L' : 'M'}${tenth(x)} ${tenth(y)}`).join('') +
    (closed ? 'Z' : '')
  );
}

const fine = (value: number) => Math.round(value * 100) / 100;
/** A translate that moves drawn art by a world offset. */
export function translateAlong(P: Projection, by: Vec): string {
  const origin = iso([0, 0, 0], P);
  const moved = iso(by, P);
  return `translate(${fine(moved[0] - origin[0])} ${fine(moved[1] - origin[1])})`;
}

const dot3 = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add3 = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const unit3 = (a: Vec): Vec => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

function viewOf(P: Projection): Vec {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  return [cosA * cosE, sinA * cosE, sinE];
}
function lightOf(P: Projection): Vec {
  const { sinA, cosA } = cameraOf(P);
  return unit3([-sinA, cosA, LIGHT_UP]);
}
function bandOf(score: number): number {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]!) tone++;
  return tone;
}

function hullOf(points: readonly Flat[]): Flat[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Flat, a: Flat, b: Flat) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Flat[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 1e-9
    )
      lower.pop();
    lower.push(point);
  }
  const upper: Flat[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 1e-9
    )
      upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const signedArea = (points: readonly (readonly [number, number])[]) =>
  points.reduce((sum, [x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length]!;
    return sum + x * ny - nx * y;
  }, 0);

/** A prism of a convex polygon in the frame's (u, v) plane, from s0 to s1 along its axis. */
export function prismOf(
  F: Frame,
  polygon: readonly (readonly [number, number])[],
  s0: number,
  s1: number,
  P: Projection,
): SolidPaths {
  const V = viewOf(P);
  const L = lightOf(P);
  const ring = signedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon];
  const n = ring.length;
  const at = (s: number, [x, y]: readonly [number, number]): Vec => [
    F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y,
    F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y,
    F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y,
  ];
  const low = ring.map((point) => iso(at(s0, point), P));
  const high = ring.map((point) => iso(at(s1, point), P));
  const buckets: string[][] = [[], [], [], [], []];
  const seen: boolean[] = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j]!;
    const [x1, y1] = ring[(j + 1) % n]!;
    const normal = unit3(add3(mul3(F.u, y1 - y0), mul3(F.v, -(x1 - x0))));
    const visible = dot3(normal, V) > 1e-6;
    seen.push(visible);
    if (visible)
      buckets[bandOf(dot3(normal, L))]!.push(
        pathOf([low[j]!, low[(j + 1) % n]!, high[(j + 1) % n]!, high[j]!], true),
      );
  }
  const ends: [Flat[], Vec][] = [
    [low, mul3(F.a, -1)],
    [high, F.a],
  ];
  const capSeen = ends.map(([, normal]) => dot3(normal, V) > 1e-6);
  ends.forEach(([points, normal], index) => {
    if (capSeen[index]) buckets[bandOf(dot3(normal, L))]!.push(pathOf(points, true));
  });
  const hull = hullOf([...low, ...high]);
  const creases: string[] = [];
  for (let j = 0; j < n; j++) {
    const prev = (j - 1 + n) % n;
    const a = [ring[j]![0] - ring[prev]![0], ring[j]![1] - ring[prev]![1]] as const;
    const b = [ring[(j + 1) % n]![0] - ring[j]![0], ring[(j + 1) % n]![1] - ring[j]![1]] as const;
    const sharp =
      (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1) <
      Math.cos(0.35);
    if (sharp && seen[j] && seen[prev]) creases.push(pathOf([low[j]!, high[j]!]));
    ends.forEach(([points], index) => {
      if (capSeen[index] && seen[j]) creases.push(pathOf([points[j]!, points[(j + 1) % n]!]));
    });
  }
  return {
    fill: pathOf(hull, true),
    outline: pathOf(hull, true),
    crease: creases.join(''),
    top: buckets[4]!.join(''),
    shades: buckets.slice(0, 4).map((list) => list.join('')),
  };
}

/** A solid as the kit paints it: fill, four shades, top, crease, outline. */
export function solidSvg(
  paths: SolidPaths,
  {
    tone = 'hi',
    crease = 'faint',
    lit = false,
  }: { tone?: string; crease?: string; lit?: boolean } = {},
): string {
  const parts = [`<path class="iso-fill" d="${paths.fill}"/>`];
  paths.shades.forEach((d, shade) => {
    if (d) parts.push(`<path class="iso-shade" data-shade="${shade}" d="${d}"/>`);
  });
  parts.push(`<path class="iso-top" d="${paths.top}"/>`);
  if (crease !== 'none' && paths.crease)
    parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/>`);
  parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`);
  return `<g class="iso-solid"${lit ? ' data-lit=""' : ''}>${parts.join('')}</g>`;
}

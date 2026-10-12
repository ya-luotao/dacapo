// The grand piano section, played. Every note runs the action model (core/pianoAction.ts); its
// state turns the key, the wippen, the jack and the hammer, lifts the damper and sets the strings
// swinging. The drawing at rest comes from scripts/figures/grand-piano.mjs; this moves it.

import * as M from '../../../core/grandPiano.ts';
import { REST, stepAction, type ActionPhase, type ActionState } from '../../../core/pianoAction.ts';
import {
  iso,
  pathOf,
  prismOf,
  solidSvg,
  translateAlong,
  type Frame,
  type Projection,
} from './draw.ts';

const STEP = 0.0005;
/** How long a press stays down in the drawing at least, so a slowed-down tap still plays out. */
const MIN_HOLD = 0.2;
/** How long a pedal lever takes to go down or come up, in the drawing's seconds. */
const PEDAL_SECONDS = 0.06;
/** After this long with nothing pressed, the figure plays its tour again (real seconds). */
const IDLE = 9;
const ALONG: Frame = { o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };

export type FigurePhase = ActionPhase | 'ringing' | 'damped';

/** What the figure tells its readout: the note last played and where it is. */
export interface Reading {
  note: number;
  phase: FigurePhase;
  pedals: Record<M.PedalName, boolean>;
  touring: boolean;
}

interface Note {
  state: ActionState;
  press: { down: boolean; velocity: number; until: number };
  shown: M.Pose | null;
  swing: number;
  lit: boolean;
  /** How many of its strings the hammer struck last: two with the soft pedal down. */
  struck: number;
}

/** The idle tour: A4 alone, then C, E and G held on the pedal, then A4 with the soft pedal. */
const TOUR: readonly [number, (live: GrandPianoLive) => void][] = [
  [0.3, (live) => live.drive(9, true, 0.55)],
  [3.2, (live) => live.drive(9, false)],
  [5.6, (live) => live.drivePedal('sustain', true)],
  [5.9, (live) => live.drive(0, true, 0.5)],
  [7.4, (live) => live.drive(0, false)],
  [8.0, (live) => live.drive(4, true, 0.5)],
  [9.5, (live) => live.drive(4, false)],
  [10.1, (live) => live.drive(7, true, 0.6)],
  [11.6, (live) => live.drive(7, false)],
  [15.5, (live) => live.drivePedal('sustain', false)],
  [17.5, (live) => live.drivePedal('soft', true)],
  [18.3, (live) => live.drive(9, true, 0.55)],
  [21.0, (live) => live.drive(9, false)],
  [22.0, (live) => live.drivePedal('soft', false)],
];
const TOUR_LENGTH = 24.5;

export class GrandPianoLive {
  private readonly P: Projection;
  private readonly parts: M.Part[] = [];
  private readonly partEls: (Element | null)[];
  private readonly byNote: number[][] = Array.from({ length: M.NOTES }, () => []);
  private readonly strings: M.StringRun[] = [];
  private readonly stringEls: (Element | null)[];
  private readonly stringsByNote: number[][] = Array.from({ length: M.NOTES }, () => []);
  private readonly pedalParts: M.PedalPart[] = [];
  private readonly pedalEls: (Element | null)[];
  private readonly shiftEls: Element[];
  private readonly trayEls: Element[];
  private readonly notes: Note[];
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly observer: IntersectionObserver;

  private speed = 10;
  private clock = 0;
  private lastNote = 9;
  private lit = -1;
  private held: Record<M.PedalName, boolean> = { soft: false, sostenuto: false, sustain: false };
  private readonly pedalAt = [0, 0, 0];
  private shift = 0;
  private tray = 0;
  private readonly latched = Array.from({ length: M.NOTES }, () => false);

  private touring: boolean;
  private tourClock = 0;
  private tourNext = 0;
  private idleTimer = 0;
  private frame = 0;
  private last = 0;
  private visible = false;
  private said = '';

  private readonly svg: SVGSVGElement;
  private readonly onReading: (reading: Reading) => void;

  constructor(svg: SVGSVGElement, onReading: (reading: Reading) => void) {
    this.svg = svg;
    this.onReading = onReading;
    this.P = JSON.parse(svg.dataset.projection ?? '{}') as Projection;
    for (let i = 0; i < M.NOTES; i++) this.parts.push(...M.partsOf(i));
    this.parts.forEach((part, index) => this.byNote[part.note]!.push(index));
    this.partEls = this.parts.map((_, index) => svg.querySelector(`[data-p="${index}"]`));
    for (let i = 0; i < M.NOTES; i++)
      for (let s = 0; s < M.UNISON; s++) this.strings.push(...M.stringRuns(i, s));
    this.strings.forEach((run, index) => this.stringsByNote[run.note]!.push(index));
    this.stringEls = this.strings.map((_, index) => svg.querySelector(`[data-s="${index}"]`));
    for (let p = 0; p < M.PEDAL_NAMES.length; p++) this.pedalParts.push(...M.pedalParts(p));
    this.pedalEls = this.pedalParts.map((_, index) => svg.querySelector(`[data-pedal="${index}"]`));
    this.shiftEls = [...svg.querySelectorAll('[data-shift]')];
    this.trayEls = [...svg.querySelectorAll('[data-tray]')];
    this.notes = Array.from({ length: M.NOTES }, () => ({
      state: { ...REST },
      press: { down: false, velocity: 0, until: 0 },
      shown: null,
      swing: 0,
      lit: false,
      struck: M.UNISON,
    }));
    this.touring = !this.still.matches;
    this.observer = new IntersectionObserver(
      (entries) => {
        this.visible = entries[entries.length - 1]?.isIntersecting ?? false;
        if (this.visible) this.run();
      },
      { rootMargin: '120px 0px' },
    );
    this.observer.observe(svg);
    this.report();
  }

  destroy() {
    clearTimeout(this.idleTimer);
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** The note a part, a key or a string at this element belongs to, or -1. */
  noteAt(target: Element): number {
    const el = target.closest('[data-p]');
    return el ? (this.parts[Number((el as HTMLElement).dataset.p)]?.note ?? -1) : -1;
  }

  /** The pedal at this element, or null. */
  pedalOf(target: Element): M.PedalName | null {
    const el = target.closest('[data-pedal]');
    if (!el) return null;
    const part = this.pedalParts[Number((el as HTMLElement).dataset.pedal)];
    return part ? M.PEDAL_NAMES[part.pedal]! : null;
  }

  /** The key whose front is nearest a point on the screen, within reach of a fingertip. */
  nearestKey(clientX: number, clientY: number): number {
    const m = this.svg.getScreenCTM();
    if (!m) return -1;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    let best = -1;
    let far = 22;
    for (let i = 0; i < M.NOTES; i++) {
      const [x, y] = this.at(M.BLACK[i] ? 100 : 25, M.noteY(i), M.BLACK[i] ? 47 : 37);
      const d = Math.hypot(p.x - x, p.y - y) - (M.BLACK[i] ? 3 : 0);
      if (d < far) {
        far = d;
        best = i;
      }
    }
    return best;
  }

  /** The player's speed: real time, or 4 or 10 times slower. The tour always runs 10 times slower. */
  setSpeed(speed: number, fromPlayer = true) {
    this.speed = speed;
    if (fromPlayer) this.takeOver();
  }

  /** A key of the section, from the player. */
  press(i: number, down: boolean, velocity = 0.6) {
    this.takeOver();
    this.drive(i, down, velocity);
  }

  /** A pedal, from the player. */
  setPedal(name: M.PedalName, on: boolean) {
    this.takeOver();
    this.drivePedal(name, on);
  }

  drive(i: number, down: boolean, velocity = 0.6) {
    const note = this.notes[i];
    if (!note) return;
    if (down) {
      note.press = { down: true, velocity, until: this.clock + MIN_HOLD };
      this.lastNote = i;
      this.light(i);
    } else note.press.down = false;
    this.run();
  }

  drivePedal(name: M.PedalName, on: boolean) {
    if (this.held[name] === on) return;
    this.held = { ...this.held, [name]: on };
    // The sostenuto catches the dampers that are up when it goes down, and only those.
    if (name === 'sostenuto') {
      for (let i = 0; i < M.NOTES; i++) {
        this.latched[i] = on && this.notes[i]!.state.damper > 0.5;
        for (const index of this.byNote[i]!) {
          const chain = this.parts[index]!.chain;
          if (chain !== 'lift' && chain !== 'lever') continue;
          this.partEls[index]?.toggleAttribute('data-on', this.latched[i] || i === this.lit);
          if (chain === 'lift')
            this.partEls[index]
              ?.querySelectorAll('.iso-solid')
              .forEach((el) => el.toggleAttribute('data-lit', this.latched[i]));
        }
      }
    }
    this.report();
    this.run();
  }

  /** The player has taken over: the tour stops and comes back after a while. */
  private takeOver() {
    if (this.touring) {
      this.touring = false;
      for (const note of this.notes) note.press = { down: false, velocity: 0, until: 0 };
      for (const name of M.PEDAL_NAMES) if (this.held[name]) this.drivePedal(name, false);
    }
    clearTimeout(this.idleTimer);
    if (this.still.matches) return;
    this.idleTimer = window.setTimeout(() => this.resume(), IDLE * 1000);
  }

  private resume() {
    if (!this.quiet()) {
      this.idleTimer = window.setTimeout(() => this.resume(), IDLE * 1000);
      return;
    }
    this.touring = true;
    this.tourClock = 0;
    this.tourNext = 0;
    this.run();
  }

  private at(u: number, y: number, z: number) {
    return iso(M.world(u, y, z), this.P);
  }

  private drawPart(index: number, pose: M.Pose) {
    const part = this.parts[index]!;
    const el = this.partEls[index];
    if (!el || part.chain === 'fixed') return;
    if (part.kind === 'prism' && part.chain !== 'lift') {
      const poly = part.poly.map((point) => {
        const [u, z] = M.placeUZ(part.chain, point, pose);
        return [-u * M.MM, z * M.MM] as const;
      });
      const html = solidSvg(prismOf(ALONG, poly, part.y0 * M.MM, part.y1 * M.MM, this.P), {
        tone: part.tone,
        crease: part.tone === 'hi' ? 'lo' : 'faint',
        lit: this.lit === part.note,
      });
      el.innerHTML = part.ebony
        ? `<g class="pn-ebony">${html}</g>`
        : part.ivory
          ? `<g class="pn-ivory">${html}</g>`
          : html;
      return;
    }
    // Round parts and the damper only move: a translate is exact for them.
    const centre: M.UZ =
      part.kind === 'prism'
        ? part.poly[0]!
        : part.kind === 'post'
          ? [part.at[0], (part.z0 + part.z1) / 2]
          : part.at;
    const [u, z] = M.placeUZ(part.chain, centre, pose);
    const du = u - centre[0];
    const dz = z - centre[1];
    if (Math.abs(du) < 1e-4 && Math.abs(dz) < 1e-4) el.removeAttribute('transform');
    else el.setAttribute('transform', translateAlong(this.P, [-du * M.MM, 0, dz * M.MM]));
  }

  /** The note in play: its parts and strings keep their tones, every other note's step down. */
  private light(i: number) {
    if (this.lit === i) return;
    const was = this.lit;
    this.lit = i;
    this.svg.setAttribute('data-focus', '');
    for (const n of [was, i]) {
      if (n < 0) continue;
      for (const index of this.byNote[n]!) {
        const part = this.parts[index]!;
        this.partEls[index]?.toggleAttribute(
          'data-on',
          n === i || (this.latched[n]! && (part.chain === 'lift' || part.chain === 'lever')),
        );
        if (part.kind === 'prism' && part.chain !== 'lift' && part.chain !== 'fixed')
          this.drawPart(index, this.notes[n]!.shown ?? M.poseOf(this.notes[n]!.state));
        else if (part.chain !== 'fixed')
          this.partEls[index]
            ?.querySelectorAll('.iso-solid')
            .forEach((el) =>
              el.toggleAttribute(
                'data-lit',
                n === i || (this.latched[n]! && part.chain === 'lift'),
              ),
            );
      }
      for (const index of this.stringsByNote[n]!)
        this.stringEls[index]?.toggleAttribute('data-on', n === i);
    }
  }

  private drawNote(i: number) {
    const note = this.notes[i]!;
    const pose = M.poseOf(note.state);
    const last = note.shown;
    const changed = (a: number, b: number | undefined) => b === undefined || Math.abs(a - b) > 1e-5;
    for (const index of this.byNote[i]!) {
      const chain = this.parts[index]!.chain;
      const moved =
        (chain === 'key' && changed(pose.key, last?.key)) ||
        ((chain === 'wippen' || chain === 'jack') &&
          (changed(pose.wippen, last?.wippen) || changed(pose.jack, last?.jack))) ||
        (chain === 'hammer' && changed(pose.hammer, last?.hammer)) ||
        ((chain === 'lever' || chain === 'lift') && changed(pose.damper, last?.damper));
      if (moved) this.drawPart(index, pose);
    }
    note.shown = pose;
  }

  private drawStrings(i: number, real: number) {
    const note = this.notes[i]!;
    const ring = note.state.ring;
    // The swing is drawn larger and far slower than the real one, 0.1–1 mm at 262–494 Hz.
    const swing = this.still.matches
      ? 0
      : ring * 2.6 * Math.sin(real * Math.PI * 2 * (5 + i * 0.25));
    const lit = ring > 0.02;
    if (Math.abs(swing - note.swing) < 0.01 && note.lit === lit) return;
    note.swing = swing;
    note.lit = lit;
    for (const index of this.stringsByNote[i]!) {
      const run = this.strings[index]!;
      const el = this.stringEls[index];
      if (!el) continue;
      const [[u0, z0], [u1, z1]] = run.run;
      const struck = run.s >= M.UNISON - note.struck;
      const count = struck && run.speaking ? 6 : 1;
      const points = [];
      for (let n = 0; n <= count; n++) {
        const u = u0 + ((u1 - u0) * n) / count;
        points.push(
          this.at(u, run.y, count > 1 ? M.stringZ(u, i, swing) : z0 + ((z1 - z0) * n) / count),
        );
      }
      el.setAttribute('d', pathOf(points));
      el.setAttribute('data-tone', struck && lit ? 'lit' : 'mid');
    }
  }

  private step(simDt: number, real: number): boolean {
    let busy = false;
    const steps = Math.max(1, Math.round(simDt / STEP));
    const dt = simDt / steps;
    for (let i = 0; i < M.NOTES; i++) {
      const note = this.notes[i]!;
      const input = {
        down: note.press.down || this.clock < note.press.until,
        velocity: note.press.velocity,
        sustain: this.held.sustain || (this.held.sostenuto && this.latched[i]!),
      };
      let s = note.state;
      for (let n = 0; n < steps; n++) {
        const before = s.sinceStrike;
        s = stepAction(s, input, dt);
        if (s.sinceStrike < before) {
          // With the soft pedal down the hammer has moved 2.5 mm to the right: it misses a string.
          note.struck = M.struckStrings(this.shift > 0.5);
          if (note.struck < M.UNISON) s = { ...s, ring: s.ring * 0.75 };
        }
      }
      note.state = s;
      this.drawNote(i);
      this.drawStrings(i, real);
      if (input.down || s.key > 0 || s.hammer > 0 || s.ring > 0 || s.damper > 0) busy = true;
    }
    // Pedal levers follow the feet; the soft pedal slides the keyframe and the action.
    const wants = M.PEDAL_NAMES.map((name) => (this.held[name] ? 1 : 0));
    wants.forEach((want, p) => {
      const now = this.pedalAt[p]!;
      if (now === want) return;
      this.pedalAt[p] =
        want > now
          ? Math.min(1, now + simDt / PEDAL_SECONDS)
          : Math.max(0, now - simDt / PEDAL_SECONDS);
      this.drawPedal(p);
      busy = true;
    });
    if (this.shift !== this.pedalAt[0]) {
      this.shift = this.pedalAt[0]!;
      const by = translateAlong(this.P, [0, M.UNA_CORDA * this.shift * M.MM, 0]);
      this.shiftEls.forEach((el) =>
        this.shift ? el.setAttribute('transform', by) : el.removeAttribute('transform'),
      );
    }
    // The damper tray rises with the sustain pedal.
    if (this.tray !== this.pedalAt[2]) {
      this.tray = this.pedalAt[2]!;
      const by = translateAlong(this.P, [0, 0, M.TRAY_LIFT * this.tray * M.MM]);
      this.trayEls.forEach((el) =>
        this.tray ? el.setAttribute('transform', by) : el.removeAttribute('transform'),
      );
    }
    this.clock += simDt;
    return busy;
  }

  private drawPedal(p: number) {
    const angle = M.pedalAngle(this.pedalAt[p]!);
    this.pedalParts.forEach((part, index) => {
      const el = this.pedalEls[index];
      if (part.pedal !== p || !el) return;
      const poly = part.poly.map((point) => {
        const [u, z] = M.turn(point, M.PEDAL.pivot, angle);
        return [-u * M.MM, z * M.MM] as const;
      });
      el.innerHTML = solidSvg(prismOf(ALONG, poly, part.y0 * M.MM, part.y1 * M.MM, this.P), {
        tone: part.tone,
        crease: part.tone === 'hi' ? 'lo' : 'faint',
        lit: this.pedalAt[p]! > 0,
      });
    });
  }

  private report() {
    const s = this.notes[this.lastNote]!.state;
    const phase: FigurePhase =
      (s.phase === 'rest' || s.phase === 'release') && s.ring > 0.02
        ? s.damper > 0.15
          ? 'ringing'
          : 'damped'
        : s.phase;
    const reading: Reading = {
      note: this.lastNote,
      phase,
      pedals: this.held,
      touring: this.touring,
    };
    const key = JSON.stringify(reading);
    if (key === this.said) return;
    this.said = key;
    this.onReading(reading);
  }

  private tour(dt: number) {
    this.tourClock += dt;
    if (this.tourClock >= TOUR_LENGTH) {
      this.tourClock -= TOUR_LENGTH;
      this.tourNext = 0;
    }
    while (this.tourNext < TOUR.length && TOUR[this.tourNext]![0] <= this.tourClock)
      TOUR[this.tourNext++]![1](this);
  }

  private readonly tick = (now: number) => {
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
    this.last = now;
    if (this.touring) this.tour(dt);
    const busy = this.step(
      this.still.matches ? dt : dt / (this.touring ? 10 : this.speed),
      now / 1000,
    );
    this.report();
    this.frame = this.visible && (busy || this.touring) ? requestAnimationFrame(this.tick) : 0;
  };

  private quiet() {
    return (
      this.notes.every((note) => !note.press.down) &&
      M.PEDAL_NAMES.every((name) => !this.held[name])
    );
  }

  private run() {
    if (!this.frame && this.visible) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }
}

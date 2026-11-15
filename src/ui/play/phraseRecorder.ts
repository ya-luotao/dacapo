import {
  DEMO_VELOCITY,
  RELEASE_GAP_MS,
  type DemoControl,
  type DemoNote,
  type DemoPlan,
} from '../../core/playback.ts';
import type { InputEvent } from '../../input/types.ts';

/** Safety bound on recorded input events per scratch phrase. */
export const MAX_PHRASE_EVENTS = 2000;
/** Maximum duration of a recorded scratch phrase in milliseconds (5 minutes). */
export const MAX_PHRASE_MS = 300_000;
/** Minimum duration enforced for still-held or zero-length notes in milliseconds. */
export const MIN_NOTE_MS = 80;

const TAIL_MS = 120;

/** An in-memory captured musical phrase before compilation into a `DemoPlan`. */
export interface RecordedPhrase {
  notes: DemoNote[];
  controls: DemoControl[];
  length: number;
}

/** Stateful recorder that accumulates hub input events relative to first note onset. */
export interface PhraseRecorder {
  push: (event: InputEvent) => void;
  finish: (stopAt?: number) => RecordedPhrase | null;
  elapsed: (now: number) => number;
  hasStarted: () => boolean;
}

interface OpenNote {
  on: number;
  velocity: number;
}

/**
 * Create a pure in-memory scratch phrase recorder.
 * Trims dead silence before the first played note and ignores empty takes.
 */
export function createPhraseRecorder(): PhraseRecorder {
  let firstOn: number | null = null;
  let lastTime = 0;
  let eventCount = 0;
  let finished = false;
  let preOnsetSustain = false;
  let lastSustainDown: boolean | null = null;

  const open = new Map<number, OpenNote>();
  const rawNotes: DemoNote[] = [];
  const rawControls: DemoControl[] = [];

  function closeOpenNote(midi: number, time: number, minHold: boolean): void {
    const entry = open.get(midi);
    if (!entry || firstOn === null) return;
    open.delete(midi);

    const rel = time - firstOn;
    const targetOff = minHold
      ? Math.max(rel, entry.on + MIN_NOTE_MS)
      : rel <= entry.on
        ? entry.on + MIN_NOTE_MS
        : rel;
    const off = Math.min(MAX_PHRASE_MS, Math.max(entry.on + 1, targetOff));
    rawNotes.push({ midi, on: entry.on, off, velocity: entry.velocity });
  }

  function recordSustain(down: boolean, rel: number): void {
    if (lastSustainDown === down) return;
    lastSustainDown = down;
    rawControls.push({
      at: Math.min(MAX_PHRASE_MS, Math.max(0, rel)),
      controller: 64,
      value: down ? 127 : 0,
    });
  }

  return {
    push(event: InputEvent): void {
      if (finished) return;
      if (eventCount >= MAX_PHRASE_EVENTS) return;

      lastTime = Math.max(lastTime, event.time);

      switch (event.type) {
        case 'on': {
          if (firstOn === null) {
            firstOn = event.time;
            lastTime = event.time;
            if (preOnsetSustain) {
              recordSustain(true, 0);
            }
          }
          const rel = Math.max(0, event.time - firstOn);
          if (rel >= MAX_PHRASE_MS) return;

          eventCount += 1;
          if (open.has(event.midi)) {
            closeOpenNote(event.midi, event.time, false);
          }
          const velocity =
            event.velocity > 0 ? Math.min(127, Math.round(event.velocity)) : DEMO_VELOCITY;
          open.set(event.midi, { on: rel, velocity });
          break;
        }
        case 'off': {
          if (firstOn === null) return;
          if (!open.has(event.midi)) return;
          eventCount += 1;
          closeOpenNote(event.midi, event.time, false);
          break;
        }
        case 'sustain': {
          if (firstOn === null) {
            preOnsetSustain = event.down;
            return;
          }
          const rel = Math.max(0, event.time - firstOn);
          if (rel > MAX_PHRASE_MS) return;
          eventCount += 1;
          recordSustain(event.down, rel);
          break;
        }
        case 'reset': {
          if (firstOn === null) {
            preOnsetSustain = false;
            return;
          }
          for (const midi of [...open.keys()]) {
            closeOpenNote(midi, event.time, false);
          }
          if (lastSustainDown) {
            recordSustain(false, event.time - firstOn);
          }
          break;
        }
        case 'pedal':
          break;
      }
    },

    finish(stopAt?: number): RecordedPhrase | null {
      if (finished) return null;
      finished = true;

      if (firstOn === null) return null;

      const endTime = stopAt !== undefined ? stopAt : lastTime;
      for (const midi of [...open.keys()]) {
        closeOpenNote(midi, endTime, true);
      }

      if (rawNotes.length === 0) return null;

      const separated = separateRepeatedKeys(rawNotes, null);
      const lastOff = separated.reduce((max, note) => Math.max(max, note.off), 0);
      const length = Math.min(Math.max(lastOff + TAIL_MS, MIN_NOTE_MS), MAX_PHRASE_MS);
      const maxControlAt = Math.max(0, length - 1);
      const controls = rawControls
        .map((c) => ({ ...c, at: Math.min(c.at, maxControlAt) }))
        .sort((a, b) => a.at - b.at);

      return { notes: separated, controls, length };
    },

    elapsed(now: number): number {
      if (firstOn === null) return 0;
      return Math.min(Math.max(0, now - firstOn), MAX_PHRASE_MS);
    },

    hasStarted(): boolean {
      return firstOn !== null;
    },
  };
}

/**
 * Compile a recorded phrase into a `DemoPlan` consumable by `createDemoPlayer`.
 * Separates repeated same-pitch strikes (including across loop wrap) by at least `RELEASE_GAP_MS`.
 */
export function buildPhrasePlan(phrase: RecordedPhrase, loop: boolean): DemoPlan {
  const notes = separateRepeatedKeys(phrase.notes, loop ? phrase.length : null);
  const controls = phrase.controls.map((c) => ({ ...c }));
  const cueSet = new Set<number>();
  for (const note of notes) {
    cueSet.add(note.on);
    cueSet.add(note.off);
  }
  const cues = [...cueSet].sort((a, b) => a - b);

  return {
    notes,
    steps: [],
    length: phrase.length,
    start: 0,
    loop,
    controls,
    cues,
  };
}

/** Return the set of MIDI keys actively sounding at position `ms` within `plan`. */
export function soundingKeysAt(plan: DemoPlan, ms: number): Set<number> {
  const active = new Set<number>();
  if (ms < 0 || plan.length <= 0) return active;
  if (!plan.loop && ms >= plan.length) return active;

  const pos = plan.loop ? ((ms % plan.length) + plan.length) % plan.length : ms;
  for (const note of plan.notes) {
    if (note.on <= pos && pos < note.off) {
      active.add(note.midi);
    }
  }
  return active;
}

/** Format a millisecond duration as `m:ss` (for example `0:04`). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function separateRepeatedKeys(source: readonly DemoNote[], loopLength: number | null): DemoNote[] {
  const result = source.map((note) => ({ ...note }));
  const byMidi = new Map<number, DemoNote[]>();

  for (const note of result) {
    let list = byMidi.get(note.midi);
    if (!list) {
      list = [];
      byMidi.set(note.midi, list);
    }
    list.push(note);
  }

  for (const list of byMidi.values()) {
    list.sort((a, b) => a.on - b.on || a.off - b.off);
    for (let i = 0; i < list.length - 1; i++) {
      const current = list[i];
      const next = list[i + 1];
      if (current && next) {
        trimBeforeNextOnset(current, next.on);
      }
    }
    if (loopLength !== null && loopLength > 0 && list.length > 0) {
      const last = list.at(-1);
      const first = list[0];
      if (last && first) {
        trimBeforeNextOnset(last, first.on + loopLength);
      }
    }
  }

  result.sort((a, b) => a.on - b.on || a.midi - b.midi || a.off - b.off);
  return result;
}

function trimBeforeNextOnset(note: DemoNote, nextOn: number): void {
  const span = nextOn - note.on;
  if (span <= 0) return;
  const ceiling =
    span > RELEASE_GAP_MS ? nextOn - RELEASE_GAP_MS : note.on + Math.max(1, Math.floor(span / 2));
  if (note.off > ceiling) {
    note.off = Math.max(note.on, ceiling);
  }
}

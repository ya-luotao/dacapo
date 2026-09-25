// Reads the notes of a Standard MIDI File: enough to use a MIDI file as a proofreading oracle.

import { readFileSync } from 'node:fs';

export interface MidiNote {
  /** Onset in quarter notes from the start of the file. */
  onset: number;
  duration: number;
  midi: number;
}

export interface MidiTrack {
  name: string;
  notes: MidiNote[];
}

export function readMidiFile(path: string): MidiTrack[] {
  const data = readFileSync(path);
  if (data.toString('latin1', 0, 4) !== 'MThd') throw new Error(`${path}: not a MIDI file`);
  const division = data.readUInt16BE(12);
  if (division & 0x8000) throw new Error(`${path}: SMPTE time division is not supported`);
  const tracks: MidiTrack[] = [];
  let i = 8 + data.readUInt32BE(4);
  while (i + 8 <= data.length) {
    const id = data.toString('latin1', i, i + 4);
    const length = data.readUInt32BE(i + 4);
    const start = i + 8;
    i = start + length;
    if (id === 'MTrk') tracks.push(readTrack(data.subarray(start, i), division));
  }
  return tracks;
}

function readTrack(t: Buffer, division: number): MidiTrack {
  let j = 0;
  const vlq = () => {
    let value = 0;
    for (;;) {
      const byte = t[j++]!;
      value = (value << 7) | (byte & 0x7f);
      if (byte < 0x80) return value;
    }
  };
  let tick = 0;
  let status = 0;
  let name = '';
  const open = new Map<number, number[]>();
  const notes: MidiNote[] = [];
  while (j < t.length) {
    tick += vlq();
    const byte = t[j]!;
    if (byte === 0xff) {
      const type = t[j + 1]!;
      j += 2;
      const length = vlq();
      if (type === 0x03) name = t.toString('latin1', j, j + length);
      j += length;
      continue;
    }
    if (byte === 0xf0 || byte === 0xf7) {
      j++;
      j += vlq();
      continue;
    }
    if (byte & 0x80) {
      status = byte;
      j++;
    }
    const kind = status & 0xf0;
    if (kind === 0xc0 || kind === 0xd0) {
      j++;
      continue;
    }
    const key = t[j]!;
    const velocity = t[j + 1]!;
    j += 2;
    if (kind === 0x90 && velocity > 0) {
      open.set(key, [...(open.get(key) ?? []), tick]);
    } else if (kind === 0x80 || kind === 0x90) {
      const on = open.get(key)?.shift();
      if (on !== undefined)
        notes.push({ onset: on / division, duration: (tick - on) / division, midi: key });
    }
  }
  notes.sort((a, b) => a.onset - b.onset || a.midi - b.midi);
  return { name, notes };
}

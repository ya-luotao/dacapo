// Makes the built-in piano's samples from the Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0):
// three of its sixteen velocity layers, every minor third from A0 to C8 as recorded, each trimmed
// to its first sound, cut to a length that falls with pitch, faded out and encoded as MP3. Writes
// them to public/piano/ and their table (keys, layers, tuning from the retuned SFZ) to
// src/output/pianoTable.ts.
//
//   node --experimental-strip-types scripts/piano/build.ts <SalamanderGrandPiano-SFZ+FLAC-V3+20200602>
//
// Needs ffmpeg with libmp3lame. The output is deterministic for one ffmpeg build.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** SHA-256 of the retuned SFZ in the FreePats archive of 2020-06-02. */
const SFZ = 'SalamanderGrandPianoRetuned-V3+20200602.sfz';
const SFZ_SHA256 = '2f8883be56c266c59a61ced408de1308e5d173f65e4ce22bfd371129a736a8a9';

/**
 * The layers kept, soft to loud, with the velocity each stands for (the middle of its SFZ range):
 * the demo (72) and the computer keyboard (96) each get one of their own.
 */
const LAYERS = [
  { id: 'p', layer: 4, velocity: 40 },
  { id: 'mf', layer: 9, velocity: 68 },
  { id: 'f', layer: 13, velocity: 100 },
] as const;

const RATE = 48_000;
/** The first sample louder than this (−66 dBFS) is the start of the note; 1 ms before it is kept. */
const ONSET = 10 ** (-66 / 20);
const PRE_ROLL = RATE / 1000;

/** Seconds kept: 8 s for A0 down to 2.5 s for C8 (the treble has died away by then). */
const lengthFor = (key: number) => 8 - ((key - 21) * 5.5) / 87;
const fadeFor = (length: number) => Math.min(2, length * 0.35);

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error('usage: build.ts <SalamanderGrandPiano-SFZ+FLAC-V3+20200602>');
  process.exit(2);
}
const sfz = readFileSync(join(dir, SFZ));
const hash = createHash('sha256').update(sfz).digest('hex');
if (hash !== SFZ_SHA256) throw new Error(`${SFZ}: sha256 ${hash}, expected ${SFZ_SHA256}`);

interface Region {
  file: string;
  key: number;
  tune: number;
}

/** The regions of velocity layer `layer`, low to high. */
function regions(layer: number): Region[] {
  const out: Region[] = [];
  for (const line of sfz.toString('utf8').split('\n')) {
    const sample = /sample=samples\/(\S+)v(\d+)\.flac/.exec(line);
    if (!sample || Number(sample[2]) !== layer) continue;
    const opcode = (name: string) => new RegExp(`\\s${name}=(-?\\d+)`).exec(line);
    // An SFZ region without pitch_keycenter is centred on key 60.
    const key = Number(opcode('pitch_keycenter')?.[1] ?? 60);
    out.push({ file: `${sample[1]}v${layer}.flac`, key, tune: Number(opcode('tune')?.[1] ?? 0) });
  }
  return out.sort((a, b) => a.key - b.key);
}

const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const nameOf = (key: number) => `${NAMES[key % 12]}${Math.floor(key / 12) - 1}`;

function ffmpeg(args: string[], input?: Buffer): Buffer {
  return execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', ...args], {
    input,
    maxBuffer: 1 << 30,
  });
}

/** Index of the first sample frame louder than ONSET in either channel. */
function onset(file: string): number {
  const pcm = ffmpeg(['-i', file, '-t', '1', '-ac', '2', '-ar', String(RATE), '-f', 'f32le', '-']);
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]!) > ONSET) return i >> 1;
  throw new Error(`${file}: no sound in the first second`);
}

const root = new URL('../../', import.meta.url).pathname;
const out = join(root, 'public/piano');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let keys: Region[] | null = null;
for (const { id, layer } of LAYERS) {
  const found = regions(layer);
  if (found.length !== 30) throw new Error(`layer ${layer}: ${found.length} regions, expected 30`);
  if (keys && found.some((r, i) => r.key !== keys![i]!.key || r.tune !== keys![i]!.tune))
    throw new Error(`layer ${layer}: keys or tuning differ from the first layer`);
  keys ??= found;
  for (const region of found) {
    const input = join(dir, 'samples', region.file);
    const start = Math.max(0, onset(input) - PRE_ROLL);
    const length = lengthFor(region.key);
    const fade = fadeFor(length);
    const target = join(out, `${nameOf(region.key)}-${id}.mp3`);
    ffmpeg([
      '-i',
      input,
      '-af',
      [
        `aresample=${RATE}`,
        `atrim=start_sample=${start}`,
        'asetpts=PTS-STARTPTS',
        `atrim=duration=${length.toFixed(3)}`,
        `afade=t=out:st=${(length - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
      ].join(','),
      '-ac',
      '2',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '5',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      '-y',
      target,
    ]);
    console.log(`${target.slice(root.length)} (from ${region.file}, ${start} frames trimmed)`);
  }
}

const table = `// Generated by scripts/piano/build.ts from the Salamander Grand Piano V3 (retuned SFZ); do not edit.

/** The velocity layers, soft to loud: \`id\` names the files, \`velocity\` is what a layer stands for. */
export const PIANO_LAYERS = ${JSON.stringify(LAYERS.map(({ id, velocity }) => ({ id, velocity })))} as const;

/** The sampled keys, low to high: its MIDI key, the file name's note and the retuning in cents. */
export const PIANO_SAMPLES: readonly { key: number; name: string; tune: number }[] = ${JSON.stringify(
  keys!.map((r) => ({ key: r.key, name: nameOf(r.key), tune: r.tune })),
)};
`;
writeFileSync(join(root, 'src/output/pianoTable.ts'), table);
execFileSync(join(root, 'node_modules/.bin/prettier'), ['--write', 'src/output/pianoTable.ts'], {
  cwd: root,
});

const bytes = readdirSync(out).reduce((sum, f) => sum + readFileSync(join(out, f)).length, 0);
console.log(`${readdirSync(out).length} files, ${(bytes / 1e6).toFixed(2)} MB`);

// Writes src/core/scaleFingering.ts from Hanon's transcription (hanon/hanon.json and
// hanon/hanon41.json), with the corrections in src/core/hanonData.ts applied. Run from the
// repository root:
//
//   node --experimental-strip-types scripts/scales/fingering.ts
//
// src/core/scaleFingering.test.ts rebuilds the data from the JSON and compares, so a change to
// either side that is not regenerated fails the tests.

import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import {
  fingeringData,
  readHanon,
  readHanonArpeggios,
  renderFingeringModule,
} from '../../src/core/hanonData.ts';

const source = new URL('./hanon/hanon.json', import.meta.url);
const source41 = new URL('./hanon/hanon41.json', import.meta.url);
const target = new URL('../../src/core/scaleFingering.ts', import.meta.url);

const data = fingeringData(
  readHanon(JSON.parse(readFileSync(source, 'utf8')) as unknown),
  readHanonArpeggios(JSON.parse(readFileSync(source41, 'utf8')) as unknown),
);
const config = await resolveConfig(target);
const text = await format(renderFingeringModule(data), {
  ...config,
  filepath: target.pathname,
});
writeFileSync(target, text);
console.log(
  `wrote ${target.pathname}: ${data.scales.length} scales, the chromatic scale, ${data.arpeggios.length} arpeggios, ${data.corrections.length} correction(s)`,
);

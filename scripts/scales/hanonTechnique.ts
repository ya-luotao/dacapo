// Writes src/core/hanonTechnique.ts from the transcription of Hanon's Nos. 42–53
// (hanon/s7/s7.json). Run from the repository root:
//
//   node --experimental-strip-types scripts/scales/hanonTechnique.ts
//
// src/core/hanonTechnique.test.ts rebuilds the data from the JSON and compares, so a change to
// either side that is not regenerated fails the tests.

import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import {
  readTechnique,
  renderTechniqueModule,
  techniqueData,
} from '../../src/core/hanonTechniqueData.ts';

const source = new URL('./hanon/s7/s7.json', import.meta.url);
const target = new URL('../../src/core/hanonTechnique.ts', import.meta.url);

const data = techniqueData(readTechnique(JSON.parse(readFileSync(source, 'utf8')) as unknown));
const config = await resolveConfig(target);
const text = await format(renderTechniqueModule(data), { ...config, filepath: target.pathname });
writeFileSync(target, text);
console.log(`wrote ${target.pathname}: ${data.length} parts`);

// Writes src/core/hanonPartOne.ts from the transcription of Hanon's Part I
// (hanon/part1/part1.json). Run from the repository root:
//
//   node --experimental-strip-types scripts/scales/hanonPartOne.ts
//
// src/core/hanonPartOne.test.ts rebuilds the data from the JSON and compares, so a change to
// either side that is not regenerated fails the tests.

import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { partOneData, readPartOne, renderPartOneModule } from '../../src/core/hanonPartOneData.ts';

const source = new URL('./hanon/part1/part1.json', import.meta.url);
const target = new URL('../../src/core/hanonPartOne.ts', import.meta.url);

const data = partOneData(readPartOne(JSON.parse(readFileSync(source, 'utf8')) as unknown));
const config = await resolveConfig(target);
const text = await format(renderPartOneModule(data), { ...config, filepath: target.pathname });
writeFileSync(target, text);
console.log(`wrote ${target.pathname}: Nos. ${data.map((d) => d.number).join(', ')}`);

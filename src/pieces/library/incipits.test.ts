// The library's incipits (docs/PIECES.md, "Incipits"): the first bars of every built-in piece,
// engraved here and kept in public/incipits/, with their sizes in incipits.json for the page to lay
// them out before they arrive. A piece's file changed: `pnpm vitest run incipits -u` writes them
// again, and the difference is reviewed like any other.

import { describe, expect, it } from 'vitest';
import { engraveIncipit, loadEngraver } from '../../site/score.ts';
import { BUILT_IN, loadBuiltIn } from './index.ts';

describe('incipits', () => {
  it('are the first bars of every built-in piece, as engraved now', async () => {
    const tk = await loadEngraver();
    const sizes: Record<string, [number, number]> = {};
    for (const piece of BUILT_IN) {
      const xml = await loadBuiltIn(piece.id);
      const { svg, width, height } = engraveIncipit(tk, xml, piece.id);
      sizes[piece.id] = [width, height];
      await expect(svg).toMatchFileSnapshot(`../../../public/incipits/${piece.id}.svg`);
    }
    await expect(`${JSON.stringify(sizes, null, 2)}\n`).toMatchFileSnapshot('./incipits.json');
  }, 120_000);
});

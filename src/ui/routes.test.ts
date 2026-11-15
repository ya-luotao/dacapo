import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, NEWCOMER_PATHS } from './routes.ts';

describe('navigation routes', () => {
  it('exposes Learn, Read, Pieces, and Progress directly for newcomers', () => {
    expect(NEWCOMER_PATHS).toEqual(['/learn', '/read', '/pieces', '/progress']);
    const navPaths = new Set(NAV_ITEMS.map((item) => item.path));
    for (const path of NEWCOMER_PATHS) expect(navPaths.has(path)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

// What is loaded when the app starts stays clear of the exercises' rules (core/scales.ts: Hanon's
// fingering and plates, over 100 kB) and of the validators (storage/validate.ts): those come with
// the pages that need them. The home page's assignment block is loaded at the start whenever an
// assignment is current, and today's plan for every returning player, so they are held to the
// same.

const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * The modules a source imports with a static `import … from` or `export … from` (not `import
 * type`, not `import()`), by path. An import of types alone written `import { type A }` counts:
 * it is kept as an import of the module.
 */
function staticImports(path: string): string[] {
  const text = SOURCES[path]!;
  const dir = path.slice(0, path.lastIndexOf('/'));
  const found: string[] = [];
  const statement = /^(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?'(\.{1,2}\/[^']+)'/gm;
  for (const match of text.matchAll(statement)) {
    const parts = dir.split('/');
    for (const part of match[1]!.split('/')) {
      if (part === '..') parts.pop();
      else if (part !== '.') parts.push(part);
    }
    const target = parts.join('/');
    if (target in SOURCES) found.push(target);
  }
  return found;
}

/** Every module loaded with `root`, and for each the one that brought it in. */
function loadedWith(root: string): Map<string, string | null> {
  const from = new Map<string, string | null>([[root, null]]);
  const todo = [root];
  while (todo.length > 0) {
    const path = todo.pop()!;
    for (const next of staticImports(path)) {
      if (from.has(next)) continue;
      from.set(next, path);
      todo.push(next);
    }
  }
  return from;
}

/** How `root` comes to load `target`: the chain of imports, or null when it does not. */
function chain(root: string, target: string): string[] | null {
  const from = loadedWith(root);
  if (!from.has(target)) return null;
  const path: string[] = [];
  for (let at: string | null = target; at !== null; at = from.get(at) ?? null) path.unshift(at);
  return path;
}

const HEAVY = ['/src/core/scales.ts', '/src/storage/validate.ts'];

/** What the home page loads beside the app: the assignment's block, and today's plan. */
const HOME_BLOCKS = ['/src/ui/assignments/HomeAssignment.tsx', '/src/ui/today/TodayPlan.tsx'];

describe('what the start loads', () => {
  it('reads imports as written', () => {
    expect(staticImports('/src/ui/assignments/HomeAssignment.tsx')).toEqual(
      expect.arrayContaining(['/src/ui/assignments/taskFormat.ts', '/src/core/streak.ts']),
    );
    // A page loaded on demand is not loaded with the app.
    expect(loadedWith('/src/main.tsx').has('/src/ui/App.tsx')).toBe(true);
    expect(loadedWith('/src/main.tsx').has('/src/ui/assignments/AssignmentsPage.tsx')).toBe(false);
    // The Assignments pages do have the exercises' rules: the check can find them.
    expect(chain('/src/ui/assignments/AssignmentsPage.tsx', '/src/core/scales.ts')).not.toBeNull();
  });

  it.each(['/src/main.tsx', ...HOME_BLOCKS])(
    '%s loads neither the exercises’ rules nor the validators',
    (root) => {
      for (const heavy of HEAVY) expect(chain(root, heavy)).toBeNull();
    },
  );

  // The tunes played by ear (docs/HARMONY.md, H5): the start knows which they are and how many
  // phrases each has; their melodies come with the Ear page, and the staff they are drawn on
  // (Verovio) when a tune is played.
  it.each(['/src/main.tsx', ...HOME_BLOCKS])(
    '%s loads the list of tunes, not their melodies',
    (root) => {
      expect(chain(root, '/src/core/tuneList.ts')).not.toBeNull();
      for (const melodies of [
        '/src/core/tuneData.ts',
        '/src/core/tunes.ts',
        '/src/core/tuneXml.ts',
      ])
        expect(chain(root, melodies)).toBeNull();
    },
  );

  // Today's plan (docs/TODAY.md) takes the mastery rule of every practice: the start has the
  // plan as data and where it is kept, to lay the home page out at once; the rules that make and
  // tick a plan come with its rows.
  it('the start loads today’s plan as data, and its rules with its rows', () => {
    const rules = [
      '/src/core/today.ts',
      '/src/core/curriculum.ts',
      '/src/core/assignments.ts',
      '/src/core/mastery.ts',
      '/src/core/scaleRanking.ts',
      '/src/core/evenness.ts',
    ];
    for (const light of [
      '/src/ui/home/Today.tsx',
      '/src/ui/today/prefs.ts',
      '/src/core/todayRecords.ts',
    ])
      expect(chain('/src/main.tsx', light)).not.toBeNull();
    expect(chain('/src/main.tsx', '/src/ui/today/TodayPlan.tsx')).toBeNull();
    for (const rule of rules) {
      expect(chain('/src/main.tsx', rule), rule).toBeNull();
      // The plan's rows do have them: the check can find them.
      expect(chain('/src/ui/today/TodayPlan.tsx', rule), rule).not.toBeNull();
    }
    // The places over runs re-analyse raw runs with the exercises' rules: not for the home page.
    for (const block of HOME_BLOCKS)
      expect(chain(block, '/src/core/scaleProgress.ts'), block).toBeNull();
  });

  it('the Ear page loads the melodies, and the staff only on demand', () => {
    expect(chain('/src/ui/pages/EarPage.tsx', '/src/core/tuneData.ts')).not.toBeNull();
    expect(chain('/src/ui/pages/EarPage.tsx', '/src/ui/ear/TuneStaff.tsx')).toBeNull();
    expect(chain('/src/ui/pages/EarPage.tsx', '/src/ui/notation/ScoreView.tsx')).toBeNull();
  });
});

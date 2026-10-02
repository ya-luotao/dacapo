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

  // Where the pieces stand (docs/PIECES.md, "Next for you": the piece in hand, the next piece,
  // the pieces played to their end) comes with the Pieces page and with the plan's rows. The
  // Pieces page reads it apart from today's plan, so it loads no other practice's rules for it.
  it('the start loads no standing of the pieces: the Pieces page does, without today’s rules', () => {
    const standing = '/src/core/piecesStanding.ts';
    expect(chain('/src/main.tsx', standing)).toBeNull();
    expect(chain('/src/main.tsx', '/src/ui/pieces/PiecesPage.tsx')).toBeNull();
    for (const root of ['/src/ui/pieces/PiecesPage.tsx', '/src/ui/today/TodayPlan.tsx'])
      expect(chain(root, standing), root).not.toBeNull();
    for (const rules of ['/src/core/today.ts', '/src/core/assignments.ts', '/src/core/mastery.ts'])
      expect(chain('/src/ui/pieces/PiecesPage.tsx', rules), rules).toBeNull();
    for (const heavy of HEAVY) expect(chain(standing, heavy)).toBeNull();
  });

  // The recap of a week (docs/PERSONAL.md, "Your week") is the state at the week's end against
  // the state at its start, by every practice's mastery rule: it comes with Progress and with
  // the plan's rows, whose line about last week it words. The start knows only on which days of
  // a week the line has room.
  it('the start loads no recap of a week: Progress and the plan’s rows do', () => {
    for (const recap of [
      '/src/core/recap.ts',
      '/src/core/tempoLadder.ts',
      '/src/ui/progress/WeekRecap.tsx',
      '/src/ui/progress/recapFormat.ts',
      '/src/ui/today/WeekLine.tsx',
      '/src/ui/today/lessonTicks.ts',
    ])
      expect(chain('/src/main.tsx', recap), recap).toBeNull();
    expect(chain('/src/main.tsx', '/src/ui/pages/ProgressPage.tsx')).toBeNull();
    for (const root of ['/src/ui/pages/ProgressPage.tsx', '/src/ui/today/TodayPlan.tsx'])
      expect(chain(root, '/src/core/recap.ts'), root).not.toBeNull();
    // What the start reads of the week is the calendar and one figure, beside the plan's data.
    expect(SOURCES['/src/core/todayRecords.ts']).toContain('WEEK_LINE_DAYS');
    expect(staticImports('/src/core/recap.ts')).not.toContain('/src/core/trends.ts');
    for (const heavy of HEAVY) expect(chain('/src/core/recap.ts', heavy)).toBeNull();
  });

  // The start page (docs/START.md) is for whoever presses Start on a first visit: the start has
  // the answer as data and where it is kept (the home page tells a visitor who answered from a
  // first visit by it), and the page itself comes on demand.
  it('the start loads the starting point as data, and the start page on demand', () => {
    for (const light of ['/src/ui/start/prefs.ts', '/src/core/startingPoint.ts'])
      expect(chain('/src/main.tsx', light)).not.toBeNull();
    for (const page of [
      '/src/ui/start/StartPage.tsx',
      '/src/ui/start/StartingPointFields.tsx',
      '/src/ui/settings/StartSection.tsx',
    ])
      expect(chain('/src/main.tsx', page), page).toBeNull();
    // The starting point is nothing but data: it brings no practice's rules with it.
    expect([...loadedWith('/src/ui/start/prefs.ts').keys()].sort()).toEqual([
      '/src/core/startingPoint.ts',
      '/src/lib/localPrefs.ts',
      '/src/ui/start/prefs.ts',
    ]);
    for (const heavy of HEAVY) expect(chain('/src/ui/start/StartPage.tsx', heavy)).toBeNull();
    // The plan's rows and "Where you are" read the answer where it is kept.
    expect(chain('/src/ui/today/TodayPlan.tsx', '/src/ui/start/prefs.ts')).not.toBeNull();
    expect(chain('/src/ui/progress/WhereYouAre.tsx', '/src/ui/start/prefs.ts')).not.toBeNull();
  });

  // The daily goal (docs/PERSONAL.md): the home page's line towards today's goal reads the
  // goal's changes at the start, so they are data and the calendar, nothing more.
  it('the start loads the daily goal as data', () => {
    expect(chain('/src/main.tsx', '/src/ui/progress/goal.ts')).not.toBeNull();
    expect([...loadedWith('/src/ui/progress/goal.ts').keys()].sort()).toEqual([
      '/src/core/goal.ts',
      '/src/core/streak.ts',
      '/src/lib/localPrefs.ts',
      '/src/ui/progress/goal.ts',
    ]);
  });

  it('the Ear page loads the melodies, and the staff only on demand', () => {
    expect(chain('/src/ui/pages/EarPage.tsx', '/src/core/tuneData.ts')).not.toBeNull();
    expect(chain('/src/ui/pages/EarPage.tsx', '/src/ui/ear/TuneStaff.tsx')).toBeNull();
    expect(chain('/src/ui/pages/EarPage.tsx', '/src/ui/notation/ScoreView.tsx')).toBeNull();
  });
});

import { deflateSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { sampleAssignment, samplePiece, sampleReport } from '../storage/fixtures.ts';
import {
  MAX_ASSIGNMENT_BYTES,
  MAX_TASKS,
  type Assignment,
  type PieceTask,
  type SharedPiece,
  type Task,
  type TaskReport,
} from './assignmentRecords.ts';
import {
  decodeShare,
  encodeShare,
  importedPieceTasks,
  isDay,
  LINK_VERSION,
  linkData,
  MAX_FILE_PIECES,
  MAX_INFLATED_BYTES,
  MAX_LINK_BYTES,
  MAX_LINK_CHARS,
  OPEN_ROUTE,
  parseAssignment,
  parseReport,
  parseShareFile,
  parseTask,
  piecesToShare,
  shareFileName,
  shareFileText,
  shareLink,
  type Shared,
} from './assignmentShare.ts';

const assignment = sampleAssignment(1);
const shared: Shared = { kind: 'assignment', assignment, pieces: [] };

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** A link's data holding `json` as it is, whatever it is. */
function linkOf(json: unknown, version = LINK_VERSION): string {
  const packed = deflateSync(new TextEncoder().encode(JSON.stringify(json)));
  return toBase64Url(new Uint8Array([version, ...packed]));
}

const without = <T extends object>(value: T, key: keyof T): Partial<T> => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};

describe('the link', () => {
  it('carries an assignment there and back', () => {
    const data = encodeShare(shared)!;
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    // Five tasks deflate to a few hundred characters.
    expect(data.length).toBeLessThan(900);
    expect(decodeShare(data)).toEqual({ ok: true, value: shared });
    expect(shareLink('https://playdacapo.com/', data)).toBe(
      `https://playdacapo.com/#/assignments/open/${data}`,
    );
  });

  it('carries a report there and back', () => {
    const report = sampleReport(1);
    const data = encodeShare({ kind: 'report', report })!;
    expect(decodeShare(data)).toEqual({ ok: true, value: { kind: 'report', report } });
  });

  it('is the same link for the same assignment, however its fields are ordered', () => {
    const shuffled = Object.fromEntries(Object.entries(assignment).reverse()) as Assignment;
    expect(encodeShare({ kind: 'assignment', assignment: shuffled, pieces: [] })).toBe(
      encodeShare(shared),
    );
  });

  it('holds sixty pieces in well under its 8 KB', () => {
    const piece = assignment.tasks[0] as PieceTask;
    const tasks: Task[] = Array.from({ length: 60 }, (_, i) => ({
      ...piece,
      id: `t${i}`,
      bars: { from: i, to: i + 3, fromLabel: String(i + 1), toLabel: String(i + 4) },
      tempo: 40 + 10 * (i % 17),
      runs: 1 + (i % 9),
    }));
    const data = encodeShare({
      kind: 'assignment',
      assignment: { ...assignment, tasks },
      pieces: [],
    })!;
    expect(data).not.toBeNull();
    expect(data.length).toBeLessThan(MAX_LINK_CHARS / 2);
    const back = decodeShare(data);
    expect(back.ok && back.value.kind === 'assignment' && back.value.assignment.tasks).toEqual(
      tasks,
    );
  });

  it('is not made for what does not fit: that goes as a file', () => {
    // Notes that do not compress, up to the size a record may have.
    let seed = 7;
    const noise = (n: number) =>
      Array.from({ length: n }, () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return String.fromCharCode(0x4e00 + (seed % 20000));
      }).join('');
    const tasks: Task[] = Array.from({ length: 8 }, (_, i) => ({
      kind: 'unknown',
      id: `t${i}`,
      raw: { kind: 'duet', id: `t${i}`, text: noise(550) },
    }));
    const large = { ...assignment, note: noise(2000), tasks };
    expect(parseAssignment(large)).not.toBeNull();
    expect(encodeShare({ kind: 'assignment', assignment: large, pieces: [] })).toBeNull();
  });

  it('never carries a piece’s MusicXML', () => {
    const piece = samplePiece(1);
    const data = encodeShare({ kind: 'assignment', assignment, pieces: [piece] })!;
    expect(decodeShare(data)).toEqual({ ok: true, value: shared });
  });

  it('refuses a damaged or foreign link in a word, never throwing', () => {
    const data = encodeShare(shared)!;
    expect(decodeShare('')).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare('not a link!')).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare('%3Cscript%3E')).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare(data.slice(0, -9))).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare(`${data}A`).ok).toBe(false);
    // Every single character changed: refused, or (a changed letter in a name) still valid.
    for (let i = 0; i < data.length; i++) {
      const swapped = data.slice(0, i) + (data[i] === 'A' ? 'B' : 'A') + data.slice(i + 1);
      const result = decodeShare(swapped);
      if (result.ok)
        expect(
          parseAssignment(result.value.kind === 'assignment' && result.value.assignment),
        ).not.toBeNull();
      else expect(['malformed', 'invalid', 'newer', 'too-large']).toContain(result.error);
    }
    // Deflated, but not JSON; JSON, but not ours.
    const garbage = toBase64Url(
      new Uint8Array([LINK_VERSION, ...deflateSync(new Uint8Array([0xff, 0xfe, 0x7b]))]),
    );
    expect(decodeShare(garbage)).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare(linkOf([1, 2, 3]))).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare(linkOf({ homework: assignment }))).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(decodeShare(linkOf({ assignment: { ...assignment, tasks: 'none' } }))).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('says so when a later version of the format made the link', () => {
    expect(decodeShare(linkOf({ assignment }, LINK_VERSION + 1))).toEqual({
      ok: false,
      error: 'newer',
    });
    expect(decodeShare(linkOf({ assignment }, 0))).toEqual({ ok: false, error: 'malformed' });
    // Any other text in base64url is no link of ours, not a newer one.
    expect(decodeShare(linkOf({ assignment }, 16))).toEqual({ ok: false, error: 'malformed' });
    expect(decodeShare('bm90IGFuIGFzc2lnbm1lbnQ')).toEqual({ ok: false, error: 'malformed' });
  });

  it('refuses what is too large before reading it', () => {
    expect(decodeShare('A'.repeat(MAX_LINK_CHARS + 1))).toEqual({ ok: false, error: 'too-large' });
    // A few kilobytes that inflate to megabytes: stopped at the limit, never parsed.
    const bomb = deflateSync(new Uint8Array(4 * 1024 * 1024), { level: 9 });
    expect(bomb.byteLength + 1).toBeLessThan(MAX_LINK_BYTES);
    const started = performance.now();
    expect(decodeShare(toBase64Url(new Uint8Array([LINK_VERSION, ...bomb])))).toEqual({
      ok: false,
      error: 'too-large',
    });
    expect(performance.now() - started).toBeLessThan(1000);
    // Just over the limit once inflated, in a link of a legal size.
    const padded = { assignment: { ...assignment, note: ' '.repeat(MAX_INFLATED_BYTES) } };
    expect(decodeShare(linkOf(padded))).toEqual({ ok: false, error: 'too-large' });
  });

  it('finds the data in a pasted link', () => {
    const data = encodeShare(shared)!;
    expect(linkData(`  https://playdacapo.com/#${OPEN_ROUTE}${data}\n`)).toBe(data);
    expect(linkData(`Here it is: http://localhost:5342/#${OPEN_ROUTE}${data}.`)).toBe(data);
    expect(linkData(data)).toBe(data);
    expect(linkData('https://playdacapo.com/#/pieces')).toBeNull();
    expect(linkData(`https://playdacapo.com/#${OPEN_ROUTE}`)).toBeNull();
    expect(linkData('')).toBeNull();
  });
});

describe('reading an assignment', () => {
  it('keeps the fields it knows and drops the rest', () => {
    const extra = {
      ...assignment,
      owner: 'x',
      tasks: assignment.tasks.map((t) => ({ ...t, extra: 1 })),
    };
    expect(parseAssignment(extra)).toEqual(assignment);
  });

  it('refuses a missing, mistyped or out-of-bounds field', () => {
    const bad = (patch: Record<string, unknown>) => parseAssignment({ ...assignment, ...patch });
    for (const key of Object.keys(assignment) as (keyof Assignment)[]) {
      expect(parseAssignment(without(assignment, key)), key).toBeNull();
    }
    expect(bad({ id: 'short' })).toBeNull();
    expect(bad({ id: 'has spaces in it' })).toBeNull();
    expect(bad({ title: '   ' })).toBeNull();
    expect(bad({ title: 'x'.repeat(121) })).toBeNull();
    expect(bad({ note: 'x'.repeat(2001) })).toBeNull();
    expect(bad({ teacher: 'x'.repeat(81) })).toBeNull();
    expect(bad({ teacher: 7 })).toBeNull();
    expect(bad({ start: '2026-02-30' })).toBeNull();
    expect(bad({ start: '21 September' })).toBeNull();
    expect(bad({ due: '2026-09-20' })).toBeNull();
    // A year and a day at most, both ends counted.
    expect(bad({ due: '2027-09-22' })).toBeNull();
    expect(bad({ due: '2027-09-21' })).not.toBeNull();
    expect(bad({ createdAt: -1 })).toBeNull();
    expect(bad({ updatedAt: assignment.createdAt - 1 })).toBeNull();
    expect(bad({ updatedAt: 1.5e300 })).toBeNull();
    expect(bad({ tasks: {} })).toBeNull();
    expect(bad({ tasks: [null] })).toBeNull();
    expect(bad({ tasks: [assignment.tasks[1], assignment.tasks[1]] })).toBeNull();
    expect(bad({ tasks: [] })).not.toBeNull();
    const many = Array.from({ length: MAX_TASKS + 1 }, (_, i) => ({
      kind: 'lesson',
      id: `t${i}`,
      slug: 'staff',
    }));
    expect(bad({ tasks: many })).toBeNull();
    expect(bad({ tasks: many.slice(1) })).not.toBeNull();
    expect(parseAssignment(null)).toBeNull();
    expect(parseAssignment([assignment])).toBeNull();
  });

  it('refuses an assignment larger than a stored record may be', () => {
    const piece = assignment.tasks[0] as PieceTask;
    const long = (i: number): Task => ({
      ...piece,
      id: `t${i}`,
      piece: { ...piece.piece, title: '曲'.repeat(200), composer: '作'.repeat(200) },
    });
    const tasks = Array.from({ length: 24 }, (_, i) => long(i));
    expect(JSON.stringify(tasks).length).toBeLessThan(MAX_ASSIGNMENT_BYTES);
    // Under the limit in characters, over it in bytes.
    expect(parseAssignment({ ...assignment, tasks })).toBeNull();
    expect(parseAssignment({ ...assignment, tasks: tasks.slice(0, 12) })).not.toBeNull();
  });

  it('checks every field of every kind of task', () => {
    const [piece, scale, level, lesson, minutes] = assignment.tasks as [
      Task,
      Task,
      Task,
      Task,
      Task,
    ];
    const kept = (task: Task, patch: Record<string, unknown>) =>
      parseTask({ ...task, ...patch }, 0);
    const unknown = (task: Task, patch: Record<string, unknown>) =>
      expect(kept(task, patch)?.kind, JSON.stringify(patch)).toBe('unknown');
    for (const task of assignment.tasks) expect(parseTask(task, 0)).toEqual(task);

    unknown(piece, { hands: 'feet' });
    unknown(piece, { mode: 'karaoke' });
    unknown(piece, { tempo: 85 });
    unknown(piece, { tempo: 210 });
    unknown(piece, { runs: 0 });
    unknown(piece, { runs: 100 });
    unknown(piece, { bars: { from: 7, to: 4, fromLabel: '8', toLabel: '5' } });
    unknown(piece, { bars: { from: 4, to: 7 } });
    unknown(piece, { goal: { measure: 'inTime', percent: 49 } });
    unknown(piece, { goal: { measure: 'loud', percent: 90 } });
    // Notes are in time only in rhythm mode.
    unknown(piece, { mode: 'wait' });
    unknown(piece, { pass: { play: 12 } });
    unknown(piece, { piece: { id: 'x', title: 'X', composer: '', checksum: 'nothex!!' } });
    unknown(piece, { piece: { id: '', title: 'X', composer: '', checksum: 'b80fe0e1' } });
    expect(kept(piece, { bars: null, goal: undefined, mode: 'memory' })).toMatchObject({
      kind: 'piece',
      bars: null,
      mode: 'memory',
    });
    expect(kept(piece, { goal: undefined })).not.toHaveProperty('goal');

    unknown(scale, { exercise: 'major:H:2:both' });
    unknown(scale, { click: { bpm: 300, perBeat: 4 } });
    unknown(scale, { click: { bpm: 72, perBeat: 5 } });
    unknown(scale, { click: undefined });
    expect(kept(scale, { click: null })).toMatchObject({ kind: 'scale', click: null });

    unknown(level, { family: 'yodelling' });
    unknown(level, { level: 'I1' });
    unknown(level, { goal: 0 });
    unknown(level, { goal: 'soon' });
    expect(kept(level, { goal: 'mastery' })).toMatchObject({ goal: 'mastery' });
    expect(kept(level, { family: 'cadence', level: 'CA2' })).toMatchObject({ family: 'cadence' });
    // A tune played by ear (H5) is a level of its family, named by its id in the library.
    expect(kept(level, { family: 'tune', level: 'trad-amazing-grace', goal: 'mastery' })).toEqual({
      kind: 'level',
      id: level.id,
      family: 'tune',
      level: 'trad-amazing-grace',
      goal: 'mastery',
    });
    unknown(level, { family: 'tune', level: 'beethoven-fur-elise' });
    unknown(level, { family: 'echo', level: 'trad-amazing-grace' });

    unknown(lesson, { slug: 'a-lesson-not-written-yet' });
    unknown(minutes, { minutes: 0 });
    unknown(minutes, { minutes: 20.5 });
    unknown(minutes, { days: 400 });
  });

  it('keeps a task it cannot read as it came, for a version that can', () => {
    const duet = { kind: 'duet', id: 't7', with: 'teacher', bars: [1, 16] };
    const read = parseAssignment({ ...assignment, tasks: [duet, ...assignment.tasks] })!;
    expect(read.tasks[0]).toEqual({ kind: 'unknown', id: 't7', raw: duet });
    expect(read.tasks.slice(1)).toEqual(assignment.tasks);
    // Shared on, it travels as it is kept, and is read the same again.
    const data = encodeShare({ kind: 'assignment', assignment: read, pieces: [] })!;
    expect(decodeShare(data)).toEqual({
      ok: true,
      value: { kind: 'assignment', assignment: read, pieces: [] },
    });
    // A version that knows the kind reads the task itself out of what was kept.
    const lesson = assignment.tasks[3]!;
    expect(parseTask({ kind: 'unknown', id: 't4', raw: lesson }, 0)).toEqual(lesson);
    // Without an id of its own it is named by its place.
    expect(parseTask({ kind: 'duet' }, 4)).toEqual({
      kind: 'unknown',
      id: 'task-5',
      raw: { kind: 'duet' },
    });
  });

  it('refuses a task that is no task, or too much to keep', () => {
    expect(parseTask('lesson', 0)).toBeNull();
    expect(parseTask(['lesson'], 0)).toBeNull();
    expect(parseTask({ kind: 'duet', id: 't7', text: 'x'.repeat(2100) }, 0)).toBeNull();
    let deep: unknown = 'bottom';
    for (let i = 0; i < 12; i++) deep = { deeper: deep };
    expect(parseTask({ kind: 'duet', id: 't7', deep }, 0)).toBeNull();
    expect(
      parseAssignment({ ...assignment, tasks: [{ kind: 'duet', text: 'x'.repeat(2100) }] }),
    ).toBeNull();
  });

  it('knows a day the calendar has', () => {
    expect(isDay('2026-09-21')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(
      ['2026-02-29', '2026-13-01', '2026-9-21', '1969-12-31', 20260921, null].some(isDay),
    ).toBe(false);
  });
});

describe('reading a report', () => {
  const report = sampleReport(1);

  it('keeps a valid report as it is', () => {
    expect(parseReport(report)).toEqual(report);
    expect(parseReport({ ...report, extra: true })).toEqual(report);
  });

  it('refuses a missing, mistyped or out-of-bounds field', () => {
    for (const key of Object.keys(report) as (keyof typeof report)[]) {
      expect(parseReport(without(report, key)), key).toBeNull();
    }
    const bad = (patch: Record<string, unknown>) => parseReport({ ...report, ...patch });
    expect(bad({ assignmentId: 'no' })).toBeNull();
    expect(bad({ from: 'x'.repeat(81) })).toBeNull();
    expect(bad({ note: 'x'.repeat(2001) })).toBeNull();
    expect(bad({ due: '2026-09-01' })).toBeNull();
    // A week has seven days, a day 1,440 minutes.
    expect(bad({ days: [0, 0, 0, 0, 0, 0, 0, 10] })).toBeNull();
    expect(bad({ days: [10, 20, 30, 40, 50, 60, 70] })).not.toBeNull();
    expect(bad({ days: [1441] })).toBeNull();
    expect(bad({ days: [-1] })).toBeNull();
    expect(bad({ days: [12.5] })).toBeNull();
    expect(bad({ days: ['25'] })).toBeNull();
    expect(bad({ days: [] })).not.toBeNull();
    expect(bad({ tasks: [report.tasks[0], report.tasks[0]] })).toBeNull();
  });

  it('wants each task’s progress to be of its kind, and in bounds', () => {
    const [piece, scale, level, lesson] = report.tasks as [
      (typeof report.tasks)[number],
      (typeof report.tasks)[number],
      (typeof report.tasks)[number],
      (typeof report.tasks)[number],
    ];
    const withTask = (entry: unknown) => parseReport({ ...report, tasks: [entry] });
    const progress = (entry: (typeof report.tasks)[number], patch: Record<string, unknown>) =>
      withTask({ task: entry.task, progress: { ...entry.progress, ...patch } });
    expect(withTask(piece)).not.toBeNull();
    expect(withTask({ task: piece.task, progress: scale.progress })).toBeNull();
    expect(withTask({ task: piece.task })).toBeNull();
    expect(progress(piece, { done: -1 })).toBeNull();
    expect(progress(piece, { met: 'yes' })).toBeNull();
    expect(progress(piece, { played: 1 })).toBeNull();
    expect(progress(piece, { best: { at: 1, tempo: 80, right: 1.2, inTime: null } })).toBeNull();
    expect(progress(piece, { best: { at: 1, tempo: 85, right: 1, inTime: null } })).toBeNull();
    expect(progress(piece, { last: undefined })).toBeNull();
    expect(progress(piece, { best: null, last: null })).not.toBeNull();
    expect(progress(scale, { best: { at: 1, spread: -3, bpm: null } })).toBeNull();
    expect(progress(scale, { last: { at: 1, spread: null, bpm: 500 } })).toBeNull();
    expect(progress(level, { mastery: { counted: 50, window: 40, accuracy: 1 } })).toBeNull();
    expect(
      progress(level, { mastery: { counted: 12, window: 40, accuracy: 0.75 } }),
    ).not.toBeNull();
    expect(progress(level, { best: { at: 1, accuracy: 2 } })).toBeNull();
    // Only the fields of its kind are kept.
    const read = progress(lesson, { best: { at: 1 } })!;
    expect(read.tasks[0]!.progress).toEqual(lesson.progress);
  });

  it('has room for the report of any assignment that is one', () => {
    // The largest reports: as many tasks as an assignment may hold, each with every figure at
    // its longest, a year of days, and the longest note, name and title, all in three-byte
    // characters.
    const at = 8_640_000_000_000_000;
    const year = { start: '2026-01-01', due: '2027-01-01' };
    const words = { title: '题'.repeat(120), note: '注'.repeat(2000) };
    const piece = sampleAssignment(1).tasks[0] as PieceTask;
    const level = sampleAssignment(1).tasks[2]!;
    const run = { at, tempo: 200, right: 0.3333, inTime: 0.6667 };
    const shapes: [Task, TaskReport['progress']][] = [
      [
        { ...piece, bars: { from: 99_990, to: 99_999, fromLabel: '99990', toLabel: '99999' } },
        {
          kind: 'piece',
          done: 99_999,
          target: 99,
          met: false,
          played: 100_000,
          best: run,
          last: run,
        },
      ],
      [
        {
          ...piece,
          piece: { ...piece.piece, title: '曲'.repeat(200), composer: '作'.repeat(200) },
        },
        {
          kind: 'piece',
          done: 99_999,
          target: 99,
          met: false,
          played: 100_000,
          best: run,
          last: run,
        },
      ],
      [
        level,
        {
          kind: 'level',
          done: 99_999,
          target: 99,
          met: false,
          best: { at, accuracy: 0.3333 },
          last: { at, accuracy: 0.6667 },
          mastery: { counted: 999, window: 1000, accuracy: 0.3333 },
        },
      ],
    ];
    for (const [task, progress] of shapes) {
      // As many of the task as an assignment takes.
      let tasks: Task[] = [];
      for (let n = 1; n <= MAX_TASKS; n++) {
        const more = Array.from({ length: n }, (_, i) => ({ ...task, id: `task-${1000 + i}` }));
        if (!parseAssignment({ ...assignment, ...year, ...words, tasks: more })) break;
        tasks = more;
      }
      expect(tasks.length).toBeGreaterThan(10);
      const report = {
        ...sampleReport(1),
        ...year,
        ...words,
        from: '名'.repeat(80),
        tasks: tasks.map((t) => ({ task: t, progress })),
        days: Array.from({ length: 366 }, () => 1440),
      };
      expect(parseReport(report), `${tasks.length} tasks of kind ${task.kind}`).not.toBeNull();
    }
  });

  it('keeps how far a task it does not know got, and nothing else of it', () => {
    const entry = {
      task: { kind: 'duet', id: 't7', with: 'teacher' },
      progress: { kind: 'duet', done: 2, target: 3, met: false, takes: [1, 2] },
    };
    const read = parseReport({ ...report, tasks: [entry] })!;
    expect(read.tasks).toEqual([
      {
        task: { kind: 'unknown', id: 't7', raw: entry.task },
        progress: { kind: 'unknown', done: 2, target: 3, met: false },
      },
    ]);
  });
});

describe('the file', () => {
  const piece = samplePiece(1, { id: 'imported-1' });
  const carried: SharedPiece = {
    id: piece.id,
    title: piece.title,
    composer: piece.composer,
    fileName: piece.fileName,
    xml: piece.xml,
    hands: piece.hands,
    warnings: piece.warnings,
  };
  const imported: PieceTask = {
    ...(assignment.tasks[0] as PieceTask),
    id: 't9',
    piece: { id: piece.id, title: piece.title, composer: piece.composer, checksum: '0a0b0c0d' },
  };
  const withPiece = { ...assignment, tasks: [...assignment.tasks, imported] };
  const isBuiltIn = (id: string) => id === 'petzold-minuet-in-g';
  /** The pieces of a file, checked no further than their shape (the app's validator does more). */
  const pieceOf = (value: unknown) =>
    typeof value === 'object' && value !== null && 'xml' in value ? (value as SharedPiece) : null;

  it('carries the assignment and the imported pieces its tasks name', () => {
    expect(importedPieceTasks(assignment, isBuiltIn)).toEqual([]);
    expect(importedPieceTasks(withPiece, isBuiltIn)).toEqual([imported]);
    const { pieces, missing } = piecesToShare(withPiece, [samplePiece(2), piece], isBuiltIn);
    expect(pieces).toEqual([carried]);
    expect(missing).toEqual([]);
    const file: Shared = { kind: 'assignment', assignment: withPiece, pieces };
    const text = shareFileText(file);
    expect(JSON.parse(text)).toMatchObject({ format: 'dacapo-assignment', version: 1 });
    expect(parseShareFile(text, pieceOf)).toEqual({ ok: true, value: file });
  });

  it('finds a piece by its notes under another id, and says which are gone', () => {
    const renamed = {
      ...piece,
      id: 'on-this-device',
      facts: { checksum: '0a0b0c0d', bars: { right: 1, left: 0, both: 1 } },
    };
    expect(piecesToShare(withPiece, [renamed], isBuiltIn).pieces).toEqual([carried]);
    expect(piecesToShare(withPiece, [], isBuiltIn)).toEqual({ pieces: [], missing: [imported] });
  });

  it('carries a report, and nothing else', () => {
    const report = sampleReport(2);
    const text = shareFileText({ kind: 'report', report });
    expect(JSON.parse(text)).toMatchObject({ format: 'dacapo-report', version: 1 });
    expect(parseShareFile(text, pieceOf)).toEqual({ ok: true, value: { kind: 'report', report } });
  });

  it('is named after the title, as far as a file name can say it', () => {
    expect(shareFileName(shared)).toBe('week-1.dacapo-assignment.json');
    const named = (title: string) =>
      shareFileName({ kind: 'assignment', assignment: { ...assignment, title }, pieces: [] });
    expect(named('第 12 周 / 作业: 巴赫')).toBe('第-12-周-作业-巴赫.dacapo-assignment.json');
    expect(named('../../etc/passwd')).toBe('etc-passwd.dacapo-assignment.json');
    expect(named('?!')).toBe('assignment.dacapo-assignment.json');
    expect(named('x'.repeat(120))).toHaveLength(60 + '.dacapo-assignment.json'.length);
    expect(shareFileName({ kind: 'report', report: sampleReport(1) })).toBe(
      'week-1.dacapo-report.json',
    );
  });

  it('leaves out pieces no task names, and refuses one that is not a piece', () => {
    const file = {
      format: 'dacapo-assignment',
      version: 1,
      assignment: withPiece,
      pieces: [carried, { ...carried, id: 'stowaway' }],
    };
    const read = parseShareFile(JSON.stringify(file), pieceOf);
    expect(read.ok && read.value.kind === 'assignment' && read.value.pieces).toEqual([carried]);
    expect(parseShareFile(JSON.stringify({ ...file, pieces: [carried, 'x'] }), pieceOf)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(parseShareFile(JSON.stringify(without(file, 'pieces')), pieceOf)).toEqual({
      ok: false,
      error: 'invalid',
    });
    const crowd = Array.from({ length: MAX_FILE_PIECES + 1 }, () => carried);
    expect(parseShareFile(JSON.stringify({ ...file, pieces: crowd }), pieceOf)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('refuses another file, a later version and a damaged one', () => {
    const text = shareFileText(shared);
    const file = JSON.parse(text) as Record<string, unknown>;
    const read = (patch: Record<string, unknown>) =>
      parseShareFile(JSON.stringify({ ...file, ...patch }), pieceOf);
    expect(parseShareFile(text.slice(0, 40), pieceOf)).toEqual({ ok: false, error: 'malformed' });
    expect(parseShareFile('[]', pieceOf)).toEqual({ ok: false, error: 'malformed' });
    expect(read({ format: 'dacapo' })).toEqual({ ok: false, error: 'malformed' });
    expect(read({ version: 'one' })).toEqual({ ok: false, error: 'malformed' });
    expect(read({ version: 2 })).toEqual({ ok: false, error: 'newer' });
    expect(read({ assignment: { ...assignment, start: 'soon' } })).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(read({ format: 'dacapo-report' })).toEqual({ ok: false, error: 'invalid' });
  });
});

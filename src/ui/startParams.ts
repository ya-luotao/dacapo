import type { PracticeLink } from '../core/lessonLinks.ts';
import { isHandSelection, type PracticeMode } from '../core/pieceRecords.ts';
import type { ClickSettings } from '../core/scaleClick.ts';
import type { HandSelection } from '../core/score.ts';
import type { BarLoop } from '../core/wait.ts';

// A practice page opened with its settings (docs/ASSIGNMENTS.md, "The checklist": a task's button
// starts it as the task says). The settings ride after a `?` in the route (ui/hashRoute.ts):
//
//   #/pieces/<id>?bars=5-8&hands=left&mode=rhythm&tempo=80
//   #/scales?exercise=major:D:2:both&click=72x4      (click=off: at free tempo)
//   #/read?family=notes&level=L3    #/ear?family=interval&level=I2    #/harmony?family=chordSymbol&level=H2
//
// Each page reads them once, when it opens, in place of what it remembers; what it cannot use it
// leaves as it was. Nothing here is stored: the page's own choices are, when they are changed.

const query = (params: Record<string, string | null>): string => {
  const pairs = Object.entries(params).flatMap(([key, value]) =>
    value === null ? [] : [`${key}=${encodeURIComponent(value)}`],
  );
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
};

const MODES: readonly PracticeMode[] = ['wait', 'rhythm', 'memory'];

/** What a piece is opened with: each one given replaces the piece's own. */
export interface PieceStart {
  /** Written bars to loop, by their position in the score (the first bar is 1). */
  bars: { from: number; to: number } | null;
  hands: HandSelection | null;
  mode: PracticeMode | null;
  /** Percent of the score's tempo. */
  tempo: number | null;
}

/**
 * The route that opens piece `pieceId` with a task's bars, hands, mode and tempo, or with those
 * of a step of its plan (docs/PIECES.md, "A piece's plan"), which in wait mode names no tempo:
 * the piece then keeps its own.
 */
export function pieceStartPath(
  pieceId: string,
  start: { bars: BarLoop | null; hands: HandSelection; mode: PracticeMode; tempo: number | null },
): string {
  return `/pieces/${encodeURIComponent(pieceId)}${query({
    bars: start.bars ? `${start.bars.from + 1}-${start.bars.to + 1}` : null,
    hands: start.hands,
    mode: start.mode,
    tempo: start.tempo === null ? null : String(start.tempo),
  })}`;
}

/** The settings in a piece route's `?…`; null when it has none it can read. */
export function parsePieceStart(search: string): PieceStart | null {
  const params = new URLSearchParams(search);
  const bars = /^(\d{1,5})-(\d{1,5})$/.exec(params.get('bars') ?? '');
  const from = bars ? Number(bars[1]) : 0;
  const to = bars ? Number(bars[2]) : 0;
  const hands = params.get('hands');
  const mode = params.get('mode');
  const tempo = Number(params.get('tempo') ?? '');
  const start: PieceStart = {
    bars: from >= 1 && to >= from ? { from, to } : null,
    hands: isHandSelection(hands) ? hands : null,
    mode: MODES.find((m) => m === mode) ?? null,
    tempo: Number.isInteger(tempo) && tempo > 0 ? tempo : null,
  };
  return start.bars || start.hands || start.mode || start.tempo ? start : null;
}

/** The loop a start asks for, as written measure indexes; null when the score has no such bars. */
export function startLoop(start: PieceStart | null | undefined, measures: number): BarLoop | null {
  if (!start?.bars || start.bars.to > measures) return null;
  return { from: start.bars.from - 1, to: start.bars.to - 1 };
}

/** What the Scales page is opened with: the exercise, and the click (null: as remembered). */
export interface ScaleStart {
  /** An `exerciseKey`, as given: the page checks it. */
  exercise: string;
  click: ClickSettings | 'off' | null;
}

/** The route that opens the Scales page on a task's exercise, free or with its click. */
export function scaleStartPath(start: { exercise: string; click: ClickSettings | null }): string {
  return `/scales${query({
    exercise: start.exercise,
    click: start.click ? `${start.click.bpm}x${start.click.perBeat}` : 'off',
  })}`;
}

export function parseScaleStart(search: string): ScaleStart | null {
  const params = new URLSearchParams(search);
  const exercise = params.get('exercise');
  if (!exercise) return null;
  const click = /^(\d{2,3})x(\d)$/.exec(params.get('click') ?? '');
  return {
    exercise,
    click: click
      ? { bpm: Number(click[1]), perBeat: Number(click[2]) as ClickSettings['perBeat'] }
      : params.get('click') === 'off'
        ? 'off'
        : null,
  };
}

/** What Read, Ear or Harmony is opened on: a family and a level, as given (the page checks). */
export interface LevelStart {
  family: string;
  level: string;
  /**
   * Items of the level to practise alone ("Practise these", docs/ADVICE.md), as given: the page
   * keeps those the level has, and opens on the level as usual when none is.
   */
  items?: string[];
}

/** The items of a start are joined by this: no item has one. */
const ITEM_SEPARATOR = ',';
/** More items than a session of them would ever have are not read. */
const MAX_START_ITEMS = 50;

/** The route that opens `page` on a level of a family, with `items` on a session of those. */
export function levelStartPath(page: 'read' | 'ear' | 'harmony', start: LevelStart): string {
  return `/${page}${query({
    family: start.family,
    level: start.level,
    items: start.items && start.items.length > 0 ? start.items.join(ITEM_SEPARATOR) : null,
  })}`;
}

export function parseLevelStart(search: string): LevelStart | null {
  const params = new URLSearchParams(search);
  const family = params.get('family');
  const level = params.get('level');
  if (!family || !level) return null;
  const items = (params.get('items') ?? '')
    .split(ITEM_SEPARATOR)
    .filter((item) => item.length > 0)
    .slice(0, MAX_START_ITEMS);
  return items.length > 0 ? { family, level, items } : { family, level };
}

/** The route of a piece's page, opened as it was left. */
export function piecePath(pieceId: string): string {
  return `/pieces/${encodeURIComponent(pieceId)}`;
}

/**
 * The route one of a lesson's links opens (docs/LEARN.md, "Practise it goes to the thing
 * itself"): a page as it is, or a practice with its settings as a task's button opens it — a
 * level of its family, a scale at free tempo, a piece as it was left.
 */
export function practiceLinkPath(link: PracticeLink): string {
  switch (link.kind) {
    case 'page':
      return `/${link.page}`;
    case 'level':
      return levelStartPath(link.page, link);
    case 'scale':
      return scaleStartPath({ exercise: link.exercise, click: null });
    case 'piece':
      return piecePath(link.id);
  }
}

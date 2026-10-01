import { describe, expect, it } from 'vitest';
import { appUrl, PUBLIC_URL } from '../lib/links.ts';
import { earStart } from './ear/start.ts';
import { splitRoute } from './hashRoute.ts';
import { readPiecePrefs, withStart } from './pieces/prefs.ts';
import { readStart } from './read/start.ts';
import { DEFAULT_CLICK, startChoices } from './scales/prefs.ts';
import {
  levelStartPath,
  parseLevelStart,
  parsePieceStart,
  parseScaleStart,
  pieceStartPath,
  scaleStartPath,
  startLoop,
} from './startParams.ts';

/** What a page reads of a start path: its route, and the settings after the `?`. */
const opened = (path: string) => splitRoute(path);

describe('a route with settings', () => {
  it('is the route before the ?, the settings after it', () => {
    expect(splitRoute('/pieces/abc?bars=5-8&hands=left')).toEqual({
      path: '/pieces/abc',
      search: 'bars=5-8&hands=left',
    });
    expect(splitRoute('/pieces/abc')).toEqual({ path: '/pieces/abc', search: '' });
    expect(splitRoute('/read?')).toEqual({ path: '/read', search: '' });
    expect(splitRoute('/a?b=1?c=2')).toEqual({ path: '/a', search: 'b=1?c=2' });
  });

  it('is made with the address the page has on the web, the published one elsewhere', () => {
    const local = { protocol: 'http:', origin: 'http://localhost:5342', pathname: '/' };
    expect(appUrl(local)).toBe('http://localhost:5342/');
    const fork = { protocol: 'https:', origin: 'https://example.org', pathname: '/dacapo/' };
    expect(appUrl(fork)).toBe('https://example.org/dacapo/');
    // In the Apple app the page is served from its own scheme, which opens nowhere else.
    expect(appUrl({ protocol: 'dacapo:', origin: 'null', pathname: '/' })).toBe(PUBLIC_URL);
    expect(PUBLIC_URL).toBe('https://playdacapo.com/');
  });
});

describe('opening a piece with settings', () => {
  it('names its bars by their place in the score, with hands, mode and tempo', () => {
    const path = pieceStartPath('petzold-minuet-in-g', {
      bars: { from: 4, to: 7 },
      hands: 'left',
      mode: 'rhythm',
      tempo: 80,
    });
    expect(path).toBe('/pieces/petzold-minuet-in-g?bars=5-8&hands=left&mode=rhythm&tempo=80');
    const start = parsePieceStart(opened(path).search);
    expect(start).toEqual({ bars: { from: 5, to: 8 }, hands: 'left', mode: 'rhythm', tempo: 80 });
    expect(startLoop(start, 32)).toEqual({ from: 4, to: 7 });
    // A score with fewer bars has no such loop.
    expect(startLoop(start, 7)).toBeNull();
    expect(startLoop(null, 32)).toBeNull();
  });

  it('opens the whole piece without bars, and an id with odd characters', () => {
    const path = pieceStartPath('a b/c', { bars: null, hands: 'both', mode: 'memory', tempo: 100 });
    expect(path).toBe('/pieces/a%20b%2Fc?hands=both&mode=memory&tempo=100');
    expect(parsePieceStart(opened(path).search)).toEqual({
      bars: null,
      hands: 'both',
      mode: 'memory',
      tempo: 100,
    });
  });

  it('takes what it can read and leaves the rest', () => {
    expect(parsePieceStart('')).toBeNull();
    expect(parsePieceStart('utm=x')).toBeNull();
    expect(parsePieceStart('bars=8-5&hands=feet&mode=fast&tempo=x')).toBeNull();
    expect(parsePieceStart('bars=0-3')).toBeNull();
    expect(parsePieceStart('bars=3-3&tempo=85')).toEqual({
      bars: { from: 3, to: 3 },
      hands: null,
      mode: null,
      tempo: 85,
    });
  });

  it('replaces the piece’s own settings where it can take them, and stores nothing', () => {
    const own = readPiecePrefs('some-piece');
    const start = parsePieceStart('hands=left&mode=memory&tempo=80');
    expect(withStart(own, start)).toEqual({ ...own, hands: 'left', mode: 'memory', tempo: 80 });
    // A task starts in the written key, with the left hand the piece has.
    const moved = { ...own, transpose: 3, leftHand: 'alberti' as const };
    expect(withStart(moved, start)).toMatchObject({ transpose: 0, leftHand: 'alberti' });
    expect(withStart(moved, null)).toBe(moved);
    // A tempo the page does not offer is left out.
    expect(withStart(own, parsePieceStart('tempo=85'))).toEqual(own);
    expect(withStart(own, null)).toBe(own);
    expect(readPiecePrefs('some-piece')).toEqual(own);
  });
});

describe('opening the Scales page with an exercise', () => {
  it('names the exercise and its click', () => {
    const path = scaleStartPath({ exercise: 'major:F#:2:both', click: { bpm: 72, perBeat: 4 } });
    expect(path).toBe('/scales?exercise=major%3AF%23%3A2%3Aboth&click=72x4');
    const start = parseScaleStart(opened(path).search);
    expect(start).toEqual({ exercise: 'major:F#:2:both', click: { bpm: 72, perBeat: 4 } });
    expect(startChoices(start)).toEqual({
      exercise: { type: 'major', tonic: 'F#', octaves: 2, hands: 'both' },
      click: { on: true, bpm: 72, perBeat: 4 },
    });
  });

  it('opens at free tempo, or with the click as remembered', () => {
    const free = scaleStartPath({ exercise: 'hanon:C:2:both:3', click: null });
    expect(free).toBe('/scales?exercise=hanon%3AC%3A2%3Aboth%3A3&click=off');
    expect(startChoices(parseScaleStart(opened(free).search))!.click).toEqual({
      ...DEFAULT_CLICK,
      on: false,
    });
    expect(startChoices(parseScaleStart('exercise=major:C:1:right'))!.click).toEqual(DEFAULT_CLICK);
    // An exercise with a rhythm of its own keeps the notes to the beat remembered.
    expect(startChoices(parseScaleStart('exercise=hanon:C:2:both:3&click=96x8'))!.click).toEqual({
      on: true,
      bpm: 96,
      perBeat: DEFAULT_CLICK.perBeat,
    });
  });

  it('leaves the page as it was for an exercise that is not one, or a tempo out of range', () => {
    expect(parseScaleStart('click=72x4')).toBeNull();
    expect(startChoices(parseScaleStart('exercise=major:H:9:feet'))).toBeNull();
    expect(startChoices(null)).toBeNull();
    expect(startChoices(parseScaleStart('exercise=major:C:1:right&click=999x4'))!.click).toEqual(
      DEFAULT_CLICK,
    );
  });
});

describe('opening Read, Ear or Harmony on a level', () => {
  it('names the family and the level', () => {
    expect(levelStartPath('read', { family: 'notes', level: 'L3' })).toBe(
      '/read?family=notes&level=L3',
    );
    expect(parseLevelStart('family=notes&level=L3')).toEqual({ family: 'notes', level: 'L3' });
    expect(parseLevelStart('family=notes')).toBeNull();
    expect(parseLevelStart('')).toBeNull();
  });

  it('Read takes its own families and levels', () => {
    const start = (family: string, level: string) => readStart({ family, level });
    expect(start('notes', 'L3')).toEqual({ choice: 'notes', level: 'L3' });
    expect(start('rhythm', 'R4')).toEqual({ choice: 'rhythm', level: 'R4' });
    expect(start('sight', 'F2')).toEqual({ choice: 'sight', level: 'F2' });
    expect(start('keySignature', 'KS2')).toEqual({
      choice: 'theory',
      family: 'keySignature',
      level: 'KS2',
    });
    // A level of another family, a family of another page, nothing at all.
    expect(start('keySignature', 'RI1')).toBeNull();
    expect(start('notes', 'L9')).toBeNull();
    expect(start('interval', 'I1')).toBeNull();
    expect(readStart(null)).toBeNull();
  });

  it('Ear takes its own families and levels', () => {
    const start = (family: string, level: string) => earStart({ family, level });
    expect(start('interval', 'I2')).toEqual({ family: 'interval', level: 'I2' });
    expect(start('cadence', 'CA1')).toEqual({ family: 'cadence', level: 'CA1' });
    expect(start('rhythmEar', 'R2')).toEqual({ family: 'rhythmEar', level: 'R2' });
    expect(start('interval', 'C1')).toBeNull();
    expect(start('notes', 'L1')).toBeNull();
    expect(earStart(null)).toBeNull();
  });
});

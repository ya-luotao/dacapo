import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetPiecePrefs,
  HANDS_PREF,
  parsePiecePrefs,
  readPiecePrefs,
  writePiecePrefs,
} from './prefs.ts';

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('per-piece preferences', () => {
  it('remember the hands, the tempo and the mode of each piece', () => {
    writePiecePrefs('minuet', { hands: 'left' });
    writePiecePrefs('minuet', { tempo: 70, mode: 'rhythm' });
    writePiecePrefs('ode', { tempo: 50 });
    writePiecePrefs('minuet', { melody: 'top' });
    expect(readPiecePrefs('minuet')).toEqual({
      hands: 'left',
      tempo: 70,
      mode: 'rhythm',
      melody: 'top',
    });
    // A piece not practised yet starts with the hands chosen last anywhere, at 100 %, waiting,
    // the melody on top of the right hand.
    expect(readPiecePrefs('prelude')).toEqual({
      hands: 'left',
      tempo: 100,
      mode: 'wait',
      melody: 'right',
    });
    expect(readPiecePrefs('ode')).toEqual({
      hands: 'left',
      tempo: 50,
      mode: 'wait',
      melody: 'right',
    });
    writePiecePrefs('ode', { hands: 'both' });
    expect(readPiecePrefs('minuet').hands).toBe('left');
    expect(localStorage.getItem(HANDS_PREF)).toBe('both');
  });

  it('are forgotten with their piece', () => {
    writePiecePrefs('p1', { tempo: 60 });
    forgetPiecePrefs('p1');
    expect(readPiecePrefs('p1').tempo).toBe(100);
  });

  it('ignore anything unreadable', () => {
    expect(parsePiecePrefs('not json')).toEqual({});
    expect(parsePiecePrefs('[1]')).toEqual({});
    expect(
      parsePiecePrefs(
        JSON.stringify({
          a: { hands: 'feet', tempo: 55, mode: 'jazz', melody: 'alto' },
          b: 3,
          c: { hands: 'right', tempo: 80, mode: 'rhythm' },
        }),
      ),
    ).toEqual({ c: { hands: 'right', tempo: 80, mode: 'rhythm' } });
  });

  it('fall back to defaults without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    writePiecePrefs('x', { hands: 'both' });
    expect(readPiecePrefs('x')).toEqual({
      hands: 'right',
      tempo: 100,
      mode: 'wait',
      melody: 'right',
    });
  });
});

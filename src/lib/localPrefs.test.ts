import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPref, writePref } from './localPrefs.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('localPrefs', () => {
  it('round-trips and removes values', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    writePref('k', 'v');
    expect(readPref('k')).toBe('v');
    writePref('k', null);
    expect(readPref('k')).toBeNull();
  });

  it('never throws when storage throws', () => {
    const fail = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail, removeItem: fail });
    expect(readPref('k')).toBeNull();
    expect(() => writePref('k', 'v')).not.toThrow();
    expect(() => writePref('k', null)).not.toThrow();
  });

  it('never throws when accessing localStorage itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    try {
      expect(readPref('k')).toBeNull();
      expect(() => writePref('k', 'v')).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

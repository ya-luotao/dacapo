// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/metronomeSettings.ts';
import { createAppMetronome, readMetronomeSettings, writeMetronomeSettings } from './prefs.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('metronome settings in this browser', () => {
  it('are kept as they change and read back by the next page load', () => {
    const { metronome } = createAppMetronome();
    metronome.setBpm(132);
    metronome.update({ meter: { numerator: 6, denominator: 8 }, sound: 'beep', silent: true });
    const next = createAppMetronome().metronome.getSnapshot().settings;
    expect(next).toMatchObject({
      bpm: 132,
      meter: { numerator: 6, denominator: 8 },
      accents: ['accent', 'normal'],
      sound: 'beep',
      silent: true,
    });
  });

  it('fall back to the defaults when what is stored cannot be read', () => {
    localStorage.setItem('dacapo.metronome', '{"bpm": "fast"');
    expect(readMetronomeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('never break the metronome when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => writeMetronomeSettings(DEFAULT_SETTINGS)).not.toThrow();
    const { metronome } = createAppMetronome();
    expect(() => metronome.setBpm(90)).not.toThrow();
    expect(metronome.getSnapshot().settings.bpm).toBe(90);
  });
});

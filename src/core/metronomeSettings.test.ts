import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  meterBeats,
  METERS,
  nextAccent,
  parseMeter,
  parseSettings,
  pulseConfig,
  resizeAccents,
  tempoForMeter,
  type MetronomeSettings,
} from './metronomeSettings.ts';
import { TEMPO_FROM, TEMPO_NAMES, tempoName, tempoRange } from './tempoNames.ts';

describe('meters', () => {
  it('clicks the dotted beat in compound meters', () => {
    expect(meterBeats({ numerator: 4, denominator: 4 })).toEqual({ beats: 4, unit: 1 });
    expect(meterBeats({ numerator: 6, denominator: 8 })).toEqual({ beats: 2, unit: 1.5 });
    expect(meterBeats({ numerator: 12, denominator: 8 })).toEqual({ beats: 4, unit: 1.5 });
    expect(meterBeats({ numerator: 3, denominator: 8 })).toEqual({ beats: 3, unit: 0.5 });
    expect(meterBeats({ numerator: 7, denominator: 8 })).toEqual({ beats: 7, unit: 0.5 });
    expect(meterBeats({ numerator: 2, denominator: 2 })).toEqual({ beats: 2, unit: 2 });
  });

  it('reads every meter it offers', () => {
    for (const text of METERS) expect(parseMeter(text), text).not.toBeNull();
    expect(parseMeter('4/5')).toBeNull();
    expect(parseMeter('0/4')).toBeNull();
    expect(parseMeter('13/8')).toBeNull();
  });

  it('turns a piece’s ♩ tempo into the meter’s beat', () => {
    expect(tempoForMeter(120, { numerator: 6, denominator: 8 })).toBe(80);
    expect(tempoForMeter(90, { numerator: 3, denominator: 8 })).toBe(180);
    expect(tempoForMeter(100, { numerator: 2, denominator: 2 })).toBe(50);
    expect(tempoForMeter(200, { numerator: 7, denominator: 8 })).toBe(300);
  });
});

describe('accents', () => {
  it('cycles normal → accent → mute', () => {
    expect(nextAccent('normal')).toBe('accent');
    expect(nextAccent('accent')).toBe('mute');
    expect(nextAccent('mute')).toBe('normal');
  });

  it('keeps the pattern of the beats that remain', () => {
    expect(resizeAccents(['accent', 'mute', 'normal'], 5)).toEqual([
      'accent',
      'mute',
      'normal',
      'normal',
      'normal',
    ]);
    expect(resizeAccents(['accent', 'mute', 'normal'], 2)).toEqual(['accent', 'mute']);
  });

  it('feeds the timeline one accent per beat', () => {
    const settings: MetronomeSettings = {
      ...DEFAULT_SETTINGS,
      meter: { numerator: 6, denominator: 8 },
      accents: ['accent', 'normal', 'mute', 'mute'],
      trainer: { ...DEFAULT_SETTINGS.trainer, kind: 'gap' },
    };
    expect(pulseConfig(settings)).toEqual({
      bpm: 80,
      beats: 2,
      subdivision: 1,
      accents: ['accent', 'normal'],
      trainer: { kind: 'gap', play: 3, mute: 1 },
    });
  });
});

describe('stored settings', () => {
  it('come back as they were saved', () => {
    const settings: MetronomeSettings = {
      bpm: 132,
      meter: { numerator: 7, denominator: 8 },
      accents: ['accent', 'normal', 'accent', 'normal', 'accent', 'normal', 'mute'],
      subdivision: 3,
      sound: 'beep',
      volume: 35,
      silent: true,
      trainer: { kind: 'ramp', from: 80, to: 140, step: 5, every: 2, play: 4, mute: 2 },
    };
    expect(parseSettings(JSON.stringify(settings))).toEqual(settings);
  });

  it('fall back to the defaults for anything missing, broken or out of range', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"text"')).toEqual(DEFAULT_SETTINGS);
    const odd = parseSettings(
      JSON.stringify({
        bpm: 400,
        meter: { numerator: 5, denominator: 3 },
        accents: ['loud', 'mute'],
        subdivision: 5,
        sound: 'cowbell',
        volume: -1,
        silent: 'yes',
        trainer: { kind: 'swing', from: 10, to: 120, step: 0, every: 2.5, play: 9, mute: 1 },
      }),
    );
    expect(odd).toEqual({
      ...DEFAULT_SETTINGS,
      accents: ['normal', 'mute', 'normal', 'normal'],
      trainer: { ...DEFAULT_SETTINGS.trainer, to: 120, mute: 1 },
    });
  });

  it('fit the accents to the meter read back', () => {
    const settings = parseSettings(
      JSON.stringify({ meter: { numerator: 3, denominator: 4 }, accents: ['accent'] }),
    );
    expect(settings.accents).toEqual(['accent', 'normal', 'normal']);
  });
});

describe('tempo names', () => {
  it('cover the whole range, each mark starting where the one before ends', () => {
    expect(tempoName(20)).toBe('grave');
    expect(tempoName(39)).toBe('grave');
    expect(tempoName(40)).toBe('largo');
    expect(tempoName(119)).toBe('moderato');
    expect(tempoName(120)).toBe('allegro');
    expect(tempoName(300)).toBe('prestissimo');
    for (let i = 1; i < TEMPO_NAMES.length; i++) {
      expect(tempoRange(TEMPO_NAMES[i - 1]!).to! + 1).toBe(TEMPO_FROM[TEMPO_NAMES[i]!]);
    }
    expect(tempoRange('prestissimo')).toEqual({ from: 200, to: null });
  });
});

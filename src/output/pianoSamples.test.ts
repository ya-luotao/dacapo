import { describe, expect, it } from 'vitest';
import {
  createSampleBank,
  layerOrder,
  onsetOf,
  sampleIndex,
  sampleUrl,
  velocityGain,
  type SampleBuffer,
} from './pianoSamples.ts';
import { PIANO_LAYERS, PIANO_SAMPLES } from './pianoTable.ts';
import { fakeSampleBuffer } from './testing.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('piano samples', () => {
  it('are every minor third from A0 to C8', () => {
    expect(PIANO_SAMPLES.map((s) => s.key)).toEqual(
      Array.from({ length: 30 }, (_, i) => 21 + 3 * i),
    );
  });

  it('are all in public/piano/, and nothing else is', () => {
    const files = PIANO_LAYERS.flatMap((_, layer) =>
      PIANO_SAMPLES.map((_, i) => sampleUrl('', i, layer).slice('piano/'.length)),
    );
    const shipped = Object.keys(import.meta.glob('../../public/piano/*')).map((path) =>
      path.slice('../../public/piano/'.length),
    );
    expect(shipped.sort()).toEqual(files.sort());
  });

  it('a key plays the nearest sample, as the SFZ maps them', () => {
    expect([21, 22, 23, 24, 25, 26].map(sampleIndex)).toEqual([0, 0, 1, 1, 1, 2]);
    expect(sampleIndex(60)).toBe(13);
    expect(PIANO_SAMPLES[13]!.name).toBe('C4');
    expect(sampleIndex(107)).toBe(29);
    expect(sampleIndex(108)).toBe(29);
  });

  it('a velocity tries the nearest layer first', () => {
    expect(layerOrder(30)).toEqual([0, 1, 2]);
    expect(layerOrder(72)).toEqual([1, 2, 0]);
    expect(layerOrder(58)).toEqual([1, 0, 2]);
    expect(layerOrder(96)).toEqual([2, 1, 0]);
    expect(layerOrder(127)).toEqual([2, 1, 0]);
  });

  it('gets louder with velocity, and the layers join up', () => {
    const [p, mf, f] = PIANO_LAYERS.map((l) => l.velocity);
    expect(velocityGain(mf!, mf!)).toBeLessThan(1);
    expect(velocityGain(127, f!)).toBeCloseTo(127 / f!);
    // A velocity sounds as loud from either neighbouring layer (they were recorded in proportion).
    expect(velocityGain(54, p!) * p!).toBeCloseTo(velocityGain(54, mf!) * mf!);
    expect(velocityGain(1, p!)).toBeGreaterThan(0);
  });

  it('finds where the note starts, 1 ms before its first sound', () => {
    expect(onsetOf(fakeSampleBuffer(2, 0.03))).toBeCloseTo(0.029);
    expect(onsetOf(fakeSampleBuffer(2, 0))).toBe(0);
    // Silent (or quieter than −66 dB) for the first quarter second: taken as it is.
    expect(onsetOf(fakeSampleBuffer(2, 0.5))).toBe(0);
  });
});

function fakeFiles(failing = new Set<string>()) {
  const fetched: string[] = [];
  const decoded: SampleBuffer[] = [];
  const bank = createSampleBank({
    base: '/dacapo/',
    fetch: (url) => {
      fetched.push(url);
      const ok = !failing.has(url);
      return Promise.resolve({ ok, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    },
    decode: () => {
      const buffer = fakeSampleBuffer(1, 0.01);
      decoded.push(buffer);
      return Promise.resolve(buffer);
    },
  });
  return { bank, fetched, decoded };
}

describe('sample bank', () => {
  it('loads nothing until asked, then every file, the middle layer first', async () => {
    const { bank, fetched } = fakeFiles();
    const changes: string[] = [];
    bank.subscribe(() => changes.push(bank.getStatus()));
    expect(bank.pick(60, 72)).toBeNull();
    expect(fetched).toEqual([]);
    bank.load();
    bank.load();
    expect(bank.getStatus()).toBe('loading');
    await flush();
    expect(fetched).toHaveLength(90);
    expect(new Set(fetched).size).toBe(90);
    expect(fetched[0]).toBe('/dacapo/piano/A0-mf.mp3');
    expect(fetched.slice(0, 30).every((url) => url.endsWith('-mf.mp3'))).toBe(true);
    expect(fetched.slice(30, 60).every((url) => url.endsWith('-f.mp3'))).toBe(true);
    expect(changes).toEqual(['loading', 'ready']);
  });

  it('picks the sample with its onset, the rate for the key and its retuning, and the gain', async () => {
    const { bank, decoded } = fakeFiles();
    bank.load();
    await flush();
    const c4 = bank.pick(60, 68)!;
    expect(decoded).toContain(c4.sample.buffer);
    expect(c4.sample.offset).toBeCloseTo(0.009);
    // C4's sample is retuned 6 cents down.
    expect(c4.rate).toBeCloseTo(2 ** (-6 / 1200));
    expect(c4.gain).toBeCloseTo(velocityGain(68, 68));
    // D4 is a semitone below D♯4's sample, which is retuned 3 cents down.
    expect(bank.pick(62, 68)!.rate).toBeCloseTo(2 ** (-103 / 1200));
  });

  it('plays another layer of the key while the nearest is missing, and can try again', async () => {
    const soft = new Set(['/dacapo/piano/C4-p.mp3']);
    const { bank, fetched } = fakeFiles(soft);
    bank.load();
    await flush();
    expect(bank.getStatus()).toBe('failed');
    const pick = bank.pick(60, 30)!;
    expect(pick.gain).toBeCloseTo(velocityGain(30, 68));
    soft.clear();
    bank.load();
    await flush();
    expect(bank.getStatus()).toBe('ready');
    // Only the missing file was fetched again.
    expect(fetched.slice(90)).toEqual(['/dacapo/piano/C4-p.mp3']);
    expect(bank.pick(60, 30)!.gain).toBeCloseTo(velocityGain(30, 40));
  });

  it('fails at once where the browser cannot decode audio', () => {
    const bank = createSampleBank({
      base: '/',
      decode: null,
      fetch: () => Promise.reject(new Error()),
    });
    bank.load();
    expect(bank.getStatus()).toBe('failed');
  });
});

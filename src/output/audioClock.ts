// Two clocks: key presses and MIDI output run on performance.now(), the click on the
// AudioContext's own clock. This maps one to the other.
//
// `getOutputTimestamp()` pairs a context time with the performance.now() time at which the
// sample it names reaches the output, so the output latency is in the pair already. Where it is
// missing (or returns zeros before the context runs), `currentTime` stands in, pushed later by
// `baseLatency` and `outputLatency` where the browser reports them. Whatever is left over (the
// sound card, the speakers, Bluetooth) is the calibration's job.

export interface AudioClockSource {
  currentTime: number;
  baseLatency?: number;
  outputLatency?: number;
  getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number };
}

/** performance.now() ms minus context seconds × 1000, as the context reports it now. */
export function clockOffset(source: AudioClockSource, now: number): number {
  return reading(source, now).offset;
}

/** The offset, and whether it comes from an output timestamp (rather than the estimate). */
function reading(source: AudioClockSource, now: number): { offset: number; stamped: boolean } {
  const stamp = source.getOutputTimestamp?.();
  if (stamp && stamp.performanceTime && stamp.contextTime !== undefined && stamp.contextTime > 0)
    return { offset: stamp.performanceTime - stamp.contextTime * 1000, stamped: true };
  const latency = (source.baseLatency ?? 0) + (source.outputLatency ?? 0);
  return { offset: now - source.currentTime * 1000 + latency * 1000, stamped: false };
}

/** Offsets remembered to smooth out the jitter of a single reading (one render quantum). */
const SAMPLES = 15;

export interface AudioClock {
  /** Takes a reading; call it before converting. */
  sample: (now: number) => void;
  /**
   * The mapping can be trusted: the context gives output timestamps (a context that has only just
   * started gives zeros for a moment), or it has none to give.
   */
  ready: () => boolean;
  /** Context seconds at which a sound is heard at performance.now() time `ms`. */
  toContext: (ms: number) => number;
  /** performance.now() ms at which context time `seconds` is heard. */
  toPerformance: (seconds: number) => number;
}

/**
 * The median of the latest readings: the clocks drift slowly, a reading jitters. Once output
 * timestamps come, the estimates taken before them are dropped.
 */
export function createAudioClock(source: AudioClockSource): AudioClock {
  const readings: number[] = [];
  let stamped = false;
  let offset = 0;
  return {
    ready: () => stamped || !source.getOutputTimestamp,
    sample(now) {
      const next = reading(source, now);
      if (next.stamped && !stamped) readings.length = 0;
      stamped ||= next.stamped;
      if (stamped && !next.stamped) return;
      readings.push(next.offset);
      if (readings.length > SAMPLES) readings.shift();
      const sorted = [...readings].sort((a, b) => a - b);
      offset = sorted[sorted.length >> 1]!;
    },
    toContext: (ms) => (ms - offset) / 1000,
    toPerformance: (seconds) => seconds * 1000 + offset,
  };
}

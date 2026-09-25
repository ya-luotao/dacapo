import { parseSettings, type MetronomeSettings } from '../../core/metronomeSettings.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { audioContext } from '../../output/audio.ts';
import { createMetronome } from '../../output/metronome.ts';
import { browserClock } from '../../output/scheduler.ts';
import { readLatency } from '../pieces/rhythmPrefs.ts';
import { createOfferStore, type MetronomeHandle } from './context.ts';

// The metronome's settings are kept in this browser, like rhythm mode's click; they are not part
// of the export.
const METRONOME_PREF = 'dacapo.metronome';

export function readMetronomeSettings(): MetronomeSettings {
  return parseSettings(readPref(METRONOME_PREF));
}

export function writeMetronomeSettings(settings: MetronomeSettings): void {
  writePref(METRONOME_PREF, JSON.stringify(settings));
}

export function createAppMetronome(): MetronomeHandle {
  const metronome = createMetronome({
    clock: browserClock,
    context: audioContext,
    settings: readMetronomeSettings(),
    save: writeMetronomeSettings,
    // Only a late arrival says something about the sound's path; playing early is a habit.
    delay: () => Math.max(0, readLatency()?.offset ?? 0),
    page: typeof document === 'undefined' ? null : { document, window },
  });
  return { metronome, offers: createOfferStore() };
}

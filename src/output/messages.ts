// Complete channel messages only: Chromium rejects running status and partial messages, and we
// never send system or real-time messages (Active Sensing would make the instrument expect more).

export type MidiBytes = [number, number, number];

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
export const CC_SUSTAIN = 64;
export const CC_ALL_SOUND_OFF = 120;
export const CC_ALL_NOTES_OFF = 123;

const clamp7 = (n: number) => Math.max(0, Math.min(127, Math.round(n)));

export function noteOn(channel: number, midi: number, velocity: number): MidiBytes {
  return [NOTE_ON | (channel & 0x0f), clamp7(midi), Math.max(1, clamp7(velocity))];
}

export function noteOff(channel: number, midi: number): MidiBytes {
  return [NOTE_OFF | (channel & 0x0f), clamp7(midi), 64];
}

export function controlChange(channel: number, controller: number, value: number): MidiBytes {
  return [CONTROL_CHANGE | (channel & 0x0f), clamp7(controller), clamp7(value)];
}

/** Sustain up, all notes off and all sound off, on every channel. */
export function resetAllChannels(): MidiBytes[] {
  const out: MidiBytes[] = [];
  for (let channel = 0; channel < 16; channel++) {
    out.push(controlChange(channel, CC_SUSTAIN, 0));
    out.push(controlChange(channel, CC_ALL_NOTES_OFF, 0));
    out.push(controlChange(channel, CC_ALL_SOUND_OFF, 0));
  }
  return out;
}

/** Only channel voice messages leave the app. */
export function isChannelMessage(data: readonly number[]): boolean {
  return data.length === 3 && data[0]! >= 0x80 && data[0]! < 0xf0;
}

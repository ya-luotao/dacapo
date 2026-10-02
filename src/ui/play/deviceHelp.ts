import type { MessageKey } from '../../i18n/index.ts';
import type { MidiStatus } from '../../input/index.ts';

const HELP: Partial<Record<MidiStatus['state'], MessageKey>> = {
  unsupported: 'midi.help.unsupported',
  'no-permission': 'midi.help.noPermission',
  'no-device': 'midi.help.noDevice',
};

/**
 * What to do about a MIDI status, as a message; null when connected or still looking. Where
 * there is no MIDI at all the help names what plays for now: the computer keys, or on a device
 * played by touch alone (`touch`, ui/input/touchOnly.ts), which has none, the keys on the screen.
 */
export function deviceHelp(state: MidiStatus['state'], touch: boolean): MessageKey | null {
  if (touch && state === 'unsupported') return 'midi.help.unsupported.touch';
  return HELP[state] ?? null;
}

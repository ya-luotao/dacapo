// Source of truth for UI strings. Every key here must also exist in zh-CN.ts.
export const en = {
  'app.name': 'dacapo',
  'app.tagline': 'Read the staff. Find the key.',
  'nav.label': 'Main',
  'nav.play': 'Play',
  'nav.read': 'Read',
  'nav.progress': 'Progress',
  'nav.settings': 'Settings',

  'play.title': 'Play',
  'play.readout.label': 'Notes',
  'play.readout.empty': 'Play a note',
  'play.readout.last': 'Last played',
  'play.sustain': 'Sustain pedal',
  'play.sustain.down': 'Pedal down',
  'play.sustain.up': 'Pedal up',

  'piano.label': 'Piano keyboard, A0 to C8',
  'piano.key.black': '{sharp} / {flat}',
  'piano.key.middleC': '{name}, middle C',

  'midi.status.pending': 'Looking for MIDI devices…',
  'midi.status.unsupported': 'MIDI is not available in this browser',
  'midi.status.noPermission': 'MIDI access is blocked',
  'midi.status.noDevice': 'No MIDI keyboard connected',
  'midi.status.connected': 'Connected: {names}',
  'midi.unnamedDevice': 'MIDI device',
  'midi.help.unsupported':
    'This browser cannot talk to MIDI keyboards. Use Chrome or Edge on a computer — or play with your computer keyboard for now.',
  'midi.help.noPermission':
    'dacapo needs permission to use MIDI devices. Allow MIDI for this site in the browser’s site settings, then try again.',
  'midi.help.noDevice':
    'Connect your keyboard with a USB cable and switch it on. It will appear here automatically.',
  'midi.retry': 'Try again',

  'keys.title': 'No MIDI keyboard? Use your computer keyboard',
  'keys.body': 'The home row plays the white keys, the row above plays the black keys.',
  'keys.octave': 'Octave',
  'keys.octaveDown': 'lower',
  'keys.octaveUp': 'higher',
  'keys.range': 'Now playing {low} to {high}',
  'keys.offPiano': 'not on the piano',

  'read.title': 'Read',
  'read.placeholder':
    'Sight-reading flashcards will appear here: one note on the grand staff, you press the key.',
  'progress.title': 'Progress',
  'progress.placeholder':
    'Your practice log and a per-note weakness map will appear here once you have practised.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.language.help': 'Follows your browser language unless you choose one here.',
  'settings.language.system': 'Browser default',
  'settings.theme': 'Appearance',
  'settings.theme.help': 'Follows your system setting unless you choose one here.',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',

  'notFound.title': 'Page not found',
  'notFound.back': 'Go to Play',
};

export type MessageKey = keyof typeof en;

/** Same keys as `en`, any string values. Annotating a literal with it rejects missing and extra keys. */
export type Dictionary = { readonly [K in MessageKey]: string };

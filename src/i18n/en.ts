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
  'play.placeholder': 'The live keyboard will appear here. Connect a MIDI keyboard and play.',
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

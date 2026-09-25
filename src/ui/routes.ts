import type { MessageKey } from '../i18n/index.ts';

export const NAV_ITEMS: readonly { path: string; label: MessageKey }[] = [
  { path: '/', label: 'nav.play' },
  { path: '/read', label: 'nav.read' },
  { path: '/pieces', label: 'nav.pieces' },
  { path: '/metronome', label: 'nav.metronome' },
  { path: '/progress', label: 'nav.progress' },
  { path: '/settings', label: 'nav.settings' },
];

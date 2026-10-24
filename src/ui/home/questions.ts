import type { MessageKey } from '../../i18n/index.ts';

/** What makes dacapo what it is, in four lines: on About, and on the site's home pages. */
export const PRINCIPLES: readonly [MessageKey, MessageKey][] = [
  ['home.principle.keyboard', 'home.principle.keyboard.text'],
  ['home.principle.private', 'home.principle.private.text'],
  ['home.principle.open', 'home.principle.open.text'],
  ['home.principle.languages', 'home.principle.languages.text'],
];

/** What a newcomer asks first, with its answer. */
export const QUESTIONS: readonly [MessageKey, MessageKey][] = [
  ['home.faq.midi.q', 'home.faq.midi.a'],
  ['home.faq.browser.q', 'home.faq.browser.a'],
  ['home.faq.free.q', 'home.faq.free.a'],
  ['home.faq.data.q', 'home.faq.data.a'],
];

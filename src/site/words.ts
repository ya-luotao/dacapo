// The words of a page of the site: the app's own dictionaries, every one in hand (a page is
// written once, in one language, when the site is built), read as the web app reads them. Notes
// are named by letter: a page has no setting to ask (docs/PERSONAL.md, "Note names").

import { fillNoteNames, type NoteNaming } from '../core/noteNames.ts';
import type { I18nContextValue, Translate } from '../i18n/context.ts';
import { en, type Dictionary } from '../i18n/en.ts';
import { ja } from '../i18n/ja.ts';
import { ko } from '../i18n/ko.ts';
import { formatMessage, type Locale } from '../i18n/locale.ts';
import { messageFor } from '../i18n/shellWording.ts';
import { zhCN } from '../i18n/zh-CN.ts';
import { zhTW } from '../i18n/zh-TW.ts';

const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
};

const made = new Map<string, Translate>();

/** `t` for a language, as the web app says it, the notes in it named as `naming` names them. */
export function translator(locale: Locale, naming: NoteNaming = 'letters'): Translate {
  const key = `${locale}:${naming}`;
  let t = made.get(key);
  if (!t) {
    const dictionary = DICTIONARIES[locale];
    t = (message, vars) =>
      formatMessage(fillNoteNames(messageFor(dictionary, message, 'web'), naming, locale), vars);
    made.set(key, t);
  }
  return t;
}

/** What `useI18n` gives on a page of the site: the language, and nothing to choose. */
export function pageI18n(locale: Locale): I18nContextValue {
  return {
    locale,
    override: null,
    setOverride: () => undefined,
    noteNaming: 'letters',
    setNoteNaming: () => undefined,
    t: translator(locale),
    translate: (naming) => translator(locale, naming),
  };
}

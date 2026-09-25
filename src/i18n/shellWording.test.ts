import { describe, expect, it } from 'vitest';
import { en, type Dictionary, type MessageKey } from './en.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import { LOCALES, type Locale } from './locale.ts';
import { APP_SUFFIX, messageFor } from './shellWording.ts';
import { zhCN } from './zh-CN.ts';
import { zhTW } from './zh-TW.ts';

const DICTIONARIES: Record<Locale, Dictionary> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko };

// Wording that only makes sense in a browser. In the Apple app it must never show (App Review
// guideline 2.3.10 also forbids naming other platforms), so every message that uses it needs an
// app variant. The app's own variants must not use it either.
const BROWSER_ONLY: Record<Locale, RegExp> = {
  en: /\b(browsers?|Chrome|Edge|Safari|Firefox|tabs?|site data|site settings|this site|downloads?|reload the page|your connection|this computer|the computer’s)\b/i,
  'zh-CN':
    /浏览器|标签页|网站设置|网站数据|此网站|下载|刷新页面|网络连接|这台电脑|电脑的耳机|电脑上一声/,
  'zh-TW': /瀏覽器|分頁|網站設定|網站資料|這個網站|下載|重新整理頁面|網路連線|這台電腦|電腦的耳機/,
  ja: /ブラウザ|タブ|サイトデータ|サイト設定|このサイト|ダウンロード|ページを再読み込み|ネットワーク接続|このパソコン|パソコンのヘッドホン/,
  // 탭 is also "tap" (탭하세요).
  ko: /브라우저|탭(?!하)|사이트 데이터|사이트 설정|이 사이트|내려받|페이지를 새로 고|인터넷 연결|이 컴퓨터|컴퓨터의 헤드폰/,
};

// Matches that are not about the browser.
const ALLOWED = new Set<MessageKey>([
  // "tab to it": the Tab key.
  'heatmap.hint',
]);

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keysOf = (d: Dictionary) => Object.keys(d) as MessageKey[];

describe('app wording', () => {
  it.each(LOCALES)('%s: every browser-only message has an app variant', (locale) => {
    const dictionary = DICTIONARIES[locale];
    const missing = keysOf(dictionary).filter(
      (key) =>
        !key.endsWith(APP_SUFFIX) &&
        !ALLOWED.has(key) &&
        BROWSER_ONLY[locale].test(dictionary[key]) &&
        !(`${key}${APP_SUFFIX}` in dictionary),
    );
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s: app variants use no browser-only wording', (locale) => {
    const dictionary = DICTIONARIES[locale];
    for (const key of keysOf(dictionary).filter((k) => k.endsWith(APP_SUFFIX))) {
      expect(dictionary[key], key).not.toMatch(BROWSER_ONLY[locale]);
    }
  });

  it('every app variant replaces an existing key and takes the same placeholders', () => {
    for (const key of keysOf(en).filter((k) => k.endsWith(APP_SUFFIX))) {
      const base = key.slice(0, -APP_SUFFIX.length);
      expect(base in en, key).toBe(true);
      expect(placeholders(en[key]), key).toEqual(placeholders(en[base as MessageKey]));
    }
  });

  it('uses the app variant only in the app', () => {
    expect(messageFor(en, 'settings.language.system', 'apple')).toBe(
      en['settings.language.system.app'],
    );
    expect(messageFor(en, 'settings.language.system', 'web')).toBe(en['settings.language.system']);
    // Keys without a variant are the same everywhere.
    expect(messageFor(en, 'nav.play', 'apple')).toBe(en['nav.play']);
  });
});

import { describe, expect, it } from 'vitest';
import type { Translate } from '../../i18n/context.ts';
import type { Dictionary } from '../../i18n/en.ts';
import { en } from '../../i18n/en.ts';
import { ja } from '../../i18n/ja.ts';
import { ko } from '../../i18n/ko.ts';
import { formatMessage, type Locale } from '../../i18n/locale.ts';
import { zhCN } from '../../i18n/zh-CN.ts';
import { zhTW } from '../../i18n/zh-TW.ts';
import { createPieceFormat } from './format.ts';

const DICTIONARIES: Record<Locale, Dictionary> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko };

const bar = (number: string, ending: number[] = []) => ({
  number,
  repeat: { forward: false, backwardTimes: null, ending },
});

// Two movements: bars 1–16 with first and second endings at 12 and 13, then bars 1–2 again,
// so bars 1 and 2 need their position, and the second movement's bar 2 is in both endings.
const MEASURES = [
  ...Array.from({ length: 16 }, (_, i) => bar(String(i + 1), i === 11 ? [1] : i === 12 ? [2] : [])),
  bar('1'),
  bar('2', [1, 2]),
];

function formatFor(locale: Locale) {
  const dictionary = DICTIONARIES[locale];
  const t: Translate = (key, vars) => formatMessage(dictionary[key], vars);
  return { t, format: createPieceFormat(t, locale, MEASURES) };
}

const PLAIN = 4;
const VOLTA = 11;
const NTH = 16;
const NTH_VOLTA = 17;

describe.each([
  {
    locale: 'en',
    plain: 'Bar 5',
    volta: 'Bar 12 (ending 1)',
    nth: 'Bar 1 (#17)',
    nthVolta: 'Bar 2 (#18, ending 1, 2)',
    repeat: 'Bar 5 (repeat)',
    loopVolta: 'Loop bar 12 (ending 1)',
    doneBar: 'Bar 12 (ending 1): 1.5 s per step, 2 wrong',
    short: '12 (ending 1)',
    picker: '1 (#17)',
    weakLoop: 'Loop the weakest bars (8–12)',
    rhythmPlain: 'You speed up in bars 8–11.',
    rhythmVolta: 'You speed up in bar 8 to bar 12 (ending 1).',
    loopBars: 'Loop bars 8–11',
  },
  {
    locale: 'zh-CN',
    plain: '第 5 小节',
    volta: '第 12 小节（1 房）',
    nth: '第 1 小节（#17）',
    nthVolta: '第 2 小节（#18，1、2 房）',
    repeat: '第 5 小节（反复）',
    loopVolta: '循环第 12 小节（1 房）',
    doneBar: '第 12 小节（1 房）：每步 1.5 秒，错 2 次',
    short: '12（1 房）',
    picker: '1（#17）',
    weakLoop: '循环最弱的小节（8–12）',
    rhythmPlain: '你在第 8–11 小节越弹越快。',
    rhythmVolta: '你在第 8 小节到第 12 小节（1 房）越弹越快。',
    loopBars: '循环第 8–11 小节',
  },
  {
    locale: 'zh-TW',
    plain: '第 5 小節',
    volta: '第 12 小節（1 房）',
    nth: '第 1 小節（#17）',
    nthVolta: '第 2 小節（#18，1、2 房）',
    repeat: '第 5 小節（反覆）',
    loopVolta: '循環第 12 小節（1 房）',
    doneBar: '第 12 小節（1 房）：每步 1.5 秒，錯 2 個',
    short: '12（1 房）',
    picker: '1（#17）',
    weakLoop: '循環最弱的小節（8–12）',
    rhythmPlain: '你在第 8–11 小節越彈越快。',
    rhythmVolta: '你在第 8 小節到第 12 小節（1 房）越彈越快。',
    loopBars: '循環第 8–11 小節',
  },
  {
    locale: 'ja',
    plain: '5小節目',
    volta: '1番カッコの12小節目',
    nth: '1小節目（#17）',
    nthVolta: '1、2番カッコの2小節目（#18）',
    repeat: '5小節目（くり返し）',
    loopVolta: '1番カッコの12小節目をループ',
    doneBar: '1番カッコの12小節目：1ステップあたり1.5秒、ミス2回',
    short: '12（1番カッコ）',
    picker: '1（#17）',
    weakLoop: '苦手な小節をループ（8〜12）',
    rhythmPlain: '8〜11小節で速くなっています。',
    rhythmVolta: '8小節目から1番カッコの12小節目までで速くなっています。',
    loopBars: '8〜11小節をループ',
  },
  {
    locale: 'ko',
    plain: '마디 5',
    volta: '마디 12 (1번 괄호)',
    nth: '마디 1 (#17)',
    nthVolta: '마디 2 (#18, 1, 2번 괄호)',
    repeat: '마디 5 (반복)',
    loopVolta: '마디 12 (1번 괄호) 반복',
    doneBar: '마디 12 (1번 괄호): 스텝당 1.5초, 2번 틀림',
    short: '12 (1번 괄호)',
    picker: '1 (#17)',
    weakLoop: '약한 마디 반복 (8–12)',
    rhythmPlain: '마디 8–11 구간에서 빨라져요.',
    rhythmVolta: '마디 8부터 마디 12 (1번 괄호)까지 구간에서 빨라져요.',
    loopBars: '마디 8–11 반복',
  },
] as const)('bar labels in $locale', (expected) => {
  const { t, format } = formatFor(expected.locale);

  it('puts the bar word, the volta and the position in the language’s order', () => {
    expect(format.barTitle(PLAIN)).toBe(expected.plain);
    expect(format.barTitle(VOLTA)).toBe(expected.volta);
    expect(format.barTitle(NTH)).toBe(expected.nth);
    expect(format.barTitle(NTH_VOLTA)).toBe(expected.nthVolta);
  });

  it('marks the second pass of a repeat in the status line', () => {
    expect(format.barStatus(PLAIN, 1)).toBe(format.barTitle(PLAIN));
    expect(format.barStatus(PLAIN, 2)).toBe(expected.repeat);
    // A second ending is only ever played on a later pass; its volta already says so.
    expect(format.barStatus(VOLTA + 1, 2)).toBe(format.barTitle(VOLTA + 1));
  });

  it('composes the loop button and the summary line', () => {
    expect(t('pieces.done.loopBar', { bar: format.barLabel(VOLTA) })).toBe(expected.loopVolta);
    expect(
      t('pieces.done.bar', { bar: format.barTitle(VOLTA), time: format.seconds(1500), wrong: 2 }),
    ).toBe(expected.doneBar);
  });

  it('keeps short labels for tables, pickers and ranges', () => {
    expect(format.barShort(VOLTA)).toBe(expected.short);
    expect(format.barShort(PLAIN)).toBe('5');
    expect(format.barNumber(NTH)).toBe(expected.picker);
    expect(format.barNumber(VOLTA)).toBe('12');
    expect(format.barRange(PLAIN, PLAIN)).toBe('5');
    expect(format.barNumber(0)).toBe(expected.picker.replace('17', '1'));
    expect(t('pieces.weak.loop.bars', { bars: format.barRange(7, 11) })).toBe(expected.weakLoop);
  });

  it('spans bars in a sentence, by label when an end has a volta', () => {
    expect(t('pieces.rhythm.faster', { bars: format.barSpan(7, 10) })).toBe(expected.rhythmPlain);
    expect(t('pieces.rhythm.faster', { bars: format.barSpan(7, VOLTA) })).toBe(
      expected.rhythmVolta,
    );
    expect(t('pieces.rhythm.loopBars', { bars: format.barSpan(7, 10) })).toBe(expected.loopBars);
  });
});

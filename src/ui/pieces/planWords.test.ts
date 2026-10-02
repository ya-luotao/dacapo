import { describe, expect, it } from 'vitest';
import type { StageStart } from '../../core/piecePlan.ts';
import type { Translate } from '../../i18n/context.ts';
import type { Dictionary } from '../../i18n/en.ts';
import { en } from '../../i18n/en.ts';
import { ja } from '../../i18n/ja.ts';
import { ko } from '../../i18n/ko.ts';
import { formatMessage, type Locale } from '../../i18n/locale.ts';
import { zhCN } from '../../i18n/zh-CN.ts';
import { zhTW } from '../../i18n/zh-TW.ts';
import { createPieceFormat } from './format.ts';
import { createPlanWords } from './planWords.ts';

const DICTIONARIES: Record<Locale, Dictionary> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko };

const bar = (number: string, ending: number[] = []) => ({
  number,
  repeat: { forward: false, backwardTimes: null, ending },
});
// An upbeat (bar 0), seven bars, then a first and a second ending.
const MEASURES = [
  ...Array.from({ length: 8 }, (_, i) => bar(String(i))),
  bar('8', [1]),
  bar('9', [2]),
];

function wordsFor(locale: Locale) {
  const dictionary = DICTIONARIES[locale];
  const t: Translate = (key, vars) => formatMessage(dictionary[key], vars);
  return {
    t,
    // As the piece's page names a step, with its score; and as today's plan does, without.
    page: createPlanWords(t, locale, createPieceFormat(t, locale, MEASURES)),
    kept: createPlanWords(t, locale),
  };
}

const bars = (from: number, to: number) => ({
  from,
  to,
  fromLabel: MEASURES[from]!.number,
  toLabel: MEASURES[to]!.number,
});
const stage = (name: StageStart['stage'], from: number, to: number): StageStart => ({
  stage: name,
  bars: bars(from, to),
  hands: name === 'right' || name === 'left' ? name : 'both',
  mode: name === 'inTime' ? 'rhythm' : 'wait',
  tempo: name === 'inTime' ? 60 : null,
});
const WHOLE: StageStart = { stage: 'whole', bars: null, hands: 'both', mode: 'wait', tempo: null };

describe.each([
  {
    locale: 'en',
    left: 'Bars 5–7, left hand',
    next: 'Next: bars 5–7, left hand',
    together: 'bars 0–4, together',
    inTime: 'bars 5–7, in time',
    whole: 'The whole piece',
    volta: 'Bar 8 (ending 1), right hand',
    keptVolta: 'Bar 8, right hand',
    row: 'Bars 5–7',
    stages: ['Right hand', 'Left hand', 'Together', 'In time', 'The whole piece'],
    done: 'Done: bars 5–7, left hand',
    start: 'Start the whole piece',
    more: 'Continue: bars 5–7, left hand',
  },
  {
    locale: 'zh-CN',
    left: '第 5–7 小节，左手',
    next: '下一步：第 5–7 小节，左手',
    together: '第 0–4 小节，合手',
    inTime: '第 5–7 小节，跟着拍子',
    whole: '整首',
    volta: '第 8 小节（1 房），右手',
    keptVolta: '第 8 小节，右手',
    row: '第 5–7 小节',
    stages: ['右手', '左手', '合手', '跟着拍子', '整首'],
    done: '已完成：第 5–7 小节，左手',
    start: '开始：整首',
    more: '继续：第 5–7 小节，左手',
  },
  {
    locale: 'zh-TW',
    left: '第 5–7 小節，左手',
    next: '下一步：第 5–7 小節，左手',
    together: '第 0–4 小節，合手',
    inTime: '第 5–7 小節，跟著拍子',
    whole: '整首',
    volta: '第 8 小節（1 房），右手',
    keptVolta: '第 8 小節，右手',
    row: '第 5–7 小節',
    stages: ['右手', '左手', '合手', '跟著拍子', '整首'],
    done: '已完成：第 5–7 小節，左手',
    start: '開始：整首',
    more: '繼續：第 5–7 小節，左手',
  },
  {
    locale: 'ja',
    left: '5〜7小節、左手',
    next: '次：5〜7小節、左手',
    together: '0〜4小節、両手',
    inTime: '5〜7小節、拍に合わせて',
    whole: '曲全体',
    volta: '1番カッコの8小節目、右手',
    keptVolta: '8小節目、右手',
    row: '5〜7小節',
    stages: ['右手', '左手', '両手', '拍に合わせて', '曲全体'],
    done: '完了：5〜7小節、左手',
    start: '開始：曲全体',
    more: '続きから：5〜7小節、左手',
  },
  {
    locale: 'ko',
    left: '마디 5–7, 왼손',
    next: '다음: 마디 5–7, 왼손',
    together: '마디 0–4, 양손',
    inTime: '마디 5–7, 박자에 맞춰',
    whole: '곡 전체',
    volta: '마디 8 (1번 괄호), 오른손',
    keptVolta: '마디 8, 오른손',
    row: '마디 5–7',
    stages: ['오른손', '왼손', '양손', '박자에 맞춰', '곡 전체'],
    done: '완료: 마디 5–7, 왼손',
    start: '시작: 곡 전체',
    more: '이어서 하기: 마디 5–7, 왼손',
  },
] as const)('a piece’s plan in words, $locale', (expected) => {
  const { t, page, kept } = wordsFor(expected.locale);
  const left = stage('left', 5, 7);

  it('names a step by its bars and its stage', () => {
    expect(page.title(left)).toBe(expected.left);
    expect(t('pieces.plan.next', { step: page.step(left) })).toBe(expected.next);
    expect(page.step(stage('together', 0, 4))).toBe(expected.together);
    expect(page.step(stage('inTime', 5, 7))).toBe(expected.inTime);
    expect(page.title(WHOLE)).toBe(expected.whole);
    expect(page.phrase(bars(5, 7))).toBe(expected.row);
  });

  it('names the same step without the score, by the numbers it keeps', () => {
    expect(kept.title(left)).toBe(expected.left);
    expect(kept.title(WHOLE)).toBe(expected.whole);
    // A volta is named on the piece's page; a kept step has its bar's number alone.
    expect(page.title(stage('right', 8, 8))).toBe(expected.volta);
    expect(kept.title(stage('right', 8, 8))).toBe(expected.keptVolta);
  });

  it('heads the columns with the stages, and labels a cell and the way on', () => {
    expect((['right', 'left', 'together', 'inTime', 'whole'] as const).map(page.stage)).toEqual(
      expected.stages,
    );
    expect(t('pieces.plan.cell.done', { step: page.step(left) })).toBe(expected.done);
    expect(t('pieces.plan.cell.start', { step: page.step(WHOLE) })).toBe(expected.start);
    expect(t('pieces.next.continue.step', { step: kept.step(left) })).toBe(expected.more);
  });
});

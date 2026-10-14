// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnswerMotion } from './answerMotion.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Status = 'waiting' | 'wrong' | 'correct';
const moved: { target: string; first: Keyframe | undefined }[] = [];

// The card as the page has it: a sheet with a notehead in it.
const sheet = document.createElement('div');
sheet.className = 'card';
sheet.append(Object.assign(document.createElement('span'), { className: 'vf-notehead' }));
const card = { current: sheet };

function Card({ status, answer }: { status: Status; answer: string }) {
  useAnswerMotion(card, status, answer);
  return null;
}

let root: Root;
let reduce = false;

beforeEach(() => {
  moved.length = 0;
  reduce = false;
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }));
  Element.prototype.animate = function (
    this: Element,
    frames: Keyframe[] | PropertyIndexedKeyframes,
  ) {
    moved.push({ target: this.className, first: (frames as Keyframe[])[1] });
    return { cancel() {} } as Animation;
  };
  root = createRoot(document.createElement('div'));
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

const show = (status: Status, answer: string) =>
  act(() => root.render(createElement(Card, { status, answer })));

describe('useAnswerMotion', () => {
  it('leaves a new card still: its time runs from when it is painted', () => {
    show('waiting', '0:');
    expect(moved).toEqual([]);
  });

  it('strikes the notehead for the right key, and nudges the card for each other wrong key', () => {
    show('waiting', '0:');
    show('wrong', '0:61');
    show('wrong', '0:61');
    show('wrong', '0:62');
    show('correct', '0:');
    expect(moved.map((m) => m.target)).toEqual(['card', 'card', 'vf-notehead']);
    expect(moved[0]!.first).toMatchObject({ transform: 'translateX(-4px)' });
    expect(moved[2]!.first).toMatchObject({ transform: 'scale(1.16)' });
  });

  it('moves nothing for a reader who asks for less motion', () => {
    reduce = true;
    show('wrong', '0:61');
    show('correct', '0:');
    expect(moved).toEqual([]);
  });
});

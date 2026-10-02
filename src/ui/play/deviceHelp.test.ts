import { describe, expect, it } from 'vitest';
import { en, type Dictionary } from '../../i18n/en.ts';
import { ja } from '../../i18n/ja.ts';
import { ko } from '../../i18n/ko.ts';
import { messageFor } from '../../i18n/shellWording.ts';
import { zhCN } from '../../i18n/zh-CN.ts';
import { zhTW } from '../../i18n/zh-TW.ts';
import type { MidiStatus } from '../../input/index.ts';
import type { Shell } from '../../lib/shell.ts';
import { deviceHelp } from './deviceHelp.ts';

const STATES: MidiStatus['state'][] = [
  'pending',
  'unsupported',
  'no-permission',
  'no-device',
  'connected',
];
/** The help as a dictionary says it in a browser, or inside the Apple app. */
const say =
  (dictionary: Dictionary, shell: Shell) =>
  (state: MidiStatus['state'], touch: boolean): string | null => {
    const key = deviceHelp(state, touch);
    return key && messageFor(dictionary, key, shell);
  };

describe('what to do about the MIDI status', () => {
  it('has help for each status without a keyboard, and none otherwise', () => {
    expect(STATES.map((state) => deviceHelp(state, false))).toEqual([
      // Still looking, or connected: nothing to do.
      null,
      'midi.help.unsupported',
      'midi.help.noPermission',
      'midi.help.noDevice',
      null,
    ]);
  });

  it('names the computer keyboard where there is one: today’s wording', () => {
    expect(say(en, 'web')('unsupported', false)).toBe(
      'This browser cannot talk to MIDI keyboards. Use Chrome or Edge on a computer — or play with your computer keyboard for now.',
    );
    expect(say(en, 'apple')('unsupported', false)).toBe(
      'dacapo could not start MIDI on this device. Close dacapo and open it again — until then, play on the keyboard on screen or a computer keyboard.',
    );
  });

  it('names the keys on the screen on a device played by touch alone', () => {
    expect(say(en, 'web')('unsupported', true)).toBe(
      'This browser cannot talk to MIDI keyboards. Use Chrome or Edge on a computer — or play on the keys on the screen for now.',
    );
    // In the app too, on a phone or a tablet without a keyboard, and with no browser named.
    expect(say(en, 'apple')('unsupported', true)).toBe(
      'dacapo could not start MIDI on this device. Close dacapo and open it again — until then, play on the keyboard on screen.',
    );
    for (const shell of ['web', 'apple'] as const) {
      // No computer keys to play with there: "on a computer" is only where the browser would be.
      expect(say(en, shell)('unsupported', true)).not.toMatch(/computer keyboard/);
      expect(say(en, shell)('unsupported', true)).toMatch(/on (the )?screen/);
    }
  });

  it('says the same in every language', () => {
    // What each language calls the computer's keyboard in this help, and the keys on the screen.
    const words: [Dictionary, RegExp, RegExp][] = [
      [zhCN, /电脑键盘/, /屏幕上的(琴键|键盘)/],
      [zhTW, /電腦鍵盤/, /(螢幕|畫面)上的(琴鍵|鍵盤)/],
      [ja, /パソコンのキーボード/, /画面の鍵盤/],
      [ko, /컴퓨터 키보드/, /화면의 건반/],
    ];
    for (const [dictionary, computerKeys, screenKeys] of words) {
      for (const shell of ['web', 'apple'] as const) {
        expect(say(dictionary, shell)('unsupported', false)).toMatch(computerKeys);
        expect(say(dictionary, shell)('unsupported', true)).not.toMatch(computerKeys);
        expect(say(dictionary, shell)('unsupported', true)).toMatch(screenKeys);
      }
    }
  });

  it('changes only the help where there is no MIDI at all', () => {
    for (const state of STATES) {
      if (state === 'unsupported') continue;
      // Blocked, or none connected: the help is about MIDI itself, with no keys to name.
      expect(deviceHelp(state, true), state).toBe(deviceHelp(state, false));
    }
    // Touch changes what plays for now, never whether there is help.
    expect(deviceHelp('unsupported', true)).not.toBe(deviceHelp('unsupported', false));
  });
});

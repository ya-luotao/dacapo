// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Translate } from '../../i18n/index.ts';
import { en } from '../../i18n/en.ts';
import { formatMessage } from '../../i18n/locale.ts';
import { messageFor } from '../../i18n/shellWording.ts';
import type { MidiStatus } from '../../input/index.ts';
import type { Shell } from '../../lib/shell.ts';
import {
  NOTICE_REASONS,
  noticeReason,
  noticeShown,
  noticeText,
  readDismissed,
  writeDismissed,
  type NoticeReason,
} from './notice.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const STATES: MidiStatus['state'][] = [
  'pending',
  'unsupported',
  'no-permission',
  'no-device',
  'connected',
];
/** English as the app says it in a browser, or inside the Apple app. */
const say =
  (shell: Shell): Translate =>
  (key, vars) =>
    formatMessage(messageFor(en, key, shell), vars);

/** The keys of Play's status line (ui/play/DeviceStatus.tsx). */
const STATUS_OF_PLAY = {
  'no-device': 'midi.status.noDevice',
  unsupported: 'midi.status.unsupported',
  'no-permission': 'midi.status.noPermission',
} as const;

describe('what is playing when no MIDI keyboard is', () => {
  it('has a reason for each status without a keyboard, and none otherwise', () => {
    expect(STATES.map(noticeReason)).toEqual([
      // Still looking: nothing is said yet, so the line never flashes on a page that loads.
      null,
      'unsupported',
      'no-permission',
      'no-device',
      // A keyboard is connected: nothing to say.
      null,
    ]);
    expect(NOTICE_REASONS).toEqual(['no-device', 'unsupported', 'no-permission']);
  });

  it('says so in the words of Play’s status line, and what plays instead', () => {
    const web = say('web');
    expect(noticeText('no-device', web)).toBe(
      'No MIDI keyboard connected: the computer keys play, A to K.',
    );
    expect(noticeText('unsupported', web)).toBe(
      'MIDI is not available in this browser: the computer keys play, A to K.',
    );
    expect(noticeText('no-permission', web)).toBe(
      'MIDI access is blocked: the computer keys play, A to K.',
    );
    for (const state of ['no-device', 'unsupported', 'no-permission'] as const) {
      expect(noticeText(state, web)).toContain(web(STATUS_OF_PLAY[state]));
    }
    expect(noticeText('pending', web)).toBeNull();
    expect(noticeText('connected', web)).toBeNull();
  });

  it('names no browser in the app, and the keys on the screen first', () => {
    const app = say('apple');
    expect(noticeText('no-device', app)).toBe(
      'No MIDI keyboard connected: the keys on the screen play, and a computer keyboard’s A to K.',
    );
    for (const state of ['unsupported', 'no-permission'] as const) {
      expect(noticeText(state, app)).toBe(
        'MIDI is not available: the keys on the screen play, and a computer keyboard’s A to K.',
      );
    }
    expect(noticeText('pending', app)).toBeNull();
    expect(noticeText('connected', app)).toBeNull();
  });

  it('shows until its reason is dismissed, and again for another reason', () => {
    expect(noticeShown(null, null)).toBe(false);
    expect(noticeShown(null, 'no-device')).toBe(false);
    for (const reason of NOTICE_REASONS) {
      expect(noticeShown(reason, null), reason).toBe(true);
      for (const dismissed of NOTICE_REASONS) {
        expect(noticeShown(reason, dismissed), `${reason}, ${dismissed}`).toBe(
          reason !== dismissed,
        );
      }
    }
  });

  it('goes when a keyboard connects, and comes back when the reason changes', () => {
    // What a page sees as the status changes, with what was dismissed on this device.
    let dismissed: NoticeReason | null = null;
    const shown = (state: MidiStatus['state']) => noticeShown(noticeReason(state), dismissed);
    const dismiss = (state: MidiStatus['state']) => (dismissed = noticeReason(state));
    expect(shown('pending')).toBe(false);
    expect(shown('no-device')).toBe(true);
    dismiss('no-device');
    expect(shown('no-device')).toBe(false);
    // A keyboard is plugged in and taken away again: the same reason, still dismissed.
    expect(shown('connected')).toBe(false);
    expect(shown('no-device')).toBe(false);
    // MIDI is blocked for the site: another reason, so the line is back.
    expect(shown('no-permission')).toBe(true);
    // Allowed again without dismissing it: none connected is still the reason dismissed.
    expect(shown('no-device')).toBe(false);
    // Dismissed for the new reason, it is that one which is kept: the old one shows again.
    dismiss('no-permission');
    expect(shown('no-permission')).toBe(false);
    expect(shown('no-device')).toBe(true);
  });
});

describe('the dismissal kept in this browser', () => {
  it('is of one reason, kept per device', () => {
    expect(readDismissed()).toBeNull();
    for (const reason of NOTICE_REASONS) {
      writeDismissed(reason);
      expect(readDismissed()).toBe(reason);
      expect(localStorage.getItem('dacapo.input.notice')).toBe(reason);
    }
    writeDismissed(null);
    expect(readDismissed()).toBeNull();
    expect(localStorage.getItem('dacapo.input.notice')).toBeNull();
  });

  it('is none when what is kept is no reason', () => {
    for (const kept of ['', '1', 'connected', 'pending', 'no-device,unsupported']) {
      localStorage.setItem('dacapo.input.notice', kept);
      expect(readDismissed(), kept).toBeNull();
    }
  });

  it('does without the browser’s storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDismissed()).toBeNull();
    expect(() => writeDismissed('unsupported')).not.toThrow();
  });
});

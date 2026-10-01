import type { MessageKey, Translate } from '../../i18n/index.ts';
import type { MidiStatus } from '../../input/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// What is playing when no MIDI keyboard is (docs/START.md): on every practice page one line says
// so, and what plays instead. It can be dismissed, per device and per reason.

/** Why no MIDI keyboard is playing: none connected, no MIDI here at all, or MIDI blocked. */
export const NOTICE_REASONS = ['no-device', 'unsupported', 'no-permission'] as const;
export type NoticeReason = (typeof NOTICE_REASONS)[number];

/**
 * The reason to give for a status. None while the browser is still looking (the line does not
 * flash on a page that is about to find a keyboard), and none with a keyboard connected.
 */
export function noticeReason(state: MidiStatus['state']): NoticeReason | null {
  return NOTICE_REASONS.find((reason) => reason === state) ?? null;
}

/** Each reason in the words of Play's status line. */
const STATUS: Readonly<Record<NoticeReason, MessageKey>> = {
  'no-device': 'midi.status.noDevice',
  unsupported: 'midi.status.unsupported',
  'no-permission': 'midi.status.noPermission',
};

/**
 * The line for a status: Play's own words for it, then what plays instead. Null when there is
 * nothing to say. The app's wording (no browser to name there) comes with `t`.
 */
export function noticeText(state: MidiStatus['state'], t: Translate): string | null {
  const reason = noticeReason(state);
  return reason && t('input.notice', { status: t(STATUS[reason]) });
}

/**
 * Whether the line shows: there is a reason, and it is not the one dismissed. The dismissal is
 * of one reason, so the line comes back when the reason changes.
 */
export function noticeShown(reason: NoticeReason | null, dismissed: NoticeReason | null): boolean {
  return reason !== null && reason !== dismissed;
}

const NOTICE_KEY = 'dacapo.input.notice';

/** The reason dismissed on this device; null when none was, or what is kept is no reason. */
export function readDismissed(): NoticeReason | null {
  const kept = readPref(NOTICE_KEY);
  return NOTICE_REASONS.find((reason) => reason === kept) ?? null;
}

export function writeDismissed(reason: NoticeReason | null): void {
  if (reason !== readDismissed()) writePref(NOTICE_KEY, reason);
}

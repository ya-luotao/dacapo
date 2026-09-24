import { useI18n, useT, type MessageKey } from '../../i18n/index.ts';
import type { MidiStatus } from '../../input/index.ts';
import { useInput, useMidiStatus } from '../input/context.ts';

const LABELS: Record<Exclude<MidiStatus['state'], 'connected'>, MessageKey> = {
  pending: 'midi.status.pending',
  unsupported: 'midi.status.unsupported',
  'no-permission': 'midi.status.noPermission',
  'no-device': 'midi.status.noDevice',
};

const HELP: Partial<Record<MidiStatus['state'], MessageKey>> = {
  unsupported: 'midi.help.unsupported',
  'no-permission': 'midi.help.noPermission',
  'no-device': 'midi.help.noDevice',
};

export function DeviceStatus() {
  const { t, locale } = useI18n();
  const status = useMidiStatus();

  const label =
    status.state === 'connected'
      ? t('midi.status.connected', {
          names: new Intl.ListFormat(locale, { type: 'conjunction' }).format(
            status.names.map((name) => name || t('midi.unnamedDevice')),
          ),
        })
      : t(LABELS[status.state]);

  return (
    <p className={`device-status is-${status.state}`} role="status">
      <svg className="device-icon" viewBox="0 0 16 16" aria-hidden="true">
        {status.state === 'connected' ? (
          <path d="M3.5 8.5l3 3 6-7" />
        ) : status.state === 'pending' ? (
          <circle cx="8" cy="8" r="5" strokeDasharray="4 3" />
        ) : (
          <path d="M8 3.5v6M8 12.2v.3" />
        )}
      </svg>
      <span>{label}</span>
    </p>
  );
}

/** What to do about the current MIDI status; nothing when connected or still looking. */
export function DeviceHelp() {
  const t = useT();
  const { midi } = useInput();
  const status = useMidiStatus();
  const help = HELP[status.state];
  if (!help) return null;

  return (
    <p className="help device-help">
      {t(help)}{' '}
      {status.state === 'no-permission' && (
        <button type="button" className="button-link" onClick={midi.retry}>
          {t('midi.retry')}
        </button>
      )}
    </p>
  );
}

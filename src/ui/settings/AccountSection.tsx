import { useId, useMemo, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/index.ts';
import { thisDevice } from '../../sync/app.ts';
import type { SyncClient, SyncStatus } from '../../sync/client.ts';
import { useSyncClient, useSyncStatus } from '../sync/context.ts';
import { ProfileBlock } from './ProfileBlock.tsx';
import { accountError, codeDigits, isEmail, statusKey, type AccountMessage } from './account.ts';

// Settings → Account (docs/SYNC.md): sign in with an email address and a code, then the
// signed-in address, how syncing goes, sync now, sign out and delete the account, and the public
// profile (docs/PROFILE.md). Only in a build with a sync service.

const PRIVACY_URL = `${(import.meta.env.VITE_SYNC_ENDPOINT ?? '').replace(/\/+$/, '')}/privacy`;

export function AccountSection() {
  const client = useSyncClient();
  const status = useSyncStatus();
  const id = useId();
  const { t } = useI18n();
  const [deleted, setDeleted] = useState(false);
  if (!client || !status) return null;

  return (
    <section className="field data account" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('settings.account')}</h2>
      {status.account ? (
        <SignedIn client={client} status={status} onDeleted={() => setDeleted(true)} />
      ) : (
        <>
          {deleted && (
            <p className="data-message is-ok" role="status">
              {t('settings.account.deleted')}
            </p>
          )}
          <p className="help">{t('settings.account.help')}</p>
          {status.available ? (
            <SignInForm client={client} />
          ) : (
            <p className="data-status">{t('settings.account.unavailable')}</p>
          )}
        </>
      )}
      <ul className="about-links">
        <li>
          <a href={PRIVACY_URL}>{t('settings.account.privacy')}</a>
        </li>
      </ul>
    </section>
  );
}

function useMessage() {
  const { t } = useI18n();
  return (message: AccountMessage) => {
    const wait = message.wait ?? 0;
    const time =
      wait >= 60
        ? t('progress.duration.minutes', { m: Math.floor(wait / 60), s: wait % 60 })
        : t('progress.duration.seconds', { s: wait });
    return t(message.key, { time });
  };
}

function SignInForm({ client }: { client: SyncClient }) {
  const { t, locale } = useI18n();
  const text = useMessage();
  const id = useId();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountMessage | null>(null);

  async function sendCode() {
    if (!isEmail(email)) {
      setError({ key: 'settings.account.error.email' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await client.requestCode(email.trim(), locale);
      setStep('code');
      setCode('');
    } catch (e) {
      setError(accountError(e, 'email'));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await client.signIn(email.trim(), code, thisDevice());
    } catch (e) {
      setError(accountError(e, 'code'));
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step === 'email') void sendCode();
    else if (code.length === 6) void signIn();
  }

  return (
    <form className="account-form" onSubmit={onSubmit} noValidate>
      {step === 'email' ? (
        <>
          <label htmlFor={`${id}-email`}>{t('settings.account.email')}</label>
          <div className="account-row">
            <input
              id={`${id}-email`}
              className="text-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="button button-primary" disabled={busy || !email}>
              {t('settings.account.sendCode')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="help" role="status">
            {t('settings.account.codeSent', { email: email.trim() })}
          </p>
          <label htmlFor={`${id}-code`}>{t('settings.account.code')}</label>
          <div className="account-row">
            <input
              id={`${id}-code`}
              className="text-input account-code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(codeDigits(e.target.value))}
            />
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || code.length !== 6}
            >
              {t('settings.account.signIn')}
            </button>
          </div>
          <div className="account-row">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void sendCode()}
            >
              {t('settings.account.resend')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => {
                setStep('email');
                setError(null);
              }}
            >
              {t('settings.account.otherEmail')}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="data-message is-error" role="alert">
          {text(error)}
        </p>
      )}
    </form>
  );
}

function SignedIn({
  client,
  status,
  onDeleted,
}: {
  client: SyncClient;
  status: SyncStatus;
  onDeleted: () => void;
}) {
  const { t, locale } = useI18n();
  const text = useMessage();
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountMessage | null>(null);
  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await client.deleteAccount();
      onDeleted();
    } catch (e) {
      setError(accountError(e, 'account'));
      setBusy(false);
    }
  }

  const phase = statusKey(status);
  return (
    <>
      <p className="account-email">
        {t('settings.account.signedIn', { email: status.account!.email })}
      </p>
      <p
        className={status.phase === 'error' ? 'data-status is-warning' : 'data-status'}
        role="status"
      >
        {t(phase, { time: status.lastSyncAt === null ? '' : dateTime.format(status.lastSyncAt) })}
      </p>
      <div className="data-actions">
        <div>
          <button
            type="button"
            className="button"
            disabled={status.phase === 'syncing'}
            onClick={() => void client.syncNow()}
          >
            {t('settings.account.syncNow')}
          </button>
        </div>
        <div>
          <button
            type="button"
            className="button"
            onClick={() => void client.signOut()}
            aria-describedby={`${id}-signout`}
          >
            {t('settings.account.signOut')}
          </button>
          <p id={`${id}-signout`} className="help">
            {t('settings.account.signOut.help')}
          </p>
        </div>
        <div>
          <button
            type="button"
            className="button"
            aria-expanded={confirming}
            onClick={() => setConfirming(!confirming)}
          >
            {t('settings.account.delete')}
          </button>
        </div>
      </div>
      {confirming && (
        <div
          className="your-piece-panel account-delete"
          role="alertdialog"
          aria-label={t('settings.account.delete.button')}
        >
          <p>{t('settings.account.delete.confirm')}</p>
          <div className="actions">
            <button
              type="button"
              className="button button-danger"
              disabled={busy}
              onClick={() => void deleteAccount()}
            >
              {t('settings.account.delete.button')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {t('settings.account.cancel')}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="data-message is-error" role="alert">
          {text(error)}
        </p>
      )}
      <ProfileBlock client={client} status={status} message={text} />
    </>
  );
}

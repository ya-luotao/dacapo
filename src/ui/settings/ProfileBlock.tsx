import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  normalizeUsername,
  usernameProblem,
  type ProfileSettings,
  type ProfileVisibility,
} from '../../core/profile.ts';
import { useI18n } from '../../i18n/index.ts';
import type { SyncClient, SyncStatus } from '../../sync/client.ts';
import { profileError, profileUrl, usernameMessage, type AccountMessage } from './account.ts';

// Settings → Account → Public profile (docs/PROFILE.md): the username, who sees what, piece
// titles, and the link to the page. The settings are the service's, read when this opens.

const ENDPOINT = import.meta.env.VITE_SYNC_ENDPOINT ?? '';
const VISIBILITIES: readonly ProfileVisibility[] = ['off', 'private', 'public'];

export function ProfileBlock({
  client,
  status,
  message,
}: {
  client: SyncClient;
  status: SyncStatus;
  message: (message: AccountMessage) => string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [loading, setLoading] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountMessage | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The name just saved, to say so under the form (which starts afresh for every new name).
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    client.loadProfile().then(
      () => current && setLoading('ready'),
      () => current && setLoading('failed'),
    );
    return () => {
      current = false;
    };
  }, [client, attempt]);

  const profile = status.profile;

  async function change(settings: ProfileSettings) {
    setBusy(true);
    setError(null);
    try {
      await client.setProfileSettings(settings);
    } catch (e) {
      setError(profileError(e));
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (!profile && loading === 'failed') {
    body = (
      <p className="data-status is-warning" role="alert">
        {t('settings.profile.loadFailed')}{' '}
        <button
          type="button"
          className="button button-link"
          onClick={() => {
            setLoading('loading');
            setAttempt((n) => n + 1);
          }}
        >
          {t('settings.profile.retry')}
        </button>
      </p>
    );
  } else if (!profile) {
    body = (
      <p className="data-status" role="status">
        {t('settings.profile.loading')}
      </p>
    );
  } else {
    const { username, settings } = profile;
    body = (
      <>
        <UsernameForm
          key={username ?? ''}
          client={client}
          current={username}
          saved={saved !== null && saved === username}
          onSaved={setSaved}
          message={message}
        />
        <fieldset
          className="field account-visibility"
          aria-describedby={`${id}-shows`}
          disabled={busy || !username}
        >
          <legend>{t('settings.profile.visibility')}</legend>
          <div className="segmented">
            {VISIBILITIES.map((visibility) => (
              <label key={visibility}>
                <input
                  type="radio"
                  name={`${id}-visibility`}
                  value={visibility}
                  checked={settings.visibility === visibility}
                  onChange={() => void change({ visibility, titles: settings.titles })}
                />
                <span>{t(`settings.profile.visibility.${visibility}`)}</span>
              </label>
            ))}
          </div>
          <p id={`${id}-shows`} className="help">
            {username
              ? t(`settings.profile.shows.${settings.visibility}`)
              : t('settings.profile.visibility.needsUsername')}
          </p>
          {settings.visibility === 'public' && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.titles}
                  aria-describedby={`${id}-titles`}
                  onChange={(e) => void change({ visibility: 'public', titles: e.target.checked })}
                />
                <span>{t('settings.profile.titles')}</span>
              </label>
              <p id={`${id}-titles`} className="help">
                {t('settings.profile.titles.help')}
              </p>
            </>
          )}
        </fieldset>
        {error && (
          <p className="data-message is-error" role="alert">
            {message(error)}
          </p>
        )}
        {username && settings.visibility !== 'off' && <ProfileLink username={username} />}
      </>
    );
  }

  return (
    <div className="account-profile" aria-labelledby={`${id}-title`} role="group">
      <h3 id={`${id}-title`} className="eyebrow">
        {t('settings.profile')}
      </h3>
      <p className="help">{t('settings.profile.help')}</p>
      {body}
    </div>
  );
}

function UsernameForm({
  client,
  current,
  saved,
  onSaved,
  message,
}: {
  client: SyncClient;
  current: string | null;
  saved: boolean;
  onSaved: (name: string | null) => void;
  message: (message: AccountMessage) => string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountMessage | null>(null);
  const name = normalizeUsername(draft);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    onSaved(null);
    try {
      await task();
    } catch (e) {
      setError(profileError(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || name === current) return;
    const problem = usernameProblem(name);
    if (problem) {
      setError(usernameMessage(problem));
      onSaved(null);
      return;
    }
    void run(async () => {
      await client.setUsername(name);
      onSaved(name);
    });
  }

  return (
    <form className="account-form" onSubmit={onSubmit} noValidate>
      <label htmlFor={`${id}-username`}>{t('settings.profile.username')}</label>
      <div className="account-row">
        <input
          id={`${id}-username`}
          className="text-input account-username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={60}
          value={draft}
          aria-describedby={`${id}-username-help`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
            onSaved(null);
          }}
        />
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || !name || name === current}
        >
          {t('settings.profile.username.save')}
        </button>
      </div>
      <p id={`${id}-username-help`} className="help">
        {t('settings.profile.username.help')}
      </p>
      {error && (
        <p className="data-message is-error" role="alert">
          {message(error)}
        </p>
      )}
      {saved && (
        <p className="data-message is-ok" role="status">
          {t('settings.profile.username.saved')}
        </p>
      )}
      {current && (
        <div>
          <button
            type="button"
            className="button"
            disabled={busy}
            aria-describedby={`${id}-remove`}
            onClick={() => void run(() => client.removeUsername())}
          >
            {t('settings.profile.username.remove')}
          </button>
          <p id={`${id}-remove`} className="help">
            {t('settings.profile.username.remove.help')}
          </p>
        </div>
      )}
    </form>
  );
}

function ProfileLink({ username }: { username: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  const url = profileUrl(ENDPOINT, username);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  }

  return (
    <div className="account-link">
      <p className="eyebrow">{t('settings.profile.link')}</p>
      <div className="account-row">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        <button type="button" className="button" onClick={() => void copy()}>
          {t('settings.profile.copy')}
        </button>
      </div>
      {copied && (
        <p
          className={copied === 'copied' ? 'data-status' : 'data-status is-warning'}
          role={copied === 'copied' ? 'status' : 'alert'}
        >
          {t(copied === 'copied' ? 'settings.profile.copied' : 'settings.profile.copyFailed')}
        </p>
      )}
    </div>
  );
}

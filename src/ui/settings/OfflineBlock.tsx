import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { offline } from '../../offline/client.ts';
import type { OfflineGroup } from '../../offline/files.ts';

// Settings → Your data → Offline (docs/OFFLINE.md): whether the app is stored on the device, and
// "Store everything" for the engraver, the piano and the languages. The web app only: the Apple
// app carries the build inside it.

/** What a group of the list is called when it could not be stored. */
const WHAT: Record<OfflineGroup, MessageKey> = {
  app: 'settings.offline.what.dacapo',
  engraver: 'settings.offline.what.engraver',
  piano: 'settings.offline.what.piano',
  pictures: 'settings.offline.what.pictures',
  languages: 'settings.offline.what.languages',
  licences: 'settings.offline.what.licences',
};

export function OfflineBlock() {
  const t = useT();
  const id = useId();
  const { state, rest, progress } = useSyncExternalStore(offline.subscribe, offline.getSnapshot);
  /** The groups the last "Store everything" could not store. */
  const [failed, setFailed] = useState<OfflineGroup[]>([]);

  useEffect(() => {
    void offline.refresh();
  }, []);

  async function onStoreEverything() {
    setFailed([]);
    setFailed(await offline.storeEverything());
  }

  const complete = rest?.missing === 0 && !progress;

  return (
    <div className="data-offline" role="group" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="eyebrow">
        {t('settings.offline')}
      </h3>
      <p className="data-status">{t(`settings.offline.${state}`)}</p>

      {rest && complete && (
        <p className="help" role="status">
          {t('settings.offline.all.done')}
        </p>
      )}
      {rest && !complete && (
        <div className="data-actions">
          <div>
            <button
              type="button"
              className="button"
              onClick={() => void onStoreEverything()}
              disabled={state !== 'stored' || progress !== null}
              aria-describedby={`${id}-all`}
            >
              {t('settings.offline.all')}
            </button>
            {/* The count is not announced file by file: the end is (above, or the alert below). */}
            <p id={`${id}-all`} className="help">
              {progress
                ? t('settings.offline.all.progress', progress)
                : t('settings.offline.all.help', { size: Math.round(rest.bytes / 2 ** 20) })}
            </p>
          </div>
        </div>
      )}
      {failed.length > 0 && !progress && (
        <p className="data-message is-error" role="alert">
          {t('settings.offline.all.failed', {
            what: failed.map((group) => t(WHAT[group])).join(t('app.listSeparator')),
          })}
        </p>
      )}
    </div>
  );
}

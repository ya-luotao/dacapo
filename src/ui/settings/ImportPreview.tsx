import { useEffect, useId, useRef, useState } from 'react';
import type { ImportPlan, InvalidRecord, ParsedImport } from '../../storage/exchange.ts';
import { LOCALE_NAMES, useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';

/** Invalid records listed by name; the rest are counted. */
const INVALID_LISTED = 10;
const COLLECTIONS = ['sessions', 'attempts', 'pieces'] as const;

interface ImportPreviewProps {
  fileName: string;
  parsed: ParsedImport;
  plan: ImportPlan;
  working: boolean;
  onApply: (applyPreferences: boolean) => void;
  onCancel: () => void;
}

export function ImportPreview({
  fileName,
  parsed,
  plan,
  working,
  onApply,
  onCancel,
}: ImportPreviewProps) {
  const t = useT();
  const format = useLogFormat();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [applyPreferences, setApplyPreferences] = useState(false);
  const exportedAt = parsed.exportedAt ? Date.parse(parsed.exportedAt) : NaN;
  const nothingNew = plan.sessions.new === 0 && plan.attempts.new === 0 && plan.pieces.new === 0;
  // Files from before version 2 cannot hold pieces, so they get no row for them.
  const collections = parsed.version >= 2 ? COLLECTIONS : COLLECTIONS.slice(0, 2);
  const { preferences } = parsed;

  // Keyboard and screen-reader users land on the preview once the file has been read.
  useEffect(() => heading.current?.focus(), []);

  function describe(record: InvalidRecord): string {
    if (record.collection === 'preferences') {
      return t('settings.import.invalid.preferences', { field: record.field });
    }
    return t(
      record.problem === 'duplicate'
        ? 'settings.import.invalid.duplicate'
        : 'settings.import.invalid.field',
      {
        record: t(`settings.import.record.${record.collection}`),
        n: record.index + 1,
        field: record.field,
      },
    );
  }

  return (
    <section className="import-preview" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} ref={heading} tabIndex={-1}>
        {t('settings.import.preview')}
      </h3>
      <p className="muted">
        {t('settings.import.file', { name: fileName })}
        {Number.isFinite(exportedAt) && (
          <>
            {' · '}
            {t('settings.import.exportedAt', { date: format.dateTime(exportedAt) })}
          </>
        )}
      </p>

      <table className="import-counts">
        <thead>
          <tr>
            <th scope="col">{t('settings.import.what')}</th>
            <th scope="col">{t('settings.import.new')}</th>
            <th scope="col">{t('settings.import.present')}</th>
            <th scope="col">{t('settings.import.invalid')}</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((kind) => (
            <tr key={kind}>
              <th scope="row">{t(`settings.import.${kind}`)}</th>
              <td>{plan[kind].new}</td>
              <td>{plan[kind].present}</td>
              <td className={plan[kind].invalid > 0 ? 'is-invalid' : undefined}>
                {plan[kind].invalid}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {nothingNew && <p>{t('settings.import.nothingNew')}</p>}
      <p className="help">{t('settings.import.stats')}</p>

      {parsed.invalid.length > 0 && (
        <div className="import-invalid">
          <p>{t('settings.import.invalidTitle')}</p>
          <ul>
            {parsed.invalid.slice(0, INVALID_LISTED).map((record) => (
              <li key={`${record.collection}-${record.index}`}>{describe(record)}</li>
            ))}
          </ul>
          {parsed.invalid.length > INVALID_LISTED && (
            <p className="muted">
              {t('settings.import.more', { n: parsed.invalid.length - INVALID_LISTED })}
            </p>
          )}
        </div>
      )}

      {preferences && (
        <label className="check import-prefs">
          <input
            type="checkbox"
            checked={applyPreferences}
            onChange={(e) => setApplyPreferences(e.target.checked)}
          />
          <span>
            {t('settings.import.prefs', {
              language: preferences.locale
                ? LOCALE_NAMES[preferences.locale]
                : t('settings.language.system'),
              theme: t(`settings.theme.${preferences.theme}`),
            })}
          </span>
        </label>
      )}

      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => onApply(applyPreferences)}
          disabled={working || (nothingNew && !applyPreferences)}
        >
          {working ? t('settings.import.working') : t('settings.import.apply')}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={working}>
          {t('settings.import.cancel')}
        </button>
      </div>
    </section>
  );
}

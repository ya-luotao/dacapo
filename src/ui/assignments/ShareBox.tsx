import { useId, useMemo, useRef, useState } from 'react';
import {
  encodeShare,
  shareFileName,
  shareFileText,
  shareLink,
  type Shared,
} from '../../core/assignmentShare.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { downloadText } from '../../lib/download.ts';
import { appUrl } from '../../lib/links.ts';

/**
 * An assignment or a report on its way out (docs/ASSIGNMENTS.md, "Sharing"): as a link to copy,
 * and as a file. dacapo sends neither: whoever shares it does, however they like. `fileOnly`
 * says why there is no link (the assignment names an imported piece, whose MusicXML only a file
 * carries); a link too large to be one goes as a file too.
 */
export function ShareBox({
  shared,
  fileOnly,
  linkHelp,
  tooLarge = 'assignments.share.tooLarge',
}: {
  shared: Shared;
  fileOnly?: MessageKey;
  linkHelp: MessageKey;
  /** What to say of one too large for a link. */
  tooLarge?: MessageKey;
}) {
  const t = useT();
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  // What became of copying which link: a link changed since (a report's note) is not the one copied.
  const [copy, setCopy] = useState<{ url: string; state: 'copied' | 'failed' } | null>(null);
  const url = useMemo(() => {
    if (fileOnly) return null;
    const data = encodeShare(shared);
    return data === null ? null : shareLink(appUrl(), data);
  }, [shared, fileOnly]);

  const copied = copy && copy.url === url ? copy.state : null;

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopy({ url, state: 'copied' });
    } catch {
      // No clipboard here: the link is selected, to be copied by hand.
      field.current?.select();
      setCopy({ url, state: 'failed' });
    }
  }

  return (
    <div className="share">
      {url ? (
        <div className="share-way">
          <label htmlFor={`${id}-link`} className="share-label">
            {t('assignments.share.link')}
          </label>
          <div className="share-link">
            <input
              id={`${id}-link`}
              ref={field}
              className="text-input"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="button button-primary" onClick={() => void copyLink()}>
              {t('settings.profile.copy')}
            </button>
          </div>
          {copied ? (
            <p
              className={copied === 'copied' ? 'data-status' : 'data-status is-warning'}
              role={copied === 'copied' ? 'status' : 'alert'}
            >
              {t(copied === 'copied' ? 'settings.profile.copied' : 'settings.profile.copyFailed')}
            </p>
          ) : (
            <p className="help">{t(linkHelp)}</p>
          )}
        </div>
      ) : (
        <p className="help">{t(fileOnly ?? tooLarge)}</p>
      )}
      <div className="share-way">
        <span className="share-label">{t('assignments.share.file')}</span>
        <div>
          <button
            type="button"
            className="button"
            onClick={() => downloadText(shareFileText(shared), shareFileName(shared))}
          >
            {t('assignments.share.save')}
          </button>
        </div>
        <p className="help">{t('assignments.share.file.help', { file: shareFileName(shared) })}</p>
      </div>
    </div>
  );
}

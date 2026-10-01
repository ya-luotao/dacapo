import { useMemo } from 'react';
import { Link } from 'wouter';
import { decodeShare } from '../../core/assignmentShare.ts';
import { useT } from '../../i18n/index.ts';
import { SHARE_ERRORS } from './format.ts';
import { SharedPreview } from './SharedPreview.tsx';

/**
 * `#/assignments/open/<data>`: what a link holds, read from its fragment (which no server ever
 * sees) and shown before anything is stored. A link that is damaged, too large or not one of
 * ours is refused in a sentence.
 */
export function AssignmentOpenPage({ data }: { data: string }) {
  const t = useT();
  const result = useMemo(() => decodeShare(data), [data]);
  return (
    <section className="assignments">
      <p className="piece-back">
        <Link href="/assignments">{t('assignments.back')}</Link>
      </p>
      {result.ok ? (
        <>
          <h1 className="visually-hidden">{t('assignments.title')}</h1>
          <SharedPreview shared={result.value} />
        </>
      ) : (
        <>
          <h1>{t('assignments.open.failed')}</h1>
          <p className="data-message is-error" role="alert">
            {t(SHARE_ERRORS[result.error])}
          </p>
          <div className="actions">
            <Link href="/assignments" className="button button-primary">
              {t('assignments.back')}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

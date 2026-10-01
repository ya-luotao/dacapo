import { useEffect } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { EmptyState } from '../EmptyState.tsx';
import { useRouteSearch } from '../hashRoute.ts';
import { parsePieceStart } from '../startParams.ts';
import { usePracticeStore } from '../practice/context.ts';
import { PieceSession } from './PieceSession.tsx';
import { usePiece } from './usePiece.ts';

export function PiecePage({ id }: { id: string }) {
  const t = useT();
  const state = usePiece(id);
  const store = usePracticeStore();
  const ready = state.status === 'ready' ? state.piece : null;
  // Opened with settings (a task of an assignment): the page starts over with each new set.
  const search = useRouteSearch();

  // An imported piece keeps its checksum and bar counts for the library; the parser may have
  // changed since they were stored.
  useEffect(() => {
    const stored = ready?.stored;
    if (!ready || !stored || JSON.stringify(stored.facts) === JSON.stringify(ready.facts)) return;
    store.savePiece({ ...stored, facts: ready.facts });
  }, [ready, store]);

  if (ready)
    return (
      <PieceSession key={`${ready.id}?${search}`} piece={ready} start={parsePieceStart(search)} />
    );
  return (
    <section className="page">
      <p className="piece-back">
        <Link href="/pieces">{t('pieces.back')}</Link>
      </p>
      {state.status === 'loading' ? (
        <p className="muted" role="status">
          {t('pieces.preparing')}
        </p>
      ) : (
        <EmptyState action={{ href: '/pieces', label: t('pieces.back') }}>
          {state.status === 'missing' ? t('pieces.notFound') : t('pieces.renderFailed')}
        </EmptyState>
      )}
    </section>
  );
}

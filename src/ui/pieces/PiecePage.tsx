import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { EmptyState } from '../EmptyState.tsx';
import { PieceSession } from './PieceSession.tsx';
import { usePiece } from './usePiece.ts';

export function PiecePage({ id }: { id: string }) {
  const t = useT();
  const state = usePiece(id);

  if (state.status === 'ready') return <PieceSession piece={state.piece} />;
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

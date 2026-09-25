import { useT } from '../../i18n/index.ts';
import { EmptyState } from '../EmptyState.tsx';

export function NotFoundPage() {
  const t = useT();
  return (
    <section className="page">
      <h1>{t('notFound.title')}</h1>
      <EmptyState action={{ href: '/', label: t('notFound.back') }} />
    </section>
  );
}

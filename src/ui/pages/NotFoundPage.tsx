import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';

export function NotFoundPage() {
  const t = useT();
  return (
    <section className="page">
      <h1>{t('notFound.title')}</h1>
      <p>
        <Link href="/">{t('notFound.back')}</Link>
      </p>
    </section>
  );
}

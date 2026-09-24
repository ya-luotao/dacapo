import { useT, type MessageKey } from '../../i18n/index.ts';

export function PlaceholderPage({ title, body }: { title: MessageKey; body: MessageKey }) {
  const t = useT();
  return (
    <section className="page">
      <h1>{t(title)}</h1>
      <p className="muted">{t(body)}</p>
    </section>
  );
}

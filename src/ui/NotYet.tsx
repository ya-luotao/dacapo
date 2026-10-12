import { useT } from '../i18n/index.ts';

/**
 * A level not practised yet, in a list of levels: said to a screen reader, not printed, so that
 * the levels with figures stand out instead of a column of "Not practised yet".
 */
export function NotYet() {
  const t = useT();
  return <span className="visually-hidden">{t('read.level.new')}</span>;
}

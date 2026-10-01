import { useT } from '../../i18n/index.ts';
import { canPrint, printPage } from './print.ts';

/**
 * "Print" (docs/ASSIGNMENTS.md, "On paper"). `part` is a selector of the button's ancestor to
 * print alone; without it the page is printed. Not rendered where printing is not offered.
 */
export function PrintButton({ part }: { part?: string }) {
  const t = useT();
  if (!canPrint()) return null;
  return (
    <button
      type="button"
      className="button"
      onClick={(e) => printPage(part ? e.currentTarget.closest<HTMLElement>(part) : null)}
    >
      {t('assignments.print')}
    </button>
  );
}

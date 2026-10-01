import { currentShell } from '../../lib/shell.ts';

// On paper (docs/ASSIGNMENTS.md, "On paper"): the browser's own print dialog, and the print
// stylesheet (the `@media print` rules at the end of ui/styles.css) lays the page out. A page
// prints its assignment or the report it shows; a report kept on an assignment's page is printed
// alone, marked here for the stylesheet while the dialog is open.

/** Whether printing is offered: not in the Apple app, whose web view does not print. */
export const canPrint = (): boolean => currentShell() === 'web';

/** Prints the page; with `part`, that element of it alone. */
export function printPage(part: HTMLElement | null = null): void {
  if (part) {
    const root = document.documentElement;
    part.dataset.printPart = '';
    root.dataset.print = 'part';
    // Some browsers return from print() before the pages are laid out: the marks stay until then.
    window.addEventListener(
      'afterprint',
      () => {
        delete part.dataset.printPart;
        delete root.dataset.print;
      },
      { once: true },
    );
  }
  window.print();
}

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canPrint, printPage } from './print.ts';

const print = vi.fn();

beforeEach(() => {
  print.mockClear();
  window.print = print;
});

afterEach(() => {
  delete document.documentElement.dataset.shell;
  delete document.documentElement.dataset.print;
  document.body.replaceChildren();
});

describe('canPrint', () => {
  it('is offered in a browser, not in the Apple app', () => {
    expect(canPrint()).toBe(true);
    document.documentElement.dataset.shell = 'apple';
    expect(canPrint()).toBe(false);
  });
});

describe('printPage', () => {
  it('prints the page as it is', () => {
    printPage();
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.print).toBeUndefined();
  });

  it('marks a part for the stylesheet while the dialog is open, and no longer', () => {
    const part = document.createElement('li');
    document.body.append(part);
    // The dialog is open while print() runs: the marks are there for the pages it lays out.
    print.mockImplementationOnce(() => {
      expect(document.documentElement.dataset.print).toBe('part');
      expect(part.hasAttribute('data-print-part')).toBe(true);
    });
    printPage(part);
    expect(print).toHaveBeenCalledTimes(1);
    // A browser that returns before the pages are laid out still finds them marked.
    expect(document.documentElement.dataset.print).toBe('part');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.documentElement.dataset.print).toBeUndefined();
    expect(part.hasAttribute('data-print-part')).toBe(false);

    // Printing the page afterwards prints all of it again.
    printPage();
    expect(document.documentElement.dataset.print).toBeUndefined();
  });
});

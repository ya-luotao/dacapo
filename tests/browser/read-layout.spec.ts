import { expect, test } from '@playwright/test';
import { normalURL } from './servers.ts';

for (const viewport of [
  { width: 874, height: 402 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test(`Read: notation and piano fit a ${viewport.width}×${viewport.height} landscape screen`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`${normalURL}/#/read?family=notes&level=L1`);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const staff = page.locator('.read-card .grand-staff');
    await expect(staff.locator('svg')).toBeVisible();
    // Starting from the setup may retain its scroll offset; measure the layout at its top.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-bottom', '21px');
      window.scrollTo(0, 0);
    });
    const expectLayout = async () => {
      // Wrong answers briefly nudge the card; check its resting layout after that animation.
      await page.locator('.read-card').evaluate(async (card) => {
        await Promise.all(card.getAnimations().map((animation) => animation.finished));
      });
      const box = await staff.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(140);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      // Feedback must not pull the notation away from the viewport's horizontal centre.
      expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
      const feedback = await page.locator('.read-feedback').boundingBox();
      const card = await page.locator('.read-card').boundingBox();
      expect(feedback!.x).toBeGreaterThanOrEqual(card!.x + card!.width);
      const piano = await page.locator('.piano-scroller').boundingBox();
      expect(piano!.y + piano!.height).toBeLessThanOrEqual(viewport.height);
      const stop = await page.getByRole('button', { name: 'Stop', exact: true }).boundingBox();
      expect(stop!.y).toBeGreaterThanOrEqual(0);
      const bar = await page.locator('.read-bar').boundingBox();
      expect(bar!.height).toBeLessThanOrEqual(stop!.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    };
    await expectLayout();
    // Force overflow independently of the host's system-font metrics (macOS vs Linux CI).
    await page.locator('.read-level').evaluate((title) => {
      title.textContent = `${title.textContent} · ${title.textContent} · ${title.textContent}`;
    });
    await expectLayout();
    const title = page.locator('.read-level');
    await expect(title).toHaveCSS('text-overflow', 'ellipsis');
    expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.getByRole('checkbox', { name: 'Show letter names' }).check();
    await expect(page.locator('.read-hint')).not.toBeEmpty();
    // A4 is outside L1's C4–G4 pool, so this is always a wrong answer.
    await page.locator('.piano [data-midi="69"]').click();
    await expect(page.locator('.read-card')).toHaveClass(/is-wrong/);
    await expect(page.locator('.read-target')).toBeVisible();
    await expectLayout();
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    const portrait = await staff.boundingBox();
    expect(portrait!.height).toBeGreaterThan(140);
    await page.setViewportSize(viewport);
    await expectLayout();
    await context.close();
  });
}

import { expect, test, type Page } from '@playwright/test';
import { normalURL, scenarioURL } from './servers.ts';

const pieceHash = '#/pieces/beethoven-ode-to-joy?mode=wait&hands=right&bars=1-4';

async function expectProgress(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  const sessions = page.getByRole('region', { name: 'Sessions', exact: true });
  await expect(sessions.getByRole('listitem')).toHaveCount(10);
  await expect(sessions.getByText('Flashcards', { exact: true })).toHaveCount(5);
  await expect(sessions.getByText('Free play', { exact: true })).toHaveCount(5);
  const heatmap = page.getByRole('region', { name: 'Note by note', exact: true });
  await heatmap.getByText('Show as a table', { exact: true }).click();
  const table = heatmap.getByRole('table');
  await expect(table.getByRole('rowheader')).toHaveCount(5);
  // Five notes with 20 answers each, not merely a nonempty chart.
  await expect(table.getByRole('cell', { name: '20', exact: true })).toHaveCount(5);
}

async function playOpening(page: Page): Promise<void> {
  const score = page.getByRole('img', { name: 'Score: Ode to Joy', exact: true });
  await expect(score.locator('svg').first()).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Wait', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Right', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Loop from bar' })).toHaveValue('0');
  await expect(page.getByRole('combobox', { name: 'Loop to bar' })).toHaveValue('3');
  // A is C4, not the opening E4: the wrong key must leave the cursor at step 1.
  await page.keyboard.press('a');
  await expect(
    page.getByText('Bar 1 · beat 1 · step 1 of 15 · 1 wrong', { exact: true }),
  ).toBeVisible();
  for (const [key, position] of [
    ['d', 'Bar 1 · beat 2 · step 2 of 15'],
    ['d', 'Bar 1 · beat 3 · step 3 of 15'],
    ['f', 'Bar 1 · beat 4 · step 4 of 15'],
    ['g', 'Bar 2 · beat 1 · step 5 of 15'],
  ] as const) {
    await page.keyboard.press(key);
    await expect(page.getByText(position, { exact: true })).toBeVisible();
  }
}

test('empty: onboarding reaches the first lesson and reload forgets the answer', async ({
  page,
}) => {
  await page.goto(scenarioURL('empty'));
  await expect(page.getByRole('radio', { name: /I am new to the piano/ })).toBeChecked();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page).toHaveURL(/#\/learn\/keyboard$/);
  await expect(
    page.getByRole('heading', { name: /Finding your way around the keyboard/ }),
  ).toBeVisible();
  // Save a different answer so keeping the previous preference cannot look like a reset.
  await page.goto(`${scenarioURL('empty')}/#/start`);
  await page.getByRole('radio', { name: /I play already/ }).check();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.reload();
  await expect(page).toHaveURL(/#\/start$/);
  await expect(page.getByRole('heading', { name: 'Start', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /I am new to the piano/ })).toBeChecked();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Progress' })
    .click();
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start a Read session' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sessions', exact: true })).toHaveCount(0);
});

test('progress: figures render, edits reset, and repeated loads do not accumulate records', async ({
  page,
}) => {
  await page.goto(scenarioURL('progress'));
  await expectProgress(page);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  // The test server has a sync endpoint, but the scenario must not expose account actions.
  await expect(page.getByRole('region', { name: 'Account', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page).toHaveURL(/#\/progress$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectProgress(page);
});

test('piece: wrong notes wait, computer keys advance, and reload resets the run', async ({
  page,
}) => {
  await page.goto(scenarioURL('piece'));
  await playOpening(page);
  await page.reload();
  await expect(page.getByText('Bar 1 · beat 1 · step 1 of 15', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toHaveCount(0);
});

test('a second scenario tab cannot reset the first, then can start after it closes', async ({
  page,
  context,
}) => {
  await page.goto(scenarioURL('progress'));
  await expectProgress(page);
  const second = await context.newPage();
  await second.goto(scenarioURL('progress'));
  await expect(
    second.getByText(
      'Dev scenario stopped: This scenario is open in another tab. Close it, then reload.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Sessions', exact: true }).getByRole('listitem'),
  ).toHaveCount(10);
  await page.close();
  await second.reload();
  await expectProgress(second);
});

for (const existing of ['preferences', 'database']) {
  test(`an origin with existing ${existing} is refused without changing its data`, async ({
    page,
  }) => {
    // Same origin, but no app startup: create pre-existing data before opening the scenario.
    await page.goto(`${scenarioURL('empty')}/favicon.svg`);
    await page.evaluate(async (kind) => {
      if (kind === 'preferences') {
        localStorage.setItem('dacapo.start', '{"from":"player","reads":"bass"}');
      } else {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('personal-practice', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('records');
          request.onerror = () =>
            reject(new Error('Opening existing data', { cause: request.error }));
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('records', 'readwrite');
            tx.objectStore('records').put('keep this practice', 'original');
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => {
              db.close();
              reject(new Error('Writing existing data', { cause: tx.error }));
            };
          };
        });
      }
    }, existing);
    await page.goto(scenarioURL('empty'));
    await expect(
      page.getByText(
        'Dev scenario stopped: Existing data is not a dev scenario. Use a fresh browser profile.',
        { exact: true },
      ),
    ).toBeVisible();
    const kept = await page.evaluate(async () => ({
      preference: localStorage.getItem('dacapo.start'),
      databases: (await indexedDB.databases()).map((db) => db.name),
    }));
    expect(kept).toEqual(
      existing === 'preferences'
        ? { preference: '{"from":"player","reads":"bass"}', databases: [] }
        : { preference: null, databases: ['personal-practice'] },
    );
    if (existing === 'database') {
      const record = await page.evaluate(
        () =>
          new Promise<string>((resolve, reject) => {
            const request = indexedDB.open('personal-practice');
            request.onerror = () =>
              reject(new Error('Reading existing data', { cause: request.error }));
            request.onsuccess = () => {
              const db = request.result;
              const read = db.transaction('records').objectStore('records').get('original');
              read.onsuccess = () => {
                db.close();
                resolve(String(read.result));
              };
              read.onerror = () => {
                db.close();
                reject(new Error('Reading record', { cause: read.error }));
              };
            };
          }),
      );
      expect(record).toBe('keep this practice');
    }
  });
}

test('ordinary development keeps a real practice session and theme across scenario resets', async ({
  page,
  context,
}) => {
  await page.goto(`${normalURL}/${pieceHash}`);
  await playOpening(page);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.goto(`${normalURL}/#/progress`);
  const sessions = page.getByRole('region', { name: 'Sessions', exact: true });
  await expect(sessions.getByRole('listitem')).toHaveCount(1);
  await expect(sessions.getByText('Ode to Joy', { exact: true })).toBeVisible();
  await page.goto(`${normalURL}/#/settings`);
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();

  const scenario = await context.newPage();
  await scenario.goto(scenarioURL('progress'));
  await expectProgress(scenario);
  await scenario.reload();
  await expectProgress(scenario);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.goto(`${normalURL}/#/progress`);
  await expect(sessions.getByRole('listitem')).toHaveCount(1);
  await expect(sessions.getByText('Ode to Joy', { exact: true })).toBeVisible();
});

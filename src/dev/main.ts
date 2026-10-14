import { prepareScenario } from './prepare.ts';

async function start(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.DACAPO_DEV_SCENARIOS !== true) {
    throw new Error('Use pnpm dev:empty, pnpm dev:progress or pnpm dev:piece.');
  }
  if (!navigator.locks) {
    throw new Error('Dev scenarios need Web Locks: use Chrome or Edge on localhost or HTTPS.');
  }
  await navigator.locks.request('dacapo-dev-scenario', { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error('This scenario is open in another tab. Close it, then reload.');
    const hash = await prepareScenario(import.meta.env.MODE, Date.now(), () => {
      show('Close other tabs using this origin to finish resetting the dev scenario.');
    });
    // A reload returns to the scenario, even after navigating elsewhere in the app.
    history.replaceState(null, '', `${location.pathname}${hash}`);
    // Preferences, records and the route must be ready before app modules read them.
    await import('../main.tsx');
    await new Promise<void>(() => {
      // Keep the lock until this document unloads; a second tab must not erase its practice.
    });
  });
}

function show(message: string): void {
  const root = document.getElementById('root');
  if (root) root.textContent = message;
}

show('Preparing disposable dev scenario…');
void start().catch((error: unknown) => {
  show(`Dev scenario stopped: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
});

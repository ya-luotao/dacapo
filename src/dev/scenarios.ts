/** Reserved development origins, separate from ordinary development and production. */
const SCENARIOS = {
  empty: { port: 5174, hash: '#/start' },
  progress: { port: 5175, hash: '#/progress' },
  piece: { port: 5176, hash: '#/pieces/beethoven-ode-to-joy?mode=wait&hands=right&bars=1-4' },
} as const;

export function devScenario(name: string) {
  if (!Object.hasOwn(SCENARIOS, name)) {
    throw new Error(`Unknown dev scenario: ${name}. Choose empty, progress or piece.`);
  }
  return { name, ...SCENARIOS[name as keyof typeof SCENARIOS] };
}

import { devScenario } from '../../src/dev/scenarios.ts';

export const normalURL = 'http://127.0.0.1:5173';

export function scenarioURL(name: string): string {
  return `http://127.0.0.1:${devScenario(name).port}`;
}

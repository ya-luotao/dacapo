import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Measured expensive suites. The fast tier excludes this list; all other tests enter fast.
export const regressionTests = [
  'src/core/scaleXml.test.ts',
  'src/core/sightFragment.test.ts',
  'src/pieces/library/leadSheets.test.ts',
  'src/pieces/library/transposed.test.ts',
  'src/site/render.test.ts',
  'src/ui/pieces/keyboard88diff.test.ts',
];

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    // Replace, rather than merge, the full suite's include patterns.
    include: regressionTests,
  },
});

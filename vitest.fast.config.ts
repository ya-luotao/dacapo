import { configDefaults, defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';
import { regressionTests } from './vitest.regression.config.ts';

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    exclude: [...(viteConfig.test?.exclude ?? configDefaults.exclude), ...regressionTests],
  },
});

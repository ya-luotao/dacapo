import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // A sub-path such as `/dacapo/` when the app is served below the site root; `/` by default.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rolldownOptions: {
      output: {
        // React in a chunk of its own: it changes with a dependency update, not with every
        // release, so a returning visitor keeps it cached while the app's own chunk changes.
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});

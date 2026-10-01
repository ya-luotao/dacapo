import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist', 'coverage', '.lane', '.claude', '.wrangler', 'apple/build']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // Scripts the Apple app injects into the page (apple/Dacapo): plain browser scripts.
    files: ['apple/Dacapo/**/*.js'],
    languageOptions: { globals: { ...globals.browser, webkit: 'readonly' } },
  },
  {
    // The offline worker (docs/OFFLINE.md) and the plain script that withdraws it.
    files: ['src/offline/sw.ts', 'scripts/offline/*.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  prettier,
);

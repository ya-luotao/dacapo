import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * Cloudflare Web Analytics on the official site (https://playdacapo.com): visit counts without
 * cookies or personal data. Its token is a build variable of the site's Workers Builds,
 * `CF_BEACON_TOKEN`, not in the repository; any other build (dev, a fork, the tests, the Apple
 * app) has none and loads nothing.
 */
function webAnalytics(token = process.env.CF_BEACON_TOKEN): Plugin {
  return {
    name: 'dacapo-web-analytics',
    apply: 'build',
    transformIndexHtml(html) {
      if (!token) return html;
      // It goes into an attribute as it is: a token has letters, digits, `-` and `_` only.
      if (!/^[\w-]{16,64}$/.test(token)) {
        throw new Error('CF_BEACON_TOKEN is not a Cloudflare Web Analytics token');
      }
      const beacon =
        '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" ' +
        `data-cf-beacon='{"token": "${token}"}'></script>`;
      return html.replace('</body>', `  ${beacon}\n  </body>`);
    },
  };
}

export default defineConfig({
  // A sub-path such as `/dacapo/` when the app is served below the site root; `/` by default.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), webAnalytics()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});

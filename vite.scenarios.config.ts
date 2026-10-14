import { defineConfig } from 'vite';
import { devScenario } from './src/dev/scenarios.ts';
import viteConfig from './vite.config.ts';

export default defineConfig(({ command, mode, isPreview }) => {
  if (command !== 'serve' || isPreview)
    throw new Error('Dev scenarios cannot be built or previewed.');
  const scenario = devScenario(mode);
  return {
    ...viteConfig,
    base: '/',
    define: {
      ...viteConfig.define,
      'import.meta.env.DACAPO_DEV_SCENARIOS': true,
      // A real endpoint in the shell or .env must never receive fixture records.
      'import.meta.env.VITE_SYNC_ENDPOINT': JSON.stringify(''),
    },
    server: {
      port: scenario.port,
      strictPort: true,
      allowedHosts: process.env.PUBLIC_URL ? [new URL(process.env.PUBLIC_URL).hostname] : [],
    },
    plugins: [
      ...(viteConfig.plugins ?? []),
      {
        name: 'dacapo-dev-scenario',
        configResolved(config) {
          if (config.server.port !== scenario.port || !config.server.strictPort) {
            throw new Error(`The ${mode} scenario must use port ${scenario.port} with strictPort.`);
          }
        },
        transformIndexHtml: {
          order: 'pre',
          handler: (html) => html.replace('/src/main.tsx', '/src/dev/main.ts'),
        },
      },
    ],
  };
});

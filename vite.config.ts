import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Mantemos o server.allowedHosts por segurança, caso o modo dev ainda seja um fallback.
  server: {
    host: true,
    allowedHosts: [
      'automacao-boltdiy.0rau8r.easypanel.host'
    ],
  },
  plugins: [
    remixCloudflareDevProxy(),
    remixVitePlugin({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    UnoCSS(),
    tsconfigPaths(),
    optimizeCssModules({ apply: 'build' }),
    nodePolyfills({
      include: ['buffer'],
      globals: {
        Buffer: true,
      },
      protocolImports: true,
    }),
  ],
});

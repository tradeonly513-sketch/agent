import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig(({ isSsrBuild, mode }) => {
  const isProd = mode === 'production';

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || mode),
    },

    // ----- build output (keep simple) -----
    build: {
      target: 'esnext',
      sourcemap: false,
      minify: false,
      rollupOptions: { output: { manualChunks: undefined } },
    },

    // ----- make SSR resolve to real Node built-ins -----
    resolve: {
      alias: {
        buffer: 'node:buffer',
        process: 'node:process',
        stream: 'node:stream',
        util: 'node:util',
      },
    },

    // (optional, fine as defaults)
    ssr: {
      // keep React external handling default; nothing forced here
    },

    // ----- dev/preview servers (your Render host values kept) -----
    server: {
      host: '0.0.0.0',
      port: Number(process.env.PORT) || 5173,
      strictPort: true,
      allowedHosts: ['bolt-diy-zpsr.onrender.com'],
      hmr: { host: 'bolt-diy-zpsr.onrender.com', protocol: 'wss', clientPort: 443 },
    },
    preview: {
      host: '0.0.0.0',
      port: Number(process.env.PORT) || 5173,
      allowedHosts: ['bolt-diy-zpsr.onrender.com'],
    },

    plugins: [
      // IMPORTANT: polyfills ONLY for the client build
      !isSsrBuild &&
        nodePolyfills({
          include: ['buffer', 'process', 'util', 'stream'],
          globals: { Buffer: true, process: true, global: true },
          protocolImports: true,
          exclude: ['child_process', 'fs', 'path'],
        }),

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
      chrome129IssuePlugin(),
      isProd && optimizeCssModules({ apply: 'build' }),
    ].filter(Boolean),

    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],

    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  };
});

// same helper you already had
function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);
        if (raw) {
          const version = parseInt(raw[2], 10);
          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );
            return;
          }
        }
        next();
      });
    },
  };
}

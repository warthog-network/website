// astro.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify';

const root = path.dirname(fileURLToPath(import.meta.url));


export default defineConfig({
  output: 'server',
  integrations: [react(), tailwind(), mdx()],
  adapter: netlify({
    functionPerRoute: false,
    cacheOnDemandPages: true,
  }),
experimental: {
  csp: {
    directives: [
      "default-src 'self' https://api.coingecko.com",
      "connect-src 'self' ws: wss: https://api.coingecko.com http://localhost:3000 https://warthognode.duckdns.org http://65.87.7.86:3001",
      "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
      "img-src 'self' data:",
      "object-src 'self'",
      "frame-src 'self' https://docs.google.com https://*.googleusercontent.com https://drive.google.com"
    ],
    styleDirective: {
      resources: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
    }
  }
},
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        '@': path.resolve(root, 'src'),
      },
    },
    ssr: {
      noExternal: ['crypto-browserify', 'stream-browserify'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  },
});

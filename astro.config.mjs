// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify';


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
      "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://api.coingecko.com",
      "connect-src 'self' ws: wss: https://api.coingecko.com http://localhost:3000",
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
      alias: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
         '@': '/src' // Points @/ to your src/ folder
      },
  
    },
    ssr: {
      noExternal: ['crypto-browserify', 'stream-browserify'],
    },
    optimizeDeps: {
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

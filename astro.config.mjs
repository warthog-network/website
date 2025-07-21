import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwind from '@astrojs/tailwind';

import mdx from '@astrojs/mdx';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  integrations: [react(), tailwind(), mdx()],
  adapter: netlify(),
  vite: {  // Add this vite configuration object
    resolve: {
      alias: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
      },
    },
    ssr: {
      noExternal: ['crypto-browserify'],  // Ensure the polyfill is bundled in SSR
    },
  },
});
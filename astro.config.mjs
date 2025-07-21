import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwind from '@astrojs/tailwind';

import mdx from '@astrojs/mdx';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [react(), tailwind(), mdx()],
  adapter: netlify({
    functionPerRoute: true  // Already set; keeps separate Functions
  }),
  vite: {
    // Removed server.proxy entirely – no need for dev proxying
    resolve: {
      alias: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
      },
    },
    ssr: {
      noExternal: ['crypto-browserify'],  
    },
  },
});
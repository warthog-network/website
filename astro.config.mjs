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
    functionPerRoute: true  // Enable this to generate separate functions per route
  }),
  vite: {  
    vite: {
    server: {
      proxy: {
        '/api/proxy': {
          target: 'https://warthognode.duckdns.org',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
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
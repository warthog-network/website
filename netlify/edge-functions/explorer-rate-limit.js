// Caps /api/explorer/* per visitor IP. Same Netlify behavior as the
// proxy limit: over the limit is HTTP 429 with no Astro SSR invocation.
// The explorer polls head and stats every 15s and an address every 30s.
// 120/minute covers a few open tabs and stops an address scrape.
export default async (_request, context) => context.next();

export const config = {
  path: '/api/explorer/*',
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

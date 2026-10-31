// Caps /api/proxy per visitor IP. Netlify applies this before the
// function runs: over the limit the request is HTTP 429 and Astro SSR
// (the node proxy) is not invoked.
//
// One IP on 31 Oct 2026 sent 6,226 proxy calls from 11:34 to 12:24,
// about 125 a minute, mostly parallel chain/block lookups. 240 sits
// above that line, so it would not have dropped any of them.
// 30/minute still fits the 30s head and balance polls plus one block
// burst, and cuts a client sitting at ~125/minute. Shared carrier NATs
// share this budget. Enforcement can lag about 10 seconds.
export default async (_request, context) => context.next();

export const config = {
  path: '/api/proxy',
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

import { fetchIndexerJson } from '../../../lib/explorerIndexer/server.js';

/**
 * GET /api/explorer/account-history?address=...&page=1&count=15&includeTotal=0
 * Proxies indexer paginated address transaction history (fast path).
 */
export async function GET({ request }) {
  const url = new URL(request.url);
  const address = String(url.searchParams.get('address') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{48}$/.test(address)) {
    return new Response(JSON.stringify({ code: 1, error: 'Invalid address format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const page = url.searchParams.get('page') || '1';
  const count = url.searchParams.get('count') || '15';
  // Default off — total COUNT is expensive on mega-miners.
  const includeTotal = url.searchParams.get('includeTotal') || '0';

  try {
    const data = await fetchIndexerJson(
      `/api/explorer/accounts/${address}/transactions`,
      { searchParams: { page, count, includeTotal } },
    );
    return new Response(JSON.stringify({ code: 0, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      code: 1,
      error: err?.message || 'Indexer unavailable',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

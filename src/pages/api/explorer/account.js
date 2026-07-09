import { fetchIndexerJson } from '../../../lib/explorerIndexer/server.js';

/**
 * GET /api/explorer/account?address=...&includeTxCount=0
 * Proxies indexer account summary (balance, etc.).
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

  // Default off — COUNT over millions of miner txs is the slow path.
  const includeTxCount = url.searchParams.get('includeTxCount') || '0';

  try {
    const data = await fetchIndexerJson(`/api/explorer/accounts/${address}`, {
      searchParams: { includeTxCount },
    });
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

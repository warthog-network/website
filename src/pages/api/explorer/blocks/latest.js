import { fetchIndexerJson } from '../../../../lib/explorerIndexer/server.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const count = url.searchParams.get('count') || '10';

  try {
    const data = await fetchIndexerJson('/api/explorer/blocks/latest', {
      searchParams: { count },
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
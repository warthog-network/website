import { fetchIndexerJson } from '../../../../lib/explorerIndexer/server.js';

export async function GET() {
  try {
    const data = await fetchIndexerJson('/api/explorer/chain/head');
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
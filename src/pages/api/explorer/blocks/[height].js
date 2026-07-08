import { fetchIndexerJson } from '../../../../lib/explorerIndexer/server.js';

export async function GET({ params }) {
  const height = Number(params.height);
  if (!Number.isFinite(height) || height < 1) {
    return new Response(JSON.stringify({ code: 1, error: 'Invalid height' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await fetchIndexerJson(`/api/explorer/blocks/${height}`);
    return new Response(JSON.stringify({ code: 0, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const status = (err?.message || '').includes('404') ? 404 : 502;
    return new Response(JSON.stringify({
      code: 1,
      error: err?.message || 'Indexer unavailable',
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
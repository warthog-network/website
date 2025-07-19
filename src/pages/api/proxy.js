export const prerender = false;

export const GET = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const nodePath = url.searchParams.get('nodePath');
    const nodeBase = url.searchParams.get('nodeBase') || 'https://node.wartscan.io';
    if (!nodePath) {
      return new Response(JSON.stringify({ error: 'Missing nodePath query parameter' }), { status: 400 });
    }
    const targetUrl = `${nodeBase}/${nodePath}`;
    const response = await fetch(targetUrl, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Proxy GET error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const POST = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const nodePath = url.searchParams.get('nodePath');
    const nodeBase = url.searchParams.get('nodeBase') || 'https://node.wartscan.io';
    if (!nodePath) {
      return new Response(JSON.stringify({ error: 'Missing nodePath query parameter' }), { status: 400 });
    }
    const body = await request.json();
    const targetUrl = `${nodeBase}/${nodePath}`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Proxy POST error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
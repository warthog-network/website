export async function GET({ request }) {
  const url = new URL(request.url);
  const nodePath = url.searchParams.get('nodePath');
  const nodeBase = url.searchParams.get('nodeBase');
  if (!nodePath || !nodeBase) {
    return new Response('Missing params', { status: 400 });
  }
  const targetUrl = nodeBase.replace(/\/$/, '') + '/' + nodePath.replace(/^\//, '');
  const response = await fetch(targetUrl);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
}

export async function POST({ request }) {
  const url = new URL(request.url);
  const nodePath = url.searchParams.get('nodePath');
  const nodeBase = url.searchParams.get('nodeBase');
  if (!nodePath || !nodeBase) {
    return new Response('Missing params', { status: 400 });
  }
  const targetUrl = nodeBase.replace(/\/$/, '') + '/' + nodePath.replace(/^\//, '');
  const body = await request.text();
  const response = await fetch(targetUrl, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
}

import { rejectFakeMineIfRemote, rejectLocalNodeInProxy } from '../../lib/proxyGuards.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

async function forwardToNode({ nodeBase, nodePath, method = 'GET', body = null }) {
  if (!nodePath || !nodeBase) {
    return jsonResponse({ code: 1, error: 'Missing params' }, 400);
  }

  const localNodeRejection = rejectLocalNodeInProxy(nodeBase);
  if (localNodeRejection) {
    return new Response(localNodeRejection.body, {
      status: localNodeRejection.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }

  const fakeMineRejection = rejectFakeMineIfRemote(nodePath, nodeBase);
  if (fakeMineRejection) {
    return new Response(fakeMineRejection.body, {
      status: fakeMineRejection.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }

  const targetUrl = nodeBase.replace(/\/$/, '') + '/' + nodePath.replace(/^\//, '');
  const controller = new AbortController();
  // Account history on busy miners is often 7–10s server-side; give it headroom.
  const isSlowPath = /account\/[^/]+\/history\//i.test(String(nodePath || ''));
  const timeoutMs = isSlowPath ? 25000 : 12000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = {
    method,
    signal: controller.signal,
    headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' },
  };

  if (method !== 'GET' && method !== 'HEAD' && body != null) {
    fetchOptions.body = body;
    fetchOptions.headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';

    // Always return JSON to the browser so warthog-js clients never choke on
    // plain-text timeouts / HTML error pages from upstream.
    if (!contentType.includes('application/json')) {
      const trimmed = text.trim();
      let parsed = null;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // not JSON
      }
      if (parsed && typeof parsed === 'object') {
        return jsonResponse(parsed, response.status);
      }

      const preview = trimmed.slice(0, 160).replace(/\s+/g, ' ');
      return jsonResponse(
        {
          code: 1,
          error: preview
            ? `Upstream returned non-JSON (HTTP ${response.status}): ${preview}`
            : `Upstream returned empty/non-JSON response (HTTP ${response.status})`,
        },
        response.ok ? 502 : response.status,
      );
    }

    // Valid JSON content-type — pass body through with status, force JSON content-type.
    if (!text.trim()) {
      return jsonResponse(
        {
          code: 1,
          error: `Upstream returned empty JSON body (HTTP ${response.status}) for ${nodePath}`,
        },
        response.ok ? 502 : response.status,
      );
    }

    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return jsonResponse(
        {
          code: 1,
          error: `Node request timed out contacting ${nodeBase}. The node may be offline or unreachable from the server.`,
        },
        408,
      );
    }
    return jsonResponse(
      {
        code: 1,
        error: `Upstream fetch failed for ${nodeBase}: ${error.message || 'network error'}`,
      },
      502,
    );
  }
}

export async function GET({ request }) {
  const url = new URL(request.url);
  return forwardToNode({
    nodeBase: url.searchParams.get('nodeBase'),
    nodePath: url.searchParams.get('nodePath'),
    method: 'GET',
  });
}

export async function POST({ request }) {
  const url = new URL(request.url);
  const queryNodePath = url.searchParams.get('nodePath');
  const queryNodeBase = url.searchParams.get('nodeBase');
  const contentType = request.headers.get('content-type') || '';

  // Read the body at most once. The webwallet posts raw tx JSON with
  // nodeBase/nodePath in the query string; warthog-js posts an envelope
  // { nodeBase, nodePath, method, body }. Re-reading request.text() after
  // request.json() throws and Netlify returns HTTP 500 with an empty body.
  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    rawText = '';
  }

  let parsed = null;
  if (rawText && contentType.includes('application/json')) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  // Envelope style used by browserWarthogApi / warthog-js
  if (
    parsed
    && typeof parsed === 'object'
    && parsed.nodeBase
    && parsed.nodePath != null
  ) {
    const forwardBody = parsed.body != null
      ? JSON.stringify(parsed.body)
      : null;
    return forwardToNode({
      nodeBase: parsed.nodeBase,
      nodePath: parsed.nodePath,
      method: parsed.method || 'GET',
      body: forwardBody,
    });
  }

  // Legacy style: query params + raw body (webwallet send transaction)
  if (!queryNodePath || !queryNodeBase) {
    return jsonResponse({ code: 1, error: 'Missing params' }, 400);
  }

  const legacyBody = parsed != null
    ? JSON.stringify(parsed)
    : (rawText || null);

  return forwardToNode({
    nodeBase: queryNodeBase,
    nodePath: queryNodePath,
    method: 'POST',
    body: legacyBody,
  });
}

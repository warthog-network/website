const PROXY_URL = '/api/proxy';

function parseNodeResponse(text, { httpStatus } = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    throw new Error(
      httpStatus
        ? `Node returned empty body (HTTP ${httpStatus})`
        : 'Node returned empty body',
    );
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, ' ');
    const hint = preview.startsWith('<') || preview.startsWith('<!')
      ? 'Node returned HTML instead of JSON. Check the node URL and port (API paths like /chain/head should return JSON). HTTP nodes on the live HTTPS site are reached via the server proxy.'
      : `Node returned non-JSON: ${preview}`;
    throw new Error(hint);
  }
}

/**
 * Browser WarthogApi: direct fetch for loopback nodes on HTTP pages; JSON POST proxy otherwise.
 * Avoids putting http:// node URLs in query strings (WAF/HTML issues on some hosts).
 */
export function createBrowserWarthogApi(WarthogApi, baseUrl, { useProxy = false } = {}) {
  class BrowserWarthogApi extends WarthogApi {
    constructor(normalizedBase, proxy) {
      super(normalizedBase, { proxyUrl: null });
      this._useProxy = proxy;
    }

    async request(path, options = {}) {
      let nodePath = path.replace(/^\//, '');

      if (options.queryParams) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.queryParams)) {
          params.append(key, String(value));
        }
        const qs = params.toString();
        if (qs) {
          nodePath = `${nodePath}?${qs}`;
        }
      }

      const replacer = (_key, value) => (typeof value === 'bigint' ? Number(value) : value);

      let response;
      if (this._useProxy) {
        const envelope = {
          nodeBase: this.baseUrl,
          nodePath,
          method: options.method || 'GET',
        };
        if (options.body) {
          envelope.body = JSON.parse(JSON.stringify(options.body, replacer));
        }
        response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(envelope),
        });
      } else {
        const url = nodePath ? `${this.baseUrl}/${nodePath}` : `${this.baseUrl}/`;
        const body = options.body ? JSON.stringify(options.body, replacer) : undefined;
        response = await fetch(url, {
          method: options.method || 'GET',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
        });
      }

      const text = await response.text();
      let json;
      try {
        json = parseNodeResponse(text, { httpStatus: response.status });
      } catch (err) {
        // Prefer structured message; still surface HTTP status when body was unusable.
        if (!response.ok) {
          throw new Error(
            `${err.message} (HTTP ${response.status})`,
          );
        }
        throw err;
      }

      if (!response.ok && (json.code === undefined || json.code === 0)) {
        // HTTP error without a Warthog `{code,error}` envelope.
        return {
          success: false,
          code: response.status,
          error: json.error || json.message || `HTTP error! status: ${response.status}`,
        };
      }

      if (json.code !== 0) {
        return {
          success: false,
          code: json.code,
          error: json.error || 'Unknown error',
        };
      }

      return { success: true, data: json.data };
    }

    /** Fetch a block by height. */
    getBlock(height) {
      return this.request(`/chain/block/${height}`);
    }

    /** Generic node path (explorer lookups, binary block data, etc.). */
    getNodePath(path) {
      const normalized = String(path || '').startsWith('/') ? path : `/${path}`;
      return this.request(normalized);
    }

    getAccountBalance(address) {
      return this.request(`/account/${address}/balance`);
    }

    /** Legacy alias used by some balance helpers. */
    getAccountWartBalance(address) {
      return this.getAccountBalance(address);
    }

    getAccountHistory(account, cursor) {
      return this.request(`/account/${account}/history/${cursor}`);
    }
  }

  const normalized = baseUrl.replace(/\/+$/, '');
  return new BrowserWarthogApi(normalized, useProxy);
}

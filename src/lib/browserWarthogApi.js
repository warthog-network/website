import { nodeHttpUrl } from './nodeAccess.js';

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
      ? 'Node returned HTML instead of JSON. Check the node URL and port (API paths like /chain/head should return JSON).'
      : `Node returned non-JSON: ${preview}`;
    throw new Error(hint);
  }
}

/**
 * Browser WarthogApi. Calls the node URL directly.
 * An HTTPS page cannot call a plain HTTP node.
 */
export function createBrowserWarthogApi(WarthogApi, baseUrl) {
  class BrowserWarthogApi extends WarthogApi {
    constructor(normalizedBase) {
      super(normalizedBase, { proxyUrl: null });
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

      const url = nodeHttpUrl(this.baseUrl, nodePath);
      const body = options.body ? JSON.stringify(options.body, replacer) : undefined;
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body,
      });

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
  return new BrowserWarthogApi(normalized);
}

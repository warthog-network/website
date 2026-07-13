import { ensureWorkerCrypto } from './ensureBuffer.js';
import { shouldUseNodeProxy } from './nodeAccess.js';
import { createBrowserWarthogApi } from './browserWarthogApi.js';

let WarthogApiClass = null;

async function loadWarthogApiClass() {
  if (!WarthogApiClass) {
    await ensureWorkerCrypto();
    ({ WarthogApi: WarthogApiClass } = await import('warthog-js'));
  }
  return WarthogApiClass;
}

/** Normalize a node base URL from user input. */
export function normalizeNodeUrl(nodeBase) {
  let normalized = String(nodeBase || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  return normalized;
}

/**
 * Create a WarthogApi client for browser use.
 * Loopback nodes on HTTP pages connect directly; everything else uses /api/proxy.
 */
export async function createWarthogApi(nodeBase) {
  const WarthogApi = await loadWarthogApiClass();
  const normalized = normalizeNodeUrl(nodeBase);
  return createBrowserWarthogApi(WarthogApi, normalized, {
    useProxy: shouldUseNodeProxy(normalized),
  });
}

/** Unwrap a WarthogApi result or throw with the node error message. */
export function unwrapApiData(result) {
  if (!result?.success) {
    throw new Error(result?.error || 'Request failed');
  }
  return result.data;
}

/** Convert WarthogApi result to the legacy `{ code, data, error }` shape. */
export function toNodeResponse(result) {
  if (result.success) {
    return { code: 0, data: result.data };
  }
  return { code: result.code, error: result.error };
}

/** GET a node path and return the legacy `{ code, data, error }` response shape. */
export async function getNodeData(api, path) {
  return toNodeResponse(await api.getNodePath(path));
}
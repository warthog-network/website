/**
 * Shared address-history loader + cache for SPA navigation.
 *
 * Problem this solves: React Router remounts (and Strict Mode) cancel in-component
 * fetches mid-flight, so a successful history response is discarded and the UI
 * sticks on "No transactions found" until a manual refresh.
 *
 * Strategy:
 * - Prefer the site indexer for official node (fast even for mega-miners)
 * - Fall back to node cursor history for custom nodes
 * - One in-flight promise per account+host (shared across remounts)
 * - Always write successful results to cache
 */

import { createWarthogApi } from '../components/explorer/explorerClient.js';
import { parseAccountHistory, isEmptyHistoryError } from '../components/explorer/explorerApi.js';
import { parseWartBalanceFromApi } from '../components/explorer/explorerAddressUtils.js';
import {
  resolveExplorerHostFromStorage,
  nodeHasIndexer,
  normalizeSelectedNode,
} from './explorerNodes.js';
import { fetchIndexerAccountTransactions } from '../components/explorer/explorerIndexerClient.js';

const INITIAL_CURSOR = '4294967295';
const CACHE_TTL_MS = 120_000;
const INDEXER_PAGE_SIZE = 15;

/** @type {Map<string, { items: any[], nextCursor: string|null, hasMore: boolean, balance: string|null, at: number }>} */
const cache = new Map();

/** @type {Map<string, Promise<any>>} */
const inflight = new Map();

/** @type {Map<string, any>} */
const apiByHost = new Map();

function keyFor(account, host) {
  const a = String(account || '').trim().toLowerCase().replace(/^0x/i, '');
  const h = String(host || '').replace(/\/$/, '');
  return `${h}::${a}`;
}

async function apiForHost(host) {
  const h = host.replace(/\/$/, '');
  if (!apiByHost.has(h)) {
    apiByHost.set(h, createWarthogApi(h));
  }
  return apiByHost.get(h);
}

function useIndexerForHost(host) {
  // Official indexer host → always use indexed history.
  // Custom nodes keep node RPC history.
  if (typeof window === 'undefined') {
    return true;
  }
  const selected = normalizeSelectedNode(localStorage.getItem('selectedNode'));
  if (nodeHasIndexer(selected)) return true;
  // Also match when host is official even if selection key is odd/legacy
  const h = String(host || '').replace(/\/$/, '');
  return /warthognode\.duckdns\.org$/i.test(h.replace(/^https?:\/\//, '').split('/')[0]);
}

/** Map UI cursor → indexer page number. */
function cursorToPage(cursor) {
  if (cursor == null || cursor === '' || cursor === INITIAL_CURSOR) return 1;
  const n = Number(cursor);
  if (Number.isFinite(n) && n >= 1 && n < 1e9) return Math.floor(n);
  // Legacy node cursors are huge numbers — treat as first page for indexer path
  return 1;
}

export function readAddressHistoryCache(account, host) {
  const key = keyFor(account, host);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function clearAddressHistoryCache(account, host) {
  if (account && host) {
    cache.delete(keyFor(account, host));
    inflight.delete(keyFor(account, host));
    return;
  }
  cache.clear();
  inflight.clear();
}

async function loadFromIndexer(account, cursor, isFirstPage) {
  const page = cursorToPage(cursor);

  // History only — balance is loaded in parallel by AddressTransactions via
  // fetchIndexerAccount so we don't pay for a second account round-trip here.
  const history = await fetchIndexerAccountTransactions(account, page, INDEXER_PAGE_SIZE);

  const items = history.items || [];
  const nextCursor = history.nextPage != null ? String(history.nextPage) : null;
  const hasMore = Boolean(history.hasMore);

  return {
    items,
    nextCursor,
    hasMore,
    balance: null,
    empty: items.length === 0 && isFirstPage,
    blockCount: items.length,
    source: 'indexer',
    page: history.page,
  };
}

async function loadFromNode(account, host, cursor, isFirstPage) {
  const api = await apiForHost(host);
  let lastErr = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await api.getAccountHistory(account, cursor);

      if (!result?.success) {
        if (isEmptyHistoryError(result?.error)) {
          return {
            items: [],
            nextCursor: null,
            hasMore: false,
            balance: null,
            empty: true,
            source: 'node',
          };
        }
        throw new Error(result?.error || 'Failed to fetch transaction history');
      }

      const parsed = parseAccountHistory(result.data);
      if (!parsed) {
        throw new Error('Unexpected response format from node history endpoint');
      }

      const balance = parseWartBalanceFromApi(result.data);
      const nextCursor = parsed.fromId > 0 ? String(parsed.fromId) : null;
      const hasMore = parsed.items.length > 0 && parsed.fromId > 0;

      return {
        items: parsed.items,
        nextCursor,
        hasMore,
        balance,
        empty: parsed.items.length === 0,
        blockCount: parsed.blockCount || 0,
        source: 'node',
      };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  throw lastErr || new Error('Failed to fetch transaction history');
}

/**
 * Fetch a page of account history (shared / deduped).
 * @param {string} account normalized address
 * @param {object} [opts]
 * @param {string} [opts.host]
 * @param {string} [opts.cursor] node cursor OR indexer page number
 * @param {boolean} [opts.force] bypass cache & inflight reuse for a hard refresh
 */
export async function loadAddressHistory(account, opts = {}) {
  const host = (opts.host || resolveExplorerHostFromStorage() || '').replace(/\/$/, '');
  const cursor = opts.cursor || INITIAL_CURSOR;
  const force = Boolean(opts.force);
  const key = keyFor(account, host);
  const isFirstPage = cursor === INITIAL_CURSOR || cursorToPage(cursor) === 1;
  const preferIndexer = useIndexerForHost(host);

  // Deduplicate concurrent loads for the same account+page
  const inflightKey = `${key}::${preferIndexer ? `p${cursorToPage(cursor)}` : cursor}::${preferIndexer ? 'idx' : 'node'}`;
  if (!force && inflight.has(inflightKey)) {
    return inflight.get(inflightKey);
  }

  const promise = (async () => {
    let payload;

    if (preferIndexer) {
      // Do NOT fall back to node history for official/indexer selection.
      // Node /account/.../history on mega-miners is 7–15s and looks "broken".
      // Surface indexer errors instead so we can fix them.
      payload = await loadFromIndexer(account, cursor, isFirstPage);
    } else {
      payload = await loadFromNode(account, host, cursor, isFirstPage);
    }

    if (isFirstPage) {
      const existing = cache.get(key);
      if (
        payload.items.length === 0
        && existing?.items?.length
        && !force
      ) {
        return { ...existing, balance: payload.balance ?? existing.balance, preserved: true };
      }
      cache.set(key, { ...payload, at: Date.now() });
    }

    return payload;
  })().finally(() => {
    inflight.delete(inflightKey);
  });

  inflight.set(inflightKey, promise);
  return promise;
}

export { INITIAL_CURSOR as ADDRESS_HISTORY_CURSOR };

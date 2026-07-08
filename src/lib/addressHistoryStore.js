/**
 * Shared address-history loader + cache for SPA navigation.
 *
 * Problem this solves: React Router remounts (and Strict Mode) cancel in-component
 * fetches mid-flight, so a successful history response is discarded and the UI
 * sticks on "No transactions found" until a manual refresh.
 *
 * Strategy:
 * - One in-flight promise per account+host (shared across remounts)
 * - Always write successful results to cache
 * - Components subscribe; late arrivals still apply if the address is still shown
 */

import { createWarthogApi } from '../components/explorer/explorerClient.js';
import { parseAccountHistory, isEmptyHistoryError } from '../components/explorer/explorerApi.js';
import { parseWartBalanceFromApi } from '../components/explorer/explorerAddressUtils.js';
import { resolveExplorerHostFromStorage } from './explorerNodes.js';

const INITIAL_CURSOR = '4294967295';
const CACHE_TTL_MS = 120_000;

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

/**
 * Fetch first page of account history (shared / deduped).
 * @param {string} account normalized address
 * @param {object} [opts]
 * @param {string} [opts.host]
 * @param {string} [opts.cursor]
 * @param {boolean} [opts.force] bypass cache & inflight reuse for a hard refresh
 */
export async function loadAddressHistory(account, opts = {}) {
  const host = (opts.host || resolveExplorerHostFromStorage() || '').replace(/\/$/, '');
  const cursor = opts.cursor || INITIAL_CURSOR;
  const force = Boolean(opts.force);
  const key = keyFor(account, host);
  const isFirstPage = cursor === INITIAL_CURSOR;

  if (isFirstPage && !force) {
    const cached = readAddressHistoryCache(account, host);
    // Return cache immediately only when caller wants it — fetch still happens via ensureFresh
  }

  // Deduplicate concurrent first-page loads for the same account
  const inflightKey = `${key}::${cursor}`;
  if (!force && inflight.has(inflightKey)) {
    return inflight.get(inflightKey);
  }

  const promise = (async () => {
    const api = await apiForHost(host);
    let lastErr = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await api.getAccountHistory(account, cursor);

        if (!result?.success) {
          if (isEmptyHistoryError(result?.error)) {
            const empty = {
              items: [],
              nextCursor: null,
              hasMore: false,
              balance: null,
              empty: true,
            };
            if (isFirstPage) {
              // Only cache true empties; never clobber a good cache with empty
              const existing = cache.get(key);
              if (!existing?.items?.length) {
                cache.set(key, { ...empty, at: Date.now() });
              }
            }
            return empty;
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
        const payload = {
          items: parsed.items,
          nextCursor,
          hasMore,
          balance,
          empty: parsed.items.length === 0,
          blockCount: parsed.blockCount || 0,
        };

        if (isFirstPage) {
          const existing = cache.get(key);
          // Never replace a non-empty cache with an empty parse of a successful response
          // that still had blocks (indicates a transient parse/shape issue).
          if (
            payload.items.length === 0
            && existing?.items?.length
            && !force
          ) {
            return { ...existing, balance: balance ?? existing.balance, preserved: true };
          }
          cache.set(key, { ...payload, at: Date.now() });
        }

        return payload;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    throw lastErr || new Error('Failed to fetch transaction history');
  })().finally(() => {
    inflight.delete(inflightKey);
  });

  inflight.set(inflightKey, promise);
  return promise;
}

export { INITIAL_CURSOR as ADDRESS_HISTORY_CURSOR };

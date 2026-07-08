/**
 * In-memory session cache for the explorer SPA.
 * Survives route changes (explorer → address → back) without a full reload.
 */

const CACHE_TTL_MS = 90_000;

/** @type {{ host: string, useIndexer: boolean, blocks: any[], at: number } | null} */
let chainCache = null;

/** @type {{ host: string, stats: any, at: number } | null} */
let statsCache = null;

export function readExplorerChainCache(host, useIndexer) {
  if (!chainCache) return null;
  if (chainCache.host !== host || chainCache.useIndexer !== Boolean(useIndexer)) {
    return null;
  }
  if (Date.now() - chainCache.at > CACHE_TTL_MS) return null;
  if (!Array.isArray(chainCache.blocks) || chainCache.blocks.length === 0) return null;
  return chainCache;
}

export function writeExplorerChainCache(host, useIndexer, blocks) {
  if (!host || !Array.isArray(blocks) || blocks.length === 0) return;
  chainCache = {
    host,
    useIndexer: Boolean(useIndexer),
    // Store plain objects so Block instances can be rebuilt on read
    blocks: blocks.map((b) => (b && typeof b === 'object' ? { ...b } : b)),
    at: Date.now(),
  };
}

export function readExplorerStatsCache(host) {
  if (!statsCache || statsCache.host !== host) return null;
  if (Date.now() - statsCache.at > CACHE_TTL_MS) return null;
  return statsCache.stats || null;
}

export function writeExplorerStatsCache(host, stats) {
  if (!host || !stats) return;
  statsCache = { host, stats: { ...stats }, at: Date.now() };
}

export function clearExplorerSessionCache() {
  chainCache = null;
  statsCache = null;
}

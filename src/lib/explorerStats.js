/**
 * Live network / market stats for the explorer header strip.
 * Chain data from the selected node; price from multi-source WART price helper.
 */

import { fetchWartUsdPrice } from './wartPrice.js';

/** Blocks per reward era (~2 years at 20s blocks). */
export const HALVING_INTERVAL = 3_153_600;
export const INITIAL_REWARD = 3;
/** Hard cap from Warthog docs / node. */
export const MAX_SUPPLY = 18_921_599.68464;

export function blockRewardAtHeight(height) {
  const h = Math.max(0, Number(height) || 0);
  const era = Math.floor(h / HALVING_INTERVAL);
  return INITIAL_REWARD / 2 ** era;
}

/** Approximate circulating supply from emission schedule up to `height`. */
export function circulatingSupplyAtHeight(height) {
  let remaining = Math.max(0, Math.floor(Number(height) || 0));
  let reward = INITIAL_REWARD;
  let supply = 0;
  while (remaining > 0 && reward > 0) {
    const blocks = Math.min(remaining, HALVING_INTERVAL);
    supply += blocks * reward;
    remaining -= blocks;
    reward /= 2;
  }
  return Math.min(supply, MAX_SUPPLY);
}

export function formatHashrate(hps) {
  const n = Number(hps) || 0;
  // Prefer compact units like wartscan (e.g. 0.24 TH/s over 240 GH/s)
  if (n >= 1e14) return `${(n / 1e15).toFixed(2)} PH/s`;
  if (n >= 1e11) return `${(n / 1e12).toFixed(2)} TH/s`;
  if (n >= 1e8) return `${(n / 1e9).toFixed(2)} GH/s`;
  if (n >= 1e5) return `${(n / 1e6).toFixed(2)} MH/s`;
  if (n >= 1e2) return `${(n / 1e3).toFixed(2)} KH/s`;
  return `${n.toFixed(0)} H/s`;
}

export function formatInt(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

export function formatPrice(usd) {
  const p = Number(usd);
  if (!Number.isFinite(p) || p <= 0) return '—';
  if (p < 0.01) return `$${p.toFixed(4)}`;
  if (p < 1) return `$${p.toFixed(2)}`;
  return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function formatMarketCap(usd) {
  const p = Number(usd);
  if (!Number.isFinite(p) || p <= 0) return '—';
  if (p >= 1e9) return `$${(p / 1e9).toFixed(2)}B`;
  if (p >= 1e6) return `$${(p / 1e6).toFixed(2)}M`;
  if (p >= 1e3) return `$${Math.round(p).toLocaleString('en-US')}`;
  return `$${p.toFixed(0)}`;
}

export function formatReward(wart) {
  const n = Number(wart);
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return `${s} WART`;
}

/**
 * Build a TPS sparkline matching wart-explorer / wartscan.
 *
 * Source (wart-explorer/explorer.py get_latest_tps):
 *   20 buckets × 30 seconds looking back from now;
 *   each point = COUNT(txs in bucket) / 30
 *
 * We approximate from /transaction/latest per-block data (transfers + rewards
 * as tx count, same as block.txn in the indexer).
 *
 * Returns { points: number[] } — chart only, no numeric TPS in UI.
 */
export function tpsFromPerBlocks(perBlock, {
  buckets = 20,
  bucketSeconds = 30,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  if (!Array.isArray(perBlock) || perBlock.length === 0) {
    return { points: Array(buckets).fill(0) };
  }

  // Expand each block into a flat list of tx timestamps (one entry per tx).
  // Mirrors wart-explorer counting rows in the txs table for that time range.
  const txTimestamps = [];
  for (const b of perBlock) {
    const body = b?.body || {};
    const ts = Number(b.timestamp ?? b.header?.timestamp) || 0;
    if (ts <= 0) continue;
    const count =
      (body.transfers?.length || 0)
      + (body.rewards?.length || 0);
    for (let i = 0; i < count; i++) {
      txTimestamps.push(ts);
    }
  }

  // Same loop as get_latest_tps: i=0 is most recent 30s, then reverse.
  const tps = [];
  for (let i = 0; i < buckets; i++) {
    const upper = now - i * bucketSeconds;
    const lower = now - (i + 1) * bucketSeconds;
    let count = 0;
    for (const ts of txTimestamps) {
      if (ts > lower && ts <= upper) count += 1;
    }
    tps.push(count / bucketSeconds);
  }
  tps.reverse();

  return { points: tps };
}

/**
 * Fetch live stats using an existing WarthogApi client + optional price.
 */
export async function fetchExplorerLiveStats(api) {
  const [headResult, latestResult, price] = await Promise.all([
    api.getChainHead(),
    api.getNodePath('/transaction/latest').catch(() => null),
    fetchWartUsdPrice().catch(() => null),
  ]);

  if (!headResult?.success) {
    throw new Error(headResult?.error || 'Failed to fetch chain head');
  }

  const head = headResult.data || {};
  const height = Number(head.height ?? head.pinHeight) || 0;
  const hashrate = Number(head.hashrate) || 0;
  const reward = blockRewardAtHeight(height);
  const supply = circulatingSupplyAtHeight(height);
  const marketCap = price != null && price > 0 ? price * supply : null;

  let tpsPoints = [];
  if (latestResult?.success) {
    const perBlock = latestResult.data?.perBlock || [];
    ({ points: tpsPoints } = tpsFromPerBlocks(perBlock));
  }

  return {
    height,
    hashrate,
    hashrateLabel: formatHashrate(hashrate),
    heightLabel: formatInt(height),
    price,
    priceLabel: formatPrice(price),
    reward,
    rewardLabel: formatReward(reward),
    supply,
    supplyLabel: formatInt(supply),
    marketCap,
    marketCapLabel: formatMarketCap(marketCap),
    tpsPoints,
    updatedAt: Date.now(),
  };
}

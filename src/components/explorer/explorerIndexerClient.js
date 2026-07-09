import { Block, normalizeTx } from './assets/block.js';
import { nodeHasIndexer, normalizeSelectedNode } from '../../lib/explorerNodes.js';

async function fetchSiteExplorerJson(path, { searchParams } = {}) {
  const url = new URL(path, window.location.origin);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const preview = text.trim().slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      response.ok
        ? `Indexer returned non-JSON: ${preview || '(empty)'}`
        : `Indexer HTTP ${response.status}${preview ? `: ${preview}` : ''}`,
    );
  }

  if (!response.ok || json.code !== 0) {
    throw new Error(json.error || `Explorer API HTTP ${response.status}`);
  }
  return json.data;
}

export async function fetchIndexerChainHead() {
  const data = await fetchSiteExplorerJson('/api/explorer/chain/head');
  const height = data?.height ?? data?.pinHeight;
  if (height == null) {
    throw new Error('Unexpected indexer head response');
  }
  return Number(height);
}

export async function fetchIndexerLatestBlocks(count = 10) {
  const data = await fetchSiteExplorerJson('/api/explorer/blocks/latest', {
    searchParams: { count },
  });
  const blocks = Array.isArray(data?.blocks)
    ? data.blocks
    : Array.isArray(data)
      ? data
      : [];
  return blocks.map((block) => (block instanceof Block ? block : new Block(block)));
}

export async function fetchIndexerBlock(height) {
  const data = await fetchSiteExplorerJson(`/api/explorer/blocks/${height}`);
  if (!data) {
    throw new Error('Block not found');
  }
  return new Block(data);
}

export async function fetchIndexerAccount(address, { includeTxCount = false } = {}) {
  const addr = String(address || '').trim().toLowerCase();
  const data = await fetchSiteExplorerJson('/api/explorer/account', {
    searchParams: {
      address: addr,
      includeTxCount: includeTxCount ? '1' : '0',
    },
  });
  return {
    address: data?.address || addr,
    balance: data?.balance != null ? String(data.balance) : '0',
    balanceE8: data?.balanceE8,
    txCount: data?.txCount ?? null,
    firstMovement: data?.firstMovement ?? null,
    lastMovement: data?.lastMovement ?? null,
    balanceIndexed: Boolean(data?.balanceIndexed),
    raw: data,
  };
}

/**
 * Page-based address history from the indexer (fast even for mega-miners).
 * @returns {{ items, page, count, total, hasMore, nextPage }}
 */
let _headCache = { height: null, at: 0 };

async function cachedHeadHeight() {
  const now = Date.now();
  if (_headCache.height != null && now - _headCache.at < 30_000) {
    return _headCache.height;
  }
  try {
    const height = await fetchIndexerChainHead();
    _headCache = { height, at: now };
    return height;
  } catch {
    return _headCache.height;
  }
}

export async function fetchIndexerAccountTransactions(address, page = 1, count = 15) {
  const addr = String(address || '').trim().toLowerCase();
  const p = Math.max(1, Number(page) || 1);
  const c = Math.min(Math.max(Number(count) || 15, 1), 100);

  // Head is cached 30s so pagination doesn't re-hit chain/head every time.
  const [data, headHeight] = await Promise.all([
    fetchSiteExplorerJson('/api/explorer/account-history', {
      searchParams: { address: addr, page: p, count: c, includeTotal: '0' },
    }),
    cachedHeadHeight(),
  ]);

  const txs = Array.isArray(data?.transactions) ? data.transactions : [];
  const items = txs.map((tx) => {
    const n = normalizeTx(tx);
    const height = n.height ?? n.blockHeight;
    const confirmations =
      headHeight != null && height != null
        ? Math.max(0, Number(headHeight) - Number(height) + 1)
        : n.confirmations;
    return {
      ...n,
      txid: n.txHash || n.txid || n.hash,
      confirmations,
      height,
    };
  });

  const pageSize = data?.count || c;
  const hasMore = items.length >= pageSize;

  return {
    items,
    page: data?.page || p,
    count: pageSize,
    total: data?.total ?? null,
    hasMore,
    nextPage: hasMore ? p + 1 : null,
  };
}

/** True when the selected node should use the site indexer proxy. */
export function shouldUseExplorerIndexer(selectedNode) {
  if (selectedNode == null && typeof window !== 'undefined') {
    return nodeHasIndexer(localStorage.getItem('selectedNode'));
  }
  return nodeHasIndexer(selectedNode);
}

/** Convenience: should current storage selection use indexer? */
export function shouldUseExplorerIndexerFromStorage() {
  if (typeof window === 'undefined') return true;
  return nodeHasIndexer(normalizeSelectedNode(localStorage.getItem('selectedNode')));
}

import { Block } from './assets/block.js';
import { nodeHasIndexer } from '../../lib/explorerNodes.js';

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

/** True when the selected node should use the site indexer proxy. */
export function shouldUseExplorerIndexer(selectedNode) {
  return nodeHasIndexer(selectedNode);
}

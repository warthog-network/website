import { Block } from './assets/block.js';
import { createWarthogApi, unwrapApiData } from '../../lib/warthogClient.js';

export { createWarthogApi };

function extractChainHeight(data) {
  if (data == null || typeof data !== 'object') return null;
  const candidates = [
    data.height,
    data.pinHeight,
    data.chainHead?.pinHeight,
    data.chainHead?.height,
  ];
  for (const value of candidates) {
    if (value != null && value !== '') {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

export async function fetchChainHeadHeight(api) {
  const data = unwrapApiData(await api.getChainHead());
  const height = extractChainHeight(data);
  if (height == null) {
    throw new Error('Unexpected response format from node head endpoint');
  }
  return height;
}

export async function fetchExplorerBlock(api, height) {
  const data = unwrapApiData(await api.getBlock(height));
  if (!data || typeof data !== 'object') {
    throw new Error('Block not found');
  }
  // Nodes always send a header; tolerate minor envelope differences.
  if (!data.header && data.block?.header) {
    return new Block({ ...data.block, height: Number(data.block.height ?? height) });
  }
  if (!data.header) {
    throw new Error('Block not found (missing header in node response)');
  }
  return new Block({ ...data, height: Number(data.height ?? height) });
}

export async function fetchRecentBlocks(api, headHeight, count = 10) {
  const heights = Array.from(
    { length: Math.min(count, headHeight) },
    (_, index) => headHeight - index,
  );

  const fetchHeights = async (pending) => {
    const results = await Promise.allSettled(
      pending.map((height) => fetchExplorerBlock(api, height)),
    );
    const blocks = [];
    const failed = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        blocks.push(result.value);
      } else {
        console.error(`Failed to fetch block ${pending[index]}`, result.reason);
        failed.push(pending[index]);
      }
    });

    return { blocks, failed };
  };

  let { blocks, failed } = await fetchHeights(heights);

  if (failed.length > 0) {
    const retry = await fetchHeights(failed);
    blocks = blocks.concat(retry.blocks);
  }

  return blocks.sort((a, b) => b.height - a.height);
}

import { Block } from './assets/block.js';
import { createWarthogApi, unwrapApiData } from '../../lib/warthogClient.js';

export { createWarthogApi };

export async function fetchChainHeadHeight(api) {
  const data = unwrapApiData(await api.getChainHead());
  const height = data?.height ?? data?.chainHead?.pinHeight;
  if (height == null) {
    throw new Error('Unexpected response format from node head endpoint');
  }
  return Number(height);
}

export async function fetchExplorerBlock(api, height) {
  const data = unwrapApiData(await api.getBlock(height));
  if (!data?.header) {
    throw new Error('Block not found');
  }
  return new Block({ ...data, height: Number(height) });
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
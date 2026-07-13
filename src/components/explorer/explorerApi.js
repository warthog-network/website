/** Unwrap `{ code, data }` envelopes from node API / proxy responses. */
export function unwrapNodeResponse(response) {
  if (response == null || typeof response !== 'object') {
    return null;
  }

  let payload = response;

  if ('code' in payload && payload.data != null) {
    payload = payload.data;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    payload.data != null &&
    typeof payload.data === 'object' &&
    !('perBlock' in payload) &&
    !('balance' in payload) &&
    !('height' in payload)
  ) {
    payload = payload.data;
  }

  return payload;
}

/**
 * Normalize a per-block history entry.
 * Node APIs have used both `transactions.{transfers,rewards}` and `body.{transfers,rewards}`.
 */
function historyBlockTxGroups(block) {
  if (!block || typeof block !== 'object') {
    return { transfers: [], rewards: [] };
  }
  const group = block.transactions || block.body || {};
  return {
    transfers: Array.isArray(group.transfers) ? group.transfers : [],
    rewards: Array.isArray(group.rewards) ? group.rewards : [],
  };
}

export function parseAccountHistory(rawData) {
  if (!rawData || !Array.isArray(rawData.perBlock)) {
    return null;
  }

  const items = rawData.perBlock.flatMap((block) => {
    const { transfers, rewards } = historyBlockTxGroups(block);
    const txs = [...transfers, ...rewards];
    return txs.map((tx) => ({
      ...tx,
      confirmations: block.confirmations,
      height: block.height,
      txid: tx.txHash || tx.txid,
    }));
  });

  const fromId = Number(rawData.fromId) || 0;
  return { items, fromId, blockCount: rawData.perBlock.length };
}

/** Node returns this when the account has no indexed history yet. */
export function isEmptyHistoryError(message) {
  return (message || '').toLowerCase() === 'not found';
}

export function formatExplorerError(err, fallback = 'Request failed') {
  const message = err?.message || '';
  if (
    message.includes('HTTP error! status: 502')
    || message.includes('Upstream fetch failed')
    || message.includes('temporarily unreachable')
  ) {
    return 'Node is temporarily unreachable. Try another node or refresh in a moment.';
  }
  if (
    message.includes('HTTP error! status: 408')
    || message.includes('Request timeout')
    || message.includes('timed out')
  ) {
    return 'Node request timed out. The node may be offline or unreachable from the server.';
  }
  if (message.includes('non-JSON') || message.includes('HTML instead of JSON')) {
    return message;
  }
  return message || fallback;
}
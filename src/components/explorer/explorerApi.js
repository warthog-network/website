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

export function parseAccountHistory(rawData) {
  if (!rawData || !Array.isArray(rawData.perBlock)) {
    return null;
  }

  const items = rawData.perBlock.flatMap((block) => {
    const txs = [
      ...(block.transactions?.transfers || []),
      ...(block.transactions?.rewards || []),
    ];
    return txs.map((tx) => ({
      ...tx,
      confirmations: block.confirmations,
      height: block.height,
      txid: tx.txHash,
    }));
  });

  const fromId = Number(rawData.fromId) || 0;
  return { items, fromId };
}

export function formatExplorerError(err, fallback = 'Request failed') {
  const message = err?.message || '';
  if (message.includes('HTTP error! status: 502')) {
    return 'Node is temporarily unreachable. Try another node or refresh in a moment.';
  }
  if (message.includes('HTTP error! status: 408')) {
    return 'Node request timed out. Try again shortly.';
  }
  return message || fallback;
}
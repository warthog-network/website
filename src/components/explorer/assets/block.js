/** Normalize a single tx from node or indexer shapes into UI fields. */
export function normalizeTx(tx) {
  if (!tx || typeof tx !== 'object') return tx;

  // Already UI/node shaped
  if (tx.txHash && (tx.fromAddress !== undefined || tx.toAddress !== undefined || tx.type === 'Reward')) {
    return tx;
  }

  const type = (tx.type || '').toLowerCase();
  const isReward =
    type === 'reward' ||
    (!tx.sender && !tx.fromAddress && (tx.recipient || tx.toAddress));

  return {
    txHash: tx.txHash || tx.hash || '',
    fromAddress: isReward ? undefined : (tx.fromAddress || tx.sender || undefined),
    toAddress: tx.toAddress || tx.recipient || undefined,
    amount: tx.amount != null ? String(tx.amount) : undefined,
    fee: tx.fee != null ? String(tx.fee) : undefined,
    amountE8: tx.amountE8,
    feeE8: tx.feeE8,
    pinHeight: tx.pinHeight ?? tx.pinheight ?? undefined,
    nonceId: tx.nonceId ?? tx.nonce ?? undefined,
    height: tx.height ?? tx.blockHeight ?? undefined,
    blockHeight: tx.blockHeight ?? tx.height ?? undefined,
    timestamp: tx.timestamp ?? undefined,
    type: isReward ? 'Reward' : (tx.type || 'Transfer'),
    direction: tx.direction,
    confirmations: tx.confirmations,
  };
}

/**
 * Build rewards/transfers arrays from mixed node/indexer block payloads.
 * Indexer detail responses include both body.* and a top-level transactions[].
 */
export function normalizeBlockBody(data = {}) {
  const body = data.body && typeof data.body === 'object' ? data.body : {};
  let rewards = Array.isArray(body.rewards)
    ? body.rewards.map((r) => ({
        toAddress: r.toAddress || r.recipient,
        amount: r.amount != null ? String(r.amount) : '0',
        txHash: r.txHash || r.hash || '',
      }))
    : [];
  let transfers = Array.isArray(body.transfers)
    ? body.transfers.map((t) => normalizeTx(t))
    : [];

  // Prefer full tx list when present (indexer block detail).
  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    const txs = data.transactions.map((t) => normalizeTx(t));
    const rewardTxs = txs.filter((t) => !t.fromAddress || t.type === 'Reward');
    const transferTxs = txs.filter((t) => t.fromAddress && t.type !== 'Reward');
    if (rewardTxs.length) {
      rewards = rewardTxs.map((t) => ({
        toAddress: t.toAddress,
        amount: t.amount != null ? String(t.amount) : '0',
        txHash: t.txHash || '',
      }));
    }
    if (transferTxs.length) {
      transfers = transferTxs;
    }
  }

  return { rewards, transfers };
}

export class Block {
  constructor(data = {}) {
    const src = data && typeof data === 'object' ? data : {};

    // Indexer payloads include a top-level `transactions` array. This class only
    // exposes `transactions` as a getter, so never Object.assign that key.
    const {
      transactions: _omitTransactions,
      headerHash: _omitHeaderHash,
      heightStr: _omitHeightStr,
      ...rest
    } = src;

    const { rewards, transfers } = normalizeBlockBody(src);

    Object.assign(this, rest);
    this.height = this.height != null ? Number(this.height) : this.height;
    this.header = this.header || {};
    this.body = {
      rewards,
      transfers,
    };
  }

  reward_tx() {
    return this.body.rewards[0] || null;
  }

  miner() {
    const tx = this.reward_tx();
    return tx?.toAddress || 'unknown';
  }

  reward() {
    const tx = this.reward_tx();
    return tx?.amount || '0';
  }

  get transactions() {
    const rewardTx = this.reward_tx();
    const txs = [];
    if (rewardTx) txs.push(rewardTx);
    txs.push(...this.body.transfers);
    return txs;
  }

  transactionCount() {
    return this.transactions.length;
  }

  get headerHash() {
    return typeof this.header.hash === 'string' ? this.header.hash : '—';
  }

  get heightStr() {
    return this.height?.toString() || '—';
  }
}

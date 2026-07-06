export class Block {
  constructor(data) {
    Object.assign(this, data);
    this.body = this.body || {};
    this.body.rewards = Array.isArray(this.body.rewards) ? this.body.rewards : [];
    this.body.transfers = Array.isArray(this.body.transfers) ? this.body.transfers : [];
    this.header = this.header || {};
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
import { useState, useEffect } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';
import BunkerShell from '../BunkerShell.jsx';

function TransactionDetails({ txid }) {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const getHost = (node) => {
      if (node === 'losthymns') return 'https://warthognode.duckdns.org';
      if (node === 'official2' || node === 'polaire') return 'http://65.87.7.86:3001';
      if (node === 'local') return 'http://localhost:3000';
      return 'http://localhost:3000';
    };

    const selectedNode = typeof window !== 'undefined' ? localStorage.getItem('selectedNode') || 'losthymns' : 'losthymns';
    let selectedHost;
    if (selectedNode === 'custom') {
      const customIP = localStorage.getItem('customIP') || 'localhost';
      const customPort = localStorage.getItem('customPort') || '3000';
      let fullIP = customIP;
      if (!fullIP.includes('://')) {
        fullIP = `http://${fullIP}`;
      }
      selectedHost = `${fullIP}:${customPort}`;
    } else {
      selectedHost = getHost(selectedNode);
    }
    const client = new APIClient(selectedHost);
    if (txid) {
      setLoading(true);
      client.get(`/transaction/lookup/${txid}`)
        .then(response => {
          if (response.code !== 0 || !response.data || !response.data.transaction) {
            throw new Error('Transaction not found');
          }
          setTransaction(response.data.transaction);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [txid]);

  if (loading) {
    return (
      <BunkerShell title="Transaction Details">
        <p className="bunker-muted">Loading transaction...</p>
      </BunkerShell>
    );
  }

  if (!transaction || error) {
    return (
      <BunkerShell title="Transaction Not Found">
        <p className="bunker-muted">The requested transaction could not be found.</p>
        <a href="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
          ← Back to Explorer
        </a>
      </BunkerShell>
    );
  }

  const isRewardTx = !transaction.fromAddress || transaction.type === 'Reward';

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <BunkerShell title="Transaction Details" wide>
      <h2 className="bunker-subheading">Transaction {abbreviate(txid)}</h2>
      <div className="bunker-panel">
        <dl className="bunker-dl">
            <div className="bunker-dl-row">
              <dt>Hash</dt>
              <dd className="bunker-link" style={{ cursor: 'pointer' }} onClick={() => handleCopy(transaction.txHash, 'txhash')}>
                {transaction.txHash ?? 'N/A'}
                {copiedField === 'txhash' && <span> (Copied!)</span>}
              </dd>
            </div>
            <div className="bunker-dl-row">
              <dt>Type</dt>
              <dd>{isRewardTx ? 'Miner Reward' : transaction.type ?? 'Transfer'}</dd>
            </div>
            {transaction.fromAddress && (
              <div className="bunker-dl-row">
                <dt>From</dt>
                <dd className="bunker-link" style={{ cursor: 'pointer' }} onClick={() => handleCopy(transaction.fromAddress, 'from')}>
                  {isMobile ? abbreviate(transaction.fromAddress) : transaction.fromAddress}
                  {copiedField === 'from' && <span> (Copied!)</span>}
                </dd>
              </div>
            )}
            {transaction.toAddress && (
              <div className="bunker-dl-row">
                <dt>To</dt>
                <dd className="bunker-link" style={{ cursor: 'pointer' }} onClick={() => handleCopy(transaction.toAddress, 'to')}>
                  {isMobile ? abbreviate(transaction.toAddress) : transaction.toAddress}
                  {copiedField === 'to' && <span> (Copied!)</span>}
                </dd>
              </div>
            )}
            <div className="bunker-dl-row">
              <dt>Amount</dt>
              <dd>{transaction.amount ?? 'N/A'} (E8: {transaction.amountE8 ?? 'N/A'})</dd>
            </div>
            {transaction.fee && (
              <div className="bunker-dl-row">
                <dt>Fee</dt>
                <dd>{transaction.fee ?? 'N/A'} (E8: {transaction.feeE8 ?? 'N/A'})</dd>
              </div>
            )}
            {transaction.blockHeight && (
              <div className="bunker-dl-row">
                <dt>Block Height</dt>
                <dd>
                  <a href={`/chain/block/${transaction.blockHeight}`} className="bunker-link">
                    {format_height(transaction.blockHeight)}
                  </a>
                </dd>
              </div>
            )}
            {transaction.pinHeight && (
              <div className="bunker-dl-row">
                <dt>Pin Height</dt>
                <dd>{format_height(transaction.pinHeight)}</dd>
              </div>
            )}
            {transaction.nonceId !== undefined && (
              <div className="bunker-dl-row">
                <dt>Nonce ID</dt>
                <dd>{transaction.nonceId}</dd>
              </div>
            )}
            {transaction.timestamp && (
              <div className="bunker-dl-row">
                <dt>Timestamp</dt>
                <dd>{new Date(transaction.timestamp * 1000).toLocaleString()}</dd>
              </div>
            )}
            <div className="bunker-dl-row">
              <dt>Status</dt>
              <dd>{transaction.confirmations > 0 ? 'Confirmed' : 'Pending'}</dd>
            </div>
            {transaction.confirmations !== undefined && (
              <div className="bunker-dl-row">
                <dt>Confirmations</dt>
                <dd>{transaction.confirmations}</dd>
              </div>
            )}
          </dl>
      </div>
      <a href="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
        ← Back to Explorer
      </a>
    </BunkerShell>
  );
}

export default TransactionDetails;

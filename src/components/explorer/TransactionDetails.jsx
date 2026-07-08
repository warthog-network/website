import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format_height, abbreviate } from './assets/util.js';
import BunkerShell from '../BunkerShell.jsx';
import { resolveExplorerHostFromStorage } from '../../lib/explorerNodes.js';
import { unwrapApiData } from '../../lib/warthogClient.js';
import ExplorerAddress from './ExplorerAddress.jsx';
import ExplorerLink from './ExplorerLink.jsx';
import ExplorerRefreshButton from './ExplorerRefreshButton.jsx';
import { createWarthogApi } from './explorerClient.js';

function TransactionDetails({ txid: txidProp } = {}) {
  const params = useParams();
  const txid = txidProp ?? params.txid;
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!txid) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const api = await createWarthogApi(resolveExplorerHostFromStorage());
        const payload = unwrapApiData(
          await api.getNodePath(`/transaction/lookup/${txid}`),
        );
        if (cancelled) return;

        const transactionData = payload?.transaction ?? payload;
        if (!transactionData) {
          throw new Error('Transaction not found');
        }
        setTransaction(transactionData);
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [txid, refreshKey]);

  const handleRefresh = () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  if (loading) {
    return (
      <BunkerShell
        title="Transaction Details"
        actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
      >
        <p className="bunker-muted">Loading transaction...</p>
      </BunkerShell>
    );
  }

  if (!transaction || error) {
    return (
      <BunkerShell
        title="Transaction Not Found"
        actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
      >
        <p className="bunker-muted">The requested transaction could not be found.</p>
        <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
          ← Back to Explorer
        </ExplorerLink>
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
    <BunkerShell
      title="Transaction Details"
      wide
      actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
    >
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
                <dd>
                  <ExplorerAddress
                    address={transaction.fromAddress}
                    abbreviated={isMobile}
                  />
                </dd>
              </div>
            )}
            {transaction.toAddress && (
              <div className="bunker-dl-row">
                <dt>To</dt>
                <dd>
                  <ExplorerAddress
                    address={transaction.toAddress}
                    abbreviated={isMobile}
                  />
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
                  <ExplorerLink to={`/chain/block/${transaction.blockHeight}`} className="bunker-link">
                    {format_height(transaction.blockHeight)}
                  </ExplorerLink>
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
      <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
        ← Back to Explorer
      </ExplorerLink>
    </BunkerShell>
  );
}

export default TransactionDetails;

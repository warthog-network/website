import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format_height, abbreviate } from './assets/util.js';
import { Block } from './assets/block.js';
import BunkerShell from '../BunkerShell.jsx';
import { resolveExplorerHostFromStorage } from '../../lib/explorerNodes.js';
import ExplorerAddress from './ExplorerAddress.jsx';
import ExplorerLink from './ExplorerLink.jsx';
import ExplorerRefreshButton from './ExplorerRefreshButton.jsx';
import { createWarthogApi, fetchExplorerBlock } from './explorerClient.js';
import { fetchIndexerBlock, shouldUseExplorerIndexer } from './explorerIndexerClient.js';
import { normalizeSelectedNode } from '../../lib/explorerNodes.js';
import { formatExplorerError } from './explorerApi.js';

function TransactionItem({ tx, index }) {
  const isRewardTx = !tx.fromAddress;
  const safeStr = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'bigint') return val.toString();
    if (val && typeof val === 'object') {
      if ('E8' in val && 'str' in val) return val.str;
      return JSON.stringify(val);
    }
    return String(val);
  };

  return (
    <li key={tx.txHash || `tx-${index}`} className="bunker-list-item">
      <div className="flex justify-between items-center">
        <span className="bunker-tx-title">
          {isRewardTx
            ? `Miner Reward - ${abbreviate(safeStr(tx.txHash))}`
            : abbreviate(safeStr(tx.txHash))}
        </span>
        {tx.txHash && (
          <ExplorerLink
            to={`/transaction/lookup/${tx.txHash}`}
            className="bunker-link"
          >
            View Details
          </ExplorerLink>
        )}
      </div>
      {tx.fromAddress && safeStr(tx.fromAddress) !== '—' && (
        <div className="bunker-meta">
          From: <ExplorerAddress address={tx.fromAddress} />
        </div>
      )}
      {tx.toAddress && safeStr(tx.toAddress) !== '—' && (
        <div className="bunker-meta">
          To: <ExplorerAddress address={tx.toAddress} />
        </div>
      )}
      {tx.amount && safeStr(tx.amount) !== '—' && (
        <div className="bunker-meta">
          Amount: {safeStr(tx.amount)}
        </div>
      )}
      {tx.fee && safeStr(tx.fee) !== '—' && (
        <div className="bunker-meta">
          Fee: {safeStr(tx.fee)}
        </div>
      )}
    </li>
  );
}

function BlockDetails({ height: heightProp } = {}) {
  const params = useParams();
  const height = heightProp ?? params.height;
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setErrorMessage(null);

    (async () => {
      try {
        const selectedNode = normalizeSelectedNode(
          typeof window !== 'undefined' ? localStorage.getItem('selectedNode') : 'losthymns',
        );
        const fetchedBlock = shouldUseExplorerIndexer(selectedNode)
          ? await fetchIndexerBlock(height)
          : await fetchExplorerBlock(
              await createWarthogApi(resolveExplorerHostFromStorage()),
              height,
            );
        if (cancelled) return;
        setBlock(fetchedBlock instanceof Block ? fetchedBlock : new Block(fetchedBlock));
      } catch (err) {
        if (!cancelled) {
          setError(true);
          setErrorMessage(formatExplorerError(err, 'The requested block could not be found.'));
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
  }, [height, refreshKey]);

  const handleRefresh = () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  if (loading) {
    return (
      <BunkerShell
        title="Block Details"
        actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
      >
        <p className="bunker-muted">Loading block...</p>
      </BunkerShell>
    );
  }

  if (!block || error) {
    return (
      <BunkerShell
        title="Block Not Found"
        actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
      >
        <p className="bunker-muted">
          {errorMessage || 'The requested block could not be found.'}
        </p>
        <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
          ← Back to Explorer
        </ExplorerLink>
      </BunkerShell>
    );
  }

  return (
    <BunkerShell
      title="Block Details"
      wide
      actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
    >
      <h2 className="bunker-subheading">Block {format_height(block.height)}</h2>
      <div className="bunker-panel">
        <dl className="bunker-dl" style={{ marginBottom: '1rem' }}>
          <div className="bunker-dl-row">
            <dt>Hash</dt>
            <dd className="bunker-link" style={{ cursor: 'pointer' }} onClick={() => handleCopy(block.header?.hash, 'hash')}>
              {block.header?.hash ?? 'N/A'}
              {copiedField === 'hash' && <span> (Copied!)</span>}
            </dd>
          </div>
          <div className="bunker-dl-row">
            <dt>Height</dt>
            <dd>{format_height(block.height)}</dd>
          </div>
          <div className="bunker-dl-row">
            <dt>Miner</dt>
            <dd>
              <ExplorerAddress address={block.miner()} abbreviated={false} />
            </dd>
          </div>
          <div className="bunker-dl-row">
            <dt>Reward</dt>
            <dd>{block.reward()}</dd>
          </div>
          <div className="bunker-dl-row">
            <dt>Transactions</dt>
            <dd>{block.transactionCount()}</dd>
          </div>
          {block.header?.timestamp && (
            <div className="bunker-dl-row">
              <dt>Timestamp</dt>
              <dd>{new Date(block.header.timestamp * 1000).toLocaleString()}</dd>
            </div>
          )}
        </dl>
        <div className="bunker-toolbar">
          <h3 className="bunker-heading" style={{ margin: 0 }}>Transactions</h3>
          <ExplorerLink to={`/block/${block.height}/hex`} className="bunker-link">Show binary</ExplorerLink>
        </div>
        {block.transactions?.length > 0 ? (
          <ul className="bunker-list">
            {block.transactions.map((tx, index) => (
              <TransactionItem key={tx.txHash || `tx-${index}`} tx={tx} index={index} />
            ))}
          </ul>
        ) : (
          <p className="bunker-muted">No transactions in this block.</p>
        )}
      </div>
      <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
        ← Back to Explorer
      </ExplorerLink>
    </BunkerShell>
  );
}

export default BlockDetails;

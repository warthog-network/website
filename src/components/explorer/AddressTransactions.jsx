import { useState, useEffect, useRef, useCallback } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';
import BunkerShell from '../BunkerShell.jsx';
import { resolveExplorerHostFromStorage } from '../../lib/explorerNodes.js';
import ExplorerAddress from './ExplorerAddress.jsx';
import ExplorerRefreshButton from './ExplorerRefreshButton.jsx';
import {
  formatExplorerError,
  parseAccountHistory,
  unwrapNodeResponse,
} from './explorerApi.js';

const PAGE_SIZE = 15;
const INITIAL_CURSOR = '4294967295';

function TransactionItem({ tx, index }) {
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
    <li key={tx.txid || `tx-${index}`} className="bunker-list-item">
      <div className="flex justify-between items-center">
        <span className="bunker-tx-title">
          {abbreviate(safeStr(tx.txid))}
        </span>
        {tx.txid && (
          <a
            href={`/transaction/lookup/${tx.txid}`}
            className="bunker-link"
          >
            View Details
          </a>
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
      {tx.height && (
        <div className="bunker-meta">
          Block: {format_height(tx.height)}
        </div>
      )}
      {tx.confirmations !== undefined && (
        <div className="bunker-meta">
          Confirmations: {tx.confirmations}
        </div>
      )}
    </li>
  );
}

function AddressTransactions({ address }) {
  const [allHistory, setAllHistory] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState(INITIAL_CURSOR);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [balance, setBalance] = useState(null);
  const [usdBalance, setUsdBalance] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    clientRef.current = new APIClient(resolveExplorerHostFromStorage());
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!clientRef.current || !address) return;

    try {
      const response = await clientRef.current.get(`/account/${address}/balance`);
      const balanceData = unwrapNodeResponse(response);
      const bal = balanceData?.balance ?? 'N/A';
      setBalance(bal);

      if (bal && bal !== 'N/A') {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=warthog&vs_currencies=usd')
          .then((res) => res.json())
          .then((data) => {
            const price = data.warthog?.usd || 0;
            const usd = (parseFloat(bal) * price).toFixed(2);
            setUsdBalance(`$${usd}`);
          })
          .catch(() => setUsdBalance('N/A'));
      } else {
        setUsdBalance('N/A');
      }
    } catch (err) {
      console.error('Failed to fetch balance', err);
      setBalance('N/A');
      setUsdBalance('N/A');
    }
  }, [address]);

  const fetchHistoryPage = useCallback(async (cursor, { append = false } = {}) => {
    if (!clientRef.current || !address) return;

    const response = await clientRef.current.get(`/account/${address}/history/${cursor}`);
    const rawData = unwrapNodeResponse(response);
    const parsed = parseAccountHistory(rawData);

    if (!parsed) {
      throw new Error('Unexpected response format from node history endpoint');
    }

    const { items, fromId } = parsed;
    setAllHistory((prev) => (append ? [...prev, ...items] : items));
    setHasMore(items.length > 0 && fromId > 0);
    setNextCursor(fromId > 0 ? String(fromId) : null);
    return items;
  }, [address]);

  const loadInitialHistory = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);
    try {
      await fetchHistoryPage(INITIAL_CURSOR, { append: false });
      setCurrentPage(1);
    } catch (err) {
      setError(formatExplorerError(err, 'Failed to fetch transaction history'));
      setAllHistory([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [address, fetchHistoryPage]);

  useEffect(() => {
    if (!address) return;

    setAllHistory([]);
    setCurrentPage(1);
    setNextCursor(INITIAL_CURSOR);
    setHasMore(true);
    setError(null);

    loadInitialHistory();
    fetchBalance();

    const balanceInterval = setInterval(fetchBalance, 30000);
    return () => clearInterval(balanceInterval);
  }, [address, loadInitialHistory, fetchBalance]);

  const fetchMoreHistory = async () => {
    if (!hasMore || loading || !nextCursor) return;

    setLoading(true);
    setError(null);
    try {
      await fetchHistoryPage(nextCursor, { append: true });
    } catch (err) {
      setError(formatExplorerError(err, 'Failed to fetch transaction history'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!address || refreshing) return;

    setRefreshing(true);
    setError(null);
    setAllHistory([]);
    setCurrentPage(1);
    setNextCursor(INITIAL_CURSOR);
    setHasMore(true);

    try {
      await Promise.all([fetchBalance(), fetchHistoryPage(INITIAL_CURSOR, { append: false })]);
    } catch (err) {
      setError(formatExplorerError(err, 'Failed to refresh address data'));
      setAllHistory([]);
      setHasMore(false);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleNext = () => {
    const nextPage = currentPage + 1;
    const requiredLength = nextPage * PAGE_SIZE;
    if (allHistory.length < requiredLength && hasMore) {
      fetchMoreHistory();
    }
    if (allHistory.length >= requiredLength || (allHistory.length < requiredLength && !hasMore)) {
      setCurrentPage(nextPage);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (!address) {
    return (
      <BunkerShell title="Address Not Found">
        <p className="bunker-muted">No address provided.</p>
        <a href="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
          ← Back to Explorer
        </a>
      </BunkerShell>
    );
  }

  if (loading && allHistory.length === 0 && !error) {
    return (
      <BunkerShell
        title="Address Transactions"
        actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
      >
        <p className="bunker-muted">Loading transactions...</p>
      </BunkerShell>
    );
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentHistory = allHistory.slice(startIndex, endIndex);
  const hasNext = (endIndex < allHistory.length) || hasMore;

  return (
    <BunkerShell
      title="Address Transactions"
      wide
      actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing || loading} />}
    >
      <h2 className="bunker-subheading">Address {abbreviate(address)}</h2>
      <div className="bunker-panel">
        <dl className="bunker-dl" style={{ marginBottom: '1rem' }}>
          <div className="bunker-dl-row">
            <dt>Address</dt>
            <dd>
              <ExplorerAddress
                address={address}
                abbreviated={isMobile}
                showLink={false}
              />
            </dd>
          </div>
          <div className="bunker-dl-row">
            <dt>Balance</dt>
            <dd>{balance ?? 'Loading...'} {usdBalance && usdBalance !== 'N/A' ? `(${usdBalance})` : ''}</dd>
          </div>
        </dl>
        <h3 className="bunker-heading">Transaction History (Page {currentPage})</h3>
        {loading && <p className="bunker-muted">Loading more...</p>}
        {error && <div className="bunker-alert"><strong>Error:</strong> {error}</div>}
        {currentHistory.length > 0 ? (
          <ul className="bunker-list">
            {currentHistory.map((tx, index) => (
              <TransactionItem key={tx.txid || `tx-${startIndex + index}`} tx={tx} index={startIndex + index} />
            ))}
          </ul>
        ) : !error ? (
          <p className="bunker-muted">No transactions found for this address.</p>
        ) : null}
      </div>
      <div className="bunker-toolbar" style={{ marginTop: '1.5rem' }}>
        <button onClick={handlePrev} disabled={currentPage === 1} className="bunker-btn bunker-btn--ghost">Previous</button>
        <button onClick={handleNext} disabled={!hasNext} className="bunker-btn bunker-btn--ghost">Next</button>
      </div>
      <a href="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
        ← Back to Explorer
      </a>
    </BunkerShell>
  );
}

export default AddressTransactions;
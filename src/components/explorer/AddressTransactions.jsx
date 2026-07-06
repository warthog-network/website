import { useState, useEffect, useRef } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';
import BunkerShell from '../BunkerShell.jsx';

const PAGE_SIZE = 15;

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
          From: {abbreviate(safeStr(tx.fromAddress))}
        </div>
      )}
      {tx.toAddress && safeStr(tx.toAddress) !== '—' && (
        <div className="bunker-meta">
          To: {abbreviate(safeStr(tx.toAddress))}
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
  const [nextCursor, setNextCursor] = useState('4294967295');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [balance, setBalance] = useState(null);
  const [usdBalance, setUsdBalance] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const fetchMoreHistory = async () => {
    if (!hasMore || loading || !clientRef.current) return;
    setLoading(true);
    try {
      const response = await clientRef.current.get(`/account/${address}/history/${nextCursor}`);
      const rawData = response.data || response;
      if (rawData.perBlock && Array.isArray(rawData.perBlock)) {
        const newItems = rawData.perBlock.flatMap(block => {
          const txs = [
            ...(block.transactions?.transfers || []),
            ...(block.transactions?.rewards || [])
          ];
          return txs.map(tx => ({
            ...tx,
            confirmations: block.confirmations,
            height: block.height,
            txid: tx.txHash,
          }));
        });
        setAllHistory(prev => [...prev, ...newItems]);
        setHasMore(newItems.length > 0 && rawData.fromId > 0);
        setNextCursor(rawData.fromId > 0 ? rawData.fromId : null);
      } else {
        setError('Unexpected response format');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch transaction history');
    } finally {
      setLoading(false);
    }
  };

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
    clientRef.current = client;

    const fetchBalance = async () => {
      client.get(`/account/${address}/balance`)
        .then(response => {
          const bal = response.data?.balance || response.data || 'N/A';
          setBalance(bal);
          // Fetch USD equivalent
          if (bal && bal !== 'N/A') {
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=warthog&vs_currencies=usd')
              .then(res => res.json())
              .then(data => {
                const price = data.warthog?.usd || 0;
                const usd = (parseFloat(bal) * price).toFixed(2);
                setUsdBalance(`$${usd}`);
              })
              .catch(() => setUsdBalance('N/A'));
          } else {
            setUsdBalance('N/A');
          }
        })
        .catch(err => {
          console.error('Failed to fetch balance', err);
          setBalance('N/A');
          setUsdBalance('N/A');
        });
    };

    if (address) {
      if (allHistory.length === 0) {
        fetchMoreHistory();
      }
      fetchBalance();
      // Poll balance every 30 seconds
      const balanceInterval = setInterval(fetchBalance, 30000);
      return () => clearInterval(balanceInterval);
    }
  }, [address]);

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

  if (loading && allHistory.length === 0) {
    return (
      <BunkerShell title="Address Transactions">
        <p className="bunker-muted">Loading transactions...</p>
      </BunkerShell>
    );
  }

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

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentHistory = allHistory.slice(startIndex, endIndex);
  const hasNext = (endIndex < allHistory.length) || hasMore;

  return (
    <BunkerShell title="Address Transactions" wide>
      <h2 className="bunker-subheading">Address {abbreviate(address)}</h2>
      <div className="bunker-panel">
        <dl className="bunker-dl" style={{ marginBottom: '1rem' }}>
          <div className="bunker-dl-row">
            <dt>Address</dt>
            <dd className="bunker-link" style={{ cursor: 'pointer' }} onClick={() => handleCopy(address, 'address')}>
              {isMobile ? abbreviate(address) : address}
              {copiedField === 'address' && <span> (Copied!)</span>}
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
        ) : (
          <p className="bunker-muted">No transactions found for this address.</p>
        )}
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

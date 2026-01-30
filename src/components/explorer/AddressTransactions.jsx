import { useState, useEffect, useRef } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';

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
    <li key={tx.txid || `tx-${index}`} className="bg-gray-50 p-3 rounded-lg dark:bg-gray-700">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-800 dark:text-neutral-200 break-all">
          {abbreviate(safeStr(tx.txid))}
        </span>
        {tx.txid && (
          <a
            href={`/transaction/lookup/${tx.txid}`}
            className="text-sm text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            View Details
          </a>
        )}
      </div>
      {tx.fromAddress && safeStr(tx.fromAddress) !== '—' && (
        <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
          From: {abbreviate(safeStr(tx.fromAddress))}
        </div>
      )}
      {tx.toAddress && safeStr(tx.toAddress) !== '—' && (
        <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
          To: {abbreviate(safeStr(tx.toAddress))}
        </div>
      )}
      {tx.amount && safeStr(tx.amount) !== '—' && (
        <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
          Amount: {safeStr(tx.amount)}
        </div>
      )}
      {tx.fee && safeStr(tx.fee) !== '—' && (
        <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
          Fee: {safeStr(tx.fee)}
        </div>
      )}
      {tx.height && (
        <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
          Block: {format_height(tx.height)}
        </div>
      )}
      {tx.confirmations !== undefined && (
        <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
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
      if (node === 'local') return 'http://localhost:3000';
      if (node === 'polaire') return 'http://217.182.64.43:3001';
      return 'http://localhost:3000';
    };

    const selectedNode = typeof window !== 'undefined' ? localStorage.getItem('selectedNode') || 'local' : 'local';
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

    if (address) {
      if (allHistory.length === 0) {
        fetchMoreHistory();
      }
      // Fetch balance
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
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Loading Transactions...</h1>
      </div>
    );
  }

  if (!address || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Address Not Found</h1>
        <p className="text-gray-600">The requested address could not be found or there was an error.</p>
        <a
          href="/explorer"
          className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 transition-colors duration-200 dark:bg-gray-800 dark:text-zinc-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
        >
          ← Back to Explorer
        </a>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentHistory = allHistory.slice(startIndex, endIndex);
  const hasNext = (endIndex < allHistory.length) || hasMore;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Address Transactions</h1>
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white-900 md:text-3xl lg:text-4xl">
        Address {abbreviate(address)}
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg dark:bg-gray-800 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium text-gray-500 uppercase">Address</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200 break-all cursor-pointer hover:text-blue-600" onClick={() => handleCopy(address, 'address')}>
                {isMobile ? abbreviate(address) : address}
                {copiedField === 'address' && <span className="ml-2 text-green-600">Copied!</span>}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 uppercase">Balance</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{balance ?? 'Loading...'} {usdBalance && usdBalance !== 'N/A' ? `(${usdBalance})` : ''}</dd>
            </div>
          </dl>
        </div>
        <div className="px-6 py-4">
          <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Transaction History (Page {currentPage})</h3>
          {loading && <p>Loading more...</p>}
          {error && <div className="error"><strong>Error:</strong> {error}</div>}
          {currentHistory.length > 0 ? (
            <ul className="space-y-3">
              {currentHistory.map((tx, index) => (
                <TransactionItem key={tx.txid || `tx-${startIndex + index}`} tx={tx} index={startIndex + index} />
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-neutral-400">No transactions found for this address.</p>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <button onClick={handlePrev} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
          Previous
        </button>
        <button onClick={handleNext} disabled={!hasNext} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
          Next
        </button>
      </div>
      <a
        href="/explorer"
        className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 transition-colors duration-200 dark:bg-gray-800 dark:text-zinc-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
      >
        ← Back to Explorer
      </a>
    </div>
  );
}

export default AddressTransactions;

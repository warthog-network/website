// TransactionHistory.jsx
// This file remains unchanged from the original provided.
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api/proxy';
const PAGE_SIZE = 15;

const TransactionHistory = ({ address, node, onCountsUpdate, blockCounts, refreshTrigger }) => {
  const [allHistory, setAllHistory] = useState([]); // Accumulate all fetched transactions
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState('4294967295'); // Start with large number
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTooltip24h, setShowTooltip24h] = useState(false);
  const [showTooltipWeek, setShowTooltipWeek] = useState(false);
  const [showTooltipMonth, setShowTooltipMonth] = useState(false);
  const [timeoutId24h, setTimeoutId24h] = useState(null);
  const [timeoutIdWeek, setTimeoutIdWeek] = useState(null);
  const [timeoutIdMonth, setTimeoutIdMonth] = useState(null);

  const abbreviate = (str) => str ? `${str.slice(0,6)}...${str.slice(-4)}` : 'N/A';

  console.log('TransactionHistory using endpoint:', `${API_URL}?nodePath=account/${address}/history/${nextCursor}&nodeBase=${node}`);

  useEffect(() => {
    if (address && node && allHistory.length === 0) {
      fetchInitialHistory();
    }
  }, [address, node]);

  useEffect(() => {
    if (address && node && refreshTrigger !== undefined) {
      fetchInitialHistory();
    }
  }, [refreshTrigger, address, node]);

  useEffect(() => {
    if (allHistory.length > 0 && onCountsUpdate) {
      const now = Date.now() / 1000; // in seconds
      const oneDayAgo = now - 24 * 60 * 60;
      const oneWeekAgo = now - 7 * 24 * 60 * 60;
      const oneMonthAgo = now - 30 * 24 * 60 * 60;
      const rewards = allHistory.filter(tx => !tx.fromAddress && tx.timestamp);
      const rewards24h = rewards.filter(tx => tx.timestamp >= oneDayAgo);
      const rewardsWeek = rewards.filter(tx => tx.timestamp >= oneWeekAgo);
      const rewardsMonth = rewards.filter(tx => tx.timestamp >= oneMonthAgo);
      const count24h = rewards24h.length;
      const countWeek = rewardsWeek.length;
      const countMonth = rewardsMonth.length;
      onCountsUpdate({
        '24h': count24h,
        week: countWeek,
        month: countMonth,
        rewards24h: rewards24h.map(tx => tx.txid),
        rewardsWeek: rewardsWeek.map(tx => tx.txid),
        rewardsMonth: rewardsMonth.map(tx => tx.txid),
      });
    }
  }, [allHistory, onCountsUpdate]);

  const fetchInitialHistory = async () => {
    setLoading(true);
    setError(null); // Clear previous error
    console.log('Loading transaction history...');
    try {
      const nodeBaseParam = `nodeBase=${encodeURIComponent(node)}`;
      const path = `account/${address}/history/4294967295`;
      const response = await axios.get(`${API_URL}?nodePath=${path}&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const rawData = response.data.data || response.data;
      if (rawData.perBlock && Array.isArray(rawData.perBlock)) {
        // Fetch timestamps for each block
        const blockPromises = rawData.perBlock.map(block =>
          axios.get(`${API_URL}?nodePath=chain/block/${block.height}&${nodeBaseParam}`)
        );
        const blockResponses = await Promise.allSettled(blockPromises);
        const timestampMap = {};
        blockResponses.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            const blockData = res.value.data.data || res.value.data;
            timestampMap[rawData.perBlock[idx].height] = blockData.timestamp;
          }
        });

        const newItems = rawData.perBlock.flatMap(block => {
          const txs = [
            ...(block.transactions?.transfers || []),
            ...(block.transactions?.rewards || [])
          ];
          return txs.map(tx => ({
            ...tx,
            confirmations: block.confirmations,
            height: block.height,
            txid: tx.txHash, // Use txHash as txid
            timestamp: tx.timestamp || block.timestamp || timestampMap[block.height],
          }));
        });
        setAllHistory(newItems);
        setNextCursor(rawData.fromId > 0 ? rawData.fromId : null);
        setHasMore(newItems.length > 0 && rawData.fromId > 0);
        setCurrentPage(1);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch transaction history');
    } finally {
      setLoading(false);
      console.log('Transaction history loaded.');
    }
  };

  const fetchMoreHistory = async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const nodeBaseParam = `nodeBase=${encodeURIComponent(node)}`;
      const path = `account/${address}/history/${nextCursor}`;
      const response = await axios.get(`${API_URL}?nodePath=${path}&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const rawData = response.data.data || response.data;
      if (rawData.perBlock && Array.isArray(rawData.perBlock)) {
        // Fetch timestamps for each block
        const blockPromises = rawData.perBlock.map(block =>
          axios.get(`${API_URL}?nodePath=chain/block/${block.height}&${nodeBaseParam}`)
        );
        const blockResponses = await Promise.allSettled(blockPromises);
        const timestampMap = {};
        blockResponses.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            const blockData = res.value.data.data || res.value.data;
            timestampMap[rawData.perBlock[idx].height] = blockData.timestamp;
          }
        });

        const newItems = rawData.perBlock.flatMap(block => {
          const txs = [
            ...(block.transactions?.transfers || []),
            ...(block.transactions?.rewards || [])
          ];
          return txs.map(tx => ({
            ...tx,
            confirmations: block.confirmations,
            height: block.height,
            txid: tx.txHash, // Use txHash as txid
            timestamp: tx.timestamp || block.timestamp || timestampMap[block.height],
          }));
        });
        setAllHistory(prev => [...prev, ...newItems]);
        setHasMore(newItems.length > 0 && rawData.fromId > 0);
        setNextCursor(rawData.fromId > 0 ? rawData.fromId : null);
      } else {
        setError('Unexpected response format');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch transaction history');
    } finally {
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentHistory = allHistory.slice(startIndex, endIndex);
  const hasNext = (endIndex < allHistory.length) || hasMore;

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <section style={{ fontFamily: 'Montserrat', color: '#FFECB3' }}>
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        {blockCounts && (
          <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium order-1 md:order-2 mt-2 md:mt-0 mb-1 w-fit">
            blocks 24h <span className="relative cursor-pointer" onMouseEnter={() => { if (timeoutId24h) clearTimeout(timeoutId24h); setShowTooltip24h(true); }} onMouseLeave={() => { const id = setTimeout(() => setShowTooltip24h(false), 1000); setTimeoutId24h(id); }}>
              {blockCounts['24h']}
              {showTooltip24h && blockCounts.rewards24h.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 text-white text-xs rounded p-2 z-10 max-w-md" onMouseEnter={() => { if (timeoutId24h) clearTimeout(timeoutId24h); }} onMouseLeave={() => { const id = setTimeout(() => setShowTooltip24h(false), 1000); setTimeoutId24h(id); }}>
                  <div className="font-semibold mb-1">Reward TXIDs (24h):</div>
                  <ul className="space-y-1">
                    {blockCounts.rewards24h.map(txid => <li key={txid} className="break-all cursor-pointer hover:underline" onClick={() => copyToClipboard(txid)}>{abbreviate(txid)}</li>)}
                  </ul>
                </div>
              )}
            </span> week <span className="relative cursor-pointer" onMouseEnter={() => { if (timeoutIdWeek) clearTimeout(timeoutIdWeek); setShowTooltipWeek(true); }} onMouseLeave={() => { const id = setTimeout(() => setShowTooltipWeek(false), 1000); setTimeoutIdWeek(id); }}>
              {blockCounts.week}
              {showTooltipWeek && blockCounts.rewardsWeek.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 text-white text-xs rounded p-2 z-10 max-w-md" onMouseEnter={() => { if (timeoutIdWeek) clearTimeout(timeoutIdWeek); }} onMouseLeave={() => { const id = setTimeout(() => setShowTooltipWeek(false), 1000); setTimeoutIdWeek(id); }}>
                  <div className="font-semibold mb-1">Reward TXIDs (Week):</div>
                  <ul className="space-y-1">
                    {blockCounts.rewardsWeek.map(txid => <li key={txid} className="break-all cursor-pointer hover:underline" onClick={() => copyToClipboard(txid)}>{abbreviate(txid)}</li>)}
                  </ul>
                </div>
              )}
            </span> month <span className="relative cursor-pointer" onMouseEnter={() => { if (timeoutIdMonth) clearTimeout(timeoutIdMonth); setShowTooltipMonth(true); }} onMouseLeave={() => { const id = setTimeout(() => setShowTooltipMonth(false), 1000); setTimeoutIdMonth(id); }}>
              {blockCounts.month}
              {showTooltipMonth && blockCounts.rewardsMonth.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 text-white text-xs rounded p-2 z-10 max-w-md" onMouseEnter={() => { if (timeoutIdMonth) clearTimeout(timeoutIdMonth); }} onMouseLeave={() => { const id = setTimeout(() => setShowTooltipMonth(false), 1000); setTimeoutIdMonth(id); }}>
                  <div className="font-semibold mb-1">Reward TXIDs (Month):</div>
                  <ul className="space-y-1">
                    {blockCounts.rewardsMonth.map(txid => <li key={txid} className="break-all cursor-pointer hover:underline" onClick={() => copyToClipboard(txid)}>{abbreviate(txid)}</li>)}
                  </ul>
                </div>
              )}
            </span>
          </div>
        )}
        <h2 className="text-base font-semibold text-orange-400 flex items-center gap-2 flex-wrap order-2 md:order-1">
          Transaction History <span className="text-sm">(Page {currentPage})</span>
          <span
            className={`inline-block w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}
          ></span>
        </h2>
      </div>
      {error && <div className="error"><strong>Error:</strong> {error}</div>}
      {allHistory.length === 0 && !loading && <p>No transactions found.</p>}
      {currentHistory.length > 0 && (
        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
          {currentHistory.map((tx, index) => (
            <div
              key={index}
              id={`tx-${tx.txid}`}
              style={{
                backgroundColor: '#ffecb33d',
                border: '1px solid #caa21eff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                color: '#e9e6dbff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>TxID:</strong>
                <span 
                  title={tx.txid || 'N/A'} 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => copyToClipboard(tx.txid || '')}
                >
                  {tx.txid ? `${tx.txid.slice(0, 6)}...${tx.txid.slice(-6)}` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>From:</strong>
                <span
                  title={!tx.fromAddress ? 'Block Reward' : tx.fromAddress}
                  style={{ cursor: tx.fromAddress ? 'pointer' : 'default' }}
                  onClick={() => tx.fromAddress && copyToClipboard(tx.fromAddress)}
                >
                  {!tx.fromAddress ? 'Block Reward' : `${tx.fromAddress.slice(0, 6)}...${tx.fromAddress.slice(-6)}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>To:</strong>
                <span 
                  title={tx.toAddress || 'N/A'} 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => copyToClipboard(tx.toAddress || '')}
                >
                  {tx.toAddress ? `${tx.toAddress.slice(0, 6)}...${tx.toAddress.slice(-6)}` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>Amount (WART):</strong>
                <span>{tx.amount !== undefined ? parseFloat(tx.amount).toFixed(8) : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>Fee (WART):</strong>
                <span>{tx.fee !== undefined ? parseFloat(tx.fee).toFixed(8) : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>Confirmations:</strong>
                <span>{tx.confirmations || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#caa21eff' }}>Height:</strong>
                <span>{tx.height || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: '#caa21eff' }}>Date:</strong>
                <span>{tx.timestamp ? new Date(tx.timestamp * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : 'N/A'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <button onClick={handlePrev} disabled={currentPage === 1 || loading}>
          Previous
        </button>
        <button onClick={handleNext} disabled={!hasNext || loading}>
          Next
        </button>
      </div>
    </section>
    </>
  );
};

export default TransactionHistory;

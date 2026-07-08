import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { resolveNodeUrl } from '../lib/nodesCache';

const API_URL = '/api/proxy';
const PAGE_SIZE = 15;

const formatHistoryError = (err, fallback) => {
  const status = err.response?.status;
  if (status === 502) {
    return 'Node is temporarily unreachable. Try another node or refresh in a moment.';
  }
  if (status === 408) {
    return 'Node request timed out. Try again shortly.';
  }
  const body = err.response?.data;
  if (typeof body === 'string' && body.trim()) return body;
  return body?.message || err.message || fallback;
};

const blockTimestamp = (block, blockData) =>
  blockData?.header?.time?.timestamp
  || blockData?.timestamp
  || block?.header?.time?.timestamp
  || block?.timestamp
  || null;

const TX_THEME = {
  sectionColor: '#FFECB3',
  txBackground: '#ffecb362',
  txBorder: '#caa21eff',
  txColor: '#e9e6dbff',
  labelColor: '#caa21eff',
};

const TransactionHistory = ({ address, node, onCountsUpdate, blockCounts, refreshTrigger }) => {
  const [allHistory, setAllHistory] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState('4294967295');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTooltip24h, setShowTooltip24h] = useState(false);
  const [showTooltipWeek, setShowTooltipWeek] = useState(false);
  const [showTooltipMonth, setShowTooltipMonth] = useState(false);
  const [timeoutId24h, setTimeoutId24h] = useState(null);
  const [timeoutIdWeek, setTimeoutIdWeek] = useState(null);
  const [timeoutIdMonth, setTimeoutIdMonth] = useState(null);

  const abbreviate = (str) => {
    if (!str) return 'N/A';
    if (str.length <= 12) return str;
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  };

  const abbreviateTxid = (str) => {
    if (!str) return 'N/A';
    if (str.length <= 14) return str;
    return `${str.slice(0, 6)}…${str.slice(-6)}`;
  };

  const nodeUrl = resolveNodeUrl(node);

  useEffect(() => {
    setAllHistory([]);
    setCurrentPage(1);
    setNextCursor('4294967295');
    setHasMore(true);
    setError(null);
  }, [address, nodeUrl]);

  useEffect(() => {
    if (address && nodeUrl) {
      fetchInitialHistory();
    }
  }, [address, nodeUrl, refreshTrigger]);

  useEffect(() => {
    if (allHistory.length > 0 && onCountsUpdate) {
      const now = Date.now() / 1000;
      const oneDayAgo = now - 24 * 60 * 60;
      const oneWeekAgo = now - 7 * 24 * 60 * 60;
      const oneMonthAgo = now - 30 * 24 * 60 * 60;
      const rewards = allHistory.filter((tx) => !tx.fromAddress && tx.timestamp);
      const rewards24h = rewards.filter((tx) => tx.timestamp >= oneDayAgo);
      const rewardsWeek = rewards.filter((tx) => tx.timestamp >= oneWeekAgo);
      const rewardsMonth = rewards.filter((tx) => tx.timestamp >= oneMonthAgo);
      onCountsUpdate({
        '24h': rewards24h.length,
        week: rewardsWeek.length,
        month: rewardsMonth.length,
        rewards24h: rewards24h.map((tx) => tx.txid),
        rewardsWeek: rewardsWeek.map((tx) => tx.txid),
        rewardsMonth: rewardsMonth.map((tx) => tx.txid),
      });
    }
  }, [allHistory, onCountsUpdate]);

  const parseHistoryBlocks = async (rawData, nodeBaseParam) => {
    const timestampMap = {};
    rawData.perBlock.forEach((block) => {
      const ts = blockTimestamp(block, null);
      if (ts) timestampMap[block.height] = ts;
    });

    const blocksNeedingFetch = rawData.perBlock.filter((block) => !timestampMap[block.height]);
    if (blocksNeedingFetch.length > 0) {
      const blockResponses = await Promise.allSettled(
        blocksNeedingFetch.map((block) =>
          axios.get(`${API_URL}?nodePath=chain/block/${block.height}&${nodeBaseParam}`)
        )
      );
      blockResponses.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          const blockData = res.value.data.data || res.value.data;
          const h = blocksNeedingFetch[idx].height;
          timestampMap[h] = blockTimestamp(blocksNeedingFetch[idx], blockData);
        }
      });
    }

    return rawData.perBlock.flatMap((block) => {
      // Node history uses `transactions`; some payloads use `body` (same as chain/block)
      const group = block.transactions || block.body || {};
      const txs = [
        ...(Array.isArray(group.transfers) ? group.transfers : []),
        ...(Array.isArray(group.rewards) ? group.rewards : []),
      ];
      return txs.map((tx) => {
        const isReward = !tx.fromAddress;
        return {
          ...tx,
          isReward,
          type: isReward ? 'reward' : 'wart_transfer',
          asset: 'WART',
          confirmations: block.confirmations,
          height: block.height,
          txid: tx.txHash || tx.txid,
          timestamp: tx.timestamp || block.timestamp || timestampMap[block.height],
          amount:
            tx.amount !== undefined
              ? parseFloat(tx.amount).toFixed(8)
              : 'N/A',
          fee:
            tx.fee !== undefined
              ? parseFloat(tx.fee).toFixed(8)
              : '0',
        };
      });
    });
  };

  const fetchInitialHistory = async () => {
    if (!nodeUrl) return;
    setLoading(true);
    setError(null);
    try {
      const nodeBaseParam = `nodeBase=${encodeURIComponent(nodeUrl)}`;
      const path = `account/${address}/history/4294967295`;
      const response = await axios.get(`${API_URL}?nodePath=${path}&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const rawData = response.data.data || response.data;
      if (rawData.perBlock && Array.isArray(rawData.perBlock)) {
        const newItems = await parseHistoryBlocks(rawData, nodeBaseParam);
        setAllHistory(newItems);
        setNextCursor(rawData.fromId > 0 ? rawData.fromId : null);
        setHasMore(newItems.length > 0 && rawData.fromId > 0);
        setCurrentPage(1);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      setError(formatHistoryError(err, 'Failed to fetch transaction history'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreHistory = async () => {
    if (!hasMore || loading || !nodeUrl) return;
    setLoading(true);
    try {
      const nodeBaseParam = `nodeBase=${encodeURIComponent(nodeUrl)}`;
      const path = `account/${address}/history/${nextCursor}`;
      const response = await axios.get(`${API_URL}?nodePath=${path}&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const rawData = response.data.data || response.data;
      if (rawData.perBlock && Array.isArray(rawData.perBlock)) {
        const newItems = await parseHistoryBlocks(rawData, nodeBaseParam);
        setAllHistory((prev) => [...prev, ...newItems]);
        setHasMore(newItems.length > 0 && rawData.fromId > 0);
        setNextCursor(rawData.fromId > 0 ? rawData.fromId : null);
      } else {
        setError('Unexpected response format');
      }
    } catch (err) {
      setError(formatHistoryError(err, 'Failed to fetch transaction history'));
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
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy: ', err);
    });
  };

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentHistory = allHistory.slice(startIndex, endIndex);
  const hasNext = endIndex < allHistory.length || hasMore;

  const { sectionColor, txBackground, txBorder, txColor, labelColor } = TX_THEME;

  const periodBadges = blockCounts
    ? [
        {
          key: '24h',
          label: '24h',
          count: blockCounts['24h'],
          txids: blockCounts.rewards24h,
          show: showTooltip24h,
          setShow: setShowTooltip24h,
          timeoutId: timeoutId24h,
          setTimeoutId: setTimeoutId24h,
          tooltipTitle: 'Reward TXIDs (24h)',
        },
        {
          key: 'week',
          label: 'Week',
          count: blockCounts.week,
          txids: blockCounts.rewardsWeek,
          show: showTooltipWeek,
          setShow: setShowTooltipWeek,
          timeoutId: timeoutIdWeek,
          setTimeoutId: setTimeoutIdWeek,
          tooltipTitle: 'Reward TXIDs (Week)',
        },
        {
          key: 'month',
          label: 'Month',
          count: blockCounts.month,
          txids: blockCounts.rewardsMonth,
          show: showTooltipMonth,
          setShow: setShowTooltipMonth,
          timeoutId: timeoutIdMonth,
          setTimeoutId: setTimeoutIdMonth,
          tooltipTitle: 'Reward TXIDs (Month)',
        },
      ]
    : [];

  const getTypeBadge = (tx) => {
    if (tx.isReward || tx.type === 'reward') {
      return { label: 'REWARD', bg: '#166534', color: '#86efac' };
    }
    return { label: 'TRANSFER', bg: '#1e3a8a', color: '#93c5fd' };
  };

  return (
    <section
      className="!p-0 !bg-transparent !border-0 !shadow-none !mb-0 mt-8"
      style={{ fontFamily: 'Montserrat, sans-serif', color: sectionColor }}
    >
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        {periodBadges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap order-1 md:order-2 mt-2 md:mt-0 mb-1">
            {periodBadges.map((period) => (
              <span
                key={period.key}
                className="compact-btn-tooltip-host"
                onMouseEnter={() => {
                  if (period.timeoutId) clearTimeout(period.timeoutId);
                  period.setShow(true);
                }}
                onMouseLeave={() => {
                  const id = setTimeout(() => period.setShow(false), 1000);
                  period.setTimeoutId(id);
                }}
              >
                <span className="compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1 cursor-default">
                  {period.label} · <span className="font-semibold tabular-nums">{period.count}</span>
                </span>
                {period.show && period.count > 0 && (
                  <div className="absolute top-full left-0 mt-1.5 min-w-[220px] max-w-md bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl p-3 z-[100] shadow-2xl shadow-black/50 text-left font-normal normal-case">
                    <div className="font-semibold mb-1.5 text-[#FDB913]">{period.tooltipTitle}</div>
                    {period.txids.length > 0 ? (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {period.txids.map((txid) => (
                          <li
                            key={txid}
                            className="break-all cursor-pointer hover:text-[#E79300] hover:underline font-mono"
                            onClick={() => copyToClipboard(txid)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                copyToClipboard(txid);
                              }
                            }}
                          >
                            {abbreviate(txid)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 italic">Reward hashes not available for this period.</p>
                    )}
                    <p className="text-[10px] text-zinc-500 mt-2">Click a hash to copy</p>
                  </div>
                )}
              </span>
            ))}
          </div>
        )}
        <h2 className="text-base font-semibold text-orange-400 flex items-center gap-2 flex-wrap order-2 md:order-1 !mb-0">
          Transaction History <span className="text-sm">(Page {currentPage})</span>
          <span
            className={`inline-block w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}
          />
        </h2>
      </div>

      {error && (
        <div className="error mt-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      {allHistory.length === 0 && !loading && (
        <p className="text-zinc-400 text-sm mt-4">No transactions found.</p>
      )}

      {currentHistory.length > 0 && (
        <div className="mt-4" style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '10px' }}>
          {currentHistory.map((tx, index) => {
            const badge = getTypeBadge(tx);
            return (
              <div
                key={`${tx.txid || 'tx'}-${index}`}
                id={`tx-${tx.txid}`}
                style={{
                  backgroundColor: txBackground,
                  border: `1px solid ${txBorder}`,
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '14px',
                  color: txColor,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      padding: '2px 9px',
                      borderRadius: '999px',
                      background: badge.bg,
                      color: badge.color,
                      textTransform: 'uppercase',
                    }}
                  >
                    {badge.label}
                  </span>
                  <span
                    title={tx.txid || 'N/A'}
                    style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px' }}
                    onClick={() => copyToClipboard(tx.txid)}
                  >
                    {abbreviateTxid(tx.txid)}
                  </span>
                </div>

                {(tx.fromAddress || tx.isReward) && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <strong style={{ color: labelColor, minWidth: 42 }}>From:</strong>
                    <span
                      title={tx.isReward || !tx.fromAddress ? 'Block Reward / System' : tx.fromAddress}
                      style={{
                        cursor: tx.fromAddress ? 'pointer' : 'default',
                        fontFamily: 'monospace',
                      }}
                      onClick={() => tx.fromAddress && copyToClipboard(tx.fromAddress)}
                    >
                      {tx.isReward || !tx.fromAddress ? 'System / Reward' : abbreviate(tx.fromAddress)}
                    </span>
                  </div>
                )}

                {tx.toAddress && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <strong style={{ color: labelColor, minWidth: 42 }}>To:</strong>
                    <span
                      title={tx.toAddress}
                      style={{ cursor: 'pointer', fontFamily: 'monospace' }}
                      onClick={() => copyToClipboard(tx.toAddress)}
                    >
                      {abbreviate(tx.toAddress)}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    fontSize: '12px',
                  }}
                >
                  <strong style={{ color: labelColor, minWidth: 42 }}>Amount:</strong>
                  <span style={{ fontFamily: 'monospace' }}>
                    {tx.amount} <span style={{ opacity: 0.7 }}>{tx.asset}</span>
                  </span>
                </div>

                {tx.fee && tx.fee !== '0' && tx.fee !== '0.00000000' && !tx.isReward && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <strong style={{ color: labelColor, minWidth: 42 }}>Fee:</strong>
                    <span style={{ fontFamily: 'monospace' }}>{tx.fee} WART</span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    opacity: 0.85,
                    marginTop: '6px',
                    borderTop: `1px solid ${txBorder}`,
                    paddingTop: '6px',
                  }}
                >
                  <span>Conf: {tx.confirmations ?? '—'}</span>
                  <span>H: {tx.height ?? '—'}</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {tx.timestamp
                      ? new Date(Number(tx.timestamp) * 1000)
                          .toISOString()
                          .replace('T', ' ')
                          .replace(/\.\d{3}Z$/, ' UTC')
                      : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          className="compact-btn"
          onClick={handlePrev}
          disabled={currentPage === 1 || loading}
        >
          Previous
        </button>
        <button
          type="button"
          className="compact-btn"
          onClick={handleNext}
          disabled={!hasNext || loading}
        >
          Next
        </button>
      </div>
    </section>
  );
};

export default TransactionHistory;
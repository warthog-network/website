import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format_height, abbreviate } from './assets/util.js';
import BunkerShell from '../BunkerShell.jsx';
import { resolveExplorerHostFromStorage } from '../../lib/explorerNodes.js';
import { fetchAccountWartBalance } from '../../lib/accountBalance.js';
import ExplorerAddress from './ExplorerAddress.jsx';
import ExplorerLink from './ExplorerLink.jsx';
import ExplorerRefreshButton from './ExplorerRefreshButton.jsx';
import { createWarthogApi } from './explorerClient.js';
import { resolveWarthogAddress } from './explorerAddressUtils.js';
import { formatExplorerError } from './explorerApi.js';
import { formatWartUsdBalance } from '../../lib/wartPrice.js';
import {
  ADDRESS_HISTORY_CURSOR,
  clearAddressHistoryCache,
  loadAddressHistory,
  readAddressHistoryCache,
} from '../../lib/addressHistoryStore.js';
import {
  fetchIndexerAccount,
  shouldUseExplorerIndexerFromStorage,
} from './explorerIndexerClient.js';
import { pushRecentView } from '../../lib/explorerRecent.js';
import { copyWithToast } from '../../lib/explorerToast.js';

const PAGE_SIZE = 15;

const HISTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'in', label: 'In' },
  { id: 'out', label: 'Out' },
];

function txKind(tx) {
  const type = String(tx?.type || '').toLowerCase();
  if (type === 'reward' || (!tx?.fromAddress && (tx?.toAddress || tx?.recipient))) {
    return 'reward';
  }
  return 'transfer';
}

function txDirection(tx) {
  if (tx?.direction === 'in' || tx?.direction === 'out' || tx?.direction === 'self') {
    return tx.direction;
  }
  if (txKind(tx) === 'reward') return 'in';
  return 'unknown';
}

function matchesHistoryFilter(tx, filter) {
  if (!filter || filter === 'all') return true;
  const kind = txKind(tx);
  const dir = txDirection(tx);
  if (filter === 'rewards') return kind === 'reward';
  if (filter === 'transfers') return kind === 'transfer';
  if (filter === 'in') return dir === 'in' || kind === 'reward';
  if (filter === 'out') return dir === 'out';
  return true;
}

function formatSignedAmount(tx) {
  const raw = tx?.amount;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return { text: String(raw), tone: 'neutral' };
  const dir = txDirection(tx);
  const pretty = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
  if (dir === 'out') return { text: `−${pretty}`, tone: 'out' };
  if (dir === 'in' || txKind(tx) === 'reward') return { text: `+${pretty}`, tone: 'in' };
  return { text: pretty, tone: 'neutral' };
}

function formatRelativeTime(timestamp) {
  if (timestamp == null) return null;
  const now = Date.now() / 1000;
  const diff = now - Number(timestamp);
  if (!Number.isFinite(diff)) return null;
  if (diff < 60) return `${Math.max(0, Math.floor(diff))}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

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

  const kind = txKind(tx);
  const dir = txDirection(tx);
  const signed = formatSignedAmount(tx);
  const rel = formatRelativeTime(tx.timestamp);
  const badge =
    kind === 'reward' ? 'Reward'
      : dir === 'in' ? 'IN'
        : dir === 'out' ? 'OUT'
          : dir === 'self' ? 'SELF'
            : 'Tx';

  return (
    <li key={tx.txid || `tx-${index}`} className="bunker-list-item explorer-tx-item">
      <div className="flex justify-between items-center gap-2">
        <div className="explorer-tx-item__title-row">
          <span className={`explorer-chip explorer-chip--${kind === 'reward' ? 'reward' : dir}`}>
            {badge}
          </span>
          <span
            className="bunker-tx-title"
            style={{ cursor: 'pointer' }}
            title={safeStr(tx.txid)}
            onClick={() => copyWithToast(tx.txid, 'Tx hash copied')}
          >
            {abbreviate(safeStr(tx.txid))}
          </span>
        </div>
        <div className="explorer-tx-item__right">
          {signed && (
            <span className={`explorer-amount explorer-amount--${signed.tone}`}>
              {signed.text} WART
            </span>
          )}
          {tx.txid && (
            <ExplorerLink
              to={`/transaction/lookup/${tx.txid}`}
              className="bunker-link"
            >
              Details
            </ExplorerLink>
          )}
        </div>
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
      {tx.fee != null && Number(tx.fee) > 0 && (
        <div className="bunker-meta">
          Fee: {safeStr(tx.fee)}
        </div>
      )}
      <div className="bunker-meta explorer-tx-item__meta-row">
        {tx.height != null && (
          <span>
            Block:{' '}
            <ExplorerLink to={`/chain/block/${tx.height}`} className="bunker-link">
              {format_height(tx.height)}
            </ExplorerLink>
          </span>
        )}
        {tx.confirmations !== undefined && tx.confirmations !== null && (
          <span>{tx.confirmations} conf</span>
        )}
        {rel && (
          <span title={tx.timestamp ? new Date(Number(tx.timestamp) * 1000).toLocaleString() : undefined}>
            {rel}
          </span>
        )}
      </div>
    </li>
  );
}

function AddressTransactions({ address: addressProp } = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const rawAddress = addressProp ?? params.address;

  const addressKey = useMemo(
    () => String(rawAddress || '').trim().toLowerCase().replace(/^0x/i, ''),
    [rawAddress],
  );

  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [allHistory, setAllHistory] = useState([]);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState(ADDRESS_HISTORY_CURSOR);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [balance, setBalance] = useState(null);
  const [usdBalance, setUsdBalance] = useState(null);
  const [invalidAddress, setInvalidAddress] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');

  // Tracks which addressKey the UI is currently bound to (survives strict remounts)
  const shownKeyRef = useRef(addressKey);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const updateUsdBalance = useCallback((bal) => {
    if (!bal || bal === 'N/A') {
      setUsdBalance('N/A');
      return;
    }
    formatWartUsdBalance(bal)
      .then((usd) => setUsdBalance(usd))
      .catch(() => setUsdBalance('N/A'));
  }, []);

  const applyPayloadToUi = useCallback((payload, { append = false } = {}) => {
    if (!payload) return;

    if (payload.balance != null) {
      setBalance((prev) => prev ?? payload.balance);
      updateUsdBalance(payload.balance);
    }

    if (append) {
      setAllHistory((prev) => [...prev, ...(payload.items || [])]);
    } else if (payload.items?.length) {
      setAllHistory(payload.items);
    } else if (payload.empty && !payload.preserved) {
      // Confirmed empty account — only clear if we aren't preserving prior data
      setAllHistory((prev) => (prev.length ? prev : []));
    }
    // If preserved (non-empty cache kept over empty revalidation), leave list alone

    setNextCursor(payload.nextCursor ?? null);
    setHasMore(Boolean(payload.hasMore));
    setHistoryLoaded(true);
    setHistoryError(null);
  }, [updateUsdBalance]);

  // Main load — keyed only on addressKey
  useEffect(() => {
    if (!addressKey) return undefined;

    shownKeyRef.current = addressKey;
    const host = resolveExplorerHostFromStorage();
    const routeParam = rawAddress;

    setError(null);
    setHistoryError(null);
    setInvalidAddress(false);
    setCurrentPage(1);
    setRefreshing(false);

    // Instant paint from shared cache (survives explorer → back)
    const cached = readAddressHistoryCache(addressKey, host);
    if (cached?.items?.length) {
      setAllHistory(cached.items);
      setNextCursor(cached.nextCursor);
      setHasMore(Boolean(cached.hasMore));
      setHistoryLoaded(true);
      setHistoryLoading(true); // revalidating
      if (cached.balance != null) {
        setBalance(cached.balance);
        updateUsdBalance(cached.balance);
        setBalanceLoading(false);
      } else {
        setBalanceLoading(true);
      }
    } else {
      setAllHistory([]);
      setNextCursor(ADDRESS_HISTORY_CURSOR);
      setHasMore(false);
      setHistoryLoaded(false);
      setHistoryLoading(true);
      setBalance(null);
      setUsdBalance(null);
      setBalanceLoading(true);
    }
    setResolvedAddress(null);

    let cancelled = false;

    (async () => {
      try {
        const normalized = await resolveWarthogAddress(routeParam);
        if (cancelled || shownKeyRef.current !== addressKey) return;

        if (!normalized) {
          setInvalidAddress(true);
          setHistoryLoading(false);
          setBalanceLoading(false);
          setHistoryLoaded(true);
          setError('Invalid Warthog address');
          return;
        }

        setResolvedAddress(normalized);
        pushRecentView({
          type: 'address',
          id: normalized,
          label: normalized,
        });

        if (String(routeParam) !== normalized) {
          navigate(`/address/${encodeURIComponent(normalized)}`, { replace: true });
        }

        // Balance (fast) — prefer indexer on official node
        const balanceTask = (async () => {
          try {
            let bal = null;
            if (shouldUseExplorerIndexerFromStorage()) {
              try {
                const acct = await fetchIndexerAccount(normalized);
                bal = acct.balance;
              } catch (idxErr) {
                console.warn('Indexer balance failed, trying node', idxErr);
              }
            }
            if (bal == null) {
              const api = await createWarthogApi(host);
              if (cancelled || shownKeyRef.current !== addressKey) return;
              bal = await fetchAccountWartBalance(api, normalized);
            }
            if (cancelled || shownKeyRef.current !== addressKey) return;
            setBalance(bal);
            updateUsdBalance(bal);
          } catch (err) {
            console.error('Failed to fetch balance', err);
          } finally {
            if (!cancelled && shownKeyRef.current === addressKey) {
              setBalanceLoading(false);
            }
          }
        })();

        // History — deduped at store level so remounts share one request
        const historyTask = (async () => {
          try {
            const payload = await loadAddressHistory(normalized, { host, force: false });
            // Apply if this address is still the one on screen (even if this effect
            // instance was "cancelled" by Strict Mode — the data is still correct).
            if (shownKeyRef.current !== addressKey) return;
            applyPayloadToUi(payload, { append: false });
          } catch (err) {
            if (shownKeyRef.current !== addressKey) return;
            console.error('Failed to fetch history', err);
            setHistoryError(
              formatExplorerError(err, 'Failed to fetch transaction history'),
            );
            setHistoryLoaded(true);
          } finally {
            if (shownKeyRef.current === addressKey) {
              setHistoryLoading(false);
            }
          }
        })();

        await Promise.all([balanceTask, historyTask]);
      } catch (err) {
        if (shownKeyRef.current !== addressKey) return;
        console.error('Failed to load address page', err);
        setError(formatExplorerError(err, 'Failed to fetch address data'));
        setHistoryLoading(false);
        setBalanceLoading(false);
        setHistoryLoaded(true);
      }
    })();

    return () => {
      // Do not clear shownKeyRef here — a remount for the same address reuses it.
      // Only mark this effect instance cancelled for balance updates.
      cancelled = true;
    };
  }, [addressKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Balance poll
  useEffect(() => {
    if (!resolvedAddress) return undefined;
    const key = addressKey;

    const poll = async () => {
      try {
        let bal = null;
        if (shouldUseExplorerIndexerFromStorage()) {
          try {
            const acct = await fetchIndexerAccount(resolvedAddress);
            bal = acct.balance;
          } catch (_) { /* fall through */ }
        }
        if (bal == null) {
          const host = resolveExplorerHostFromStorage();
          const api = await createWarthogApi(host);
          if (shownKeyRef.current !== key) return;
          bal = await fetchAccountWartBalance(api, resolvedAddress);
        }
        if (shownKeyRef.current !== key) return;
        setBalance(bal);
        updateUsdBalance(bal);
      } catch (err) {
        console.error('Failed to refresh balance', err);
      }
    };

    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [resolvedAddress, addressKey, updateUsdBalance]);

  const fetchMoreHistory = async () => {
    if (!hasMore || historyLoading || !nextCursor || !resolvedAddress) return;
    const key = addressKey;
    const host = resolveExplorerHostFromStorage();
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const payload = await loadAddressHistory(resolvedAddress, {
        host,
        cursor: nextCursor,
        force: true,
      });
      if (shownKeyRef.current !== key) return;
      applyPayloadToUi(payload, { append: true });
    } catch (err) {
      if (shownKeyRef.current !== key) return;
      setHistoryError(formatExplorerError(err, 'Failed to fetch transaction history'));
    } finally {
      if (shownKeyRef.current === key) setHistoryLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!resolvedAddress || refreshing) return;
    const key = addressKey;
    const host = resolveExplorerHostFromStorage();
    clearAddressHistoryCache(key, host);

    setRefreshing(true);
    setHistoryError(null);
    setError(null);
    setCurrentPage(1);
    setHistoryLoading(true);
    setBalanceLoading(true);
    shownKeyRef.current = key;

    try {
      const api = await createWarthogApi(host);

      const balanceTask = fetchAccountWartBalance(api, resolvedAddress)
        .then((bal) => {
          if (shownKeyRef.current !== key) return;
          setBalance(bal);
          updateUsdBalance(bal);
        })
        .catch((err) => console.error('Failed to fetch balance', err))
        .finally(() => {
          if (shownKeyRef.current === key) setBalanceLoading(false);
        });

      const historyTask = loadAddressHistory(resolvedAddress, { host, force: true })
        .then((payload) => {
          if (shownKeyRef.current !== key) return;
          applyPayloadToUi(payload, { append: false });
        })
        .catch((err) => {
          if (shownKeyRef.current !== key) return;
          setHistoryError(formatExplorerError(err, 'Failed to fetch transaction history'));
          setHistoryLoaded(true);
        })
        .finally(() => {
          if (shownKeyRef.current === key) setHistoryLoading(false);
        });

      await Promise.all([balanceTask, historyTask]);
    } finally {
      if (shownKeyRef.current === key) setRefreshing(false);
    }
  };

  const filteredHistory = useMemo(
    () => allHistory.filter((tx) => matchesHistoryFilter(tx, historyFilter)),
    [allHistory, historyFilter],
  );

  const handleFilterChange = (id) => {
    setHistoryFilter(id);
    setCurrentPage(1);
  };

  const handleNext = () => {
    const nextPage = currentPage + 1;
    const requiredLength = nextPage * PAGE_SIZE;
    if (filteredHistory.length < requiredLength && hasMore) {
      fetchMoreHistory();
    }
    if (
      filteredHistory.length >= requiredLength
      || (filteredHistory.length < requiredLength && !hasMore)
    ) {
      setCurrentPage(nextPage);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const displayAddress = resolvedAddress || rawAddress;

  if (!rawAddress) {
    return (
      <BunkerShell title="Address Not Found">
        <p className="bunker-muted">No address provided.</p>
        <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
          ← Back to Explorer
        </ExplorerLink>
      </BunkerShell>
    );
  }

  if (invalidAddress) {
    return (
      <BunkerShell title="Invalid Address">
        <p className="bunker-muted">{error || 'Invalid Warthog address.'}</p>
        <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
          ← Back to Explorer
        </ExplorerLink>
      </BunkerShell>
    );
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentHistory = filteredHistory.slice(startIndex, endIndex);
  const hasNext = (endIndex < filteredHistory.length) || hasMore;
  const showHistoryEmpty =
    historyLoaded && !historyLoading && currentHistory.length === 0 && !historyError;

  return (
    <BunkerShell
      title="Address Transactions"
      wide
      actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
    >
      <h2 className="bunker-subheading">Address {abbreviate(displayAddress)}</h2>
      <div className="bunker-panel">
        <dl className="bunker-dl" style={{ marginBottom: '1rem' }}>
          <div className="bunker-dl-row">
            <dt>Address</dt>
            <dd>
              <ExplorerAddress
                address={displayAddress}
                abbreviated={isMobile}
                showLink={false}
              />
            </dd>
          </div>
          <div className="bunker-dl-row">
            <dt>Balance</dt>
            <dd>
              {balance == null
                ? (balanceLoading ? 'Loading…' : '—')
                : `${balance}${usdBalance && usdBalance !== 'N/A' ? ` (${usdBalance})` : ''}`}
            </dd>
          </div>
        </dl>
        <div className="bunker-toolbar" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="bunker-heading" style={{ margin: 0 }}>
            Transaction History
            <span className="bunker-muted" style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
              (Page {currentPage})
            </span>
          </h3>
          <div className="explorer-filter-bar" role="tablist" aria-label="History filter">
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={historyFilter === f.id}
                className={`bunker-btn explorer-filter-btn${historyFilter === f.id ? ' is-active' : ''}`}
                onClick={() => handleFilterChange(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="bunker-alert"><strong>Error:</strong> {error}</div>
        )}
        {historyError && (
          <div className="bunker-alert">
            <strong>Error:</strong> {historyError}{' '}
            <button
              type="button"
              className="bunker-btn"
              style={{ marginLeft: '0.5rem' }}
              onClick={handleRefresh}
              disabled={refreshing || historyLoading}
            >
              Retry
            </button>
          </div>
        )}
        {historyLoading && allHistory.length === 0 ? (
          <p className="bunker-muted">
            Loading transactions…
          </p>
        ) : currentHistory.length > 0 ? (
          <>
            {historyLoading && (
              <p className="bunker-muted">Updating…</p>
            )}
            <ul className="bunker-list">
              {currentHistory.map((tx, index) => (
                <TransactionItem
                  key={tx.txid || `tx-${startIndex + index}`}
                  tx={tx}
                  index={startIndex + index}
                />
              ))}
            </ul>
          </>
        ) : showHistoryEmpty ? (
          <p className="bunker-muted">
            {historyFilter !== 'all' && allHistory.length > 0
              ? `No ${historyFilter} transactions in the loaded pages. Try “All” or load more.`
              : 'No transactions found for this address.'}
            {historyFilter !== 'all' && hasMore && (
              <>
                {' '}
                <button type="button" className="bunker-btn bunker-btn--ghost" onClick={fetchMoreHistory}>
                  Load more
                </button>
              </>
            )}
          </p>
        ) : (
          <p className="bunker-muted">Loading transactions…</p>
        )}
      </div>
      <div className="bunker-toolbar" style={{ marginTop: '1.5rem' }}>
        <button
          onClick={handlePrev}
          disabled={currentPage === 1 || historyLoading}
          className="bunker-btn bunker-btn--ghost"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={!hasNext || historyLoading}
          className="bunker-btn bunker-btn--ghost"
        >
          Next
        </button>
      </div>
      <ExplorerLink to="/explorer" className="bunker-btn bunker-btn--ghost" style={{ marginTop: '1rem' }}>
        ← Back to Explorer
      </ExplorerLink>
    </BunkerShell>
  );
}

export default AddressTransactions;

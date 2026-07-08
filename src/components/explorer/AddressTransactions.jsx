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
          <ExplorerLink
            to={`/transaction/lookup/${tx.txid}`}
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

        if (String(routeParam) !== normalized) {
          navigate(`/address/${encodeURIComponent(normalized)}`, { replace: true });
        }

        // Balance (fast) — independent
        const balanceTask = (async () => {
          try {
            const api = await createWarthogApi(host);
            if (cancelled || shownKeyRef.current !== addressKey) return;
            const bal = await fetchAccountWartBalance(api, normalized);
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
        const host = resolveExplorerHostFromStorage();
        const api = await createWarthogApi(host);
        if (shownKeyRef.current !== key) return;
        const bal = await fetchAccountWartBalance(api, resolvedAddress);
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
  const currentHistory = allHistory.slice(startIndex, endIndex);
  const hasNext = (endIndex < allHistory.length) || hasMore;
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
        <h3 className="bunker-heading">Transaction History (Page {currentPage})</h3>
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
            Loading transactions… (busy miners can take several seconds on the node)
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
          <p className="bunker-muted">No transactions found for this address.</p>
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

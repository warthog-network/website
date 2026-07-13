import { useState, useEffect } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import { Block } from './assets/block.js';
import BunkerShell from '../BunkerShell.jsx';
import ExplorerAddress from './ExplorerAddress.jsx';
import ExplorerLink from './ExplorerLink.jsx';
import ExplorerRefreshButton from './ExplorerRefreshButton.jsx';
import {
    createWarthogApi,
    fetchChainHeadHeight,
    fetchExplorerBlock,
    fetchRecentBlocks,
} from './explorerClient.js';
import {
    fetchIndexerBlock,
    fetchIndexerLatestBlocks,
    shouldUseExplorerIndexer,
} from './explorerIndexerClient.js';
import {
    ADD_CUSTOM_KEY,
    OFFICIAL1_KEY,
    OFFICIAL1_URL,
    getExplorerHost,
    getNodeSelectOptions,
    loadSavedCustomNodes,
    normalizeSelectedNode,
    saveCustomNode,
} from '../../lib/explorerNodes.js';
import { formatExplorerError } from './explorerApi.js';
import ExplorerStatsBar from './ExplorerStatsBar.jsx';
import ExplorerUnifiedSearch from './ExplorerUnifiedSearch.jsx';
import ExplorerRecentViews from './ExplorerRecentViews.jsx';
import {
    readExplorerChainCache,
    writeExplorerChainCache,
} from '../../lib/explorerSessionCache.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRY_DELAYS_MS = [500, 1000, 2000, 3000, 4000];

async function fetchWithRetry(fn) {
    let lastError;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < RETRY_DELAYS_MS.length) {
                await sleep(RETRY_DELAYS_MS[attempt]);
            }
        }
    }
    throw lastError;
}

function Explorer() {
    // Navigation lives in ExplorerUnifiedSearch (no useNavigate here).
    const [selectedNode, setSelectedNode] = useState(OFFICIAL1_KEY);
    const [host, setHost] = useState(OFFICIAL1_URL);
    const [customIP, setCustomIP] = useState('localhost');
    const [customPort, setCustomPort] = useState('3000');
    const [savedNodes, setSavedNodes] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);

    const nodeOptions = getNodeSelectOptions(savedNodes);
    const showCustomForm = selectedNode === ADD_CUSTOM_KEY;

    useEffect(() => {
        const rawSelected = localStorage.getItem('selectedNode');
        const saved = loadSavedCustomNodes();
        setSavedNodes(saved);

        let next = normalizeSelectedNode(rawSelected);
        // If selection was mid-form "custom" with no save, fall back to official 1
        // unless we can recover a previously used custom host.
        if (next === ADD_CUSTOM_KEY) {
            const savedIP = localStorage.getItem('customIP');
            const savedPort = localStorage.getItem('customPort');
            if (savedIP && savedPort) {
                setCustomIP(savedIP);
                setCustomPort(savedPort);
            }
            // Keep form open only if user left it on Custom…
        } else if (/^https?:\/\//i.test(next)) {
            // Ensure URL is in saved list so the select can display it
            if (!saved.some((n) => n.url === next)) {
                const updated = [{ url: next, label: next.replace(/^https?:\/\//, '') }, ...saved];
                setSavedNodes(updated);
                try {
                    localStorage.setItem('savedCustomNodes', JSON.stringify(updated));
                } catch {
                    // ignore
                }
            }
            try {
                const u = new URL(next);
                setCustomIP(u.hostname);
                setCustomPort(u.port || (u.protocol === 'https:' ? '443' : '3000'));
            } catch {
                // ignore
            }
        }

        setSelectedNode(next);
        setHost(getExplorerHost(next) || OFFICIAL1_URL);
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        // Don't persist the open form key as the active node for other pages
        // until Save — still store it so refresh keeps the form open.
        localStorage.setItem('selectedNode', selectedNode);
        if (selectedNode !== ADD_CUSTOM_KEY) {
            localStorage.setItem('selectedHost', host);
        }
    }, [selectedNode, host, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem('customIP', customIP);
        localStorage.setItem('customPort', customPort);
    }, [customIP, customPort, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        if (selectedNode === ADD_CUSTOM_KEY) {
            // Wait for Save before changing host / fetching
            return;
        }
        const newHost = getExplorerHost(selectedNode);
        if (newHost) setHost(newHost);
    }, [selectedNode, isInitialized]);

    const handleSaveCustomNode = () => {
        try {
            const url = saveCustomNode(customIP, customPort);
            setSavedNodes(loadSavedCustomNodes());
            setSelectedNode(url);
            setHost(url);
            localStorage.setItem('selectedNode', url);
            localStorage.setItem('selectedHost', url);
        } catch (err) {
            setConnectionError(err?.message || 'Could not save custom node');
        }
    };

    const [client, setClient] = useState(null);
    const [subscribed, setSubscribed] = useState(false);
    const [chain, setChain] = useState({ blocks: [] });
    const [mode, setMode] = useState('latest');
    const [page, setPage] = useState(1);
    const [currentBlocks, setCurrentBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const perPage = 10;
    const useIndexer = shouldUseExplorerIndexer(selectedNode);

    useEffect(() => {
        if (!isInitialized) return;
        // Don't reconnect while the user is filling in a new custom node.
        if (selectedNode === ADD_CUSTOM_KEY) {
            setLoading(false);
            return;
        }

        // SPA back-navigation: restore last blocks for this host immediately
        // so we don't flash "Connecting…" / empty grid on every in-app return.
        const cached = host ? readExplorerChainCache(host, useIndexer) : null;
        const hasCache = Boolean(cached?.blocks?.length);
        if (hasCache) {
            const blocks = cached.blocks.map((b) => (b instanceof Block ? b : new Block(b)));
            setChain({ blocks });
            setCurrentBlocks(blocks);
            setSubscribed(true);
            setLoading(false);
            setConnectionError(null);
        } else {
            setSubscribed(false);
            setChain({ blocks: [] });
            setCurrentBlocks([]);
            setLoading(true);
            setConnectionError(null);
        }

        // Only reset search/pagination on hard node change or manual refresh,
        // not when hydrating from session cache.
        if (!hasCache || refreshToken > 0) {
            setPage(1);
            setIsSearching(false);
        }

        let hasConnected = hasCache;
        let cancelled = false;
        let interval;

        const fetchLatestFromIndexer = async (isInitial = false) => {
            if (cancelled) return;

            // Soft refresh — keep existing blocks visible when cache hit
            if (isInitial) {
                setRefreshing(true);
            }

            try {
                const blocks = await fetchWithRetry(() => fetchIndexerLatestBlocks(10));
                if (cancelled) return;

                setChain({ blocks });
                setSubscribed(true);
                setConnectionError(null);
                hasConnected = true;
                writeExplorerChainCache(host, true, blocks);
            } catch (e) {
                if (cancelled) return;
                console.error('Failed to fetch indexed blocks', e);
                if (!hasConnected) {
                    setConnectionError(
                        formatExplorerError(e, 'Indexed explorer unavailable. Sync may still be catching up.'),
                    );
                }
            } finally {
                if (isInitial && !cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        const fetchLatestFromNode = async (api, isInitial = false) => {
            if (cancelled) return;

            if (isInitial) {
                setRefreshing(true);
            }

            try {
                const headHeight = await fetchWithRetry(() => fetchChainHeadHeight(api));
                if (cancelled) return;

                const blocks = await fetchRecentBlocks(api, headHeight);
                if (cancelled) return;

                setChain({ blocks });
                setSubscribed(true);
                setConnectionError(null);
                hasConnected = true;
                writeExplorerChainCache(host, false, blocks);
            } catch (e) {
                if (cancelled) return;
                console.error('Failed to fetch head', e);
                if (!hasConnected) {
                    setConnectionError(
                        formatExplorerError(e, 'Failed to fetch data from node.'),
                    );
                }
            } finally {
                if (isInitial && !cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        (async () => {
            if (useIndexer) {
                setClient(null);
                await fetchLatestFromIndexer(true);
                interval = setInterval(() => fetchLatestFromIndexer(false), 10000);
                return;
            }

            if (!host) {
                setLoading(false);
                setConnectionError('No node host configured. Select a node or connect a custom one.');
                return;
            }

            try {
                const api = await createWarthogApi(host);
                if (cancelled) return;

                setClient(api);
                await fetchLatestFromNode(api, true);
                interval = setInterval(() => fetchLatestFromNode(api, false), 10000);
            } catch (e) {
                if (cancelled) return;
                console.error('Failed to create node client', e);
                setLoading(false);
                if (!hasConnected) {
                    setConnectionError(formatExplorerError(e, 'Failed to connect to node.'));
                }
            }
        })();

        return () => {
            cancelled = true;
            if (interval) clearInterval(interval);
        };
    }, [host, isInitialized, refreshToken, useIndexer, selectedNode]);

    useEffect(() => {
        if (!isInitialized) return;
        if (!useIndexer && !client) return;

        if (mode === 'latest') {
            setCurrentBlocks(chain.blocks || []);
            setIsSearching(false);
            return;
        }

        if (isSearching) return;

        setLoading(true);
        async function loadBlocks() {
            const tipHeight = chain.blocks[0]?.height || chain.blocks[chain.blocks.length - 1]?.height || 0;
            const startHeight = tipHeight - (page - 1) * perPage;
            if (startHeight < 1) {
                setPage(1);
                setLoading(false);
                return;
            }
            const endHeight = Math.max(startHeight - perPage + 1, 1);
            const promises = [];
            for (let h = startHeight; h >= endHeight; h--) {
                const existing = chain.blocks.find(b => b.height === h);
                if (existing) {
                    promises.push(Promise.resolve(existing));
                } else if (useIndexer) {
                    promises.push(fetchIndexerBlock(h));
                } else {
                    promises.push(fetchExplorerBlock(client, h));
                }
            }
            try {
                const results = await Promise.allSettled(promises);
                const blocks = results
                    .filter(result => result.status === 'fulfilled')
                    .map(result => result.value);
                setCurrentBlocks(blocks.map(b => b instanceof Block ? b : new Block(b)));
            } catch (error) {
                console.error('Error fetching blocks:', error);
                setCurrentBlocks([]);
                setConnectionError('Error fetching blocks. Connection may be unstable.');
            } finally {
                setLoading(false);
            }
        }
        loadBlocks();
    }, [mode, page, chain, client, isSearching, isInitialized, useIndexer]);

    const toggleMode = () => {
        setMode(mode === 'latest' ? 'all' : 'latest');
        setPage(1);
        setIsSearching(false);
    };

    /** Multi-height search from unified search box (e.g. 100-110). */
    const handleBlockHeights = async (heights) => {
        if (!heights?.length) return;
        setMode('all');
        setLoading(true);
        setIsSearching(true);
        setPage(1);
        try {
            const promises = heights.map(async (height) => {
                const existing = chain.blocks.find((b) => b.height === height);
                if (existing) return existing;
                if (useIndexer) return fetchIndexerBlock(height);
                if (client) return fetchExplorerBlock(client, height);
                throw new Error('No client');
            });
            const results = await Promise.allSettled(promises);
            const blocks = results
                .filter((result) => result.status === 'fulfilled')
                .map((result) => result.value)
                .map((b) => (b instanceof Block ? b : new Block(b)))
                .sort((a, b) => b.height - a.height);
            setCurrentBlocks(blocks);
            if (!blocks.length) {
                setConnectionError('No blocks found for that range.');
            } else {
                setConnectionError(null);
            }
        } catch (error) {
            console.error('Error searching blocks:', error);
            setCurrentBlocks([]);
            setConnectionError('Error searching blocks.');
        } finally {
            setLoading(false);
        }
    };

    const resetSearch = () => {
        setIsSearching(false);
        setMode('latest');
        setCurrentBlocks(chain.blocks || []);
    };

    const tipHeight = chain.blocks[0]?.height || chain.blocks[chain.blocks.length - 1]?.height || 0;
    const maxPage = Math.ceil(tipHeight / perPage) || 1;
    const hasNext = page < maxPage;

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'N/A';
        const now = Date.now() / 1000;
        const diff = now - timestamp;
        if (diff < 60) return `${Math.floor(diff)}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    if (!isInitialized) {
        return (
            <BunkerShell title="Explorer" showBrand={false}>
                <p className="bunker-muted">Loading settings...</p>
            </BunkerShell>
        );
    }

    const handleRefresh = () => {
        if (refreshing) return;
        setRefreshToken((token) => token + 1);
    };

    return (
        <BunkerShell
            title="Explorer"
            wide
            showBrand={false}
            actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
        >
            <div className="bunker-panel explorer-search-card">
                <div className="explorer-search-card__header">
                    <div className="explorer-node-select-wrap">
                        <label htmlFor="node-select" className="explorer-node-select-label">
                            Node
                        </label>
                        <select
                            id="node-select"
                            value={nodeOptions.some((o) => o.value === selectedNode) ? selectedNode : OFFICIAL1_KEY}
                            onChange={(e) => setSelectedNode(e.target.value)}
                            className="explorer-node-select"
                            title="Select node"
                        >
                            {nodeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <ExplorerUnifiedSearch onBlockHeights={handleBlockHeights} />

                {showCustomForm && (
                    <div className="bunker-form-row explorer-search-card__custom" style={{ marginTop: '0.75rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: '1 1 12rem' }}>
                            <label htmlFor="custom-ip" className="bunker-label">Host</label>
                            <input
                                id="custom-ip"
                                type="text"
                                value={customIP}
                                onChange={(e) => setCustomIP(e.target.value)}
                                placeholder="localhost or 192.168.1.1"
                                className="bunker-input"
                            />
                        </div>
                        <div style={{ flex: '0 1 7rem' }}>
                            <label htmlFor="custom-port" className="bunker-label">Port</label>
                            <input
                                id="custom-port"
                                type="text"
                                value={customPort}
                                onChange={(e) => setCustomPort(e.target.value)}
                                placeholder="3000"
                                className="bunker-input"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveCustomNode}
                            disabled={!customIP.trim() || !customPort.trim()}
                            className="bunker-btn"
                        >
                            Save node
                        </button>
                    </div>
                )}

                {isSearching && (
                    <div className="bunker-toolbar" style={{ marginTop: '0.5rem' }}>
                        <span className="bunker-muted">Showing search results</span>
                        <button type="button" onClick={resetSearch} className="bunker-btn bunker-btn--ghost">
                            Clear search
                        </button>
                    </div>
                )}
            </div>

            <ExplorerRecentViews />

            <div className="bunker-toolbar">
                <button onClick={toggleMode} className="bunker-btn">
                    {mode === 'latest' ? 'Browse all blocks' : 'Back to latest blocks'}
                </button>
            </div>

            <ExplorerStatsBar host={host} refreshToken={refreshToken} />

            {connectionError ? (
                <div className="bunker-error">{connectionError}</div>
            ) : !subscribed || !chain ? (
                <p className="bunker-muted">Connecting to node...</p>
            ) : (
                <>
                    <div className="bunker-toolbar">
                        <h2 className="bunker-subheading" style={{ margin: 0 }}>
                            {mode === 'latest' ? 'Latest Blocks' : `Blocks (Page ${page})`}
                        </h2>
                    </div>
                    {loading ? (
                        <p className="bunker-muted">Loading blocks...</p>
                    ) : (
                        <>
                            <div className="bunker-grid">
                                {currentBlocks.map((block) => (
                                    <article key={block.header.hash} className="bunker-card">
                                        <div className="bunker-card__header">
                                            <span className="bunker-badge">Block {format_height(block.height)}</span>
                                            <span className="bunker-muted">{formatTimeAgo(block.header.timestamp)}</span>
                                        </div>
                                        <div className="bunker-card__body">
                                            <dl className="bunker-dl">
                                                <div className="bunker-dl-row">
                                                    <dt>Hash</dt>
                                                    <dd>{abbreviate(block.header.hash)}</dd>
                                                </div>
                                                <div className="bunker-dl-row">
                                                    <dt>Miner</dt>
                                                    <dd>
                                                        <ExplorerAddress address={block.miner()} />
                                                    </dd>
                                                </div>
                                                <div className="bunker-dl-row">
                                                    <dt>Reward</dt>
                                                    <dd>{block.reward()}</dd>
                                                </div>
                                                <div className="bunker-dl-row">
                                                    <dt>#TXS</dt>
                                                    <dd>{block.transactionCount()}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                        <div className="bunker-card__footer">
                                            <ExplorerLink to={`/chain/block/${block.height}`} className="bunker-btn bunker-btn--primary" style={{ width: '100%' }}>
                                                Details →
                                            </ExplorerLink>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            {!loading && currentBlocks.length === 0 && (
                                <p className="bunker-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    No blocks found for this page. The chain may be short or historical data unavailable.
                                </p>
                            )}
                        </>
                    )}
                    {mode === 'all' && !loading && !isSearching && (
                        <div className="bunker-toolbar" style={{ marginTop: '1.5rem' }}>
                            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="bunker-btn bunker-btn--ghost">
                                Previous
                            </button>
                            <span className="bunker-muted">Page {page} of {maxPage}</span>
                            <button disabled={!hasNext} onClick={() => setPage(page + 1)} className="bunker-btn bunker-btn--ghost">
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </BunkerShell>
    );
}

export default Explorer;

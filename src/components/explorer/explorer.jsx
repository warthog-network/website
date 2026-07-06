import { useState, useEffect } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';
import { Block } from './assets/api_ws.js';
import BunkerShell from '../BunkerShell.jsx';
import ExplorerAddress from './ExplorerAddress.jsx';
import ExplorerRefreshButton from './ExplorerRefreshButton.jsx';
import { unwrapNodeResponse } from './explorerApi.js';
import {
    EXPLORER_NODE_OPTIONS,
    getExplorerHost,
    normalizeSelectedNode,
} from '../../lib/explorerNodes.js';

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
    const [selectedNode, setSelectedNode] = useState('losthymns');
    const [host, setHost] = useState('https://warthognode.duckdns.org');
    const [customIP, setCustomIP] = useState('localhost');
    const [customPort, setCustomPort] = useState('3000');
    const [customConnected, setCustomConnected] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false); // New: Flag to delay loading until localStorage is populated

    const nodeOptions = EXPLORER_NODE_OPTIONS;

    useEffect(() => {
        const savedNode = normalizeSelectedNode(localStorage.getItem('selectedNode'));
        const savedIP = localStorage.getItem('customIP');
        const savedPort = localStorage.getItem('customPort');

        setSelectedNode(savedNode);

        if (savedNode === 'custom' && savedIP && savedPort) {
            setCustomIP(savedIP);
            setCustomPort(savedPort);
            setHost(getExplorerHost('losthymns'));
        } else {
            setHost(getExplorerHost(savedNode));
        }

        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (!isInitialized) return; // Don't save until initialized

        // Save selectedNode and host to localStorage, replacing existing
        localStorage.setItem('selectedNode', selectedNode);
        localStorage.setItem('selectedHost', host);
    }, [selectedNode, host, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return; // Don't save until initialized

        // Save customIP and customPort
        localStorage.setItem('customIP', customIP);
        localStorage.setItem('customPort', customPort);
    }, [customIP, customPort, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return; // Don't update host until initialized

        if (selectedNode === 'custom') {
            if (customConnected) {
                let fullIP = customIP;
                if (!fullIP.includes('://')) {
                    fullIP = `http://${fullIP}`;
                }
                const newHost = `${fullIP}:${customPort}`;
                setHost(newHost);
            }
            // else stay on previous host
        } else {
            const newHost = getExplorerHost(selectedNode);
            if (newHost) {
                setHost(newHost);
            }
            setCustomConnected(false);
        }
    }, [selectedNode, customIP, customPort, customConnected, isInitialized]);

    const [client, setClient] = useState(null);
    const [subscribed, setSubscribed] = useState(false);
    const [chain, setChain] = useState({ blocks: [] });
    const [mode, setMode] = useState('latest');
    const [page, setPage] = useState(1);
    const [currentBlocks, setCurrentBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [txSearchInput, setTxSearchInput] = useState('');
    const [addressSearchInput, setAddressSearchInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const perPage = 10;

    useEffect(() => {
        if (!isInitialized) return; // Don't fetch until localStorage is populated

        setSubscribed(false);
        setChain({ blocks: [] });
        setCurrentBlocks([]);
        setPage(1);
        setIsSearching(false);
        setSearchInput('');
        setLoading(true);
        setConnectionError(null);

        const cl = new APIClient(host, false);
        cl.setters = {
            setConnections: () => {},
            setLog: () => {},
            setChain,
            setSubscribed
        };
        setClient(cl);

        let hasConnected = false;
        let cancelled = false;

        const fetchLatest = async (isInitial = false) => {
            if (cancelled) return;

            if (isInitial) {
                setRefreshing(true);
            }

            try {
                const headResponse = await fetchWithRetry(() => cl.get('/chain/head'));
                if (cancelled) return;

                const headData = unwrapNodeResponse(headResponse);
                const headHeight = headData?.height;
                if (!headHeight) {
                    throw new Error('Unexpected response format from node head endpoint');
                }
                const blocks = [];
                for (let h = headHeight; h > Math.max(1, headHeight - 10); h--) {
                    try {
                        const block = await cl.getBlock(h);
                        blocks.push(block);
                    } catch (e) {
                        console.error(`Failed to fetch block ${h}`, e);
                    }
                }
                if (cancelled) return;

                setChain({ blocks });
                setSubscribed(true);
                setConnectionError(null);
                hasConnected = true;
            } catch (e) {
                if (cancelled) return;
                console.error('Failed to fetch head', e);
                if (!hasConnected) {
                    setConnectionError('Failed to fetch data from node.');
                }
            } finally {
                if (isInitial && !cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        fetchLatest(true);

        // Poll for updates every 10 seconds
        const interval = setInterval(() => fetchLatest(false), 10000);

        return () => {
            cancelled = true;
            cl.closeConnection();
            clearInterval(interval);
        };
    }, [host, isInitialized, refreshToken]);

    useEffect(() => {
        if (!client || !isInitialized) return;

        if (mode === 'latest') {
            setCurrentBlocks(chain.blocks || []);
            setIsSearching(false);
            setLoading(false);
            return;
        }

        if (isSearching) return;

        setLoading(true);
        async function loadBlocks() {
            const tipHeight = chain.blocks[chain.blocks.length - 1]?.height || 0;
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
                } else {
                    promises.push(client.getBlock(h));
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
    }, [mode, page, chain, client, isSearching, isInitialized]);

    const toggleMode = () => {
        setMode(mode === 'latest' ? 'all' : 'latest');
        setPage(1);
        setIsSearching(false);
        setSearchInput('');
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;
        setLoading(true);
        setIsSearching(true);
        const items = parseSearchInput(searchInput);
        const promises = items.map(async (item) => {
            if (item.type === 'height') {
                const existing = chain.blocks.find(b => b.height === item.value);
                return existing || await client.getBlock(item.value);
            }
        });
        try {
            const results = await Promise.allSettled(promises);
            const blocks = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);
            setCurrentBlocks(blocks.map(b => b instanceof Block ? b : new Block(b)).sort((a, b) => b.height - a.height));
        } catch (error) {
            console.error('Error searching:', error);
            setCurrentBlocks([]);
            setConnectionError('Error searching. Connection may be unstable.');
        } finally {
            setLoading(false);
        }
    };

    const handleTxSearch = (e) => {
        e.preventDefault();
        if (!txSearchInput.trim()) return;
        window.location.href = `/transaction/lookup/${encodeURIComponent(txSearchInput)}`;
        setTxSearchInput('');
    };

    const handleAddressSearch = (e) => {
        e.preventDefault();
        if (!addressSearchInput.trim()) return;
        window.location.href = `/address/${encodeURIComponent(addressSearchInput)}`;
        setAddressSearchInput('');
    };

    const parseSearchInput = (input) => {
        const items = [];
        const parts = input.split(/\s+/).map(p => p.trim()).filter(p => p);
        parts.forEach(part => {
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-');
                const start = Number(startStr.replace(/,/g, ''));
                const end = Number(endStr.replace(/,/g, ''));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let h = start; h <= end; h++) {
                        items.push({ type: 'height', value: h });
                    }
                }
            } else {
                const h = Number(part.replace(/,/g, ''));
                if (!isNaN(h)) {
                    items.push({ type: 'height', value: h });
                }
            }
        });
        return items;
    };

    const resetSearch = () => {
        setSearchInput('');
        setIsSearching(false);
    };

    const tipHeight = chain.blocks[chain.blocks.length - 1]?.height || 0;
    const maxPage = Math.ceil(tipHeight / perPage);
    const hasNext = page < maxPage;

    const isLocal = host.includes('localhost');

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
            <BunkerShell title="Explorer">
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
            actions={<ExplorerRefreshButton onClick={handleRefresh} loading={refreshing} />}
        >
            <div className="bunker-panel">
                <label htmlFor="node-select" className="bunker-label">Select Node:</label>
                <select
                    id="node-select"
                    value={selectedNode}
                    onChange={(e) => setSelectedNode(e.target.value)}
                    className="bunker-select"
                >
                    {nodeOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                {selectedNode === 'custom' && (
                    <>
                        <div className="bunker-form-row" style={{ marginTop: '0.75rem' }}>
                            <div style={{ flex: '1 1 12rem' }}>
                                <label htmlFor="custom-ip" className="bunker-label">IP Address:</label>
                                <input
                                    id="custom-ip"
                                    type="text"
                                    value={customIP}
                                    onChange={(e) => setCustomIP(e.target.value)}
                                    placeholder="e.g., localhost, 192.168.1.1, or http://example.com"
                                    className="bunker-input"
                                />
                            </div>
                            <div style={{ flex: '1 1 8rem' }}>
                                <label htmlFor="custom-port" className="bunker-label">Port:</label>
                                <input
                                    id="custom-port"
                                    type="text"
                                    value={customPort}
                                    onChange={(e) => setCustomPort(e.target.value)}
                                    placeholder="e.g., 3000"
                                    className="bunker-input"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => setCustomConnected(true)}
                            disabled={!customIP.trim() || !customPort.trim()}
                            className="bunker-btn"
                            style={{ marginTop: '0.75rem' }}
                        >
                            Connect to Custom Node
                        </button>
                    </>
                )}
            </div>

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
                        <button onClick={toggleMode} className="bunker-btn">
                            {mode === 'latest' ? 'Switch to Deep Search (All Blocks)' : 'Switch to Latest Blocks'}
                        </button>
                    </div>
                    {mode === 'all' && (
                        <>
                            <form onSubmit={handleSearch} className="bunker-form-row">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search blocks: 123 100-200"
                                    className="bunker-input"
                                />
                                <button type="submit" className="bunker-btn">Search Blocks</button>
                                {isSearching && (
                                    <button type="button" onClick={resetSearch} className="bunker-btn bunker-btn--ghost">
                                        Clear Search
                                    </button>
                                )}
                            </form>
                            <form onSubmit={handleTxSearch} className="bunker-form-row">
                                <input
                                    type="text"
                                    value={txSearchInput}
                                    onChange={(e) => setTxSearchInput(e.target.value)}
                                    placeholder="Enter TX Hash: e.g., 0x123..."
                                    className="bunker-input"
                                />
                                <button type="submit" className="bunker-btn">Lookup TX</button>
                            </form>
                            <form onSubmit={handleAddressSearch} className="bunker-form-row">
                                <input
                                    type="text"
                                    value={addressSearchInput}
                                    onChange={(e) => setAddressSearchInput(e.target.value)}
                                    placeholder="Enter Address: e.g., bc1q..."
                                    className="bunker-input"
                                />
                                <button type="submit" className="bunker-btn">Lookup Address</button>
                            </form>
                        </>
                    )}
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
                                            <a href={`/chain/block/${block.height}`} className="bunker-btn" style={{ width: '100%' }}>
                                                Details →
                                            </a>
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

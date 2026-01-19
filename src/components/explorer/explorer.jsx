import { useState, useEffect } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';
import { Block } from './assets/api_ws.js';

function Explorer() {
    const [selectedNode, setSelectedNode] = useState('polaire');
    const [host, setHost] = useState('http://217.182.64.43:3001');
    const [customIP, setCustomIP] = useState('localhost');
    const [customPort, setCustomPort] = useState('3000');
    const [customConnected, setCustomConnected] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false); // New: Flag to delay loading until localStorage is populated

    const nodeOptions = [
        { value: 'polaire', label: 'Polaire' },
        { value: 'losthymns', label: 'Losthymns' },
        { value: 'local', label: 'Local Node' },
        { value: 'custom', label: 'Custom Node' },
    ];

    const getHost = (node) => {
        if (node === 'losthymns') return 'https://warthognode.duckdns.org';
        if (node === 'polaire') return 'http://217.182.64.43:3001';
        if (node === 'local') return 'http://localhost:3000';
        return 'http://localhost:3000';
    };

    useEffect(() => {
        // Load saved settings from localStorage
        const savedNode = localStorage.getItem('selectedNode');
        const savedHost = localStorage.getItem('selectedHost'); // New: Load saved host directly
        const savedIP = localStorage.getItem('customIP');
        const savedPort = localStorage.getItem('customPort');

        if (savedNode && savedHost) {
            setSelectedNode(savedNode);
            setHost(savedHost);
            if (savedNode === 'custom' && savedIP && savedPort) {
                setCustomIP(savedIP);
                setCustomPort(savedPort);
            }
        } else {
            // If no saved values, use defaults but save them
            localStorage.setItem('selectedNode', selectedNode);
            localStorage.setItem('selectedHost', host);
        }

        setIsInitialized(true); // Mark as initialized after loading
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
            const newHost = getHost(selectedNode);
            setHost(newHost);
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

        (async () => {
            try {
                const headResponse = await cl.get('/chain/head');
                const headHeight = headResponse.data.height;
                const blocks = [];
                for (let h = headHeight; h > Math.max(1, headHeight - 10); h--) {
                    try {
                        const block = await cl.getBlock(h);
                        blocks.push(block);
                    } catch (e) {
                        console.error(`Failed to fetch block ${h}`, e);
                    }
                }
                setChain({ blocks });
                setSubscribed(true);
            } catch (e) {
                console.error('Failed to fetch head', e);
                setConnectionError('Failed to fetch data from node.');
            } finally {
                setLoading(false);
            }
        })();

        return () => {
            cl.closeConnection();
        };
    }, [host, isInitialized]);

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

    if (!isInitialized) {
        return <div className="container mx-auto px-4 py-8">Loading settings...</div>; // Delay rendering until initialized
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Explorer</h1>

            {/* Node Switcher Dropdown */}
            <div className="mb-4">
                <label htmlFor="node-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Node:</label>
                <select
                    id="node-select"
                    value={selectedNode}
                    onChange={(e) => setSelectedNode(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    {nodeOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                {selectedNode === 'custom' && (
                    <>
                        <div className="mt-2 flex space-x-2">
                            <div className="flex-1">
                                <label htmlFor="custom-ip" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IP Address:</label>
                                <input
                                    id="custom-ip"
                                    type="text"
                                    value={customIP}
                                    onChange={(e) => setCustomIP(e.target.value)}
                                    placeholder="e.g., localhost, 192.168.1.1, or http://example.com"
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="custom-port" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Port:</label>
                                <input
                                    id="custom-port"
                                    type="text"
                                    value={customPort}
                                    onChange={(e) => setCustomPort(e.target.value)}
                                    placeholder="e.g., 3000"
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="mt-2">
                            <button
                                onClick={() => setCustomConnected(true)}
                                disabled={!customIP.trim() || !customPort.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Connect to Custom Node
                            </button>
                        </div>
                    </>
                )}
            </div>

            {connectionError ? (
                <div className="text-red-600">{connectionError}</div>
            ) : !subscribed || !chain ? (
                <div className="text-gray-600">Connecting to node...</div>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl lg:text-4xl">
                            {mode === 'latest' ? 'Latest Blocks' : `Blocks (Page ${page})`}
                        </h2>
                        <button
                            onClick={toggleMode}
                            className="px-4 py-2 text-sm font-medium text-white bg-zinc-700 rounded-lg hover:bg-zinc-800 focus:ring-4 focus:outline-none focus:ring-zinc-300 transition-colors duration-200 dark:bg-zinc-600 dark:hover:bg-zinc-700 dark:focus:ring-zinc-800"
                        >
                            {mode === 'latest' ? 'Switch to Deep Search (All Blocks)' : 'Switch to Latest Blocks'}
                        </button>
                    </div>
                    {mode === 'all' && (
                        <>
                            <form onSubmit={handleSearch} className="mb-6">
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder="Search blocks: 123 100-200"
                                        className="flex-grow px-4 py-2 text-sm text-gray-900 border border-gray-300 rounded-l-lg focus:ring-zinc-500 focus:border-zinc-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:border-zinc-500"
                                    />
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-zinc-700 rounded-r-lg hover:bg-zinc-800 focus:ring-4 focus:outline-none focus:ring-zinc-300 transition-colors duration-200 dark:bg-zinc-600 dark:hover:bg-zinc-700 dark:focus:ring-zinc-800"
                                    >
                                        Search Blocks
                                    </button>
                                    {isSearching && (
                                        <button
                                            type="button"
                                            onClick={resetSearch}
                                            className="ml-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                                        >
                                            Clear Search
                                        </button>
                                    )}
                                </div>
                            </form>
                            <form onSubmit={handleTxSearch} className="mb-6">
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        value={txSearchInput}
                                        onChange={(e) => setTxSearchInput(e.target.value)}
                                        placeholder="Enter TX Hash: e.g., 0x123..."
                                        className="flex-grow px-4 py-2 text-sm text-gray-900 border border-gray-300 rounded-l-lg focus:ring-zinc-500 focus:border-zinc-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:border-zinc-500"
                                    />
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-zinc-700 rounded-r-lg hover:bg-zinc-800 focus:ring-4 focus:outline-none focus:ring-zinc-300 transition-colors duration-200 dark:bg-zinc-600 dark:hover:bg-zinc-700 dark:focus:ring-zinc-800"
                                    >
                                        Lookup TX
                                    </button>
                                </div>
                            </form>
                            <form onSubmit={handleAddressSearch} className="mb-6">
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        value={addressSearchInput}
                                        onChange={(e) => setAddressSearchInput(e.target.value)}
                                        placeholder="Enter Address: e.g., bc1q..."
                                        className="flex-grow px-4 py-2 text-sm text-gray-900 border border-gray-300 rounded-l-lg focus:ring-zinc-500 focus:border-zinc-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:border-zinc-500"
                                    />
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-zinc-700 rounded-r-lg hover:bg-zinc-800 focus:ring-4 focus:outline-none focus:ring-zinc-300 transition-colors duration-200 dark:bg-zinc-600 dark:hover:bg-zinc-700 dark:focus:ring-zinc-800"
                                    >
                                        Lookup Address
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                    {loading ? (
                        <p className="text-gray-600">Loading blocks...</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {currentBlocks.map((block) => (
                                    <div
                                        key={block.header.hash}
                                        className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                            <span className="px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-full">Block {format_height(block.height)}</span>
                                            <span className="text-sm text-gray-500">5s ago</span>
                                        </div>
                                        <div className="px-4 py-3">
                                            <dl className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <dt className="font-medium text-gray-500 uppercase">Hash</dt>
                                                    <dd className="text-gray-800 dark:text-neutral-200 lowercase">{abbreviate(block.header.hash)}</dd>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <dt className="font-medium text-gray-500 uppercase">Miner</dt>
                                                    <dd className="text-gray-800 dark:text-neutral-200">{abbreviate(block.miner())}</dd>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <dt className="font-medium text-gray-500 uppercase">Reward</dt>
                                                    <dd className="text-gray-800 dark:text-neutral-200">{block.reward()}</dd>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <dt className="font-medium text-gray-500 uppercase">#TXS</dt>
                                                    <dd className="text-gray-800 dark:text-neutral-200">{block.transactionCount()}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                                            <a
                                                href={`/chain/block/${block.height}`}
                                                className="inline-flex items-center w-full justify-center px-4 py-2 text-sm font-medium text-white bg-zinc-700 rounded-lg hover:bg-zinc-800 focus:ring-4 focus:outline-none focus:ring-zinc-300 transition-colors duration-200 dark:bg-zinc-600 dark:hover:bg-zinc-700 dark:focus:ring-zinc-800"
                                            >
                                                Details
                                                <svg
                                                    className="rtl:rotate-180 w-3.5 h-3.5 ml-2"
                                                    aria-hidden="true"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 14 10"
                                                >
                                                    <path
                                                        stroke="currentColor"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth="2"
                                                        d="M1 5h12m0 0L9 1m4 4L9 9"
                                                    />
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {!loading && currentBlocks.length === 0 && (
                                <p className="text-gray-600 col-span-full text-center py-4">No blocks found for this page. The chain may be short or historical data unavailable.</p>
                            )}
                        </>
                    )}
                    {mode === 'all' && !loading && !isSearching && (
                        <div className="flex justify-between items-center mt-6">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">Page {page} of {maxPage}</span>
                            <button
                                disabled={!hasNext}
                                onClick={() => setPage(page + 1)}
                                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default Explorer;

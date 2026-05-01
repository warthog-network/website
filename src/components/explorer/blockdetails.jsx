import { useState, useEffect } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';
import { Block } from './assets/api_ws.js';

function TransactionItem({ tx, index }) {
  const isRewardTx = !tx.fromAddress;
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
    <li key={tx.txHash || `tx-${index}`} className="bg-gray-50 p-3 rounded-lg dark:bg-gray-700">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-800 dark:text-neutral-200 break-all">
          {isRewardTx
            ? `Miner Reward - ${abbreviate(safeStr(tx.txHash))}`
            : abbreviate(safeStr(tx.txHash))}
        </span>
        {tx.txHash && (
          <a
            href={`/transaction/lookup/${tx.txHash}`}
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
    </li>
  );
}

function BlockDetails({ height }) {
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
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
    setLoading(true);
    client.getBlock(height)
      .then(fetchedBlock => {
        setBlock(fetchedBlock instanceof Block ? fetchedBlock : new Block(fetchedBlock));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [height]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Loading Block...</h1>
      </div>
    );
  }

  if (!block || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Block Not Found</h1>
        <p className="text-gray-600">The requested block could not be found.</p>
        <a
          href="/explorer"
          className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 transition-colors duration-200 dark:bg-gray-800 dark:text-zinc-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
        >
          ← Back to Explorer
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Block Details</h1>
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white-900 md:text-3xl lg:text-4xl">
        Block {format_height(block.height)}
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg dark:bg-gray-800 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium text-gray-500 uppercase">Hash</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200 lowercase break-all cursor-pointer hover:text-blue-600" onClick={() => handleCopy(block.header?.hash, 'hash')}>
                {block.header?.hash ?? 'N/A'}
                {copiedField === 'hash' && <span className="ml-2 text-green-600">Copied!</span>}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 uppercase">Height</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{format_height(block.height)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 uppercase">Miner</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200 break-all cursor-pointer hover:text-blue-600" onClick={() => handleCopy(block.miner(), 'miner')}>
                {block.miner()}
                {copiedField === 'miner' && <span className="ml-2 text-green-600">Copied!</span>}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 uppercase">Reward</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{block.reward()}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 uppercase">Transaction Count</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{block.transactionCount()}</dd>
            </div>
            {block.header?.timestamp && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Timestamp</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">{new Date(block.header.timestamp * 1000).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="px-6 py-4">
          <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Transactions</h3>
          <div className="flex justify-end mb-2">
            <a href={`/block/${block.height}/hex`} 
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              Show binary
            </a>
          </div>
          {block.transactions?.length > 0 ? (
            <ul className="space-y-3">
              {block.transactions.map((tx, index) => (
                <TransactionItem key={tx.txHash || `tx-${index}`} tx={tx} index={index} />
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-neutral-400">No transactions in this block.</p>
          )}
        </div>
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

export default BlockDetails;

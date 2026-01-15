import { useState, useEffect } from 'react';
import { format_height, abbreviate } from './assets/util.js';
import APIClient from './assets/api_ws.js';

function TransactionDetails({ txid }) {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = new APIClient();
    if (txid) {
      setLoading(true);
      client.get(`/transaction/lookup/${txid}`)
        .then(response => {
          if (response.code !== 0 || !response.data || !response.data.transaction) {
            throw new Error('Transaction not found');
          }
          setTransaction(response.data.transaction);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [txid]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Loading Transaction...</h1>
      </div>
    );
  }

  if (!transaction || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Transaction Not Found</h1>
        <p className="text-gray-600">The requested transaction could not be found.</p>
        <a
          href="/explorer"
          className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 transition-colors duration-200 dark:bg-gray-800 dark:text-zinc-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
        >
          ← Back to Explorer
        </a>
      </div>
    );
  }

  const isRewardTx = !transaction.fromAddress || transaction.type === 'Reward';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Transaction Details</h1>
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl lg:text-4xl">
        Transaction {abbreviate(txid)}
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg dark:bg-gray-800 dark:border-gray-700">
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium text-gray-500 uppercase">Hash</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200 lowercase break-all">{transaction.txHash ?? 'N/A'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 uppercase">Type</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{isRewardTx ? 'Miner Reward' : transaction.type ?? 'Transfer'}</dd>
            </div>
            {transaction.fromAddress && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">From</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200 break-all">{abbreviate(transaction.fromAddress)}</dd>
              </div>
            )}
            {transaction.toAddress && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">To</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200 break-all">{abbreviate(transaction.toAddress)}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500 uppercase">Amount</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{transaction.amount ?? 'N/A'} (E8: {transaction.amountE8 ?? 'N/A'})</dd>
            </div>
            {transaction.fee && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Fee</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">{transaction.fee ?? 'N/A'} (E8: {transaction.feeE8 ?? 'N/A'})</dd>
              </div>
            )}
            {transaction.blockHeight && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Block Height</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">
                  <a
                    href={`/chain/block/${transaction.blockHeight}`}
                    className="text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {format_height(transaction.blockHeight)}
                  </a>
                </dd>
              </div>
            )}
            {transaction.pinHeight && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Pin Height</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">{format_height(transaction.pinHeight)}</dd>
              </div>
            )}
            {transaction.nonceId !== undefined && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Nonce ID</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">{transaction.nonceId}</dd>
              </div>
            )}
            {transaction.timestamp && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Timestamp</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">{new Date(transaction.timestamp * 1000).toLocaleString()}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500 uppercase">Status</dt>
              <dd className="mt-1 text-gray-800 dark:text-neutral-200">{transaction.confirmations > 0 ? 'Confirmed' : 'Pending'}</dd>
            </div>
            {transaction.confirmations !== undefined && (
              <div>
                <dt className="font-medium text-gray-500 uppercase">Confirmations</dt>
                <dd className="mt-1 text-gray-800 dark:text-neutral-200">{transaction.confirmations}</dd>
              </div>
            )}
          </dl>
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

export default TransactionDetails;
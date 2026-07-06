import React from 'react';

const abbreviateAddress = (address) => {
  if (!address) return '';
  if (address.length <= 11) return address;
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
};

export default function WalletOverviewCard({
  balance,
  usdBalance,
  address,
  walletName = null,
  nodeList = [],
  selectedNode = '',
  nodesLoading = false,
  nodesError = null,
  onNodeChange,
  validateInput = '',
  onValidateInputChange,
  onValidate,
  validateResult = null,
  onRefresh,
  onCopyAddress,
  onDownload,
  onExportQr,
  onClear,
  onSend,
}) {
  const balanceLoading = balance === null;
  const usdDisplay =
    usdBalance && usdBalance !== 'N/A' ? usdBalance : '—';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 min-w-0">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#FDB913]/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-orange-500/5 blur-2xl pointer-events-none" />

      <div className="relative p-5 min-w-0">
        <div className="mb-4 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-medium">
              Total Balance
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="refresh-balance-btn flex flex-shrink-0 items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-400 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-600/50 rounded-lg transition-colors !m-0"
              title="Refresh balance"
            >
              <span className="text-[#FDB913] text-[11px] leading-none">⟳</span>
              Refresh
            </button>
          </div>

          {walletName ? (
            <div className="text-[11px] text-zinc-500 mb-2">
              Saved as <span className="font-mono text-[#FDB913]">{walletName}</span>
            </div>
          ) : null}

          <div className="flex items-baseline gap-2 min-w-0 flex-wrap text-white">
            {balanceLoading ? (
              <div className="h-9 w-36 bg-zinc-800/80 rounded-lg animate-pulse" />
            ) : (
              <span className="text-3xl font-semibold tracking-tight break-all tabular-nums">
                {balance}
              </span>
            )}
            <span className="text-sm font-medium text-[#FDB913]">WART</span>
          </div>

          <div className="text-sm text-zinc-400 mt-1 tabular-nums">
            {balanceLoading ? (
              <span className="inline-block h-4 w-20 bg-zinc-800/60 rounded animate-pulse" />
            ) : (
              <>≈ {usdDisplay} USD</>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 font-medium flex-shrink-0">
              Node
            </span>
            {nodesLoading ? (
              <span className="text-[11px] text-zinc-500">Loading…</span>
            ) : nodesError ? (
              <span className="text-[11px] text-red-400">{nodesError}</span>
            ) : (
              <select
                value={selectedNode}
                onChange={(e) => onNodeChange?.(e.target.value)}
                className="wallet-node-select"
                title="Select node"
              >
                {nodeList.map((node) => (
                  <option key={node.url} value={node.url}>
                    {node.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800/80 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 font-medium mb-2">
              Validate Address
            </div>
            <div className="flex flex-wrap gap-2 items-center min-w-0">
              <input
                type="text"
                value={validateInput}
                onChange={(e) => onValidateInputChange?.(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onValidate?.()}
                placeholder="48-character address"
                className="wallet-inline-input"
              />
              <button
                type="button"
                onClick={onValidate}
                className="compact-btn hover:!text-[#E79300] !m-0 !flex-shrink-0"
              >
                Validate
              </button>
            </div>
            {validateResult && (
              <div
                className={`mt-2 text-[11px] font-mono px-2 py-1.5 rounded-lg border ${
                  validateResult.valid
                    ? 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30'
                    : 'text-red-400 border-red-800/50 bg-red-950/30'
                }`}
              >
                {validateResult.valid ? 'Valid Warthog address' : (validateInput ? 'Invalid address' : 'Enter an address to validate')}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {onSend ? (
            <button
              type="button"
              onClick={onSend}
              className="flex-shrink-0 py-3 px-5 wallet-action-btn !m-0 font-semibold whitespace-nowrap"
            >
              Send WART
            </button>
          ) : null}
          {onExportQr ? (
            <button
              type="button"
              onClick={onExportQr}
              className="icon-square-btn"
              title="Export wallet to mobile app (QR)"
              aria-label="Export wallet to mobile app"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
          ) : null}
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1"
            >
              Download File
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1"
            >
              Clear Wallet
            </button>
          ) : null}
          <div className="min-w-0 flex-1 flex justify-center overflow-hidden">
            <span
              className="max-w-full truncate whitespace-nowrap font-mono text-[11px] text-zinc-400 hover:text-[#E79300] cursor-pointer transition-colors text-center"
              title={`${address} — click to copy`}
              onClick={onCopyAddress}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCopyAddress?.();
                }
              }}
            >
              <span className="sm:hidden">{abbreviateAddress(address)}</span>
              <span className="hidden sm:inline">{address}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
import React from 'react';

const abbreviateAddress = (address) => {
  if (!address) return '';
  if (address.length <= 11) return address;
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
};

/**
 * Plain balance card: balance, Send / Receive, Tools, compact security badge.
 * Node, passkey/2FA, download, contacts, etc. live under Tools.
 */
export default function WalletOverviewCard({
  balance,
  /** Pre-formatted balance string (number display prefs). Falls back to raw balance. */
  balanceDisplay = null,
  /** Tailwind text class for balance (e.g. text-[#FDB913]). */
  balanceColorClass = 'text-white',
  usdBalance,
  address,
  walletName = null,
  onRefresh,
  refreshing = false,
  onCopyAddress,
  onSend,
  onReceive,
  onTools,
  toolsOpen = false,
  /** Compact security status: '2fa' | 'passkey' | 'password' | 'session' | null */
  authBadge = null,
  authBadgeLabel = null,
}) {
  const balanceMissing = balance === null;
  const usdDisplay =
    usdBalance && usdBalance !== 'N/A' ? usdBalance : '—';
  const shownBalance = balanceDisplay != null ? balanceDisplay : balance;

  const badgeStyles = {
    '2fa': {
      border: 'rgba(56, 189, 248, 0.45)',
      bg: 'rgba(12, 74, 110, 0.25)',
      text: 'text-sky-300',
      label: authBadgeLabel || '2FA',
    },
    passkey: {
      border: 'rgba(52, 211, 153, 0.4)',
      bg: 'rgba(6, 78, 59, 0.22)',
      text: 'text-emerald-400',
      label: authBadgeLabel || 'Passkey',
    },
    password: {
      border: 'rgba(161, 161, 170, 0.4)',
      bg: 'rgba(39, 39, 42, 0.5)',
      text: 'text-zinc-300',
      label: authBadgeLabel || 'Password',
    },
    session: {
      border: 'rgba(245, 158, 11, 0.4)',
      bg: 'rgba(120, 53, 15, 0.18)',
      text: 'text-amber-400/90',
      label: authBadgeLabel || 'Session only',
    },
  };
  const badge = authBadge ? badgeStyles[authBadge] || badgeStyles.session : null;

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
            <div className="flex items-center gap-2 flex-shrink-0">
              {badge ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.text}`}
                  style={{ borderColor: badge.border, background: badge.bg }}
                  title="Security status — open Tools to manage passkey / 2FA"
                >
                  {badge.label}
                </span>
              ) : null}
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="refresh-balance-btn flex flex-shrink-0 items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-400 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-600/50 rounded-lg transition-colors !m-0 disabled:opacity-60 disabled:cursor-wait"
                title={refreshing ? 'Refreshing…' : 'Refresh balance & history'}
                aria-busy={refreshing}
              >
                <span
                  className={`text-[#FDB913] text-[11px] leading-none inline-block${refreshing ? ' animate-spin' : ''}`}
                  aria-hidden="true"
                >
                  ⟳
                </span>
                {refreshing ? '…' : 'Refresh'}
              </button>
            </div>
          </div>

          {walletName ? (
            <div className="text-[11px] text-zinc-500 mb-2">
              <span className="font-mono text-[#FDB913]">{walletName}</span>
            </div>
          ) : null}

          <div
            className={`flex items-baseline gap-2 min-w-0 flex-wrap${refreshing ? ' opacity-60' : ''}`}
          >
            {balanceMissing ? (
              <div className="h-9 w-36 bg-zinc-800/80 rounded-lg animate-pulse" />
            ) : (
              <span
                className={`text-3xl font-semibold tracking-tight break-all tabular-nums ${balanceColorClass}`}
              >
                {shownBalance}
              </span>
            )}
            <span className="text-sm font-medium text-zinc-400">WART</span>
          </div>

          <div
            className={`text-sm text-zinc-400 mt-1 tabular-nums${refreshing ? ' opacity-60' : ''}`}
          >
            {balanceMissing ? (
              <span className="inline-block h-4 w-20 bg-zinc-800/60 rounded animate-pulse" />
            ) : (
              <>≈ {usdDisplay} USD</>
            )}
          </div>

          <div className="mt-3 min-w-0">
            <span
              className="inline-block max-w-full truncate whitespace-nowrap font-mono text-[11px] text-zinc-400 hover:text-[#E79300] cursor-pointer transition-colors"
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

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {onSend ? (
            <button
              type="button"
              onClick={onSend}
              className="flex-shrink-0 py-3 px-5 wallet-action-btn !m-0 font-semibold whitespace-nowrap"
            >
              Send WART
            </button>
          ) : null}
          {onReceive ? (
            <button
              type="button"
              onClick={onReceive}
              className="flex-shrink-0 py-3 px-5 compact-btn hover:!text-[#E79300] !m-0 font-semibold whitespace-nowrap border border-zinc-600/60 rounded-xl bg-zinc-800/60"
            >
              Receive WART
            </button>
          ) : null}
          {onTools ? (
            <button
              type="button"
              onClick={onTools}
              className={`flex-shrink-0 py-3 px-4 compact-btn hover:!text-[#E79300] !m-0 font-semibold whitespace-nowrap border rounded-xl ${
                toolsOpen
                  ? 'border-[#E79300]/60 bg-[#E79300]/15 text-[#FDB913]'
                  : 'border-zinc-600/60 bg-zinc-800/40'
              }`}
              title="Settings — passkey, backup, numbers, node"
              aria-pressed={toolsOpen}
            >
              Settings
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

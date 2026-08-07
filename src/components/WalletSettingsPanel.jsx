/**
 * Settings panel for webwallet — WartBunker Tools shape:
 * one dropdown to pick a tool, one card open at a time.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BRAND_COLOR_OPTIONS,
  BRAND_SWATCH_BASE,
  DEFAULT_NUMBER_DISPLAY_PREFS,
  FUN_COLOR_OPTIONS,
  NUMBER_COLOR_OPTIONS,
  NUMBER_DISPLAY_MODES,
  detectNumberDisplayMode,
  formatDisplayBalance,
  getBrandColorClasses,
  getNumberColorClass,
  loadNumberDisplayPrefs,
  normalizeNumberDisplayPrefs,
  prefsForNumberDisplayMode,
  saveNumberDisplayPrefs,
} from '../utils/numberDisplay.js';

const PREVIEW_SAMPLES = [
  { label: 'Large amount', value: 1000000 },
  { label: 'Balance', value: 2456.12345678 },
  { label: 'Tiny', value: 0.0000000342 },
  { label: 'Price', value: 0.0001523 },
];

function colorMeta(colorId) {
  return NUMBER_COLOR_OPTIONS.find((c) => c.id === colorId) ?? NUMBER_COLOR_OPTIONS[0];
}

function ColorSwatch({ color, size = 'sm' }) {
  const cls = size === 'lg' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  if (color.swatch) {
    return (
      <img
        src={`${BRAND_SWATCH_BASE}/${color.swatch}`}
        alt=""
        className={`rounded-full border border-white/20 flex-shrink-0 ${cls}`}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={`rounded-full border border-white/20 flex-shrink-0 inline-block ${cls}`}
      style={{ backgroundColor: color.hex }}
      aria-hidden="true"
    />
  );
}

function ColorOptionButton({ color, value, defaultValue, onChange }) {
  const isActive = value === color.id;
  const isDefault = color.id === defaultValue;
  return (
    <button
      type="button"
      onClick={() => onChange(color.id)}
      title={isDefault ? `${color.label} — default` : color.label}
      className={`compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1 inline-flex items-center gap-1.5${
        isActive ? ' compact-btn--active' : ''
      }`}
    >
      <ColorSwatch color={color} />
      {isDefault ? 'Default' : color.label}
    </button>
  );
}

function ColorPickerRow({ label, value, defaultValue, onChange }) {
  return (
    <div className={label ? 'mb-3 last:mb-0' : ''}>
      {label && <div className="text-xs text-zinc-400 mb-1.5">{label}</div>}
      <div className="flex flex-wrap items-center gap-2">
        {BRAND_COLOR_OPTIONS.map((color) => (
          <ColorOptionButton
            key={color.id}
            color={color}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
          />
        ))}
      </div>
      <div className="mt-2.5">
        <div className="text-[10px] text-zinc-500 mb-1.5">Fun colors</div>
        <div className="flex flex-wrap items-center gap-2">
          {FUN_COLOR_OPTIONS.map((color) => (
            <ColorOptionButton
              key={color.id}
              color={color}
              value={value}
              defaultValue={defaultValue}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberDisplayCard({ prefs, setPrefs, applyMode, resetPrefs, activeMode }) {
  const resetColorPrefs = () =>
    setPrefs({
      numberColor: DEFAULT_NUMBER_DISPLAY_PREFS.numberColor,
      balanceColor: DEFAULT_NUMBER_DISPLAY_PREFS.balanceColor,
      limitOrderBuyColor: DEFAULT_NUMBER_DISPLAY_PREFS.limitOrderBuyColor,
      limitOrderSellColor: DEFAULT_NUMBER_DISPLAY_PREFS.limitOrderSellColor,
      liquidityPoolColor: DEFAULT_NUMBER_DISPLAY_PREFS.liquidityPoolColor,
    });

  const buyCls = getBrandColorClasses(prefs.limitOrderBuyColor);
  const sellCls = getBrandColorClasses(prefs.limitOrderSellColor);
  const poolCls = getBrandColorClasses(prefs.liquidityPoolColor);
  const balClass = getNumberColorClass(prefs.balanceColor);
  const numClass = getNumberColorClass(prefs.numberColor);

  return (
    <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white m-0 mb-1">Number display</h3>
          <p className="text-sm text-zinc-400 m-0">
            Presets and accent colors for balances and numbers (same as WartBunker).
          </p>
        </div>
        <button
          type="button"
          onClick={resetPrefs}
          className="compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1 flex-shrink-0"
        >
          Reset
        </button>
      </div>

      <div className="mb-4">
        <div className="text-xs text-zinc-400 mb-2">Quick presets</div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(NUMBER_DISPLAY_MODES).map(([modeId, mode]) => (
            <button
              key={modeId}
              type="button"
              onClick={() => applyMode(modeId)}
              title={mode.description}
              className={`compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1${
                activeMode === modeId ? ' compact-btn--active' : ''
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 mb-0">
          {activeMode == null
            ? 'Custom — differs from presets.'
            : NUMBER_DISPLAY_MODES[activeMode].description}
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Accent colors</div>
          <button
            type="button"
            onClick={resetColorPrefs}
            className="compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1"
          >
            Color defaults
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs text-zinc-300 mb-0.5">Balance color</div>
          <p className="text-[11px] text-zinc-500 mb-2">Main balance on the overview card</p>
          <ColorPickerRow
            value={prefs.balanceColor}
            defaultValue={DEFAULT_NUMBER_DISPLAY_PREFS.balanceColor}
            onChange={(balanceColor) => setPrefs({ balanceColor })}
          />
        </div>

        <div className="mb-4">
          <div className="text-xs text-zinc-300 mb-0.5">Number color</div>
          <p className="text-[11px] text-zinc-500 mb-2">Prices and general figures</p>
          <ColorPickerRow
            value={prefs.numberColor}
            defaultValue={DEFAULT_NUMBER_DISPLAY_PREFS.numberColor}
            onChange={(numberColor) => setPrefs({ numberColor })}
          />
        </div>

        <div className="mb-2">
          <div className="text-xs text-zinc-300 mb-0.5">Limit orders (buy / sell)</div>
          <ColorPickerRow
            label="Buy"
            value={prefs.limitOrderBuyColor}
            defaultValue={DEFAULT_NUMBER_DISPLAY_PREFS.limitOrderBuyColor}
            onChange={(limitOrderBuyColor) => setPrefs({ limitOrderBuyColor })}
          />
          <ColorPickerRow
            label="Sell"
            value={prefs.limitOrderSellColor}
            defaultValue={DEFAULT_NUMBER_DISPLAY_PREFS.limitOrderSellColor}
            onChange={(limitOrderSellColor) => setPrefs({ limitOrderSellColor })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono mt-3 pt-3 border-t border-zinc-800">
          <span className={`px-2 py-0.5 rounded ${buyCls.bgMuted} ${buyCls.text}`}>BUY</span>
          <span className={`px-2 py-0.5 rounded ${sellCls.bgMuted} ${sellCls.text}`}>SELL</span>
          <span className={`px-2 py-0.5 rounded ${poolCls.bgMuted} ${poolCls.text}`}>LP</span>
          <span className={`px-2 py-0.5 rounded bg-zinc-800 ${balClass}`}>BAL</span>
          <span className={`px-2 py-0.5 rounded bg-zinc-800 ${numClass}`}>NUM</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Decimal places</label>
          <select
            value={prefs.maxDecimals == null ? 'full' : String(prefs.maxDecimals)}
            onChange={(e) => {
              const v = e.target.value;
              setPrefs({ maxDecimals: v === 'full' ? null : parseInt(v, 10) });
            }}
            className="bunker-input"
          >
            <option value="full">Full precision</option>
            {[0, 2, 4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n} decimals
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Notation</label>
          <select
            value={prefs.notation}
            onChange={(e) => setPrefs({ notation: e.target.value })}
            className="bunker-input"
          >
            <option value="standard">Standard (1,234.56)</option>
            <option value="compact">Compact (1.23M)</option>
            <option value="scientific">Scientific</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.useGrouping}
            onChange={(e) => setPrefs({ useGrouping: e.target.checked })}
            className="rounded border-zinc-600 accent-[#E79300]"
          />
          Thousand separators
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.trimTrailingZeros}
            onChange={(e) => setPrefs({ trimTrailingZeros: e.target.checked })}
            className="rounded border-zinc-600 accent-[#E79300]"
          />
          Trim trailing zeros
        </label>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Preview</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {PREVIEW_SAMPLES.map((sample) => (
            <div key={sample.label} className="flex justify-between gap-3">
              <span className="text-zinc-500">{sample.label}</span>
              <span className={`font-mono tabular-nums ${balClass}`}>
                {formatDisplayBalance(sample.value, prefs)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {object} security — passkey/2FA panel props
 * @param {object} network — node selection props
 * @param {object} backup — download / export / contacts / clear
 * @param {object} validate — address validation
 */
export default function WalletSettingsPanel({
  onClose,
  // number prefs lifted so balance card can re-render
  numberPrefs,
  onNumberPrefsChange,
  // network
  nodeList = [],
  selectedNode = '',
  customIP = '',
  customPort = '',
  nodesLoading = false,
  nodesError = null,
  onNodeChange,
  onCustomIPChange,
  onCustomPortChange,
  onSaveCustomNode,
  // validate
  validateInput = '',
  onValidateInputChange,
  onValidate,
  validateResult = null,
  // security
  passkeysSupported = false,
  fpLabel = 'Passkey',
  sessionRequire2fa = false,
  sessionHasPasskey = false,
  sessionHasPassword = false,
  toolsWant2fa = false,
  setToolsWant2fa,
  toolsPasskeyPassword = '',
  setToolsPasskeyPassword,
  promptWalletName = '',
  setPromptWalletName,
  currentWalletName = null,
  passkeyBusy = false,
  toolsSecurityMsg = null,
  onEnablePasskey,
  // backup
  onDownload,
  onExportQr,
  onContacts,
  onClear,
}) {
  const [activeTool, setActiveTool] = useState('security');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [localPrefs, setLocalPrefs] = useState(
    () => numberPrefs || loadNumberDisplayPrefs(),
  );

  useEffect(() => {
    if (numberPrefs) setLocalPrefs(numberPrefs);
  }, [numberPrefs]);

  const setPrefs = useCallback(
    (patch) => {
      setLocalPrefs((prev) => {
        const merged = normalizeNumberDisplayPrefs({ ...prev, ...patch });
        saveNumberDisplayPrefs(merged);
        onNumberPrefsChange?.(merged);
        return merged;
      });
    },
    [onNumberPrefsChange],
  );

  const resetPrefs = useCallback(() => {
    const next = saveNumberDisplayPrefs(DEFAULT_NUMBER_DISPLAY_PREFS);
    setLocalPrefs(next);
    onNumberPrefsChange?.(next);
  }, [onNumberPrefsChange]);

  const applyMode = useCallback(
    (modeId) => {
      setLocalPrefs((prev) => {
        const next = saveNumberDisplayPrefs({
          ...prefsForNumberDisplayMode(modeId),
          numberColor: prev.numberColor,
          balanceColor: prev.balanceColor,
          limitOrderBuyColor: prev.limitOrderBuyColor,
          limitOrderSellColor: prev.limitOrderSellColor,
          liquidityPoolColor: prev.liquidityPoolColor,
        });
        onNumberPrefsChange?.(next);
        return next;
      });
    },
    [onNumberPrefsChange],
  );

  const activeMode = useMemo(() => detectNumberDisplayMode(localPrefs), [localPrefs]);

  const toolOptions = useMemo(() => {
    const opts = [
      { id: 'security', label: 'Passkey & 2FA' },
      { id: 'backup', label: 'Backup & export' },
      { id: 'numbers', label: 'Number display' },
      { id: 'network', label: 'Network node' },
      { id: 'validate', label: 'Validate address' },
      { id: 'account', label: 'Account' },
    ];
    if (!passkeysSupported) {
      return opts.filter((t) => t.id !== 'security');
    }
    return opts;
  }, [passkeysSupported]);

  const resolvedTool = toolOptions.some((t) => t.id === activeTool)
    ? activeTool
    : toolOptions[0]?.id || 'backup';

  const activeToolLabel =
    toolOptions.find((t) => t.id === resolvedTool)?.label || resolvedTool;

  return (
    <div id="wallet-tools" className="rounded-2xl border border-zinc-700/80 bg-zinc-950/90 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800/80">
        <div>
          <h2 className="text-base font-semibold text-white m-0">Settings</h2>
          <p className="text-[11px] text-zinc-500 m-0 mt-0.5">
            One tool at a time — pick from the list below
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="compact-btn hover:!text-[#E79300] !m-0"
        >
          Close
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* WartBunker-style tool picker */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/50">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-zinc-900/80 transition-colors text-left"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-block transition text-zinc-500 text-[10px] flex-shrink-0 ${
                  pickerOpen ? 'rotate-90' : ''
                }`}
              >
                ▶
              </span>
              <div className="min-w-0">
                <div className="text-xs text-zinc-300">Setting</div>
                <div className="text-[10px] text-zinc-500 truncate">Choose what to open</div>
              </div>
            </div>
            <span className="compact-btn compact-btn--active !mx-0 !my-0 !px-3 !py-1 flex-shrink-0 pointer-events-none">
              {activeToolLabel}
            </span>
          </button>
          {pickerOpen && (
            <div className="px-3 pb-3 pt-2 border-t border-zinc-800">
              <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Settings">
                {toolOptions.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    role="tab"
                    aria-selected={resolvedTool === tool.id}
                    onClick={() => {
                      setActiveTool(tool.id);
                      setPickerOpen(false);
                    }}
                    className={`compact-btn hover:!text-[#E79300] !mx-0 !my-0 !px-3 !py-1${
                      resolvedTool === tool.id ? ' compact-btn--active' : ''
                    }`}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Single active card */}
        {resolvedTool === 'security' && passkeysSupported && (
          <div
            className="rounded-2xl border p-4 sm:p-5"
            style={{
              borderColor: sessionRequire2fa
                ? 'rgba(56, 189, 248, 0.4)'
                : sessionHasPasskey
                  ? 'rgba(52, 211, 153, 0.35)'
                  : 'rgba(245, 158, 11, 0.45)',
              background: sessionRequire2fa
                ? 'rgba(12, 74, 110, 0.2)'
                : sessionHasPasskey
                  ? 'rgba(6, 78, 59, 0.18)'
                  : 'rgba(120, 53, 15, 0.15)',
            }}
          >
            <h3 className="text-base font-semibold text-zinc-100 m-0 mb-2">Passkey &amp; 2FA</h3>
            <p className="text-xs text-zinc-500 mb-3 m-0">
              One-tap {fpLabel} or password + {fpLabel}. Status shows as a badge on the balance card.
            </p>
            {sessionRequire2fa ? (
              <p className="text-sm text-sky-300/95 mb-2 m-0 font-medium">✓ 2FA active</p>
            ) : sessionHasPasskey ? (
              <p className="text-sm text-emerald-400/90 mb-2 m-0 font-medium">✓ Passkey enabled</p>
            ) : (
              <p className="text-sm text-zinc-400 mb-2 m-0">Not enabled yet</p>
            )}

            <label className="flex items-start gap-2 text-sm text-zinc-300 mb-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1 accent-[#E79300]"
                checked={toolsWant2fa}
                onChange={(e) => setToolsWant2fa?.(e.target.checked)}
                disabled={passkeyBusy}
              />
              <span>
                <strong>Require 2FA</strong> — password and {fpLabel} every login
              </span>
            </label>

            {(toolsWant2fa || !sessionHasPassword) && (
              <div className="mb-3">
                <label className="bunker-label">
                  Wallet password{toolsWant2fa ? ' (required for 2FA)' : ' (optional)'}
                </label>
                <input
                  type="password"
                  className="bunker-input"
                  autoComplete="current-password"
                  value={toolsPasskeyPassword}
                  onChange={(e) => setToolsPasskeyPassword?.(e.target.value)}
                  placeholder={toolsWant2fa ? 'Password for 2FA' : 'Optional password'}
                  disabled={passkeyBusy}
                />
              </div>
            )}

            {!currentWalletName && (
              <div className="mb-3">
                <label className="bunker-label">Save as name</label>
                <input
                  type="text"
                  className="bunker-input"
                  value={promptWalletName}
                  onChange={(e) => setPromptWalletName?.(e.target.value)}
                  placeholder="e.g. main"
                  disabled={passkeyBusy}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="bunker-btn bunker-btn--primary"
                disabled={passkeyBusy}
                onClick={() =>
                  onEnablePasskey?.({
                    require2fa: toolsWant2fa,
                    password: toolsPasskeyPassword || null,
                  })
                }
              >
                {passkeyBusy
                  ? 'Waiting for passkey…'
                  : toolsWant2fa
                    ? sessionHasPasskey
                      ? 'Update passkey + keep 2FA'
                      : 'Enable passkey with 2FA'
                    : sessionHasPasskey
                      ? `Re-register ${fpLabel}`
                      : `Enable ${fpLabel}`}
              </button>
              {sessionHasPasskey && !sessionRequire2fa && (
                <button
                  type="button"
                  className="bunker-btn"
                  disabled={passkeyBusy}
                  onClick={() => {
                    setToolsWant2fa?.(true);
                    onEnablePasskey?.({
                      require2fa: true,
                      password: toolsPasskeyPassword || null,
                    });
                  }}
                >
                  Enable 2FA (password + {fpLabel})
                </button>
              )}
            </div>
            {toolsSecurityMsg && (
              <p className="text-sm text-emerald-400/90 mt-2 mb-0">{toolsSecurityMsg}</p>
            )}
          </div>
        )}

        {resolvedTool === 'backup' && (
          <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/80 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white m-0 mb-1">Backup &amp; export</h3>
            <p className="text-sm text-zinc-400 mb-4 m-0">
              Download an encrypted file, export QR for mobile, or manage contacts.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="bunker-btn bunker-btn--primary" onClick={onDownload}>
                Download file
              </button>
              <button type="button" className="bunker-btn" onClick={onExportQr}>
                Export QR (mobile)
              </button>
              <button type="button" className="bunker-btn" onClick={onContacts}>
                Contacts
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-3 mb-0">
              {currentWalletName
                ? `Named “${currentWalletName}” is saved in this browser.`
                : 'Session only until you save a name under Passkey & 2FA.'}
            </p>
          </div>
        )}

        {resolvedTool === 'numbers' && (
          <NumberDisplayCard
            prefs={localPrefs}
            setPrefs={setPrefs}
            applyMode={applyMode}
            resetPrefs={resetPrefs}
            activeMode={activeMode}
          />
        )}

        {resolvedTool === 'network' && (
          <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/80 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white m-0 mb-1">Network node</h3>
            <p className="text-sm text-zinc-400 mb-4 m-0">RPC peer for balance and sends.</p>
            {nodesLoading ? (
              <p className="text-xs text-zinc-500">Loading nodes…</p>
            ) : nodesError ? (
              <p className="text-xs text-red-400">{nodesError}</p>
            ) : (
              <select
                value={
                  nodeList.some((n) => (n.id || n.url) === selectedNode)
                    ? selectedNode
                    : 'losthymns'
                }
                onChange={(e) => onNodeChange?.(e.target.value)}
                className="bunker-input"
              >
                {nodeList.map((node) => (
                  <option key={node.id || node.url} value={node.id || node.url}>
                    {node.name}
                  </option>
                ))}
              </select>
            )}
            {selectedNode === 'custom' && (
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  value={customIP}
                  onChange={(e) => onCustomIPChange?.(e.target.value)}
                  placeholder="Host"
                  className="bunker-input"
                />
                <input
                  type="text"
                  value={customPort}
                  onChange={(e) => onCustomPortChange?.(e.target.value)}
                  placeholder="Port"
                  className="bunker-input !max-w-[6rem]"
                />
                <button
                  type="button"
                  onClick={onSaveCustomNode}
                  disabled={!String(customIP || '').trim() || !String(customPort || '').trim()}
                  className="bunker-btn"
                >
                  Save node
                </button>
              </div>
            )}
          </div>
        )}

        {resolvedTool === 'validate' && (
          <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/80 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white m-0 mb-1">Validate address</h3>
            <p className="text-sm text-zinc-400 mb-4 m-0">Check a 48-character Warthog address checksum.</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={validateInput}
                onChange={(e) => onValidateInputChange?.(e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && onValidate?.()}
                placeholder="48-character address"
                className="bunker-input flex-1 min-w-[12rem]"
              />
              <button type="button" onClick={onValidate} className="bunker-btn bunker-btn--primary">
                Validate
              </button>
            </div>
            {validateResult && (
              <p
                className={`mt-3 text-sm font-mono m-0 ${
                  validateResult.valid ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {validateResult.valid
                  ? 'Valid Warthog address'
                  : validateInput
                    ? 'Invalid address'
                    : 'Enter an address to validate'}
              </p>
            )}
          </div>
        )}

        {resolvedTool === 'account' && (
          <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/80 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white m-0 mb-1">Account</h3>
            <p className="text-sm text-zinc-400 mb-4 m-0">
              Lock this session. Keys stay in browser storage if the wallet was saved.
            </p>
            <button type="button" className="bunker-btn bunker-btn--ghost text-red-400" onClick={onClear}>
              Clear wallet (lock session)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

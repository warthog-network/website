import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classifyExplorerQuery, parseBlockHeightQuery } from '../../lib/explorerSearch.js';
import { showToast } from '../../lib/explorerToast.js';
import { resolveWarthogAddress } from './explorerAddressUtils.js';

/**
 * One search box: address / tx hash / block height / multi-height list.
 * @param {{ onBlockHeights?: (heights: number[]) => void, autoFocus?: boolean, hideLabel?: boolean }} props
 */
export default function ExplorerUnifiedSearch({ onBlockHeights, autoFocus = false, hideLabel = false }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const classified = classifyExplorerQuery(value);
    if (classified.kind === 'empty') return;

    setBusy(true);
    try {
      if (classified.kind === 'tx') {
        navigate(`/transaction/lookup/${encodeURIComponent(classified.hash)}`);
        setValue('');
        return;
      }

      if (classified.kind === 'address') {
        const resolved = await resolveWarthogAddress(classified.address);
        if (!resolved) {
          showToast('Invalid address', { type: 'error' });
          return;
        }
        navigate(`/address/${encodeURIComponent(resolved)}`);
        setValue('');
        return;
      }

      if (classified.kind === 'block') {
        navigate(`/chain/block/${classified.height}`);
        setValue('');
        return;
      }

      if (classified.kind === 'blocks') {
        const heights = parseBlockHeightQuery(classified.query);
        if (!heights.length) {
          showToast('No valid block heights', { type: 'error' });
          return;
        }
        if (heights.length === 1) {
          navigate(`/chain/block/${heights[0]}`);
          setValue('');
          return;
        }
        if (typeof onBlockHeights === 'function') {
          onBlockHeights(heights);
          setValue('');
          showToast(`Showing ${heights.length} blocks`);
          return;
        }
        // Fallback: open first block if parent doesn't handle multi-search
        navigate(`/chain/block/${heights[0]}`);
        setValue('');
        return;
      }

      showToast('Enter an address, tx hash, or block height', { type: 'info' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="explorer-unified-search">
      {!hideLabel && (
        <label htmlFor="explorer-unified-search" className="bunker-label">
          Search
        </label>
      )}
      <div className="bunker-form-row">
        <input
          id="explorer-unified-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Address · tx hash · block height · 100-110"
          className="bunker-input"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          aria-label="Search explorer"
        />
        <button type="submit" className="bunker-btn bunker-btn--primary" disabled={busy || !value.trim()}>
          {busy ? '…' : 'Go'}
        </button>
      </div>
      <p className="bunker-muted explorer-unified-search__hint">
        Paste any address, transaction hash, or height. Ranges like <code>100-105</code> work too.
      </p>
    </form>
  );
}

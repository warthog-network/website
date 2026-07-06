import { useState } from 'react';
import { abbreviate } from './assets/util.js';

export function normalizeExplorerAddress(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—' || trimmed === 'unknown') return null;
    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'object') {
    if ('str' in value && typeof value.str === 'string') {
      return normalizeExplorerAddress(value.str);
    }
    if ('E8' in value && typeof value.E8 === 'string') {
      return normalizeExplorerAddress(value.E8);
    }
  }

  const asString = String(value);
  return normalizeExplorerAddress(asString);
}

export default function ExplorerAddress({
  address,
  className = 'bunker-link',
  abbreviated = true,
  showCopy = true,
  showLink = true,
}) {
  const [copied, setCopied] = useState(false);
  const normalized = normalizeExplorerAddress(address);

  if (!normalized) {
    return <span>—</span>;
  }

  const display = abbreviated ? abbreviate(normalized) : normalized;

  const handleCopy = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address', err);
    }
  };

  return (
    <span className="explorer-address">
      {showLink ? (
        <a
          href={`/address/${encodeURIComponent(normalized)}`}
          className={`explorer-address__link ${className}`.trim()}
          title={`View address page: ${normalized}`}
        >
          {display}
        </a>
      ) : (
        <span className="explorer-address__text" title={normalized}>
          {display}
        </span>
      )}
      {showCopy ? (
        <button
          type="button"
          className={`compact-btn explorer-address__copy !m-0${copied ? ' compact-btn--active' : ''}`}
          onClick={handleCopy}
          title="Copy full address"
          aria-label={copied ? 'Address copied' : 'Copy address'}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
    </span>
  );
}
import { useRef, useState } from 'react';
import { abbreviate } from './assets/util.js';
import { normalizeExplorerAddress } from './explorerAddressUtils.js';

const COPY_DELAY_MS = 280;

function addressPath(normalized) {
  return `/address/${encodeURIComponent(normalized)}`;
}

export default function ExplorerAddress({
  address,
  className = '',
  abbreviated = true,
  showCopy = true,
  showLink = true,
}) {
  const [copied, setCopied] = useState(false);
  const clickTimerRef = useRef(null);
  const normalized = normalizeExplorerAddress(address);

  if (!normalized) {
    return <span>—</span>;
  }

  const display = abbreviated ? abbreviate(normalized) : normalized;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address', err);
    }
  };

  const handleCopyClick = () => {
    if (!showCopy) return;

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      copyAddress();
    }, COPY_DELAY_MS);
  };

  const handleClick = (event) => {
    event.preventDefault();
    handleCopyClick();
  };

  const handleDoubleClick = (event) => {
    if (!showLink) return;

    event.preventDefault();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    window.location.assign(addressPath(normalized));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCopyClick();
    }
  };

  if (!showCopy && showLink) {
    return (
      <span className="explorer-address">
        <a
          href={addressPath(normalized)}
          className={`explorer-address__link ${className}`.trim()}
          title={`View address page: ${normalized}`}
        >
          {display}
        </a>
      </span>
    );
  }

  if (!showCopy) {
    return (
      <span className="explorer-address">
        <span className="explorer-address__text" title={normalized}>
          {display}
        </span>
      </span>
    );
  }

  return (
    <span className={`explorer-address${showLink ? ' explorer-address--with-hint' : ''}`}>
      <span className="explorer-address__main">
        <span
          role="button"
          tabIndex={0}
          className={`explorer-address__action${className ? ` ${className}` : ''}`}
          onClick={handleClick}
          onDoubleClick={showLink ? handleDoubleClick : undefined}
          onKeyDown={handleKeyDown}
          title={
            showLink
              ? `Click to copy · double-click to view history: ${normalized}`
              : `Click to copy: ${normalized}`
          }
          aria-label={copied ? 'Address copied' : `Copy address ${display}`}
        >
          {display}
        </span>
        {copied ? (
          <span className="explorer-address__copied" aria-live="polite">
            Copied
          </span>
        ) : null}
      </span>
      {showLink ? (
        <span className="explorer-address__hint">Double-click to view address history</span>
      ) : null}
    </span>
  );
}
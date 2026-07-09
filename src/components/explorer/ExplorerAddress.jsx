import { useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { abbreviate } from './assets/util.js';
import { normalizeExplorerAddress } from './explorerAddressUtils.js';
import { copyWithToast } from '../../lib/explorerToast.js';

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
  const navigate = useNavigate();
  const clickTimerRef = useRef(null);
  const normalized = normalizeExplorerAddress(address);

  if (!normalized) {
    return <span>—</span>;
  }

  const display = abbreviated ? abbreviate(normalized) : normalized;
  const path = addressPath(normalized);

  const copyAddress = async () => {
    await copyWithToast(normalized, 'Address copied');
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
    navigate(path);
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
        <Link
          to={path}
          className={`explorer-address__link ${className}`.trim()}
          title={`View address page: ${normalized}`}
        >
          {display}
        </Link>
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
          aria-label={`Copy address ${display}`}
        >
          {display}
        </span>
      </span>
      {showLink ? (
        <span className="explorer-address__hint">Double-click to view address history</span>
      ) : null}
    </span>
  );
}

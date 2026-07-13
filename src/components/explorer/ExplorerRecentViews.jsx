import { useEffect, useState } from 'react';
import ExplorerLink from './ExplorerLink.jsx';
import {
  abbreviateRecentId,
  clearRecentViews,
  getRecentViews,
  pathForRecentView,
} from '../../lib/explorerRecent.js';

const TYPE_LABEL = {
  address: 'Addr',
  block: 'Block',
  tx: 'Tx',
};

export default function ExplorerRecentViews() {
  const [items, setItems] = useState(() => getRecentViews());

  useEffect(() => {
    const refresh = () => setItems(getRecentViews());
    refresh();
    window.addEventListener('explorer-recent-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('explorer-recent-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="bunker-panel explorer-recent">
      <div className="bunker-toolbar" style={{ marginBottom: '0.5rem' }}>
        <h3 className="bunker-heading" style={{ margin: 0, fontSize: '0.95rem' }}>
          Recent
        </h3>
        <button
          type="button"
          className="bunker-btn bunker-btn--ghost"
          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
          onClick={() => {
            clearRecentViews();
            setItems([]);
          }}
        >
          Clear
        </button>
      </div>
      <div className="explorer-recent__chips">
        {items.map((item) => (
          <ExplorerLink
            key={`${item.type}:${item.id}`}
            to={pathForRecentView(item)}
            className="explorer-recent__chip"
            title={item.label || item.id}
          >
            <span className="explorer-recent__type">{TYPE_LABEL[item.type] || item.type}</span>
            <span className="explorer-recent__id">
              {abbreviateRecentId(item.label || item.id, item.type)}
            </span>
          </ExplorerLink>
        ))}
      </div>
    </div>
  );
}

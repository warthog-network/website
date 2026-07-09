/** Recently viewed explorer entities (localStorage). */

const STORAGE_KEY = 'explorerRecentViews';
const MAX_ITEMS = 12;

/**
 * @typedef {{ type: 'address'|'block'|'tx', id: string, label?: string, at: number }} RecentView
 */

/** @returns {RecentView[]} */
export function getRecentViews() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && item.type && item.id)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/**
 * @param {{ type: 'address'|'block'|'tx', id: string|number, label?: string }} entry
 */
export function pushRecentView(entry) {
  if (typeof window === 'undefined' || !entry?.type || entry.id == null) return;

  const id = String(entry.id).trim();
  if (!id) return;

  const next = {
    type: entry.type,
    id,
    label: entry.label || id,
    at: Date.now(),
  };

  try {
    const existing = getRecentViews().filter(
      (item) => !(item.type === next.type && item.id === next.id),
    );
    const list = [next, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('explorer-recent-updated'));
  } catch {
    // quota / private mode
  }
}

export function clearRecentViews() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('explorer-recent-updated'));
  } catch {
    // ignore
  }
}

export function pathForRecentView(item) {
  if (!item) return '/explorer';
  if (item.type === 'address') return `/address/${encodeURIComponent(item.id)}`;
  if (item.type === 'block') return `/chain/block/${encodeURIComponent(item.id)}`;
  if (item.type === 'tx') return `/transaction/lookup/${encodeURIComponent(item.id)}`;
  return '/explorer';
}

export function abbreviateRecentId(id, type) {
  const s = String(id || '');
  if (type === 'block') return s;
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

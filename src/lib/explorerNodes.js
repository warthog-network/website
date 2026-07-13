/**
 * Shared node selection for explorer + wallet.
 *
 * - Official 1 (indexed) is the only built-in public node.
 * - Users can save custom host:port entries; those appear in the dropdown.
 * - Selecting "Custom…" shows host/port inputs + Save (then collapses).
 */

export const OFFICIAL1_URL = 'https://warthognode.duckdns.org';
export const OFFICIAL1_KEY = 'losthymns';
export const ADD_CUSTOM_KEY = 'custom';

const SAVED_NODES_STORAGE_KEY = 'savedCustomNodes';

/** Legacy keys/URLs that used to be official 2 — map back to official 1. */
const LEGACY_OFFICIAL2 = new Set([
  'official2',
  'polaire',
  'http://65.87.7.86:3001',
]);

const LEGACY_LOCAL = new Set(['local', 'http://localhost:3000', 'http://127.0.0.1:3000']);

/**
 * Build a normalized base URL from host + port inputs.
 * Accepts host with or without scheme (e.g. localhost, 192.168.1.1, http://host).
 */
export function buildCustomNodeUrl(host, port) {
  const rawHost = String(host || '').trim().replace(/\/+$/, '');
  const rawPort = String(port || '').trim();
  if (!rawHost || !rawPort) return '';

  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawHost)
      ? rawHost
      : `http://${rawHost}`;
    const u = new URL(withScheme);
    return `${u.protocol}//${u.hostname}:${rawPort}`;
  } catch {
    const hostOnly = rawHost
      .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
      .split('/')[0]
      .split(':')[0];
    return hostOnly ? `http://${hostOnly}:${rawPort}` : '';
  }
}

/** Short label for a saved custom node URL. */
export function labelForNodeUrl(url) {
  try {
    const u = new URL(url);
    return u.host || url;
  } catch {
    return url;
  }
}

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

export function loadSavedCustomNodes() {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(SAVED_NODES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (typeof entry === 'string') {
          const url = entry.replace(/\/$/, '');
          return url.startsWith('http') ? { url, label: labelForNodeUrl(url) } : null;
        }
        if (entry && typeof entry === 'object' && entry.url) {
          const url = String(entry.url).replace(/\/$/, '');
          if (!url.startsWith('http')) return null;
          return {
            url,
            label: entry.label || labelForNodeUrl(url),
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function persistSavedCustomNodes(nodes) {
  if (!storageAvailable()) return;
  const cleaned = (nodes || [])
    .map((n) => ({
      url: String(n.url || '').replace(/\/$/, ''),
      label: n.label || labelForNodeUrl(String(n.url || '')),
    }))
    .filter((n) => n.url.startsWith('http'));
  localStorage.setItem(SAVED_NODES_STORAGE_KEY, JSON.stringify(cleaned));
}

/**
 * Save (or update) a custom node and return the normalized URL.
 * Dedupes by URL.
 */
export function saveCustomNode(host, port) {
  const url = buildCustomNodeUrl(host, port);
  if (!url) {
    throw new Error('Host and port are required');
  }
  const existing = loadSavedCustomNodes();
  const label = labelForNodeUrl(url);
  const withoutDup = existing.filter((n) => n.url !== url);
  const next = [{ url, label }, ...withoutDup];
  persistSavedCustomNodes(next);
  return url;
}

/**
 * Map any stored selection to a stable select value:
 * - `losthymns` for official 1
 * - full URL for a saved custom node
 * - `custom` only while the add form is open
 */
export function normalizeSelectedNode(node) {
  if (!node) return OFFICIAL1_KEY;
  const trimmed = String(node).trim();
  const bareUrl = trimmed.replace(/\/$/, '');

  if (LEGACY_OFFICIAL2.has(trimmed) || LEGACY_OFFICIAL2.has(bareUrl)) {
    return OFFICIAL1_KEY;
  }
  if (trimmed === OFFICIAL1_KEY || trimmed === 'indexer') {
    return OFFICIAL1_KEY;
  }
  if (bareUrl === OFFICIAL1_URL || bareUrl === OFFICIAL1_URL.replace(/\/$/, '')) {
    return OFFICIAL1_KEY;
  }
  // Legacy "local" key → treat as a normal custom URL selection
  if (LEGACY_LOCAL.has(trimmed) || LEGACY_LOCAL.has(bareUrl)) {
    return 'http://localhost:3000';
  }
  if (trimmed === ADD_CUSTOM_KEY || trimmed === '__add_custom__') {
    return ADD_CUSTOM_KEY;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return bareUrl;
  }
  return OFFICIAL1_KEY;
}

/** Built-in + "Custom…" row (saved nodes are merged at runtime). */
export const BUILTIN_NODE_OPTIONS = [
  { value: OFFICIAL1_KEY, label: 'official 1' },
  { value: ADD_CUSTOM_KEY, label: 'Custom…' },
];

/** @deprecated use BUILTIN_NODE_OPTIONS + getNodeSelectOptions() */
export const NODE_SELECT_OPTIONS = BUILTIN_NODE_OPTIONS;
export const EXPLORER_NODE_OPTIONS = BUILTIN_NODE_OPTIONS;

/**
 * Full dropdown options: official 1, saved customs, Custom…
 */
export function getNodeSelectOptions(savedNodes = loadSavedCustomNodes()) {
  const customs = (savedNodes || []).map((n) => ({
    value: n.url,
    label: n.label || labelForNodeUrl(n.url),
  }));
  return [
    { value: OFFICIAL1_KEY, label: 'official 1' },
    ...customs,
    { value: ADD_CUSTOM_KEY, label: 'Custom…' },
  ];
}

export function getExplorerHost(node) {
  const key = normalizeSelectedNode(node);
  if (key === OFFICIAL1_KEY) return OFFICIAL1_URL;
  if (key === ADD_CUSTOM_KEY) return null;
  if (/^https?:\/\//i.test(key)) return key;
  return OFFICIAL1_URL;
}

/** Whether this selection should use the site indexer proxy (`/api/explorer/*`). */
export function nodeHasIndexer(node) {
  return normalizeSelectedNode(node) === OFFICIAL1_KEY;
}

/**
 * Resolve a selection (key or URL) to a node base URL.
 */
export function resolveNodeBaseFromSelection(selected, {
  customIP,
  customPort,
  defaultNode = OFFICIAL1_KEY,
} = {}) {
  const key = normalizeSelectedNode(selected || defaultNode);

  if (key === ADD_CUSTOM_KEY) {
    if (customIP || customPort) {
      return buildCustomNodeUrl(customIP || 'localhost', customPort || '3000') || 'http://localhost:3000';
    }
    const raw = String(selected || '').trim().replace(/\/$/, '');
    if (/^https?:\/\//i.test(raw)) return raw;
    return 'http://localhost:3000';
  }

  return getExplorerHost(key);
}

/** Resolve the active node host from browser localStorage. */
export function resolveExplorerHostFromStorage(defaultNode = OFFICIAL1_KEY) {
  if (typeof window === 'undefined') {
    return getExplorerHost(defaultNode);
  }

  const selectedNode = localStorage.getItem('selectedNode') || defaultNode;
  const normalized = normalizeSelectedNode(selectedNode);

  // If a saved URL is selected, use it directly.
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return resolveNodeBaseFromSelection(normalized, {
    customIP: localStorage.getItem('customIP'),
    customPort: localStorage.getItem('customPort'),
    defaultNode,
  });
}

/** @deprecated kept for older imports */
export const NODE_HOSTS = {
  [OFFICIAL1_KEY]: OFFICIAL1_URL,
  local: 'http://localhost:3000',
};

export const NODE_CONFIG = {
  [OFFICIAL1_KEY]: {
    url: OFFICIAL1_URL,
    label: 'official 1',
    hasIndexer: true,
  },
};

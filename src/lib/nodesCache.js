import {
  getExplorerHost,
  getNodeSelectOptions,
  loadSavedCustomNodes,
  normalizeSelectedNode,
  resolveNodeBaseFromSelection,
  OFFICIAL1_KEY,
  OFFICIAL1_URL,
  ADD_CUSTOM_KEY,
} from './explorerNodes.js';

/**
 * Build the wallet/explorer node list from built-ins + saved customs.
 */
export function buildNodeList() {
  return getNodeSelectOptions(loadSavedCustomNodes()).map((opt) => ({
    id: opt.value,
    name: opt.label,
    url: opt.value === ADD_CUSTOM_KEY
      ? ''
      : opt.value === OFFICIAL1_KEY
        ? OFFICIAL1_URL
        : opt.value,
  }));
}

/**
 * Normalize node state (string URL, key, or { url } object) to a base URL.
 */
export function resolveNodeUrl(node) {
  if (!node) return '';

  if (typeof node === 'object' && node.url) {
    const trimmed = String(node.url).trim();
    return trimmed.startsWith('http') ? trimmed.replace(/\/$/, '') : '';
  }

  if (typeof node !== 'string') return '';

  const trimmed = node.trim();
  if (!trimmed) return '';

  const key = normalizeSelectedNode(trimmed);

  if (key === ADD_CUSTOM_KEY) {
    if (typeof window !== 'undefined') {
      return resolveNodeBaseFromSelection(trimmed, {
        customIP: localStorage.getItem('customIP'),
        customPort: localStorage.getItem('customPort'),
      });
    }
    return trimmed.startsWith('http') ? trimmed.replace(/\/$/, '') : '';
  }

  return getExplorerHost(key) || '';
}

export async function fetchNodes() {
  return { nodes: buildNodeList(), loading: false, error: null };
}

export { getNodeSelectOptions, loadSavedCustomNodes };

let cache = buildNodeList();
const subscribers = [];

function notifySubscribers() {
  cache = buildNodeList();
  subscribers.forEach((cb) => cb({ nodes: cache, loading: false, error: null }));
}

export function subscribe(callback) {
  subscribers.push(callback);
  callback({ nodes: buildNodeList(), loading: false, error: null });
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx > -1) subscribers.splice(idx, 1);
  };
}

/** Call after saving a custom node so subscribers refresh. */
export function refreshNodeList() {
  notifySubscribers();
}

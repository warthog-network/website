const HARDCODED_NODES = [
  { url: 'https://warthognode.duckdns.org', name: 'official 1' },
  { url: 'http://65.87.7.86:3001', name: 'official 2' },
];

/** Normalize node state (string URL or { url } object) to a proxy-safe base URL. */
export function resolveNodeUrl(node) {
  if (!node) return '';
  if (typeof node === 'string') {
    const trimmed = node.trim();
    return trimmed.startsWith('http') ? trimmed : '';
  }
  if (typeof node === 'object' && node.url) {
    const trimmed = String(node.url).trim();
    return trimmed.startsWith('http') ? trimmed : '';
  }
  return '';
}

let cache = HARDCODED_NODES;
let loading = false;
let error = null;
const subscribers = [];

export async function fetchNodes() {
  // Hardcoded public nodes (no API call)
  return { nodes: HARDCODED_NODES, loading: false, error: null };
}

function notifySubscribers() {
  subscribers.forEach(cb => cb({ nodes: cache, loading, error }));
}

export function subscribe(callback) {
  subscribers.push(callback);
  callback({ nodes: cache, loading, error });
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx > -1) subscribers.splice(idx, 1);
  };
}
const NODE_HOSTS = {
  losthymns: 'https://warthognode.duckdns.org',
  official2: 'http://65.87.7.86:3001',
  local: 'http://localhost:3000',
};

const URL_TO_NODE = Object.fromEntries(
  Object.entries(NODE_HOSTS).map(([key, url]) => [url.replace(/\/$/, ''), key]),
);

/** Map wallet URLs, legacy keys, or unknown values to a known explorer node id. */
export function normalizeSelectedNode(node) {
  if (!node) return 'losthymns';
  const trimmed = node.trim();
  const bareUrl = trimmed.replace(/\/$/, '');
  if (URL_TO_NODE[bareUrl]) return URL_TO_NODE[bareUrl];
  if (trimmed === 'polaire') return 'official2';
  if (trimmed in NODE_HOSTS || trimmed === 'custom') return trimmed;
  return 'losthymns';
}

export function getExplorerHost(node) {
  const key = normalizeSelectedNode(node);
  if (key === 'custom') return null;
  return NODE_HOSTS[key] || NODE_HOSTS.losthymns;
}

export const EXPLORER_NODE_OPTIONS = [
  { value: 'losthymns', label: 'official 1' },
  { value: 'official2', label: 'official 2' },
  { value: 'local', label: 'Local Node' },
  { value: 'custom', label: 'Custom Node' },
];

/** Resolve the node host from browser localStorage (wallet URLs are normalized). */
export function resolveExplorerHostFromStorage(defaultNode = 'losthymns') {
  if (typeof window === 'undefined') {
    return getExplorerHost(defaultNode);
  }

  const selectedNode = normalizeSelectedNode(
    localStorage.getItem('selectedNode') || defaultNode,
  );

  if (selectedNode === 'custom') {
    const customIP = localStorage.getItem('customIP') || 'localhost';
    const customPort = localStorage.getItem('customPort') || '3000';
    let fullIP = customIP;
    if (!fullIP.includes('://')) {
      fullIP = `http://${fullIP}`;
    }
    return `${fullIP}:${customPort}`;
  }

  return getExplorerHost(selectedNode);
}
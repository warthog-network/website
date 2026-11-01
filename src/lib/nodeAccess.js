const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/** Parse a node URL hostname, or null when invalid. */
export const parseNodeHostname = (node) => {
  if (!node) return null;
  try {
    return new URL(node).hostname.toLowerCase();
  } catch {
    return null;
  }
};

/** True for loopback-only nodes (localhost / 127.0.0.1). */
export const isLoopbackNode = (node) => {
  const host = parseNodeHostname(node);
  if (!host) {
    const n = String(node).toLowerCase();
    return n.includes('localhost') || n.includes('127.0.0.1');
  }
  return LOCAL_HOSTS.has(host);
};

/**
 * An HTTPS page can call HTTPS nodes and loopback. Plain http:// nodes are
 * blocked by the browser, and this site no longer relays them.
 */
export const browserCanReachNode = (node) => {
  if (typeof window === 'undefined') return true;
  if (window.location.protocol !== 'https:') return true;
  const value = String(node || '').trim().toLowerCase();
  if (!value.startsWith('http://')) return true;
  return isLoopbackNode(node);
};

/**
 * Node address typed into the web wallet.
 * HTTPS is kept. A bare host is treated as HTTPS. Localhost stays HTTP.
 * Any other plain HTTP address is rejected: this site no longer relays it.
 */
export function parseWalletNodeInput(raw) {
  let value = String(raw || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('Enter a node address');

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
  if (!hasScheme) {
    const hostPort = value.split('/')[0];
    const bracket = hostPort.startsWith('[') ? hostPort.indexOf(']') : -1;
    const host = (bracket > 1 ? hostPort.slice(1, bracket) : hostPort.split(':')[0]).toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
    const hasPort = bracket > 1 ? hostPort.slice(bracket + 1).startsWith(':') : hostPort.includes(':');
    if (loopback) value = `http://${hasPort ? hostPort : `${hostPort}:3000`}`;
    else value = `https://${hostPort}`;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter https://your-node.example or http://localhost:3000');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Enter https://your-node.example or http://localhost:3000');
  }
  if (url.protocol === 'http:' && !isLoopbackNode(url.href)) {
    throw new Error(
      'This page can reach an HTTPS node, or a node on this computer at http://localhost. A plain HTTP address on another machine cannot be used.',
    );
  }
  return `${url.protocol}//${url.host}`;
}

/** Absolute URL for a node API path. Throws when the browser cannot reach it. */
export function nodeHttpUrl(nodeBase, nodePath) {
  const base = String(nodeBase || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('Select a node');
  if (!browserCanReachNode(base)) {
    throw new Error(
      'This HTTPS page can only reach HTTPS nodes. Use official 1, or a node served over https.',
    );
  }
  const path = String(nodePath || '').replace(/^\//, '');
  return path ? `${base}/${path}` : `${base}/`;
}

/** True only for nodes running locally (safe for debug/fakemine). */
export const isFakeMineAllowed = (node) => {
  const host = parseNodeHostname(node);
  if (!host) {
    const n = String(node).toLowerCase();
    return n.includes('localhost') || n.includes('127.0.0.1');
  }
  return host === 'localhost' || host === '127.0.0.1';
};
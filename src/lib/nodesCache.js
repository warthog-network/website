const HARDCODED_NODES = [
  { url: 'https://warthognode.duckdns.org', name: 'official 1' },
  { url: 'http://65.87.7.86:3001', name: 'official 2' },
];

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
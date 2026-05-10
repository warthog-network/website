const API_URL = 'https://data.warthog.network/legacy-nodes.json';

let cache = null;
let loading = false;
let error = null;
const subscribers = [];

export async function fetchNodes() {
  if (cache !== null) {
    return { nodes: cache, loading: false, error };
  }

  if (loading) {
    return { nodes: null, loading: true, error: null };
  }

  loading = true;
  error = null;
  notifySubscribers();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    cache = data.nodes || data;
    loading = false;
    notifySubscribers();
    return { nodes: cache, loading: false, error: null };
  } catch (e) {
    error = 'Failed to load nodes';
    loading = false;
    notifySubscribers();
    return { nodes: null, loading: false, error };
  }
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
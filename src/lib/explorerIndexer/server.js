const DEFAULT_INDEXER_URL = 'https://warthognode.duckdns.org';

export function getExplorerIndexerBaseUrl() {
  const configured =
    import.meta.env.EXPLORER_INDEXER_URL || import.meta.env.PUBLIC_EXPLORER_INDEXER_URL;
  return (configured || DEFAULT_INDEXER_URL).replace(/\/+$/, '');
}

export async function fetchIndexerJson(path, { searchParams } = {}) {
  const url = new URL(path, `${getExplorerIndexerBaseUrl()}/`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const preview = text.trim().slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      `Indexer returned non-JSON (HTTP ${response.status}) for ${url.pathname}: ${preview || '(empty)'}`,
    );
  }

  if (!response.ok) {
    throw new Error(json.error || `Indexer HTTP ${response.status} for ${url.pathname}`);
  }

  if (json.code !== 0) {
    throw new Error(json.error || 'Indexer request failed');
  }
  return json.data;
}

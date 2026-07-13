/**
 * WART → USD price helpers with multi-source fallback + short cache.
 * CoinGecko free tier often 429s; CoinPaprika is a reliable backup.
 */

const CACHE_KEY = 'wartUsdPriceCache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let memoryCache = null; // { price, fetchedAt }

function readStorageCache() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && typeof parsed.price === 'number'
      && parsed.price > 0
      && typeof parsed.fetchedAt === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStorageCache(entry) {
  memoryCache = entry;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore quota / private mode
  }
}

function getCachedPrice(allowStale = false) {
  const now = Date.now();
  const candidates = [memoryCache, readStorageCache()].filter(Boolean);
  for (const entry of candidates) {
    if (entry.price > 0 && (allowStale || now - entry.fetchedAt < CACHE_TTL_MS)) {
      memoryCache = entry;
      return entry.price;
    }
  }
  return null;
}

async function fetchFromCoinGecko() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=warthog&vs_currencies=usd',
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }
  const data = await res.json();
  const price = Number(data?.warthog?.usd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('CoinGecko returned no price');
  }
  return price;
}

async function fetchFromCoinPaprika() {
  const res = await fetch('https://api.coinpaprika.com/v1/tickers/wart-warthog', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`CoinPaprika HTTP ${res.status}`);
  }
  const data = await res.json();
  const price = Number(data?.quotes?.USD?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('CoinPaprika returned no price');
  }
  return price;
}

/**
 * Fetch current WART price in USD.
 * Uses cache when fresh; falls back across sources; returns last-known price if all fail.
 * @returns {Promise<number|null>}
 */
export async function fetchWartUsdPrice() {
  const cached = getCachedPrice(false);
  if (cached != null) return cached;

  const sources = [fetchFromCoinGecko, fetchFromCoinPaprika];
  let lastError = null;

  for (const source of sources) {
    try {
      const price = await source();
      writeStorageCache({ price, fetchedAt: Date.now() });
      return price;
    } catch (err) {
      lastError = err;
      console.warn('WART price source failed:', err?.message || err);
    }
  }

  // Prefer a slightly stale cache over blank UI
  const stale = getCachedPrice(true);
  if (stale != null) return stale;

  if (lastError) {
    console.warn('All WART price sources failed', lastError);
  }
  return null;
}

/**
 * Format a WART balance as a USD display string.
 * @param {string|number} wartBalance
 * @param {number|null} [price]
 * @returns {Promise<string>} e.g. "$12.34" or "N/A"
 */
export async function formatWartUsdBalance(wartBalance, price) {
  const amount = Number(wartBalance);
  if (!Number.isFinite(amount) || amount <= 0) {
    return '$0.00';
  }

  const usdPrice = price != null ? price : await fetchWartUsdPrice();
  if (usdPrice == null || !(usdPrice > 0)) {
    return 'N/A';
  }

  const usd = amount * usdPrice;
  if (usd < 0.01 && usd > 0) {
    return `$${usd.toFixed(4)}`;
  }
  return `$${usd.toFixed(2)}`;
}

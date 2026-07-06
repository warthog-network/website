import { ensureWorkerCrypto } from '../../lib/ensureBuffer.js';

export function normalizeExplorerAddress(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—' || trimmed === 'unknown') return null;
    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'object') {
    if ('str' in value && typeof value.str === 'string') {
      return normalizeExplorerAddress(value.str);
    }
    if ('E8' in value && typeof value.E8 === 'string') {
      return normalizeExplorerAddress(value.E8);
    }
  }

  const asString = String(value);
  return normalizeExplorerAddress(asString);
}

/** Resolve and validate a Warthog address, fixing checksum when possible. */
export async function resolveWarthogAddress(value) {
  const raw = normalizeExplorerAddress(value);
  if (!raw) return null;

  await ensureWorkerCrypto();
  const { Address } = await import('warthog-js');
  const cleaned = raw.replace(/^0x/i, '').toLowerCase();

  if (cleaned.length === 48) {
    const valid = Address.fromHex(cleaned);
    if (valid) return valid.hex;
    const repaired = Address.fromRaw(cleaned.slice(0, 40));
    if (repaired) return repaired.hex;
    return null;
  }

  if (cleaned.length === 40) {
    const valid = Address.fromRaw(cleaned);
    if (valid) return valid.hex;
    return null;
  }

  return null;
}

/** Extract a displayable WART balance string from node balance payloads. */
export function parseWartBalanceFromApi(data) {
  if (!data || typeof data !== 'object') return null;

  if (typeof data.balance === 'string') return data.balance;

  const total = data.balance?.total ?? data.wart?.total;
  if (typeof total === 'string') return total;
  if (total && typeof total === 'object') {
    if (typeof total.str === 'string') return total.str;
    if (total.E8 != null) return (Number(total.E8) / 1e8).toString();
  }

  if (typeof data.balanceE8 === 'number') {
    return (data.balanceE8 / 1e8).toString();
  }

  return null;
}
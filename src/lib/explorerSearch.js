/**
 * Classify a free-form explorer search query.
 * @returns {{ kind: string, [key: string]: any }}
 */
export function classifyExplorerQuery(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { kind: 'empty' };

  const no0x = trimmed.replace(/^0x/i, '').trim();
  const compact = no0x.replace(/\s+/g, '');

  // Multi-height / range block search: "123 456" or "100-110"
  if (/[\s,]/.test(no0x) || (no0x.includes('-') && !/^[0-9a-fA-F]{40,}$/.test(compact))) {
    if (/^[\d\s,\-]+$/.test(no0x)) {
      return { kind: 'blocks', query: no0x };
    }
  }

  // Tx hash (64 hex)
  if (/^[0-9a-fA-F]{64}$/.test(compact)) {
    return { kind: 'tx', hash: compact.toLowerCase() };
  }

  // Full Warthog address (48 hex)
  if (/^[0-9a-fA-F]{48}$/.test(compact)) {
    return { kind: 'address', address: compact.toLowerCase() };
  }

  // Raw pubkey-ish (40 hex) — resolve/repair on the address page
  if (/^[0-9a-fA-F]{40}$/.test(compact)) {
    return { kind: 'address', address: compact.toLowerCase() };
  }

  // Single block height
  if (/^\d+$/.test(compact)) {
    const height = Number(compact);
    if (Number.isFinite(height) && height >= 1) {
      return { kind: 'block', height };
    }
  }

  return { kind: 'unknown', query: trimmed };
}

/** Parse "123 100-105" into sorted unique heights (capped). */
export function parseBlockHeightQuery(query, { max = 50 } = {}) {
  const items = [];
  const parts = String(query || '')
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Number(String(startStr).replace(/,/g, ''));
      const end = Number(String(endStr).replace(/,/g, ''));
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let h = start; h <= end && items.length < max; h++) {
          items.push(h);
        }
      }
    } else {
      const h = Number(String(part).replace(/,/g, ''));
      if (!Number.isNaN(h) && h >= 1 && items.length < max) {
        items.push(h);
      }
    }
  }

  return [...new Set(items)].sort((a, b) => b - a);
}

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
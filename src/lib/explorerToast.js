/** Lightweight toast bus for explorer copy / status feedback. */

const listeners = new Set();

/**
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info', duration?: number }} [opts]
 */
export function showToast(message, opts = {}) {
  const toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: String(message || ''),
    type: opts.type || 'success',
    duration: opts.duration ?? 2200,
  };
  listeners.forEach((fn) => {
    try {
      fn(toast);
    } catch {
      // ignore listener errors
    }
  });
  return toast.id;
}

/** @param {(toast: object) => void} fn */
export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Copy text and show a toast. Returns true on success.
 * @param {string} text
 * @param {string} [successMessage]
 */
export async function copyWithToast(text, successMessage = 'Copied') {
  const value = String(text ?? '');
  if (!value) {
    showToast('Nothing to copy', { type: 'error' });
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
    return true;
  } catch (err) {
    console.error('Clipboard write failed', err);
    showToast('Copy failed', { type: 'error' });
    return false;
  }
}

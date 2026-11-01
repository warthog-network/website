/** Ledger session clock and saved-account records. No private key is stored. */

export const LEDGER_RECORD_KIND = 'warthog-ledger-v1';
export const LEDGER_SESSION_KEY = 'warthogLedgerSession';
export const LEDGER_LOCK_KEY = 'warthogLedgerLock';
export const AUTO_LOCK_STORAGE_KEY = 'warthogAutoLockMinutes';
export const DEFAULT_AUTO_LOCK_MINUTES = 5;
export const AUTO_LOCK_CHOICES = [1, 5, 15, 30, 60];

export function normalizeAutoLockMinutes(value) {
  const n = Number(value);
  return AUTO_LOCK_CHOICES.includes(n) ? n : DEFAULT_AUTO_LOCK_MINUTES;
}

export function readAutoLockMinutes() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_AUTO_LOCK_MINUTES;
    return normalizeAutoLockMinutes(localStorage.getItem(AUTO_LOCK_STORAGE_KEY));
  } catch {
    return DEFAULT_AUTO_LOCK_MINUTES;
  }
}

export function writeAutoLockMinutes(value) {
  const minutes = normalizeAutoLockMinutes(value);
  localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes));
  return minutes;
}

/**
 * Last time the wallet page was open.
 * Falls back to the original unlock time for a session saved before this clock.
 */
export function ledgerLastActiveAt(session) {
  const active = Number(session?.lastActiveAt);
  if (Number.isFinite(active) && active > 0) return active;
  const opened = Number(session?.unlockedAt);
  if (Number.isFinite(opened) && opened > 0) return opened;
  return 0;
}

/**
 * True while the page was still open inside the auto-lock window.
 * The clock is the last time the wallet page was visible, not the original unlock.
 * A missing timestamp is expired.
 */
export function isLedgerSessionFresh(lastActiveAt, minutes, now = Date.now()) {
  const at = Number(lastActiveAt);
  const windowMs = normalizeAutoLockMinutes(minutes) * 60 * 1000;
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < windowMs;
}

export function sameWartAddress(a, b) {
  const left = String(a || '').replace(/^0x/i, '').trim().toLowerCase();
  const right = String(b || '').replace(/^0x/i, '').trim().toLowerCase();
  return Boolean(left) && left === right;
}

function shortHint(address) {
  const a = String(address || '').replace(/^0x/i, '');
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function parseLedgerRecord(raw) {
  if (raw == null || raw === '') return null;
  let obj;
  try {
    obj = JSON.parse(String(raw));
  } catch {
    return null;
  }
  if (!obj || obj.kind !== LEDGER_RECORD_KIND || obj.ledger !== true) return null;
  const address = String(obj.address || '').replace(/^0x/i, '').trim();
  if (!address) return null;
  const index = Number(obj.index);
  return {
    kind: LEDGER_RECORD_KIND,
    ledger: true,
    address,
    publicKey: String(obj.publicKey || ''),
    pathType: obj.pathType === 'non-hardened' ? 'non-hardened' : 'hardened',
    index: Number.isInteger(index) && index >= 0 && index <= 1000 ? index : 0,
    addressHint: obj.addressHint || shortHint(address),
  };
}

export function serializeLedgerRecord(data) {
  const address = String(data?.address || '').replace(/^0x/i, '').trim();
  if (!address) throw new Error('Ledger account has no address');
  const index = Number(data?.index);
  return JSON.stringify({
    v: 1,
    kind: LEDGER_RECORD_KIND,
    ledger: true,
    address,
    publicKey: String(data.publicKey || ''),
    pathType: data.pathType === 'non-hardened' ? 'non-hardened' : 'hardened',
    index: Number.isInteger(index) && index >= 0 && index <= 1000 ? index : 0,
    addressHint: shortHint(address),
  });
}

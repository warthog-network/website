/**
 * Website encrypted wallet files / named saves (CryptoJS AES).
 * Legacy format: AES-encrypt(JSON({ privateKey, publicKey, address }), password)
 * Multi-auth envelopes (password + passkey): kind warthog-wallet-v1 — same as extension.
 *
 * IMPORTANT: Do not change send/signing logic; this module is storage/auth only.
 */
import CryptoJS from 'crypto-js';
import {
  authBadgeForBlob,
  cleanupPasskeyStorage,
  getPasswordCipherFromBlob,
  inspectWalletBlob,
  tryParseEnvelope,
} from './passkeyWallet';

const NAMED_PREFIX = 'warthogWallet_';

export function encryptWallet(walletData, password) {
  const { privateKey, publicKey, address, mnemonic } = walletData;
  return CryptoJS.AES.encrypt(
    JSON.stringify({ privateKey, publicKey, address, mnemonic }),
    password,
  ).toString();
}

/**
 * Decrypt a raw password ciphertext only (no envelope unwrap).
 * Used by 2FA unlock and when you already extracted the password field.
 */
export function decryptPasswordCipher(cipher, password) {
  const bytes = CryptoJS.AES.decrypt(cipher, password);
  const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedStr) throw new Error('Invalid password');
  const parsed = JSON.parse(decryptedStr);
  if (!parsed?.privateKey || !parsed?.address) {
    throw new Error('Invalid wallet file');
  }
  return parsed;
}

/**
 * Decrypt a legacy AES blob or a multi-auth envelope password field.
 */
export function decryptWallet(encrypted, password) {
  const cipher = getPasswordCipherFromBlob(encrypted);
  if (!cipher) {
    throw new Error(
      'This wallet has no password unlock — use passkey, or re-save with a password',
    );
  }
  return decryptPasswordCipher(cipher, password);
}

export function getSavedWallets() {
  try {
    if (typeof localStorage === 'undefined') return [];
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(NAMED_PREFIX))
      .map((key) => key.slice(NAMED_PREFIX.length))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** Named wallets with auth badges for guided login. */
export function getSavedWalletEntries() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const entries = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(NAMED_PREFIX)) continue;
      const name = key.slice(NAMED_PREFIX.length);
      const raw = localStorage.getItem(key) || '';
      const info = inspectWalletBlob(raw);
      entries.push({
        name,
        hasPassword: info.hasPassword,
        hasPasskey: info.hasPasskey,
        require2fa: info.require2fa,
        badge: authBadgeForBlob(raw),
        addressHint: info.addressHint || '',
        raw,
      });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function loadNamedWalletEncrypted(name) {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(`${NAMED_PREFIX}${name}`);
}

export function storeNamedWalletEncrypted(name, encrypted) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Wallet name is required');
  localStorage.setItem(`${NAMED_PREFIX}${trimmed}`, encrypted);
}

export async function deleteNamedWallet(name) {
  const raw = loadNamedWalletEncrypted(name);
  if (raw) await cleanupPasskeyStorage(raw);
  localStorage.removeItem(`${NAMED_PREFIX}${name}`);
}

export {
  authBadgeForBlob,
  inspectWalletBlob,
  tryParseEnvelope,
};

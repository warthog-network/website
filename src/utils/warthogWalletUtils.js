import CryptoJS from 'crypto-js';

export const encryptWallet = (walletData, password) => {
  const { privateKey, publicKey, address } = walletData;
  return CryptoJS.AES.encrypt(JSON.stringify({ privateKey, publicKey, address }), password).toString();
};

export const decryptWallet = (encrypted, password) => {
  const bytes = CryptoJS.AES.decrypt(encrypted, password);
  const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedStr) throw new Error('Invalid password');
  return JSON.parse(decryptedStr);
};

export function getSavedWallets() {
  try {
    if (typeof localStorage === 'undefined') return [];
    return Object.keys(localStorage)
      .filter((key) => key.startsWith('warthogWallet_'))
      .map((key) => key.replace('warthogWallet_', ''))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
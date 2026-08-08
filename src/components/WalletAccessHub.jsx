/**
 * Guided wallet access hub — parity with extension startedPage + SecureSetup.
 * Password and/or WebAuthn passkey; optional 2FA (both).
 *
 * Isolated from WART send path: only calls onActivate(walletData, name|null).
 */
import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import {
  decryptPasswordCipher,
  decryptWallet,
  encryptWallet,
  getSavedWalletEntries,
  loadNamedWalletEncrypted,
  storeNamedWalletEncrypted,
} from '../utils/warthogWalletUtils';
import {
  buildEnvelopeWithPasskey,
  decryptWithPasskey,
  inspectWalletBlob,
  isWebAuthnAvailable,
  serializeEnvelope,
  setPasskeyProductName,
  unlockEnvelopeWith2fa,
} from '../utils/passkeyWallet';
import { clearPasskeyWaiting, paintPasskeyWaiting } from '../utils/passkeyUi';

setPasskeyProductName('Warthog Web Wallet');

/** @typedef {'hub'|'login'|'create'|'have'|'derive'|'import'|'load'|'secure'} AccessPath */
/** @typedef {'save'|'backup'} SecureStep */

function PathButton({ primary, label, meta, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`bunker-btn w-full text-left flex flex-col items-start gap-0.5 ${
        primary ? 'bunker-btn--primary' : ''
      }`}
      style={{ height: 'auto', minHeight: '2.75rem', padding: '0.65rem 1rem' }}
    >
      <span className="font-semibold text-sm">{label}</span>
      {meta ? <span className="text-xs opacity-80 font-normal">{meta}</span> : null}
    </button>
  );
}

async function generateWallet(wordCount, pathType) {
  const strengthBytes = wordCount === 12 ? 16 : 32;
  const entropy = window.crypto.getRandomValues(new Uint8Array(strengthBytes));
  const mnemonicObj = ethers.Mnemonic.fromEntropy(ethers.hexlify(entropy));
  const mnemonic = mnemonicObj.phrase;
  const path = pathType === 'hardened' ? "m/44'/2070'/0'/0/0" : "m/44'/2070'/0/0/0";
  const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', path);
  const publicKey = hdWallet.publicKey.slice(2);
  const sha = ethers.sha256('0x' + publicKey).slice(2);
  const ripemd = ethers.ripemd160('0x' + sha).slice(2);
  const checksum = ethers.sha256('0x' + ripemd).slice(2, 10);
  const address = ripemd + checksum;
  return {
    mnemonic,
    wordCount,
    pathType,
    privateKey: hdWallet.privateKey.slice(2),
    publicKey,
    address,
  };
}

function deriveWallet(mnemonic, wordCount, pathType) {
  const words = mnemonic.trim().split(/\s+/);
  const expectedWordCount = Number(wordCount);
  if (words.length !== expectedWordCount) {
    throw new Error(`Invalid mnemonic: must have exactly ${expectedWordCount} words`);
  }
  const path = pathType === 'hardened' ? "m/44'/2070'/0'/0/0" : "m/44'/2070'/0/0/0";
  const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', path);
  const publicKey = hdWallet.publicKey.slice(2);
  const sha = ethers.sha256('0x' + publicKey).slice(2);
  const ripemd = ethers.ripemd160('0x' + sha).slice(2);
  const checksum = ethers.sha256('0x' + ripemd).slice(2, 10);
  const address = ripemd + checksum;
  return {
    mnemonic: mnemonic.trim(),
    wordCount: expectedWordCount,
    pathType,
    privateKey: hdWallet.privateKey.slice(2),
    publicKey,
    address,
  };
}

function importFromPrivateKey(privKey) {
  const clean = String(privKey || '').replace(/\s/g, '').replace(/^0x/i, '');
  if (clean.length !== 64) throw new Error('Private key must be exactly 64 characters long');
  if (!/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error('Private key must consist of hexadecimal characters only');
  }
  const signer = new ethers.Wallet('0x' + clean);
  const publicKey = signer.signingKey.compressedPublicKey.slice(2);
  const sha = ethers.sha256('0x' + publicKey).slice(2);
  const ripemd = ethers.ripemd160('0x' + sha).slice(2);
  const checksum = ethers.sha256('0x' + ripemd).slice(2, 10);
  const address = ripemd + checksum;
  return { privateKey: clean, publicKey, address };
}

/**
 * @param {{ onActivate: (data: object, name: string|null) => void }} props
 */
export default function WalletAccessHub({ onActivate }) {
  const [path, setPath] = useState(/** @type {AccessPath} */ ('hub'));
  const [secureStep, setSecureStep] = useState(/** @type {SecureStep} */ ('save'));
  const [entries, setEntries] = useState(() => getSavedWalletEntries());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [awaitingPasskey, setAwaitingPasskey] = useState(false);
  const [passkeysSupported, setPasskeysSupported] = useState(false);

  const [walletName, setWalletName] = useState('');
  const [wordCount, setWordCount] = useState('12');
  const [pathType, setPathType] = useState('hardened');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enablePasskey, setEnablePasskey] = useState(false);
  const [require2fa, setRequire2fa] = useState(false);
  const [consentBackup, setConsentBackup] = useState(false);
  const [pendingWallet, setPendingWallet] = useState(null);
  const [secureOrigin, setSecureOrigin] = useState('create');

  const [selectedName, setSelectedName] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  const hasSaved = entries.length > 0;
  const selectedEntry = entries.find((e) => e.name === selectedName) || null;

  const refreshEntries = () => setEntries(getSavedWalletEntries());

  useEffect(() => {
    const ok = isWebAuthnAvailable();
    setPasskeysSupported(ok);
    setEnablePasskey(ok);
  }, []);

  useEffect(() => {
    if (path === 'hub' || path === 'login') refreshEntries();
  }, [path]);

  const goPath = (next) => {
    setError(null);
    setPath(next);
    if (next === 'secure') setSecureStep('save');
  };

  const pathTitle = {
    hub: hasSaved ? 'Welcome back' : 'Get started',
    login: 'Unlock wallet',
    create: 'Create wallet',
    have: 'I already have a wallet',
    derive: 'Seed phrase',
    import: 'Private key',
    load: 'Wallet file',
    secure: secureStep === 'save' ? 'Unlock options' : 'Backup seed',
  };

  const pathHint = {
    hub: hasSaved
      ? 'Unlock with passkey or password, or start another path.'
      : 'Create with passkey (password manager or this device; optional password / 2FA).',
    login: 'Choose a saved wallet, then unlock with passkey or password.',
    create: 'Name the wallet first. Then unlock options, then write down your seed.',
    have: 'Restore from seed, private key, encrypted file, or a saved browser wallet.',
    derive: 'Enter your 12 or 24-word seed phrase.',
    import: 'Paste the 64-character private key.',
    load: 'Upload warthog_wallet.txt and enter its password.',
    secure:
      secureStep === 'save'
        ? 'Enable passkey and/or set a password for next login.'
        : 'Write down your seed / private key before continuing.',
  };

  const showBack = path !== 'hub';
  const backTarget =
    path === 'secure'
      ? 'hub'
      : ['derive', 'import', 'load'].includes(path)
        ? 'have'
        : path === 'login' || path === 'create' || path === 'have'
          ? 'hub'
          : 'hub';

  const beginSecure = (data, origin, nameHint) => {
    setPendingWallet(data);
    setSecureOrigin(origin);
    if (nameHint) setWalletName(nameHint);
    setSecureStep('save');
    setPassword('');
    setConfirmPassword('');
    setRequire2fa(false);
    setConsentBackup(false);
    setEnablePasskey(passkeysSupported);
    goPath('secure');
  };

  const handleCreate = async () => {
    setError(null);
    const name = walletName.trim();
    if (!name) {
      setError('Enter a wallet name first');
      return;
    }
    setBusy(true);
    try {
      const data = await generateWallet(Number(wordCount), pathType);
      beginSecure(data, 'create', name);
    } catch (e) {
      setError(e?.message || 'Failed to create wallet');
    } finally {
      setBusy(false);
    }
  };

  const handleDerive = () => {
    setError(null);
    setBusy(true);
    try {
      const data = deriveWallet(mnemonic, Number(wordCount), pathType);
      beginSecure(data, 'restore', walletName.trim() || 'restored');
    } catch (e) {
      setError(e?.message || 'Invalid seed phrase');
    } finally {
      setBusy(false);
    }
  };

  const handleImportKey = () => {
    setError(null);
    setBusy(true);
    try {
      const data = importFromPrivateKey(privateKey);
      beginSecure(data, 'restore', walletName.trim() || 'imported');
    } catch (e) {
      setError(e?.message || 'Invalid private key');
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setUploadedFile(e.target?.result || null);
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const handleFileLogin = () => {
    setError(null);
    if (!uploadedFile) {
      setError('Please upload the warthog_wallet.txt file');
      return;
    }
    if (!password) {
      setError('Please provide a password');
      return;
    }
    try {
      const data = decryptWallet(uploadedFile, password);
      onActivate(data, null);
    } catch (e) {
      setError(e?.message === 'Invalid password' ? 'Invalid password' : e?.message || 'Unlock failed');
    }
  };

  const canPasswordUnlock =
    selectedEntry &&
    selectedEntry.hasPassword &&
    !selectedEntry.require2fa &&
    Boolean(password);

  const canPasskeyUnlock =
    selectedEntry && selectedEntry.hasPasskey && passkeysSupported;

  const can2fa =
    selectedEntry?.require2fa &&
    selectedEntry.hasPasskey &&
    passkeysSupported &&
    Boolean(password);

  const unlockPassword = async () => {
    setError(null);
    if (!selectedName) {
      setError('Select a saved wallet');
      return;
    }
    if (!password) {
      setError('Enter password');
      return;
    }
    setBusy(true);
    try {
      const raw = loadNamedWalletEncrypted(selectedName);
      if (!raw) throw new Error('Selected wallet not found');
      const info = inspectWalletBlob(raw);
      if (info.require2fa) {
        throw new Error('2FA wallet: enter password, then unlock with password + passkey');
      }
      const data = decryptWallet(raw, password);
      onActivate(data, selectedName);
    } catch (e) {
      setError(e?.message === 'Invalid password' ? 'Invalid password' : e?.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  const unlockPasskey = async (withPassword) => {
    setError(null);
    if (!selectedName) {
      setError('Select a saved wallet');
      return;
    }
    if (!passkeysSupported) {
      setError('Passkeys are not available in this browser');
      return;
    }
    if (withPassword && !password) {
      setError('Enter password, then confirm with passkey');
      return;
    }
    setBusy(true);
    try {
      await paintPasskeyWaiting(setAwaitingPasskey);
      const raw = loadNamedWalletEncrypted(selectedName);
      if (!raw) throw new Error('Selected wallet not found');
      const info = inspectWalletBlob(raw);
      if (!info.hasPasskey || !info.envelope?.passkey) {
        throw new Error('This wallet has no passkey unlock — use password, or re-enable passkey after unlock');
      }
      let data;
      if (info.require2fa || withPassword) {
        if (!password) throw new Error('Password is required for 2FA unlock');
        data = await unlockEnvelopeWith2fa(info.envelope, password, decryptPasswordCipher);
      } else {
        data = await decryptWithPasskey(info.envelope.passkey);
      }
      onActivate(data, selectedName);
    } catch (e) {
      setError(e?.message || 'Passkey unlock failed');
    } finally {
      clearPasskeyWaiting(setAwaitingPasskey);
      setBusy(false);
    }
  };

  const persistEnvelopeOrLegacy = async (data, name, opts) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Wallet name is required');
    const wantPasskey = Boolean(opts.withPasskey && passkeysSupported);
    const pwd = (opts.password || '').trim();
    const require2fa = Boolean(opts.require2fa);
    if (!pwd && !wantPasskey) throw new Error('Password or passkey required to save');
    if (require2fa && (!pwd || !wantPasskey)) {
      throw new Error('2FA needs both a password and passkey');
    }

    if (wantPasskey) {
      const passwordCipher = pwd ? encryptWallet(data, pwd) : null;
      const { envelope } = await buildEnvelopeWithPasskey(data, {
        displayName: trimmed,
        passwordCipher,
        require2fa: require2fa && Boolean(passwordCipher),
      });
      if (require2fa && pwd) {
        envelope.password = encryptWallet(data, pwd);
        envelope.require2fa = true;
      }
      storeNamedWalletEncrypted(trimmed, serializeEnvelope(envelope));
    } else {
      storeNamedWalletEncrypted(trimmed, encryptWallet(data, pwd));
    }
    refreshEntries();
    return trimmed;
  };

  const continueSecureToBackup = () => {
    setError(null);
    const name = walletName.trim();
    if (!name) {
      setError('Enter a wallet name first');
      return;
    }
    const wantPasskey = enablePasskey && passkeysSupported;
    const wantPassword = Boolean(password);
    if (!wantPasskey && !wantPassword) {
      setError('Enable passkey and/or set a password for next login');
      return;
    }
    if (wantPassword && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (require2fa && (!wantPassword || !wantPasskey)) {
      setError('2FA needs both a password and passkey');
      return;
    }
    setSecureStep('backup');
  };

  const finishSecureSave = async (sessionOnly) => {
    setError(null);
    if (!pendingWallet) {
      setError('No wallet to save');
      return;
    }
    if (!consentBackup) {
      setError('Confirm you have saved the seed / private key securely');
      return;
    }
    setBusy(true);
    try {
      if (sessionOnly) {
        onActivate(pendingWallet, null);
        return;
      }
      await paintPasskeyWaiting(setAwaitingPasskey);
      const name = await persistEnvelopeOrLegacy(pendingWallet, walletName, {
        withPasskey: enablePasskey && passkeysSupported,
        password,
        require2fa,
      });
      onActivate(pendingWallet, name);
    } catch (e) {
      setError(e?.message || 'Failed to save wallet');
    } finally {
      clearPasskeyWaiting(setAwaitingPasskey);
      setBusy(false);
    }
  };

  return (
    <div className="bunker-panel">
      <div className="mb-4">
        {showBack ? (
          <button
            type="button"
            className="bunker-btn bunker-btn--ghost mb-2 text-sm"
            onClick={() => {
              if (path === 'secure' && secureStep === 'backup') {
                setSecureStep('save');
                setError(null);
                return;
              }
              goPath(backTarget);
            }}
            disabled={busy || awaitingPasskey}
          >
            ← Back
          </button>
        ) : (
          <p className="text-xs uppercase tracking-wide bunker-muted mb-1">Web wallet</p>
        )}
        <h2 className="bunker-heading" style={{ marginBottom: '0.35rem' }}>
          {pathTitle[path]}
        </h2>
        <p className="bunker-text bunker-muted text-sm leading-relaxed">{pathHint[path]}</p>
      </div>

      {path === 'hub' && (
        <div className="flex flex-col gap-2.5">
          {hasSaved && (
            <PathButton
              primary
              label="Unlock saved wallet"
              meta={`${entries.length} in this browser${
                entries.some((e) => e.hasPasskey) ? ' · passkey ready' : ''
              }`}
              onClick={() => goPath('login')}
            />
          )}
          <PathButton
            primary={!hasSaved}
            label="Create new wallet"
            meta="Name → unlock options → seed"
            onClick={() => goPath('create')}
          />
          <PathButton
            label={hasSaved ? 'Other restore options' : 'I already have a wallet'}
            meta="Seed, key, or file"
            onClick={() => goPath('have')}
          />
        </div>
      )}

      {path === 'have' && (
        <div className="flex flex-col gap-2.5">
          {hasSaved && (
            <PathButton
              label="Saved in this browser"
              meta={`${entries.length} wallet${entries.length === 1 ? '' : 's'}`}
              onClick={() => goPath('login')}
            />
          )}
          <PathButton label="Seed phrase" meta="12 or 24 words" onClick={() => goPath('derive')} />
          <PathButton label="Private key" meta="64-character hex" onClick={() => goPath('import')} />
          <PathButton label="Encrypted file" meta="warthog_wallet.txt" onClick={() => goPath('load')} />
        </div>
      )}

      {path === 'create' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs bunker-muted">
            Step 1 of 3 — pick a name. Next: passkey/password, then write down your seed.
          </p>
          <div>
            <label className="bunker-label">Wallet name</label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. main"
              autoComplete="off"
              className="bunker-input"
            />
          </div>
          <div>
            <label className="bunker-label">Word count</label>
            <select
              value={wordCount}
              onChange={(e) => setWordCount(e.target.value)}
              className="bunker-input"
            >
              <option value="12">12 words</option>
              <option value="24">24 words</option>
            </select>
          </div>
          <div>
            <label className="bunker-label">Path</label>
            <select
              value={pathType}
              onChange={(e) => setPathType(e.target.value)}
              className="bunker-input"
            >
              <option value="hardened">Hardened BIP44</option>
              <option value="non-hardened">Legacy / non-hardened</option>
            </select>
          </div>
          <button
            type="button"
            className="bunker-btn bunker-btn--primary"
            disabled={busy || !walletName.trim()}
            onClick={() => void handleCreate()}
          >
            {busy ? 'Generating…' : 'Continue — unlock options'}
          </button>
        </div>
      )}

      {path === 'derive' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="bunker-label">Seed phrase</label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="12 or 24 words"
              rows={3}
              autoComplete="off"
              spellCheck={false}
              className="bunker-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="bunker-label">Words</label>
              <select
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value)}
                className="bunker-input"
              >
                <option value="12">12</option>
                <option value="24">24</option>
              </select>
            </div>
            <div>
              <label className="bunker-label">Path</label>
              <select
                value={pathType}
                onChange={(e) => setPathType(e.target.value)}
                className="bunker-input"
              >
                <option value="hardened">BIP44</option>
                <option value="non-hardened">Legacy</option>
              </select>
            </div>
          </div>
          <div>
            <label className="bunker-label">Wallet name (optional)</label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. restored"
              className="bunker-input"
            />
          </div>
          <button
            type="button"
            className="bunker-btn bunker-btn--primary"
            disabled={busy || !mnemonic.trim()}
            onClick={handleDerive}
          >
            {busy ? 'Working…' : 'Recover wallet'}
          </button>
        </div>
      )}

      {path === 'import' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="bunker-label">Private key</label>
            <input
              type="text"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value.trim())}
              placeholder="64 hex characters"
              className="bunker-input"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="bunker-label">Wallet name (optional)</label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. imported"
              className="bunker-input"
            />
          </div>
          <button
            type="button"
            className="bunker-btn bunker-btn--primary"
            disabled={busy || !privateKey}
            onClick={handleImportKey}
          >
            {busy ? 'Working…' : 'Import key'}
          </button>
        </div>
      )}

      {path === 'load' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="bunker-label">Upload wallet file</label>
            <input type="file" accept=".txt" onChange={handleFileUpload} className="bunker-input" />
          </div>
          <div>
            <label className="bunker-label">Password</label>
            <div className="bunker-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to decrypt"
                className="bunker-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="bunker-input-toggle"
              >
                {showPassword ? 'hide' : 'show'}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="bunker-btn bunker-btn--primary"
            disabled={busy || !uploadedFile || !password}
            onClick={handleFileLogin}
          >
            Unlock file
          </button>
        </div>
      )}

      {path === 'login' && (
        <div className="flex flex-col gap-3">
          {entries.length === 0 ? (
            <p className="text-sm bunker-muted">No saved wallets yet. Create one from the hub.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entries.map((entry) => {
                const isSelected = selectedName === entry.name;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => {
                      setSelectedName(entry.name);
                      setError(null);
                      setPassword('');
                    }}
                    className={`saved-wallet-card${isSelected ? ' saved-wallet-card--selected' : ''}`}
                    aria-pressed={isSelected}
                  >
                    <div className="min-w-0 flex-1 text-left">
                      <div className="saved-wallet-card__name">{entry.name}</div>
                      <div className="saved-wallet-card__meta">
                        {entry.badge}
                        {entry.addressHint ? ` · ${entry.addressHint}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedEntry && (
            <>
              <p className="text-xs bunker-muted">
                {selectedEntry.require2fa
                  ? '2FA: enter password, then confirm with passkey.'
                  : selectedEntry.hasPasskey
                    ? 'Tap Unlock with passkey, or use password if you set one.'
                    : 'Enter the password for this saved wallet.'}
              </p>
              {(selectedEntry.hasPassword || selectedEntry.require2fa) && (
                <div>
                  <label className="bunker-label">Password</label>
                  <div className="bunker-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        selectedEntry.require2fa
                          ? 'Enter password'
                          : selectedEntry.hasPassword
                            ? 'Enter password'
                            : 'No password on this wallet'
                      }
                      className="bunker-input"
                      autoComplete="current-password"
                      disabled={!selectedEntry.hasPassword && !selectedEntry.require2fa}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="bunker-input-toggle"
                    >
                      {showPassword ? 'hide' : 'show'}
                    </button>
                  </div>
                </div>
              )}

              {selectedEntry.require2fa ? (
                <button
                  type="button"
                  className="bunker-btn bunker-btn--primary"
                  disabled={busy || !can2fa}
                  onClick={() => void unlockPasskey(true)}
                >
                  {awaitingPasskey ? 'Waiting for passkey…' : 'Unlock with password + passkey'}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {canPasskeyUnlock && (
                    <button
                      type="button"
                      className="bunker-btn bunker-btn--primary"
                      disabled={busy}
                      onClick={() => void unlockPasskey(false)}
                    >
                      {awaitingPasskey ? 'Waiting for passkey…' : 'Unlock with passkey'}
                    </button>
                  )}
                  {selectedEntry.hasPassword && (
                    <button
                      type="button"
                      className="bunker-btn"
                      disabled={busy || !canPasswordUnlock}
                      onClick={() => void unlockPassword()}
                    >
                      Unlock with password
                    </button>
                  )}
                  {selectedEntry.hasPasskey && selectedEntry.hasPassword && (
                    <button
                      type="button"
                      className="bunker-btn bunker-btn--ghost"
                      disabled={busy || !password || !passkeysSupported}
                      onClick={() => void unlockPasskey(true)}
                    >
                      Unlock with password + passkey
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {path === 'secure' && pendingWallet && secureStep === 'save' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs bunker-muted">
            {secureOrigin === 'create' ? 'Step 2 of 3' : 'Secure this restore'} — set name and unlock
            methods.
          </p>
          <div>
            <label className="bunker-label">Wallet name</label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              className="bunker-input"
              autoComplete="off"
            />
          </div>
          {passkeysSupported && (
            <label className="bunker-check-label">
              <input
                type="checkbox"
                className="bunker-checkbox"
                checked={enablePasskey}
                onChange={(e) => {
                  setEnablePasskey(e.target.checked);
                  if (!e.target.checked) setRequire2fa(false);
                }}
              />
              <span>Enable passkey unlock (fingerprint / password manager / this device)</span>
            </label>
          )}
          <div>
            <label className="bunker-label">
              {enablePasskey && passkeysSupported
                ? 'Password (optional if passkey is on)'
                : 'Password'}
            </label>
            <div className="bunker-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bunker-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="bunker-input-toggle"
              >
                {showPassword ? 'hide' : 'show'}
              </button>
            </div>
          </div>
          <div>
            <label className="bunker-label">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bunker-input"
              autoComplete="new-password"
            />
          </div>
          {enablePasskey && passkeysSupported && password && (
            <label className="bunker-check-label">
              <input
                type="checkbox"
                className="bunker-checkbox"
                checked={require2fa}
                onChange={(e) => setRequire2fa(e.target.checked)}
              />
              <span>Require both password and passkey (2FA)</span>
            </label>
          )}
          <button
            type="button"
            className="bunker-btn bunker-btn--primary"
            disabled={busy}
            onClick={continueSecureToBackup}
          >
            Continue — write down seed
          </button>
        </div>
      )}

      {path === 'secure' && pendingWallet && secureStep === 'backup' && (
        <div className="flex flex-col gap-3">
          <p className="bunker-warning text-sm">
            Write down your seed phrase (if any) and private key on paper. Do not share them.
          </p>
          {pendingWallet.mnemonic && (
            <div>
              <strong className="bunker-label">Seed phrase</strong>
              <p className="bunker-seed-phrase">
                <span>{pendingWallet.mnemonic}</span>
              </p>
            </div>
          )}
          <div>
            <strong className="bunker-label">Private key</strong>
            <p className="bunker-text" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {pendingWallet.privateKey}
            </p>
          </div>
          <div>
            <strong className="bunker-label">Address</strong>
            <p className="bunker-text" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {pendingWallet.address}
            </p>
          </div>
          <label className="bunker-check-label">
            <input
              type="checkbox"
              className="bunker-checkbox"
              checked={consentBackup}
              onChange={(e) => setConsentBackup(e.target.checked)}
            />
            <span>I have saved the seed / private key securely</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="bunker-btn bunker-btn--primary"
              disabled={busy || !consentBackup}
              onClick={() => void finishSecureSave(false)}
            >
              {awaitingPasskey
                ? 'Waiting for passkey…'
                : enablePasskey && passkeysSupported
                  ? 'Save with passkey & open'
                  : 'Save & open'}
            </button>
            <button
              type="button"
              className="bunker-btn bunker-btn--ghost"
              disabled={busy || !consentBackup}
              onClick={() => void finishSecureSave(true)}
            >
              Use session only (not saved)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bunker-alert bunker-alert--error mt-4">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import TransactionHistory from './TransactionHistory';
import WalletOverviewCard from './WalletOverviewCard.jsx';
import WalletQrExportModal from './WalletQrExportModal.jsx';
import { buildNodeList, resolveNodeUrl } from '../lib/nodesCache';
import {
  ADD_CUSTOM_KEY,
  OFFICIAL1_KEY,
  loadSavedCustomNodes,
  normalizeSelectedNode,
  saveCustomNode,
} from '../lib/explorerNodes.js';
import {
  encryptWallet,
  decryptWallet,
  getSavedWallets,
  getSavedWalletEntries,
  loadNamedWalletEncrypted,
  saveNamedWalletBlob,
  inspectNamedBlob,
} from '../utils/warthogWalletUtils';
import {
  isWebAuthnAvailable,
  buildEnvelopeWithPasskey,
  decryptWithPasskey,
  unlockEnvelopeWith2fa,
  serializeEnvelope,
  tryParseEnvelope,
  envelopeWithPassword,
  passkeyLabel,
} from '../utils/passkeyWallet.js';
import { paintPasskeyWaiting, clearPasskeyWaiting } from '../utils/passkeyUi.js';
import { formatWartUsdBalance } from '../lib/wartPrice.js';
import BunkerShell from './BunkerShell.jsx';
import WalletContactsModal from './WalletContactsModal.jsx';
import WalletAccessHub from './WalletAccessHub.jsx';
import { recordContactUsage } from '../utils/walletContacts';

const API_URL = '/api/proxy';

const Wallet = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [consentToClose, setConsentToClose] = useState(false);
  const [validateResult, setValidateResult] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [nextNonce, setNextNonce] = useState(null); // Renamed from nonceId for clarity
  const [pinHeight, setPinHeight] = useState(null);
  const [pinHash, setPinHash] = useState(null);
  const [mnemonic, setMnemonic] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [address, setAddress] = useState('');
  const [toAddr, setToAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0.01');
  const [nonceInput, setNonceInput] = useState(''); // New: for manual nonce input
  const [wordCount, setWordCount] = useState('12');
  const [pathType, setPathType] = useState('hardened');
  const [walletAction, setWalletAction] = useState('create');
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [saveWalletConsent, setSaveWalletConsent] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isWalletProcessed, setIsWalletProcessed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nodeList, setNodeList] = useState([]);
  const [nodesLoading, setNodesLoading] = useState(true);
  const [nodesError, setNodesError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(OFFICIAL1_KEY);
  const [customIP, setCustomIP] = useState('localhost');
  const [customPort, setCustomPort] = useState('3000');
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const [sending, setSending] = useState(false); // New: to disable button during send
  const [failedTransactions, setFailedTransactions] = useState([]); // New: to log failed transactions
  const [sentTransactions, setSentTransactions] = useState([]);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [showDownloadPassword, setShowDownloadPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [copiedTxId, setCopiedTxId] = useState(null); // New: to track copied Tx ID for feedback
  const [copiedToAddr, setCopiedToAddr] = useState(null); // New: to track copied To Address for feedback
  const [copiedFromAddr, setCopiedFromAddr] = useState(null); // New: to track copied From Address for feedback
  const [downloadPassword, setDownloadPassword] = useState('');
  const [confirmDownloadPassword, setConfirmDownloadPassword] = useState('');
  const [showConfirmDownloadPassword, setShowConfirmDownloadPassword] = useState(false);
  const [isSmallScreen767, setIsSmallScreen767] = useState(false);
  const [isSmallScreen795, setIsSmallScreen795] = useState(false);
  const [blockCounts, setBlockCounts] = useState({ '24h': 0, week: 0, month: 0, rewards24h: [], rewardsWeek: [], rewardsMonth: [] });
  const [showTooltip24h, setShowTooltip24h] = useState(false);
  const [showTooltipWeek, setShowTooltipWeek] = useState(false);
  const [showTooltipMonth, setShowTooltipMonth] = useState(false);
  const [scrollToTxid, setScrollToTxid] = useState(null);
  const [timeoutId24h, setTimeoutId24h] = useState(null);
  const [timeoutIdWeek, setTimeoutIdWeek] = useState(null);
  const [timeoutIdMonth, setTimeoutIdMonth] = useState(null);
  const [refreshHistory, setRefreshHistory] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [usdBalance, setUsdBalance] = useState(null);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contactsModalMode, setContactsModalMode] = useState('manage');
  const [showWalletExportQr, setShowWalletExportQr] = useState(false);
  const [currentWalletName, setCurrentWalletName] = useState(null);
  const [selectedSavedWallet, setSelectedSavedWallet] = useState('');
  const [walletName, setWalletName] = useState('');
  const [savedWalletList, setSavedWalletList] = useState(() => getSavedWallets());
  const [savedWalletEntries, setSavedWalletEntries] = useState(() => getSavedWalletEntries());
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [namePromptDismissed, setNamePromptDismissed] = useState(false);
  const [promptWalletName, setPromptWalletName] = useState('');
  const [promptPassword, setPromptPassword] = useState('');
  const [promptConfirmPassword, setPromptConfirmPassword] = useState('');
  const [promptError, setPromptError] = useState(null);
  const [showPromptPassword, setShowPromptPassword] = useState(false);
  const [showPromptConfirmPassword, setShowPromptConfirmPassword] = useState(false);

  // Passkey / 2FA (wartbunker parity)
  const [passkeysSupported] = useState(() =>
    typeof window !== 'undefined' ? isWebAuthnAvailable() : false,
  );
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [enablePasskeyOnSave, setEnablePasskeyOnSave] = useState(false);
  const [require2faOnSave, setRequire2faOnSave] = useState(false);
  const [enablePasskeyOnPrompt, setEnablePasskeyOnPrompt] = useState(false);
  const [require2faOnPrompt, setRequire2faOnPrompt] = useState(false);
  const [sessionHasPasskey, setSessionHasPasskey] = useState(false);
  const [sessionRequire2fa, setSessionRequire2fa] = useState(false);
  const [sessionHasPassword, setSessionHasPassword] = useState(false);
  const [toolsWant2fa, setToolsWant2fa] = useState(false);
  const [toolsPasskeyPassword, setToolsPasskeyPassword] = useState('');
  const [toolsSecurityMsg, setToolsSecurityMsg] = useState(null);
  const fpLabel = passkeyLabel(false);

  // Load node list + restore selection (shared with explorer)
  useEffect(() => {
    setNodesLoading(true);
    setNodesError(null);
    try {
      const list = buildNodeList();
      setNodeList(list);

      const rawSelected = localStorage.getItem('selectedNode');
      let next = normalizeSelectedNode(rawSelected);
      const savedIP = localStorage.getItem('customIP');
      const savedPort = localStorage.getItem('customPort');
      if (savedIP) setCustomIP(savedIP);
      if (savedPort) setCustomPort(savedPort);

      // Promote a free-form URL into the saved list so it appears in the select
      if (/^https?:\/\//i.test(next)) {
        const saved = loadSavedCustomNodes();
        if (!saved.some((n) => n.url === next)) {
          try {
            localStorage.setItem(
              'savedCustomNodes',
              JSON.stringify([{ url: next, label: next.replace(/^https?:\/\//, '') }, ...saved]),
            );
          } catch {
            // ignore
          }
          setNodeList(buildNodeList());
        }
        try {
          const u = new URL(next);
          setCustomIP(u.hostname);
          setCustomPort(u.port || (u.protocol === 'https:' ? '443' : '3000'));
        } catch {
          // ignore
        }
      }

      setSelectedNode(next);
      localStorage.setItem('selectedNode', next);
    } catch (err) {
      setNodesError(err?.message || 'Failed to load nodes');
    } finally {
      setNodesLoading(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('customIP', customIP);
    localStorage.setItem('customPort', customPort);
  }, [customIP, customPort]);

  const handleSaveCustomNode = () => {
    try {
      const url = saveCustomNode(customIP, customPort);
      setNodeList(buildNodeList());
      setSelectedNode(url);
      localStorage.setItem('selectedNode', url);
    } catch (err) {
      setNodesError(err?.message || 'Could not save custom node');
    }
  };

  const abbreviate = (str) => str ? `${str.slice(0,6)}...${str.slice(-4)}` : 'N/A';

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen767(window.innerWidth < 767);
      setIsSmallScreen795(window.innerWidth < 795);
    };
    handleResize(); // Set initial value on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle app installed event
  useEffect(() => {
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const encryptedWallet = localStorage.getItem('warthogWallet');
    if (encryptedWallet) {
      setShowPasswordPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && wallet && !currentWalletName && !namePromptDismissed) {
      setShowNamePrompt(true);
    } else if (!isLoggedIn || currentWalletName) {
      setShowNamePrompt(false);
    }
  }, [isLoggedIn, wallet, currentWalletName, namePromptDismissed]);

  useEffect(() => {
    if (selectedNode === ADD_CUSTOM_KEY) return;
    const nodeUrl = resolveNodeUrl(selectedNode);
    if (wallet?.address && nodeUrl) {
      console.log('Fetching balance for address:', wallet.address);
      fetchBalanceAndNonce(wallet.address);
      const balanceInterval = setInterval(() => fetchBalanceAndNonce(wallet.address), 30000);
      return () => clearInterval(balanceInterval);
    }
  }, [wallet, selectedNode]);

  // Poll for transaction history update every 30 seconds
  useEffect(() => {
    if (selectedNode === ADD_CUSTOM_KEY) return;
    if (wallet?.address) {
      const historyInterval = setInterval(() => {
        setRefreshHistory(prev => !prev);
      }, 30000);
      return () => clearInterval(historyInterval);
    }
  }, [wallet, selectedNode]);

  useEffect(() => {
    if (showModal) {
      window.alert("If you haven't backed up the information elsewhere, do not close the next window without saving or downloading your private key.");
    }
  }, [showModal]);

  // Poll for pending tx status every 30 seconds if there are pending txs
  useEffect(() => {
    if (sentTransactions.length > 0 && wallet?.address) {
      const interval = setInterval(() => {
        updateTxStatuses();
      }, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [sentTransactions, wallet, selectedNode]);

  // PWA update logic — WalletLayout registers /webwallet/sw.js; attach listeners here
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Remove legacy root-scoped SW that intercepted all assets (e.g. /images/*.svg)
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        const script = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
        if (script.endsWith('/sw.js') && !script.includes('/webwallet/')) {
          reg.unregister();
        }
      });
    });

    navigator.serviceWorker
      .register('/webwallet/sw.js', { scope: '/webwallet/' })
      .then((reg) => {
        setRegistration(reg);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      registration.waiting.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') {
          window.location.reload();
        }
      });
    }
  };

  const wartToE8 = (wart) => {
    try {
      const num = parseFloat(wart);
      if (isNaN(num) || num <= 0) return null;
      return Math.round(num * 100000000);
    } catch {
      return null;
    }
  };

  // ==================== FIXED fetchBalanceAndNonce (only change) ====================
  const fetchBalanceAndNonce = async (address) => {
    const nodeUrl = resolveNodeUrl(selectedNode);
    if (!nodeUrl) return null;

    // Read the latest optimistic nonce from localStorage (survives page reload / login)
    let persistentNonce = 0;
    if (address) {
      const stored = localStorage.getItem(`warthogNextNonce_${address}`);
      if (stored) persistentNonce = Number(stored);
    }

    try {
      const nodeBaseParam = `nodeBase=${encodeURIComponent(nodeUrl)}`;
      console.log('Sending chain head request to:', `${API_URL}?nodePath=chain/head&${nodeBaseParam}`);
      const chainHeadResponse = await axios.get(`${API_URL}?nodePath=chain/head&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
      console.log('Chain head response status:', chainHeadResponse.status);
      const chainHeadRaw = chainHeadResponse.data.data || chainHeadResponse.data;
      // Mainnet: flat pinHash/pinHeight; DeFi nodes: nested under chainHead
      const chainHeadData = chainHeadRaw?.chainHead || chainHeadRaw;
      console.log('Chain head response data:', chainHeadData);

      console.log('Sending balance request to:', `${API_URL}?nodePath=account/${address}/balance&${nodeBaseParam}`);
      const balanceResponse = await axios.get(`${API_URL}?nodePath=account/${address}/balance&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Balance response status:', balanceResponse.status);
      const balanceData = balanceResponse.data.data || balanceResponse.data;
      console.log('Balance response data:', balanceData);

      const fetchedNonce = Number(balanceData.nonceId) || 0;

      // FIXED: always keep the highest value (persistent localStorage + on-chain + current React state)
      const newNextNonce = Math.max(persistentNonce, fetchedNonce, nextNonce || 0);

      const balanceInWart = balanceData.balance !== undefined
        ? Number(balanceData.balance).toFixed(8)
        : '0';
      setBalance(balanceInWart);

      // USD via CoinGecko → CoinPaprika fallback (cached); never show $0 on API failure
      formatWartUsdBalance(balanceInWart)
        .then((usd) => setUsdBalance(usd))
        .catch(() => setUsdBalance('N/A'));

      const resolvedPinHeight = chainHeadData.pinHeight ?? null;
      const resolvedPinHash = chainHeadData.pinHash ?? null;

      setNextNonce(newNextNonce);
      setPinHeight(resolvedPinHeight);
      setPinHash(resolvedPinHash);

      if (address) {
        localStorage.setItem(`warthogNextNonce_${address}`, newNextNonce);
      }

      console.log('Chain head data:', chainHeadData);
      return {
        balanceInWart,
        nextNonce: newNextNonce,
        pinHeight: resolvedPinHeight,
        pinHash: resolvedPinHash,
      };
    } catch (err) {
      console.warn('Balance fetch failed:', err.response?.status || err.message);
      // Background balance refresh — don't surface raw proxy errors in the global banner
      return null;
    }
  };
  // =================================================================================

  const updateTxStatuses = async () => {
    const nodeUrl = resolveNodeUrl(selectedNode);
    if (!nodeUrl) return;
    const nodeBaseParam = `nodeBase=${encodeURIComponent(nodeUrl)}`;
    const updatedTxs = await Promise.all(
      sentTransactions.map(async (tx) => {
        if (tx.status === 'confirmed') return tx;
        try {
          const response = await axios.get(`${API_URL}?nodePath=transaction/lookup/${tx.txHash}&${nodeBaseParam}`);
          const data = response.data.data?.transaction || response.data.data || response.data;
          if (data.blockHeight !== undefined && data.confirmations > 0) {
            return { ...tx, status: 'confirmed', confirmations: data.confirmations };
          }
          return tx;
        } catch {
          return tx;
        }
      })
    );
    const hadConfirmation = updatedTxs.some((tx, idx) => tx.status === 'confirmed' && sentTransactions[idx].status !== 'confirmed');
    setSentTransactions(updatedTxs);
    if (hadConfirmation) {
      fetchBalanceAndNonce(wallet.address);
      setRefreshHistory(prev => !prev);
    }
  };

  const refreshSavedWalletList = () => {
    setSavedWalletList(getSavedWallets());
    setSavedWalletEntries(getSavedWalletEntries());
  };

  const refreshSessionAuthStatus = (name = currentWalletName) => {
    const tag = String(name || '').trim();
    if (!tag) {
      setSessionHasPasskey(false);
      setSessionRequire2fa(false);
      setSessionHasPassword(false);
      return;
    }
    try {
      const raw = loadNamedWalletEncrypted(tag);
      const info = inspectNamedBlob(raw);
      setSessionHasPasskey(Boolean(info.hasPasskey));
      setSessionRequire2fa(Boolean(info.require2fa));
      setSessionHasPassword(Boolean(info.hasPassword));
      if (info.require2fa) setToolsWant2fa(true);
    } catch {
      setSessionHasPasskey(false);
      setSessionRequire2fa(false);
      setSessionHasPassword(false);
    }
  };

  const activateWalletSession = (decryptedWallet, name = null) => {
    setWallet(decryptedWallet);
    setCurrentWalletName(name);
    setNonceInput('');
    fetchBalanceAndNonce(decryptedWallet.address);
    const storedNonce = localStorage.getItem(`warthogNextNonce_${decryptedWallet.address}`);
    if (storedNonce) {
      setNextNonce(Number(storedNonce));
    }
    setShowPasswordPrompt(false);
    setUploadedFile(null);
    setError(null);
    setIsWalletProcessed(false);
    setIsLoggedIn(true);
    setPassword('');
    setSelectedSavedWallet('');
    setToolsSecurityMsg(null);
    refreshSessionAuthStatus(name);
  };

  /**
   * Persist named wallet: password and/or passkey, optional 2FA.
   * @returns {Promise<boolean>}
   */
  const saveNamedWallet = async (
    walletData,
    name,
    pwd,
    { withPasskey = false, require2fa = false } = {},
  ) => {
    const trimmedName = String(name || '').trim();
    const wantPasskey = Boolean(withPasskey) && passkeysSupported;
    const want2fa = Boolean(require2fa);

    if (!trimmedName) {
      setError('Please provide a wallet name');
      return false;
    }
    if (!pwd && !wantPasskey) {
      setError('Provide a password and/or enable passkey');
      return false;
    }
    if (want2fa && (!pwd || !wantPasskey)) {
      setError('2FA needs both a password and passkey');
      return false;
    }

    try {
      const existing = loadNamedWalletEncrypted(trimmedName);
      const prevEnv = existing ? tryParseEnvelope(existing) : null;
      let passwordCipher = pwd ? encryptWallet(walletData, pwd) : null;
      if (!passwordCipher && prevEnv?.password) passwordCipher = prevEnv.password;
      if (!passwordCipher && existing && !prevEnv) passwordCipher = existing;

      if (wantPasskey) {
        if (!isWebAuthnAvailable()) {
          setError('Passkey unlock needs HTTPS and a modern browser');
          return false;
        }
        await paintPasskeyWaiting(setPasskeyBusy);
        try {
          const { envelope } = await buildEnvelopeWithPasskey(walletData, {
            displayName: trimmedName,
            existingPasswordCipher: passwordCipher,
            previousEnvelope: prevEnv,
            require2fa: want2fa && Boolean(passwordCipher || pwd),
            preferFingerprint: false,
          });
          if (want2fa && pwd) {
            envelope.password = encryptWallet(walletData, pwd);
            envelope.require2fa = true;
          }
          saveNamedWalletBlob(trimmedName, serializeEnvelope(envelope));
        } finally {
          clearPasskeyWaiting(setPasskeyBusy);
        }
      } else if (pwd) {
        const cipher = encryptWallet(walletData, pwd);
        if (prevEnv?.passkey) {
          saveNamedWalletBlob(
            trimmedName,
            serializeEnvelope(
              envelopeWithPassword(walletData, cipher, prevEnv, { require2fa: want2fa }),
            ),
          );
        } else {
          saveNamedWalletBlob(trimmedName, cipher);
        }
      }

      refreshSavedWalletList();
      activateWalletSession(walletData, trimmedName);
      setSaveWalletConsent(false);
      setWalletName('');
      setConfirmPassword('');
      setEnablePasskeyOnSave(false);
      setRequire2faOnSave(false);
      return true;
    } catch (err) {
      clearPasskeyWaiting(setPasskeyBusy);
      setError(err?.message || 'Failed to save wallet');
      return false;
    }
  };

  const saveWallet = async (walletData) => {
    if (!saveWalletConsent || !walletName.trim()) {
      setError('Please provide a wallet name and consent to save the wallet');
      return false;
    }
    const wantPasskey = enablePasskeyOnSave && passkeysSupported;
    if (!password && !wantPasskey) {
      setError('Provide a password and/or enable passkey');
      return false;
    }
    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (require2faOnSave && (!password || !wantPasskey)) {
      setError('2FA needs both a password and passkey');
      return false;
    }
    return saveNamedWallet(walletData, walletName, password || null, {
      withPasskey: wantPasskey,
      require2fa: require2faOnSave,
    });
  };

  /** Enable passkey / 2FA on the currently logged-in named wallet (Tools-style). */
  const enablePasskeyOnCurrentWallet = async ({
    require2fa = false,
    password: pwd = null,
  } = {}) => {
    if (!wallet) {
      setToolsSecurityMsg('Unlock your wallet first');
      return false;
    }
    const tag = String(currentWalletName || promptWalletName || 'Main').trim() || 'Main';
    const want2fa = Boolean(require2fa);
    const passwordToUse = (pwd && String(pwd).trim()) || null;
    if (want2fa && !passwordToUse && !sessionHasPassword) {
      setToolsSecurityMsg('2FA needs a password — enter it below');
      return false;
    }
    setToolsSecurityMsg(null);
    setError(null);
    // saveNamedWallet shows the passkey waiting overlay itself
    const ok = await saveNamedWallet(wallet, tag, passwordToUse, {
      withPasskey: true,
      require2fa: want2fa,
    });
    if (ok) {
      setToolsSecurityMsg(
        want2fa
          ? `2FA enabled for “${tag}” — next login: password + ${fpLabel}`
          : `Passkey enabled for “${tag}” — next login: Unlock with ${fpLabel}`,
      );
      setToolsPasskeyPassword('');
      refreshSessionAuthStatus(tag);
    } else if (!error) {
      setToolsSecurityMsg('Could not enable passkey');
    }
    return ok;
  };

  const downloadWallet = (walletData, pwd) => {
    if (!pwd) {
      setError('Please provide a password to encrypt the wallet file');
      return;
    }
    const encrypted = encryptWallet(walletData, pwd);
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warthog_wallet.txt';
    a.click();
    URL.revokeObjectURL(url);
    setIsWalletProcessed(true);
    setDownloadPassword('');
    setConfirmDownloadPassword('');
    setShowDownloadPassword(false);
    setShowConfirmDownloadPassword(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setError('No file selected');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFile(e.target.result);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const resolveEncryptedBlob = (savedName = null) => {
    if (uploadedFile) {
      return { encrypted: uploadedFile, walletLabel: savedName || null };
    }
    if (savedName) {
      const encrypted = localStorage.getItem(`warthogWallet_${savedName}`);
      if (!encrypted) throw new Error('Selected wallet not found');
      return { encrypted, walletLabel: savedName };
    }
    const encrypted = localStorage.getItem('warthogWallet');
    if (!encrypted) throw new Error('No wallet found in storage or file');
    return { encrypted, walletLabel: null };
  };

  /** Password login (and 2FA first factor). */
  const loadWallet = async (savedName = null) => {
    try {
      const { encrypted, walletLabel } = resolveEncryptedBlob(savedName);
      const info = inspectNamedBlob(encrypted);

      if (info.require2fa) {
        if (!password) {
          setError('2FA wallet: enter password, then confirm with passkey');
          return;
        }
        await paintPasskeyWaiting(setPasskeyBusy);
        try {
          const decryptedWallet = await unlockEnvelopeWith2fa(
            info.envelope,
            password,
            decryptWallet,
          );
          activateWalletSession(decryptedWallet, walletLabel);
        } finally {
          clearPasskeyWaiting(setPasskeyBusy);
        }
        return;
      }

      if (!password) {
        setError('Please provide a password');
        return;
      }
      const decryptedWallet = decryptWallet(encrypted, password);
      activateWalletSession(decryptedWallet, walletLabel);
    } catch (err) {
      clearPasskeyWaiting(setPasskeyBusy);
      const msg = err?.message || 'Unknown error';
      setError(
        msg === 'Invalid password' || msg.startsWith('Failed to decrypt')
          ? 'Invalid password'
          : msg,
      );
    }
  };

  /** Passkey-only login (not for require2fa wallets). */
  const loadWalletWithPasskey = async (savedName = null) => {
    try {
      const { encrypted, walletLabel } = resolveEncryptedBlob(savedName);
      const info = inspectNamedBlob(encrypted);
      if (info.require2fa) {
        setError('This wallet requires password + passkey. Enter password, then tap Login.');
        return;
      }
      if (!info.hasPasskey || !info.envelope?.passkey) {
        setError('This wallet has no passkey unlock — use password, or enable passkey after unlock');
        return;
      }
      await paintPasskeyWaiting(setPasskeyBusy);
      try {
        const decryptedWallet = await decryptWithPasskey(info.envelope.passkey);
        activateWalletSession(decryptedWallet, walletLabel);
      } finally {
        clearPasskeyWaiting(setPasskeyBusy);
      }
    } catch (err) {
      clearPasskeyWaiting(setPasskeyBusy);
      setError(err?.message || 'Passkey unlock failed');
    }
  };

  const clearWallet = () => {
    if (!currentWalletName) {
      localStorage.removeItem('warthogWallet');
    }
    if (wallet?.address) {
      localStorage.removeItem(`warthogNextNonce_${wallet.address}`);
    }
    setWallet(null);
    setCurrentWalletName(null);
    setBalance(null);
    setNextNonce(null);
    setPinHeight(null);
    setPinHash(null);
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setSaveWalletConsent(false);
    setUploadedFile(null);
    setIsWalletProcessed(false);
    setIsLoggedIn(false);
    setShowSendPanel(false);
    setShowWalletExportQr(false);
    setShowNamePrompt(false);
    setNamePromptDismissed(false);
    setPromptWalletName('');
    setPromptPassword('');
    setPromptConfirmPassword('');
    setPromptError(null);
    setWalletName('');
    setSelectedSavedWallet('');
    setFailedTransactions([]); // Clear failed logs on wallet clear
    setSentTransactions([]); // Clear sent logs on wallet clear
    setNonceInput('');
    setMnemonic('');
    setPrivateKeyInput('');
    setAddress('');
    setToAddr('');
    setAmount('');
    setFee('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowUnlockPassword(false);
    setShowDownloadPassword(false);
    setShowLoginPassword(false);
  };

  const generateWallet = async (wordCount, pathType) => {
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
  };

  const deriveWallet = (mnemonic, wordCount, pathType) => {
    try {
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
        mnemonic,
        wordCount,
        pathType,
        privateKey: hdWallet.privateKey.slice(2),
        publicKey,
        address,
      };
    } catch (err) {
      throw new Error('Invalid mnemonic');
    }
  };

  const importFromPrivateKey = (privKey) => {
    console.log('Input length:', privKey.length); // Should be 64
    console.log('Is hex:', /^[0-9a-fA-F]+$/.test(privKey)); // Should be true
    try {
      if (privKey.length !== 64) {
        throw new Error('Private key must be exactly 64 characters long');
      }
      if (!/^[0-9a-fA-F]+$/.test(privKey)) {
        throw new Error('Private key must consist of hexadecimal characters only (0-9, a-f, A-F)');
      }
      const signer = new ethers.Wallet('0x' + privKey);
      const publicKey = signer.signingKey.compressedPublicKey.slice(2);
      const sha = ethers.sha256('0x' + publicKey).slice(2);
      const ripemd = ethers.ripemd160('0x' + sha).slice(2);
      const checksum = ethers.sha256('0x' + ripemd).slice(2, 10);
      const address = ripemd + checksum;
      console.log('Derived address:', address); // For extra verification
      return {
        privateKey: privKey,
        publicKey,
        address,
      };
    } catch (err) {
      console.error('Validation error:', err.message);
      throw new Error(err.message || 'Invalid private key');
    }
  };

  const selectedEntry = savedWalletEntries.find((e) => e.name === selectedSavedWallet);

  const handleWalletAction = async () => {
    setError(null);
    setIsWalletProcessed(false);
    if (walletAction === 'login-saved') {
      if (!selectedSavedWallet) {
        setError('Please select a saved wallet');
        return;
      }
      await loadWallet(selectedSavedWallet);
      return;
    }
    if (walletAction === 'login' && !uploadedFile) {
      setError('Please upload the warthog_wallet.txt file');
      return;
    }
    if (walletAction === 'login') {
      await loadWallet();
      return;
    }
    if (walletAction === 'derive' && !mnemonic) {
      setError('Please enter a seed phrase');
      return;
    }
    if (walletAction === 'import' && !privateKeyInput) {
      setError('Please enter a private key');
      return;
    }
    if (walletAction === 'derive') {
      const words = mnemonic.trim().split(/\s+/);
      const expectedWordCount = Number(wordCount);
      if (words.length !== expectedWordCount) {
        setError(`Seed phrase must have exactly ${expectedWordCount} words`);
        return;
      }
    }
    try {
      let data;
      if (walletAction === 'create') {
        data = await generateWallet(Number(wordCount), pathType);
      } else if (walletAction === 'derive') {
        data = deriveWallet(mnemonic, Number(wordCount), pathType);
      } else if (walletAction === 'import') {
        data = importFromPrivateKey(privateKeyInput);
      }
      setWalletData(data);
      setShowModal(true);
      setConsentToClose(false);
    } catch (err) {
      const errorMessage = err.message || `Failed to ${walletAction} wallet`;
      setError(errorMessage);
      clearWallet();
      console.error(`Wallet action error:`, err);
    }
  };

  const validateAddress = (addr) => {
    if (typeof addr !== 'string' || addr.length !== 48) {
      return { valid: false };
    }
    const ripemdHex = addr.slice(0, 40);
    const checksumHex = addr.slice(40);
    const computedChecksum = ethers.sha256('0x' + ripemdHex).slice(2, 10);
    return { valid: computedChecksum === checksumHex };
  };

  const handleValidateAddress = () => {
    setValidateResult(null);
    if (!address) {
      setValidateResult({ valid: false });
      return;
    }
    try {
      const result = validateAddress(address);
      setValidateResult(result);
    } catch (err) {
      const errorMessage = err.message || 'Failed to validate address';
      setError(errorMessage);
      console.error('Validate error:', err);
    }
  };

  const getRoundedFeeE8 = async (feeWart) => {
    const nodeUrl = resolveNodeUrl(selectedNode);
    if (!nodeUrl) return null;
    const nodeBaseParam = `nodeBase=${encodeURIComponent(nodeUrl)}`;
    try {
      const response = await axios.get(`${API_URL}?nodePath=tools/encode16bit/from_string/${feeWart}&${nodeBaseParam}`);
      const feeData = response.data.data || response.data;
      // Mainnet: roundedE8; DeFi nodes: rounded.E8
      const rounded = feeData.roundedE8 ?? feeData.rounded?.E8 ?? null;
      if (rounded == null) {
        throw new Error('Fee encode response missing roundedE8');
      }
      return rounded;
    } catch (err) {
      throw new Error('Failed to round fee');
    }
  };

  const handleSendTransaction = async () => {
    if (sending) return; // Prevent multiple sends
    setSending(true);
    setError(null);
   
    if (!toAddr || !amount || !fee) {
      setError('Please fill in all transaction fields');
      setSending(false);
      return;
    }
    const amountNum = parseFloat(amount);
    const feeNum = parseFloat(fee);
    if (isNaN(amountNum) || amountNum <= 0 || isNaN(feeNum) || feeNum <= 0) {
      setError('Invalid amount or fee: must be positive numbers');
      setSending(false);
      return;
    }
    const amountE8 = wartToE8(amount);
    let feeE8;
    try {
      feeE8 = await getRoundedFeeE8(fee);
    } catch {
      setError('Invalid fee or failed to round');
      setSending(false);
      return;
    }
    const txPrivateKey = wallet?.privateKey;
    if (!txPrivateKey) {
      setError('No wallet saved. Please create, derive, or log in with a wallet first.');
      setSending(false);
      return;
    }

    // Always refresh pin/nonce for send, and use the returned values (React state is async).
    let usePinHeight = pinHeight;
    let usePinHash = pinHash;
    let useNextNonce = nextNonce;
    const refreshed = await fetchBalanceAndNonce(wallet.address);
    if (refreshed) {
      usePinHeight = refreshed.pinHeight;
      usePinHash = refreshed.pinHash;
      useNextNonce = refreshed.nextNonce;
    }
    if (useNextNonce === null || usePinHeight === null || usePinHash === null) {
      setError('Failed to fetch nonce or chain head. Please try again.');
      setSending(false);
      return;
    }

    let txNonce = useNextNonce;
    if (nonceInput !== '') {
      const parsedNonce = Number(nonceInput);
      if (isNaN(parsedNonce) || parsedNonce < 0 || !Number.isInteger(parsedNonce)) {
        setError('Invalid nonce: must be a non-negative integer');
        setSending(false);
        return;
      }
      txNonce = parsedNonce;
    }
    // Capture transaction details for logging if failed
    const txDetails = {
      toAddr,
      amount,
      fee,
      nonce: txNonce,
      timestamp: new Date().toISOString(),
    };
    try {
      // Use freshly resolved pin values (not stale React state)
      const pinHashBytes = ethers.getBytes('0x' + usePinHash);
      const heightBytes = new Uint8Array(4);
      new DataView(heightBytes.buffer).setUint32(0, usePinHeight, false);
      const nonceBytes = new Uint8Array(4);
      new DataView(nonceBytes.buffer).setUint32(0, txNonce, false); // Use txNonce
      const reserved = new Uint8Array(3);
      const feeBytes = new Uint8Array(8);
      new DataView(feeBytes.buffer).setBigUint64(0, BigInt(feeE8), false);
      const toRawBytes = ethers.getBytes('0x' + toAddr.slice(0, 40));
      const amountBytes = new Uint8Array(8);
      new DataView(amountBytes.buffer).setBigUint64(0, BigInt(amountE8), false);
      const messageBytes = ethers.concat([
        pinHashBytes,
        heightBytes,
        nonceBytes,
        reserved,
        feeBytes,
        toRawBytes,
        amountBytes,
      ]);
      const txHash = ethers.sha256(messageBytes);
      const txHashBytes = ethers.getBytes(txHash);
      const signer = new ethers.Wallet('0x' + txPrivateKey);
      const sig = signer.signingKey.sign(txHashBytes);
      const rHex = sig.r.slice(2);
      const sHex = sig.s.slice(2);
      const recid = sig.v - 27;
      const recidHex = recid.toString(16).padStart(2, '0');
      const signature65 = rHex + sHex + recidHex;
      const nodeUrl = resolveNodeUrl(selectedNode);
      if (!nodeUrl) {
        setError('Select a valid node before sending');
        setSending(false);
        return;
      }
      // Envelope POST — works with current /api/proxy (legacy query+body also fixed server-side)
      console.log('Sending transaction request via proxy envelope to:', nodeUrl);
      const response = await axios.post(
        API_URL,
        {
          nodeBase: nodeUrl,
          nodePath: 'transaction/add',
          method: 'POST',
          body: {
            pinHeight: usePinHeight,
            nonceId: txNonce,
            toAddr,
            amountE8,
            feeE8,
            signature65,
          },
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log('Send transaction response status:', response.status);
      const data = response.data;
      console.log('Send transaction response data:', data);
      if (data.error || (data.code && data.code !== 0)) {
        throw new Error(data.error || `Transaction error code: ${data.code}`);
      }
      
      // Optimistic updates on success
      const newNextNonce = Math.max(useNextNonce || 0, txNonce + 1);
      setNextNonce(newNextNonce);
      if (wallet?.address) {
        localStorage.setItem(`warthogNextNonce_${wallet.address}`, newNextNonce);
      }
      setBalance((parseFloat(balance) - amountNum - feeNum).toFixed(8));
      // Step 2 insertion: Log successful sent transaction as pending
      setSentTransactions((prev) => [
        ...prev,
        { ...txDetails, txHash: data.data.txHash, status: 'pending' },
      ]);
      recordContactUsage(toAddr);

      // Clear input fields
      setToAddr('');
      setAmount('');
      setFee('0.01');
      setNonceInput('');
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to send transaction';
      setError(errorMessage);
      console.error('Fetch send transaction error:', err);
      // Log the failed transaction
      setFailedTransactions((prev) => [
        ...prev,
        { ...txDetails, error: errorMessage },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
    }
  };

  const copyToClipboard = (text, setter) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(text); // Set to show "Copied!" feedback
      setTimeout(() => setter(null), 2000); // Reset after 2s
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  return (
    <BunkerShell>

      {deferredPrompt && (
        <button onClick={handleInstallClick} className="bunker-btn" style={{ marginBottom: '1rem' }}>
          Install Wallet App
        </button>
      )}

      {updateAvailable && (
        <button onClick={handleUpdate} className="bunker-btn" style={{ marginBottom: '1rem' }}>
          Update App Available
        </button>
      )}

      {!showModal && (
        <>
          {showPasswordPrompt && !wallet && (
            <div className="bunker-panel">
              <h2 className="bunker-heading">Unlock Wallet</h2>
              <div className="mb-4">
                <label className="bunker-label">Upload Wallet File (optional):</label>
                <input type="file" accept=".txt" onChange={handleFileUpload} className="bunker-input" />
              </div>
              <div className="mb-4">
                <label className="bunker-label">Password:</label>
                <div className="bunker-input-wrap">
                  <input
                    type={showUnlockPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to unlock wallet"
                    className="bunker-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    className="bunker-input-toggle"
                  >
                    {showUnlockPassword ? 'hide' : 'show'}
                  </button>
                </div>
              </div>
              <div className="flex space-x-2">
                <button onClick={loadWallet} className="bunker-btn bunker-btn--primary">Unlock Wallet</button>
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPassword('');
                    setUploadedFile(null);
                    setShowUnlockPassword(false);
                  }}
                  className="bunker-btn bunker-btn--ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {wallet && (
            <section className="wallet-overview !p-0 !bg-transparent !border-0 !shadow-none !mb-0">
              <div className="mb-5">
                <h2 className="!mb-1">Wallet Overview</h2>
                <p className="text-xs text-zinc-500">Your balance and transaction history</p>
              </div>

              <div className="space-y-4">
                <WalletOverviewCard
                  balance={balance}
                  usdBalance={usdBalance}
                  address={wallet.address}
                  walletName={currentWalletName}
                  nodeList={nodeList}
                  selectedNode={selectedNode}
                  customIP={customIP}
                  customPort={customPort}
                  nodesLoading={nodesLoading}
                  nodesError={nodesError}
                  onNodeChange={(key) => {
                    setSelectedNode(key);
                    localStorage.setItem('selectedNode', key);
                  }}
                  onCustomIPChange={setCustomIP}
                  onCustomPortChange={setCustomPort}
                  onSaveCustomNode={handleSaveCustomNode}
                  refreshing={balanceRefreshing}
                  onRefresh={async () => {
                    if (!wallet?.address || balanceRefreshing) return;
                    setBalanceRefreshing(true);
                    try {
                      await fetchBalanceAndNonce(wallet.address);
                      setRefreshHistory((prev) => !prev);
                    } finally {
                      setBalanceRefreshing(false);
                    }
                  }}
                  onCopyAddress={() =>
                    navigator.clipboard
                      .writeText(wallet.address)
                      .then(() => alert('Address copied to clipboard!'))
                  }
                  validateInput={address}
                  onValidateInputChange={(value) => setAddress(value.trim())}
                  onValidate={handleValidateAddress}
                  validateResult={validateResult}
                  onSend={() => {
                    setShowSendPanel(true);
                    requestAnimationFrame(() => {
                      document.getElementById('send-transaction')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    });
                  }}
                  onDownload={() => setShowDownloadPrompt(true)}
                  onExportQr={() => setShowWalletExportQr(true)}
                  onContacts={() => {
                    setContactsModalMode('manage');
                    setShowContactsModal(true);
                  }}
                  onClear={clearWallet}
                />

                <WalletContactsModal
                  open={showContactsModal}
                  mode={contactsModalMode}
                  onClose={() => setShowContactsModal(false)}
                  prefillAddress={toAddr}
                  onSelectContact={(contact) => {
                    setToAddr(contact.address);
                    setShowSendPanel(true);
                  }}
                />

                <WalletQrExportModal
                  open={showWalletExportQr}
                  wallet={wallet}
                  onClose={() => setShowWalletExportQr(false)}
                />

                {showSendPanel && isLoggedIn && (
                  <div className="wallet-send-wrap">
                    <div id="send-transaction" className="bunker-panel wallet-send-panel">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="bunker-heading" style={{ margin: 0 }}>Send Transaction</h2>
                        <button
                          type="button"
                          onClick={() => setShowSendPanel(false)}
                          className="compact-btn hover:!text-[#E79300] !m-0"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <label className="bunker-label" style={{ margin: 0 }}>To Address:</label>
                          <button
                            type="button"
                            className="compact-btn hover:!text-[#E79300] !m-0"
                            onClick={() => {
                              setContactsModalMode('select');
                              setShowContactsModal(true);
                            }}
                          >
                            Contacts
                          </button>
                        </div>
                        <input
                          type="text"
                          value={toAddr}
                          onChange={(e) => setToAddr(e.target.value.trim())}
                          placeholder="Enter 48-character to address"
                          className="bunker-input"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="bunker-label">Amount (WART):</label>
                        <input
                          type="text"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.trim())}
                          placeholder="Enter amount in WART (e.g., 1)"
                          className="bunker-input"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="bunker-label">Fee (WART):</label>
                        <input
                          type="text"
                          value={fee}
                          onChange={(e) => setFee(e.target.value.trim())}
                          placeholder="Enter fee in WART (minimum 0.01)"
                          className="bunker-input"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="bunker-label">Nonce:</label>
                        <input
                          type="text"
                          value={nonceInput}
                          onChange={(e) => setNonceInput(e.target.value.trim())}
                          placeholder={`Auto: ${nextNonce !== null ? nextNonce : 'Loading'}`}
                          className="bunker-input"
                        />
                      </div>
                      <button onClick={handleSendTransaction} disabled={sending} className="bunker-btn bunker-btn--primary">
                        {sending ? 'Sending...' : 'Send Transaction'}
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-zinc-500 italic">
                  {currentWalletName
                    ? `Wallet "${currentWalletName}" is saved encrypted in this browser. Use the mobile icon to export via QR.`
                    : 'Private key is in this session only until you name & save the wallet. Keep your password secure.'}
                </p>

                {/* Passkey / 2FA — enable after login (wartbunker Tools parity) */}
                {passkeysSupported && (
                  <div
                    className="mt-4 p-4 rounded-xl border"
                    style={{
                      borderColor: sessionRequire2fa
                        ? 'rgba(56, 189, 248, 0.4)'
                        : sessionHasPasskey
                          ? 'rgba(52, 211, 153, 0.35)'
                          : 'rgba(245, 158, 11, 0.45)',
                      background: sessionRequire2fa
                        ? 'rgba(12, 74, 110, 0.2)'
                        : sessionHasPasskey
                          ? 'rgba(6, 78, 59, 0.18)'
                          : 'rgba(120, 53, 15, 0.15)',
                    }}
                  >
                    <h3 className="text-base font-semibold text-zinc-100 m-0 mb-2">
                      Passkey &amp; 2FA login
                    </h3>
                    <p className="text-xs text-zinc-500 mb-3 m-0">
                      Enable one-tap {fpLabel} unlock or require password + {fpLabel} (2FA), same as
                      wartbunker Tools. You can turn this on any time after login.
                    </p>
                    {sessionRequire2fa ? (
                      <p className="text-sm text-sky-300/95 mb-2 m-0 font-medium">
                        ✓ 2FA active
                        {currentWalletName ? (
                          <>
                            {' '}
                            for <span className="font-mono">{currentWalletName}</span>
                          </>
                        ) : null}
                      </p>
                    ) : sessionHasPasskey ? (
                      <p className="text-sm text-emerald-400/90 mb-2 m-0 font-medium">
                        ✓ Passkey enabled
                        {currentWalletName ? (
                          <>
                            {' '}
                            for <span className="font-mono">{currentWalletName}</span>
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-400 mb-2 m-0">
                        Not enabled yet
                        {!currentWalletName
                          ? ' — saving will name this wallet in the browser.'
                          : '.'}
                      </p>
                    )}

                    <label className="flex items-start gap-2 text-sm text-zinc-300 mb-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#E79300]"
                        checked={toolsWant2fa}
                        onChange={(e) => setToolsWant2fa(e.target.checked)}
                        disabled={passkeyBusy}
                      />
                      <span>
                        <strong>Require 2FA</strong> — password and {fpLabel} every login
                      </span>
                    </label>

                    {(toolsWant2fa || !sessionHasPassword) && (
                      <div className="mb-3">
                        <label className="bunker-label">
                          Wallet password
                          {toolsWant2fa ? ' (required for 2FA)' : ' (optional)'}
                        </label>
                        <input
                          type="password"
                          className="bunker-input"
                          autoComplete="current-password"
                          value={toolsPasskeyPassword}
                          onChange={(e) => setToolsPasskeyPassword(e.target.value)}
                          placeholder={toolsWant2fa ? 'Password for 2FA' : 'Optional password'}
                          disabled={passkeyBusy}
                        />
                      </div>
                    )}

                    {!currentWalletName && (
                      <div className="mb-3">
                        <label className="bunker-label">Save as name</label>
                        <input
                          type="text"
                          className="bunker-input"
                          value={promptWalletName}
                          onChange={(e) => setPromptWalletName(e.target.value)}
                          placeholder="e.g. main"
                          disabled={passkeyBusy}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="bunker-btn bunker-btn--primary"
                        disabled={passkeyBusy}
                        onClick={() =>
                          void enablePasskeyOnCurrentWallet({
                            require2fa: toolsWant2fa,
                            password: toolsPasskeyPassword || null,
                          })
                        }
                      >
                        {passkeyBusy
                          ? 'Waiting for passkey…'
                          : toolsWant2fa
                            ? sessionHasPasskey
                              ? 'Update passkey + keep 2FA'
                              : 'Enable passkey with 2FA'
                            : sessionHasPasskey
                              ? `Re-register ${fpLabel}`
                              : `Enable ${fpLabel}`}
                      </button>
                      {sessionHasPasskey && !sessionRequire2fa && (
                        <button
                          type="button"
                          className="bunker-btn"
                          disabled={passkeyBusy}
                          onClick={() => {
                            setToolsWant2fa(true);
                            void enablePasskeyOnCurrentWallet({
                              require2fa: true,
                              password: toolsPasskeyPassword || null,
                            });
                          }}
                        >
                          Enable 2FA (password + {fpLabel})
                        </button>
                      )}
                    </div>
                    {toolsSecurityMsg && (
                      <p className="text-sm text-emerald-400/90 mt-2 mb-0">{toolsSecurityMsg}</p>
                    )}
                    {error && toolsSecurityMsg === null && (
                      <p className="text-sm text-red-400 mt-2 mb-0">{error}</p>
                    )}
                  </div>
                )}

                <TransactionHistory
                  address={wallet.address}
                  node={resolveNodeUrl(selectedNode)}
                  onCountsUpdate={setBlockCounts}
                  blockCounts={blockCounts}
                  refreshTrigger={refreshHistory}
                />
              </div>
            </section>
          )}

          {showDownloadPrompt && (
            <div className="bunker-modal-overlay">
              <div className="bunker-modal">
                <h2 className="bunker-heading">Download Wallet File</h2>
                <div className="mb-4">
                  <label className="bunker-label">Password to Encrypt Wallet:</label>
                  <div className="bunker-input-wrap">
                    <input
                      type={showDownloadPassword ? "text" : "password"}
                      value={downloadPassword}
                      onChange={(e) => setDownloadPassword(e.target.value)}
                      placeholder="Enter password to encrypt wallet"
                      className="bunker-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDownloadPassword(!showDownloadPassword)}
                      className="bunker-input-toggle"
                    >
                      {showDownloadPassword ? 'hide' : 'show'}
                    </button>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="bunker-label">Confirm Password:</label>
                  <div className="bunker-input-wrap">
                    <input
                      type={showConfirmDownloadPassword ? "text" : "password"}
                      value={confirmDownloadPassword}
                      onChange={(e) => setConfirmDownloadPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="bunker-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmDownloadPassword(!showConfirmDownloadPassword)}
                      className="bunker-input-toggle"
                    >
                      {showConfirmDownloadPassword ? 'hide' : 'show'}
                    </button>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => {
                    if (!downloadPassword) {
                      setError('Please provide a password to encrypt and download the wallet file');
                      return;
                    }
                    if (downloadPassword !== confirmDownloadPassword) {
                      setError('Passwords do not match');
                      return;
                    }
                    setError(null);
                    downloadWallet(wallet, downloadPassword);
                    setShowDownloadPrompt(false);
                  }} className="bunker-btn">
                    Download
                  </button>
                  <button onClick={() => { setShowDownloadPrompt(false); setDownloadPassword(''); setConfirmDownloadPassword(''); setShowDownloadPassword(false); setShowConfirmDownloadPassword(false); }} className="bunker-btn bunker-btn--ghost">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isLoggedIn && (
            <WalletAccessHub
              onActivate={(data, name) => {
                setError(null);
                activateWalletSession(data, name);
              }}
            />
          )}
         {isLoggedIn && sentTransactions.length > 0 && (
  <div className="bunker-panel">
    <div className="flex justify-between items-center mb-4">
      <h2 className="bunker-heading">Sent Transactions Log</h2>
      
      <div className="flex gap-3">
        <button 
          onClick={updateTxStatuses} 
          className="bunker-btn"
        >
          Refresh Status
        </button>

        {sentTransactions.some(tx => tx.status === 'confirmed') && (
          <button 
            onClick={() => setSentTransactions(prev => prev.filter(tx => tx.status === 'pending'))}
            className="bunker-btn bunker-btn--danger"
          >
            Clear confirmed
          </button>
        )}
      </div>
    </div>

    <ul className="bunker-list">
      {sentTransactions.map((tx, index) => (
        <li key={index} className="bunker-list-item">
          <div className="bunker-dl-grid">
            <p><strong>Timestamp:</strong> {tx.timestamp}</p>
            
            <p>
              <strong>From:</strong>{' '}
              <span className="bunker-text">
                {isSmallScreen767 
                  ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` 
                  : wallet.address}
              </span>
            </p>

            <p>
              <strong>To:</strong>{' '}
              <span className="bunker-text">
                {isSmallScreen767 
                  ? `${tx.toAddr.slice(0,6)}...${tx.toAddr.slice(-4)}` 
                  : tx.toAddr}
              </span>
            </p>

            <p><strong>Amount:</strong> {tx.amount} WART</p>
            <p><strong>Fee:</strong> {tx.fee} WART</p>
            <p><strong>Nonce:</strong> {tx.nonce}</p>

            <p>
              <strong>Tx Hash:</strong>{' '}
              <span 
                className="bunker-copyable"
                onClick={() => copyToClipboard(tx.txHash, setCopiedTxId)}
                title={tx.txHash}
              >
                {isSmallScreen795 
                  ? `${tx.txHash.slice(0,6)}...${tx.txHash.slice(-4)}` 
                  : tx.txHash}
                {copiedTxId === tx.txHash ? ' (Copied!)' : ''}
              </span>
            </p>

            <p>
              <strong>Status:</strong>{' '}
              <span className={tx.status === 'confirmed' ? 'bunker-status--ok' : 'bunker-status--pending'}>
                {tx.status === 'confirmed' ? 'Confirmed (Block mined)' : 'Pending'}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  </div>
)}

          {isLoggedIn && failedTransactions.length > 0 && (
            <div className="bunker-panel">
              <h2 className="bunker-heading">Failed Transactions Log</h2>
              <ul className="bunker-list">
                {failedTransactions.map((tx, index) => (
                  <li key={index} className="bunker-list-item bunker-list-item--error">
                    <div className="bunker-dl-grid">
                      <p><strong>Timestamp:</strong> {tx.timestamp}</p>
                      <p>
                        <strong>From:</strong>{' '}
                        <span
                          className="bunker-copyable"
                          title={wallet.address}
                          onClick={() => copyToClipboard(wallet.address, setCopiedFromAddr)}
                        >
                          {isSmallScreen767 ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : wallet.address}
                          {copiedFromAddr === wallet.address ? ' (Copied!)' : ''}
                        </span>
                      </p>
                      <p>
                        <strong>To:</strong>{' '}
                        <span
                          className="bunker-copyable"
                          title={tx.toAddr}
                          onClick={() => copyToClipboard(tx.toAddr, setCopiedToAddr)}
                        >
                          {isSmallScreen767 ? `${tx.toAddr.slice(0, 6)}...${tx.toAddr.slice(-4)}` : tx.toAddr}
                          {copiedToAddr === tx.toAddr ? ' (Copied!)' : ''}
                        </span>
                      </p>
                      <p><strong>Amount:</strong> {tx.amount} WART</p>
                      <p><strong>Fee:</strong> {tx.fee} WART</p>
                      <p><strong>Nonce:</strong> {tx.nonce}</p>
                      <p><strong>Error:</strong> {tx.error}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="bunker-alert bunker-alert--error">
              <strong>Error:</strong> {error}
            </div>
          )}
        </>
      )}

      {showModal && walletData && (
        <div className="bunker-modal-overlay">
          <div className="bunker-modal bunker-modal--wide">
            <h2 className="bunker-heading">Wallet Information</h2>
            <p className="bunker-warning" style={{ marginBottom: '1rem' }}>
              Warning: Please write down your seed phrase (if available) and private key on a piece of paper and store them securely. Do not share them with anyone.
            </p>
            <p className="bunker-text" style={{ marginBottom: '0.5rem' }}>Options for securing your wallet:</p>
            <ul className="bunker-text bunker-muted" style={{ marginBottom: '1rem', paddingLeft: '1.25rem' }}>
              <li>Save a named wallet to this browser for quick login via &quot;Login to Saved Wallet&quot;.</li>
              <li>Download the wallet as an encrypted file (warthog_wallet.txt). You can store this file securely and upload it later to login.</li>
              <li>Export to the mobile app via QR from the overview after you start using the wallet.</li>
            </ul>
            {walletData.wordCount && (
              <p className="mb-2">
                <strong className="bunker-label" style={{ display: 'inline' }}>Word Count:</strong> {walletData.wordCount}
              </p>
            )}
            {walletData.mnemonic && (
              <div className="mb-4">
                <strong className="bunker-label" style={{ display: 'inline' }}>Seed Phrase:</strong>
                <p className="bunker-seed-phrase">
                  <span>{walletData.mnemonic}</span>
                </p>
              </div>
            )}
            {walletData.pathType && (
              <p className="mb-2">
                <strong className="bunker-label" style={{ display: 'inline' }}>Path Type:</strong> {walletData.pathType}
              </p>
            )}
            <div className="mb-2">
              <strong className="bunker-label" style={{ display: 'inline' }}>Private Key:</strong><br />
              <span className="bunker-text" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{walletData.privateKey}</span>
            </div>
            <div className="mb-2">
              <strong className="bunker-label" style={{ display: 'inline' }}>Public Key:</strong><br />
              <span className="bunker-text" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{walletData.publicKey}</span>
            </div>
            <div className="mb-4">
              <strong className="bunker-label" style={{ display: 'inline' }}>Address:</strong><br />
              <span className="bunker-text" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{walletData.address}</span>
            </div>
            <div className="mb-4">
              <label className="bunker-label">Password to Encrypt Wallet:</label>
              <div className="bunker-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to encrypt wallet"
                  className="bunker-input"
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
            <div className="mb-4">
              <label className="bunker-label">Confirm Password:</label>
              <div className="bunker-input-wrap">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="bunker-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="bunker-input-toggle"
                >
                  {showConfirmPassword ? 'hide' : 'show'}
                </button>
              </div>
            </div>
            {error && (
              <div className="bunker-alert bunker-alert--error">
                <strong>Error:</strong> {error}
              </div>
            )}
            <div className="mb-4">
              <label className="bunker-check-label">
                <input
                  type="checkbox"
                  checked={saveWalletConsent}
                  onChange={(e) => setSaveWalletConsent(e.target.checked)}
                  className="bunker-checkbox"
                />
                <span>Save named wallet to this browser for quick login</span>
              </label>
            </div>
            {saveWalletConsent && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="bunker-label">Wallet Name:</label>
                  <input
                    type="text"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder="e.g. main or trading"
                    className="bunker-input"
                  />
                </div>
                {passkeysSupported && (
                  <>
                    <label className="bunker-check-label">
                      <input
                        type="checkbox"
                        checked={enablePasskeyOnSave}
                        onChange={(e) => {
                          setEnablePasskeyOnSave(e.target.checked);
                          if (!e.target.checked) setRequire2faOnSave(false);
                        }}
                        className="bunker-checkbox"
                      />
                      <span>Enable {fpLabel} unlock (passkey)</span>
                    </label>
                    <label className="bunker-check-label">
                      <input
                        type="checkbox"
                        checked={require2faOnSave}
                        onChange={(e) => {
                          setRequire2faOnSave(e.target.checked);
                          if (e.target.checked) setEnablePasskeyOnSave(true);
                        }}
                        className="bunker-checkbox"
                        disabled={!enablePasskeyOnSave && !require2faOnSave}
                      />
                      <span>Require 2FA — password and {fpLabel} every login</span>
                    </label>
                  </>
                )}
              </div>
            )}
            <div className="mb-4">
              <label className="bunker-check-label">
                <input
                  type="checkbox"
                  checked={consentToClose}
                  onChange={(e) => setConsentToClose(e.target.checked)}
                  className="bunker-checkbox"
                />
                <span>I have saved the seed phrase / private key securely (required)</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                disabled={!consentToClose || passkeyBusy}
                onClick={() => {
                  if (!consentToClose) {
                    setError('Please confirm you have saved the seed/private key securely');
                    return;
                  }
                  setError(null);
                  activateWalletSession(walletData, null);
                  setShowModal(false);
                  setWalletData(null);
                  setPassword('');
                  setConfirmPassword('');
                  setWalletName('');
                  setSaveWalletConsent(false);
                  setEnablePasskeyOnSave(false);
                  setRequire2faOnSave(false);
                  setConsentToClose(false);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="bunker-btn bunker-btn--primary"
              >
                Use Wallet Now
              </button>
              <button
                disabled={
                  !consentToClose ||
                  !saveWalletConsent ||
                  !walletName.trim() ||
                  passkeyBusy ||
                  (!password && !(enablePasskeyOnSave && passkeysSupported)) ||
                  (password && password !== confirmPassword) ||
                  (require2faOnSave && (!password || !enablePasskeyOnSave))
                }
                onClick={() => {
                  void (async () => {
                    setError(null);
                    const ok = await saveWallet(walletData);
                    if (ok) {
                      setShowModal(false);
                      setWalletData(null);
                      setPassword('');
                      setConfirmPassword('');
                      setWalletName('');
                      setConsentToClose(false);
                      setShowPassword(false);
                      setShowConfirmPassword(false);
                      setEnablePasskeyOnSave(false);
                      setRequire2faOnSave(false);
                    }
                  })();
                }}
                className="bunker-btn"
              >
                {passkeyBusy ? 'Waiting for passkey…' : 'Save Named Wallet'}
              </button>
              <button
                onClick={() => {
                  if (!password) {
                    setError('Please provide a password to encrypt and download the wallet file.');
                    return;
                  }
                  if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    return;
                  }
                  setError(null);
                  downloadWallet(walletData, password);
                  setShowModal(false);
                  setWalletData(null);
                  setPassword('');
                  setConfirmPassword('');
                  setWalletName('');
                  setSaveWalletConsent(false);
                  setConsentToClose(false);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="bunker-btn"
              >
                Download Wallet File
              </button>
            </div>
          </div>
        </div>
      )}

      {showNamePrompt && wallet && (
        <div className="bunker-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="bunker-modal">
            <h2 className="bunker-heading">Name &amp; Save This Wallet</h2>
            <p className="bunker-text bunker-muted" style={{ marginBottom: '1rem' }}>
              Tag this session with a name so you can use Login to Saved Wallet next time. Optional: passkey / 2FA.
            </p>
            {promptError && (
              <div className="bunker-alert bunker-alert--error" style={{ marginBottom: '1rem' }}>
                {promptError}
              </div>
            )}
            <div className="mb-4">
              <label className="bunker-label">Wallet Name:</label>
              <input
                type="text"
                value={promptWalletName}
                onChange={(e) => setPromptWalletName(e.target.value)}
                placeholder="e.g. main-wallet or trading"
                className="bunker-input"
              />
            </div>
            <div className="mb-4">
              <label className="bunker-label">Password:</label>
              <div className="bunker-input-wrap">
                <input
                  type={showPromptPassword ? 'text' : 'password'}
                  value={promptPassword}
                  onChange={(e) => setPromptPassword(e.target.value)}
                  placeholder="Password to encrypt saved wallet"
                  className="bunker-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPromptPassword(!showPromptPassword)}
                  className="bunker-input-toggle"
                >
                  {showPromptPassword ? 'hide' : 'show'}
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="bunker-label">Confirm Password:</label>
              <div className="bunker-input-wrap">
                <input
                  type={showPromptConfirmPassword ? 'text' : 'password'}
                  value={promptConfirmPassword}
                  onChange={(e) => setPromptConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="bunker-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPromptConfirmPassword(!showPromptConfirmPassword)}
                  className="bunker-input-toggle"
                >
                  {showPromptConfirmPassword ? 'hide' : 'show'}
                </button>
              </div>
            </div>
            {passkeysSupported && (
              <div className="mb-4 space-y-2">
                <label className="bunker-check-label">
                  <input
                    type="checkbox"
                    checked={enablePasskeyOnPrompt}
                    onChange={(e) => {
                      setEnablePasskeyOnPrompt(e.target.checked);
                      if (!e.target.checked) setRequire2faOnPrompt(false);
                    }}
                    className="bunker-checkbox"
                  />
                  <span>Enable {fpLabel} unlock</span>
                </label>
                <label className="bunker-check-label">
                  <input
                    type="checkbox"
                    checked={require2faOnPrompt}
                    onChange={(e) => {
                      setRequire2faOnPrompt(e.target.checked);
                      if (e.target.checked) setEnablePasskeyOnPrompt(true);
                    }}
                    className="bunker-checkbox"
                  />
                  <span>Require 2FA (password + {fpLabel})</span>
                </label>
              </div>
            )}
            <div className="flex space-x-2">
              <button
                disabled={passkeyBusy}
                onClick={() => {
                  void (async () => {
                    setPromptError(null);
                    const name = promptWalletName.trim();
                    const wantPk = enablePasskeyOnPrompt && passkeysSupported;
                    if (!name) {
                      setPromptError('Enter a wallet name');
                      return;
                    }
                    if (!promptPassword && !wantPk) {
                      setPromptError('Provide a password and/or enable passkey');
                      return;
                    }
                    if (promptPassword && promptPassword !== promptConfirmPassword) {
                      setPromptError('Passwords do not match');
                      return;
                    }
                    if (require2faOnPrompt && (!promptPassword || !wantPk)) {
                      setPromptError('2FA needs both a password and passkey');
                      return;
                    }
                    const ok = await saveNamedWallet(wallet, name, promptPassword || null, {
                      withPasskey: wantPk,
                      require2fa: require2faOnPrompt,
                    });
                    if (ok) {
                      setShowNamePrompt(false);
                      setPromptWalletName('');
                      setPromptPassword('');
                      setPromptConfirmPassword('');
                      setPromptError(null);
                      setNamePromptDismissed(false);
                      setEnablePasskeyOnPrompt(false);
                      setRequire2faOnPrompt(false);
                    } else {
                      setPromptError(error || 'Save failed');
                    }
                  })();
                }}
                className="bunker-btn"
                style={{ flex: 1 }}
              >
                Save &amp; Tag Wallet
              </button>
              <button
                onClick={() => {
                  setShowNamePrompt(false);
                  setNamePromptDismissed(true);
                  setPromptWalletName('');
                  setPromptPassword('');
                  setPromptConfirmPassword('');
                  setPromptError(null);
                }}
                className="bunker-btn bunker-btn--ghost"
                style={{ flex: 1 }}
              >
                Skip for Now
              </button>
            </div>
            <p className="bunker-text bunker-muted" style={{ marginTop: '0.75rem', fontSize: '0.625rem' }}>
              This stores an encrypted copy in localStorage under your chosen name. Mnemonic is never saved.
            </p>
          </div>
        </div>
      )}

      {passkeyBusy && (
        <div
          className="bunker-modal-overlay"
          style={{ zIndex: 2000 }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="bunker-modal" style={{ maxWidth: 360, textAlign: 'center' }}>
            <div
              className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[#E79300] border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-zinc-100 font-medium m-0 mb-1">Waiting for passkey…</p>
            <p className="text-zinc-500 text-sm m-0">
              Complete the browser or device prompt (PIN, biometrics, or password manager).
            </p>
          </div>
        </div>
      )}
    </BunkerShell>
  );
};

export default Wallet;

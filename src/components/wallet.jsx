import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import TransactionHistory from './TransactionHistory';
import WalletOverviewCard from './WalletOverviewCard.jsx';
import WalletQrExportModal from './WalletQrExportModal.jsx';
import { fetchNodes, resolveNodeUrl } from '../lib/nodesCache';
import { encryptWallet, decryptWallet, getSavedWallets } from '../utils/warthogWalletUtils';
import BunkerShell from './BunkerShell.jsx';

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
  const [selectedNode, setSelectedNode] = useState('');
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
  const [showWalletExportQr, setShowWalletExportQr] = useState(false);
  const [currentWalletName, setCurrentWalletName] = useState(null);
  const [selectedSavedWallet, setSelectedSavedWallet] = useState('');
  const [walletName, setWalletName] = useState('');
  const [savedWalletList, setSavedWalletList] = useState(() => getSavedWallets());
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [namePromptDismissed, setNamePromptDismissed] = useState(false);
  const [promptWalletName, setPromptWalletName] = useState('');
  const [promptPassword, setPromptPassword] = useState('');
  const [promptConfirmPassword, setPromptConfirmPassword] = useState('');
  const [promptError, setPromptError] = useState(null);
  const [showPromptPassword, setShowPromptPassword] = useState(false);
  const [showPromptConfirmPassword, setShowPromptConfirmPassword] = useState(false);

  // Fetch nodes and validate savedNode from localStorage
  useEffect(() => {
    async function loadNodes() {
      setNodesLoading(true);
      setNodesError(null);
      const { nodes, error } = await fetchNodes();
      if (error) {
        setNodesError(error);
        setNodesLoading(false);
        return;
      }
      setNodeList(nodes || []);
      setNodesLoading(false);

      if (nodes && nodes.length > 0) {
        const savedNode = localStorage.getItem('selectedNode');
        const savedUrl = resolveNodeUrl(savedNode);
        const knownUrls = nodes.map((n) => n.url);
        if (savedUrl && knownUrls.includes(savedUrl)) {
          setSelectedNode(savedUrl);
        } else if (savedUrl && savedUrl.startsWith('http')) {
          setSelectedNode(savedUrl);
        } else {
          const defaultUrl = nodes[0].url;
          setSelectedNode(defaultUrl);
          localStorage.setItem('selectedNode', defaultUrl);
        }
      }
    }
    loadNodes();
  }, []);

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
    if (!nodeUrl) return;

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
      const chainHeadData = chainHeadResponse.data.data || chainHeadResponse.data;
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

      const balanceInWart = balanceData.balance !== undefined ? (balanceData.balance / 1).toFixed(8) : '0';
      setBalance(balanceInWart);

      // Fetch USD equivalent
      if (balanceInWart && balanceInWart !== '0.00000000') {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=warthog&vs_currencies=usd')
          .then(res => res.json())
          .then(data => {
            const price = data.warthog?.usd || 0;
            const usd = (parseFloat(balanceInWart) * price).toFixed(2);
            setUsdBalance(`$${usd}`);
          })
          .catch(() => setUsdBalance('N/A'));
      } else {
        setUsdBalance('$0.00');
      }

      setNextNonce(newNextNonce);
      setPinHeight(chainHeadData.pinHeight);
      setPinHash(chainHeadData.pinHash);

      if (address) {
        localStorage.setItem(`warthogNextNonce_${address}`, newNextNonce);
      }

      console.log('Chain head data:', chainHeadData);
      return { balanceInWart, nextNonce: newNextNonce, pinHeight: chainHeadData.pinHeight, pinHash: chainHeadData.pinHash };
    } catch (err) {
      console.warn('Balance fetch failed:', err.response?.status || err.message);
      // Background balance refresh — don't surface raw proxy errors in the global banner
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
  };

  const saveNamedWallet = (walletData, name, pwd) => {
    const trimmedName = String(name || '').trim();
    if (!trimmedName || !pwd) {
      setError('Please provide a wallet name and password');
      return false;
    }
    try {
      const encrypted = encryptWallet(walletData, pwd);
      localStorage.setItem(`warthogWallet_${trimmedName}`, encrypted);
      refreshSavedWalletList();
      activateWalletSession(walletData, trimmedName);
      setSaveWalletConsent(false);
      setWalletName('');
      setConfirmPassword('');
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const saveWallet = (walletData) => {
    if (!saveWalletConsent || !walletName.trim() || !password) {
      setError('Please provide a wallet name, password, and consent to save the wallet');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return saveNamedWallet(walletData, walletName, password);
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

  const loadWallet = (savedName = null) => {
    if (!password) {
      setError('Please provide a password');
      return;
    }
    try {
      let encrypted;
      let walletLabel = savedName;
      if (uploadedFile) {
        encrypted = uploadedFile;
      } else if (savedName) {
        encrypted = localStorage.getItem(`warthogWallet_${savedName}`);
        if (!encrypted) throw new Error('Selected wallet not found');
      } else {
        encrypted = localStorage.getItem('warthogWallet');
        if (!encrypted) throw new Error('No wallet found in storage or file');
        walletLabel = null;
      }
      const decryptedWallet = decryptWallet(encrypted, password);
      activateWalletSession(decryptedWallet, walletLabel);
    } catch (err) {
      const msg = err?.message || 'Unknown error';
      setError(
        msg === 'Invalid password'
          ? 'Invalid password'
          : msg.startsWith('Failed to decrypt')
          ? 'Invalid password'
          : msg,
      );
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

  const handleWalletAction = async () => {
    setError(null);
    setIsWalletProcessed(false);
    if (walletAction === 'login-saved') {
      if (!selectedSavedWallet || !password) {
        setError('Please select a saved wallet and enter password');
        return;
      }
      loadWallet(selectedSavedWallet);
      return;
    }
    if (walletAction === 'login' && !uploadedFile) {
      setError('Please upload the warthog_wallet.txt file');
      return;
    }
    if (walletAction === 'login') {
      loadWallet();
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
      return feeData.roundedE8;
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
    if (nextNonce === null || pinHeight === null || pinHash === null || nonceInput === '') {
      setError('Nonce or chain head not available. Fetching latest...');
      await fetchBalanceAndNonce(wallet.address); // Fetch fresh if missing or auto-calculating
    }
    if (nextNonce === null || pinHeight === null || pinHash === null) {
      setError('Failed to fetch nonce or chain head. Please try again.');
      setSending(false);
      return;
    }
    let txNonce = nextNonce;
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
      // Use current state values
      const pinHashBytes = ethers.getBytes('0x' + pinHash);
      const heightBytes = new Uint8Array(4);
      new DataView(heightBytes.buffer).setUint32(0, pinHeight, false);
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
      const nodeBaseParam = `nodeBase=${encodeURIComponent(nodeUrl)}`;
      console.log('Sending transaction request to:', `${API_URL}?nodePath=transaction/add&${nodeBaseParam}`);
      const response = await axios.post(
        `${API_URL}?nodePath=transaction/add&${nodeBaseParam}`,
        {
          pinHeight,
          nonceId: txNonce, // Use txNonce
          toAddr,
          amountE8,
          feeE8,
          signature65,
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
      const newNextNonce = Math.max(nextNonce || 0, txNonce + 1);
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
      // Clear input fields
      setToAddr('');
      setAmount('');
      setFee('');
      setNonceInput('');
    } catch (err) {
      const errorMessage =
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
                <button onClick={loadWallet} className="bunker-btn">Unlock Wallet</button>
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
                  selectedNode={resolveNodeUrl(selectedNode)}
                  nodesLoading={nodesLoading}
                  nodesError={nodesError}
                  onNodeChange={(url) => {
                    setSelectedNode(url);
                    localStorage.setItem('selectedNode', url);
                  }}
                  onRefresh={() => fetchBalanceAndNonce(wallet.address)}
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
                  onClear={clearWallet}
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
                        <label className="bunker-label">To Address:</label>
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
                      <button onClick={handleSendTransaction} disabled={sending} className="bunker-btn">
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
            <div className="bunker-panel">
              <h2 className="bunker-heading">Wallet Management</h2>
              <div className="mb-4">
                <label className="bunker-label">Action:</label>
                <select
                  value={walletAction}
                  onChange={(e) => {
                    setWalletAction(e.target.value);
                    setError(null);
                    setMnemonic('');
                    setPrivateKeyInput('');
                    setUploadedFile(null);
                    setPassword('');
                    setSelectedSavedWallet('');
                    setIsWalletProcessed(false);
                    setShowLoginPassword(false);
                    refreshSavedWalletList();
                  }}
                  className="bunker-input"
                >
                  <option value="create">Create New Wallet</option>
                  <option value="derive">Derive Wallet from Seed Phrase</option>
                  <option value="import">Import from Private Key</option>
                  <option value="login-saved">Login to Saved Wallet</option>
                  <option value="login">Login with Wallet File</option>
                </select>
              </div>
              {walletAction === 'login-saved' && (
                <>
                  <div className="mb-4">
                    <label className="bunker-label">Select Saved Wallet:</label>
                    {savedWalletList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {savedWalletList.map((name) => {
                          const isSelected = selectedSavedWallet === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSelectedSavedWallet(name);
                                setError(null);
                              }}
                              className={`saved-wallet-card${isSelected ? ' saved-wallet-card--selected' : ''}`}
                              aria-pressed={isSelected}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="saved-wallet-card__name">{name}</div>
                                  <div className="saved-wallet-card__meta">
                                    {isSelected ? 'Selected' : 'Saved in this browser'}
                                  </div>
                                </div>
                                <span className="saved-wallet-card__check" aria-hidden="true">
                                  {isSelected && (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
                                      <path d="M10.28 2.28a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L4.5 7.19l4.97-4.97a.75.75 0 0 1 1.06 0Z" />
                                    </svg>
                                  )}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 mt-1">
                        No saved wallets yet. Create a wallet and save it for quick login.
                      </p>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="bunker-label">Password:</label>
                    <div className="bunker-input-wrap">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="bunker-input"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="bunker-input-toggle"
                      >
                        {showLoginPassword ? 'hide' : 'show'}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {walletAction === 'derive' && (
                <div className="mb-4">
                  <label className="bunker-label">Seed Phrase:</label>
                  <input
                    type="text"
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    placeholder="Enter 12 or 24-word seed phrase"
                    className="bunker-input"
                  />
                </div>
              )}
              {walletAction === 'import' && (
                <div className="mb-4">
                  <label className="bunker-label">Private Key:</label>
                  <input
                    type="text"
                    value={privateKeyInput}
                    onChange={(e) => setPrivateKeyInput(e.target.value.replace(/\s/g, ''))}
                    placeholder="Enter 64-character hex private key"
                    className="bunker-input"
                  />
                </div>
              )}
              {walletAction === 'login' && (
                <>
                  <div className="mb-4">
                    <label className="bunker-label">Upload Wallet File (warthog_wallet.txt):</label>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="bunker-input"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="bunker-label">Password:</label>
                    <div className="bunker-input-wrap">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password to decrypt wallet"
                        className="bunker-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="bunker-input-toggle"
                      >
                        {showLoginPassword ? 'hide' : 'show'}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {(walletAction === 'create' || walletAction === 'derive') && (
                <div className="mb-4">
                  <label className="bunker-label">Word Count:</label>
                  <select
                    value={wordCount}
                    onChange={(e) => setWordCount(e.target.value)}
                    className="bunker-input"
                  >
                    <option value="12">12 Words</option>
                    <option value="24">24 Words</option>
                  </select>
                </div>
              )}
              {(walletAction === 'create' || walletAction === 'derive') && wordCount === '12' && (
                <div className="mb-4">
                  <label className="bunker-label">Derivation Path Type:</label>
                  <select
                    value={pathType}
                    onChange={(e) => setPathType(e.target.value)}
                    className="bunker-input"
                  >
                    <option value="hardened">Hardened (m/44'/2070'/0'/0/0)</option>
                    <option value="non-hardened">Non-Hardened (m/44'/2070'/0/0/0)</option>
                  </select>
                </div>
              )}
              <button
                onClick={handleWalletAction}
                disabled={walletAction === 'login-saved' && (!password || !selectedSavedWallet)}
                className="bunker-btn"
              >
                {walletAction === 'create'
                  ? 'Create Wallet'
                  : walletAction === 'derive'
                  ? 'Derive Wallet'
                  : walletAction === 'import'
                  ? 'Import Wallet'
                  : walletAction === 'login-saved'
                  ? 'Login to Wallet'
                  : 'Login'}
              </button>
            </div>
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
                <span>Save named wallet to this browser (encrypted with password)</span>
              </label>
            </div>
            {saveWalletConsent && (
              <div className="mb-4">
                <label className="bunker-label">Wallet Name:</label>
                <input
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="e.g. main or trading"
                  className="bunker-input"
                />
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
                disabled={!consentToClose}
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
                  setConsentToClose(false);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="bunker-btn"
              >
                Use Wallet Now
              </button>
              <button
                disabled={!consentToClose || !saveWalletConsent || !walletName.trim() || !password || password !== confirmPassword}
                onClick={() => {
                  setError(null);
                  if (saveWallet(walletData)) {
                    setShowModal(false);
                    setWalletData(null);
                    setPassword('');
                    setConfirmPassword('');
                    setWalletName('');
                    setConsentToClose(false);
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                  }
                }}
                className="bunker-btn"
              >
                Save Named Wallet
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
              This wallet isn&apos;t tagged with an account name yet. Give it a name and password so you can select it easily from &quot;Login to Saved Wallet&quot; next time.
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
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setPromptError(null);
                  const name = promptWalletName.trim();
                  if (!name || !promptPassword || promptPassword !== promptConfirmPassword) {
                    setPromptError('Please provide a wallet name and matching passwords to save');
                    return;
                  }
                  if (saveNamedWallet(wallet, name, promptPassword)) {
                    setShowNamePrompt(false);
                    setPromptWalletName('');
                    setPromptPassword('');
                    setPromptConfirmPassword('');
                    setPromptError(null);
                    setNamePromptDismissed(false);
                  } else {
                    setPromptError('Save failed — check the error above');
                  }
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
    </BunkerShell>
  );
};

export default Wallet;

import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { ethers } from 'ethers';
import './Wallet.css';

const API_URL = '/api/proxy';

const defaultNodeList = [
  'https://warthognode.duckdns.org',
  'http://51.75.21.134:3001',
  'http://62.72.44.89:3001',
  'http://dev.node-s.com:3001',
  'https://node.wartscan.io'
];

const Wallet = () => {
  const [createResult, setCreateResult] = useState(null);
  const [deriveResult, setDeriveResult] = useState(null);
  const [validateResult, setValidateResult] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [nonceId, setNonceId] = useState(null);
  const [pinHeight, setPinHeight] = useState(null);
  const [pinHash, setPinHash] = useState(null);
  const [mnemonic, setMnemonic] = useState('');
  const [address, setAddress] = useState('');
  const [toAddr, setToAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [wordCount, setWordCount] = useState('12');
  const [walletAction, setWalletAction] = useState('create');
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [saveWalletConsent, setSaveWalletConsent] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isWalletProcessed, setIsWalletProcessed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedNode, setSelectedNode] = useState(defaultNodeList[4]); // Default to https://node.wartscan.io

  useEffect(() => {
    const encryptedWallet = localStorage.getItem('warthogWallet');
    if (encryptedWallet) {
      setShowPasswordPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (wallet?.address) {
      console.log('Fetching balance for address:', wallet.address);
      fetchBalanceAndNonce(wallet.address);
    }
  }, [wallet, selectedNode]);

  const wartToE8 = (wart) => {
    try {
      const num = parseFloat(wart);
      if (isNaN(num) || num <= 0) return null;
      return Math.round(num * 100000000);
    } catch {
      return null;
    }
  };

  const fetchBalanceAndNonce = async (address) => {
    setError(null);
    setBalance(null);
    setNonceId(null);
    setPinHeight(null);
    setPinHash(null);

    try {
      const nodeBaseParam = `nodeBase=${encodeURIComponent(selectedNode)}`;
      console.log('Sending chain head request to:', `${API_URL}?nodePath=chain/head&${nodeBaseParam}`);
      const chainHeadResponse = await axios.get(`${API_URL}?nodePath=chain/head&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Chain head response status:', chainHeadResponse.status);
      const chainHeadData = chainHeadResponse.data.data || chainHeadResponse.data;
      console.log('Chain head response data:', chainHeadData);

      setPinHeight(chainHeadData.pinHeight);
      setPinHash(chainHeadData.pinHash);

      console.log('Sending balance request to:', `${API_URL}?nodePath=account/${address}/balance&${nodeBaseParam}`);
      const balanceResponse = await axios.get(`${API_URL}?nodePath=account/${address}/balance&${nodeBaseParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Balance response status:', balanceResponse.status);
      const balanceData = balanceResponse.data.data || balanceResponse.data;
      console.log('Balance response data:', balanceData);

      const balanceInWart = balanceData.balance !== undefined ? (balanceData.balance / 1).toFixed(8) : '0';
      setBalance(balanceInWart);

      if (balanceData.nonceId !== undefined) {
        const nonce = Number(balanceData.nonceId);
        if (isNaN(nonce) || nonce < 0 || nonce > 4294967295) {
          throw new Error('Invalid nonceId: must be a 32-bit unsigned integer');
        }
        setNonceId(Number(balanceData.nonceId) + 1 || 0);
      } else {
        setNonceId(0);
      }

      console.log('Chain head data:', chainHeadData);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        'Could not fetch chain head or balance';
      setError(errorMessage);
      console.error('Fetch error:', err);
    }
  };

  const encryptWallet = (walletData, password) => {
    const { privateKey, publicKey, address } = walletData;
    const walletToSave = { privateKey, publicKey, address };
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(walletToSave), password).toString();
    return encrypted;
  };

  const decryptWallet = (encrypted, password) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Invalid password');
      return JSON.parse(decrypted);
    } catch {
      throw new Error('Failed to decrypt wallet: Invalid password');
    }
  };

  const saveWallet = (walletData) => {
    if (!saveWalletConsent || !password) {
      setError('Please provide a password and consent to save the wallet');
      return false;
    }
    try {
      const encrypted = encryptWallet(walletData, password);
      localStorage.setItem('warthogWallet', encrypted);
      setWallet(walletData);
      setShowPasswordPrompt(false);
      setError(null);
      setIsWalletProcessed(true);
      setCreateResult(null);
      setDeriveResult(null);
      setPassword('');
      setSaveWalletConsent(false);
      setIsLoggedIn(true);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const downloadWallet = (walletData) => {
    if (!password) {
      setError('Please provide a password to encrypt the wallet file');
      return;
    }
    const encrypted = encryptWallet(walletData, password);
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warthog_wallet.txt';
    a.click();
    URL.revokeObjectURL(url);
    setIsWalletProcessed(true);
    setCreateResult(null);
    setDeriveResult(null);
    setPassword('');
    setSaveWalletConsent(false);
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

  const loadWallet = () => {
    if (!password) {
      setError('Please provide a password');
      return;
    }
    try {
      let encrypted;
      if (uploadedFile) {
        encrypted = uploadedFile;
      } else {
        encrypted = localStorage.getItem('warthogWallet');
        if (!encrypted) throw new Error('No wallet found in storage or file');
      }
      const decryptedWallet = decryptWallet(encrypted, password);
      setWallet(decryptedWallet);
      setShowPasswordPrompt(false);
      setUploadedFile(null);
      setError(null);
      setIsWalletProcessed(false);
      setCreateResult(null);
      setDeriveResult(null);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const clearWallet = () => {
    localStorage.removeItem('warthogWallet');
    setWallet(null);
    setBalance(null);
    setNonceId(null);
    setPinHeight(null);
    setPinHash(null);
    setError(null);
    setPassword('');
    setSaveWalletConsent(false);
    setUploadedFile(null);
    setIsWalletProcessed(false);
    setCreateResult(null);
    setDeriveResult(null);
    setIsLoggedIn(false);
  };

  const generateWallet = async (wordCount) => {
    const strengthBytes = wordCount === '12' ? 16 : 32;
    const entropy = window.crypto.getRandomValues(new Uint8Array(strengthBytes));
    const mnemonicObj = ethers.Mnemonic.fromEntropy(ethers.hexlify(entropy));
    const mnemonic = mnemonicObj.phrase;
    const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', "m/44'/2070'/0'/0/0");
    const publicKey = hdWallet.publicKey.slice(2);
    const sha = ethers.sha256('0x' + publicKey).slice(2);
    const ripemd = ethers.ripemd160('0x' + sha).slice(2);
    const checksum = ethers.sha256('0x' + ripemd).slice(2, 10);
    const address = ripemd + checksum;
    return {
      mnemonic,
      wordCount,
      privateKey: hdWallet.privateKey.slice(2),
      publicKey,
      address,
    };
  };

  const deriveWallet = (mnemonic, wordCount) => {
    try {
      const words = mnemonic.trim().split(/\s+/);
      const expectedWordCount = Number(wordCount);
      if (words.length !== expectedWordCount) {
        throw new Error(`Invalid mnemonic: must have exactly ${expectedWordCount} words`);
      }
      const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', "m/44'/2070'/0'/0/0");
      const publicKey = hdWallet.publicKey.slice(2);
      const sha = ethers.sha256('0x' + publicKey).slice(2);
      const ripemd = ethers.ripemd160('0x' + sha).slice(2);
      const checksum = ethers.sha256('0x' + ripemd).slice(2, 10);
      const address = ripemd + checksum;
      return {
        mnemonic,
        wordCount,
        privateKey: hdWallet.privateKey.slice(2),
        publicKey,
        address,
      };
    } catch (err) {
      throw new Error('Invalid mnemonic');
    }
  };

  const handleWalletAction = async () => {
    setError(null);
    setCreateResult(null);
    setDeriveResult(null);
    setIsWalletProcessed(false);

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
        data = await generateWallet(Number(wordCount));
        setCreateResult(data);
      } else {
        data = deriveWallet(mnemonic, Number(wordCount));
        setDeriveResult(data);
      }
      setShowPasswordPrompt(true);
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
    setError(null);
    setValidateResult(null);
    if (!address) {
      setError('Please enter an address');
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
    const nodeBaseParam = `nodeBase=${encodeURIComponent(selectedNode)}`;
    try {
      const response = await axios.get(`${API_URL}?nodePath=tools/encode16bit/from_string/${feeWart}&${nodeBaseParam}`);
      const feeData = response.data.data || response.data;
      return feeData.roundedE8;
    } catch (err) {
      throw new Error('Failed to round fee');
    }
  };

  const handleSendTransaction = async () => {
    setError(null);
    setSendResult(null);
    if (!toAddr || !amount || !fee) {
      setError('Please fill in all transaction fields');
      return;
    }
    const amountE8 = wartToE8(amount);
    let feeE8;
    try {
      feeE8 = await getRoundedFeeE8(fee);
    } catch {
      setError('Invalid fee or failed to round');
      return;
    }
    if (!amountE8 || !feeE8) {
      setError('Invalid amount or fee: must be positive numbers');
      return;
    }
    const txPrivateKey = wallet?.privateKey;
    if (!txPrivateKey) {
      setError('No wallet saved. Please create, derive, or log in with a wallet first.');
      return;
    }
    if (nonceId === null || pinHeight === null || pinHash === null) {
      setError('Nonce or chain head not available. Please refresh balance and try again.');
      return;
    }
    try {
      const pinHashBytes = ethers.getBytes('0x' + pinHash);
      const heightBytes = new Uint8Array(4);
      new DataView(heightBytes.buffer).setUint32(0, pinHeight, false);
      const nonceBytes = new Uint8Array(4);
      new DataView(nonceBytes.buffer).setUint32(0, nonceId, false);
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

      const nodeBaseParam = `nodeBase=${encodeURIComponent(selectedNode)}`;
      console.log('Sending transaction request to:', `${API_URL}?nodePath=transaction/add&${nodeBaseParam}`);
      const response = await axios.post(
        `${API_URL}?nodePath=transaction/add&${nodeBaseParam}`,
        {
          pinHeight,
          nonceId,
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
      setSendResult(data);
      // Clear input fields on success
      setToAddr('');
      setAmount('');
      setFee('');
      if (wallet?.address) {
        fetchBalanceAndNonce(wallet.address);
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        'Failed to send transaction';
      setError(errorMessage);
      console.error('Fetch send transaction error:', err);
    }
  };

  return (
    <div className="container">
      <h1>Warthog Wallet</h1>

      <section>
        <h2>Node Selection</h2>
        <div className="form-group">
          <label>Select Node:</label>
          <select
            value={selectedNode}
            onChange={(e) => setSelectedNode(e.target.value)}
            className="input"
          >
            {defaultNodeList.map((node, index) => (
              <option key={index} value={node}>
                {node}
              </option>
            ))}
          </select>
        </div>
      </section>

      {showPasswordPrompt && !wallet && (
        <section>
          <h2>Unlock Wallet</h2>
          <div className="form-group">
            <label>Upload Wallet File (optional):</label>
            <input type="file" accept=".txt" onChange={handleFileUpload} className="input" />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to unlock wallet"
              className="input"
            />
          </div>
          <button onClick={loadWallet}>Unlock Wallet</button>
          <button
            onClick={() => {
              setShowPasswordPrompt(false);
              setPassword('');
              setUploadedFile(null);
            }}
          >
            Cancel
          </button>
        </section>
      )}

      {wallet && (
        <section>
          <h2>Wallet</h2>
          <p className="wallet-address">
            <strong>Address:</strong> {wallet.address}
          </p>
          <p>
            <strong>Balance:</strong>{' '}
            {balance !== null ? `${balance} WART` : 'Loading...'}
          </p>
          <button onClick={() => fetchBalanceAndNonce(wallet.address)}>
            Refresh Balance
          </button>
          <button onClick={clearWallet}>Clear Wallet</button>
          <p className="warning">
            Warning: Private key is encrypted in localStorage. Keep your password secure.
          </p>
        </section>
      )}

      {!isLoggedIn && (
        <section>
          <h2>Wallet Management</h2>
          <div className="form-group">
            <label>Action:</label>
            <select
              value={walletAction}
              onChange={(e) => {
                setWalletAction(e.target.value);
                setError(null);
                setCreateResult(null);
                setDeriveResult(null);
                setMnemonic('');
                setUploadedFile(null);
                setPassword('');
                setIsWalletProcessed(false);
              }}
              className="input"
            >
              <option value="create">Create New Wallet</option>
              <option value="derive">Derive Wallet from Seed Phrase</option>
              <option value="login">Login with Wallet File</option>
            </select>
          </div>
          {walletAction === 'derive' && (
            <div className="form-group">
              <label>Seed Phrase:</label>
              <input
                type="text"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="Enter 12 or 24-word seed phrase"
                className="input"
              />
            </div>
          )}
          {walletAction === 'login' && (
            <>
              <div className="form-group">
                <label>Upload Wallet File (warthog_wallet.txt):</label>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to decrypt wallet"
                  className="input"
                />
              </div>
            </>
          )}
          {walletAction !== 'login' && (
            <div className="form-group">
              <label>Word Count:</label>
              <select
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value)}
                className="input"
              >
                <option value="12">12 Words</option>
                <option value="24">24 Words</option>
              </select>
            </div>
          )}
          <button onClick={handleWalletAction}>
            {walletAction === 'create'
              ? 'Create Wallet'
              : walletAction === 'derive'
              ? 'Derive Wallet'
              : 'Login'}
          </button>
          {(createResult || deriveResult) && !isWalletProcessed && (
            <div className="result">
              <p>
                <strong>Seed Phrase:</strong> {(createResult || deriveResult).mnemonic}
              </p>
              <p>
                <strong>Word Count:</strong> {(createResult || deriveResult).wordCount}
              </p>
              <p>
                <strong>Private Key:</strong> {(createResult || deriveResult).privateKey}
              </p>
              <p>
                <strong>Public Key:</strong> {(createResult || deriveResult).publicKey}
              </p>
              <p>
                <strong>Address:</strong> {(createResult || deriveResult).address}
              </p>
              <div className="form-group">
                <label>Password to Encrypt Wallet:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to encrypt wallet"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={saveWalletConsent}
                    onChange={(e) => setSaveWalletConsent(e.target.checked)}
                  />
                  Save wallet to localStorage (encrypted)
                </label>
              </div>
              <button onClick={() => saveWallet(createResult || deriveResult)}>
                Save Wallet
              </button>
              <button onClick={() => downloadWallet(createResult || deriveResult)}>
                Download Wallet File
              </button>
              <p className="warning">
                Warning: Store the seed phrase and password securely. Do not share them.
              </p>
            </div>
          )}
        </section>
      )}

      <section>
        <h2>Validate Address</h2>
        <div className="form-group">
          <label>Address:</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder="Enter 48-character address"
            className="input"
          />
        </div>
        <button onClick={handleValidateAddress}>Validate Address</button>
        {validateResult && (
          <div className="result">
            <pre>{JSON.stringify(validateResult, null, 2)}</pre>
          </div>
        )}
      </section>

      {isLoggedIn && (
        <section>
          <h2>Send Transaction</h2>
          <div className="form-group">
            <label>To Address:</label>
            <input
              type="text"
              value={toAddr}
              onChange={(e) => setToAddr(e.target.value.trim())}
              placeholder="Enter 48-character to address"
              className="input"
            />
          </div>
          <div className="form-group">
            <label>Amount (WART):</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              placeholder="Enter amount in WART (e.g., 1)"
              className="input"
            />
          </div>
          <div className="form-group">
            <label>Fee (WART):</label>
            <input
              type="text"
              value={fee}
              onChange={(e) => setFee(e.target.value.trim())}
              placeholder="Enter fee in WART (e.g., 0.0001)"
              className="input"
            />
          </div>
          <button onClick={handleSendTransaction}>Send Transaction</button>
          {sendResult && (
            <div className="result">
              <pre>{JSON.stringify(sendResult, null, 2)}</pre>
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default Wallet;
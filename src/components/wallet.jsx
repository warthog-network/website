import React, { useState, useEffect } from 'react';
import { generateMnemonic, mnemonicToSeed } from 'bip39';
import { getPublicKey, sign } from '@noble/secp256k1';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import CryptoJS from 'crypto-js';
import './Wallet.css';

const API_URL = 'http://195.26.246.172:3001/api/wallet'; // Proxy to http://195.26.246.172:3001/api/wallet

const Wallet = () => {
  const [createResult, setCreateResult] = useState(null);
  const [deriveResult, setDeriveResult] = useState(null);
  const [validateResult, setValidateResult] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [nonceId, setNonceId] = useState(null);
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
  }, [wallet]);

  const wartToE8 = (wart) => {
    try {
      const num = parseFloat(wart);
      if (isNaN(num) || num <= 0) {
        console.warn('wartToE8: Invalid input', { wart });
        return null;
      }
      const result = Math.round(num * 100000000);
      console.log('wartToE8: Converted', { wart, result });
      return result;
    } catch (err) {
      console.error('wartToE8: Error converting', { wart, error: err.message });
      return null;
    }
  };

  const formatBalance = (balance, apiError) => {
    if (apiError) return `Error: ${apiError}`;
    if (balance === null) return 'Loading...';
    if (balance === undefined) return 'Could not fetch balance';
    const num = parseFloat(balance) * 1; // Convert E8 to WART
    if (isNaN(num)) return 'Invalid balance';
    return `${num.toFixed(8)} WART`;
  };

  const fetchBalanceAndNonce = async (address) => {
    setError(null);
    setBalance(null);
    setNonceId(null);
    try {
      console.log('Sending balance request to:', `${API_URL}/balance`, { address });
      const response = await fetch(`${API_URL}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('Balance error response:', text);
        throw new Error(`Could not fetch balance: ${response.status}`);
      }
      const data = await response.json();
      console.log('Balance response data:', data);
      if (data.error) {
        setError(data.error);
        setBalance(null);
        return;
      }
      const balanceNum = parseFloat(data.balance);
      if (isNaN(balanceNum)) throw new Error('Invalid balance');
      setBalance(balanceNum);
      setNonceId(Number(data.nonceId) || 0);
    } catch (err) {
      setError(err.message || 'Could not fetch balance');
      setBalance(null);
      console.error('Fetch balance error:', err);
    }
  };

  const generateWallet = async (wordCount) => {
    try {
      const mnemonic = generateMnemonic(wordCount * 32); // 128 bits for 12 words, 256 for 24
      const seed = await mnemonicToSeed(mnemonic);
      const privateKey = sha256(seed.slice(0, 32)); // Derive private key
      const publicKey = getPublicKey(privateKey, true); // Compressed public key
      const address = Buffer.from(ripemd160(sha256(publicKey))).toString('hex').padStart(48, '0');
      return {
        mnemonic,
        privateKey: Buffer.from(privateKey).toString('hex'),
        publicKey: Buffer.from(publicKey).toString('hex'),
        address,
        wordCount,
      };
    } catch (err) {
      throw new Error('Failed to generate wallet: ' + err.message);
    }
  };

  const deriveWallet = async (mnemonic, wordCount) => {
    try {
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== Number(wordCount)) {
        throw new Error(`Seed phrase must have exactly ${wordCount} words`);
      }
      const seed = await mnemonicToSeed(mnemonic);
      const privateKey = sha256(seed.slice(0, 32));
      const publicKey = getPublicKey(privateKey, true);
      const address = Buffer.from(ripemd160(sha256(publicKey))).toString('hex').padStart(48, '0');
      return {
        mnemonic,
        privateKey: Buffer.from(privateKey).toString('hex'),
        publicKey: Buffer.from(publicKey).toString('hex'),
        address,
        wordCount,
      };
    } catch (err) {
      throw new Error('Failed to derive wallet: ' + err.message);
    }
  };

  const encryptWallet = (walletData, password) => {
    const { privateKey, publicKey, address } = walletData;
    const walletToSave = { privateKey, publicKey, address };
    return CryptoJS.AES.encrypt(JSON.stringify(walletToSave), password).toString();
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
    reader.onload = (e) => setUploadedFile(e.target.result);
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
    setError(null);
    setPassword('');
    setSaveWalletConsent(false);
    setUploadedFile(null);
    setIsWalletProcessed(false);
    setCreateResult(null);
    setDeriveResult(null);
    setIsLoggedIn(false);
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

    try {
      if (walletAction === 'create') {
        const walletData = await generateWallet(Number(wordCount));
        setCreateResult(walletData);
      } else if (walletAction === 'derive') {
        const walletData = await deriveWallet(mnemonic, wordCount);
        setDeriveResult(walletData);
      } else if (walletAction === 'login') {
        loadWallet();
      }
    } catch (err) {
      setError(err.message);
      clearWallet();
      console.error('Wallet action error:', err);
    }
  };

  const handleValidateAddress = async () => {
    setError(null);
    setValidateResult(null);
    if (!address) {
      setError('Please enter an address');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to validate address: ${response.status}`);
      }
      const data = await response.json();
      setValidateResult(data);
    } catch (err) {
      setError(err.message);
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
  const feeE8 = wartToE8(fee);
  if (!amountE8 || !feeE8) {
    setError('Invalid amount or fee');
    return;
  }
  const txPrivateKey = wallet?.privateKey;
  if (!txPrivateKey) {
    setError('No wallet saved');
    return;
  }
  if (nonceId === null) {
    setError('Nonce not available');
    return;
  }
  try {
    // Fetch chain head to get pinHeight and pinHash
    const headResponse = await fetch(`${API_URL}/chain/head`);
    if (!headResponse.ok) {
      throw new Error(`Failed to fetch chain head: ${headResponse.status}`);
    }
    const head = await headResponse.json();
    const { pinHeight, pinHash } = head.data;

    // Encode feeE8 to match server's roundedFeeE8
    const encodeResponse = await fetch(`${API_URL}/tools/encode16bit/from_e8/${feeE8}`);
    if (!encodeResponse.ok) {
      throw new Error(`Failed to encode fee: ${encodeResponse.status}`);
    }
    const encodeResult = await encodeResponse.json();
    const roundedFeeE8 = encodeResult.data.roundedE8;

    // Construct the message to sign (matching server logic)
    const buf1 = Buffer.from(pinHash, 'hex');
    const buf2 = Buffer.alloc(19);
    buf2.writeUInt32BE(pinHeight, 0);
    buf2.writeUInt32BE(nonceId, 4);
    buf2.writeUInt8(0, 8);
    buf2.writeUInt8(0, 9);
    buf2.writeUInt8(0, 10);
    buf2.writeBigUInt64BE(BigInt(roundedFeeE8), 11);
    const buf3 = Buffer.from(toAddr.slice(0, 40), 'hex'); // Use first 40 chars (20 bytes)
    const buf4 = Buffer.alloc(8);
    buf4.writeBigUInt64BE(BigInt(amountE8), 0);
    const toSign = Buffer.concat([buf1, buf2, buf3, buf4]);

    // Sign the message
    const messageHash = sha256(toSign);
    const signature = await sign(messageHash, txPrivateKey); // Returns [signature, recovery]
    const signatureWithoutRecid = Buffer.from(signature[0]);
    // Normalize signature to ensure low-S form
    const signatureWithoutRecidNormalized = signatureWithoutRecid; // @noble/secp256k1 already normalizes
    const recid = signature[1];
    const recidBuffer = Buffer.alloc(1);
    recidBuffer.writeUInt8(recid);
    const signature65 = Buffer.concat([signatureWithoutRecidNormalized, recidBuffer]);

    // Prepare transaction data
    const tx = {
      pinHeight,
      nonceId,
      toAddr,
      amountE8,
      feeE8: roundedFeeE8,
      signature65: signature65.toString('hex'),
    };
    console.log('Sending transaction:', tx);

    // Send transaction to server
    const response = await fetch(`${API_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to send transaction: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log('Transaction response:', data);
    setSendResult(data);
    if (wallet?.address) {
      fetchBalanceAndNonce(wallet.address);
    }
  } catch (err) {
    setError(err.message || 'Failed to send transaction');
    console.error('Send transaction error:', err);
  }
};

  return (
    <div className="container">
      <h1>Warthog Wallet</h1>

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
          <button onClick={() => { setShowPasswordPrompt(false); setPassword(''); setUploadedFile(null); }}>
            Cancel
          </button>
        </section>
      )}

      {wallet && (
        <section>
          <h2>Wallet</h2>
          <p className="wallet-address"><strong>Address:</strong> {wallet.address}</p>
          <p><strong>Balance:</strong> {formatBalance(balance, error)}</p>
          <button onClick={() => fetchBalanceAndNonce(wallet.address)}>Refresh Balance</button>
          <button onClick={clearWallet}>Clear Wallet</button>
          <p className="warning">Warning: Private key is encrypted in localStorage or file. Keep your password secure.</p>
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
            {walletAction === 'create' ? 'Create Wallet' : walletAction === 'derive' ? 'Derive Wallet' : 'Login'}
          </button>
          {(createResult || deriveResult) && !isWalletProcessed && (
            <div className="result">
              <p><strong>Seed Phrase:</strong> {(createResult || deriveResult).mnemonic}</p>
              <p><strong>Word Count:</strong> {(createResult || deriveResult).wordCount}</p>
              <p><strong>Private Key:</strong> {(createResult || deriveResult).privateKey}</p>
              <p><strong>Public Key:</strong> {(createResult || deriveResult).publicKey}</p>
              <p><strong>Address:</strong> {(createResult || deriveResult).address}</p>
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
              <p className="warning">Warning: Store the seed phrase and password securely. Do not share them.</p>
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
            <p><strong>Valid:</strong> {validateResult.valid ? 'No' : 'Yes'}</p>
            {validateResult.message && <p><strong>Message:</strong> {validateResult.message}</p>}
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
import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import './Wallet.css';

const API_URL = '/api/wallet';
// const API_URL = 'http://195.26.246.172:3001/api/wallet'; // Uncomment for local testing

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
      console.log('Fetching balance for address:', wallet.address); // Debug log
      fetchBalanceAndNonce(wallet.address);
    }
  }, [wallet]);

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
    try {
      console.log('Sending balance request to:', `${API_URL}/balance`, { address }); // Debug log
      const response = await fetch(`${API_URL}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      console.log('Balance response status:', response.status, 'OK:', response.ok); // Debug log
      if (!response.ok) {
        const text = await response.text();
        console.error('Balance error response:', text);
        throw new Error(`Failed to fetch balance: ${response.status} ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      console.log('Balance response content-type:', contentType); // Debug log
      let data;
      try {
        data = await response.json();
        console.log('Balance response data:', data); // Debug log
      } catch (err) {
        const text = await response.text();
        console.error('Failed to parse JSON:', text);
        throw new Error('Received invalid JSON response from server');
      }
      setBalance(data.balance !== undefined ? data.balance.toString() : '0');
      if (data.nonceId !== undefined) {
        const nonce = Number(data.nonceId);
        if (isNaN(nonce) || nonce < 0 || nonce > 4294967295) {
          throw new Error('Invalid nonceId: must be a 32-bit unsigned integer');
        }
        setNonceId(nonce);
      } else {
        setNonceId(0);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch balance');
      setBalance('0'); // Fallback to show 0 instead of "Loading..."
      console.error('Fetch balance error:', err);
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
      const endpoint = walletAction === 'create' ? 'create' : 'derive-from-mnemonic';
      console.log(`Sending ${walletAction} request to:`, `${API_URL}/${endpoint}`); // Debug log
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(walletAction === 'create' ? { wordCount: Number(wordCount) } : { mnemonic, wordCount: Number(wordCount) }),
      });
      console.log(`${walletAction} response status:`, response.status, 'OK:', response.ok); // Debug log
      if (!response.ok) {
        const text = await response.text();
        console.error(`Fetch ${endpoint} error response:`, text);
        throw new Error(`Failed to ${walletAction} wallet: ${response.status} ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      console.log(`${walletAction} response content-type:`, contentType); // Debug log
      let data;
      try {
        data = await response.json();
        console.log(`${walletAction} response data:`, data); // Debug log
      } catch (err) {
        const text = await response.text();
        console.error('Failed to parse JSON:', text);
        throw new Error('Received invalid JSON response from server');
      }
      if (walletAction === 'create') {
        setCreateResult(data);
      } else {
        setDeriveResult(data);
      }
      setShowPasswordPrompt(true);
    } catch (err) {
      setError(err.message || `Failed to ${walletAction} wallet`);
      clearWallet();
      console.error(`Fetch ${walletAction} error:`, err);
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
      console.log('Sending validate request to:', `${API_URL}/validate`, { address }); // Debug log
      const response = await fetch(`${API_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      console.log('Validate response status:', response.status, 'OK:', response.ok); // Debug log
      if (!response.ok) {
        const text = await response.text();
        console.error('Fetch validate error response:', text);
        throw new Error(`Failed to validate address: ${response.status} ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      console.log('Validate response content-type:', contentType); // Debug log
      let data;
      try {
        data = await response.json();
        console.log('Validate response data:', data); // Debug log
      } catch (err) {
        const text = await response.text();
        console.error('Failed to parse JSON:', text);
        throw new Error('Received invalid JSON response from server');
      }
      setValidateResult(data);
    } catch (err) {
      setError(err.message || 'Failed to validate address');
      console.error('Fetch validate error:', err);
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
      setError('Invalid amount or fee: must be positive numbers');
      return;
    }
    const txPrivateKey = wallet?.privateKey;
    if (!txPrivateKey) {
      setError('No wallet saved. Please create, derive, or log in with a wallet first.');
      return;
    }
    if (nonceId === null) {
      setError('Nonce not available. Please refresh balance and try again.');
      return;
    }
    try {
      console.log('Sending transaction request to:', `${API_URL}/send`, { toAddr, amountE8, feeE8, nonceId }); // Debug log
      const response = await fetch(`${API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: txPrivateKey,
          toAddr,
          amountE8,
          feeE8,
          nonceId,
        }),
      });
      console.log('Send transaction response status:', response.status, 'OK:', response.ok); // Debug log
      if (!response.ok) {
        const text = await response.text();
        console.error('Fetch send transaction error response:', text);
        throw new Error(`Failed to send transaction: ${response.status} ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      console.log('Send transaction response content-type:', contentType); // Debug log
      let data;
      try {
        data = await response.json();
        console.log('Send transaction response data:', data); // Debug log
      } catch (err) {
        const text = await response.text();
        console.error('Failed to parse JSON:', text);
        throw new Error('Received invalid JSON response from server');
      }
      setSendResult(data);
      if (wallet?.address) {
        fetchBalanceAndNonce(wallet.address);
      }
    } catch (err) {
      setError(err.message || 'Failed to send transaction');
      console.error('Fetch send transaction error:', err);
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
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>Balance:</strong> {balance !== null ? `${balance} WART` : 'Loading...'}</p>
          <button onClick={() => fetchBalanceAndNonce(wallet.address)}>Refresh Balance</button>
          <button onClick={clearWallet}>Clear Wallet</button>
          <p className="warning">Warning: Private key is encrypted in localStorage. Keep your password secure.</p>
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
            <pre>{JSON.stringify(validateResult, null, 2)}</pre>
          </div>
        )}
      </section>

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

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default Wallet;
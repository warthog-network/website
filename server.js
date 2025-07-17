const express = require('express');
const { verify, recoverPublicKey } = require('@noble/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const cors = require('cors');
const fetch = require('node-fetch').default;
const bip39 = require('bip39');
const HDKey = require('hdkey');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3001;
const WARTHOG_NODE_URL = 'http://51.75.21.134:3001';

// Middleware
app.use(cors({ origin: 'http://localhost:4321' | 'https://astohogdev.com' }));
app.use(express.json());

// Helper function to validate hex string
const isValidHex = (hex) => /^[0-9a-fA-F]+$/.test(hex);

// Convert WART string to E8 integer
const wartToE8 = (wart) => {
  try {
    const num = parseFloat(wart);
    if (isNaN(num) || num <= 0) return null;
    return Math.round(num * 100000000);
  } catch {
    return null;
  }
};

// Convert balance to WART string
const toWart = (balance) => {
  try {
    const num = Number(balance);
    if (isNaN(num)) return '0';
    return (num / 100000000).toString(); // Convert E8 to WART
  } catch {
    return '0';
  }
};

// Generate a new wallet with mnemonic
app.post('/api/wallet/create', (req, res) => {
  const { wordCount = 12 } = req.body;

  if (![12, 24].includes(Number(wordCount))) {
    return res.status(400).json({ error: 'Word count must be 12 or 24' });
  }

  try {
    const entropyBits = wordCount === 12 ? 128 : 256;
    const entropyBytes = entropyBits / 8;
    const entropy = crypto.randomBytes(entropyBytes);
    const mnemonic = bip39.entropyToMnemonic(entropy);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive("m/44'/0'/0'/0/0");
    const privateKey = derived.privateKey.toString('hex').padStart(64, '0');
    const publicKey = Buffer.from(
      require('@noble/secp256k1').getPublicKey(privateKey, true)
    ).toString('hex');
    const sha = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest();
    const addrRaw = crypto.createHash('ripemd160').update(sha).digest();
    const checksum = crypto.createHash('sha256').update(addrRaw).digest().slice(0, 4);
    const address = Buffer.concat([addrRaw, checksum]).toString('hex');

    res.status(200).json({
      mnemonic,
      wordCount,
      privateKey,
      publicKey,
      address,
    });
  } catch (error) {
    console.error('Create wallet error:', error);
    res.status(500).json({ error: 'Failed to create wallet', details: error.message });
  }
});

// Derive wallet from mnemonic
app.post('/api/wallet/derive-from-mnemonic', (req, res) => {
  const { mnemonic, wordCount = 12 } = req.body;

  if (!mnemonic || typeof mnemonic !== 'string') {
    return res.status(400).json({ error: 'Invalid mnemonic: must be a string' });
  }
  if (![12, 24].includes(Number(wordCount))) {
    return res.status(400).json({ error: 'Word count must be 12 or 24' });
  }

  try {
    const isValid = bip39.validateMnemonic(mnemonic);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid mnemonic: does not conform to BIP-39' });
    }

    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== Number(wordCount)) {
      return res.status(400).json({ error: `Mnemonic must have exactly ${wordCount} words` });
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive("m/44'/0'/0'/0/0");
    const privateKey = derived.privateKey.toString('hex').padStart(64, '0');
    const publicKey = Buffer.from(
      require('@noble/secp256k1').getPublicKey(privateKey, true)
    ).toString('hex');
    const sha = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest();
    const addrRaw = crypto.createHash('ripemd160').update(sha).digest();
    const checksum = crypto.createHash('sha256').update(addrRaw).digest().slice(0, 4);
    const address = Buffer.concat([addrRaw, checksum]).toString('hex');

    res.status(200).json({
      mnemonic,
      wordCount,
      privateKey,
      publicKey,
      address,
    });
  } catch (error) {
    console.error('Derive wallet error:', error);
    res.status(500).json({ error: 'Failed to derive wallet from mnemonic', details: error.message });
  }
});

// Validate an address
app.post('/api/wallet/validate', (req, res) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || !isValidHex(address) || address.length !== 48) {
    return res.status(400).json({
      valid: false,
      message: 'Invalid address: must be a 48-character hex string',
    });
  }

  try {
    const addrBuffer = Buffer.from(address, 'hex');
    const addrRaw = addrBuffer.slice(0, 20);
    const providedChecksum = addrBuffer.slice(20, 24);
    const recalculatedChecksum = crypto.createHash('sha256').update(addrRaw).digest().slice(0, 4);
    const isValid = providedChecksum.equals(recalculatedChecksum);

    res.status(200).json({
      address,
      valid: isValid,
      message: isValid ? 'Address is valid' : 'Address checksum is invalid',
    });
  } catch (error) {
    console.error('Validate address error:', error);
    res.status(500).json({ error: 'Failed to validate address', details: error.message });
  }
});

// Get wallet balance
app.post('/api/wallet/balance', async (req, res) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || !isValidHex(address) || address.length !== 48) {
    return res.status(400).json({
      error: 'Invalid address: must be a 48-character hex string',
    });
  }

  try {
    const response = await fetch(`${WARTHOG_NODE_URL}/account/${address}/balance`);
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`Balance response for ${address}:`, data);
    const balanceRaw = data.data?.balance || 0;
    const balanceWart = toWart(balanceRaw);
    const balanceE8 = Number(balanceRaw);
    const nonceId = data.data?.nonce || 0; // Include nonce from node response
    console.log(`Balance: ${balanceRaw} E8 -> ${balanceWart} WART, Nonce: ${nonceId}`);

    res.status(200).json({
      address,
      balance: balanceWart,
      balanceE8,
      nonceId,
    });
  } catch (error) {
    console.error(`Error fetching balance for ${address}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch balance', details: error.message });
  }
});

// Send a signed transaction
app.post('/api/wallet/send', async (req, res) => {
  const { pinHeight, nonceId, toAddr, amountE8, feeE8, signature65 } = req.body;

  // Validate inputs
  if (!toAddr || !isValidHex(toAddr) || toAddr.length !== 48) {
    return res.status(400).json({ error: 'Invalid toAddr: must be a 48-character hex string' });
  }
  if (!Number.isInteger(amountE8) || amountE8 <= 0) {
    return res.status(400).json({ error: 'Invalid amountE8: must be a positive integer' });
  }
  if (!Number.isInteger(feeE8) || feeE8 <= 0) {
    return res.status(400).json({ error: 'Invalid feeE8: must be a positive integer' });
  }
  if (!Number.isInteger(nonceId) || nonceId < 0 || nonceId > 0xffffffff) {
    return res.status(400).json({ error: 'Invalid nonceId: must be a 32-bit unsigned integer' });
  }
  if (!signature65 || !isValidHex(signature65) || signature65.length !== 130) {
    return res.status(400).json({ error: 'Invalid signature65: must be a 130-character hex string (65 bytes)' });
  }
  if (!Number.isInteger(pinHeight) || pinHeight < 0) {
    return res.status(400).json({ error: 'Invalid pinHeight: must be a non-negative integer' });
  }

  try {
    // Fetch chain head to validate pinHeight and pinHash
    const headResponse = await fetch(`${WARTHOG_NODE_URL}/chain/head`);
    if (!headResponse.ok) {
      throw new Error('Failed to fetch chain head');
    }
    const head = await headResponse.json();
    const { pinHeight: currentPinHeight, pinHash } = head.data;
    if (pinHeight !== currentPinHeight) {
      return res.status(400).json({ error: `Invalid pinHeight: expected ${currentPinHeight}, got ${pinHeight}` });
    }

    // Reconstruct the message to verify signature
    const buf1 = Buffer.from(pinHash, 'hex');
    const buf2 = Buffer.alloc(19);
    buf2.writeUInt32BE(pinHeight, 0);
    buf2.writeUInt32BE(nonceId, 4);
    buf2.writeUInt8(0, 8);
    buf2.writeUInt8(0, 9);
    buf2.writeUInt8(0, 10);
    buf2.writeBigUInt64BE(BigInt(feeE8), 11);
    const buf3 = Buffer.from(toAddr.slice(0, 40), 'hex');
    const buf4 = Buffer.alloc(8);
    buf4.writeBigUInt64BE(BigInt(amountE8), 0);
    const toSign = Buffer.concat([buf1, buf2, buf3, buf4]);

    const signHash = sha256(toSign);
    const signatureBytes = Buffer.from(signature65, 'hex');
    const signatureWithoutRecid = signatureBytes.slice(0, 64);
    const recid = signatureBytes[64];

    // Derive public key from signature
    const publicKey = await recoverPublicKey(signHash, signatureWithoutRecid, recid);
    const publicKeyHex = Buffer.from(publicKey).toString('hex');

    // Verify signature
    const isValidSignature = await verify(signatureWithoutRecid, signHash, publicKey, { strict: true });
    if (!isValidSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Derive address from public key to verify sender
    const sha = crypto.createHash('sha256').update(Buffer.from(publicKey)).digest();
    const addrRaw = crypto.createHash('ripemd160').update(sha).digest();
    const checksum = crypto.createHash('sha256').update(addrRaw).digest().slice(0, 4);
    const derivedAddress = Buffer.concat([addrRaw, checksum]).toString('hex');

    // Fetch balance and nonce to validate transaction
    const balanceResponse = await fetch(`${WARTHOG_NODE_URL}/account/${derivedAddress}/balance`);
    if (!balanceResponse.ok) {
      throw new Error(`Failed to fetch balance for ${derivedAddress}`);
    }
    const balanceData = await balanceResponse.json();
    const balanceE8 = Number(balanceData.data?.balance || 0);
    const currentNonce = Number(balanceData.data?.nonce || 0);

    if (currentNonce !== nonceId) {
      return res.status(400).json({ error: `Invalid nonce: expected ${currentNonce}, got ${nonceId}` });
    }
    if (balanceE8 < amountE8 + feeE8) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Submit transaction to Warthog node
    const postdata = {
      pinHeight,
      nonceId,
      toAddr,
      amountE8,
      feeE8,
      signature65,
    };
    const txResponse = await fetch(`${WARTHOG_NODE_URL}/transaction/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postdata),
    });
    const txResult = await txResponse.json();

    if (!txResponse.ok) {
      return res.status(500).json({ error: 'Failed to send transaction to node', details: txResult });
    }

    res.status(200).json({
      success: true,
      transactionId: txResult.data?.transactionId || `tx_${Date.now()}`,
      from: derivedAddress,
      to: toAddr,
      amount: toWart(amountE8),
      fee: toWart(feeE8),
      nonceId,
    });
  } catch (error) {
    console.error('Send transaction error:', error);
    res.status(500).json({ error: 'Failed to send transaction', details: error.message });
  }
});

// Proxy chain/head endpoint
app.get('/api/wallet/chain/head', async (req, res) => {
  try {
    const response = await fetch(`${WARTHOG_NODE_URL}/chain/head`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chain head: ${response.statusText}`);
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Chain head error:', error);
    res.status(500).json({ error: 'Failed to fetch chain head', details: error.message });
  }
});

// Proxy encode16bit endpoint
app.get('/api/wallet/tools/encode16bit/from_e8/:feeE8', async (req, res) => {
  const { feeE8 } = req.params;
  try {
    const response = await fetch(`${WARTHOG_NODE_URL}/tools/encode16bit/from_e8/${feeE8}`);
    if (!response.ok) {
      throw new Error(`Failed to encode fee: ${response.statusText}`);
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Encode fee error:', error);
    res.status(500).json({ error: 'Failed to encode fee', details: error.message });
  }
});

// Check connection to Warthog node before starting server
async function checkWarthogNode() {
  try {
    const response = await fetch(`${WARTHOG_NODE_URL}/chain/head`);
    if (response.ok) {
      console.log(`Connected to Warthog node at ${WARTHOG_NODE_URL}`);
    } else {
      console.warn(`Warning: Failed to connect to Warthog node at ${WARTHOG_NODE_URL} - ${response.statusText}`);
    }
  } catch (error) {
    console.warn(`Warning: Failed to connect to Warthog node at ${WARTHOG_NODE_URL} - ${error.message}`);
  }
}

// Start server
checkWarthogNode().then(() => {
  app.listen(port, () => {
    console.log(`Warthog Wallet API running on port ${port}`);
  });
});
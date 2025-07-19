const fetch = require('node-fetch');
const { generateMnemonic, mnemonicToSeed } = require('bip39');
const { getPublicKey } = require('secp256k1');
const { ripemd160 } = require('@noble/hashes/ripemd160');
const { sha256 } = require('@noble/hashes/sha256');

const WARTHOG_NODE_URL = 'http://51.75.21.134:3001';

// Helper function to validate hex string
const isValidHex = (hex) => /^[0-9a-fA-F]+$/.test(hex);

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

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': 'http://localhost:4321',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const path = event.path;
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // Create a new wallet
    if (method === 'POST' && path === '/api/wallet/create') {
      const { wordCount } = body;
      if (!wordCount || (wordCount !== 12 && wordCount !== 24)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid word count: must be 12 or 24' }),
        };
      }
      const mnemonic = generateMnemonic(wordCount * 32);
      const seed = await mnemonicToSeed(mnemonic);
      const privateKey = sha256(seed.slice(0, 32));
      const publicKey = getPublicKey(privateKey, true);
      const sha = sha256(publicKey);
      const addrRaw = ripemd160(sha);
      const checksum = sha256(addrRaw).slice(0, 4);
      const address = Buffer.concat([addrRaw, checksum]).toString('hex');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mnemonic,
          privateKey: Buffer.from(privateKey).toString('hex'),
          publicKey: Buffer.from(publicKey).toString('hex'),
          address,
          wordCount,
        }),
      };
    }

    // Derive wallet from mnemonic
    if (method === 'POST' && path === '/api/wallet/derive-from-mnemonic') {
      const { mnemonic, wordCount } = body;
      if (!mnemonic || typeof mnemonic !== 'string') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid mnemonic: must be a non-empty string' }),
        };
      }
      if (!wordCount || (wordCount !== 12 && wordCount !== 24)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid word count: must be 12 or 24' }),
        };
      }
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== wordCount) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Mnemonic must have exactly ${wordCount} words` }),
        };
      }
      const seed = await mnemonicToSeed(mnemonic);
      const privateKey = sha256(seed.slice(0, 32));
      const publicKey = getPublicKey(privateKey, true);
      const sha = sha256(publicKey);
      const addrRaw = ripemd160(sha);
      const checksum = sha256(addrRaw).slice(0, 4);
      const address = Buffer.concat([addrRaw, checksum]).toString('hex');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mnemonic,
          privateKey: Buffer.from(privateKey).toString('hex'),
          publicKey: Buffer.from(publicKey).toString('hex'),
          address,
          wordCount,
        }),
      };
    }

    // Validate address
    if (method === 'POST' && path === '/api/wallet/validate') {
      const { address } = body;
      if (!address || typeof address !== 'string' || !isValidHex(address) || address.length !== 48) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ isValid: false, message: 'Invalid address: must be a 48-character hex string' }),
        };
      }
      const addrRaw = Buffer.from(address.slice(0, 40), 'hex');
      const checksum = Buffer.from(address.slice(40), 'hex');
      const computedChecksum = sha256(addrRaw).slice(0, 4);
      const isValid = Buffer.compare(checksum, computedChecksum) === 0;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ isValid, message: isValid ? 'Valid address' : 'Invalid checksum' }),
      };
    }

    // Fetch balance
    if (method === 'POST' && path === '/api/wallet/balance') {
      const { address } = body;
      if (!address || typeof address !== 'string' || !isValidHex(address) || address.length !== 48) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid address: must be a 48-character hex string' }),
        };
      }
      const response = await fetch(`${WARTHOG_NODE_URL}/account/${address}/balance`);
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }
      const data = await response.json();
      const balance = toWart(data.data?.balance || '0');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ address, balance }),
      };
    }

    // Fetch nonce
    if (method === 'POST' && path === '/api/wallet/nonce') {
      const { address } = body;
      if (!address || typeof address !== 'string' || !isValidHex(address) || address.length !== 48) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid address: must be a 48-character hex string' }),
        };
      }
      const response = await fetch(`${WARTHOG_NODE_URL}/account/${address}/nonce`);
      if (!response.ok) {
        throw new Error(`Failed to fetch nonce: ${response.statusText}`);
      }
      const data = await response.json();
      const nonceId = Number(data.data?.nonceId) || 0;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ address, nonceId }),
      };
    }

    // Proxy /chain/head
    if (method === 'GET' && path === '/api/chain/head') {
      const response = await fetch(`${WARTHOG_NODE_URL}/chain/head`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chain head: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data),
      };
    }

    // Proxy /tools/encode16bit/from_e8/:feeE8
    if (method === 'GET' && path.startsWith('/api/tools/encode16bit/from_e8/')) {
      const feeE8 = path.split('/').pop();
      const response = await fetch(`${WARTHOG_NODE_URL}/tools/encode16bit/from_e8/${feeE8}`);
      if (!response.ok) {
        throw new Error(`Failed to encode fee: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data),
      };
    }

    // Send a signed transaction
    if (method === 'POST' && path === '/api/wallet/send') {
      const { pinHeight, nonceId, toAddr, amountE8, feeE8, signature65 } = body;

      if (!Number.isInteger(pinHeight) || pinHeight < 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid pinHeight: must be a non-negative integer' }),
        };
      }
      if (!Number.isInteger(nonceId) || nonceId < 0 || nonceId > 0xffffffff) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid nonceId: must be a 32-bit unsigned integer' }),
        };
      }
      if (!toAddr || typeof toAddr !== 'string' || !isValidHex(toAddr) || toAddr.length !== 48) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid toAddr: must be a 48-character hex string' }),
        };
      }
      if (!Number.isInteger(amountE8) || amountE8 <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid amountE8: must be a positive integer' }),
        };
      }
      if (!Number.isInteger(feeE8) || feeE8 <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid feeE8: must be a positive integer' }),
        };
      }
      if (!signature65 || typeof signature65 !== 'string' || !isValidHex(signature65) || signature65.length !== 130) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid signature65: must be a 130-character hex string' }),
        };
      }

      const postdata = {
        pinHeight,
        nonceId,
        toAddr,
        amountE8,
        feeE8,
        signature65,
      };

      const response = await fetch(`${WARTHOG_NODE_URL}/transaction/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postdata),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send transaction: ${response.status} - ${text}`);
      }
      const data = await response.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, result: data }),
      };
    }

    // Handle unknown routes
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: `Cannot ${method} ${path}` }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', details: error.message }),
    };
  }
};
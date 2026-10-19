/**
 * Browser port of ledgerblue's sideload channel (runScript --scp).
 * The device still asks the holder to approve. This does not touch the seed.
 */
import { etc, CURVE, getPublicKey, getSharedSecret, sign, utils, verify } from "@noble/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";

if (!etc.hmacSha256Sync) {
  etc.hmacSha256Sync = (key, ...msgs) => hmac(sha256, key, etc.concatBytes(...msgs));
}

const SCP_MAC_LENGTH = 14;

const STATUS_CAUSE = {
  0x6982: "Remove the custom certificate on this Ledger first, then try again.",
  0x6985:
    "The Ledger rejected the manager. On a Nano, press the right button until the screen says Allow unsafe manager, then press both buttons. Both buttons on the Deny screen reject the install.",
  0x6a83: "This app needs another app installed first.",
  0x6a84: "The Ledger does not have enough room. Remove an app in Ledger Wallet, then try again.",
  0x6a85: "The Ledger does not have enough room. Remove an app in Ledger Wallet, then try again.",
  0x6484: "This file does not match the plugged-in Ledger. Choose the install for this device.",
  0x5515: "The Ledger is locked. Enter the PIN and try again.",
  0x6814: "This file does not match the plugged-in Ledger. Choose the install for this device.",
  0x511f: "Update the Ledger in Ledger Wallet, then try again. This app was built for a newer OS.",
  0x5120: "This Ledger cannot sideload the file. A Nano X will not accept it.",
  0x5708: "The Ledger rejected a signature in the install handshake. Stay on the home screen and try again.",
  0x6d00: "Close the open app until the home screen with the app icons is showing, then try again.",
  0x6e00: "Close the open app until the home screen with the app icons is showing, then try again.",
};

export class LedgerStatusError extends Error {
  constructor(sw, detail = "") {
    const code = sw & 0xffff;
    const cause = STATUS_CAUSE[code] || "The Ledger refused the command.";
    super(detail ? `${cause} (status ${hex4(code)}). ${detail}` : `${cause} (status ${hex4(code)}).`);
    this.name = "LedgerStatusError";
    this.sw = code;
  }
}

export function hex4(sw) {
  return sw.toString(16).padStart(4, "0");
}

export function bytesToHex(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex) {
  const clean = hex.trim().replace(/\s+/g, "");
  if (clean.length % 2 !== 0) throw new Error("The installer file has a broken line.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function concatBytes(...parts) {
  const list = parts.map((part) => (part instanceof Uint8Array ? part : Uint8Array.from(part)));
  const len = list.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const part of list) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u32be(value) {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value, false);
  return out;
}

export function parseApduScript(text) {
  const apdus = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const bytes = hexToBytes(trimmed);
    if (bytes.length < 5) continue;
    if (bytes.length !== 5 + bytes[4]) {
      throw new Error("A command in the installer file has the wrong length.");
    }
    apdus.push(bytes);
  }
  if (apdus.length === 0) throw new Error("The installer file is empty.");
  return apdus;
}

export function parseAppVersion(data) {
  if (data.length < 2) throw new Error("The Ledger reply was too short.");
  const sw = (data[data.length - 2] << 8) | data[data.length - 1];
  if (sw === 0x5515) throw new LedgerStatusError(sw);
  if (sw !== 0x9000) throw new LedgerStatusError(sw, "Open the home screen and try again.");
  const body = data.subarray(0, data.length - 2);
  if (body.length < 3) throw new Error("The Ledger reply is missing the app name.");
  const nameLen = body[1];
  const nameAt = 2;
  if (nameLen > 128 || nameAt + nameLen >= body.length) throw new Error("The Ledger app name did not fit.");
  const name = new TextDecoder().decode(body.subarray(nameAt, nameAt + nameLen));
  const versionLenAt = nameAt + nameLen;
  const versionLen = body[versionLenAt];
  const versionAt = versionLenAt + 1;
  if (versionLen > 64 || versionAt + versionLen > body.length) throw new Error("The Ledger app version did not fit.");
  const version = new TextDecoder().decode(body.subarray(versionAt, versionAt + versionLen));
  if (!name && !version) throw new Error("The Ledger reply had an empty name and version.");
  return { name, version };
}

const HOME_NAMES = new Set(["bolos", "dashboard"]);

export function describeApp(app, expectedVersion, approve = "Press both buttons at the same time.") {
  const name = app?.name || "";
  const version = app?.version || "";
  const seen = `${name} ${version}`.trim();
  const view = {
    homeScreen: false,
    readyToInstall: false,
    versionMatches: false,
    headline: "The Ledger did not answer.",
    detail: "Unlock it and click Check my Ledger.",
  };
  if (HOME_NAMES.has(name.toLowerCase())) {
    view.homeScreen = true;
    view.readyToInstall = true;
    view.headline = "Connected. The Ledger is unlocked on the home screen.";
    view.detail = `Click Install Warthog ${expectedVersion}. Stay on the app icons until it finishes. When it asks, approve it. ${approve}`;
  } else if (name.toLowerCase() === "warthog" && version === expectedVersion) {
    view.versionMatches = true;
    view.headline = `Warthog ${version} is open. That is the published version.`;
    view.detail = "To install it again, close Warthog until the home screen with the app icons is showing.";
  } else if (name.toLowerCase() === "warthog") {
    view.headline = `Warthog ${version} is open. The published file is ${expectedVersion}.`;
    view.detail = "Close Warthog until the home screen is showing, then click Install.";
  } else if (name) {
    view.headline = `${seen} is open on the Ledger.`;
    view.detail = "Close it until the home screen with the app icons is showing. Installing works from that screen.";
  }
  return view;
}

function derEncode(signature) {
  const part = (value) => {
    let hex = value.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    let bytes = hexToBytes(hex);
    if (bytes[0] & 0x80) {
      const padded = new Uint8Array(bytes.length + 1);
      padded.set(bytes, 1);
      bytes = padded;
    }
    const out = new Uint8Array(2 + bytes.length);
    out[0] = 0x02;
    out[1] = bytes.length;
    out.set(bytes, 2);
    return out;
  };
  const r = part(signature.r);
  const s = part(signature.s);
  const body = concatBytes(r, s);
  if (body.length > 127) throw new Error("The signature encoding is too long.");
  const out = new Uint8Array(2 + body.length);
  out[0] = 0x30;
  out[1] = body.length;
  out.set(body, 2);
  return out;
}

function derDecode(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x30) throw new Error("The Ledger certificate signature is not in the expected form.");
  let offset = 2;
  if (bytes[1] & 0x80) throw new Error("The Ledger certificate signature is too long.");
  const readInt = () => {
    if (bytes[offset] !== 0x02) throw new Error("The Ledger certificate signature is not in the expected form.");
    const len = bytes[offset + 1];
    const start = offset + 2;
    const end = start + len;
    if (end > bytes.length) throw new Error("The Ledger certificate signature is truncated.");
    offset = end;
    let slice = bytes.subarray(start, end);
    if (slice[0] === 0x00) slice = slice.subarray(1);
    let hex = bytesToHex(slice);
    if (!hex) hex = "0";
    return BigInt(`0x${hex}`);
  };
  const r = readInt();
  const s = readInt();
  return { r, s };
}

export function signMessageDer(message, privateKey) {
  const digest = sha256(message);
  return derEncode(sign(digest, privateKey));
}

function ecdsaVerify(signature, message, publicKey) {
  try {
    const digest = sha256(message);
    const { r, s } = derDecode(signature);
    return verify({ r, s }, digest, publicKey);
  } catch {
    return false;
  }
}

function ecdhSecret(privateKey, publicKey) {
  const compressed = getSharedSecret(privateKey, publicKey, true);
  return sha256(compressed);
}

function readLv(bytes, offset) {
  if (offset >= bytes.length) throw new Error("The Ledger certificate ended early.");
  const len = bytes[offset];
  const start = offset + 1;
  const end = start + len;
  if (end > bytes.length) throw new Error("The Ledger certificate length does not fit.");
  return { value: bytes.subarray(start, end), next: end };
}

export function parseDeviceCert(bytes) {
  const header = readLv(bytes, 0);
  const publicKey = readLv(bytes, header.next);
  const signature = readLv(bytes, publicKey.next);
  return { header: header.value, publicKey: publicKey.value, signature: signature.value };
}

function command(cla, ins, p1, p2, data) {
  const out = new Uint8Array(5 + data.length);
  out[0] = cla;
  out[1] = ins;
  out[2] = p1;
  out[3] = p2;
  out[4] = data.length;
  out.set(data, 5);
  return out;
}

function pair(left, right) {
  if (left.length > 255 || right.length > 255) throw new Error("A certificate field is too long to send.");
  const out = new Uint8Array(2 + left.length + right.length);
  out[0] = left.length;
  out.set(left, 1);
  out[1 + left.length] = right.length;
  out.set(right, 2 + left.length);
  return out;
}

function pad80(data) {
  const paddedLen = Math.ceil((data.length + 1) / 16) * 16;
  const out = new Uint8Array(paddedLen);
  out.set(data, 0);
  out[data.length] = 0x80;
  return out;
}

function unpad80(data) {
  let end = data.length - 1;
  while (end >= 0 && data[end] !== 0x80) end -= 1;
  if (end < 0) throw new Error("The Ledger reply could not be read.");
  return data.subarray(0, end);
}

async function aesCbc(keyBytes, iv, data, decrypt) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, [decrypt ? "decrypt" : "encrypt"]);
  const op = decrypt ? "decrypt" : "encrypt";
  const result = await crypto.subtle[op]({ name: "AES-CBC", iv }, key, data);
  return new Uint8Array(result);
}

function last16(bytes) {
  return bytes.slice(bytes.length - 16);
}

export class ScpChannel {
  constructor(secret, mode) {
    this.mode = mode;
    this.encIv = new Uint8Array(16);
    this.macIv = new Uint8Array(16);
    if (mode === "v2") {
      this.key = secret.subarray(0, 16);
      return;
    }
    const enc = deriveScpKey(secret, 0);
    const mac = deriveScpKey(secret, 1);
    this.encKey = enc.subarray(0, 16);
    this.macKey = mac.subarray(0, 16);
  }

  async wrap(data) {
    if (!data || data.length === 0) return new Uint8Array();
    const padded = pad80(data);
    if (this.mode === "v2") {
      const encrypted = await aesCbc(this.key, this.encIv, padded, false);
      this.encIv = last16(encrypted);
      return encrypted;
    }
    const encrypted = await aesCbc(this.encKey, this.encIv, padded, false);
    this.encIv = last16(encrypted);
    const mac = await aesCbc(this.macKey, this.macIv, encrypted, false);
    this.macIv = last16(mac);
    return concatBytes(encrypted, this.macIv.subarray(16 - SCP_MAC_LENGTH));
  }

  async unwrap(data) {
    if (!data || data.length === 0 || data.length === 2) return data || new Uint8Array();
    if (this.mode === "v2") {
      const decrypted = await aesCbc(this.key, this.encIv, data, true);
      this.encIv = last16(data);
      return unpad80(decrypted);
    }
    if (data.length <= SCP_MAC_LENGTH) throw new Error("The Ledger reply could not be read.");
    const encrypted = data.subarray(0, data.length - SCP_MAC_LENGTH);
    const mac = await aesCbc(this.macKey, this.macIv, encrypted, false);
    this.macIv = last16(mac);
    const expect = this.macIv.subarray(16 - SCP_MAC_LENGTH);
    const got = data.subarray(data.length - SCP_MAC_LENGTH);
    for (let i = 0; i < SCP_MAC_LENGTH; i++) {
      if (expect[i] !== got[i]) throw new Error("The Ledger reply failed its check. Unplug the Ledger and try again.");
    }
    const iv = this.encIv;
    this.encIv = last16(encrypted);
    const decrypted = await aesCbc(this.encKey, iv, encrypted, true);
    return unpad80(decrypted);
  }
}

export function deriveScpKey(secret, keyIndex) {
  let digest = new Uint8Array();
  for (let retry = 0; retry < 8; retry++) {
    const prefix = new Uint8Array(5);
    new DataView(prefix.buffer).setUint32(0, keyIndex, false);
    prefix[4] = retry;
    digest = sha256(concatBytes(prefix, secret));
    const value = BigInt(`0x${bytesToHex(digest)}`);
    if (value > 0n && value < CURVE.n) {
      return sha256(getPublicKey(digest, false));
    }
  }
  throw new Error("Could not derive the install key.");
}

export async function openSecureChannel(exchange, targetId) {
  const nibble = targetId & 0xf;
  if (nibble < 2) throw new Error("This Ledger is too old to install the app from the browser.");
  const master = utils.randomPrivateKey();
  const masterPub = getPublicKey(master, false);
  await exchange(command(0xe0, 0x04, 0x00, 0x00, u32be(targetId)));
  const hostNonce = crypto.getRandomValues(new Uint8Array(8));
  const auth = await exchange(command(0xe0, 0x50, 0x00, 0x00, hostNonce));
  if (auth.length < 12) throw new Error("The Ledger reply was too short to open a channel.");
  const deviceNonce = auth.subarray(4, 12);

  const masterSig = signMessageDer(concatBytes([0x01], masterPub), master);
  await exchange(command(0xe0, 0x51, 0x00, 0x00, pair(masterPub, masterSig)));

  const ephemeral = utils.randomPrivateKey();
  const ephemeralPub = getPublicKey(ephemeral, false);
  // The device verifies this certificate with the master key from the previous command.
  const ephemeralSig = signMessageDer(concatBytes([0x11], hostNonce, deviceNonce, ephemeralPub), master);
  await exchange(command(0xe0, 0x51, 0x80, 0x00, pair(ephemeralPub, ephemeralSig)));

  let lastPub = masterPub;
  for (let index = 0; index < 2; index++) {
    const cert = await exchange(command(0xe0, 0x52, index === 0 ? 0x00 : 0x80, 0x00, new Uint8Array()));
    if (cert.length === 0) break;
    const parsed = parseDeviceCert(cert);
    const signed =
      index === 0
        ? concatBytes([0x02], parsed.header, parsed.publicKey)
        : concatBytes([0x12], deviceNonce, hostNonce, parsed.publicKey);
    const ok = ecdsaVerify(parsed.signature, signed, lastPub);
    if (!ok && index !== 0) {
      throw new Error("The Ledger certificate did not check. Unplug the Ledger and try again.");
    }
    lastPub = parsed.publicKey;
  }

  await exchange(command(0xe0, 0x53, 0x00, 0x00, new Uint8Array()));
  const secret = ecdhSecret(ephemeral, lastPub);
  return new ScpChannel(secret, nibble === 2 ? "v2" : "v3");
}

export async function runApduScript(exchange, channel, apdus, onProgress) {
  for (let i = 0; i < apdus.length; i++) {
    if (onProgress) onProgress(i + 1, apdus.length);
    const raw = apdus[i];
    const wrapped = await channel.wrap(raw.subarray(5));
    if (wrapped.length > 255) throw new Error("A command in this file is too long to send.");
    const out = new Uint8Array(5 + wrapped.length);
    out.set(raw.subarray(0, 4), 0);
    out[4] = wrapped.length;
    out.set(wrapped, 5);
    const response = await exchange(out);
    await channel.unwrap(response);
  }
}

export function deleteWarthogApdu() {
  const name = new TextEncoder().encode("Warthog");
  const data = new Uint8Array(2 + name.length);
  data[0] = 0x0c;
  data[1] = name.length;
  data.set(name, 2);
  return command(0xe0, 0x00, 0x00, 0x00, data);
}

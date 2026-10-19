import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sha256 } from "@noble/hashes/sha2";
import { getPublicKey, utils, verify } from "@noble/secp256k1";
import { framesForApdu } from "./ledgerHid.js";
import { LEDGER_DEVICES, LEDGER_RELEASE } from "./ledgerRelease.js";
import {
  ScpChannel,
  bytesToHex,
  concatBytes,
  deleteWarthogApdu,
  describeApp,
  openSecureChannel,
  parseApduScript,
  parseAppVersion,
  runApduScript,
  signMessageDer,
} from "./ledgerScp.js";

const apduPath = new URL("../../public/downloads/ledger/warthog-nanosplus-0.2.0.apdu", import.meta.url);

test("published Nano S+ file matches the pinned hash and starts by deleting Warthog", () => {
  const bytes = readFileSync(apduPath);
  assert.equal(bytesToHex(sha256(bytes)), LEDGER_RELEASE.apduSha256);
  const apdus = parseApduScript(bytes.toString("ascii"));
  assert.ok(apdus.length > 10);
  assert.deepEqual(apdus[0], deleteWarthogApdu());
  assert.equal(apdus[0][0], 0xe0);
  assert.equal(LEDGER_RELEASE.targetId, 0x33100004);
});

test("Nano S file is a different target and every wrapped command fits one APDU", async () => {
  const nanos = LEDGER_DEVICES.nanos;
  const plus = LEDGER_DEVICES.nanosplus;
  assert.notEqual(nanos.apduSha256, plus.apduSha256);
  assert.equal(nanos.targetId, 0x31100004);
  assert.equal(plus.targetId, 0x33100004);
  const nanosPath = new URL("../../public/downloads/ledger/warthog-nanos-0.2.0.apdu", import.meta.url);
  const bytes = readFileSync(nanosPath);
  assert.equal(bytesToHex(sha256(bytes)), nanos.apduSha256);
  const apdus = parseApduScript(bytes.toString("ascii"));
  assert.deepEqual(apdus[0], deleteWarthogApdu());
  const channel = new ScpChannel(new Uint8Array(32).fill(3), "v3");
  for (const apdu of apdus) {
    const wrapped = await channel.wrap(apdu.subarray(5));
    assert.ok(wrapped.length <= 255);
  }
  const home = describeApp({ name: "BOLOS", version: "1.0.0" }, nanos.version, nanos.approve);
  assert.match(home.detail, /Nano S,/);
  assert.equal(home.readyToInstall, true);
});

test("version reply parser and home-screen wording", () => {
  const body = new Uint8Array([
    0x01,
    0x07,
    ...new TextEncoder().encode("Warthog"),
    0x05,
    ...new TextEncoder().encode("0.2.0"),
    0x90,
    0x00,
  ]);
  assert.deepEqual(parseAppVersion(body), { name: "Warthog", version: "0.2.0" });
  const home = describeApp({ name: "BOLOS", version: "1.0.0" }, "0.2.0");
  assert.equal(home.readyToInstall, true);
  const match = describeApp({ name: "Warthog", version: "0.2.0" }, "0.2.0");
  assert.equal(match.versionMatches, true);
  assert.equal(match.readyToInstall, false);
  assert.throws(() => parseAppVersion(new Uint8Array([0x55, 0x15])), /locked/i);
});

test("secure channel round-trips and a fake Ledger accepts the handshake", async () => {
  const secret = new Uint8Array(32).fill(9);
  const sender = new ScpChannel(secret, "v3");
  const receiver = new ScpChannel(secret, "v3");
  const first = new TextEncoder().encode("warthog");
  const second = new Uint8Array(60).fill(0x11);
  const wrappedFirst = await sender.wrap(first);
  const wrappedSecond = await sender.wrap(second);
  assert.deepEqual(await receiver.unwrap(wrappedFirst), first);
  assert.deepEqual(await receiver.unwrap(wrappedSecond), second);
  assert.equal((await sender.wrap(new Uint8Array())).length, 0);

  const deviceKey = utils.randomPrivateKey();
  const devicePub = getPublicKey(deviceKey, false);
  const deviceNonce = new Uint8Array(8).fill(0x44);
  const ephemeralKey = utils.randomPrivateKey();
  const ephemeralPub = getPublicKey(ephemeralKey, false);
  let hostNonce = new Uint8Array();
  const seen = [];

  const lv = (value) => {
    const out = new Uint8Array(1 + value.length);
    out[0] = value.length;
    out.set(value, 1);
    return out;
  };
  const exchange = async (apdu) => {
    seen.push(apdu);
    if (apdu[1] === 0x50) {
      hostNonce = apdu.slice(5);
      return concatBytes(new Uint8Array(4), deviceNonce);
    }
    if (apdu[1] === 0x52 && apdu[2] === 0x00) {
      const header = new Uint8Array([0x01]);
      const sig = signMessageDer(concatBytes([0x02], header, devicePub), deviceKey);
      return concatBytes(lv(header), lv(devicePub), lv(sig));
    }
    if (apdu[1] === 0x52 && apdu[2] === 0x80) {
      const header = new Uint8Array([0x02]);
      const signed = concatBytes([0x12], deviceNonce, hostNonce, ephemeralPub);
      const sig = signMessageDer(signed, deviceKey);
      return concatBytes(lv(header), lv(ephemeralPub), lv(sig));
    }
    return new Uint8Array();
  };

  const channel = await openSecureChannel(exchange, LEDGER_RELEASE.targetId);
  assert.equal(channel.mode, "v3");
  assert.deepEqual(seen.map((apdu) => apdu[1]), [0x04, 0x50, 0x51, 0x51, 0x52, 0x52, 0x53]);
  seen.length = 0;
  const nanosChannel = await openSecureChannel(exchange, LEDGER_DEVICES.nanos.targetId);
  assert.equal(nanosChannel.mode, "v3");
  assert.equal(seen[0][5], 0x31);
  assert.deepEqual(seen.map((apdu) => apdu[1]), [0x04, 0x50, 0x51, 0x51, 0x52, 0x52, 0x53]);
  const script = [deleteWarthogApdu(), new Uint8Array([0xe0, 0x00, 0x00, 0x00, 0x01, 0xaa])];
  const sent = [];
  await runApduScript(async (apdu) => {
    sent.push(apdu);
    return new Uint8Array();
  }, channel, script);
  assert.equal(sent.length, 2);
  assert.ok(sent[0].length > deleteWarthogApdu().length);

  const message = new TextEncoder().encode("ok");
  const priv = utils.randomPrivateKey();
  const sig = signMessageDer(message, priv);
  assert.equal(verify(decodeDer(sig), sha256(message), getPublicKey(priv, false)), true);
});

function decodeDer(der) {
  let offset = 2;
  const read = () => {
    if (der[offset] !== 0x02) throw new Error("der");
    const len = der[offset + 1];
    let slice = der.subarray(offset + 2, offset + 2 + len);
    offset += 2 + len;
    if (slice[0] === 0x00) slice = slice.subarray(1);
    return BigInt(`0x${bytesToHex(slice)}`);
  };
  return { r: read(), s: read() };
}

test("HID frames carry the length on the first packet", () => {
  const apdu = new Uint8Array(100);
  const frames = framesForApdu(apdu);
  assert.equal(frames.length, 2);
  assert.equal(frames[0][0], 0x01);
  assert.equal(frames[0][2], 0x05);
  assert.equal((frames[0][5] << 8) | frames[0][6], 100);
  assert.equal(frames[0].length, 64);
  assert.equal(frames[1][4], 1);
});

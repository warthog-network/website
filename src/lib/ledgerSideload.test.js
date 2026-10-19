import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sha256 } from "@noble/hashes/sha2";
import { getPublicKey, utils, verify } from "@noble/secp256k1";
import { exchangeRaw, framesForApdu } from "./ledgerHid.js";
import { LEDGER_DEVICES, LEDGER_RELEASE, LEDGER_REPO } from "./ledgerRelease.js";
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

const RELEASE_030 = `${LEDGER_REPO}/releases/tag/v0.3.0`;

test("published 0.3.0 files match the pinned hashes and start by deleting Warthog", async () => {
  const ids = ["nanosplus", "stax", "flex", "apex_p"];
  const targetIds = {
    nanosplus: 0x33100004,
    stax: 0x33200004,
    flex: 0x33300004,
    apex_p: 0x33400004,
  };
  for (const id of ids) {
    const device = LEDGER_DEVICES[id];
    assert.equal(device.version, "0.3.0");
    assert.equal(device.releasePage, RELEASE_030);
    assert.equal(device.targetId, targetIds[id]);
    const path = new URL(`../../public/downloads/ledger/${device.fileName}`, import.meta.url);
    const bytes = readFileSync(path);
    assert.equal(bytesToHex(sha256(bytes)), device.apduSha256);
    const apdus = parseApduScript(bytes.toString("ascii"));
    assert.ok(apdus.length > 10);
    assert.deepEqual(apdus[0], deleteWarthogApdu());
    assert.equal(apdus[0][0], 0xe0);
    const channel = new ScpChannel(new Uint8Array(32).fill(3), "v3");
    for (const apdu of apdus) {
      const wrapped = await channel.wrap(apdu.subarray(5));
      assert.ok(wrapped.length <= 255, `${id} command is too long to send`);
    }
  }
  assert.equal(LEDGER_RELEASE, LEDGER_DEVICES.nanosplus);
});

test("site manifest lists the same files and hashes", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../public/downloads/ledger/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.version, "0.3.0");
  assert.equal(manifest.source, LEDGER_REPO);
  assert.equal(manifest.release, RELEASE_030);
  const byTarget = Object.fromEntries(manifest.devices.map((device) => [device.target, device]));
  for (const device of Object.values(LEDGER_DEVICES)) {
    const row = byTarget[device.target];
    assert.ok(row, device.target);
    assert.equal(row.version, device.version);
    assert.equal(row.apdu, device.apduPath);
    assert.equal(row.apduSha256, device.apduSha256);
    assert.equal(row.elfSha256, device.elfSha256);
    assert.equal(row.buildSha256File, device.buildSha256File);
    assert.equal(row.targetId, `0x${device.targetId.toString(16)}`);
    assert.equal(row.release, device.releasePage);
  }
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
    ...new TextEncoder().encode("0.3.0"),
    0x90,
    0x00,
  ]);
  assert.deepEqual(parseAppVersion(body), { name: "Warthog", version: "0.3.0" });
  const home = describeApp({ name: "BOLOS", version: "1.0.0" }, LEDGER_RELEASE.version);
  assert.equal(home.readyToInstall, true);
  const match = describeApp({ name: "Warthog", version: "0.3.0" }, "0.3.0");
  assert.equal(match.versionMatches, true);
  assert.equal(match.readyToInstall, false);
  const older = describeApp({ name: "Warthog", version: "0.2.0" }, "0.3.0");
  assert.equal(older.versionMatches, false);
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
  const masterCert = readLvPair(seen[2].subarray(5));
  const ephemeralCert = readLvPair(seen[3].subarray(5));
  const nonceApdu = seen[1];
  const sentHostNonce = nonceApdu.subarray(5, 5 + nonceApdu[4]);
  assert.equal(
    verify(decodeDer(masterCert.right), sha256(concatBytes([0x01], masterCert.left)), masterCert.left),
    true,
  );
  assert.equal(
    verify(
      decodeDer(ephemeralCert.right),
      sha256(concatBytes([0x11], sentHostNonce, deviceNonce, ephemeralCert.left)),
      masterCert.left,
    ),
    true,
  );
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

function readLvPair(bytes) {
  const leftLen = bytes[0];
  const left = bytes.subarray(1, 1 + leftLen);
  const rightLen = bytes[1 + leftLen];
  const right = bytes.subarray(2 + leftLen, 2 + leftLen + rightLen);
  return { left, right };
}

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

function fakeLedger(replyFrames) {
  const listeners = [];
  let emitted = false;
  return {
    opened: true,
    open: async () => {},
    close: async () => {},
    sendReport: async () => {
      if (emitted) return;
      emitted = true;
      for (const reply of replyFrames) {
        await Promise.resolve();
        const event = { data: new DataView(reply.buffer, reply.byteOffset, reply.byteLength) };
        for (const listener of listeners) listener(event);
      }
    },
    addEventListener: (name, fn) => {
      assert.equal(name, "inputreport");
      listeners.push(fn);
    },
    removeEventListener: (name, fn) => {
      assert.equal(name, "inputreport");
      const index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}

function hidFrame(seq, payload, total) {
  const frame = new Uint8Array(64);
  frame[0] = 0x01;
  frame[1] = 0x01;
  frame[2] = 0x05;
  frame[3] = (seq >> 8) & 0xff;
  frame[4] = seq & 0xff;
  let dataOff = 5;
  if (seq === 0) {
    frame[5] = (total >> 8) & 0xff;
    frame[6] = total & 0xff;
    dataOff = 7;
  }
  frame.set(payload, dataOff);
  return frame;
}

test("WebHID exchange reads inputreport events and does not call receive", async () => {
  const payload = new Uint8Array(60);
  payload.set([0x11, 0x22], 0);
  payload[59] = 0x33;
  const device = fakeLedger([
    hidFrame(0, payload.subarray(0, 57), 60),
    hidFrame(1, payload.subarray(57), 60),
  ]);
  const raw = await exchangeRaw(device, new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]), 1000);
  assert.deepEqual(raw, payload);
  assert.equal(typeof device.receive, "undefined");
});

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

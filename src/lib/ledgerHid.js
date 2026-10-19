/** WebHID framing for a Ledger APDU interface. Matches the host tool in ledger-dev. */
import { LedgerStatusError } from "./ledgerScp.js";

const CHANNEL_HI = 0x01;
const CHANNEL_LO = 0x01;
const TAG = 0x05;
const PACKET = 64;
export const GET_APP = new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]);

const FILTERS = [
  { vendorId: 0x2c97, usagePage: 0xffa0 },
  { vendorId: 0x2581, usagePage: 0xffa0 },
];

export function browserCanSeeLedger() {
  return typeof navigator !== "undefined" && !!navigator.hid;
}

export function framesForApdu(apdu) {
  const frames = [];
  let offset = 0;
  let seq = 0;
  while (offset < apdu.length) {
    const frame = new Uint8Array(PACKET);
    frame[0] = CHANNEL_HI;
    frame[1] = CHANNEL_LO;
    frame[2] = TAG;
    frame[3] = (seq >> 8) & 0xff;
    frame[4] = seq & 0xff;
    let dataOff = 5;
    if (seq === 0) {
      frame[5] = (apdu.length >> 8) & 0xff;
      frame[6] = apdu.length & 0xff;
      dataOff = 7;
    }
    const take = Math.min(PACKET - dataOff, apdu.length - offset);
    frame.set(apdu.subarray(offset, offset + take), dataOff);
    frames.push(frame);
    offset += take;
    seq += 1;
  }
  return frames;
}

function asFrame(report) {
  let frame = new Uint8Array(report.buffer, report.byteOffset, report.byteLength);
  if (frame.length >= 65 && frame[0] === 0x00) frame = frame.subarray(1);
  if (frame.length < 5) throw new Error("The Ledger sent a short reply.");
  return frame;
}

function checkHeader(frame, expectedSeq) {
  const channel = (frame[0] << 8) | frame[1];
  if (channel !== 0x0101) throw new Error("The Ledger reply used an unexpected channel.");
  if (frame[2] !== TAG) throw new Error("The Ledger reply used an unexpected tag.");
  const seq = (frame[3] << 8) | frame[4];
  if (seq !== expectedSeq) throw new Error("The Ledger reply arrived out of order.");
}

/**
 * HIDDevice has sendReport and an "inputreport" event. It has no receive().
 * Reports are queued so a reply that arrives before the next read is kept.
 */
const readers = new WeakMap();

function reportBytes(event) {
  const data = event && event.data;
  if (data instanceof DataView) {
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  if (data instanceof Uint8Array) return new Uint8Array(data);
  throw new Error("The Ledger reply was not a HID report.");
}

function ensureReader(device) {
  const existing = readers.get(device);
  if (existing) return existing;
  const queue = [];
  let waiting = null;
  const onReport = (event) => {
    const bytes = reportBytes(event);
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(bytes);
      return;
    }
    queue.push(bytes);
  };
  device.addEventListener("inputreport", onReport);
  const reader = {
    onReport,
    drain() {
      queue.length = 0;
      waiting = null;
    },
    receive() {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve) => {
        waiting = resolve;
      });
    },
  };
  readers.set(device, reader);
  return reader;
}

function detachReader(device) {
  const reader = readers.get(device);
  if (!reader) return;
  device.removeEventListener("inputreport", reader.onReport);
  reader.drain();
  readers.delete(device);
}

async function receiveFrame(device, timeoutMs) {
  const reader = ensureReader(device);
  let timer;
  let timedOut = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reader.drain();
      reject(new Error("The Ledger did not answer. Unlock it and leave the home screen open."));
    }, timeoutMs);
  });
  try {
    const report = await Promise.race([reader.receive(), timeout]);
    if (timedOut) throw new Error("The Ledger did not answer. Unlock it and leave the home screen open.");
    return asFrame(report);
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeRaw(device, apdu, timeoutMs = 20000) {
  if (!device.opened) await device.open();
  const reader = ensureReader(device);
  reader.drain();
  for (const frame of framesForApdu(apdu)) {
    await device.sendReport(0x00, frame);
  }
  const first = await receiveFrame(device, timeoutMs);
  checkHeader(first, 0);
  if (first.length < 7) throw new Error("The Ledger reply is missing its length.");
  const total = (first[5] << 8) | first[6];
  if (total > 2048) throw new Error("The Ledger reply is longer than this page accepts.");
  const payload = new Uint8Array(total);
  const firstTake = Math.min(total, first.length - 7);
  payload.set(first.subarray(7, 7 + firstTake), 0);
  let filled = firstTake;
  let seq = 1;
  while (filled < total) {
    const frame = await receiveFrame(device, timeoutMs);
    checkHeader(frame, seq);
    const chunk = frame.subarray(5);
    const need = total - filled;
    payload.set(chunk.subarray(0, need), filled);
    filled += Math.min(need, chunk.length);
    seq += 1;
  }
  return payload;
}

/** Returns the data field. Throws when the status word is not 9000, same as ledgerblue. */
export async function exchangeOk(device, apdu, timeoutMs) {
  const raw = await exchangeRaw(device, apdu, timeoutMs);
  if (raw.length < 2) throw new Error("The Ledger reply was too short.");
  const sw = (raw[raw.length - 2] << 8) | raw[raw.length - 1];
  if (sw !== 0x9000) throw new LedgerStatusError(sw);
  return raw.subarray(0, raw.length - 2);
}

export async function connectLedger() {
  if (!browserCanSeeLedger()) {
    throw new Error("This browser cannot see a Ledger. Open this page in Chrome, Edge, Brave, or Opera.");
  }
  let list = [];
  try {
    list = await navigator.hid.requestDevice({ filters: FILTERS });
  } catch (err) {
    if (err && (err.name === "NotFoundError" || err.name === "AbortError")) {
      throw new Error("No Ledger was selected.");
    }
    throw err;
  }
  const device = list[0];
  if (!device) throw new Error("No Ledger was selected.");
  if (!device.opened) await device.open();
  ensureReader(device);
  return device;
}

export async function closeLedger(device) {
  if (!device) return;
  detachReader(device);
  if (device.opened) await device.close();
}

/**
 * Ledger HID framing for the web wallet.
 * Separate from ledgerHid.js, which the Getting Started installer uses.
 * WebHID is available in Chrome, Edge, and Brave on this site.
 */

const VENDOR_ID = 0x2c97;
const PACKET = 64;
const CHANNEL = 0x0101;
const TAG = 0x05;

export class LedgerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LedgerError';
  }
}

function statusMessage(sw) {
  if (sw === 0x6985) return 'Rejected on the Ledger';
  if (sw === 0x6e00 || sw === 0x6d00) {
    return 'Open the Warthog app on the Ledger, then try again';
  }
  if (sw === 0x6a80 || sw === 0x6984) {
    return 'The Ledger refused this data. Stay on a WART transfer.';
  }
  return `Ledger status 0x${sw.toString(16).padStart(4, '0')}`;
}

function isWarthogInterface(device) {
  return device.collections?.some((collection) => collection.usagePage === 0xffa0) ?? false;
}

function pickDevice(devices) {
  return devices.find(isWarthogInterface) ?? devices.find((device) => device.vendorId === VENDOR_ID);
}

export async function requestLedgerDevice() {
  if (!navigator.hid) {
    throw new LedgerError('Chrome, Edge, or Brave is required to talk to a Ledger');
  }
  const already = pickDevice(await navigator.hid.getDevices());
  if (already) return already;
  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: VENDOR_ID }],
  });
  const device = pickDevice(devices) ?? devices[0];
  if (!device) {
    throw new LedgerError(
      'Choose the Nano in the browser device list, then click Connect. If that list is hidden, look behind this window.',
    );
  }
  return device;
}

function readFrame(device, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      device.removeEventListener('inputreport', onReport);
      reject(new LedgerError('Ledger timed out. Unlock it and leave the Warthog app open.'));
    }, timeoutMs);
    const onReport = (event) => {
      window.clearTimeout(timer);
      device.removeEventListener('inputreport', onReport);
      resolve(new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength));
    };
    device.addEventListener('inputreport', onReport);
  });
}

async function writeApdu(device, apduBytes) {
  let seq = 0;
  let offset = 0;
  while (offset < apduBytes.length || seq === 0) {
    const buf = new Uint8Array(PACKET);
    buf[0] = (CHANNEL >> 8) & 0xff;
    buf[1] = CHANNEL & 0xff;
    buf[2] = TAG;
    buf[3] = (seq >> 8) & 0xff;
    buf[4] = seq & 0xff;
    let dataOff = 5;
    if (seq === 0) {
      buf[5] = (apduBytes.length >> 8) & 0xff;
      buf[6] = apduBytes.length & 0xff;
      dataOff = 7;
    }
    const take = Math.min(PACKET - dataOff, apduBytes.length - offset);
    buf.set(apduBytes.subarray(offset, offset + take), dataOff);
    offset += take;
    await device.sendReport(0, buf);
    seq += 1;
    if (offset >= apduBytes.length) break;
  }
}

async function readApdu(device, timeoutMs) {
  const first = await readFrame(device, timeoutMs);
  if (first.length < 7 || first[2] !== TAG) {
    throw new LedgerError('Unexpected reply from the Ledger');
  }
  const total = (first[5] << 8) | first[6];
  const payload = new Uint8Array(total);
  const firstChunk = first.subarray(7, 7 + Math.min(first.length - 7, total));
  payload.set(firstChunk);
  let filled = firstChunk.length;
  while (filled < total) {
    const frame = await readFrame(device, timeoutMs);
    const part = frame.subarray(5);
    const take = Math.min(part.length, total - filled);
    payload.set(part.subarray(0, take), filled);
    filled += take;
  }
  return payload;
}

export async function exchange(device, apduBytes, timeoutMs) {
  if (!device.opened) await device.open();
  await writeApdu(device, apduBytes);
  const payload = await readApdu(device, timeoutMs);
  if (payload.length < 2) {
    throw new LedgerError('Short reply from the Ledger');
  }
  const sw = (payload[payload.length - 2] << 8) | payload[payload.length - 1];
  if (sw !== 0x9000) {
    throw new LedgerError(statusMessage(sw));
  }
  return payload.subarray(0, payload.length - 2);
}

export function apdu(ins, p1, p2, data) {
  if (data.length > 255) {
    throw new LedgerError('Ledger command is too long');
  }
  const out = new Uint8Array(5 + data.length);
  out[0] = 0xe0;
  out[1] = ins;
  out[2] = p1;
  out[3] = p2;
  out[4] = data.length;
  out.set(data, 5);
  return out;
}

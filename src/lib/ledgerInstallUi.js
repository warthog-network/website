import { LEDGER_DEVICES } from "./ledgerRelease.js";
import { browserCanSeeLedger, closeLedger, connectLedger, exchangeOk, exchangeRaw, GET_APP } from "./ledgerHid.js";
import {
  bytesToHex,
  deleteWarthogApdu,
  describeApp,
  openSecureChannel,
  parseApduScript,
  parseAppVersion,
  runApduScript,
} from "./ledgerScp.js";

const INSTALL_TIMEOUT_MS = 180000;
const CHECK_TIMEOUT_MS = 8000;

let device = null;
let busy = false;
let current = LEDGER_DEVICES.nanosplus;
const apduCache = new Map();
let lastView = { readyToInstall: false, versionMatches: false };

function el(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function setBusy(next) {
  busy = next;
  for (const id of ["ledger-check", "ledger-version", "ledger-download", "ledger-close"]) {
    const node = el(id);
    if (node) node.disabled = next;
  }
  const install = el("ledger-install");
  const remove = el("ledger-remove");
  if (install) install.disabled = next || !lastView.readyToInstall;
  if (remove) remove.disabled = next || !lastView.readyToInstall;
}

function log(line) {
  const node = el("ledger-log");
  if (!node) return;
  const previous = node.textContent && node.textContent !== "Nothing yet." ? `${node.textContent}\n` : "";
  node.textContent = `${previous}${line}`;
  node.scrollTop = node.scrollHeight;
}

function show(view) {
  lastView = view;
  setText("ledger-headline", view.headline || "");
  setText("ledger-detail", view.detail || "");
  const match = el("ledger-match");
  if (match) match.hidden = !view.versionMatches;
  const install = el("ledger-install");
  const remove = el("ledger-remove");
  if (install) install.disabled = busy || !view.readyToInstall;
  if (remove) remove.disabled = busy || !view.readyToInstall;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function loadCheckedApdu() {
  const cached = apduCache.get(current.id);
  if (cached) return cached;
  const response = await fetch(current.apduPath, { cache: "no-store" });
  if (!response.ok) throw new Error("The installer file is not on this site.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = await sha256Hex(bytes);
  if (hash !== current.apduSha256) {
    throw new Error(`The installer file hash does not match the Warthog ${current.version} file for the ${current.device}. Install stopped.`);
  }
  const parsed = { bytes, apdus: parseApduScript(new TextDecoder().decode(bytes)) };
  apduCache.set(current.id, parsed);
  return parsed;
}

function saveApdu(bytes) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = current.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function readScreen() {
  device = await connectLedger();
  const raw = await exchangeRaw(device, GET_APP, CHECK_TIMEOUT_MS);
  return describeApp(parseAppVersion(raw), current.version, current.approve);
}

async function exchangeInstall(apdu) {
  return exchangeOk(device, apdu, INSTALL_TIMEOUT_MS);
}

async function runChecked(kind) {
  const file = await loadCheckedApdu();
  log(`File hash matches ${current.apduSha256}.`);
  log(`Opening a channel. ${current.approve}`);
  const channel = await openSecureChannel(exchangeInstall, current.targetId);
  if (kind === "remove") {
    await runApduScript(exchangeInstall, channel, [deleteWarthogApdu()]);
    return;
  }
  await runApduScript(exchangeInstall, channel, file.apdus, (index, total) => {
    setText("ledger-headline", `Installing Warthog… ${index} of ${total}`);
    setText("ledger-detail", `Stay on the home screen. Approve the prompt on the Ledger. ${current.approve}`);
  });
}

function fail(err) {
  const message = err && err.message ? err.message : "The Ledger did not answer.";
  show({
    headline: message,
    detail: "Unlock the Ledger, stay on the home screen, and try again.",
    readyToInstall: false,
    versionMatches: false,
  });
  log(message);
}

function applyRelease(release) {
  current = release;
  lastView = { readyToInstall: false, versionMatches: false };
  setText("ledger-title", `Install Warthog on a ${release.device}`);
  setText("ledger-expected", `${release.version} for ${release.device}, OS ${release.os}`);
  setText("ledger-hash", release.apduSha256);
  setText("ledger-build-hash", release.buildSha256File);
  setText("ledger-also", release.note);
  setText("ledger-headline", release.plug);
  setText("ledger-detail", "Unlock it and stay on the home screen, the one with the app icons. Then click Check my Ledger.");
  setText("ledger-install-help", `The button stays off until the Ledger is on the home screen. After you click it, watch the Ledger and approve the prompt. ${release.approve}`);
  setText("ledger-version-help", `On the Ledger, open the Warthog app. Then click the button. The status above should say Warthog ${release.version}.`);
  setText("ledger-log", "Nothing yet.");
  const match = el("ledger-match");
  if (match) match.hidden = true;
  const releaseLink = el("ledger-release");
  if (releaseLink) {
    if (release.releasePage) {
      releaseLink.hidden = false;
      releaseLink.href = release.releasePage;
    } else {
      releaseLink.hidden = true;
      releaseLink.removeAttribute("href");
    }
  }
  const install = el("ledger-install");
  if (install) {
    install.textContent = `Install Warthog ${release.version}`;
    install.disabled = true;
  }
  const remove = el("ledger-remove");
  if (remove) remove.disabled = true;
}

export async function openLedgerModal(deviceId = "nanosplus") {
  const release = LEDGER_DEVICES[deviceId] || LEDGER_DEVICES.nanosplus;
  mountLedgerInstall();
  applyRelease(release);
  const modal = el("ledger-modal");
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  if (!browserCanSeeLedger()) {
    show({
      headline: "This browser cannot see a Ledger.",
      detail: `Open this page in Chrome, Edge, Brave, or Opera. Then plug in the ${release.device} and click Check my Ledger.`,
      readyToInstall: false,
      versionMatches: false,
    });
  }
  el("ledger-check")?.focus();
}

export function mountLedgerInstall() {
  const modal = el("ledger-modal");
  if (!modal || modal.dataset.ready === "1") return;
  modal.dataset.ready = "1";

  const closeModal = async () => {
    if (busy) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    const openDevice = device;
    device = null;
    try {
      await closeLedger(openDevice);
    } catch {
      /* The cable may already be gone. */
    }
  };

  el("ledger-close")?.addEventListener("click", () => {
    closeModal();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  el("ledger-check")?.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    show({ headline: "Checking the Ledger…", detail: "Choose the Ledger in the browser prompt. The screen can stay on the home screen.", readyToInstall: false, versionMatches: false });
    try {
      const view = await readScreen();
      show(view);
      log(view.headline);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  });

  el("ledger-version")?.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    show({ headline: "Checking the version…", detail: "Open the Warthog app on the Ledger first.", readyToInstall: false, versionMatches: false });
    try {
      const view = await readScreen();
      show(view);
      log(view.headline);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  });

  el("ledger-download")?.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      const file = await loadCheckedApdu();
      saveApdu(file.bytes);
      log("Downloaded the file after the hash matched.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  });

  const act = (kind) => async () => {
    if (busy) return;
    setBusy(true);
    setText("ledger-log", "Nothing yet.");
    show({
      headline: kind === "remove" ? "Removing Warthog…" : "Installing Warthog…",
      detail: `Approve the prompt on the Ledger. ${current.approve}`,
      readyToInstall: false,
      versionMatches: false,
    });
    try {
      if (!device || !device.opened) device = await connectLedger();
      await runChecked(kind);
      const done =
        kind === "remove"
          ? "Warthog was removed. The home screen should no longer list it."
          : "Warthog is on the Ledger. Open the Warthog icon, then click Check the version.";
      show({ headline: done, detail: "Your PIN and seed stay on the Ledger.", readyToInstall: false, versionMatches: false });
      log(done);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  el("ledger-install")?.addEventListener("click", act("install"));
  el("ledger-remove")?.addEventListener("click", act("remove"));
}

/*
 * End-to-end test for the DeFi demo's shareable link.
 *
 * It drives headless Chromium over the DevTools protocol and checks
 * that the demo's state survives a share/restore cycle:
 *
 *   - the untouched demo keeps a clean URL
 *   - changing the book or the pool puts a ?state= parameter in the URL
 *   - opening that URL in a fresh page restores the same book, the same
 *     pool and the same filled totals
 *   - the "Copy shareable link" button copies the current link
 *   - a malformed ?state= falls back to the default state
 *
 * Usage:
 *   npm run dev -- --port 4399        # in one terminal
 *   chromium --headless --no-sandbox --disable-gpu \
 *            --remote-debugging-port=9222 about:blank
 *   node tests/defi-demo-share-link.e2e.mjs
 *
 * The DevTools port and the page URL are set below.
 */

const PAGE_URL = "http://localhost:4399/defi-demo";
const DEVTOOLS = "http://localhost:9222";

let ws;
let nextId = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(JSON.stringify(r.result.exceptionDetails));
  }
  return r.result?.result?.value;
}

async function navigate(url) {
  await send("Page.enable");
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 4000));
}

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
}

// Reads everything the demo renders.
const DUMP = `(() => {
  const rows = (id) => [...document.querySelectorAll('#' + id + ' tr')]
    .map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
  return {
    url: location.href,
    sell: rows('tbodySell'),
    buy: rows('tbodyBuy'),
    pool: [document.getElementById('beforeToken').value, document.getElementById('beforeWart').value],
    filled: [document.getElementById('filledAmountToken').textContent, document.getElementById('filledAmountWart').textContent],
    button: !!document.getElementById('copyLinkButton'),
  };
})()`;

const targets = await (await fetch(`${DEVTOOLS}/json/list`)).json();
const target = targets.find((t) => t.type === "page");
if (!target) throw new Error("no page target in Chromium");

ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};

// ── 1. the default page ─────────────────────────────────────────────────
await navigate(PAGE_URL);
let d = await evaluate(DUMP);
check("page renders", d.button === true);
check("default page has no state parameter", !d.url.includes("state="), d.url);
check("default book is empty", d.sell.length === 0 && d.buy.length === 0);
check("default pool is 100/200", d.pool[0] === "100" && d.pool[1] === "200");

// ── 2. build a book through the UI ──────────────────────────────────────
await evaluate(`(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('buyPrice', '1.732153'); set('wartAmount', '20');
  document.getElementById('buyButton').click();
  set('sellPrice', '0.8000049'); set('tokenAmount', '20');
  document.getElementById('sellButton').click();
  set('beforeToken', '150');
  return true;
})()`);
await new Promise((r) => setTimeout(r, 1200));
d = await evaluate(DUMP);
check("URL gained a state parameter", d.url.includes("state="), d.url.slice(0, 90) + "...");
const param = new URL(d.url).searchParams.get("state");
check("state parameter is not empty", !!param && param.length > 0, `len=${param?.length}`);

// The payload must carry only the exact form per order, not the decimal
// rendering as well.
const payload = JSON.parse(Buffer.from(param, "base64url").toString("utf8"));
check(
  "orders carry exactly [limitBits, amount]",
  [...payload.buys, ...payload.sells].every((o) => Array.isArray(o) && o.length === 2),
  JSON.stringify(payload.buys[0]),
);
check(
  "orders carry integer bits",
  [...payload.buys, ...payload.sells].every((o) => Number.isInteger(o[0]) && typeof o[1] === "string"),
);

// ── 3. open the shared link in a fresh page ─────────────────────────────
await navigate(PAGE_URL + "?state=" + encodeURIComponent(param));
const restored = await evaluate(DUMP);
check("restored URL is the shared one", restored.url.includes("state="));
check("restored buy book matches", JSON.stringify(restored.buy) === JSON.stringify(d.buy), JSON.stringify(restored.buy));
check("restored sell book matches", JSON.stringify(restored.sell) === JSON.stringify(d.sell), JSON.stringify(restored.sell));
check("restored pool matches", JSON.stringify(restored.pool) === JSON.stringify(d.pool), JSON.stringify(restored.pool));
check("restored filled totals match", JSON.stringify(restored.filled) === JSON.stringify(d.filled), JSON.stringify(restored.filled));

// ── 4. the copy button copies the link ──────────────────────────────────
const copied = await evaluate(`(async () => {
  let captured = null;
  const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async (t) => { captured = t; return orig(t).catch(() => {}); };
  document.getElementById('copyLinkButton').click();
  await new Promise(r => setTimeout(r, 400));
  return captured;
})()`);
check("copy button copies the current link", typeof copied === "string" && copied.includes("state="), String(copied).slice(0, 60));

// ── 4b. when the clipboard is unavailable, a field is offered ───────────
const clipboardFallback = await evaluate(`(async () => {
  const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async () => { throw new Error("denied"); };
  document.getElementById('copyLinkButton').click();
  await new Promise(r => setTimeout(r, 400));
  navigator.clipboard.writeText = orig;
  const field = document.querySelector('#copyLinkStatus input');
  return { present: !!field, value: field ? field.value : null, selected: field ? field.selectionEnd > 0 : false };
})()`);
check("clipboard fallback offers a selectable field", clipboardFallback.present === true);
check("fallback field holds the link", typeof clipboardFallback.value === "string" && clipboardFallback.value.includes("state="), String(clipboardFallback.value).slice(0, 60));
check("fallback field is selected", clipboardFallback.selected === true);

// ── 5. a malformed link falls back to the default ───────────────────────
await navigate(PAGE_URL + "?state=not-a-valid-state");
const fallback = await evaluate(DUMP);
check("malformed link falls back to the default book", fallback.buy.length === 0 && fallback.sell.length === 0);
check("malformed link falls back to the default pool", fallback.pool[0] === "100" && fallback.pool[1] === "200");

console.log(failures ? `\n${failures} FAILURES` : "\nall checks passed");
ws.close();
process.exit(failures ? 1 : 0);

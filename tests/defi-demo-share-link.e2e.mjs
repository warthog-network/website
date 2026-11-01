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
 * It also covers the order book view: the levels by default, the
 * individual orders when the switch is on, deleting a whole level and
 * deleting a single order, and the order labels.
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

// Reads the order book rows with their kind, their delete target and
// their label.
const DUMP_ROWS = `(() => {
  const rows = (id) => [...document.querySelectorAll('#' + id + ' tr')].map(tr => ({
    kind: tr.className.includes('level-row') ? 'level'
        : tr.className.includes('order-row') ? 'order' : '?',
    cells: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()),
    del: tr.querySelector('button[data-delete-price]') ? 'price'
        : tr.querySelector('button[data-delete-index]') ? 'index' : '',
    caption: tr.querySelector('.caption-hint')?.getAttribute('data-caption') ?? null,
  }));
  return { buy: rows('tbodyBuy'), sell: rows('tbodySell') };
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
  "orders carry exactly [limitBits, amount, caption]",
  [...payload.buys, ...payload.sells].every((o) => Array.isArray(o) && o.length === 3),
  JSON.stringify(payload.buys[0]),
);
check(
  "orders carry integer bits and string amounts",
  [...payload.buys, ...payload.sells].every((o) => Number.isInteger(o[0]) && typeof o[1] === "string" && typeof o[2] === "string"),
);
check("the payload is version 2", payload.v === 2, String(payload.v));
check("the fee is the node's 50", payload.fee === 50, String(payload.fee));

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

// ── 5. deleting orders from the table ──────────────────────────────────
await navigate(PAGE_URL);
await evaluate(`(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('buyPrice', '1.9'); set('wartAmount', '11');
  document.getElementById('buyButton').click();
  set('buyPrice', '1.5'); set('wartAmount', '22');
  document.getElementById('buyButton').click();
  set('sellPrice', '2.1'); set('tokenAmount', '33');
  document.getElementById('sellButton').click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 600));
let books = await evaluate(DUMP);
check("three orders are listed", books.buy.length === 2 && books.sell.length === 1, JSON.stringify(books.buy));

// The table shows one row per price level by default, and a level row
// removes every order at that price.
await evaluate(`document.querySelector('#tbodyBuy tr button[data-delete-price]').click()`);
await new Promise((r) => setTimeout(r, 600));
books = await evaluate(DUMP);
check("delete on the buy book removes the top row", books.buy.length === 1, JSON.stringify(books.buy));
check(
  "the surviving buy is the lower limit",
  books.buy[0][0].startsWith("1.5") || books.buy[0][0].startsWith("1.49999"),
  JSON.stringify(books.buy[0]),
);

await evaluate(`document.querySelector('#tbodySell tr button[data-delete-price]').click()`);
await new Promise((r) => setTimeout(r, 600));
books = await evaluate(DUMP);
check("delete on the sell book empties it", books.sell.length === 0, JSON.stringify(books.sell));

const afterDelete = new URL(books.url).searchParams.get("state");
const afterDeletePayload = JSON.parse(Buffer.from(afterDelete, "base64url").toString("utf8"));
check(
  "the URL reflects the deletions",
  afterDeletePayload.buys.length === 1 && afterDeletePayload.sells.length === 0,
  JSON.stringify(afterDeletePayload),
);

// ── 6. the individual orders view ──────────────────────────────────────
await navigate(PAGE_URL);
await evaluate(`(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // Two orders at the same limit, one at another limit, and a label.
  set('buyPrice', '1.5'); set('wartAmount', '10'); set('buyCaption', 'first');
  document.getElementById('buyButton').click();
  set('buyCaption', '');
  set('buyPrice', '1.5'); set('wartAmount', '20');
  document.getElementById('buyButton').click();
  set('buyPrice', '2.0'); set('wartAmount', '40');
  document.getElementById('buyButton').click();
  set('sellPrice', '1.2'); set('tokenAmount', '30'); set('sellCaption', 'seller');
  document.getElementById('sellButton').click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 800));

let rows = await evaluate(DUMP_ROWS);
check("the table shows one row per price level", rows.buy.every((r) => r.kind === "level"), JSON.stringify(rows.buy.map((r) => r.kind)));
const level15 = rows.buy.find((r) => r.kind === "level" && r.cells[0].startsWith("1.5"));
check("the level sums its orders", level15?.cells[1] === "30.00000000", level15?.cells[1]);
check("the level row removes by price", level15?.del === "price", level15?.del);
check("the level row carries no label", level15?.caption === null, String(level15?.caption));

// Switch the individual orders on.
await evaluate(`(() => {
  const el = document.getElementById('showOrders');
  el.checked = true;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await new Promise((r) => setTimeout(r, 400));

rows = await evaluate(DUMP_ROWS);
const orders = rows.buy.filter((r) => r.kind === "order");
check("the individual orders are listed", orders.length === 3, String(orders.length));
const at15 = orders.filter((r) => r.cells[0].startsWith("1.5"));
check("the two orders at 1.5 are listed separately", at15.length === 2, JSON.stringify(orders.map((r) => r.cells)));
check("each order carries its own amount", at15[0]?.cells[1] === "10.00000000" && at15[1]?.cells[1] === "20.00000000", JSON.stringify(at15.map((r) => r.cells[1])));
check("the label rides on the order, not on the level", at15[0]?.caption === "first", String(at15[0]?.caption));
check("the order rows remove by index", orders.every((r) => r.del === "index"), JSON.stringify(orders.map((r) => r.del)));
check("the sell order carries its label", rows.sell.find((r) => r.kind === "order")?.caption === "seller");

// Delete a single order: the second order at 1.5.
await evaluate(`(() => {
  const btns = [...document.querySelectorAll('#tbodyBuy button[data-delete-index]')];
  const target = btns.find((b) => b.dataset.deleteIndex === '2');
  target.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 600));
rows = await evaluate(DUMP_ROWS);
const afterOne = rows.buy.find((r) => r.kind === "level" && r.cells[0].startsWith("1.5"));
check("the level now sums only the remaining order", afterOne?.cells[1] === "10.00000000", afterOne?.cells[1]);

// The link carries one entry per order, with the label. One of the three
// orders was deleted above, so two are left.
const rowsUrl = (await evaluate(DUMP)).url;
const rowsPayload = JSON.parse(Buffer.from(new URL(rowsUrl).searchParams.get("state"), "base64url").toString("utf8"));
check("the link carries one entry per order", rowsPayload.buys.length === 2, JSON.stringify(rowsPayload.buys));
check("the link carries the label", rowsPayload.buys.some((o) => o[2] === "first"), JSON.stringify(rowsPayload.buys));
check("the same limit can appear twice", new Set(rowsPayload.buys.map((o) => o[0])).size === 2, JSON.stringify(rowsPayload.buys));

// ── 7. a v1 link still restores ────────────────────────────────────────
{
  const v1 = {
    v: 1,
    bd: 8,
    fee: 50,
    pool: ["100.00000000", "200.00000000"],
    buys: [[4251063, "20.00000000"]],
    sells: [[4181197, "20.00000000"]],
  };
  const v1state = Buffer.from(JSON.stringify(v1), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  await navigate(PAGE_URL + "?state=" + encodeURIComponent(v1state));
  const restored = await evaluate(DUMP);
  check("a v1 link restores its book", restored.buy.length === 1 && restored.sell.length === 1, JSON.stringify(restored.buy));
  check("a v1 link restores its pool", restored.pool[0] === "100" && restored.pool[1] === "200", JSON.stringify(restored.pool));
  const v1rows = await evaluate(DUMP_ROWS);
  check("a v1 link restores without a label", v1rows.buy.every((r) => r.caption === null), JSON.stringify(v1rows.buy));
}

// ── 8. a malformed link falls back to the default ───────────────────────
await navigate(PAGE_URL + "?state=not-a-valid-state");
const fallback = await evaluate(DUMP);
check("malformed link falls back to the default book", fallback.buy.length === 0 && fallback.sell.length === 0);
check("malformed link falls back to the default pool", fallback.pool[0] === "100" && fallback.pool[1] === "200");

console.log(failures ? `\n${failures} FAILURES` : "\nall checks passed");
ws.close();
process.exit(failures ? 1 : 0);

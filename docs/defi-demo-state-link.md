# DeFi demo: generating a `?state=` link

Developer documentation. This folder sits outside `src/` and `public/`, so
the Astro build neither routes nor copies it: nothing here reaches the
published site.

Audience: anyone who needs to produce a link that opens the DeFi demo
(`/defi-demo`) in one specific state, for example an explorer linking a
match, a test that needs a fixed scenario, or a hand-built demo link.

The link is implemented in `src/pages/defi-demo.astro`
(`encodeState`, `encodeMatch`, `decodeState`); the payload is generated
from the Fair Batch Matching engine (`warthog-fbm`), not from a parallel
JavaScript model, so the engine is the single source of truth.

## Link shape

```
https://warthog.network/defi-demo?state=<base64url payload>
https://astohogdev.netlify.app/defi-demo?state=<base64url payload>   # dev
```

The parameter is called `state`. Its value is base64url, so it contains
only `A-Z a-z 0-9 - _` and needs no percent-encoding.

## Payload

The parameter is a base64url encoding of a UTF-8 JSON object:

| field   | type                 | meaning                                                        |
| ------- | -------------------- | -------------------------------------------------------------- |
| `v`     | integer              | payload version, `1` or `2`                                    |
| `bd`    | integer              | `baseDecimals` of the token, `0..18`, fixed at engine creation  |
| `fee`   | integer              | pool fee in 1/10000 units, `0..9999` (5 = 0.05%, 50 = 0.50%)     |
| `pool`  | `[string, string]`   | pool reserves before the match, `[base, quote]`, decimal strings |
| `buys`  | `[[int, string, string?]]` | buy orders, `[limitBits, amount, caption]`, amount in WART  |
| `sells` | `[[int, string, string?]]` | sell orders, `[limitBits, amount, caption]`, amount in the base token |

`buys` and `sells` may be omitted or empty. Extra fields are ignored.
The caption is optional: a v1 entry has two elements, a v2 entry has
three. The same limit can appear in several entries, one per order.

Example payload:

```json
{
  "v": 2,
  "bd": 8,
  "fee": 50,
  "pool": ["100.00000000", "200.00000000"],
  "buys": [[4251063, "20.00000000", ""]],
  "sells": [[4181197, "20.00000000", "my order"]]
}
```

which encodes to:

```
https://warthog.network/defi-demo?state=eyJ2IjoyLCJiZCI6OCwiZmVlIjo1MCwicG9vbCI6WyIxMDAuMDAwMDAwMDAiLCIyMDAuMDAwMDAwMDAiXSwiYnV5cyI6W1s0MjUxMDYzLCIyMC4wMDAwMDAwMCIsIiJdXSwic2VsbHMiOltbNDE4MTE5NywiMjAuMDAwMDAwMDAiLCJteSBvcmRlciJdXX0
```

### Encoding

1. `JSON.stringify` the payload (compact, no whitespace).
2. Encode the string as UTF-8 bytes.
3. base64-encode the bytes.
4. Replace `+` with `-`, `/` with `_`, and strip trailing `=`.

The page does it with `btoa` over a latin1 string built from the UTF-8
bytes; every encoder that produces standard base64url without padding
yields the same value.

## `limitBits`: the exact limit price

The engine stores every limit price on a 16-bit mantissa grid, not as a
decimal. A decimal limit is snapped onto that grid and the snapped value
is what the order really has:

```
bits  = mantissa | (exponent << 16)      // mantissa: 16 bits, exponent: 0..127
price = mantissa * 2^(exponent - 79) / 10^(8 - baseDecimals)
```

The link stores `bits`, so a restored book is identical to the shared one.
Re-parsing the decimal rendering of a grid point can land on a
neighbouring cell, which changes the fills, so never build the payload
from decimal limits you computed yourself unless you reproduce this grid
exactly.

Decimal limit to bits (this is exactly what the engine does when it
parses a limit string):

```
scaled   = limit * 10^(8 - baseDecimals)
frac, e  = frexp(scaled)                 // 0.5 <= frac < 1, as in C/Python
mantissa = trunc(frac * 65536)
bits     = mantissa | ((e + 63) << 16)
```

`frexp` is the base-2 exponent split: `scaled == frac * 2^e`. The
truncation toward zero is deliberate, it matches the engine. `bits` is
bounded by `0x7FFFFF` (8388607).

Example at `baseDecimals = 8`: the limit `1.732153` becomes
`bits = 4251063`, whose exact price is `1.732147216796875`. The demo
displays the rounded value and keeps the exact one in the order book
tooltip.

The reliable way to get `bits` is to ask the engine, which also validates
the input:

```js
const e = new FbmEngine({ baseDecimals: 8, feeE4: 50 });
e.setPool({ base: "100", quote: "200" });
e.addBuy({ limit: "1.732153", amount: "20" });
e.match().buys[0].limitBits;   // 4251063
```

## Amounts and pool reserves

Amount strings are parsed by `Funds_uint64::parse`:

- digits and at most one dot, no sign, no exponent, no whitespace
- at most 20 digits in total
- at most `bd` decimals for the base token and at most 8 for WART
- the result must fit in a `uint64`

A buy is a swap whose input is WART, so its `amount` is in WART
(8 decimals). A sell is a swap whose input is the base token, so its
`amount` is in the base token (`bd` decimals). This is the engine's swap
convention, and it is the opposite of a traditional order book, where a
buy amount would be the amount bought.

The engine returns amounts in canonical form (`"20.00000000"`); any valid
decimal string is accepted on restore and means the same thing.

`pool` holds the reserves the demo had configured, before matching. The
engine's `match()` is a pure calculation and does not consume the pool, so
`pool.before` in a match result is exactly these reserves.

## The fee

`fee` is the pool fee in 1/10000 units and is applied only to the part of
the match that goes through the pool. The demo displays it in percent next
to the Pool heading and allows editing it: `feeE4 = percent * 100`, so
`0.5` is `50`.

The demo starts at `50` (0.50%), which is the fee the node settles its
matches with, hardcoded in `block_applier.cpp` as `pool.buy(pa, 50)` and
`pool.sell(pa, 50)` in node v0.10.30. The `feeE4 = 10` default on
`PoolLiquidity_uint64::sell/buy` is not what the node uses in the match
path, so do not rely on it. A link must carry the fee the scenario was
matched with, otherwise the pool-side amounts differ: the same book and
pool give a pool-side amount of `15.27964751` WART at fee 5 but
`15.21085470` WART at fee 50.

## What the demo does with a link

On load it decodes the parameter, constructs the engine with `bd` and
`fee`, sets the pool, re-adds every order with its `limitBits`, `amount`
and `caption`, and then runs the match. Validation:

- `v` must be `1` or `2`, otherwise the link is ignored
- `bd` must be an integer in 0..18
- `fee` must be an integer in 0..9999
- `pool` must be an array of exactly two entries
- every order must be a two-entry array `[integer, string]` (v1) or a
  three-entry array `[integer, string, string]` (v2, the caption)

A v1 link has no caption, so it restores without one. It also has one
entry per price level rather than per order, so a v1 link made from a book
with several orders at the same limit restores as a single order with the
summed amount.

A malformed link never breaks the page: the demo logs a warning and falls
back to its default state (pool 100 TOKEN / 200 WART, no orders,
`baseDecimals` 8, fee 50). A payload that differs from that default state
is written back to the address bar while the user works; an untouched
default demo keeps a clean URL.

## Recipe 1: copy the link from the demo

Open `/defi-demo`, set the pool, the fee and the orders, then press
"Copy shareable link". The page keeps `?state=` up to date on every change
(debounced `history.replaceState`, so the browser history stays clean), so
copying the address bar gives the same link. When the clipboard is not
available the button offers a selectable field instead.

## Recipe 2: generate the link from Node

`warthog-fbm` is already a dependency of this repo, so a script inside the
repo resolves it from `node_modules`. Run it from the website repository
root:

```js
// make-defi-demo-link.mjs
import FbmEngine from "warthog-fbm";

await FbmEngine.init();

const engine = new FbmEngine({ baseDecimals: 8, feeE4: 50 });
engine.setPool({ base: "100", quote: "200" });
engine.addBuy({ limit: "1.732153", amount: "20" });    // 20 WART for TOKEN
engine.addSell({ limit: "0.8000049", amount: "20" });  // 20 TOKEN for WART

const m = engine.match();
const cfg = engine.getConfig();

// The same payload the page builds in encodeMatch(). The book comes as
// price levels, each holding its own orders, so the levels are flattened
// into one entry per order.
const orders = (levels) =>
  levels.flatMap((l) => l.orders.map((o) => [l.limitBits, o.amount, o.caption]));

const payload = {
  v: 2,
  bd: cfg.baseDecimals,
  fee: cfg.feeE4,
  pool: [m.pool.before.base, m.pool.before.quote],
  buys: orders(m.buys),
  sells: orders(m.sells),
};

const state = Buffer.from(JSON.stringify(payload), "utf8")
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

console.log(`https://warthog.network/defi-demo?state=${state}`);
```

```
node make-defi-demo-link.mjs
```

The script prints the link from the example above. Restoring that link
into a fresh engine reproduces the same book, the same pool and the same
fills.

## Recipe 3: generate the link in any language

Only two steps need care: the fee unit and `limitBits`. This Python
version produces byte-identical output to Recipe 2:

```python
import base64, json, math

def limit_bits(limit: str, base_decimals: int = 8) -> int:
    scaled = float(limit) * 10 ** (8 - base_decimals)
    frac, exp = math.frexp(scaled)          # 0.5 <= frac < 1
    mantissa = int(frac * 65536)            # truncate, like the engine
    return mantissa | ((exp + 63) << 16)

payload = {
    "v": 1,
    "bd": 8,
    "fee": 5,
    "pool": ["100.00000000", "200.00000000"],
    "buys": [[limit_bits("1.732153"), "20.00000000"]],
    "sells": [[limit_bits("0.8000049"), "20.00000000"]],
}

raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
state = base64.urlsafe_b64encode(raw).decode().rstrip("=")
print(f"https://warthog.network/defi-demo?state={state}")
```

Keep the JSON compact: whitespace is valid but inflated by base64. If your
JSON library emits non-ASCII escapes, the result still decodes, it is just
longer than needed.

## Reproducing a specific match

The payload contains the pre-match book and pool only, never a match
result. The demo re-runs the same engine over it, so a link is a
reproducible scenario rather than a recording:

- the engine is deterministic: no clock, no randomness, and `match()` does
  not mutate the pool, so the same payload always produces the same fills
- the displayed filled amounts, pool "before/after" values and swap arrows
  are all derived from that recomputed match

This is why a link can stand in for a match recorded elsewhere: encode the
inputs that produced the match, and the demo recomputes it visibly.

## Building a link from a node-side match (planned, not implemented)

The client explorer does not link to the demo yet. When it does, the
mapping from the defi node to this payload is:

| demo payload      | node source                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `pool`            | the market's pool reserves before the block                                 |
| `buys` / `sells`  | the block's `limitSwap` transactions for that market, one entry per order  |
| `limitBits`       | `LimitPriceEl`, a `Price_uint64`: use its grid value directly               |
| `amount`          | the swap's input amount, in WART for buys and in the base token for sells   |
| `caption`         | nothing: the node has no equivalent, the label is a demo-side nicety       |
| `fee`             | the settlement fee in 1/10000 units: `50` as of node v0.10.30               |
| `bd`              | the base token's decimals                                                   |

Notes that matter for that work:

- The price grid is the same type in both codebases
  (`Price_uint64`, `to_uint32() == mantissa | exponent << 16`), so a node
  limit price is already a `limitBits` value. Do not go through the decimal
  rendering.
- The node aggregates orders by price level before running FBM and
  distributes fills back to individual orders by order id. The demo engine
  does the same, and it keeps the individual orders, so the mapping is one
  demo order per node transaction, not per price level. The order of the
  entries is the order of the book, which is what preserves the fill
  priority when the link is restored.
- The node's settlement fee is not the demo default: it is the literal
  `50` in `block_applier.cpp` (node v0.10.30). Put it in `fee`, or the
  pool-side amounts will not match. Re-check that literal when the node
  version moves.
- The demo reproduces the node's result only while the two FBM
  implementations agree. The demo runs `warthog-fbm` from `package.json`;
  a node release that changes the matcher can drift from it.

## Decoding a link

```sh
node -e 'const s = process.argv[1];
console.log(JSON.stringify(JSON.parse(Buffer.from(s, "base64url").toString("utf8")), null, 2))' \
  "<state value>"
```

## Verifying a link

1. Decode it (see above) and check the fields against the intended
   scenario.
2. Restore it in Node and compare: build the source engine, then a second
   engine from the payload, and require that `match().buys`,
   `match().sells` and `match().pool.before` are equal.
3. Open the link and check the order books, the pool row, the fee field and
   the filled totals.
4. `tests/defi-demo-share-link.e2e.mjs` drives a real share and restore
   cycle in headless Chromium, including malformed links and the clipboard
   fallback.

## Limits and caveats

- Every order is its own entry, so two orders at the same limit stay two
  entries with the same `limitBits`. The order of the entries is the order
  of the book, which is what preserves the fill priority on restore.
- Each order costs roughly 32 characters in the final link, and a caption
  adds about 4 more for a short one. Keep books short; very long links can
  exceed URL length limits in browsers and proxies. The demo's live site
  serves a URL of about 16 KB, and the edge rejects anything longer, so a
  link that does not open is almost always too long rather than broken.
- A caption is capped at 64 characters in the link, so a long label is
  trimmed there. The order keeps its full caption.
- `bd` is fixed when the engine is constructed, so a link cannot change
  the token's decimals, only the scenario that uses them.
- The demo's fee field rejects percentages finer than 0.01, because the
  engine's unit is 1/10000 and rounding would differ from what the user
  typed.

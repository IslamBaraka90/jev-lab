# 002 · Data foundation

**Depends on:** 001 · **Blocks:** every demo

## Why

Half of these demos need real market history, because a strategy or a trade review is worthless on invented prices. The other half need ledgers, orders, wallets and alerts, which nobody should ever put on camera from a real customer. So the project keeps two clearly separated data classes, and every demo says which one it uses.

## Class 1 · Cached-real

Fetched once from a named source, committed, never fetched again at runtime.

- **Location:** `data/market/`
  - `candles/<SYMBOL>.json` — daily OHLCV, adjusted, with `{ symbol, currency, exchange, instrumentType, firstDate, lastDate, bars }`.
  - `fundamentals/<SYMBOL>.json` — the statement lines the screening demos need: revenue, net income, total assets, total debt, cash and equivalents, short-term investments, receivables, inventory, operating cash flow, capital expenditure, dividends paid, shares outstanding, sector, industry, market cap. Annual for four years, quarterly for eight.
  - `manifest.json` — one entry per file: source, endpoint, fetched-at, row count, and a one-line note on what it may and may not be used for.
- **Symbols:** the five from the suite (NVDA, JPM, XOM, BTC-USD, GLD) plus AAPL, MSFT, KO, PG, JNJ, XLE, SPY and four more chosen when 161 is built, so screening has a real peer set.
- **Range:** ten years of daily candles, or the full history if shorter.
- **Fetcher:** `scripts/fetch-market.js [--symbols A,B] [--what candles,fundamentals]`, using `yahoo-finance2`, run by hand. It rewrites the manifest and prints a diff summary. It never runs in CI or at build time.
- **Size budget:** 2 MB per symbol per file after minification; drop fields nothing reads.

## Class 2 · Synthetic

Generated in this repo from a fixed seed, so anyone can regenerate the exact same dataset.

- **Location:** `data/synthetic/<slug>.json` plus `data/synthetic/<slug>.labels.json`.
- **Generators:** one file per dataset in `scripts/generate/<slug>.js`, each exporting `generate(seed)` and writing both files. `scripts/generate/index.js` runs them all.
- **Randomness:** one small seeded PRNG in `scripts/generate/lib/random.js` (mulberry32). No `Math.random` anywhere in generation.
- **Labels are ground truth.** The generator plants problems on purpose — a duplicated journal line, a mule chain, a wallet three hops from a mixer — and writes what it planted to the labels file. Labels are used by the report and by tests. They are never part of the state sent to the model.
- **Realism rules:**
  - Amounts, dates, references and names look like the domain: IBAN-shaped account references, plausible merchant categories, working-hours timestamps with a night-time tail, currency mixes, and rounded amounts where humans round.
  - Distributions are skewed, not uniform: a few large values, many small ones.
  - Rates match the domain: roughly 2% of ledger lines carry an issue, 0.5% of orders are fraud, 4% of AML alerts are true positives.
  - Every dataset has at least three genuinely ambiguous items, so demos aren't all clean wins.
- **No real people or companies.** Names come from a fixed word list in `scripts/generate/lib/names.js`. No real IBANs, card numbers (use `4xxx xxxx xxxx 1234`-style masks only), wallet addresses (use a `0xDEMO…` prefix), or company registration numbers.
- **Size budget:** 500 KB per dataset before compression; sample down rather than trim realism.

## Mixed demos

A few demos use both: real candles with synthetic trades on top (151–153, 156), real prices with synthetic holdings (141–144), real prices with synthetic headlines (171). The PRP says which part is which, and the page shows two badges.

## Dataset contract

Every `data.json` a demo reads has the same envelope:

```json
{
  "id": "ledger-integrity",
  "class": "synthetic",
  "generatedAt": "2026-09-19",
  "seed": 1101,
  "source": "scripts/generate/ledger-integrity.js",
  "items": [{ "id": "L-0001", "…": "…" }],
  "context": { "…": "anything shared by all items" }
}
```

For cached-real data, `class` is `cached-real`, `source` names the endpoint, and `generatedAt` is the fetch date.

## Provenance on screen

The demo page shows a data chip: **Synthetic · seed 1101 · regenerate with `npm run generate ledger-integrity`** or **Cached · Yahoo Finance · fetched 19 Sep 2026**. The chip links to the dataset file in the repo.

## Files

| Path | Change |
|---|---|
| `scripts/fetch-market.js` | new |
| `scripts/generate/index.js` | new |
| `scripts/generate/lib/random.js` | new: seeded PRNG, pick, weighted, normal, skewed |
| `scripts/generate/lib/names.js` | new: merchants, people, banks, tokens |
| `scripts/generate/lib/money.js` | new: currency, rounding, amount shapes |
| `data/market/manifest.json` | new |
| `src/services/dataset.js` | new: load and validate the envelope, shared by server and scripts |
| `web/src/components/DataChip.jsx` | new |
| `package.json` | scripts: `fetch:market`, `generate` |
| `test/dataset.test.js` | new |

## Acceptance

- [ ] `npm run generate` twice in a row produces byte-identical files.
- [ ] Every `data.json` validates against the envelope, and every demo's items have unique ids.
- [ ] `data/market/manifest.json` covers every file in `data/market`, with a fetch date.
- [ ] No synthetic dataset contains a real company name, a valid IBAN, a real card number or a real wallet address.
- [ ] Label files exist for every synthetic dataset that claims accuracy in its report.
- [ ] Repo data under 60 MB in total.

## Video beats

- The two folders side by side: `data/market` with a manifest, `data/synthetic` with generators.
- Running `npm run generate ledger-integrity` and getting the same file back.
- Opening a labels file and pointing out that the model never sees it.

## Notes and risks

- Market data is cached for a demo, not redistributed as a dataset product; keep the manifest note about that.
- Fundamentals coverage varies by symbol. The screening demos must degrade gracefully when a field is missing, and say so on screen.

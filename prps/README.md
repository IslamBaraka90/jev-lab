# PRPs

Each file here is one unit of work: enough context, decisions and acceptance criteria to build it in a single pass, review it, and move on. Implement one at a time, in the order below.

## How to use these

1. Read the PRP and the ones it depends on.
2. Build only what the PRP asks for.
3. Tick the acceptance list. Anything that doesn't pass goes back into the PRP as a note, not into the next one.
4. Record the demo's video beats while the work is fresh.

A PRP is done when its acceptance list passes, `npm test` is green, and the demo runs in demo mode with no network access.

## Conventions

- **Numbering.** `001–006` are foundations. Demos are numbered in blocks of ten by domain: `1xx` books, orders, fraud, crypto, portfolio, trades, screening, news, strategy.
- **Slug.** Every demo has a slug used for its folder, its route and its fixture file, for example `ledger-integrity` → `demos/ledger-integrity/` and `/demos/ledger-integrity`.
- **Data class.** Every demo declares one: **cached-real** (fetched once from a live source and committed) or **synthetic** (generated in this repo from a seed). Some declare both, and say which part is which.
- **Everything the deployed site needs is committed.** No live API calls in demo mode, so datasets and recorded answers are tracked files, not ignored ones.
- **Template.** Copy [000-prp-template.md](000-prp-template.md).

## Target layout

```
demos/<slug>/            one demo: definition, dataset, recorded answers, explainer
  demo.js                id, title, domain, value, state builder, questions, evaluation
  data.json              the dataset this demo reads
  fixtures.json          recorded Jev answers, keyed by item id
  notes.md               the short explainer the page shows
demos/index.js           the registry the catalog and the router read
data/market/             market data fetched once and committed, with provenance
data/synthetic/          generated datasets and their ground-truth labels
scripts/generate/        one seeded generator per synthetic dataset
scripts/fetch-market.js  refreshes data/market (run locally, rarely)
scripts/record-demo.js   runs a demo against the live API and writes fixtures.json
src/                     Express server: local real mode only
web/                     the site: catalog, demo pages, shared runtime
prps/                    these files
```

## Foundations

| # | PRP | What it settles |
|---|---|---|
| 001 | [Demo mode and deployment](001-demo-mode-and-deployment.md) | Recorded answers, no network on the deployed site, Vercel build, the repo hand-off |
| 002 | [Data foundation](002-data-foundation.md) | Cached-real versus synthetic, generators, seeds, provenance, ground truth |
| 003 | [App structure and demo catalog](003-app-structure-and-catalog.md) | Routes, navigation, the catalog, finding a demo by need |
| 004 | [Demo runtime](004-demo-runtime.md) | The shared engine and UI every demo page is built from |
| 005 | [Code walkthrough and video mode](005-code-walkthrough-and-video-mode.md) | Showing the real source on screen, presenter mode for recording |
| 006 | [Quality bar](006-quality-bar.md) | Performance budgets, lazy loading, accessibility, tests |

## Demos

| # | Demo | Domain | Data |
|---|---|---|---|
| 101 | [Ledger integrity review](101-ledger-integrity.md) | Books | synthetic |
| 102 | [Bank reconciliation](102-bank-reconciliation.md) | Books | synthetic |
| 103 | [Expense posting](103-expense-posting.md) | Books | synthetic |
| 104 | [Three-way match](104-three-way-match.md) | Books | synthetic |
| 105 | [Close blockers](105-close-blockers.md) | Books | synthetic |
| 111 | [Order risk at checkout](111-order-risk.md) | Orders | synthetic |
| 112 | [Repeat non-fulfilment abuse](112-cod-abuse.md) | Orders | synthetic |
| 113 | [Dispute and refund routing](113-dispute-routing.md) | Orders | synthetic |
| 114 | [Chargeback evidence](114-chargeback-evidence.md) | Orders | synthetic |
| 115 | [Merchant onboarding risk](115-merchant-onboarding.md) | Orders | synthetic |
| 116 | [Delivery exceptions](116-delivery-exceptions.md) | Orders | synthetic |
| 121 | [Card fraud triage](121-card-fraud-triage.md) | Fraud | synthetic |
| 122 | [Account takeover](122-account-takeover.md) | Fraud | synthetic |
| 123 | [AML alert triage](123-aml-alert-triage.md) | Fraud | synthetic |
| 124 | [Sanctions name matching](124-sanctions-name-match.md) | Fraud | synthetic |
| 125 | [Mule networks](125-mule-network.md) | Fraud | synthetic |
| 126 | [Insider trading surveillance](126-insider-surveillance.md) | Fraud | synthetic + cached-real prices |
| 131 | [Wallet risk scoring](131-wallet-risk.md) | Crypto | synthetic |
| 132 | [Wallet behaviour profiling](132-wallet-profiling.md) | Crypto | synthetic |
| 133 | [Tracing and mixer exposure](133-mixer-tracing.md) | Crypto | synthetic |
| 134 | [Token screening](134-token-screening.md) | Crypto | synthetic |
| 135 | [Sybil clusters](135-sybil-clusters.md) | Crypto | synthetic |
| 141 | [Portfolio health](141-portfolio-health.md) | Portfolio | synthetic + cached-real prices |
| 142 | [Portfolio compare](142-portfolio-compare.md) | Portfolio | synthetic + cached-real prices |
| 143 | [Rebalance review](143-rebalance-review.md) | Portfolio | synthetic + cached-real prices |
| 144 | [Factor and sector exposure](144-factor-exposure.md) | Portfolio | synthetic + cached-real prices |
| 145 | [Mandate compliance](145-mandate-compliance.md) | Portfolio | synthetic |
| 146 | [Income and cash planning](146-income-planning.md) | Portfolio | synthetic |
| 151 | [Post-trade lesson review](151-post-trade-review.md) | Trades | cached-real prices + synthetic trades |
| 152 | [Trade feature analysis](152-trade-feature-analysis.md) | Trades | cached-real prices + synthetic trades |
| 153 | [Execution quality](153-execution-quality.md) | Trades | cached-real prices + synthetic fills |
| 154 | [Trader behaviour](154-trader-behaviour.md) | Trades | synthetic |
| 155 | [Journal versus reality](155-journal-vs-reality.md) | Trades | synthetic |
| 156 | [Missed trades](156-missed-trades.md) | Trades | cached-real prices |
| 161 | [Screening for a goal](161-goal-screening.md) | Screening | cached-real fundamentals |
| 162 | [Fundamental read](162-fundamental-read.md) | Screening | cached-real fundamentals |
| 163 | [Sharia screen](163-sharia-screen.md) | Screening | cached-real fundamentals |
| 164 | [Dividend safety](164-dividend-safety.md) | Screening | cached-real fundamentals |
| 165 | [Accounting red flags](165-accounting-flags.md) | Screening | synthetic |
| 166 | [Peer valuation](166-peer-valuation.md) | Screening | cached-real fundamentals |
| 171 | [News impact](171-news-impact.md) | News | synthetic + cached-real prices |
| 172 | [Event clustering](172-event-clustering.md) | News | synthetic |
| 173 | [Filings and calls](173-filings-read.md) | News | synthetic |
| 174 | [Entity links](174-entity-links.md) | News | synthetic |
| 175 | [Rumour grading](175-rumour-grading.md) | News | synthetic |
| 181 | [Golden cross review](181-golden-cross-review.md) | Strategy | cached-real prices |
| 182 | [Setup timing](182-setup-timing.md) | Strategy | cached-real prices |
| 183 | [Regime classification](183-regime-classification.md) | Strategy | cached-real prices |
| 184 | [Overfit review](184-overfit-review.md) | Strategy | synthetic backtests |
| 185 | [Strategy correlation](185-strategy-correlation.md) | Strategy | synthetic backtests |

The existing backtest lab keeps its pages and becomes the deep-dive behind the trades block; 003 says exactly how it is folded in.

## Order of work

1. **Foundations 001 → 006.** Nothing else is buildable without them.
2. **One demo per data class to prove the runtime:** 101 (synthetic, table), 181 (cached-real, candles), 174 (synthetic, graph). Fix the runtime here, before the volume work.
3. **The rest of the blocks**, in catalog order. Each block shares a generator and a view, so they go faster in groups.
4. **Video pass.** Record the beats listed in each PRP once its block is done.

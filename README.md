# Jev Lab

A demo site and a backtest lab for TypeSafe's Jev model, built on the official JavaScript SDK,
[`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript).

- **Demos** — fifty of them, across nine domains — put typed questions to Jev over real financial work: ledgers, orders,
  fraud, wallets, portfolios, trades, filings and strategies. Each one shows the state that was sent, the answers that
  came back, and a report that grades them against data where the right answer is known. Every demo folder carries a
  `notes.md` saying what the recorded run actually found, including where it did badly. Specifications live in
  [`prps/`](prps/README.md).
- **The benchmark** at `/benchmark` puts all fifty recorded runs on one page: the headline, how many items matched
  ground truth with its interval, the lift over a simple rule, the calibration error, and what moved since the last
  run. `npm run score` produces it, offline and free. See [Running the suite again](#running-the-suite-again).
- **The lab** backtests Jev's trade decisions on historical daily candles, replays every decision on a chart, and reports
  what the trades earned. It also keeps the support ticket example from the
  [quickstart](https://docs.typesafe.ai/introduction/quickstart).

## Two modes

The deployed site is **recorded**: every answer was captured once with `npm run record`, committed to this repository, and
replayed from there. It needs no API key, no server and no network, and each demo page names the model version and the day
its answers were captured.

**Live** mode is local and opt-in. Run the Express server with `TYPESAFE_API_KEY` set and each demo gains a "Run live"
switch; it stays off until you turn it on and confirm a dialog that says how many requests a full run would send. Nothing
calls the API before that.

Data comes in two kinds, and every page says which it is: **cached real** market data in `data/market`, fetched once from
Yahoo Finance with a manifest recording what and when, and **synthetic** data generated here from a fixed seed, with the
planted problems kept in `data/synthetic/*.labels.json`, outside the demo folders, so they can never reach a state.

## A demo page

Every demo opens on its graded run: the headline numbers, one item beside its typed answers, the decision those answers
make and whether ground truth agreed, then the whole report — a rule and the majority class beside the model, a
confusion matrix with precision, recall and F1, calibration, a threshold you can drag, and the demo's own checks. The
list on the left filters to the items it got wrong or was unsure about. "Watch the story" (or `p`) plays the demo as five
full-screen beats for recording; `npm run shot-list <demo>` prints the address of each beat.

What a demo may add beyond the base contract — stage hints, a per-item grade, a verdict, baselines, metrics, gates and
its presenter story — is in [docs/demo-contract-additions.md](docs/demo-contract-additions.md). The review these changes
follow is in [docs/ui-ux-review](docs/ui-ux-review/README.md).

## Running the suite again

The point of the suite is to run the same test on the next model version and see what moved.

1. `npm run record <demo>` asks the model every item and replaces the pinned run in `demos/<demo>/fixtures.json`. The
   run it replaces is kept under `benchmarks/runs/` (not committed). This is the only paid step.
2. `npm run score` re-scores all fifty runs with the same evaluate, grade and report code the pages use, writes
   `web/src/generated/scoreboard.json` for the site, and appends each run to `benchmarks/history.json`. A run is keyed
   by model, date, dataset hash and questions hash, and two runs are compared only when both hashes match: a changed
   dataset or a reworded question is a different test.
3. `npm run check` fails if a demo misses a gate it declares (`gates: { macroF1: { min: 0.8 } }` in its `demo.js`), or
   if a headline falls more than three points between two runs of the same test.

## Keys

There is no API key in this repository and there never has been. `.env` is ignored, `.env.example` carries names with
empty values, and [`test/no-secrets.test.js`](test/no-secrets.test.js) fails the build if a tracked file ever contains
anything shaped like a credential — or if the key on the machine running the tests turns up anywhere in the git history.

## Setup

Requires Node.js 22.12 or newer.

```bash
npm install
npm run build
npm start
```

Then open http://localhost:3000. The demos work as they are. To run anything live, put your API key from the
[TypeSafe console](https://console.typesafe.ai/settings/keys) in `.env` first; `.env.example` lists every setting, and
variables already set in your shell take precedence over `.env`.

### Deploying

`npm run build` writes a static site to `web/dist` with no server dependency. On Vercel, use build command `npm run build`
and output directory `web/dist`; [`vercel.json`](vercel.json) carries the rewrites and cache headers. The Express server is
for local use only, and the lab needs it.

## Dashboard

The dashboard is a React app in `web/`, built with Vite and served by the Express server. It uses The Fintech Builder Open Core 03 design system in its dark navy theme.

- **Backtests** starts a pilot or full suite, with or without indicators or blind mode, after an approval step that shows the requests and tokens it will use. It lists every run in `results/`, including runs started from the command line.
- **Theater** replays each decision in four steps: Jev reads the bars up to the cutoff, decides, the bars after the decision play out with the entry, stop, target and exit marked, and the trade is scored. A running backtest streams its decisions here live. Controls: play and pause (Space), previous and next (arrow keys), speed, a position slider, and a timeline of every decision. Add `?at=5` to the address to open on a decision.
- **Report** shows net return, P&L, win rate, drawdown and profit factor; cumulative P&L against always going long; results by symbol and by side; exit reasons; results by decision confidence; the contradictions between Jev's answers, to report to the Jev team; what the price did when Jev stayed flat; and the answers behind winning and losing trades.
- **Decisions** is a sortable, filterable table of every decision. Each opens a drawer with the chart, the trade, all 15 answers with their probabilities, the indicators, and the exact state sent to Jev.
- **Compare runs** puts two runs side by side: headline results, cumulative P&L, and how often they made the same decision.

The server listens on 127.0.0.1 so only this computer can start backtests; set `HOST=0.0.0.0` to open it to your network. Only one backtest runs at a time, and cancelling keeps the decisions made so far.

For development, run `npm run dev` and `npm run dev:web`, then open http://localhost:5173. The dashboard reloads as you edit, and `/api` is forwarded to the server.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Starts the server and dashboard on `PORT` (default 3000). |
| `npm run build` | Builds the dashboard into `web/dist`. |
| `npm run dev` | Starts the server and restarts it when files change. |
| `npm run dev:web` | Serves the dashboard with hot reload on port 5173. |
| `npm run pilot` | Backtest pilot from the command line: 12 Jev trade decisions on AAPL. See [Backtests](#backtests). |
| `npm run pilot:indicators` | The pilot with technical indicators in every state. |
| `npm run suite` | Full suite: 60 decisions on each of NVDA, JPM, XOM, BTC-USD and GLD (300 requests). |
| `npm run suite:indicators` | The full suite with technical indicators. |
| `npm run quickstart` | Sends the quickstart request once and prints the answers. Evaluate your own text with `npm run quickstart -- "text"`. |
| `npm test` | Runs the tests offline, with TypeSafe stubbed and no market data calls. |
| `npm run check` | Checks the built site against its size budgets, scores the suite against its gates, then runs the tests. |
| `npm run generate` | Rebuilds every synthetic dataset from its seed. Running it twice changes nothing. |
| `npm run fetch:market` | Refetches the cached market data in `data/market`. Run by hand, rarely. |
| `npm run record <slug>` | Records a demo's answers from the live API into `demos/<slug>/fixtures.json`. The only paid step. |
| `npm run score` | Scores every recorded run offline, rewrites the scoreboard and appends to the run history. Add `-- --check` to fail on a missed gate or a regression, or a slug to print one row. |
| `npm run shot-list <slug>` | Prints a demo's five presenter beats with the address of each. Takes a domain or `--all`, and `--base <url>`. |

## Backtests

The dashboard and all four scripts run the same backtest (`src/services/backtest-runner.js`). The scripts run `scripts/backtest.js`, which also takes its own symbols and options, and Ctrl+C stops a run and keeps what was saved:

```bash
npm run pilot -- MSFT TSLA --indicators --blind --cutoffs 20
```

For each symbol it:

1. Fetches three years of daily candles from Yahoo Finance: a two-year evaluation period and one year before it, so indicators such as SMA(200) are ready at the first cutoff.
2. Picks the cutoffs, spread evenly from three months into the evaluation period to the last day that still has 8 days after it.
3. Asks Jev the trade decision questions at each cutoff. The state shows at most the 90 candles up to the cutoff and nothing after it.
4. Scores each decision on the candles after its cutoff, as soon as the decision is made. A LONG or SHORT enters at the next day's open. It exits at Jev's stop or target (at the open if the price gaps past it), or at the close after Jev's holding period. If one candle reaches both levels, the stop is assumed to come first. A NOT_APPLICABLE stop or target means none, and a NOT_APPLICABLE holding period means all 8 days. 5 bps is charged per side, and P&L is on 10,000 per trade. Each cutoff is also scored as if it had been a long held for 8 days, as a baseline.

With `--indicators`, the state also describes ten indicators computed from the candles up to the cutoff with [fintech-algorithms](https://docs.thefintechbuilder.com): EMA(20), SMA(50), SMA(200) with the golden or death cross, MACD(12, 26, 9), RSI(14), Stochastic(14, 3, 3), ADX(14) with +DI and -DI, Bollinger Bands(20, 2), ATR(14) and MFI(14). Each has its values at the cutoff, a signal with the rule that produced it, a plain-language explanation and, for oscillators and MACD, its last five values.

`--blind` hides the symbol, exchange and dates and rebases prices so the first close shown is 100, so decisions can't rely on what the model may remember about an instrument's history. Entry style is recorded but not simulated.

Each run gets a folder in `results/` with one file per symbol and a `summary.json`. A symbol's file has the settings, questions and candles and, for each cutoff, the exact state sent, Jev's full response, the trade plan, the simulated trade, the baseline and the market's move over the next 8 days. The summary has totals per symbol and overall: actions, win rate, net return, P&L, results by side, exit reasons, the baseline and token usage. The presets and settings are at the top of `src/services/backtest-runner.js`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness check. Does not call TypeSafe. |
| GET | `/api/backtests` | Saved and running backtests, with the presets and settings. |
| POST | `/api/backtests` | Starts a backtest: `{ "preset": "pilot" \| "suite", "symbols"?, "cutoffs"?, "indicators"?, "blind"? }`. |
| GET | `/api/backtests/:id` | A run with its candles and decisions. |
| GET | `/api/backtests/:id/events` | Server-sent events: the run's snapshot, then its progress until it finishes. |
| POST | `/api/backtests/:id/cancel` | Stops a running backtest. |
| GET | `/api/backtests/:id/symbols/:symbol/decisions/:cutoff` | One decision with the full state and response. |
| GET | `/api/models` | Models available to your API key. |
| GET | `/api/quickstart` | The quickstart example: `department` (Choice), `frustration` (Score) and `is_urgent` (Noul). |
| POST | `/api/quickstart` | The same questions about your own text: `{ "state": "..." }`. |
| POST | `/api/systemone` | Any request in the [API format](https://docs.typesafe.ai/api): `{ "state", "questions", "model"? }`. |

Successful responses have the same body as the TypeSafe API, and the TypeSafe request id is returned in the `x-typesafe-request-id` header. Errors are returned as `{ "error": { "message", ... } }`. TypeSafe 4xx errors, such as 422 validation failures, pass through with their details. A rejected API key or a TypeSafe outage returns 502, and a timeout returns 504.

With curl:

```bash
curl -X POST http://localhost:3000/api/systemone \
  -H "Content-Type: application/json" \
  -d '{"state": "Help! My payouts have been failing for 3 days.", "questions": {"is_urgent": {"type": "noul", "instructions": "Does this convey urgency?"}}}'
```

With PowerShell:

```powershell
$body = @{
  state     = "Help! My payouts have been failing for 3 days."
  questions = @{ is_urgent = @{ type = "noul"; instructions = "Does this convey urgency?" } }
} | ConvertTo-Json -Depth 10
Invoke-RestMethod http://localhost:3000/api/systemone -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10
```

## Project layout

```text
scripts/quickstart.js              CLI run of the quickstart example
scripts/backtest.js                Trade decision backtests from the command line
src/server.js                      Entry point: API, backtests and the built dashboard
src/app.js                         Express app: middleware and routes
src/config.js                      Loads .env and validates settings
src/lib/typesafe.js                Shared TypeSafeClient
src/lib/http.js                    HttpError and the TypeSafe response helper
src/lib/yahoo-finance.js           Shared Yahoo Finance client
src/middleware/error-handler.js    Maps SDK errors to HTTP responses
src/questions/support-ticket.js    Quickstart state and questions
src/questions/trade-decision.js    Trade decision state, questions and trade plan
src/routes/                        One router per endpoint group
src/services/backtest.js           Cutoffs, trade simulation and run summary
src/services/backtest-runner.js    Runs a backtest, saves it and reports progress
src/services/backtest-manager.js   Starts, follows and cancels runs for the dashboard
src/services/backtest-store.js     Reads saved runs from results/
src/services/run-model.js          Run model shared by the server and the dashboard
src/services/eod-candles.js        Daily OHLCV candles from Yahoo Finance
src/services/indicators.js         Ten technical indicators with signals and explanations
web/src/pages/                     Backtests, run (theater, report, decisions) and compare pages
web/src/charts/                    Candlestick, line, column and timeline charts in SVG
web/src/components/                Shell, controls and answer displays
web/src/styles/                    Design tokens and styles
test/                              Offline tests
```

## Adding a feature

1. Define the feature's questions in `src/questions/` with `choice`, `score` and `noul` from `@typesafe-ai/sdk`.
2. Add a router in `src/routes/` that builds the state, calls `typesafe.systemOne()` and applies your decision logic in code, for example [confidence thresholds](https://docs.typesafe.ai/confidence).
3. Mount the router in `src/app.js` and add a test in `test/`.

## License

[MIT](LICENSE). The code, the demo definitions, the generators and the synthetic datasets in
`data/synthetic` are all covered by it.

The cached market data in `data/market` is not: those files were fetched once from Yahoo Finance and
are committed so the demos run without a network, with a manifest recording what was taken and when.
They are Yahoo's data under Yahoo's terms, not the author's to relicense. Anyone reusing this
repository commercially should refetch that directory from a source they are licensed to use —
`npm run fetch:market` rebuilds it — or drop the cached-real demos and keep the synthetic ones.

# 001 · Demo mode and deployment

**Depends on:** nothing · **Blocks:** everything else

## Why

The site goes on Vercel so anyone can click through 50 demos. It must work with no API key, no server and no network calls to anything but its own static files. Every answer the site shows was recorded once, on this machine, and committed. People who want to run it for real clone the repo and use their own key.

## Two modes

| | Demo mode | Real mode |
|---|---|---|
| Where | The deployed site, and `npm run dev` without a key | Local machine with `TYPESAFE_API_KEY` set |
| Answers | Read from `demos/<slug>/fixtures.json` | Live calls to the TypeSafe API |
| Cost | None | Paid, and shown before it starts |
| Data | Committed datasets | The same datasets, plus anything you fetch yourself |
| Writes | None | Records new fixtures and results |

Demo mode is the default everywhere. Live mode needs three things at once: a key on the server, the page served by Express,
and a person switching a demo to live and confirming the dialog that says how many requests a full run would send. A page that
spends money on load would be a trap, however local it is, so nothing calls the API until that switch is on.

## How demo mode works

1. Each demo folder holds `fixtures.json`: a map of item id → the exact answer object the API returned, plus `model`, `requestId`, `latencyMs`, `usage` and `recordedAt`.
2. The web app imports a client with one shape (`runItem(demo, item)`), with two implementations behind it:
   - `replayClient` reads the fixture, waits a short, configurable beat so the phase animation still plays, and returns the answer.
   - `liveClient` posts to `/api/demos/:id/run` on the local server.
3. `web/src/lib/mode.js` exposes `liveAvailable` (the Express server injects `window.__JEV_LIVE__` when it has a key). The
   runtime passes `live` per run, and it is false until someone switches a demo over and confirms; switching clears any
   results on screen so recorded and live answers never mix.
4. The replay client never imports the SDK, so demo bundles carry no client code and no key handling.

## Recording fixtures

`scripts/record-demo.js <slug> [--items 1,2,3] [--force]`:

- Loads the demo definition and dataset, builds the state for each item, calls the API, and writes `demos/<slug>/fixtures.json` sorted by item id.
- Skips items that already have a fixture unless `--force`.
- Prints a summary: items recorded, tokens, latency, cost estimate, and the model version.
- Refuses to run without `TYPESAFE_API_KEY`, and refuses to write outside `demos/`.
- Writes `recordedAt` and `model` once per file, not per item.

Fixtures are reviewed like code. A re-record that changes an answer shows up as a diff, which is exactly the point.

## What the site says about it

- A banner on every demo page: "Recorded answers · model `jev-1.13.0` · captured 19 Sep 2026", with a link to the repo and one line on how to run it live.
- The catalog card shows a small badge: **Recorded**.
- The About page explains the two modes, what it costs to run live, and that datasets are either fetched once from a named source or generated in this repo.

## Deployment

- **Build:** `npm run build` produces `web/dist`, a static site with no server dependency.
- **Vercel:** framework "Other", build command `npm run build`, output directory `web/dist`. `vercel.json` rewrites everything except `/assets/*` and `/data/*` to `/index.html`.
- **No serverless functions.** If one is ever needed, it is a separate PRP.
- **Headers:** long cache for `/assets/*`, short for datasets fetched at runtime.
- **Express server stays** for local real mode and for the existing backtest lab; it is not deployed.

## Git

- `demos/**/fixtures.json`, `demos/**/data.json`, `data/market/**`, `data/synthetic/**` are committed. Add explicit un-ignore rules so the existing `results/` ignore never swallows them.
- `results/`, `screenshots/`, `web/dist/`, `.env` stay ignored.
- Repo size stays under 100 MB; 002 sets the per-dataset budget.

## Files

| Path | Change |
|---|---|
| `web/src/lib/demo-client.js` | new: `replayClient`, `liveClient`, `runItem` |
| `web/src/lib/mode.js` | new: `liveAvailable`, the mode copy, and the run estimate for the confirmation |
| `web/src/components/DataBanner.jsx` | new: the recorded-answers banner |
| `scripts/record-demo.js` | new |
| `src/routes/demos.js` | new: `POST /api/demos/:id/run` for real mode |
| `src/app.js` | mount the demos route, inject `window.__JEV_LIVE__` |
| `vercel.json` | new |
| `.gitignore` | un-ignore demo data and fixtures |
| `README.md` | the two modes, the deploy steps, how to run live |

## Acceptance

- [ ] `npm run build`, then serve `web/dist` with the network blocked: every demo plays through with answers, charts and reports.
- [ ] No request leaves the page in demo mode; the network panel shows only same-origin static files.
- [ ] `node scripts/record-demo.js ledger-integrity` writes a fixture file, and re-running without `--force` changes nothing.
- [ ] With a key set and the Express server running, a demo still replays recordings until "Run live" is switched on and
      confirmed; after that it matches the recorded shape.
- [ ] Serving `web/dist` statically and playing a demo makes no request to `/api/*`.
- [ ] `git status` is clean after a build; datasets and fixtures are tracked.
- [ ] The banner names the model version and capture date from the fixture file, not a hard-coded string.

## Video beats

- The About page: two modes, one sentence each.
- The network panel with nothing in it while a demo runs.
- `record-demo.js` running once, printing tokens and cost, and the resulting diff in git.

## Notes and risks

- Recorded answers age. The banner shows the capture date, and re-recording a block is a normal chore.
- Keep fixtures small: one answer set per item, no echo of the state.

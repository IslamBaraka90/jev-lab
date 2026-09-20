# Leftovers

Open items parked deliberately. Each one says what is wrong, what it would cost to fix, and what the
fix actually is. Nothing here stops the site from being shown.

Last reviewed after the UI/UX review of September 2026 ([docs/ui-ux-review](docs/ui-ux-review/README.md))
and the changes that followed it: the result-first demo page, presenter mode, the per-demo grades,
verdicts and baselines, the scoreboard and the run history.

---

## 1. Datasets that need a paid re-record

The review's most important finding is about data, not design: **on most demos a rule of a few lines
over fields already in the state matches or beats the model**, and on several the label can be read
straight off one field. Every such demo now says so on its page — a caveat banner, a baseline bar
beside the model, and a finding where the rule wins — so nothing is hidden. Fixing it means changing a
generator and recording again, which is the only paid step, so each one is listed with its cost.

The per-demo detail, with the field that leaks and the rule that wins, is in the nine domain files under
`docs/ui-ux-review/`. The ones worth doing first:

| Demo | What is wrong | Fix | Requests |
|---|---|---|---:|
| 101 ledger-integrity | No VAT receivable account, so 68 of 75 false alarms are one correct objection | Add the account, regenerate seed 1101 | 502 |
| 102 bank-reconciliation | Statement references end in `-FEE`, `-DUP`, `-FX`…, which name the label | Neutral references | 60 |
| 103 expense-posting | Three charges in four are a vendor lookup | Cap `priorPostings` at one | 400 |
| 116 delivery-exceptions | The scan reason code maps one-to-one to the fault, and `linkedToDemo` is in the state | Drop both from the state | 250 |
| 123 aml-alert-triage | `relationshipNote` is one of twelve fixed strings that name the label | Free-text notes | 300 |
| 124 sanctions-name-match | The identifier fragment spells the answer | Realistic identifiers | 200 |
| 141, 145 | `adviser_note` and `measurementNote` give the class away | Remove or neutralise | 24 + 240 |
| 172 event-clustering | True cluster members share the exact title string | Paraphrased titles, real near-misses | 380 |
| 184 overfit-review | `untouched_validation_as_stated` is present in every honest item and no flawed one | Drop the field | 140 |
| 183 regime-classification | Range break is three quarters of the book | Balance the families | 312 |
| 181 golden-cross-review | 71 crossovers, because the cached history is six years | Fetch ten years | ~240 |

Also small enough to be anecdotes rather than tests: peer-valuation (4 items), fundamental-read and
dividend-safety (16), portfolio-compare (18), portfolio-health (24). Their pages now show counts
rather than percentages. Either grow them or present them as case studies.

When re-recording, hold out a second seed per demo so a question tuned on one dataset is scored on
another, and add `gates` to the demo so `npm run check` defends the result afterwards.

## 2. Questions worth rewording at the next recording

Rewording a question changes its hash, so it starts a new line in the run history — do these together
with the dataset fixes above, not separately.

- **Yes/no questions with no stated bar answer yes to everything.** Demo 165 showed it first; the review
  found the same in 143 (`needs_pm_sign_off` yes on 200 of 200), 156 (`qualified` 240 of 240), 174
  (contagion yes on 278 of 288 links), 184 (`worth_forward_testing` 140 of 140) and 161. Put the
  threshold in the criteria.
- **Questions that echo a field**: 152 `setup_type` (300 of 300), 182 `best_slot` (323 of 323).
- **Options never chosen**: 133 `REPORT_INTERNALLY`, 141 `HOLD`, 152 `NEWS_DAY`, 153 two of the fixes,
  114 accept-loss.
- **Rubric scores sit in the middle of the scale** almost everywhere; several reports now rank by the
  score instead of cutting it, which is where it is strong.

## 3. Shared runtime, not yet built

- **Trade overlays on the candle stage.** 151, 153 and 156 draw the bars but not the entry, stop,
  target, fill or exit the demo is about. `CandleChart` already supports the overlay; the datasets do
  not carry `chart.trade`. A generator change with no re-record, if the state is left alone.
- **The queue cannot re-order itself on screen.** Demo 121's story is one queue in two orders; the
  report and the presenter carry it, the stage does not. Still the most video-worthy runtime change.
- **Documents side by side.** Nested records now render as groups and tables instead of JSON, which
  fixed 102, 104 and 114 to a good standard. Aligned panes with the differing fields highlighted would
  be better still, and would be added once in `web/src/demo/views/`.
- **A real network and cluster view** for 174 and 172: their reports are still long tables.
- **Comparing two runs item by item.** The history keeps every run's numbers and `benchmarks/runs/`
  keeps the answers of replaced runs, but nothing yet shows the flip list — the items whose answer
  changed between two model versions, with both answer bars side by side.
- **Stability runs.** The about page says answers can vary between runs and nothing measures it.
  Recording a demo *k* times and reporting per-item agreement is the missing evidence.
- **The lab on the static site.** `/lab` needs the local server, so on the deployed site it explains
  that and stops. Shipping one recorded suite run as static JSON would let it replay like the demos.
- **The overfit gallery** is still 140 cards on one page, each sparkline scaled to its own range.
- **A display typeface and a tabular monospace** would lift the whole site for the cost of two files.

## 4. Waiting on a value or an action

- **Nothing has been deployed yet.** `vercel.json` is written; one throwaway deploy should confirm the
  build runs from a clean checkout, no `/api/*` route exists in the output, and demo pages replay with
  the network tab empty.
- **`VITE_REPO_REF` defaults to `main`**, so "open this file" links drift as the code moves. Pin it to
  a commit for the video build.
- **Live mode has never been exercised by anyone else.** Decide before the site goes public whether it
  ships at all.
- **The side worktrees and demo branches** (`jev_test-demo102` and the rest) are merged into `main` and
  can be removed. `codex/even-demos` differs from `main` by one deleted line in `demo.css`; its demos
  are all here.

## Closed since the last version of this file

- The report is on the page from the first paint; it no longer waits for Play all.
- The confusion matrix, the homepage encoding, the undefined design tokens and the card padding.
- Fourteen report sections that were computed and never drawn.
- Per-item ground truth on the page, through each demo's `grade`.
- Presenter mode, as five beats per demo, and `scripts/shot-list.js`.
- The coverage curve's text alternative now includes its rate series.
- The repository URL is real.
- Report bugs found by the review and fixed in code: the cross-currency sum in 104, the look-ahead in
  183's gate, the inflow-as-balance figure in 125, arithmetic-identity checks in 102 and 104, and a few
  dozen counts, tones and notes that contradicted their own data. The domain files list them.

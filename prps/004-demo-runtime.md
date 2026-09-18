# 004 · Demo runtime

**Depends on:** 001, 002, 003 · **Blocks:** every demo

## Why

Fifty demos, one shape. A demo is a dataset of items, a state builder, a set of typed questions, and an evaluation. Everything else — the page, the replay, the answer cards, the report, the code panel — is shared. A new demo should be one folder and about 150 lines, or the volume work will never finish.

## The demo contract

`demos/<slug>/demo.js` default-exports one object:

```js
export default {
  id: 'ledger-integrity',
  title: 'Ledger integrity review',
  domain: 'books',
  value: 'Find the journal lines that do not reconcile, and why.',
  tags: ['reconciliation', 'accounting', 'audit'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'ledger',                       // which item view to render
  data: () => import('./data.json'),    // lazy, never imported by the catalog
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/<slug>.labels.json'), // optional, report only

  itemLabel: (item) => `${item.id} · ${item.account}`,
  buildState: (item, context) => ({ /* exactly what the model receives */ }),
  questions: { /* the typed questions, built with the SDK helpers */ },
  evaluate: (answers, item, context) => ({ /* per-item derived values and flags */ }),
  report: (results, context) => ({ /* metrics, checks and chart data */ }),
  explain: { state: 'demos/ledger-integrity/demo.js#buildState', … },
};
```

Rules:

- `buildState` is pure, and its output is exactly what is sent. No hidden fields, no labels.
- `questions` uses the SDK's `choice`, `score` and `noul` helpers, so real mode and recorded mode can't drift.
- `evaluate` may read ground-truth labels for scoring, and must mark anything label-derived so the UI can badge it as "graded against ground truth".
- Everything is synchronous except the two dynamic imports.

## The page

`/demos/<slug>` renders one layout for every demo:

1. **Header** — title, value line, data chip (002), recorded banner (001), previous/next.
2. **Item rail** — the dataset as a list: id, label, status (pending, answered, flagged), and the outcome once evaluated. Click to select; `j`/`k` to move.
3. **Stage** — the selected item, drawn by its `view`:
   - `table` rows with the item highlighted, `ledger` debit/credit pairs, `queue` alert cards, `candles` the existing chart, `graph` an entity or wallet graph, `curve` an equity or ROC line.
4. **State panel** — the exact JSON sent, collapsible, with a copy button and a byte and token count.
5. **Answers panel** — one card per question, reusing the lab's answer components: probability bars for choices, the rubric track for scores, a meter for yes/no, each with its confidence.
6. **Evaluation strip** — what the demo derived: the flag, the action, the grade, and whether ground truth agreed.
7. **Report** — the whole dataset: metrics, distribution, checks, and the demo's own chart.
8. **How it works** — 005.

## Replay

The four-phase rhythm from the lab, reused: **Reads → Decides → Checks → Scored**.

- `Reads` shows the state panel filling, `Decides` reveals the answer cards in question order, `Checks` runs `evaluate` and shows flags landing, `Scored` folds the item into the report.
- Speeds 1× 2× 4× 8×, space to play or pause, arrows to step items, exactly the lab's controls.
- "Play all" walks the dataset and builds the report live; the report is also available instantly for people who don't want to watch.
- Reduced motion turns the animation off and jumps to the final state.

## Report widgets

A small shared set, so no demo invents its own:

`KpiRow`, `DistributionBar` (answer mix), `ConfidenceBuckets` (reused from the lab), `CheckList` (the contradictions pattern, generalised), `ConfusionMatrix` (for label-graded demos), `CoverageCurve` (threshold against automation rate), `TopItems` (worst or most interesting items, click to select).

## Thresholds

Every demo that routes items exposes one threshold slider bound to a confidence or probability, with the automation rate and, where labels exist, precision updating live. The chosen default lives in `demo.js` so the video can say why.

## Files

| Path | Change |
|---|---|
| `web/src/pages/DemoPage.jsx` | new |
| `web/src/demo/DemoRuntime.jsx` | new: state machine, selection, replay |
| `web/src/demo/views/{TableView,LedgerView,QueueView,CandlesView,GraphView,CurveView}.jsx` | new |
| `web/src/demo/panels.jsx` | new: StatePanel, AnswersPanel, EvaluationStrip |
| `web/src/demo/widgets.jsx` | new: KpiRow, DistributionBar, CheckList, TopItems, ReportPanel. ConfusionMatrix and CoverageCurve arrive with the first demo that needs them (103) |
| `web/src/hooks/useDemoRun.js` | new: load data and fixtures, run items, cache results |
| `src/services/demo-runner.js` | new: the same run loop for `record-demo.js` and real mode |
| `test/demo-runtime.test.js` | new: contract validation for every registered demo |

## Acceptance

- [ ] A demo folder with `demo.js`, `data.json`, `fixtures.json` and `notes.md` renders a full page with no demo-specific UI code.
- [ ] `test/demo-runtime.test.js` fails if a demo's `buildState` leaks a label field, if a question type is unknown, or if a fixture is missing for an item.
- [ ] The same `buildState` and `questions` drive recorded playback, live mode and `record-demo.js`.
- [ ] Replay works at all four speeds, and reduced motion skips to the end.
- [ ] Selecting an item updates the URL (`?item=L-0007`) so any item is linkable.
- [ ] The report renders from `report()` alone, with no access to the network.

## Video beats

- One demo page, top to bottom, naming each panel once. Every later demo then needs no explanation.
- The same four-phase replay viewers already know from the lab.
- Dragging the threshold slider and watching the automation rate move.

## Notes and risks

- Keep views dumb. If a demo needs something exotic, add a view, don't special-case the page.
- The item rail must stay fast at 500 items: virtualise if a dataset goes past 200.

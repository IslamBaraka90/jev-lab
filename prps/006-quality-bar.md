# 006 · Quality bar

**Depends on:** 001–005 · **Blocks:** shipping the site

## Why

Fifty demos, each with a dataset and a fixture file, is the fastest way to build a slow site. This PRP sets the budgets and the checks that keep it fast, reachable and honest, and it is re-checked at the end of every block.

## Performance budgets

| Thing | Budget |
|---|---|
| Initial JavaScript, gzipped | 220 KB |
| Initial CSS, gzipped | 40 KB |
| Catalog page, fully interactive on a mid-range laptop | under 1.5 s |
| A demo's dataset plus fixtures | 800 KB, fetched only when that demo opens |
| Largest single dataset | 500 KB (002) |
| Total deployed output | 60 MB |

How they are met:

- Route-level code splitting: home, catalog, demo page, lab, about.
- Demo data and fixtures load through the dynamic imports in the demo contract, so the catalog never touches them.
- Views are split too: the candle chart and the graph view are only loaded by demos that declare them.
- The lab keeps its current bundle and loads on its own route.
- `scripts/check-budgets.js` reads the build output and fails over budget.

## Accessibility

- Every interactive element is reachable and visibly focused; the keyboard map in 003 works without a mouse.
- Charts carry a text alternative: an `aria-label` summarising the series, and a table view behind a toggle for the report charts.
- Colour is never the only carrier of meaning: flags have icons and text, answer bars have numbers.
- Type floor 14 px, touch targets 44 px, contrast at least 4.5:1 for text in both themes.
- Motion respects `prefers-reduced-motion`; replay jumps to the final state.

## Tests

- **Contract tests** (from 004) run over all 50 demos: state builder purity, no label leakage, question types, fixture coverage, unique item ids, envelope validity.
- **Generator tests:** each seeded generator is deterministic and plants the labelled issues it claims.
- **Evaluation tests:** for label-graded demos, the report's counts match the labels on a frozen sample.
- **Route tests:** every registered demo has a reachable route, and every old lab URL redirects.
- **Build test:** the code index resolves every `explain` key.

`npm test` runs all of it with `node --test`; no new test framework.

## Content checks

- Every demo page names its data class and, if synthetic, its seed.
- No demo claims accuracy it can't show; if there are no labels, the report says "no ground truth in this dataset" instead of inventing a score.
- Compliance-sensitive demos (sanctions, Sharia, AML) carry the one-line caveat their PRP specifies.
- No real personal data, anywhere, including in screenshots committed to the repo.

## Definition of done for a demo block

1. Every demo in the block plays in demo mode with the network off.
2. Budgets still pass.
3. Contract and evaluation tests pass.
4. The block's domain page reads well top to bottom.
5. Video beats recorded, or explicitly deferred in the PRP.

## Files

| Path | Change |
|---|---|
| `scripts/check-budgets.js` | new |
| `test/contracts.test.js` | new: the all-demos contract suite |
| `test/generators.test.js` | new |
| `test/routes.test.js` | new |
| `package.json` | `test`, `check` scripts; `check` runs budgets and tests |
| `README.md` | the quality bar, in three lines |

## Acceptance

- [ ] `npm run check` fails when a bundle goes over budget or a contract test breaks.
- [ ] Opening the catalog transfers no dataset or fixture file.
- [ ] Keyboard-only pass through home, catalog, a demo and the lab, with no trap.
- [ ] Reduced motion produces a usable page with no animation.
- [ ] Lighthouse on the deployed catalog: performance 90+, accessibility 95+.

## Video beats

- The network panel on the catalog: no data files.
- Opening a demo and watching only that demo's data arrive.

## Notes and risks

- If a dataset can't fit the budget, sample it down and say so on the page; don't ship a 4 MB JSON file for one chart.

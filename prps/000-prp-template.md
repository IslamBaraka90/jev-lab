# NNN · Title

**Domain:** … · **Data:** cached-real | synthetic | both · **View:** table | candles | graph | queue | ledger | curve · **Depends on:** 001, 002, 003, 004

## Value

One sentence for the catalog card: what a viewer gets out of this demo, in their words, not the model's.

## Demo flow

What happens on screen, in order, as a person uses it.

1. …
2. …
3. …

## Data

- **Source and class:** where it comes from, and whether it is cached-real or synthetic.
- **File:** `demos/<slug>/data.json` — shape and size.
- **Generator:** `scripts/generate/<slug>.js`, seed N (synthetic only).
- **Planted ground truth:** what the generator knows is wrong, stored in `data/synthetic/<slug>.labels.json`, used for the report and never sent in the state.

## State sent to the model

The JSON the model receives for one item. List the fields and say what is deliberately left out.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| … | choice | … |
| … | score 0–6 | … |
| … | yes/no | – |

## Report

What the demo computes from the answers, and which widgets show it.

## Files

| Path | Change |
|---|---|
| `demos/<slug>/demo.js` | new |
| `demos/<slug>/data.json` | new, generated |
| `demos/<slug>/fixtures.json` | new, recorded |
| `demos/<slug>/notes.md` | new |
| `demos/index.js` | register the demo |

## Acceptance

- [ ] The demo runs end to end in demo mode with the network disabled.
- [ ] Every item in the dataset has a recorded answer in `fixtures.json`.
- [ ] The report matches the ground-truth labels where the demo claims accuracy.
- [ ] The page names the data class on screen (cached-real or synthetic).
- [ ] The "How it works" panel points at the real files and line ranges.
- [ ] Tests cover the state builder and the evaluation.

## Video beats

- …
- …

## Notes and risks

Anything a reviewer should know: realism limits, compliance wording, or a decision left open.

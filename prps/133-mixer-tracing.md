# 133 · Tracing and mixer exposure

**Domain:** Crypto · **Data:** synthetic (seed 1133) · **View:** graph · **Items:** 90 traces · **Questions:** 5

## Value

Follow funds back through hops and say how close the money is to something you can't accept.

## Demo flow

1. A trace opens as a path: the wallet, its funding sources, and theirs, up to five hops.
2. The model reads the path summary and judges taint, distance and what to do.
3. Traces sort by exposure, with the path drawn for the selected one.
4. The report compares judgements with the planted paths and shows where distance stopped mattering.

## Data

- `demos/mixer-tracing/data.json` — 90 traces built on a fictional graph of 600 wallets. Each trace: the subject wallet, up to 5 hops of funding paths with amounts and timestamps, and the labelled entities encountered (`MIXER_A`, `SANCTIONED_ENTITY_B`, exchanges, bridges).
- Planted: 12 traces one hop from a mixer, 14 two to three hops, 9 with a legitimate exchange between the subject and the taint (which usually breaks the chain), and 8 where amounts don't reconcile with the claimed path.
- Labels: `{ traceId, tainted: true|false, hops, breaker }`.

## State

The path with amounts, timing and entity labels at each hop, the share of the subject's funding each path represents, and the rule set the desk uses (how many hops it cares about, whether an exchange breaks the chain). No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `tainted_funds` | yes/no | – |
| `hops_to_source` | choice | `ONE` · `TWO` · `THREE` · `FOUR_PLUS` · `NONE_FOUND` |
| `chain_broken_by_exchange` | yes/no | – |
| `exposure` | score 0–6 | None · Negligible · Low · Moderate · High · Very high · Direct |
| `action` | choice | `CLEAR` · `REPORT_INTERNALLY` · `FREEZE_PENDING_REVIEW` |

## Report

Taint accuracy, hop accuracy, how often the exchange-breaker rule was applied correctly, exposure distribution, and the traces where amounts didn't reconcile — the subtlest planted case.

## Files

Standard demo folder plus `scripts/generate/mixer-tracing.js`; reuses the graph view from 125.

## Acceptance

Template list, plus:

- [ ] The graph highlights the path from the subject to the labelled entity, hop by hop.
- [ ] The desk's rule set is in the state, so the model's answer can be judged against a stated policy.
- [ ] Amount-reconciliation cases are reported separately.

## Video beats

- A three-hop path with the mixer at the end, and the exposure score landing at 4 of 6.
- The exchange in the middle that breaks the chain, and the score dropping.
- A path where the amounts don't add up.

## Notes

Keep hop counts small enough to draw. Five hops is the limit that stays readable at 1080p.

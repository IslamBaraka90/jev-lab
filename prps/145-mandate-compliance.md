# 145 · Mandate compliance

**Domain:** Portfolio · **Data:** synthetic (seed 1145) · **View:** table (rule checklist) · **Items:** 240 checks · **Questions:** 4

## Value

Run a portfolio against its investment policy and list every breach, with how it happened.

## Demo flow

1. A policy opens as rules in plain words, with the portfolio beside it.
2. Each item is one rule against one portfolio; the model decides breach or not, and why.
3. Breaches collect into a report a compliance officer could read.
4. The report grades the calls against the planted breaches and shows the near-misses.

## Data

- `demos/mandate-compliance/data.json` — 12 portfolios × 20 policy rules. Rules cover single-name caps, sector caps, credit quality floors, liquidity minimums, leverage, prohibited instruments, currency limits and cash bands.
- Planted: 26 breaches of six kinds, plus 30 near-misses inside tolerance and 8 that breach only if you read the rule loosely — the cases that make compliance hard.
- Labels: `{ checkId, breach: true|false, kind }`.

## State

The rule in its own words with any tolerance, the portfolio's relevant numbers, the measurement date, and the policy's own definitions (what counts as cash, how look-through works). No label, no precomputed pass or fail.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `breach` | yes/no | – |
| `breach_kind` | choice | `SINGLE_NAME` · `SECTOR` · `CREDIT_QUALITY` · `LIQUIDITY` · `LEVERAGE` · `PROHIBITED` · `NONE` |
| `severity` | score 0–6 | None · Technical · Minor · Notable · Material · Serious · Critical |
| `interpretation_dependent` | yes/no | Does the answer depend on how the rule is read? |

## Report

Breach accuracy, false positives on the near-misses, the eight interpretation-dependent checks and whether the model flagged them as such, severity mix, and a per-portfolio compliance sheet.

## Files

Standard demo folder plus `scripts/generate/mandate-compliance.js`.

## Acceptance

Template list, plus:

- [ ] Tolerances are in the state, and near-misses inside tolerance must not be breaches.
- [ ] The interpretation-dependent checks are graded on whether the model raised the flag, not on the yes/no.
- [ ] The compliance sheet can be read top to bottom without opening any other panel.

## Video beats

- A 10.4% position against a 10% cap with a 0.5% tolerance: not a breach, and the model says why.
- The look-through rule that only breaches if you count fund holdings.
- The compliance sheet for one portfolio, as a finished artefact.

## Notes

Rules are illustrative, written for the demo. The page says they are not any real fund's policy.

# 102 · Bank reconciliation

**Domain:** Books · **Data:** synthetic (seed 1102) · **View:** ledger (two columns) · **Items:** 60 open lines · **Questions:** 4

## Value

Match the bank statement to the books, and name the reason for everything left over.

## Demo flow

1. Two columns: statement lines on the left, ledger entries on the right, matched pairs already collapsed.
2. Each open statement line comes with up to five candidate entries, ranked by amount and date closeness.
3. The model picks a candidate or none, grades the match, and names the break reason.
4. The report shows how much of the reconciliation cleared itself, and what a human still has to open.

## Data

- `demos/bank-reconciliation/data.json` — one account, one month: 240 statement lines, 232 ledger entries, 180 obvious matches pre-cleared by an amount-and-date rule, 60 left open.
- Generator plants: 12 timing differences, 9 bank fees never booked, 7 FX differences on a second currency, 8 partial payments, 6 duplicates, 5 entries missing entirely, and 13 that simply match with a messy reference.
- Candidate lists are built by the generator with a deterministic rule and stored on each item, so the model's job is judgement, not search.
- Labels: `{ statementLineId, matchesEntryId | null, breakReason }`.

## State

The statement line, its five candidates with their full fields, the account's opening and closing balances, the period, and the bank's reference format. Nothing about which candidate the generator intended.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `best_match` | choice | `CANDIDATE_1` … `CANDIDATE_5` · `NONE` |
| `match_quality` | score 0–6 | No match · Weak · Possible · Likely · Strong · Near certain · Exact |
| `break_reason` | choice | `TIMING` · `BANK_FEE` · `FX_DIFFERENCE` · `PARTIAL_PAYMENT` · `DUPLICATE` · `MISSING_IN_BOOKS` · `MATCHED` |
| `auto_clear` | yes/no | – |

## Report

Auto-clear rate at the chosen quality threshold, precision against labels, break reasons as a distribution, remaining difference in money terms, and a coverage curve from quality threshold to human workload.

## Files

Standard demo folder plus `scripts/generate/bank-reconciliation.js`.

## Acceptance

Template list, plus:

- [ ] Candidate generation is deterministic and documented in `notes.md`.
- [ ] The report's remaining difference reconciles to the statement's closing balance.
- [ ] Precision is graded only on items with a label.

## Video beats

- A partial payment: one statement line, two ledger entries, the model picking one and calling it partial.
- The FX line where the amount is close but not equal.
- The coverage curve, with the chosen operating point.

## Notes

Keep the two-column view readable at 1080p; it is the shot that sells this demo.

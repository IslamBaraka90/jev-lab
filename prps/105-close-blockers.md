# 105 · Close blockers

**Domain:** Books · **Data:** synthetic (seed 1105) · **View:** queue · **Items:** 60 accounts · **Questions:** 4

## Value

Turn a messy trial balance into a ranked list of what is actually stopping the month from closing, and who owns each item.

## Demo flow

1. The trial balance opens as a queue: account, movement, prior-month comparison, and the preparer's note.
2. The model reads each account and decides whether it blocks the close, why, and who should fix it.
3. Blockers group by owner into four lanes.
4. The report estimates the close-day impact and shows what would be left if only the top blockers were fixed.

## Data

- `demos/close-blockers/data.json` — 60 accounts for one month: balance, prior balance, movement, expected movement range, reconciliation status, open items count, and a free-text preparer note of the kind people actually write.
- Planted: 4 unreconciled balances, 3 missing accruals, 2 intercompany mismatches, 2 unrevalued FX balances, 2 unsupported manual journals, and 6 accounts that look alarming but are fine (a genuine one-off bonus accrual, a seasonal swing, a prepayment release).
- Labels: `{ accountId, account, blocker, expectedOwner, kind }`. `accountId` is what the shared generator test follows back to the item, and `kind` (`blocker` / `decoy` / `clean`) is what lets the report grade the six decoys as their own group.

## State

The account with its movements and note, the comparison window and the close calendar (day of close, deadline). No label.

The teams and their scopes live in the `owner` question's own options, **not** in the state: they are the answer set, and an account that carried its owning team would turn the question into copying a field. Three of the planted blockers are the ones worth grading, where the blocker decides the owner rather than the account does.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `blocker_type` | choice | `UNRECONCILED` · `MISSING_ACCRUAL` · `INTERCOMPANY` · `FX_REVALUATION` · `UNSUPPORTED_JOURNAL` · `NONE` |
| `blocks_close` | yes/no | – |
| `severity` | score 0–6 | None · Cosmetic · Minor · Notable · Material · Serious · Critical |
| `owner` | choice | `AP` · `AR` · `TREASURY` · `TAX` · `CONTROLLER` |

## Report

Blockers by type and owner, severity distribution, agreement with the labelled owner, the six decoys and whether they were left alone, and a "close readiness" figure that only counts accounts the model cleared.

## Files

Standard demo folder plus `scripts/generate/close-blockers.js`.

## Acceptance

Template list, plus:

- [ ] Owner assignment is graded against the labels and shown as its own accuracy number.
- [ ] The six decoy accounts are listed in `notes.md` with why they look alarming.
- [ ] Close readiness never counts an account with `blocks_close` above the threshold.
- [ ] An account named `NONE` and held back anyway does not count as a blocker found.

## Video beats

- The seasonal swing that is not a blocker, next to the missing accrual that is.
- The four owner lanes filling up.
- Close readiness moving from 71% to 96% as the top five blockers are ticked off.

## Notes

The preparer notes carry most of the signal. Write them like a tired accountant, not like documentation.

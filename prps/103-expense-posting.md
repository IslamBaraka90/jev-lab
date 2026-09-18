# 103 · Expense posting

**Domain:** Books · **Data:** synthetic (seed 1103) · **View:** table · **Items:** 400 expenses · **Questions:** 4

## Value

Post every uncategorised expense to the right account, and automate only the share you can defend.

## Demo flow

1. A table of uncategorised card and bank expenses: vendor, memo, amount, date, card mask.
2. Play posts them one by one, each with a distribution across your chart of accounts.
3. A threshold slider splits the table into auto-posted and review.
4. The report shows accuracy, the confusion matrix, and what automation costs in errors at each threshold.

## Data

- `demos/expense-posting/data.json` — 400 expenses across 12 accounts: software subscriptions, travel, meals and entertainment, office supplies, marketing, professional fees, bank charges, utilities, hardware, training, shipping, fuel.
- Vendor names come from the fixed word list; memos vary from clean ("AWS monthly") to useless ("card payment 2213").
- Planted difficulty: 30 vendors that legitimately span two accounts (a hotel that is travel or client entertainment), 20 memo-free lines, 15 refunds as negative amounts.
- Labels: the intended account per expense.

## State

The expense, the chart of accounts with one-line definitions of each account, the company's country and currency, and the last three postings for the same vendor when they exist. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `account` | choice | the 12 accounts in the chart |
| `receipt_required` | yes/no | – |
| `vat_treatment` | choice | `STANDARD` · `ZERO_RATED` · `EXEMPT` · `OUT_OF_SCOPE` |
| `posting_clarity` | score 0–6 | Unreadable · Very unclear · Unclear · Workable · Clear · Very clear · Unambiguous |

## Report

Accuracy against labels overall and per account, a confusion matrix, the coverage curve (automation rate against accuracy), and the vendors that cause the most confusion.

## Files

Standard demo folder plus `scripts/generate/expense-posting.js`.

## Acceptance

Template list, plus:

- [ ] Accuracy and coverage are recomputed live as the threshold moves.
- [ ] The confusion matrix is clickable: a cell filters the table to those items.
- [ ] Vendor history in the state is limited to three prior postings, and that limit is visible in `notes.md`.

## Video beats

- The hotel expense that could be travel or entertainment, with a split distribution.
- Dragging the threshold from 0.5 to 0.8 and watching automation drop and accuracy rise.
- A memo-free line where the model still gets it right from the vendor.

## Notes

This is the cleanest demo for the calibration argument; keep it early in the video order.

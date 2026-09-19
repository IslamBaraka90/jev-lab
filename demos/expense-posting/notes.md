# Expense posting

Four hundred card and bank charges waiting to be posted to a twelve-account chart. The interesting
question is not "can it categorise" but "how much of this can go through without a person, and what
does that cost in wrong postings".

## The data

`scripts/generate/expense-posting.js`, seed 1103: one quarter of spending for an invented company,
55 vendors, amounts and memos shaped to the account they belong to. Everything is generated; no real
vendor, person or card number appears.

The intended account for each charge is in `data/synthetic/expense-posting.labels.json`, outside this
folder, together with how hard the charge is meant to be:

| Kind | Count | What makes it hard |
|---|---|---|
| Vendor and memo agree | 335 | Nothing. This is the easy majority, and it should be nearly perfect |
| Vendor sells into two accounts | 30 | A hotel is travel or hospitality, a print shop is marketing or supplies, a bookshop is training or supplies, a depot is shipping or supplies. Only the memo decides |
| No description at all | 20 | Just a vendor, an amount and a date |
| Refunds | 15 | A negative amount, which belongs back in the account the original charge used |

## What the model sees, and what it does not

The charge, the company's rules (currency, VAT rate, the receipt threshold, the capitalisation
threshold), the chart of accounts with a one-line definition of each account, and **up to three earlier
postings from the same vendor**. That history is what a bookkeeping system genuinely has, and it is
capped at three so the demo cannot win by lookup alone. 55 charges are the first from their vendor and
have no history at all.

There is deliberately **no vendor-to-account map** in the state. An earlier draft of this generator put
one in the dataset context, which handed over the answer for 335 of the 400 charges and would have made
the accuracy number meaningless. If you add a field to this demo, ask first whether it decides the
question by itself.

## How it is graded

Accuracy against the intended account, and then the same thing split by difficulty, because an average
over 400 charges hides everything: the ambiguous thirty and the memo-free twenty are the only rows that
say anything about judgement.

The coverage curve is the practical output. It plots, for each confidence threshold, how many charges
would post automatically and how many of those were right, with the accuracy of the automatic share as
a dashed line. That is the number to take to whoever signs off the automation: not "it is 94% accurate"
but "it posts 61% of the file automatically and is right 99% of the time when it does".

The findings line names the single pair of accounts that gets swapped most often. One repeated swap is
usually a question about where the boundary between two accounts sits, not a series of separate slips.

## Status

Built and tested; the answers are not recorded yet. `npm run record expense-posting` captures them once
and commits them, and until then the page shows the data, the state, the report shape and the code, and
says so.

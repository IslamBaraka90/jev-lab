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

## What the recorded run found

400 answers, model `jev-1.13.0`, 555K input and 102K output tokens, about seven minutes.

- **399 of 400 went to the intended account.** All 335 easy charges, all 20 memo-free ones, all 15
  refunds, and 29 of the 30 ambiguous ones.
- **The single mistake is the least confident posting in the file.** E-0334, "Packing tape and boxes"
  from a depot that also does couriers, went to shipping instead of office supplies, at 54% confidence
  against an average of 99%. At the 70% threshold it is the one charge held back, so 397 post
  automatically with nothing wrong among them.
- **Clarity tracked the data.** The clarity score averaged 5.55 of 6 across the file and 3.80 on the
  twenty charges with no description, which is the right direction without being dramatic.

## The honest caveat: this file is too easy

A 99.8% result says more about the dataset than about the model. Three charges in four come from a
vendor that only ever posts to one account, and the state shows up to three earlier postings from that
vendor, so those are a lookup rather than a judgement. The rows that actually asked something are the
thirty ambiguous ones, and there the score was 29 of 30.

If this demo is meant to show a real accuracy-against-automation trade-off, the lever is the vendor
history: cap it at one prior posting, or drop it for the ambiguous vendors, and re-record. That costs
another full run, so it is left as it is and this note says why the headline is so high.

What the run does show well is **calibration**: one wrong answer, and it is the one the model was
least sure about.

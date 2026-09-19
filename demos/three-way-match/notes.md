# Three-way match

One hundred and fifty accounts-payable packets from forty invented suppliers. Each packet carries the
purchase order, the goods receipt and the supplier invoice that should agree before the payment run.
The decision is not merely whether the documents differ, but whether the difference breaches a stated
control: 2% on unit price and one unit on quantity.

## What was planted

The generator uses seed 1104 and keeps its answers in
`data/synthetic/three-way-match.labels.json`, outside the demo folder.

| Group | Count | What the documents show |
|---|---:|---|
| Unit price above tolerance | 9 | The invoice price is more than 2% above the purchase order |
| Quantity over-billed | 7 | The invoice quantity exceeds a fully received order by more than one unit |
| Tax error | 5 | Tax does not equal the stated 5% company rate |
| Currency mismatch | 4 | The invoice and purchase order name different currencies |
| Duplicate invoice | 3 | An earlier supplier packet has the same invoice and receipt |
| Partial delivery billed in full | 6 | The receipt is short, but the invoice bills the complete order |
| Difference inside tolerance | 8 | A price rise of at most 2%, or one extra unit, must be released |
| Clean | 108 | The three documents agree |

The eight allowed differences are deliberate negative controls. A matching system that catches every
problem by holding every invoice has failed: a false hold interrupts a supplier payment, consumes an
accounts-payable review and can be as costly operationally as a missed mismatch.

## What the model sees

The state contains all three documents, the supplier's payment terms, the price and quantity
tolerances, the tax rate, and at most two earlier packets from the same supplier. It contains no
precomputed variance, risk amount, planted kind or answer.

That history is essential for the three duplicates. The current documents alone are internally
consistent; only the repeated invoice and goods receipt in an earlier packet reveal that the
obligation has already been presented. Removing supplier history makes those cases unknowable rather
than merely harder.

## How money is graded

Exposure is recalculated from the documents: excess unit price, excess billed quantity, tax error,
the full wrong-currency or duplicate invoice, or the undelivered quantity. For every partial or full
run, money held plus money released must equal the planted file's total exposure. The report shows
that identity next to the model's own 0–6 overbilling-risk score instead of asking the model to invent
an amount.

## Recorded run

All 150 packets were recorded with model `jev-1.13.0`: 237,585 input tokens and 20,305 output tokens.
Every packet has all four answers in `fixtures.json`; there are no missing, extra or malformed records.

- **26 of 34 planted problems were held (76.5%).** Every price, quantity, currency and partial-delivery
  problem was held. The five tax errors and three duplicate packets were released.
- **The false-hold rate was 6.9%.** All 108 exact packets were released, but all eight allowed
  differences were held. Four were called price problems and four quantity problems even though they
  sat at or below the stated 2% and one-unit tolerances.
- **The money identity closes exactly.** $104,820.51 of planted exposure was held and $32,994.77 was
  released, adding to the file's $137,815.28 total with a zero difference.
- **The repeated mistake is specific.** Five of the fifteen mismatch-name errors were tax errors
  called `NONE`. Of the three duplicates, one was named `DUPLICATE` but still released and two were
  called `NONE`.

This is not a clean success story, and the fixtures preserve that. The run caught the obvious
commercial mismatches but did not reliably apply the tolerance boundary, tax arithmetic or supplier
history. The intended 1.4% video beat therefore shows a false hold, not a release. That is the useful
control result: the demo separates detecting a difference from enforcing the policy that says when a
difference is acceptable.

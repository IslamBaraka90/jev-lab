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

Pending. The real Jev answers will be recorded into `fixtures.json`; this section will be replaced
with the measured result after all 150 responses are cached.

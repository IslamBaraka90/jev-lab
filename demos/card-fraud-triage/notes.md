# Card fraud triage

Four hundred alerts as a rules engine left them, ordered by rule score. One analyst has an hour before
the network cut-off, which is about fifty alerts. The demo asks one question: **what would be in that
hour if the queue were ordered by reading each alert instead?**

## The data

`scripts/generate/card-fraud-triage.js`, seed 1121. Every card, cardholder, merchant and transaction is
generated. Each alert carries the rule that fired it, **that rule's historical precision**, the
transaction, the cardholder's profile, and the card's last ten authorisations as statement lines.

Six rules fire the queue, and what each is worth is the state's most useful field:

| Rule | Right about |
|---|---:|
| Amount more than five times the card's average | 9% of its alerts |
| Merchant category with elevated historical loss | 7% |
| Four or more authorisations within an hour | 6% |
| Authorisation between one and five in the morning | 4% |
| First authorisation from an unseen device | 3% |
| Card issued in a different country to the merchant | 2% |

**Sixteen alerts are fraud** in five types, and nine of them fired a quiet rule, so the engine buried
them between ranks 217 and 382 — out of reach of anybody's hour. **Twenty-five are loud alerts on
transactions the card's own history explains**: eight holidays abroad, six weddings, six planned big
purchases, five days when the renewals all landed at once. The rest is the ordinary noise a rules
engine makes.

**The rule ordering is stored in the dataset**, so the comparison is the same on every run, and the
rule's score and rank are deliberately kept out of the state. The model never sees where the engine put
an alert — only the alert.

## What the recorded run found

400 answers on 19 September 2026, model `jev-1.13.0`, 476,084 input and 73,135 output tokens, about
twenty-two minutes.

- **The analyst's hour goes from 6 frauds to 13, without opening a single extra alert.** The rules
  engine puts 6 of the 16 in its first fifty. Ordering the same alerts by what the model made of them
  puts 13 there.
- **The rule queue's whole first-fifty catch arrives in the first 6 alerts.** Nine of the first ten
  alerts in the new ordering are fraud.
- **Every one of the nine buried frauds was found.** ALT-0366, sitting at rank 366 of 400, comes out
  top of the file. Three more arrive from ranks 302, 329 and 335. Nobody was ever going to reach them.
- **Only 7 cards were blocked without fraud**, 1.8% of the queue, and 151 alerts were closed outright.
- **The one fraud that was closed is the one that was genuinely invisible.** ALT-0023 is friendly
  fraud: a £100 gaming purchase at a merchant this card had used four times before. The model said the
  history explains it, scored it 1.2 of 6 and closed it — and on the evidence at authorisation time it
  was right. Friendly fraud is not visible in the transaction, because the cardholder really did make
  it. The other friendly-fraud case was stepped up rather than closed, on the same reading.
- **Five frauds were acted on under the wrong name.** All three account takeovers were called stolen
  card, and both merchant-collusion cases too. Every one of them was still blocked or stepped up, so
  the loss was stopped and the case file has the wrong label on it. Collusion in particular needs
  several merchants' worth of data that a single alert does not carry.
- **The loud false alarms split cleanly.** All eight holidays abroad and all five renewal days were let
  go, and four of the six weddings. Every one of the six planned big purchases was acted on — a
  £900-to-£2,400 electronics buy is the classic stolen-card signature, and the only thing separating it
  from one is a £2 test purchase the day before, which the model did not treat as exculpatory.

## The honest caveats

- **"Does the history explain this?" is answered yes on 250 of 400 alerts** and on only 2 of the 16
  frauds. That is the single most useful field in the answer set, and it is doing most of the work in
  the re-ordering.
- **The model wants to contact the cardholder on 207 alerts**, half the file. As an operating
  instruction that is unusable; as a signal it is nearly uncorrelated with the fraud. If this demo is
  re-recorded, that question should be narrowed to something like "would a message settle it faster
  than a block", which is what it was meant to ask.
- Nothing here re-orders the queue on screen yet. The comparison is in the report, and the top of the
  new ordering is listed with each alert's old rank beside it. Playing both orderings as two runs would
  need the runtime to sort a queue, which it cannot do.

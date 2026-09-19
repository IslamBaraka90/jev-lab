# Merchant onboarding risk

A hundred and forty applications waiting for underwriting at an invented acquirer. The interesting
question is not the decline rate. It is whether the money held back covers what the merchants that go
bad actually cost — underwriting is pricing, not refusing.

## The data

`scripts/generate/merchant-onboarding.js`, seed 1115. Every company, director, website excerpt and
document note is generated. Each application carries what an acquirer really sees: legal and trading
names, how long the company has been registered, directors and their history, expected monthly volume
and average ticket, the delivery promise, bank and trading country, the previous processor, the refund
policy in the merchant's own words, an excerpt from the website, and the four checklist documents with
the checker's note on each.

How the merchants turned out is in `data/synthetic/merchant-onboarding.labels.json`, outside this
folder, and nothing about the future appears in the application:

| Fate | Applications | What it looks like on paper |
|---|---:|---|
| Heavy chargebacks later | 11 | Dropshipping, travel or digital goods, 1 to 7 months old, 25 to 45 day delivery promises, "all sales are final", volume expectations to match |
| Prohibited from the start | 6 | The website sells what the acquirer's list refuses: health claims, betting, adult content, guaranteed returns |
| Documents do not hold up | 5 | A company number that is not on the register, an identity document that expired in 2023, a bank statement in another name, a mail-forwarding address |
| **Looks risky, turned out fine** | **9** | A bonded travel agent of twenty years, a shop selling hardware wallets that holds no funds, a supplements seller that makes no medical claims, a dropshipper who ships from Stoke in five days |
| Ordinary | 109 | Small shops and services with their paperwork in order |

The eleven that went bad each carry what they cost — three months of chargebacks at 4% to 14% of their
expected volume, £414,610 in total — so a reserve can be graded against real money rather than against
a vibe. The category rules in the state are illustrative and say so on the page; they are not any
acquirer's real policy.

## How it is graded

Three lanes, not two, and each one means something different:

- **Approved** is boarding without a person. Approving a merchant that was never acceptable is the
  failure that counts.
- **Sent to an underwriter** is a hold, not a refusal, and it has a cost in time rather than in money.
- **Declined** is the refusal, and refusing a good merchant is reported in monthly volume turned away.

The reserve is converted to money — a percentage of one month's settlement, or about a third of a
month for a rolling hold — and set against what the merchant actually cost. Prohibited matches are
graded exactly: the tier must be `PROHIBITED` and the yes/no must be yes, with no partial credit, and
calling a good merchant prohibited is reported next to it.

## What the recorded run found

140 answers on 19 September 2026, model `jev-1.13.0`, 209,857 input and 25,693 output tokens, about
eight minutes.

- **Not one merchant that should never have been taken was approved.** All six prohibited applications
  were declined outright, with the tier and the yes/no both right, and no good merchant was ever called
  prohibited.
- **Not one good merchant was declined.** All nine that look risky and turned out fine survived, and so
  did all 109 ordinary ones: £0 of monthly volume turned away.
- **The reserves cover 111% of what the bad merchants cost.** All eleven went to an underwriter with a
  rolling hold rather than being approved or refused, holding £460,445 against £414,610 of chargebacks.
  That is the result this demo was built to show: the file never had to be refused, it had to be priced.
- **Five of the eleven were still under-reserved**, by £47,878 in total. A rolling hold is about a third
  of a month, and the worst of these merchants cost more than that, so an acquirer reading this report
  would want a ladder above the rolling hold for the handful with the highest expected volume.
- **Every forged file was spotted, and three were not refused.** Document doubt ran 3.5 to 4.9 on all
  five — the highest scores in the file — but only the two whose company number does not exist on the
  register were declined. The expired identity document and the two mail-forwarding addresses went to a
  person instead. Defensible, and worth watching: the doubt was there and did not reach the decision.
- **The review queue is 37 applications, a quarter of the file**, and 14 of those are the problem ones.
  The other 23 are the price.

## The honest caveat

The model used only two reserves in the whole file: none, or a rolling hold. The five-, ten- and
twenty-percent bands were never chosen. That is either a sensible simplification or a blunt instrument,
depending on who is reading, and it is the reason five merchants came out under-reserved. A version of
this demo that asked for the reserve as a score rather than a band would say more.

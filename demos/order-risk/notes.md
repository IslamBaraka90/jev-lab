# Order risk at checkout

Three hundred orders from one August week at an invented electronics and fashion shop. Every order gets
one of three answers — approve, send to a person, decline — and the demo is built so that both ways of
being wrong are visible at once: fraud that ships, and real customers turned away.

## The data

`scripts/generate/order-risk.js`, seed 1111. Every customer, address, card mask, device and basket is
generated; nothing here belongs to a real shopper or shop. Labels live in
`data/synthetic/order-risk.labels.json`, outside this folder.

**Nine frauds, in four patterns**, each needing more than one field to see:

| Pattern | Orders | What gives it away |
|---|---:|---|
| Card testing | 3 | One device, one night, three different cards, baskets under £60, checkout in under a minute |
| Reshipper | 2 | First order, expensive electronics, a unit number at a logistics park, and three countries that disagree |
| Account takeover | 2 | A four-year customer, but a new device, a new address, details changed hours ago, and a basket unlike any before |
| First-party misuse | 2 | Everything checks out: same address, same device, same country — and two chargebacks already on the account |

**Twelve good orders built to look worse than the fraud does:** three gifts sent abroad by long-standing
customers, three regulars ordering from a phone this shop has never seen, three first orders from
companies kitting out an office (£2,300 to £6,900, paid carefully, PO number in the coupon field), and
three regulars connecting from another country while shipping to their own home.

**The rest is ordinary trade, with noise on purpose.** Fifteen ordinary customers have a prior
chargeback, fifteen ship abroad, fifteen connect from abroad, twenty-three have a second order from the
same device that day, and fifteen changed their account details recently. No single field separates
fraud from the rest; `test/order-risk.test.js` asserts that, because the moment one does, this stops
being a judgement and becomes a filter.

The fraud rate here — nine in three hundred — is far above a real shop's, which is nearer three in a
thousand. That is said on the page as well, in the dataset's own context.

## What the model sees

The basket and its lines, the order's timing and checkout duration, the customer's tenure, order count,
refunds, chargebacks, lifetime value and when the account last changed, the card mask and its issuing
country, the device with how many orders and how many different cards it has seen today, and the
connection, billing and shipping details. Plus the shop's own baselines, so "£1,400" and "ships abroad"
can be judged against what normal looks like here.

There is **no risk score from a rules engine** in the state. The whole point is the judgement.

## What the recorded run found

Three hundred answers on 19 September 2026, model `jev-1.13.0`, 367,878 input and 48,105 output tokens,
about seventeen minutes.

- **All nine frauds were stopped, and all nine patterns were named correctly.** £10,172 of fraudulent
  basket value, none of it approved. The confusion matrix is the diagonal.
- **Not one good order was declined.** Five orders were declined in the whole file, and all five were
  fraud: the three card-testing attempts and the two reshippers. Everything else it was unsure about
  went to a person instead of being refused, which is the right instinct when a decline costs a
  customer.
- **The price is the review queue: 83 orders, about twelve a day.** That is inside the team's stated
  limit of twenty, but 79 of the 83 did not need it — including eleven of the twelve good orders built
  to look bad. The company first orders at £3,977, £6,590 and £6,938 all went to review at risk 3.0 to
  3.3, which is a defensible call on a first order that size, and three gift shipments abroad went the
  same way.
- **Account takeover was caught, but quietly.** Both takeovers were sent to review at risk 1.8 and 2.1 —
  lower than the gift shipments — while the pattern was named exactly right with 78% and 89%
  confidence. The decision and the pattern were right; the risk number did not reflect how bad those
  two orders actually are.
- **Card testing was the reverse.** All three were declined outright, but with 29% to 48% confidence on
  the decision: right answer, honestly unsure. A £9 order is small enough that being wrong about it
  costs nothing, and the model's own numbers say it knew the case was thin.
- **The risk scale separated the groups in the right order but stayed compressed**: 3.38 on fraud, 2.13
  on the look-alikes, 1.34 on ordinary trade, and nothing above 4.8 in the whole file.
- **The practical operating point is risk 3.** Opening only orders at risk 3 or higher means 15 orders
  looked at and 7 of the 9 frauds in front of a person, at 47% precision — against 88 orders and 10%
  precision if everything stopped is opened.

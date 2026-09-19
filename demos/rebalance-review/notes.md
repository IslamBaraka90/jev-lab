# Rebalance review

Two hundred trades a mechanical rebalancer proposed across six institutional books. The rebalancer knows
the target weights and nothing else — not the tax lots, not the other accounts, not the note in the
mandate — so forty-seven of its trades are right on paper and wrong here.

**The prices, volumes and liquidity are real**, cached once and committed; the accounts, trades and
mandates are invented. None of it is advice.

## The data

`scripts/generate/rebalance-review.js`, seed 1143. The desk's five rules are in the state, and every
planted problem breaks exactly one of them:

| Planted | Trades | The rule it breaks |
|---|---:|---|
| Too large for the market | 14 | 17–55% of the instrument's average daily volume, against a fifth allowed |
| Loss repurchased too soon | 11 | A taxable account selling at a loss it bought back inside thirty days |
| Crossing | 9 | Two family trusts sending the same name to the market in opposite directions |
| Too small to pay for itself | 7 | Under $250,000, where the spread costs more than the drift |
| Undoes the mandate | 6 | Trimming the energy overweight the mandate asked for on purpose |
| Ordinary | 153 | Nothing: a weight moving toward its target in a size the market can take |

## What the recorded run found

200 answers, model `jev-1.13.0`, 252,704 input and 43,329 output tokens, about nine minutes.

- **All forty-seven problem trades were stopped, and all forty-seven were named exactly right** — five
  kinds, no confusion between them.
- **All fourteen oversized trades came back with a smaller size**, not just a refusal. That is the
  difference between a review and an order list: the trade still happens, in pieces the market can take.
- **One ordinary trade was fully stopped**, $31m of rebalancing held up. Thirty-one more were resized
  rather than approved, which is the one real cost in this run: the trades still go, smaller than they
  needed to be.
- **The order list came out at $13bn across 165 trades**, with one trade in it that should have been
  rejected.
- Verdicts agree exactly 69% of the time; nearly all the disagreement is resize-where-approve-would-do.

## The honest caveat

This is the easiest file in the set, and the reason is worth naming: every problem here breaks a rule
that is written down in the state in plain words. Nothing has to be inferred from behaviour or history.
A harder version would leave one rule out and see whether the trade still gets caught.

# Post-trade lesson review

Two hundred and twenty closed trades on **real price history** — genuine gaps, wicks and quiet weeks,
cached once and committed. The trades, the plans and the discipline are invented, and invented badly on
purpose in the five ways a trading journal usually goes wrong.

The bars after the exit are not in the state. The review sees what the trader saw.

## The data

`scripts/generate/post-trade-review.js`, seed 1151, over twelve instruments. Thirty trades were taken
with no stop. Twenty-eight had a target further away than the instrument's own daily range could reach
in the planned horizon. Twenty-six were closed by hand with no reason recorded. Twenty-four had the stop
moved after entry, and the move is in the record with its bar and its two prices. Twenty-two were
entered three to six bars after the signal, at the worst price of that stretch. Ninety were run properly.

## What the recorded run found

220 answers, model `jev-1.13.0`, 492,773 input and 37,674 output tokens, about eight minutes.

- **Not one of the ninety well-run trades was given a fault.** That is the result this demo exists to
  test, and the counterpart to it is better still:
- **Discipline scored 4.7 on winners and 4.6 on losers.** A review that quietly grades the outcome
  instead of the plan pulls those numbers apart; these are a tenth of a point from each other. The plan
  was being read, not the result.
- **Three faults were caught every time**: no stop (30 of 30), closed by hand (26 of 26), stop moved
  (24 of 24). Targets out of reach: 24 of 28.
- **Chasing was missed: 4 of 22.** Eighteen chased entries were reviewed as "plan followed".

## Why chasing was missed, and whose fault that is

The desk's rules in the state are four sentences, about the plan being complete, the target being
reachable, the stop being honoured, and closing early needing a reason. **None of them says anything
about entering late.** The record shows the signal date, the signal price and how many bars passed
before the fill — the evidence is all there — but nothing in the policy makes it a fault, and a trade
entered late with a complete plan that was then followed is, by those four rules, a trade that followed
its plan.

That is the same shape as the tracing demo, from the other side: there a rule in the state was ignored,
here a rule that was never written could not be applied. Adding a fifth rule and re-recording would
settle which it is.

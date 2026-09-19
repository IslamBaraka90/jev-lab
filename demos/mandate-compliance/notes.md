# Mandate compliance

Twelve invented portfolios run against twenty policy rules each: two hundred and forty checks, one rule
against one portfolio. The rule arrives in the words a policy is written in, with its tolerance and the
policy's own definitions. **Nothing is precomputed** — no pass, no fail, no flag.

## The data

`scripts/generate/mandate-compliance.js`, seed 1145. Twenty-six checks are breaches, spread over single
name, sector, credit quality, liquidity, leverage and outright prohibitions.

**Thirty sit just inside the tolerance the policy itself allows** — 19.54% against a 20% limit with half
a point of tolerance. A checklist that ignores tolerances reports all thirty and is useless.

**Eight turn on how the rule is read**, and each carries the sentence that makes it a question:

- two separately listed subsidiaries of one parent, inside the limit apart and over it looked through;
- cash including a money-market fund and a bill maturing in six weeks, where the definitions cover the
  first and are silent on the second;
- an overdraft that was a settlement timing difference and cleared the next morning, against a rule
  that says settlement overdrafts are not borrowing;
- a diversified industrial group with a tobacco arm below 5% of revenue, against a prohibition that
  does not mention revenue share.

## What the recorded run found

240 answers, model `jev-1.13.0`, 227,908 input and 33,552 output tokens, about eight minutes.

- **All twenty-six breaches were found, and the rule kind was named right on every one** — six kinds,
  no confusion between them.
- **Not one of the thirty near misses was written up as a breach.** The tolerance in the policy was
  read as part of the rule rather than as decoration, which is the single most useful thing in this run.
- **Six of the eight reading-dependent checks were marked as depending on a reading**, and all eight
  were treated as breaches. That is a defensible house position — flag it and let a person decide — and
  it is exactly why the report counts those eight separately rather than scoring them right or wrong.
- The report that comes out is **34 lines from 240 checks**: the 26 breaches plus the 8 arguable ones.

The two it did not flag as arguable are both R02, the look-through rule, where it simply applied the
look-through and reported the breach. Reasonable, and worth knowing: on that rule it has a view.

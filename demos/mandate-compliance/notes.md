# Mandate compliance

Twelve invented portfolios run against twenty policy rules each: two hundred and forty checks, one rule
against one portfolio. The rule arrives in the words a policy is written in, with its tolerance and the
policy's own definitions. **Nothing is precomputed** — no pass, no fail, no flag.

## The data

`scripts/generate/mandate-compliance.js`, seed 1145. Twenty-six checks are breaches, spread over single
name, sector, credit quality, liquidity, leverage and outright prohibitions.

**Thirty sit just inside the limit** — 19.54% against a 20% limit with half a point of tolerance. All
thirty are on the compliant side of the limit itself, so none of them needs the tolerance to pass; a
cohort over the limit but inside tolerance is still to be built.

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
- **Not one of the thirty near misses was written up as a breach.** Since all thirty are under the
  limit, and each carries a note saying it is inside tolerance, that shows the number was read, not
  that the tolerance was.
- **Six of the eight reading-dependent checks were marked as depending on a reading**, and six of the
  eight were treated as breaches; the two overdraft checks on R14 were called met. The same flag also
  fired on 29 checks the policy settles, so only 6 of its 35 flags are real. The report counts those
  eight separately rather than scoring them right or wrong.
- The report that comes out is **34 lines from 240 checks**: the 26 breaches, 6 of the arguable ones,
  and 2 clear passes on R14 (a borrowing figure of −0.3%) that should not be there.

The two it did not flag as arguable are both R02, the look-through rule, where it simply applied the
look-through and reported the breach. Reasonable, and worth knowing: on that rule it has a view.

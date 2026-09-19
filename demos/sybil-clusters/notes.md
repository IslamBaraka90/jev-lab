# Sybil clusters

A hundred and fifty wallets queueing for an allocation. Sixty-two of them are eight people wearing more
hats than they own. Every address is invented and starts `0xDEMO`; no real allocation or user is
represented.

## The data

`scripts/generate/sybil-clusters.js`, seed 1135. Eight clusters, each built around the one signal its
farmer was careless about: two funded from a single address, two created within minutes of each other,
two running the same actions in the same order, one paying a gas price shared to three decimals, and
one withdrawing everything to the same endpoint.

Against them: **twelve wallets funded from an exchange hot wallet**, which forty-three wallets in the
file share, and **six people who did the same five things in the same order because a guide told them
to**. Both are exactly the shape of a cluster and neither is one.

**The state counts the crowd and never names it.** A wallet is told how many others share its funding
source, its minute, its sequence, its gas price and its endpoint — never which ones. A cluster has to
be inferred from the shape of the population, not read off a list.

## What the recorded run found

150 answers, model `jev-1.13.0`, 151,017 input and 20,673 output tokens, about five minutes.

- **The linking signal was named correctly on all sixty-two farmed wallets** — the right one of five,
  every time. That is the part of this run worth keeping.
- **Nothing was excluded.** Not one wallet, farmed or otherwise. Every allocation was paid: $186,373
  across 150 wallets, $73,000 of it to the eight farmers.
- **Eighty-one of the eighty-eight wallets with no cluster were given a linking signal anyway**, mostly
  "funding source" — because forty-three wallets really do share the exchange hot wallet, and the state
  reports that count without saying it is unremarkable.
- **The likelihood score does not separate the file**: farmed wallets score 3.32 to 4.31, independent
  ones 3.00 to 4.36. Unlike the tracing demo, there is no bar that works here.

## This one is a demo design failure, and it is worth saying plainly

Two things in my own data caused most of that:

1. **The allocation rule in the state argues against itself.** It says "excluding a real user costs
   more than excluding a farmed one saves, so the bar has to be argued for" — and then never says what
   the bar is. Every exclusion came back no, which is a defensible reading of that sentence. A rule
   that expects an action has to state the threshold for taking it.
2. **The population counts are noise without a baseline.** "Forty-three wallets share your funding
   source" means nothing without "and the median wallet shares it with two". The counts need a
   comparison, the way the order-risk demo gives the shop's average order value next to the order.

Both are one-line changes to the state, and both need a re-record. Until then the honest summary of
this demo is: it can tell you *what* links a set of wallets, it cannot yet tell you *which* wallets are
a set, and the report now shows the second number next to the first so the first cannot be quoted
alone.

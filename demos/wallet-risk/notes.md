# Wallet risk scoring

Two hundred and forty wallets offering a deposit. The desk has to grade each one before it takes the
money, and say what drove the grade.

**Every address, entity and flow in this file is invented.** The labelled entities are placeholders —
`MIXER_A`, `SANCTIONED_ENTITY_B`, `EXCHANGE_C` — and the page says so. Nothing here corresponds to a
real service or a real address.

## The data

`scripts/generate/wallet-risk.js`, seed 1131. Each wallet carries its age, transaction count, totals,
its counterparty mix by label with shares, how many hops it sits from the nearest flagged entity, its
last thirty days, and the deposit it is offering.

- **Eighteen high risk**: six taking money straight out of a mixer, six one hop from a listed address,
  six whose flow is more than half betting.
- **Twenty-two medium**: two hops from something flagged, or a sixth of the flow betting.
- **Fourteen that look bad and are not**: five market makers moving eight to ninety million between
  exchanges, five bridge relayers, and four wallets that slept three years and woke up for one large
  transfer. Every one of them is bigger than the high-risk wallets and at least two hops from anything.
- The remaining 186 are ordinary.

## What the recorded run found

240 answers, model `jev-1.13.0`, 320,504 input and 40,852 output tokens, about eleven minutes.

- **No high-risk money was accepted.** All eighteen were refused or held, and **the driver was named
  exactly right on all eighteen** — mixer, sanctions or gambling, each to the right wallet.
- **No ordinary wallet was refused**, and none of the fourteen large decoys either. Size was never
  mistaken for exposure: the market makers and bridge relayers went straight through.
- **$5.6m of deposits accepted across 131 wallets, none of them high risk.**

## The interesting part: the scale is used in its middle

Read against the rubric's own words — four of six is "high" — the band agreement is **15.4%**, which
looks like a failure and is not. The scores are compressed into the middle of the scale: the high-risk
wallets run 3.80 to 5.28, the medium ones 2.65 to 3.42, and the ordinary ones 1.94 to 3.36.

**A single bar at 3.6 separates the file perfectly.** Every high-risk wallet is above it; nothing else
reaches it. The ranking is exactly right and the absolute numbers are not where a reader of the rubric
would expect them, so the report says both, and the KPI is called "a bar that splits the file" rather
than an accuracy.

What does not separate is medium from ordinary: those two overlap almost completely (2.65–3.42 against
1.94–3.36). If this demo were re-recorded, the thing to change is the medium band — either give it a
sharper signal in the data or drop it and grade two ways instead of three.

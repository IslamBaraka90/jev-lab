# Dividend safety

- Sixteen symbols use the committed Yahoo Finance fundamentals and price cache fetched on 2026-09-19.
- Twelve operating companies have four annual histories. JPM and BAC lack cash-flow lines, leaving ten cover-complete issuers; XOM remains usable for payout cover while its missing debt lines are disclosed. Four fund or crypto instruments remain visible with no issuer statements.
- Jev receives raw payout, income, cash-flow, debt and cash lines. Price, yield, payout ratios and the report-only safety formula are never sent.
- The source cache has no debt-maturity schedule or historical share-count series, so those fields are explicitly empty rather than inferred.
- Research only; this demo is not investment advice.
- Recorded all 16 cases with `jev-1.13.0` on 2026-09-19 (21,161 input tokens and 3,265 output tokens).
- Jev was within 1.25 points of the simple payout-cover safety formula on 4 of 10 cover-complete issuers and matched its first pressure point on 2 of 10. Both readings remain visible; the formula is a cross-check, not hidden truth.
- CVX and PEP combine at least 3% computed yield with a Jev safety score below 3/6. Debt-funding calls agreed on 5 of 9 issuers with usable debt lines.
- The cached aggregate payout histories contain no dividend cut. The report preserves that honest zero instead of inventing a natural test case.

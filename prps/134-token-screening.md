# 134 · Token screening

**Domain:** Crypto · **Data:** synthetic (seed 1134) · **View:** table · **Items:** 160 tokens · **Questions:** 5

## Value

Read a token's contract facts, liquidity and holder spread, and say whether it is a trap.

## Demo flow

1. A token opens with contract flags, liquidity, holder distribution and trading history.
2. The model grades rug risk, names the red flag, and says whether it is tradeable.
3. Tokens sort into tradeable, caution and avoid.
4. The report grades those calls against what the generator planted, including the tokens that later rugged.

## Data

- `demos/token-screening/data.json` — 160 fictional tokens. Each: contract facts (mint authority present, ownership renounced, proxy upgradeable, transfer tax, blacklist function), liquidity (pool size, share locked, lock expiry), holders (top-10 share, holder count, creator share), trading (age, volume shape, buy-sell ratio, failed sell attempts).
- Planted: 14 rug-shaped tokens, 9 honeypots (buys succeed, sells fail), 11 tax traps (sell tax above 20%), and 18 that look scary but are fine — a new token with concentrated holders because of a vesting contract, a project with an unlocked pool that has never moved.
- Labels: `{ token, outcome: FINE|RUGGED|HONEYPOT|TAX_TRAP, flag }`.

## State

The contract facts, liquidity, holder spread and trading shape, plus the chain's norms for tokens of that age. No label, no future outcome.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `rug_likelihood` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `red_flag` | choice | `MINT_AUTHORITY` · `UNLOCKED_LIQUIDITY` · `HOLDER_CONCENTRATION` · `SELL_TAX` · `FAILED_SELLS` · `NONE` |
| `tradeable` | yes/no | – |
| `honeypot_suspected` | yes/no | – |
| `position_limit` | choice | `NONE` · `SMALL` · `NORMAL` |

## Report

Outcome accuracy, honeypot recall (the one where a miss is expensive), red-flag distribution, the 18 decoys with their calls, and a curve from rug-likelihood threshold to how many good tokens get excluded.

## Files

Standard demo folder plus `scripts/generate/token-screening.js`.

## Acceptance

Template list, plus:

- [x] Failed sell attempts are present in the data and are the only reliable honeypot signal.
- [x] Vesting-contract concentration is distinguishable from creator concentration in the state.
- [x] The report separates recall on honeypots from overall accuracy.

## Video beats

- A honeypot: 400 buys, 3 failed sells, flagged.
- The vesting decoy that survives the holder-concentration test.
- The exclusion curve: how many good tokens you lose to catch 90% of rugs.

## Notes

All tokens and pools are invented. No real project names, tickers or contract addresses anywhere.

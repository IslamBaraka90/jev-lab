# 132 · Wallet behaviour profiling

**Domain:** Crypto · **Data:** synthetic (seed 1132) · **View:** table · **Items:** 200 wallets · **Questions:** 4

## Value

Say what a wallet is — exchange, market maker, bot, retail, bridge, scam collector — from its behaviour alone.

## Demo flow

1. A wallet opens with an activity fingerprint: timing histogram, amount distribution, counterparty count, gas behaviour, contract interactions.
2. The model names the type and how confident it is.
3. Wallets group by type, and each group shows its shared fingerprint.
4. The report checks the names against the labels and shows where the types blur.

## Data

- `demos/wallet-profiling/data.json` — 200 fictional wallets in 6 types, each with its own fingerprint:
  - exchange hot wallet: constant activity, many small outbound, few inbound sources;
  - market maker: two-sided flow with venues, tight timing;
  - MEV bot: same-block patterns, high gas, repeated contract calls;
  - retail: bursts, round amounts, few counterparties;
  - bridge: paired in-and-out with a fixed contract;
  - scam collector: many small inbound from fresh wallets, one large outbound.
- Planted ambiguity: 10 wallets that sit between types (a retail user running a trading bot, an exchange's cold-to-hot transfer wallet).
- Labels: `{ wallet, type }`.

## State

Activity aggregates, the hour-of-day histogram, amount buckets, counterparty counts and turnover, gas statistics, contract interaction counts, and the age of funding sources. No label, no type hint in field names.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `wallet_type` | choice | `EXCHANGE` · `MARKET_MAKER` · `MEV_BOT` · `RETAIL` · `BRIDGE` · `SCAM_COLLECTOR` |
| `automation` | score 0–6 | Fully manual · Mostly manual · Some automation · Mixed · Mostly automated · Highly automated · Machine only |
| `monitoring_level` | choice | `NONE` · `PERIODIC` · `CONTINUOUS` |
| `type_is_clear` | yes/no | – |

## Report

Type accuracy, a confusion matrix showing which types the model blurs, automation score against the labelled type, the ten ambiguous wallets and what they were called, and the fingerprint chart per type.

## Files

Standard demo folder plus `scripts/generate/wallet-profiling.js`.

## Acceptance

Template list, plus:

- [x] The confusion matrix is clickable into the wallets behind each cell.
- [x] Ambiguous wallets are graded separately and not counted as errors when the model says the type is unclear.
- [x] The fingerprint chart is generated from the data, not drawn by hand.

## Video beats

- An MEV bot's hour histogram: flat across the day, unlike retail's evening peak.
- The scam collector: 300 tiny inbound, one outbound.
- The confusion matrix cell where market maker and bot overlap.

## Notes

Pairs naturally with 131 in the video: what is this wallet, then how risky is it.

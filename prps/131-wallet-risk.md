# 131 · Wallet risk scoring

**Domain:** Crypto · **Data:** synthetic (seed 1131) · **View:** queue · **Items:** 240 wallets · **Questions:** 5

## Value

Score a wallet before you accept its money, and name the exposure that drove the score.

## Demo flow

1. A wallet opens with its counterparty mix: exchanges, bridges, mixers, gambling, unknown.
2. The model grades risk, names the worst exposure, and decides accept, review or reject.
3. Wallets sort into three lanes with the amount at stake in each.
4. The report grades the lanes against the planted risk and shows what a deposit desk would have accepted.

## Data

- `demos/wallet-risk/data.json` — 240 fictional wallets (`0xDEMO…` addresses). Each: age, transaction count, total received and sent, counterparty summary by label, largest counterparties with share of volume, hop distance to the nearest flagged entity, chain, and recent 30-day activity.
- Labelled entity list is fictional: `MIXER_A`, `SANCTIONED_ENTITY_B`, `EXCHANGE_C`, `BRIDGE_D`, `GAMBLING_E`.
- Planted: 18 high-risk wallets (direct mixer exposure, one hop from a flagged entity, or dominated by gambling flow), 22 medium, and 14 decoys that look bad and are not: a market maker with huge volume, a bridge relayer, a long-dormant wallet reactivated for one large legitimate transfer.
- Labels: `{ wallet, riskBand, driver }`.

## State

The wallet's aggregates, its counterparty mix with labels and shares, hop distances, age and activity shape, and the chain's typical profile for wallets of that age. No label, no precomputed risk score.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `risk` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Severe |
| `main_exposure` | choice | `MIXER` · `SANCTIONED_ENTITY` · `GAMBLING` · `BRIDGE` · `EXCHANGE` · `NONE` |
| `decision` | choice | `ACCEPT` · `REVIEW` · `REJECT` |
| `exposure_direct` | yes/no | Is the exposure direct rather than several hops away? |
| `activity_consistent` | yes/no | Does the activity fit the wallet's apparent type? |

## Report

Risk band accuracy against labels, value accepted and rejected, exposure drivers as a distribution, the decoys with their decisions, and a threshold curve from risk score to acceptance rate.

## Files

Standard demo folder plus `scripts/generate/wallet-risk.js`.

## Acceptance

Template list, plus:

- [ ] Every address is clearly fictional and prefixed so nobody mistakes it for a real one.
- [ ] Hop distance is in the state as a number, and the report shows how much of the decision it explains.
- [ ] Decoys are listed in `notes.md`.

## Video beats

- A wallet one hop from a mixer, rejected, with the path shown.
- The market maker with enormous volume, accepted.
- The acceptance curve as the threshold moves.

## Notes

Entity labels are invented for the demo. The page must say so, and must not imply any real analytics vendor's labelling.

# 122 · Account takeover

**Domain:** Fraud · **Data:** synthetic (seed 1122) · **View:** queue (session timeline) · **Items:** 260 sessions · **Questions:** 5

## Value

Tell a stolen session from a customer on a new phone, and choose the check that gets in the way least.

## Demo flow

1. A session opens as a timeline: login, device, location, then the actions taken.
2. The model reads the session against the account's normal behaviour and decides whether to step up.
3. Sessions sort into allow, step up and block.
4. The report shows takeovers caught, genuine customers challenged, and which signal carried each decision.

## Data

- `demos/account-takeover/data.json` — 260 sessions over two weeks. Each: device id and whether it is new, IP country and ASN type, login method, time since last login, actions in order (view balance, add beneficiary, change email, change phone, raise limit, transfer), amounts, and the account's 90-day behaviour summary.
- Planted: 14 takeovers with four shapes — credential stuffing then beneficiary change, SIM swap then limit raise, session hijack mid-flow, and insider access from a familiar device. Plus 20 innocent lookalikes: travel, a new phone, a genuine emergency transfer, a shared family device.
- Labels: `{ sessionId, takeover: true|false, shape }`.

## State

The session timeline, the device and network facts, the account's usual devices, countries and hours, and the actions with their risk weight in the bank's own policy. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `takeover_likelihood` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `strongest_signal` | choice | `IMPOSSIBLE_TRAVEL` · `NEW_DEVICE` · `CREDENTIAL_RESET_CHAIN` · `BENEFICIARY_CHANGE` · `BEHAVIOUR_SHIFT` · `NONE` |
| `action` | choice | `ALLOW` · `STEP_UP` · `BLOCK_SESSION` · `FREEZE_ACCOUNT` |
| `step_up_method` | choice | `PUSH_APPROVAL` · `CALL_BACK` · `DOCUMENT_CHECK` · `NOT_NEEDED` |
| `customer_friction_justified` | yes/no | – |

## Report

Takeovers caught against genuine sessions challenged, signal distribution, friction cost (challenged legitimate sessions × a friction weight), the four planted shapes and how many of each were caught, and the decoys' outcomes.

## Files

Standard demo folder plus `scripts/generate/account-takeover.js`.

## Acceptance

Template list, plus:

- [x] Impossible travel is derivable from the timestamps and locations in the state, not pre-computed.
- [x] Friction cost is shown beside the catch rate everywhere it appears.
- [x] Each planted shape is represented at least three times.

## Video beats

- SIM swap: phone change, then a limit raise, then a transfer, blocked in the middle.
- The traveller on a new phone, allowed with a push approval rather than a call.
- The friction counter moving as the threshold moves.

## Notes

Session timelines read better than tables on camera; the timeline view is worth the extra build here.

Implemented and recorded on 2026-09-19 with `jev-1.13.0`: 260 of 260 session responses cached,
100% takeover catch rate, 91.5% least-disruptive action accuracy, and fifteen of 246 legitimate
sessions challenged for 50 friction points. The complete immutable run is documented in
`demos/account-takeover/notes.md`.

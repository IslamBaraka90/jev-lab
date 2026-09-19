# Delivery exceptions

Two hundred and fifty invented failed or delayed shipments. Each state contains the raw tracking
events, component address, customer contacts, courier operating note, same-address history, weather
context and the actual cost per failed attempt.

## What was planted

Seed 1116 creates 38 targeted address-quality failures, 22 unavailable-customer cases, 19 courier
failures, 11 explicit cash-on-delivery refusals and 14 genuinely unclear exceptions, plus 146 routine
background exceptions. The 11 refusal customers reuse IDs, names and phones from demo 112's serial
refusers so the two demos can be shown together.

Half of the targeted courier failures contain an attempted-delivery scan from the depot during the
night. The camera case is a `03:10` scan: the fault is inferable from time, location, GPS distance and
the published delivery window; no precomputed invalid-scan field enters the model state.

## Recorded run

All 250 responses were recorded on 2026-09-19 with `jev-1.13.0` and cached in `fixtures.json`. The
run used 385,408 input tokens and 42,710 output tokens. Every shipment ID has all four answers; there
are no missing, extra or malformed records.

The model assigned the planted primary fault correctly on all 250 shipments (100%) and called
exactly 14 cases unclear, matching the 14 genuinely unclear labels. It caught all ten invalid
depot/night attempt scans as courier faults and all eleven linked cash-on-delivery refusals as
customer refusals. Preventability agreed on 178 of 250 shipments (71.2%), and the model-attributed
avoidable failed-attempt cost was $3,787.50 of $4,195.00 total failed-attempt cost.

Next-action accuracy was 117 of 250 (46.8%). The largest disagreements were 73 packets where the
policy expected pickup rerouting but the model preferred contacting the customer, and 45 where the
policy expected a courier retry but the model preferred pickup. Only six of the eleven correctly
identified refusal cases were returned to sender. These policy-action differences remain in the
fixture and report rather than being relabelled after recording.

# What this demo proves

The model receives the complete ninety-day fingerprint for every fictional wallet: its timing histogram, amount buckets, direction of flow, counterparties, gas behaviour, contract repetition and funding-source ages. It does not receive the type label or a suggestive field name.

The deliberately ambiguous wallets matter. Five mix retail timing with bot-like execution; five mix exchange flow with bridge-like pairing. They are reported separately, and an explicit “unclear” answer is treated as good judgement rather than an error.

The fingerprint chart is recomputed from the wallet records in the run. The confusion matrix is not a picture: every populated cell opens the actual wallets behind that count.

All addresses and activity are synthetic. A behavioural profile is an operational hypothesis, not proof of identity or wrongdoing.

## Recorded run

Jev 1.13.0 answered all 200 wallets on 19 September 2026. The recorder sent every field returned by `buildState` and all four questions for every wallet: 324,476 input tokens and 30,921 output tokens in total. The fixture audit found no missing, extra or malformed answer sets.

On the 190 clear wallets, 173 types were correct (91.1%). Every exchange, MEV-bot and scam-collector fingerprint was named correctly; the largest blur was 14 market makers called exchanges. All ten planted boundary wallets were handled fairly because the model explicitly marked each one unclear. Automation's mean absolute error was 0.79 points on the zero-to-six scale; monitoring matched the labelled operating level on 50% of wallets.

# What this demo proves

The model receives the complete ninety-day fingerprint for every fictional wallet: its timing histogram, amount buckets, direction of flow, counterparties, gas behaviour, contract repetition and funding-source ages. It does not receive the type label or a suggestive field name.

The deliberately ambiguous wallets matter. Five mix retail timing with bot-like execution; five mix exchange flow with bridge-like pairing. They are reported separately, and graded on whether the type named is one of the two they sit between.

The fingerprint chart is recomputed from the wallet records in the run. The confusion matrix is not a picture: every populated cell opens the actual wallets behind that count.

All addresses and activity are synthetic. A behavioural profile is an operational hypothesis, not proof of identity or wrongdoing.

## Recorded run

Jev 1.13.0 answered all 200 wallets on 19 September 2026. The recorder sent every field returned by `buildState` and all four questions for every wallet: 324,476 input tokens and 30,921 output tokens in total. The fixture audit found no missing, extra or malformed answer sets.

On the 190 clear wallets, 173 types were correct (91.1%). Every exchange, MEV-bot and scam-collector fingerprint was named correctly; the largest blur was 14 market makers called exchanges. Seven of the ten planted boundary wallets were named as one of their two neighbouring types; three were named something else (WPF-0020 a bridge, WPF-0063 and WPF-0139 market makers). The model marked all ten unclear, but it also marked 163 of the 190 clear wallets unclear — the yes/no ran between 36% and 55% on every wallet — so that answer carries no signal and the report no longer counts it as handling ambiguity. Automation's mean absolute error was 0.79 points on the zero-to-six scale, against a label that is one fixed number per type. Monitoring is reported but not scored: the model chose continuous monitoring for 172 of 200 wallets and never chose none, and the state gives no rule tying a type to a level, so an agreement figure would only measure a mapping the model never saw. A six-line rule with one threshold per type names all 190 clear wallets correctly, which the report shows beside the model's 173.

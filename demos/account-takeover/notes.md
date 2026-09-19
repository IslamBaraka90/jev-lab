# Account takeover

Two hundred and sixty invented sessions over two weeks. The state sends the complete account profile,
device and network facts, previous login, customer context and every current-session action, plus the
bank's event-risk and friction weights.

## What was planted

Seed 1122 creates fourteen takeovers: four credential-stuffing chains, four SIM swaps, three
mid-session hijacks and three insider sessions from a familiar device. Twenty innocent lookalikes are
split evenly across travel, a new phone, an emergency transfer and a shared family device. The other
226 sessions follow the account's normal behaviour.

Impossible travel is never supplied as a flag. The model must compare the timestamp/country of the
account's previous login with timestamped current-session events. Likewise, the insider cases keep a
familiar device and rely on time, amount and action sequence to reveal the behaviour shift.

## Recorded run

All 260 responses were recorded on 2026-09-19 with `jev-1.13.0` and cached in `fixtures.json`. The
run used 460,035 input tokens and 58,810 output tokens. Every session ID has all five answers; there
are no missing, extra or malformed records.

The model intervened on all fourteen takeovers (100% catch rate), including all four credential-
stuffing cases, all four SIM swaps, all three mid-session hijacks and all three insider sessions. It
selected the exact least-disruptive policy action on 238 of 260 sessions (91.5%).

Fifteen of 246 legitimate sessions were challenged (6.1%), for 50 friction points. The full decoy
pattern is useful rather than hidden: all five new-phone sessions received the intended push
approval; all five emergency transfers were blocked instead of called back; all five shared-family
devices received a push approval instead of being allowed; and all five travel sessions were
allowed instead of receiving the policy's push approval. The latter produces no realised friction,
but is still counted as an action disagreement. Threshold reporting always pairs the fourteen-
takeover catch count with its corresponding legitimate-customer friction.

The strongest-signal label was correct on 241 of 260 sessions. Seven of the nineteen errors repeated
the main confusion: a planted new-device signal was called no single decisive signal. These recorded
model judgements remain unchanged in the cache and report.

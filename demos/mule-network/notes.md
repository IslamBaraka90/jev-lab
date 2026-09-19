# Mule networks

A hundred and twenty accounts at an invented bank and nine hundred transfers over a month. Three of the
clusters exist to move other people's money. One looks exactly like a network and is a joiner paying
eleven people on the fifteenth and the twenty-ninth.

**Every account is answered on its own**, from its own neighbourhood. Nothing in the state says which
cluster an account belongs to, so the networks have to be put back together from individual roles —
which is what the report scores, per network as well as per account.

## The data

`scripts/generate/mule-network.js`, seed 1125. Three arrangements:

- **N1, a straight fan-in.** Two originators pay six mules, each mule sweeps to one collector the same
  evening, and the collector empties itself in one branch transfer on the twenty-eighth.
- **N2, a chain.** The same money through two layers, each hop a few minutes after the one before: in
  at two minutes past, on at nine minutes past, on again at twenty-one minutes past.
- **N3, a smaller fan-in** whose collector keeps an eighth rather than passing everything on.

Twelve ordinary accounts send a single payment to somebody in an arrangement, three families share a
device and an address, and the six N1 mules were opened from two handsets.

## What the recorded run found

120 answers, model `jev-1.13.0`, 167,770 input and 19,282 output tokens, about six minutes.

- **All three collectors were named**, and 13 of the 14 mules. The collector is the account the money is
  for, so finding all three is the result that matters most.
- **One network came back whole** (N2, the chain, 6 of 6). N1 came back 8 of 9 and N3 4 of 6, both
  missing an originator: two of the four originators were called mules instead. Originators sit at the
  edge of the picture, where the neighbourhood the model sees is thinnest.
- **The payroll cluster survived**, 11 of its 12 accounts left alone. Only the employer itself was
  given a role.
- **Pass-through timing was called on six accounts and all six are mules.** It is the sharpest field in
  the file, and it is under-used: 14 accounts have the timing and only six were called.

## The honest caveat: it paints too many accounts as mules

**Forty-two of the ninety-nine ordinary accounts were given a role**, nearly all of them "mule". That is
half the innocent population, and an operation could not work that list.

Part of that is the model reaching, and part of it is the dataset's fault. The ordinary traffic here is
a handful of random payments in and out with no salary anchor, no retained balance and no standing
commitments, so a lot of ordinary accounts genuinely look like small pass-throughs. A second pass would
give every ordinary account a monthly credit it keeps, and re-record; until then the useful numbers
from this run are the three collectors, the thirteen mules and the payroll cluster, and the 42 is a
caveat on the data as much as on the answers.

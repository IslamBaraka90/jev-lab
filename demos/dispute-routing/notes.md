# Dispute and refund routing

Two hundred and twenty disputes at an invented homeware shop. This is the tool-call demo: five typed
answers become one backend call with its arguments filled in — the endpoint, the money, the reason code
— and the page renders that call rather than making it. **The question set is the tool schema.** There
is no prose contract anywhere, and no action is taken at any point.

## The data

`scripts/generate/dispute-routing.js`, seed 1113. Every customer, message, order and courier record is
generated. The customer messages are written the way people actually write them at 9pm, not the way
documentation is written.

The merchant's policy is a set of numbers, so the right action is a consistent reading of those numbers
against the facts of the dispute. That is what makes this gradeable at all:

| Rule | Value |
|---|---|
| Returns and claims accepted for | 30 days after delivery |
| A parcel is lost once the last courier scan is | 10 days old |
| Refunds signed off by a person above | £300 |
| Damage claims need | a photograph, first |
| A customer keeping a faulty item gets | 50%, or 25% for marks that do not affect use |
| A repeat not-received claim is refused after | 2 previous ones, with proof of delivery |
| Shipping goes back | when the shop or its courier is at fault |

Planted, and labelled with the action the policy gives: **18 friendly-fraud claims** (not received,
signed for, from customers who have claimed this two to five times before), **12 genuine
non-deliveries** (the courier stopped scanning 11 to 26 days ago), **8 duplicate charges**, **6
policy-expired claims** (fair complaints that arrived 38 to 140 days late) and **5 damage claims with
no photograph**, where the policy says ask rather than decide. The remaining 171 are the everyday queue.

## How it is graded

Three of the five answers are graded separately, because a call can be right in one and wrong in
another: the **action**, the **refund band** and the **reason code**. The money is arithmetic on the
band, so a wrong band is a wrong amount.

There is also one check that uses no labels at all: **a refund call that carries no money contradicts
itself.** The action and the band are separate questions, and nothing in the type system makes them
agree — so the demo counts the calls where they do not.

## What the recorded run found

220 answers on 19 September 2026, model `jev-1.13.0`, 307,994 input and 51,356 output tokens, about
thirteen minutes.

- **The action agreed with the policy on 90% of disputes**, and every planted group was read correctly
  except one: 18 of 18 friendly-fraud claims denied, 12 of 12 genuine non-deliveries refunded, 8 of 8
  duplicate charges refunded, 5 of 5 missing photographs asked for, and 5 of the 6 policy-expired
  claims refused.
- **No money went out against the policy.** £11,691 refunded across 162 calls, none of it on a dispute
  the policy would have refused.
- **The whole call was correct only 57% of the time.** That gap is the result worth the demo: choosing
  the tool is the easy half, and the arguments are where it comes apart.
- **27 of the 162 refund calls refund nothing.** The action says `REFUND_NOW`, the band says `NONE`,
  and the body that comes out carries `amount: 0`. Each answer is well-formed on its own; together they
  contradict each other. A backend receiving that call does nothing, and the dispute sits open.
- **68 calls took the right action with a different band**, and 61 of those change what the customer is
  actually paid — nearly all in the same direction: shipping added back on duplicate charges and
  not-as-described claims, where the policy only returns shipping when the shop is at fault. The model
  is consistently more generous than the policy, which is at least a predictable failure.
- **Where it hesitated, it hesitated safely.** Ten of the 22 wrong actions are the same swap: asking for
  evidence where the policy already allowed a refund. That costs a day, not money.
- **Automation is defensible at 4 of 6.** 97 calls clear that bar and the action is right on every one
  of them; the remaining 123 go to a person. The band problem above is the reason the demo does not
  claim those 97 are safe to send — only that their action is.

## The honest caveat

The everyday queue is the weakest part of the file: 21 of the 22 wrong actions are in it, mostly the
evidence swap above, and its disputes are generated from templates rather than written one by one like
the planted five groups. A second pass would vary the everyday messages more, and re-record.

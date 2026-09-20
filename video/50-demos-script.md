# Fifty Financial Jobs, One Model
## Scene-by-scene production script — voice-over and editor instructions

**Target runtime:** 105–120 minutes
**Source of truth:** every number in this script is taken from the recorded runs committed in this
repository and shown on the live site. Where a joke and a number disagree, the number wins and the
joke gets rewritten.

---

# PART 0 — HOW TO USE THIS DOCUMENT

## 0.1 The two columns

Every scene has two blocks:

- **`VO`** — read exactly as written. Line breaks are breath marks, not paragraphs.
- **`EDITOR`** — what is on screen. Every URL is real and can be opened right now.

Where a punchline appears, it is marked **`PUNCH`**. The rule from the comedy treatment holds
throughout: *the joke comes after the viewer understands the concept.* The research is the sentence.
The comedy is the punctuation.

## 0.2 The site

Primary: **`https://jev.thefintechbuilder.com`**
Fallback while DNS propagates: `https://jev-typesafe-real-financial-use-cas.vercel.app`

Use the primary in every shot. If a capture was made on the fallback, crop the address bar.

## 0.3 Presenter mode is the shot list

This is the single most important thing for the editor. **Every demo has a built-in five-beat
presentation.** Do not screen-record people scrolling. Use these:

```
https://jev.thefintechbuilder.com/demos/<slug>?present=1&beat=1   The job
https://jev.thefintechbuilder.com/demos/<slug>?present=1&beat=2   One item
https://jev.thefintechbuilder.com/demos/<slug>?present=1&beat=3   Typed answers
https://jev.thefintechbuilder.com/demos/<slug>?present=1&beat=4   Where it missed
https://jev.thefintechbuilder.com/demos/<slug>?present=1&beat=5   The whole run
```

Arrow keys step between beats. On **beat 3** the answers reveal one at a time — press → to advance
each answer, and the verdict card lands after the last one. Let that land. Do not cut early.

Capture at **1920×1080**, browser at 100% zoom, no bookmarks bar, dark theme (the site is dark by
default).

## 0.4 The repeating rhythm

Each demo follows the same five beats, which makes a two-hour video navigable:

| Beat | Screen | Roughly |
|---|---|---|
| 1 | The job | 0:10–0:20 |
| 2 | One item | 0:15–0:30 |
| 3 | Typed answers | 0:20–0:40 |
| 4 | Where it missed | 0:15–0:35 |
| 5 | The whole run | 0:15–0:30 |
| — | Punchline | 0:03–0:08 |

**Flagships** (marked ★) get 3–4 minutes. **Montage demos** (marked ▸) get 45–80 seconds — for those,
use beats 1, 3 and 5 only and skip 2 and 4.

## 0.5 Recurring on-screen assets

Build these once and reuse.

**DAVE'S QUEUE** — a small counter, bottom-right, appears whenever something is sent to a human.
Starts at `27`. Grows across the film. Numbers are given per scene.

**THE RULE** — a plain grey card. This is the running character of this film, because it is the
running result of the research. Format:

```
THE RULE
<one line of logic>
<score>
```

**TECHNICALLY CORRECT / OPERATIONALLY AWFUL** — a stamp, for decisions that are defensible and useless.

**EXCEL** — a tiny window in the corner, `LEGACY FALLBACK DETECTED`. Used three times in the whole
film and paid off at the end. Do not overuse it.

**CONFIDENCE BAR** — when a confidence figure is quoted, show the bar. When confidence is high and
the answer is wrong, the bar turns and reads `REALITY HAS ENTERED THE CHAT`.

## 0.6 Subscribe prompts — exact placements

Three, no more. Each is a 4-second animated lower-third with the bell icon:

1. **00:06:30** — after the intro lands, before Domain 1.
2. **00:52:00** — at the midpoint transition (Portfolio → Trades).
3. **01:44:00** — before the final thesis.

Copy for all three:

> **If this is the kind of thing you want more of — subscribe, and turn the bell on.**
> **This took fifty recorded runs to make.**

## 0.7 Comment prompts

On the six hardest demos (marked 💬 in this script) a lower-third appears for 5 seconds:

> **Want this one broken down properly? Tell me which part in the comments.**

Placed at the end of beat 5, before the punchline. The six are: 121, 123, 165, 174, 183, 185.

---

# PART 1 — COLD OPEN AND INTRODUCTION
**Runtime 00:00 – 00:07:30**

---

## Scene 001 — The fake demo problem
**00:00 – 00:01:40**

### EDITOR

Cold open. No logo, no music sting. Start on a black screen with a single line of white text, typed
in real time:

```
"Jev can design a whole website."
```

Hold one second. Cut it. Next line:

```
"Jev drives a Tesla."
```

Cut. Next:

```
"Watch Jev draw this shape."
```

Cut. Then all three at once, small, with a dozen more filling the screen in a grid — mock thumbnails
with the usual red arrows and shocked faces. **Do not use real channel names, real thumbnails or
real handles. Build generic mock-ups.** Desaturate them.

Then: everything collapses to black.

### VO

Every week there is another one.

Jev can design.

No it cannot.

Jev can drive a Tesla.

It is not a vision model. It cannot see the road.

Jev can draw a shape.

That demo was fake, and the person who made it knows it was fake.

### EDITOR

Cut to the presenter, or to a clean dark title card:

```
FIFTY FINANCIAL JOBS
ONE MODEL
EVERY ANSWER GRADED
```

### VO

So I did the boring version.

I gave one model fifty real financial jobs, recorded every answer, and graded all of them against
data where the right answer is already known.

Then I put the whole thing on the internet so you can check my work.

### PUNCH

Which is a far worse thumbnail and a much better experiment.

---

## Scene 002 — What is not in this video
**00:01:40 – 00:02:50**

### EDITOR

A list builds on screen, each item greyed out and struck through as it is read:

```
SPAM OR NOT SPAM
IS THIS COMMENT TOXIC
PRODUCT REVIEW: POSITIVE / NEGATIVE
SUPPORT TICKET: URGENT / NOT URGENT
CLASSIFY THIS EMAIL
```

Then the whole list slides off the left edge.

### VO

First, what you will not see.

No spam detection.

No comment moderation.

No product-review sentiment.

None of the generic classification demos that every model launch ships with.

Those are fine. They are just taken. There are dozens of channels covering them, and they cover them
well.

### EDITOR

Bring up the live catalogue: `https://jev.thefintechbuilder.com/demos` — scroll it slowly, top to
bottom, so the viewer sees the sheer number of cards. Do not pause on any one.

### VO

What is here instead is fifty jobs that somebody is actually paid to do.

Reconciling a ledger. Triaging a fraud queue. Tracing a wallet. Reading a filing. Deciding whether a
trading strategy should be allowed to trade this week.

### PUNCH

Less shareable. Considerably more employable.

---

## Scene 003 — Verifiable, or it did not happen
**00:02:50 – 00:04:20**

### EDITOR

Open the GitHub repository in a real browser tab:
`https://github.com/IslamBaraka90/jev-typesafe-real-financial-use-cases`

Scroll to the README. Highlight the line about recorded runs. Then cut to a terminal and type these
three commands for real, letting the output run:

```
git clone https://github.com/IslamBaraka90/jev-typesafe-real-financial-use-cases
npm install
npm run build
```

Then, on the site, click **Source** in the top bar — the GitHub mark, top right — to show the link is
on every page.

### VO

Here is the part that separates this from a thumbnail.

Every demo on this site is in a public repository. The datasets are committed. The answers are
committed. The code that grades them is committed.

You can clone it, run it, and get the same numbers I got.

And if you think a dataset is too easy — and I will show you several that were — you can change it.
Change the data, change the questions, change the scope, re-run it, and tell me I was wrong.

### EDITOR

On screen, three cards:

```
50 DEMOS        9,347 ITEMS        44,909 TYPED ANSWERS
```

Then a fourth, in a different colour:

```
ALL OF IT, COMMITTED
```

### VO

Nine thousand three hundred and forty-seven items. Forty-four thousand nine hundred and nine typed
answers. One model version, jev-1.13.0, recorded across two days.

### PUNCH

If a demo cannot survive being handed to a stranger with a laptop, it was a magic trick.

---

## Scene 004 — How to survive the next two hours
**00:04:20 – 00:05:40**

### EDITOR

Show the YouTube player with the chapter list open, scrubbing through the chapter markers so the
viewer sees there are fifty-plus of them. Then a card:

```
USE THE CHAPTERS.
SERIOUSLY.
```

### VO

Now, honesty about the format.

This video is long, and the first few minutes are the worst part of it, because fifty demos in nine
domains is a lot of scaffolding before anything pays off.

So: the description has a chapter for every single demo. If you only care about fraud queues, jump to
fraud queues. If you came for the trading strategy that lost money, that is chapter forty-eight.

Nobody is grading you on watching this in order.

### PUNCH

I built a benchmark, not a hostage situation.

---

## Scene 005 — The shape of every demo
**00:05:40 – 00:06:30**

### EDITOR

Open one demo in presenter mode and step all five beats on screen, fast, about three seconds each,
with the beat name as a lower-third:

`https://jev.thefintechbuilder.com/demos/card-fraud-triage?present=1&beat=1` → `beat=5`

Label them as they pass: **The job · One item · Typed answers · Where it missed · The whole run.**

### VO

Every demo in this video follows the same five steps.

The job. One item, the way it actually arrives. The typed answers the model gives. Where it got
things wrong. And then the whole run, graded.

That fourth step is the one most demos skip.

### PUNCH

It is also the only one anybody learns anything from.

### EDITOR

**SUBSCRIBE PROMPT 1** — 00:06:30, 4 seconds, lower third.

---

## Scene 006 — What a typed answer is
**00:06:30 – 00:07:30**

### EDITOR

Open `https://jev.thefintechbuilder.com/demos/dispute-routing?present=1&beat=3` and step through the
answer reveal one press at a time. Zoom to 140% on the first answer card. Let the viewer read the
probability bar. Then pull back as the verdict card lands.

### VO

One thing you need before we start.

This model does not write a paragraph about a disputed refund.

It returns a choice with a probability on every option. A position on a rubric. A probability of yes.

That means the answer is a number that code can act on, and a number I can grade.

### EDITOR

Freeze on the verdict card. Hold two seconds.

### PUNCH

It is much harder to be vague when your opinion has to arrive as a decimal.

---

# PART 2 — DOMAIN 1: BOOKS AND RECONCILIATION
**Runtime 00:07:30 – 00:20:00 · five demos**

### EDITOR — Domain title card

```
DOMAIN 1 / 9
BOOKS AND RECONCILIATION
5 DEMOS
```

Open `https://jev.thefintechbuilder.com/domains/books` underneath for two seconds.

---

## ★ 101 — LEDGER INTEGRITY REVIEW
**Slug:** `ledger-integrity` · **502 items** · **Target 3:30**

### BEAT 1 — The job

**EDITOR** · `…/demos/ledger-integrity?present=1&beat=1`

**VO**

The first job is the least glamorous one in finance, which is why it is first.

Read a journal line. Understand the account it hit. Understand the other side of the entry. Then say
whether it deserves somebody's attention.

Five hundred and two lines.

### BEAT 2 — One item

**EDITOR** · `beat=2`. Zoom 150% on the item card. Highlight the amount and the date.

**VO**

Here is one. A payment of four thousand, seven hundred and forty pounds and thirty-six pence to a
printing supplier.

It has already been paid, five days earlier, under a different document number. Both entries are in
front of the model.

### BEAT 3 — Typed answers

**EDITOR** · `beat=3`. Step the reveal. Hold on the verdict.

**VO**

Issue type: duplicate posting, at sixty-eight per cent.

Severity: minor.

Needs a human: yes.

That is the job done correctly.

### BEAT 4 — Where it missed  💬

**EDITOR** · `beat=4`. Then cut to the demo's report and highlight the false-alarm count.

**VO**

Now the part that matters.

Across the run it raised seventy-five false alarms. Which looks bad, until you read them.

Sixty-eight of those seventy-five are the same objection. Ninety-one per cent. The model kept
insisting that purchase VAT had been debited to the VAT payable account with the sign the wrong way
round.

### EDITOR

On-screen stamp, slow:

```
BENCHMARK STATUS:
AUDITED BY SUBJECT
```

**VO**

It was right. My generated chart of accounts did not have a VAT receivable account, so the generator
put the entry somewhere it did not belong. The model found a bug in my data.

### PUNCH

The first significant finding of this project was that the exam marked the examiner.

### BEAT 5 — The whole run

**EDITOR** · `beat=5`. Highlight the baseline row.

**VO**

Nine of the eleven planted problems, named with the right issue type. A rule that checks the period,
the balance and a twin entry gets eight.

So the model is ahead here — but keep that rule on screen. You are going to see it again.

### EDITOR

Show **THE RULE** card for the first time:

```
THE RULE
period · balance · twin entry
8 of 11
```

Park it in the corner. It comes back.

---

## ▸ 102 — BANK RECONCILIATION
**Slug:** `bank-reconciliation` · **60 items** · **Target 1:10**

### EDITOR

Beats 1, 3, 5. On beat 1, animate three columns sliding in: `BANK · LEDGER · PROCESSOR`.

### VO

Bank reconciliation sounds deterministic. Transaction here, transaction there, match, done.

Except one system posts on Monday and another settles on Tuesday. One uses gross, one uses net. And
somewhere, somebody rounded something.

### EDITOR

Three amounts, same transaction:

```
BANK       $10,000
LEDGER     $9,973.50
PROCESSOR  $10,000 − FEES
```

Caption: `EVERYONE IS CORRECT. SOMEHOW.`

### VO

Sixty breaks. The model resolved sixty of sixty — right ledger entry, right reason.

### EDITOR · beat=5, highlight the baseline.

### VO

And a rule that compares payee, amount and how many days apart they are — a rule that never reads a
reference field at all — resolves fifty-nine.

### PUNCH

One better. For a language model. Against three lines of arithmetic.

**THE RULE** card ticks up. Leave it on screen a beat longer this time.

---

## ▸ 103 — EXPENSE POSTING
**Slug:** `expense-posting` · **400 items** · **Target 1:05**

### EDITOR

Beat 1. Merchant names fly past: AWS, Hilton, Uber, a café, Office Depot. Then stop hard on `AMAZON`
and explode it into six branches: office supplies, cloud, electronics, subscription, a business book,
and one labelled `MYSTERY PURCHASE`.

### VO

Pick the right account for an expense. Some are trivial — Amazon Web Services is probably not
catering.

Then you meet Amazon itself, which is less a merchant category and more an existential question.

### EDITOR · beat=5.

### VO

Three hundred and ninety-nine out of four hundred.

### EDITOR

Hold two seconds, then bring up **THE RULE**:

```
THE RULE
copy the vendor's last account
83%
```

### VO

Which sounds superb until you notice what the dataset was doing. Copying whatever account that vendor
used last time gets you eighty-three per cent on its own.

### PUNCH

A benchmark where the model scores ninety-nine point eight is either a very good model or a very open
book. This one was slightly too open.

---

## ▸ 104 — THREE-WAY MATCH
**Slug:** `three-way-match` · **150 items** · **Target 1:15**

### EDITOR

Beat 1. Three documents slide together: purchase order, goods receipt, invoice.

```
PO:       100 units @ $10
RECEIPT:   98 units
INVOICE:  100 units @ $11
```

Alarm state. Three documents turn and stare at each other.

### VO

Purchase order, receipt, invoice. All three are supposed to agree before anybody pays anything.

### EDITOR · beat=5.

### VO

A hundred and thirty-four of a hundred and fifty packets decided correctly — the right mismatch named
and the right hold or release.

And five of the fifteen mismatch errors are the same one: tax called none.

### EDITOR

**THE RULE**, now in a slightly larger card:

```
THE RULE
compare the fields
150 of 150
```

### VO

A rule that simply compares the fields gets all hundred and fifty.

### PUNCH

It is called three-way matching because "why do these three systems disagree again" tested badly with
enterprise buyers.

---

## ▸ 105 — CLOSE BLOCKERS
**Slug:** `close-blockers` · **60 items** · **Target 1:00**

### EDITOR

Month-end clock at `23:12`. Queue of items. Two bins: `BLOCKS CLOSE` / `DOES NOT BLOCK CLOSE`.

### VO

Month-end. Some open items are annoying. Some genuinely stop the books closing. The job is telling
them apart.

Thirteen of thirteen blockers found, held back and named for the right reason.

### BEAT 4 — Where it missed

**EDITOR** · `beat=4`. Highlight accounts 1310, 2320, 2720.

### VO

Three accounts were held with nothing named as the blocker. That is not a wrong answer so much as two
of its own answers contradicting each other.

### EDITOR

Stamp: `TECHNICALLY CORRECT / OPERATIONALLY AWFUL`
**DAVE'S QUEUE: 27** appears for the first time, bottom right.

### PUNCH

Nothing in finance gains importance faster than a problem discovered twenty minutes before close.

---

### TRANSITION — Books → Orders
**EDITOR:** whip-pan. Card: `DOMAIN 2 / 9 — ORDERS AND CUSTOMERS`.

**VO**

The books are closed. Mostly.

Now let us sell things to people, which is where the problems stop being arithmetic and start being
creative.

---

# PART 3 — DOMAIN 2: ORDERS AND CUSTOMERS
**Runtime 00:20:00 – 00:29:30 · six demos**

### EDITOR — Domain card, plus `https://jev.thefintechbuilder.com/domains/orders` for two seconds.

---

## 111 — ORDER RISK AT CHECKOUT
**Slug:** `order-risk` · **300 items** · **Target 1:50**

### BEAT 1

**EDITOR** · `…/demos/order-risk?present=1&beat=1`

**VO**

An order arrives. High value, express delivery, new device, billing address in another country.

That is either fraud, or a perfectly good customer behaving in the least convenient way available.

### BEAT 2–3

**EDITOR** · `beat=2`, then `beat=3`. Zoom on the action probabilities.

**VO**

Four actions: allow, verify, hold, decline.

### BEAT 5, THEN BEAT 4

**EDITOR** · Run `beat=5` first here — the headline is the story.

**VO**

Nine frauds in the file. It stopped all nine. Ten thousand, one hundred and seventy-two pounds, all
of it held or declined.

**EDITOR** · Now `beat=4`. Bring up the false-positive count.

**VO**

And then this. Twelve good orders were built to look bad on purpose. It stopped eleven of them.

A gift sent abroad. A customer logging in while travelling. Somebody on a new phone. A company's
first order.

**EDITOR** · Four customer avatars, each stamped `DECLINED`, each with their entirely innocent reason
underneath.

**VO**

Every one of those is a real person who did nothing wrong, and that is the price of the threshold.

### PUNCH

At some point, genuine customers begin speed-running every fraud rule you own.

**EDITOR** · Small text, bottom of frame, hold four seconds. It matters:
`9 frauds only — the 95% interval on that catch rate runs 70% to 100%.`

---

## ▸ 112 — COD ABUSE
**Slug:** `cod-abuse` · **180 items** · **Target 1:00**

**EDITOR** · Beat 1: a courier van drives across an animated city. Customer says `NO THANKS.` Van
drives back. Repeat three times, faster each time.

**VO**

Cash on delivery has a specific failure mode: people can order without paying, and then simply refuse
the delivery. Repeatedly.

**EDITOR** · `beat=5`.

**VO**

A hundred and seventy-three of a hundred and eighty histories read correctly. And all seven errors
are the same swap — an address hopper called a serial refuser.

### PUNCH

Technically e-commerce. Operationally a courier sightseeing programme.

---

## ▸ 113 — DISPUTE ROUTING
**Slug:** `dispute-routing` · **220 items** · **Target 1:05**

**EDITOR** · Ticket bounces: `SUPPORT → PAYMENTS → FRAUD → SUPPORT`. Then the model catches it.

**VO**

"I did not receive it." "I did not authorise it." "This is not what I ordered."

Three different problems, three different workflows. And support departments have exactly one
universal optimisation strategy: send the ticket to another department.

**EDITOR** · `beat=5`.

**VO**

A hundred and ninety-eight of two hundred and twenty routed the way the policy says.

Ten of the twenty-two errors are one swap: refund now, answered as request evidence.

### PUNCH

Which is one rule to settle in a meeting, not ten separate mistakes to apologise for.

---

## ▸ 114 — CHARGEBACK EVIDENCE
**Slug:** `chargeback-evidence` · **120 items** · **Target 1:00**

**EDITOR** · Evidence cards assemble: delivery proof, invoice, IP, device, customer messages, tracking.

**VO**

A chargeback is not "the merchant says the customer is wrong". It is a question about which documents
strengthen the case, which are irrelevant, and which quietly contradict each other.

**EDITOR** · `beat=5`.

**VO**

Ninety-nine of a hundred and twenty outcomes called correctly.

### PUNCH

Nothing communicates confidence like attaching seventeen screenshots and hoping one of them is
legally meaningful.

---

## 115 — MERCHANT ONBOARDING
**Slug:** `merchant-onboarding` · **140 items** · **Target 1:30**

**EDITOR** · `beat=2`. Zoom hard on these three fields in sequence:

```
Business:         Premium Electronics
Website age:      3 days
Expected volume:  $8,000,000 / month
```

**VO**

A new merchant wants to join the platform. Onboard them normally, ask for more evidence, escalate, or
decline.

**EDITOR** · `beat=5`.

**VO**

Here is the number that matters. Eleven merchants in this file should never be accepted on any terms
— prohibited activities, and forged documents. No reserve makes them acceptable.

It approved none of them.

**EDITOR** · `beat=4`. Put `APP-029`, `APP-073`, `APP-113` on screen.

**VO**

But three of those eleven were not actually refused either. They were left in a state that is neither
approval nor refusal.

### PUNCH

Ambition is not a risk factor by itself. It does occasionally arrive with supporting evidence.

---

## ▸ 116 — DELIVERY EXCEPTIONS
**Slug:** `delivery-exceptions` · **250 items** · **Target 0:55**

**EDITOR** · Map with hundreds of shipments. Some stall, some bounce, some lose a scan.

**VO**

Late is not always urgent. Urgent is not always late. And a missing scan does not mean a missing
parcel.

Two hundred and fifty of two hundred and fifty faults assigned correctly.

**EDITOR** · Hold. Then **THE RULE**, large:

```
THE RULE
read the driver's reason code
250 of 250
```

**VO**

And so does reading the reason code the driver already typed into the scan. It is right there in the
data, and it maps one-to-one onto the answer.

So this number shows the scans were read. It does not show that a self-serving excuse was seen
through.

### PUNCH

"Out for delivery" remains a philosophical position rather than a timestamp.

---

### TRANSITION — Orders to Fraud

**VO**

Some customers are complicated.

Some of them are not customers.

---

# PART 4 — DOMAIN 3: FRAUD AND FINANCIAL CRIME
**Runtime 00:29:30 – 00:42:00 · six demos**

---

## ★ 121 — CARD FRAUD TRIAGE  💬
**Slug:** `card-fraud-triage` · **400 items** · **Target 4:00**

> The strongest demonstration in the repository. Give it room. This is the scene to cut the trailer
> from.

### BEAT 1

**EDITOR** · `beat=1`. Build the queue physically: four hundred alert cards stack into a tower. A
capacity bar slides in and cuts it at fifty.

```
400 ALERTS THIS HOUR
50 AN ANALYST CAN OPEN
```

**VO**

This is the one I would show if I only had one.

The rules engine produced four hundred alerts this hour. The team can open fifty.

So the question is not "can the model detect fraud". That is the wrong question, and it is the one
every vendor demo answers.

The question is: of the fifty an analyst will actually open, how many are worth opening?

### BEAT 2–3

**EDITOR** · `beat=2`, one alert card in full. Then `beat=3`, step the reveal.

**VO**

Sixteen of the four hundred are real fraud. Every alert gets a score, and the queue is re-sorted by
it.

### BEAT 5 — the payoff

**EDITOR** · `beat=5`. **Hero shot of the film.** Two queues side by side: the rules engine's own
order on the left, the model's order on the right. Fraud cards glow. Draw the cut-off line at fifty
across both.

**VO**

Take the top fifty in the order the rules engine produced, and you catch six of the sixteen.

Take the top fifty in the model's order, and you catch thirteen.

Same alerts. Same hour. Same fifty slots. Nothing added and nothing removed — just put in a different
order.

**EDITOR** · Animate each mover travelling up the queue, old rank fading:

```
ALT-0366   was 366  →  top 50
ALT-0335   was 335  →  top 50
ALT-0329   was 329  →  top 50
ALT-0051   was  51  →  top 50
```

**VO**

Eight fraudulent alerts moved up into the first fifty from further down. One of them was sitting at
rank three hundred and sixty-six.

Nobody was ever going to reach rank three hundred and sixty-six.

### PUNCH

Detecting fraud at position three hundred and sixty-six is technically excellent work. Operationally,
congratulations to the fraudster.

**EDITOR** · Alert #366 waves cheerfully from the bottom of the old queue. Then **THE RULE**:

```
THE RULE
three-flag scorecard
12 of 16
```

**VO**

And to be fair to the boring option: a three-flag scorecard gets twelve. The model gets thirteen.

But both are far ahead of the queue the rules engine shipped — which is the queue the analyst
actually had this morning.

### 💬 COMMENT PROMPT — 5 seconds, then punch out.

---

## ★ 123 — AML ALERT TRIAGE  💬
**Slug:** `aml-alert-triage` · **300 items** · **Target 3:15**

### BEAT 1

**EDITOR** · Alert counter spins up. Underneath, a very small number.

```
ALERTS GENERATED: 12,481
ANALYSTS: 4
```

**VO**

Anti-money-laundering systems have one extraordinary talent: generating alerts.

Enough alerts that eventually people stop reviewing transactions and start reviewing the alert system.

### PUNCH

We have successfully automated the creation of manual work.

**EDITOR** · **DAVE'S QUEUE: 1,284**

### BEATS 3 AND 5 — the real finding

**EDITOR** · `beat=3`, then `beat=5`. Two panels side by side.

**VO**

Three hundred alerts. Twelve are genuinely worth working.

Now watch what happens when you ask the same model the same thing two different ways.

Ask it to choose — escalate, yes or no — and it escalates eighty alerts to hold those twelve.

Ask it for a suspicion score instead, and cut at four out of six, and you get nineteen alerts, with
all twelve inside.

**EDITOR** · Two bars, animated, then the kicker:

```
ESCALATE CHOICE    80 alerts to find 12
SUSPICION SCORE    19 alerts to find 12

IN SCORE ORDER, THE FIRST 14 CONTAIN ALL 12.
```

**VO**

Same model. Same alerts. One question produces a queue of eighty, the other a queue of nineteen.

The score is the sharper instrument, and the yes-or-no throws that away.

### PUNCH

The model did not get better. The question did.

### 💬 COMMENT PROMPT

---

## ▸ 122 — ACCOUNT TAKEOVER
**Slug:** `account-takeover` · **260 items** · **Target 1:15**

**EDITOR** · Timeline: new device → new location → password reset → new beneficiary → large transfer.

**VO**

Any one of those is normal. All five in sequence is less of a coincidence and more of a screenplay.

Two hundred and thirty-eight of two hundred and sixty least-disruptive actions chosen correctly.

**EDITOR** · Now the honest cut. Highlight the hard-subset count.

**VO**

Except two hundred and twenty-six of those sessions are perfectly ordinary ones nobody would
challenge.

On the thirty-four that are actually difficult, it picked the least-disruptive correct action twelve
times. Thirty-five per cent.

### PUNCH

The headline is being carried almost entirely by the easy cases. Which is true of most headlines.

---

## ▸ 124 — SANCTIONS NAME MATCHING
**Slug:** `sanctions-name-match` · **200 items** · **Target 1:20**

**EDITOR** · Names morph: Muhammad / Mohamed / Mohamad / Mohammed, then Arabic script, then a company
alias, then a reversed name order.

**VO**

Sanctions screening sounds like string comparison right up until the real world turns up with
transliteration, abbreviations, aliases, different alphabets and different name ordering.

**EDITOR** · `beat=5`.

**VO**

Fifty-nine of two hundred hits settled the way the record supports.

And here is why that is low: a hundred and fifty-two of the two hundred were held for review, and a
hundred and eighty-two were marked as needing more data.

It keeps every true match. It also declines to decide almost everything else.

**EDITOR** · **DAVE'S QUEUE: 1,436**. Stamp: `TECHNICALLY CORRECT / OPERATIONALLY AWFUL`.

### PUNCH

The analyst's desk did not get smaller. It got a second opinion stacked on top of it.

---

## ▸ 126 — INSIDER SURVEILLANCE
**Slug:** `insider-surveillance` · **180 items** · **Target 1:05**

**EDITOR** · Employee access list, price chart, announcement date, trade markers on a timeline.

**VO**

Surveillance systems should not declare guilt. They identify behaviour that deserves a look.

Nine of nine suspicious trades opened.

**EDITOR** · Stamp `INVESTIGATE ≠ CONVICT`. Then **THE RULE**:

```
THE RULE
access to the symbol + no pre-cleared plan
180 of 180
```

**VO**

And a two-condition rule — did they have access to that symbol, and was there a pre-cleared plan —
gets all hundred and eighty dispositions right.

The access list decides every case in this dataset. So the score tells you the record was read. It
does not tell you the chart was.

### PUNCH

"Interesting timestamp" is not yet a legal theory.

---

## 125 — MULE NETWORKS
**Slug:** `mule-network` · **120 items** · **Target 1:40**

**EDITOR** · `beat=2`: the graph view. Accounts as nodes, money as edges. Let it assemble on screen.

**VO**

One suspicious transfer means almost nothing. Thirty accounts moving money through the same shape
means quite a lot.

Three networks are planted in this file.

**EDITOR** · `beat=5`:

```
N1   8 of 9
N2   6 of 6
N3   4 of 6
```

**VO**

One of the three recovered whole.

**EDITOR** · `beat=4`.

**VO**

And forty-two ordinary accounts were given a role in something. Five of them on the strength of a
single payment to somebody who happened to be in an arrangement.

### PUNCH

One transfer is an anecdote. Thirty coordinated transfers are a diagram. Five is neither — and it
still got somebody put on a list.

---

### TRANSITION — Fraud to Crypto

**VO**

Now remove the names, replace them with addresses, and publish every transaction permanently.

---

# PART 5 — DOMAIN 4: CRYPTO AND ON-CHAIN
**Runtime 00:42:00 – 00:50:30 · five demos**

> **Editor note for this whole domain.** Four of these five demos are won by a short rule. That is the
> finding, not an accident, and the film should let it land rather than hide it. Keep **THE RULE**
> card on screen longer here than anywhere else.

---

## ★ 131 — WALLET RISK
**Slug:** `wallet-risk` · **240 items** · **Target 2:40**

### BEAT 1

**EDITOR** · `beat=1`. Then cut to the graph view and pull the camera back until the whole thing is a
tangle of nodes.

**VO**

Crypto. Every transaction is visible, which sounds wonderfully transparent, right up until you look
at the graph.

A deposit arrives. Where has this money been, how many hops ago, and do you accept it?

### BEAT 3

**EDITOR** · `beat=3`. Zoom on the exposure answer.

**VO**

Two hundred and forty deposits. A hundred and sixty-nine decisions that fit the wallet — exposure
held or refused, ordinary wallets accepted. Seventy per cent.

### BEAT 5 — the honest part

**EDITOR** · `beat=5`. Hold on the baseline row for a full four seconds before the VO resumes.

**VO**

And now the number I did not enjoy writing.

**EDITOR** · **THE RULE**, full screen, slow:

```
THE RULE
hop count · mixer or listed flow · betting share
237 of 240
```

**VO**

Five lines of logic over the hop count and the counterparty mix handles two hundred and thirty-seven
of the two hundred and forty. The model handles a hundred and sixty-nine.

The labels in this file follow the hop count closely, so a rule can simply read them off. Which means
this dataset cannot show a model beating a rules engine, because the answer is a function of two
fields.

### PUNCH

I built a crypto risk benchmark, and the winner was an if-statement.

### EDITOR

Keep **THE RULE** card in the corner from here to the end of the domain. It is about to win again.

---

## ▸ 132 — WALLET PROFILING
**Slug:** `wallet-profiling` · **200 items** · **Target 0:55**

**EDITOR** · Behaviour signatures appear as silhouettes: long-term holder, trader, bridge user,
farmer, bot.

**VO**

Rather than asking whether a wallet is risky, this asks what kind of wallet it is.

A hundred and seventy-three of a hundred and ninety clear wallets named correctly.

**EDITOR** · **THE RULE**:

```
THE RULE
one threshold per type
190 of 190
```

**VO**

Six lines, one threshold per type, gets all of them.

### PUNCH

Wallet addresses have no profile photos. Their transaction habits, unfortunately for them, are
extremely chatty — and a threshold can hear it just as well.

---

## ▸ 133 — MIXER TRACING
**Slug:** `mixer-tracing` · **90 items** · **Target 1:15**

**EDITOR** · `beat=2`: funds split into branches, cross a bridge, enter a mixer pool, come out in
several places. Let the animation run its full length.

**VO**

Money goes into a mixer. Splits, merges, bridges, moves again.

The task is not magical de-anonymisation. It is classifying exposure from what can actually be
observed.

**EDITOR** · `beat=5`.

**VO**

Sixty-six of ninety taint calls made the way the desk's rules make them.

**EDITOR** · Now show both bars together:

```
Jev, as scored          66 of 90
Jev, read at 70%        86 of 90
THE RULE (walk the path, stop at an exchange)   90 of 90
```

**VO**

Read the same answers at a seventy per cent threshold instead and it gets eighty-six. Walk the path
mechanically and you get ninety.

So what this run really tests is whether a mechanical rule can be applied from prose. Not whether a
mixer can be found.

### PUNCH

By this point the money has changed connections more often than a delayed passenger at Heathrow.

---

## ▸ 134 — TOKEN SCREENING
**Slug:** `token-screening` · **160 items** · **Target 1:00**

**EDITOR** · A token card:

```
AGE: 4 hours
TOP HOLDER: 83%
LIQUIDITY: $17,000
MARKETING: "REVOLUTIONARY"
```

**VO**

A new token appears. Ordinary, high risk, or not enough information?

A hundred and fifty-one of a hundred and sixty outcomes correct.

**EDITOR** · **THE RULE**:

```
THE RULE
failed sells · sell tax · mint · creator share · removal
160 of 160
```

**VO**

And once again, five lines over the same fields gets all of them, because the harmful tokens and the
fine ones do not overlap on a single one of those numbers.

### PUNCH

"Revolutionary" remains one of finance's least quantitative risk metrics.

---

## ▸ 135 — SYBIL CLUSTERS
**Slug:** `sybil-clusters` · **150 items** · **Target 1:20**

**EDITOR** · Fifty wallets, funded from one source within minutes of each other, all interacting with
the same contracts.

**VO**

Are these fifty independent users, or one person wearing fifty hats?

**EDITOR** · `beat=5`. Put the exclusion figure up plainly.

**VO**

Here is the cleanest failure in the whole film.

It excluded nobody. Not one wallet, out of a hundred and fifty. Every single one was allocated, and
sixty-nine thousand dollars went to the eight wallets that were farming.

**EDITOR** · Show the confidence range:

```
EXCLUSION ANSWER: 26% – 46%
THRESHOLD: 50%
CROSSED IT: never
```

**VO**

The exclusion answer ran between twenty-six and forty-six per cent, and never once crossed the line.

It was suspicious the entire time. It just never said so loudly enough to count.

### PUNCH

The blockchain equivalent of turning up to your own birthday party in forty-nine fake moustaches and
being waved in each time because the bouncer was only forty-six per cent sure.

---

### TRANSITION — Crypto to Portfolio

**VO**

After following money through forty-seven wallets, we return to the relaxing world of portfolio risk.

---

# PART 6 — DOMAIN 5: PORTFOLIO
**Runtime 00:50:30 – 00:58:30 · six demos**

### EDITOR — **SUBSCRIBE PROMPT 2** at 00:52:00, inside this domain.

---

## ★ 141 — PORTFOLIO HEALTH
**Slug:** `portfolio-health` · **24 items** · **Target 2:30**

### BEAT 1–2

**EDITOR** · A portfolio donut, colourful and apparently well spread. Then the slices re-colour by
underlying driver and collapse into two or three blocks.

**VO**

Twenty holdings can look diversified until you notice most of them answer to the same economic
driver.

Twenty-four portfolios. Name the main risk in each, from six options.

### BEAT 5

**EDITOR** · `beat=5`.

**VO**

Sixteen of twenty-four.

Which is not a good score. But it is the most interesting result in the domain, because of what sits
underneath it.

### THE CONFIDENCE SCENE — this is the important bit

**EDITOR** · Build this on screen carefully. Two columns of twenty-four answers, sorted by the
model's own confidence, with a horizontal line drawn at fifty per cent. Colour correct green,
incorrect red.

**VO**

Sort those twenty-four answers by how confident the model was.

Every single answer at fifty per cent or above is correct. All sixteen of them.

Every single answer below fifty per cent is wrong. All eight.

**EDITOR** · Hold the shot in silence for three full seconds. No music.

**VO**

There is no overlap. Not one exception.

Which means if you had simply not acted on anything below fifty per cent, you would have sent every
single mistake to a human and kept every correct answer.

### PUNCH

The model did not know the answer eight times out of twenty-four. It did, however, know that it did
not know. That is worth considerably more than the accuracy figure.

**EDITOR** · Show the **CONFIDENCE BAR** asset here for the first time properly. **DAVE'S QUEUE: +8**
— and for once, the queue growing is the correct outcome. Put a small tick beside it.

---

## ▸ 142 — PORTFOLIO COMPARE
**Slug:** `portfolio-compare` · **18 items** · **Target 0:50**

**EDITOR** · Portfolio A and B side by side, five dimensions each.

**VO**

Which portfolio is more appropriate depends entirely on the objective. Higher return is not
automatically better. Lower volatility is not automatically better.

Eighteen of eighteen.

**EDITOR** · Then:

```
THE RULE: count the broken constraints        18 of 18
Take the higher 12-month return                6 of 18
```

**VO**

Counting broken constraints also gets eighteen. Every figure a constraint needs is already computed
in the state, so this file is easy.

Picking whichever had the better year gets six.

### PUNCH

Finance's favourite answer survives: it depends. And this time we can show you exactly what it
depends on.

**EDITOR** · Giant glowing `IT DEPENDS™`.

---

## ▸ 143 — REBALANCE REVIEW
**Slug:** `rebalance-review` · **200 items** · **Target 1:15**

**EDITOR** · Current weights versus target. Then constraint cards drop in one by one: transaction
cost, tax, liquidity, wash-sale.

**VO**

The optimiser says rebalance. Transaction costs say maybe. Tax says please do not. Liquidity says not
today.

**EDITOR** · `beat=5`.

**VO**

Forty-seven problem trades in the file. It stopped all forty-seven.

And on only sixteen of those forty-seven did it give the verdict the desk would give. The commonest
error: fourteen trades the desk would defer were rejected outright.

### PUNCH

It saw that something was wrong far more reliably than it knew what to do about it. Which, to be
fair, describes most risk committees.

---

## ▸ 145 — MANDATE COMPLIANCE
**Slug:** `mandate-compliance` · **240 items** · **Target 1:00**

**EDITOR** · Policy document on the left, positions on the right, lines drawn between them.

**VO**

A mandate turns investment intent into explicit constraints. Maximum exposure, allowed securities,
liquidity, concentration.

Two hundred and thirty of the two hundred and thirty-two checks the policy actually settles, called
correctly.

**EDITOR** · Highlight the eight arguable checks.

**VO**

Eight checks in the file turn on a reading rather than a number. Six of those eight were marked as
exactly that.

### PUNCH

Those six are the lines a compliance officer needs on their desk first, whichever way they were
answered. "Basically compliant" has never been a recognised regulatory category.

---

## ▸ 144 — FACTOR EXPOSURE
**Slug:** `factor-exposure` · **30 items** · **Target 0:55**

**EDITOR** · Holdings with different logos remove masks. Underneath, they all read `GROWTH`.

**VO**

The names of the holdings can be completely different. The economic exposures underneath can be
identical.

Twenty-four of thirty: does the owner's story about their book match the book?

**EDITOR** · `beat=4`.

**VO**

One portfolio with a deliberately planted second exposure was called clean.

### PUNCH

A diversified portfolio in appearance. A monoculture in a blazer.

---

## ▸ 146 — INCOME PLANNING
**Slug:** `income-planning` · **40 items** · **Target 0:50**

**EDITOR** · A cash-flow calendar. Coupons and dividends land on some months. Withdrawals land on all
of them.

**VO**

A portfolio can be valuable on paper and still fail the only job it has: producing cash in the month
the investor needs it.

Forty of forty problems named exactly.

**EDITOR** · **THE RULE**: `three comparisons over the account totals — 40 of 40`.

**VO**

And three comparisons over totals the state already carries does the same.

### PUNCH

You cannot pay next month's rent with an excellent long-term expected return.

---

### TRANSITION — Portfolio to Trades

**VO**

The portfolio tells us what we own.

Execution tells us what we actually paid for it.

---

# PART 7 — DOMAIN 6: TRADES AND EXECUTION
**Runtime 00:58:30 – 01:08:00 · six demos**

---

## ▸ 151 — POST-TRADE REVIEW
**Slug:** `post-trade-review` · **220 items** · **Target 1:05**

**EDITOR** · A trade replays on a chart: entry, the market's path, exit.

**VO**

After a trade closes, everybody becomes extremely wise. The real question is what could have been
learned from the information available at the time.

A hundred and ninety-eight of two hundred and twenty lessons agreed with the record.

**EDITOR** · **THE RULE**: `five checks on the record — 220 of 220`.

### PUNCH

Hindsight remains the highest-performing trading strategy ever discovered, and five if-statements
remain its closest competitor.

---

## ▸ 152 — TRADE FEATURE ANALYSIS
**Slug:** `trade-feature-analysis` · **300 items** · **Target 1:20**

**EDITOR** · Trades line up against attributes: volatility, trend, volume, setup.

**VO**

Which features go with better outcomes? And more importantly, which patterns are stable enough to
act on?

It selected fifty-four trades it would take again. Those won fifty-five point six per cent of the
time, against a base rate of forty-four.

An eleven-point lift.

**EDITOR** · Now draw the confidence interval as a bar, with the base rate line inside it:

```
LIFT:      +11.2 points
INTERVAL:  42.4%  ——————————  68.0%
BASE RATE: 44.3%          ↑ inside the interval
```

**VO**

Except the interval on that lift runs from forty-two per cent to sixty-eight, and the base rate sits
inside it.

Which means this run cannot tell an eleven-point edge from luck. Fifty-four picks is not enough.

### PUNCH

If you slice twenty losing trades into enough categories, one subgroup eventually becomes a strategy.

---

## ▸ 154 — TRADER BEHAVIOUR
**Slug:** `trader-behaviour` · **120 items** · **Target 0:55**

**EDITOR** · Patterns surface on a P&L chart: revenge trades, oversizing after a win, early exits,
moved stops.

**VO**

Now we look at the trader rather than the market. Does size change after a loss? Do stops move?

A hundred and sixteen of a hundred and twenty.

**EDITOR** · **THE RULE**: `four thresholds against the day's own norms — 120 of 120`.

### PUNCH

The most volatile component in a trading system continues to be the person operating it.

---

## ▸ 156 — MISSED TRADES
**Slug:** `missed-trades` · **240 items** · **Target 1:15**

**EDITOR** · Signals not taken. Then the future path reveals.

**VO**

A trade not taken is still a decision. Did the system correctly avoid a bad setup, or miss a good one?

**EDITOR** · This one needs care. Two numbers:

```
Against the written policy:  130 of 130
Against the labels:          121 of 130
```

**VO**

A hundred and thirty of a hundred and thirty skips judged the way the written policy says.

Against my labels, it is a hundred and twenty-one.

Nine skips are labelled as justified by a price gap — but their gaps are below the two and a half per
cent the policy itself names. The model said take them, which is what the policy says.

### PUNCH

So on those nine it disagreed with my labels by agreeing with my rules. Research finding: write the
policy down before you write the answer key.

---

## ★ 153 — EXECUTION QUALITY
**Slug:** `execution-quality` · **260 items** · **Target 2:00**

### BEAT 1–2

**EDITOR** · `beat=2`, the candle chart. Mark four prices on it: decision price, arrival price, the
fill, and the benchmark.

**VO**

A trade can have the right idea and lose money through execution. Or the execution can be excellent
and the idea wrong.

This asks which one happened. Gap, chase, size, spread, or clean.

### BEAT 5

**VO**

Two hundred and seventeen of two hundred and sixty causes named exactly.

**EDITOR** · **THE RULE**: `order type · bars late · session · the two prices — 260 of 260`.

**VO**

And five lines over the order type, how many bars late the fill was, the session, and the two prices,
gets all two hundred and sixty.

### PUNCH

Execution analysis is the professional process of deciding whether to blame the trader, the market or
the algorithm. It turns out you can automate the blame with five if-statements.

---

## ▸ 155 — JOURNAL VS REALITY
**Slug:** `journal-vs-reality` · **200 items** · **Target 1:10**

**EDITOR** · Split screen. The trader's note on the left, the actual trade record on the right.
Highlight the contradiction in red as the VO names it.

**VO**

The journal says: followed the plan.

The record says: entered late, moved the stop, added to a loser, exited early.

A hundred and eighty-seven of two hundred notes read correctly.

**EDITOR** · **THE RULE**: `five keyword checks — 200 of 200`.

### PUNCH

Memory is an excellent risk-management tool, because it improves the trade retroactively.

---

### TRANSITION — Trades to Screening

**VO**

Charts are finished.

Time to remember that companies have businesses.

---

# PART 8 — DOMAIN 7: SCREENING AND FUNDAMENTALS
**Runtime 01:08:00 – 01:17:30 · six demos**

---

## ▸ 161 — GOAL SCREENING
**Slug:** `goal-screening` · **96 items** · **Target 1:20**

**EDITOR** · `beat=1`. A plain-English objective in quotation marks, then sixteen company cards
sorting behind it.

**VO**

Instead of asking whether a company is good, ask whether it fits a stated objective. Sixteen real
companies, six objectives written the way a person actually says them.

"I need income now." "I am putting this away for ten years."

**EDITOR** · `beat=5`.

**VO**

Every one of the sixteen companies was read differently depending on the objective, which is the
whole premise working.

And then: of the fifty-six readings that named a reason for ruling something out, twenty-six are
supported by a number in that company's own file. Thirty are not.

**EDITOR** · Show the two dominant unsupported reasons: `volatility` and `earnings quality`.

**VO**

Mostly it said volatility, against a threshold I set deliberately strictly.

### PUNCH

"Is this a good stock" is the financial equivalent of "is this a good shoe". For what? Running?
Hiking? A wedding? The model answered the question properly. It just kept citing reputation where
the file wanted arithmetic.

---

## ▸ 162 — FUNDAMENTAL READ
**Slug:** `fundamental-read` · **16 items** · **Target 0:55**

**EDITOR** · Four years of statements scroll, then resolve into a small set of signals.

**VO**

Read the statements directly and form a structured assessment, without collapsing everything into
one magic score.

Six of nine companies read the way the ratios read them.

**EDITOR** · Small text: `only 9 of 16 instruments have complete statements — one company moves this
a long way.`

**VO**

Three companies have a genuine disagreement between the direct reading and the ratio cross-check.
The report keeps both rather than pretending the ratio is the truth.

### PUNCH

Companies, inconveniently, can improve and deteriorate at the same time.

---

## ★ 163 — SHARIA SCREEN
**Slug:** `sharia-screen` · **48 items** · **Target 2:10**

### BEAT 1

**EDITOR** · Three rule-set cards side by side, each with its own denominator highlighted.

**VO**

This one is deliberately constrained, and I want to be precise about what it is.

The model is not making religious rulings. It is applying explicitly supplied screening criteria to
a balance sheet. Three named rule sets, written for this demo from published standards, simplified,
and clearly not anybody's official text.

Sixteen instruments, three rule sets, forty-eight screenings.

### PUNCH

Which is good, because "the AI has developed jurisprudence" was not on the roadmap.

### BEAT 3

**EDITOR** · `beat=3`. The key shot: the model's ratio call **beside** the demo's own arithmetic.
Zoom so both numbers are readable.

**VO**

Every ratio the model is asked to judge is also computed by the page, and the two are shown side by
side. There is no labels file here. The ground truth is arithmetic.

### BEAT 5

**VO**

Twenty-nine of thirty-six screenings had every ratio call right.

Seven disagree with the same sum done on the page.

**EDITOR** · List them:

```
NVDA liquid    30.3% against a 25% limit
JPM  liquid    36.9% against 33%
BAC  liquid    59.3% against 33%
JPM  debt      11.3% against 25%
```

**VO**

And one of those seven is arguably better than my arithmetic. For a universal bank, the filed total
debt line leaves out deposits, which are most of the balance sheet. The page counts that as a wrong
answer because the page only knows the line it was given.

### PUNCH

A person doing this properly would side with the model and against my demo. I left the mark as it
was, because moving it would have been marking my own homework.

---

## ★ 165 — ACCOUNTING FLAGS  💬
**Slug:** `accounting-flags` · **120 items** · **Target 3:00**

### BEAT 1

**EDITOR** · `beat=1`.

```
120 COMPANY-YEARS
47 WITH A PLANTED PATTERN
10 OF THOSE EXPLAINED IN THE NOTES
73 CLEAN
```

**VO**

A hundred and twenty company-years, three years of statements each. Forty-seven carry a planted
accounting pattern. Ten of those forty-seven have an innocent explanation written into the notes and
nowhere else — so excusing them requires reading prose, not arithmetic.

### BEAT 3–4

**EDITOR** · `beat=3`, then `beat=4`.

**VO**

Forty-eight of the hundred and twenty read as planted.

And answering "nothing to see" every single time would have scored seventy-three.

**EDITOR** · Put those two numbers next to each other and hold.

```
JEV                    48 of 120
SAY NOTHING, ALWAYS    73 of 120
```

### PUNCH

We are now below the performance of a model that has been switched off.

### THE REAL FINDING

**EDITOR** · Now the rescue. Two bars:

```
Planted years, average severity     3.8 of 6
Clean years, average severity       2.6 of 6
```

**VO**

But look at what it actually did rather than what it said.

Sort by the severity score and the planted years average three point eight out of six. The clean ones
average two point six. That gap is consistent, and it is enough to sort a queue by.

The ranking works. It is the yes-or-no that fails.

**EDITOR** · Then the cost:

```
CLEAN YEARS HELD UP FOR REVIEW: 51 of 73
```

**DAVE'S QUEUE: 51 CLEAN COMPANIES**

**VO**

Fifty-one of the seventy-three clean years were held up for review.

### PUNCH

The model became the doctor who orders a full-body scan because technically something could be wrong.

### THE QUESTION FIX — keep this, it is the thesis

**VO**

And one more thing happened here that changed how I wrote every demo afterwards.

The first version of the question asked whether a year should "go to somebody". It set no bar. The
answer came back yes for all hundred and ten graded items.

**EDITOR** · A wall of `YES / YES / YES / YES`.

**VO**

So I rewrote it to state the standard: most years are unremarkable, hold one up only where somebody
relying on these numbers would be misled.

Same model. Same data. The clean-year holds went from seventy-three of seventy-three, to fifty-one.

### PUNCH

A question with no threshold in it is not a question. It is an invitation to escalate.

### 💬 COMMENT PROMPT

---

## ▸ 164 — DIVIDEND SAFETY
**Slug:** `dividend-safety` · **16 items** · **Target 0:55**

**EDITOR** · Yield, payout ratio, cash flow, debt, coverage — five dials.

**VO**

A high yield can mean excellent income, or it can mean the market has already decided the dividend is
going away.

Ten of ten weak payers told apart from covered ones.

**EDITOR** · Then the caveat, on screen in plain text.

**VO**

And an honest limitation the page states itself: the four-year cached histories contain no actual
dividend cut. So there is no real cut in here to catch.

### PUNCH

A twelve per cent yield is either attractive or a smoke detector. This demo can read the detector. It
has not yet seen a fire.

---

## ▸ 166 — PEER VALUATION
**Slug:** `peer-valuation` · **4 items** · **Target 0:50**

**EDITOR** · A peer grid. Multiples, growth, margins.

**VO**

Valuation by peers is simple until the peers are not comparable.

This is the smallest demo in the set — four peer groups — and the result is mostly a statement about
that.

Only two of the four groups have one peer that is cheapest on most multiples. The rest are ties.

**EDITOR** · Show the large US banks row: `P/E cheapest: WFC · P/B cheapest: C · Jev picked: BAC`.

**VO**

In the banks group there is no clear cheapest peer at all, so the model's pick is not being compared
with anything.

### PUNCH

Comparable-company analysis: find companies that are not comparable, and compare them anyway.

---

### TRANSITION — Screening to News

**VO**

The numbers tell one story.

Management is about to tell another.

---

# PART 9 — DOMAIN 8: NEWS, FILINGS AND LINKS
**Runtime 01:17:30 – 01:26:00 · five demos**

---

## ▸ 171 — NEWS IMPACT
**Slug:** `news-impact` · **300 items** · **Target 1:40**

**EDITOR** · `beat=2`: a headline over a candle chart, with the bars after the headline hidden.

**VO**

Three hundred headlines, each against the chart it landed on, with nothing after that day visible.

First, a disclosure about how this one is built. The companies here are invented and the price series
are real but rebased. Writing an invented headline about a real company on a real date, next to its
real chart, is fabricated financial news — so I did not.

**EDITOR** · `beat=5`.

**VO**

Two hundred and ninety-four of three hundred directions read as written.

And now the thing this demo was actually built to show.

**EDITOR** · Two groups of forty, side by side:

```
40 headlines followed by a 6% move
40 headlines followed by nothing
GRADED WITHIN 0.1 OF A POINT OF EACH OTHER
```

**VO**

Forty headlines were placed in front of a real six per cent move. Forty equally dramatic ones were
placed in front of absolutely nothing. Both sets are written from the same templates.

It graded them within a tenth of a point of each other.

### PUNCH

Which is the demo working, not failing. The words do not know what happens next — and neither does
anybody reading them. A model that could tell those forty from the other forty would be evidence of a
leak, not of intelligence.

---

## ▸ 173 — FILINGS AND CALLS
**Slug:** `filings-read` · **90 items** · **Target 1:30**

**EDITOR** · A dense filing scrolls. Sections light up as the VO names them.

**VO**

Ninety invented documents: results releases, risk-factor sections and call excerpts.

Guidance read correctly: ninety out of ninety.

**EDITOR** · Now the buried-risk comparison:

```
New risk near the top of the list    8 of 8
New risk buried two thirds down      9 of 9
```

**VO**

I built this expecting position to matter. Nine risks were buried two-thirds of the way down a list
of sixteen; eight were put near the top.

It found all of both.

### PUNCH

I designed a trap, documented the trap, and the trap did nothing. Which goes in the video, because
that is what the numbers said.

**EDITOR** · Then the correction story, briefly:

**VO**

One more thing. The first run scored eighty-four of ninety on guidance, and one of those six was
worth reading: a release saying guidance was "reduced to" a range that was *above* the range printed
directly beneath it.

The model called it a raise. It was right. My generator was building the new range from the wrong
quarter.

### PUNCH

All six errors were mine. Second time the benchmark lost an argument with the subject.

---

## ▸ 175 — RUMOUR GRADING
**Slug:** `rumour-grading` · **240 items** · **Target 1:30**

**EDITOR** · Sources appear: an anonymous account, a newsletter, a filing-reader, a forum.

**VO**

Two hundred and forty claims. Twenty-two later confirmed, thirty-eight later denied, and a hundred
and eighty that never resolved either way — which is what rumours mostly do.

Fourteen are coordinated pushes: dozens of accounts, the same sentence, inside half an hour.

And twelve more travelled just as far and just as fast in people's own words.

**EDITOR** · Show that reach and speed overlap between the two groups, and only wording separates
them.

**VO**

Reach and speed are identical between those two groups by construction. The only thing that can tell
them apart is how much of the wording is shared.

Fourteen of fourteen pushes caught. One false alarm out of twelve organic crowds.

### PUNCH

"Trust me bro" remains the internet's most widely deployed citation standard — and, it turns out, one
of the easiest to detect, because forty people never say it in quite the same words unless they were
told to.

---

## ▸ 172 — EVENT CLUSTERING
**Slug:** `event-clustering` · **380 items** · **Target 1:00**

**EDITOR** · Dozens of headlines fly in and collapse into a much smaller number of clusters.

**VO**

Twenty articles may describe twenty events, or one event twenty times.

Three hundred and eighty headlines became forty-six clusters. Three hundred and seventy-five of the
three hundred and eighty readings correct on all three parts at once.

**EDITOR** · Big number: `94.5 READING MINUTES SAVED`.

**VO**

Ninety-four and a half reading minutes saved, once you count the joined headlines that add a fact as
still needing to be read.

### PUNCH

The financial internet has discovered an efficient content strategy: publish the same news until it
becomes a trend.

---

## ★ 174 — ENTITY LINKS  💬
**Slug:** `entity-links` · **400 items** · **Target 2:20**

**EDITOR** · `beat=2`: the graph. People, companies, subsidiaries, contracts. Let it build, then pull
back until the shape is visible.

**VO**

Four hundred relationships across documents. Do these separate references belong to connected
entities?

Four hundred out of four hundred.

**EDITOR** · Hold, then **THE RULE**: `look for the stock phrase — 400 of 400`.

**VO**

Which, I have to tell you, is because each relationship type is written in its own stock sentence. A
phrase-matcher gets the same four hundred.

**EDITOR** · Now the genuinely interesting part. Animate two-step chains forming across the graph.

**VO**

But the second half of this one is worth more than the first.

Two hundred and seventy-nine answered edges produce two thousand and thirty-eight directed two-step
paths, once shared auditors and litigation are excluded as channels.

Six chains were planted. The ranking puts the strongest first.

### PUNCH

Corporate structures are graphs designed by people who appear to dislike graphs.

### 💬 COMMENT PROMPT

---

### TRANSITION — News to Strategy

**VO**

And finally, the dangerous moment where evidence becomes a trading rule.

---

# PART 10 — DOMAIN 9: STRATEGY RESEARCH
**Runtime 01:26:00 – 01:38:00 · five demos**

> **Editor note.** This is the domain where the model loses, twice, badly and on purpose. Do not
> soften it with music. The failures are the reason the chapter exists.

---

## ★ 181 — GOLDEN CROSS REVIEW
**Slug:** `golden-cross-review` · **71 items** · **Target 2:30**

### BEAT 1

**EDITOR** · `beat=1`. Then the code panel — this demo shows the detector first. Zoom on it.

```
GOLDEN CROSS: LEGENDARY
OBSERVATIONS IN SIX YEARS: 71
```

**VO**

The golden cross. Fifty-day average crossing the two-hundred-day.

Not a sample, not a selection — every single one the rule found in six years of cached bars across
sixteen instruments. Seventy-one of them.

The question is not whether the rule works. It is whether this particular cross, on this chart,
deserves the trade.

### BEAT 5

**EDITOR** · Two equity curves on the same axes. Let both run to the end.

**VO**

Take all seventy-one crosses: up fourteen point seven seven per cent.

Take only the forty-nine the model kept: up four point seven four.

**EDITOR** · Hold. Then:

```
WHAT THE JUDGEMENT WAS WORTH: −10.04 points
```

**VO**

So the filter lost money. Per trade, a tenth of a per cent against two tenths.

### PUNCH

We successfully applied artificial intelligence and got less than we would have by not applying it.

### THE NUANCE — do not cut this

**VO**

But the same answers contain something better. Filter instead on the quality score at the midpoint of
its own scale, and you get twenty-two per cent.

**EDITOR** · Three bars: `take everything 14.77% · take what it kept 4.74% · take score ≥ 3  22.21%`.

**VO**

And before anybody screenshots that: five Bitcoin crosses contribute more than forty points to a book
that totals fifteen. Remove them and every version of this is negative and the differences vanish
inside the noise. One trade varies by about seven points. The whole average is only known to within
about one.

### PUNCH

Which is the most important sentence in this chapter. The number that looks like an edge is inside
the error bar, and I am telling you that instead of putting it on the thumbnail.

---

## ▸ 182 — SETUP TIMING
**Slug:** `setup-timing` · **480 items** · **Target 1:10**

**EDITOR** · The same chart pattern appears at four different moments: too early, on time, extended,
already failed.

**VO**

A pattern can be valid and the timing still terrible.

Four hundred and eighty setups. Favourable call matched the five-bar direction fifty-two point one
per cent of the time.

**EDITOR** · Put the three numbers up together:

```
JEV                                     52.1%
"favourable if long, unfavourable if short"   56.0%
A COIN                                  50.0%
```

**VO**

A rule that says "favourable if it is a long, unfavourable if it is a short" scores fifty-six with no
model at all. And that is roughly what the model did — it called sixty-six per cent of longs
favourable and thirteen per cent of shorts.

### PUNCH

It found the rule. It then applied the rule slightly worse than the rule does.

---

## ★★ 183 — REGIME CLASSIFICATION  💬
**Slug:** `regime-classification` · **312 items** · **Target 4:00**

> **The centrepiece failure of the film.** Budget four minutes and let the silences sit.

### BEAT 1

**EDITOR** · `beat=1`. A market timeline colour-coded by regime: trend up, trend down, range, high
volatility, event driven.

**VO**

Three hundred and twelve weeks. Four instruments. One week at a time, judged only on the bars up to
that week's close.

Name the regime, then decide which kind of strategy is allowed to trade in it.

Then three shipped strategies run twice over exactly the same bars, with exactly the same costs. The
only difference is whether the week's answer let them in.

### BEAT 5 — the number

**EDITOR** · Two equity curves. Let the always-on curve climb. Let the gated one crawl.

**VO**

Strategies always on: up eighty-two point zero eight per cent.

Strategies gated by the model's weekly call: up two point nine three.

**EDITOR** · Silence. Three full seconds. Then, on black:

```
WHAT THE GATE WAS WORTH
−79.15 POINTS
```

### PUNCH

We successfully used artificial intelligence to diversify away from profits.

### THE MECHANISM — this is why the scene is four minutes

**EDITOR** · Break it down by strategy:

```
Twenty-day range break   +49.69%  →  gated:  0.00%   (0 of 55 trades allowed)
Pullback to the fifty    +28.90%  →  gated: +1.97%   (8 of 17 allowed)
Fifty over two hundred    +3.49%  →  gated: +0.96%   (1 of 3 allowed)
```

**VO**

But the mechanism matters more than the number.

The range-break strategy is seventy-three per cent of the trades in this book. And "breakout" was the
answer in two weeks out of three hundred and twelve.

**EDITOR** · Animate it: the range-break strategy knocking on a door marked with the regime gate.
`CLOSED.` Fifty-five times.

**VO**

So the strategy that does three-quarters of the trading was switched off for the entire period, by an
answer the model almost never gives.

### PUNCH

The strategy was not badly timed. It was denied entry to the building. Fifty-five times.

### THE HONEST FOOTNOTE — include it

**VO**

Two things I have to tell you about this chart.

The first version of this test had a look-ahead bug. It gated each trade using the call for the week
the trade was entered in — and that call is made from bars up to that week's close, which is up to
four sessions after the entry. Fifty-nine of seventy-six trades were decided by an answer that had
already seen the future.

Fixed, it reads worse, and this is the fixed one.

The second: the obvious way to improve this number is to relabel the range break as trend following,
which is arguably what it is. That would hand most of the trades back and the gate would look far
better.

### PUNCH

Which is precisely the mistake this entire domain exists to warn about, so the label stands as it was
written.

### 💬 COMMENT PROMPT

---

## ★ 185 — STRATEGY CORRELATION  💬
**Slug:** `strategy-correlation` · **60 items** · **Target 2:30**

### BEAT 1–2

**EDITOR** · `beat=2`: two strategy equity curves on one pair of axes, with a shaded stress window.

**VO**

Twelve strategies, sixty pairs, three years of daily results each. Is a book of five strategies five
bets, or one bet wearing five names?

No correlation is in the state. Both daily series are, in full — seven hundred and fifty-six numbers
each — and reading them is the job.

### BEAT 5

**VO**

Forty-seven of sixty pairs read correctly. Answering "two bets" every time scores forty-eight.

**EDITOR** · Hold that. Then **THE RULE**:

```
THE RULE
correlate the two series · one bet at 0.5 or above
56 of 60
```

**VO**

And correlating the two series — which is one line of arithmetic — gets fifty-six.

### THE PART THAT MATTERS

**EDITOR** · Now the three stress pairs, with calm and stress correlation side by side:

```
                                  CALM      STRESS
Short vol + sector pairs          0.005     0.517
Short vol + index rebalance      −0.012     0.809
Credit spread + seasonal energy   0.003     0.715
```

**VO**

Three pairs sit at essentially zero correlation for three years, then move hard together in one
forty-session window.

All three were read as diversifying.

**EDITOR** · Then, importantly:

**VO**

And so were they by the arithmetic. Whole-period correlation hides all three, because over three
years they genuinely are uncorrelated. The rule that beat the model at everything else misses these
completely.

### PUNCH

These are the pairs a book finds out about on the worst day it has. Neither the model nor the maths
saw them coming, which is the only time in this video they have agreed on anything.

**EDITOR** · Final card for the scene:

```
EFFECTIVE NUMBER OF BETS
3.92 OF 12
```

**VO**

Across the whole book: twelve strategies, an effective three point nine two bets.

### PUNCH

Diversification is not improved by giving the same trade five different names.

### 💬 COMMENT PROMPT

---

## ▸ 184 — OVERFIT REVIEW
**Slug:** `overfit-review` · **140 items** · **Target 1:15**

**EDITOR** · A backtest report card:

```
SHARPE: 4.8
PARAMETERS TESTED: 18,492
SAMPLE: 61 trades
```

**VO**

A hundred and forty research reports. Read the evidence and say what is wrong with it: too many
trials, a tiny sample, too many parameters, weak out-of-sample.

A hundred and thirty-eight of a hundred and forty symptoms named exactly.

**EDITOR** · **THE RULE**: `read five stated fields in order — 140 of 140`.

**VO**

And a six-line rule over those same stated fields gets all hundred and forty, because the symptom is
written in the report.

### PUNCH

If you test enough strategies, statistics eventually sends you a congratulations email. This demo
reads the email. It does not have to be clever to do it.

---

# PART 11 — WHAT FIFTY DEMOS ACTUALLY TAUGHT ME
**Runtime 01:38:00 – 01:50:00**

> Five meta scenes. No new demos. This is where the film stops describing and starts arguing.

---

## Scene M1 — The rule keeps winning
**Target 3:00 · this is the honest centre of the film**

### EDITOR

Bring back every **THE RULE** card from the whole film, flying in one at a time and stacking into a
grid. There are a lot of them. Let it become uncomfortable.

```
delivery exceptions   rule 250/250   jev 250/250
execution quality     rule 260/260   jev 217/260
wallet risk           rule 237/240   jev 169/240
mixer tracing         rule  90/90    jev  66/90
token screening       rule 160/160   jev 151/160
trader behaviour      rule 120/120   jev 116/120
journal vs reality    rule 200/200   jev 187/200
post-trade review     rule 220/220   jev 198/220
three-way match       rule 150/150   jev 134/150
entity links          rule 400/400   jev 400/400
income planning       rule  40/40    jev  40/40
overfit review        rule 140/140   jev 138/140
```

### VO

Here is the result I did not expect, and the one I would have quietly dropped if this were a sales
deck.

On a large number of these datasets, a short rule beats the model. Not marginally. Completely.

Five lines over the order type and the timestamps name every execution fault. A path walk gets every
taint call. One threshold per wallet type names every wallet.

### PUNCH

I set out to benchmark a language model and accidentally benchmarked the if-statement, which is
currently undefeated in about a dozen chapters.

### VO — the actual explanation, and it matters

Now, why.

Almost every one of those datasets was generated by me, from a rule. I planted the patterns with
logic, so the answers are a function of a few fields — and anything that can read those fields
recovers them.

That is not the model being weak. It is my synthetic data being solvable.

### EDITOR

Split the grid in two, on screen:

```
WHERE A RULE WINS          WHERE IT CANNOT
generated from a rule      real prices
few fields decide it       prose in the notes
answer is arithmetic       stress windows
                           the question itself is the variable
```

### VO

So the honest reading is this. Where I could write the answer as a rule, a rule wins, and you should
use the rule — it is cheaper, faster and auditable.

The demos where a rule cannot follow are the ones with real prices, prose that has to be read, or a
judgement about what to do next. Card fraud triage. The AML score. The accounting notes. The stress
pairs in the correlation book.

### PUNCH

Which is a much smaller claim than the thumbnails make. It is also the only one I can defend with a
repository.

---

## Scene M2 — Ranking beats deciding
**Target 2:30**

### EDITOR

Two columns, built as the VO names each example:

```
RANK                            YES / NO
AML: 19 alerts hold all 12      AML: 80 alerts hold the same 12
Card fraud: 13 of 16 in top 50  Accounting: 51 clean years held
Accounting: 1.2-point gap       Sybil: excluded nobody at all
Portfolio health: clean split   Golden cross: filter lost money
```

### VO

The single pattern that repeats most often across all fifty is this.

The same model, on the same data, is far more useful when asked to order things than when asked to
decide them.

Ask AML to escalate and you get eighty alerts. Ask it for a score and cut the score, and you get
nineteen, holding the same twelve.

Ask accounting flags yes-or-no and it holds up fifty-one clean companies. Rank by severity and the
planted years sit more than a point above the clean ones.

Ask the golden cross take-or-leave and the filter loses money. Use its own quality score and it does
not.

### PUNCH

Reality prefers nuance. Extremely inconvenient for a database column that only holds true or false.

---

## Scene M3 — The question is a variable
**Target 2:00**

### EDITOR

The accounting-flags rewrite, shown as a before and after on screen.

```
BEFORE
"Should this year go to somebody?"
→ yes, 110 times out of 110

AFTER
"Hold up the sign-off only where somebody relying
 on these numbers would be materially misled."
→ 51 of 73 clean years held
```

### VO

This is the one finding I would take to another project tomorrow.

The wording of the question changes the result more than most model choices do.

A question with no threshold in it does not measure the model. It measures how cautious the model is
willing to be, which is very.

### EDITOR

**DAVE'S QUEUE** spikes dramatically, then drops.

### PUNCH

Congratulations. Without a threshold we had built the world's most sophisticated forwarding system.

---

## Scene M4 — When the benchmark is the bug
**Target 1:30**

### EDITOR

Three cards, each with the correction:

```
LEDGER      68 of 75 false alarms were one real data bug
FILINGS     all 6 guidance errors were a generator bug
MISSED      9 label errors: the labels disagreed with my own policy
```

### VO

Three times in fifty demos, the model was marked wrong and the model was right.

The ledger VAT objections. The filing that said "reduced to" above the previous range. The nine
skipped trades where my labels contradicted my own written policy.

### PUNCH

Benchmarking is the unusual scientific discipline in which the experiment occasionally gets peer
reviewed by the subject.

### VO

Every one of those corrections is in the repository with the commit that made it. That is the point
of publishing the thing.

---

## Scene M5 — What it cost
**Target 1:30**

### EDITOR

A token counter spins up, then settles. Then the receipt.

```
44,909 typed answers
9,347 items
regime classification alone: 1,151,794 input tokens
```

### VO

Some of these were not cheap. The regime-classification run alone — the one that lost seventy-nine
points — used more than a million input tokens to do it.

### PUNCH

Research finding number fifty-one: thinking at scale arrives with an invoice.

### EDITOR

**SUBSCRIBE PROMPT 3** at 01:44:00.

---

## Scene M6 — The failures stayed in
**Target 1:30**

### EDITOR

Cards for each kept failure, laid out plainly, no jokes on screen:

```
REGIME GATE          −79.15 points
ACCOUNTING BINARY    below the do-nothing baseline
SYBIL EXCLUSION      excluded nobody
GOLDEN CROSS FILTER  worse than taking everything
SETUP TIMING         worse than one line of logic
SANCTIONS            deferred almost everything
```

### VO

And these all stayed in.

The strategy gate that destroyed the returns. The accounting decision that scored below switching the
model off. The Sybil demo that excluded nobody. The golden cross filter that cost money.

They are on the site, with the numbers, next to the ones that worked.

### PUNCH

If every experiment in your benchmark succeeds, you have not built a benchmark. You have built a
sales deck with a git history.

---

# PART 12 — FINALE
**Runtime 01:50:00 – 01:56:00**

---

## Scene F1 — Fifty jobs, eight decisions
**Target 2:00**

### EDITOR

All fifty demo cards shrink into a grid. Then they reorganise — not by domain, but by the kind of
decision underneath:

```
CLASSIFY    RANK    ROUTE    SCREEN
ESCALATE    COMPARE REVIEW   GATE
```

### VO

These look like fifty different financial problems. Underneath, they are about eight.

What is this? How risky is it? Which one matters first? Does it fit the rules? Does it conflict with
something? Should the automation carry on? Should a person look at it?

And how sure are we?

### VO

That last one turned out to matter most. In portfolio health, the confidence number separated every
right answer from every wrong one with no overlap at all. That is worth more than the accuracy score
above it.

### PUNCH

Which is a strange thing to discover: the most useful output was not the answer. It was the number
next to the answer.

---

## Scene F2 — Where should this actually be trusted
**Target 2:00**

### EDITOR

Plain text on black. No animation. This is the only scene with no graphics.

### VO

So: where should a model like this be trusted?

Not where a rule already works. A rule is cheaper, faster, auditable, and in about a dozen chapters
of this video, better.

Not as a final yes or no on anything expensive. Every time I asked for one, it escalated.

But putting four hundred alerts in the right order so the fifty a human opens are the right fifty —
that is real, it is measurable, and it moved seven frauds from unreachable to the top of the queue.

Reading prose that a rule cannot follow. Grading evidence. Noticing that two flat lines moved
together for forty days.

And telling you when it does not know.

### PUNCH

Which is a much less exciting sentence than "Jev drives a Tesla", and about forty-nine demos more
defensible.

---

## Scene F3 — The final payoff
**Target 1:30**

### EDITOR

The full architecture builds upward:

```
DATA
 ↓
RULES
 ↓
ALGORITHMS
 ↓
JEV
 ↓
HUMAN REVIEW
```

Dave receives the final item. **DAVE'S QUEUE: ∞**. Everything freezes. Then Excel rises slowly behind
the whole stack.

### VO

After fifty demos, nine thousand items, forty-four thousand typed answers, several million tokens and
three separate occasions where the model was right and I was wrong —

we arrive at the only conclusion that matters.

### Pause.

Can it replace Excel?

### EDITOR

Excel fills the entire screen.

### VO

Of course not.

Nobody replaces Excel.

### EDITOR

```
EXCEL
FINAL BOSS
UNDEFEATED
```

Cut to black.

---

## Scene F4 — Outro
**Target 0:40**

### EDITOR

Site on screen, then the repo, then the chapter list one more time.

### VO

Everything here is at jev dot thefintechbuilder dot com. The repository is linked from every page,
from the GitHub mark at the top.

Clone it. Change a dataset you think is too easy — several of them are, and I have told you which.
Re-run it and tell me I was wrong.

If you want a single demo pulled apart properly, the comments are the place. There are six I already
know deserve their own video.

### PUNCH

And if you made it this far in one sitting, you have watched two hours of somebody grading a language
model on bookkeeping. Subscribe. We are clearly the same kind of person.

---

# APPENDIX A — YOUTUBE CHAPTER LIST

Paste directly into the description. Times are targets; adjust after the edit locks.

```
00:00  The fake demos problem
01:40  What is NOT in this video
02:50  Verifiable, or it did not happen
04:20  How to survive the next two hours
05:40  The shape of every demo
06:30  What a typed answer is

07:30  BOOKS AND RECONCILIATION
07:30  101 Ledger integrity — the benchmark gets audited
11:00  102 Bank reconciliation
12:10  103 Expense posting — the open-book problem
13:15  104 Three-way match
14:30  105 Close blockers

20:00  ORDERS AND CUSTOMERS
20:00  111 Order risk at checkout
21:50  112 COD abuse
22:50  113 Dispute routing
23:55  114 Chargeback evidence
24:55  115 Merchant onboarding
26:25  116 Delivery exceptions

29:30  FRAUD AND FINANCIAL CRIME
29:30  121 Card fraud triage — the best demo here
33:30  123 AML alert triage — score beats choice
36:45  122 Account takeover
38:00  124 Sanctions name matching
39:20  126 Insider surveillance
40:25  125 Mule networks

42:00  CRYPTO AND ON-CHAIN
42:00  131 Wallet risk — beaten by an if-statement
44:40  132 Wallet profiling
45:35  133 Mixer tracing
46:50  134 Token screening
47:50  135 Sybil clusters — excluded nobody

50:30  PORTFOLIO
50:30  141 Portfolio health — the confidence result
53:00  142 Portfolio compare
53:50  143 Rebalance review
55:05  145 Mandate compliance
56:05  144 Factor exposure
57:00  146 Income planning

58:30  TRADES AND EXECUTION
58:30  151 Post-trade review
59:35  152 Trade feature analysis — the interval problem
60:55  154 Trader behaviour
61:50  156 Missed trades
63:05  153 Execution quality
65:05  155 Journal vs reality

68:00  SCREENING AND FUNDAMENTALS
68:00  161 Goal screening
69:20  162 Fundamental read
70:15  163 Sharia screen
72:25  165 Accounting flags — ranking vs deciding
75:25  164 Dividend safety
76:20  166 Peer valuation

77:30  NEWS, FILINGS AND LINKS
77:30  171 News impact — the demo working by failing
79:10  173 Filings and calls
80:40  175 Rumour grading
82:10  172 Event clustering
83:10  174 Entity links

86:00  STRATEGY RESEARCH
86:00  181 Golden cross review
88:30  182 Setup timing
89:40  183 Regime classification — minus 79 points
93:40  185 Strategy correlation
96:10  184 Overfit review

98:00  WHAT FIFTY DEMOS TAUGHT ME
98:00  The rule keeps winning
101:00 Ranking beats deciding
103:30 The question is a variable
105:30 When the benchmark is the bug
107:00 What it cost
108:30 The failures stayed in

110:00 FINALE
110:00 Fifty jobs, eight decisions
112:00 Where should this be trusted
114:00 The final payoff
115:30 Outro
```

---

# APPENDIX B — LOWER-THIRD COPY BANK

Use sparingly. One per scene at most.

| When | Copy |
|---|---|
| Jev is exactly right | Annoyingly competent. |
| Jev is wrong | There we go. Research. |
| The dataset caused it | Plot twist: the benchmark was the bug. |
| Everything escalates | Artificial intelligence has rediscovered bureaucracy. |
| A graph gets huge | The part of finance where circles and arrows become evidence. |
| Rules conflict | Every rule working perfectly. Together: chaos. |
| A portfolio looks diversified | Different tickers. Same personality. |
| A backtest looks too good | Please step away from the configurator. |
| Real data is messy | Reality has failed validation. |
| Synthetic data is clean | Suspiciously cooperative data detected. |
| Jev returns uncertainty | It has learned the phrase analysts use most. |
| A rule beats the model | The if-statement remains undefeated. |
| A number is inside its error bar | That is a shape, not a signal. |

---

# APPENDIX C — FACT CHECK SHEET

Every claim in this script traces to a committed run. Before final render, re-verify against the live
scoreboard at `https://jev.thefintechbuilder.com/benchmark`, because re-recording a demo changes
these.

| Claim in VO | Where to check |
|---|---|
| 50 demos, 9,347 items, 44,909 answers | `/benchmark` summary |
| Ledger: 68 of 75 false alarms are the VAT objection | `/demos/ledger-integrity` report |
| Card fraud: 6 of 16 → 13 of 16 in the top fifty | `/demos/card-fraud-triage` report |
| AML: 80 alerts by choice vs 19 by score | `/demos/aml-alert-triage` report |
| Portfolio health: every answer ≥50% right, every one below wrong | `/demos/portfolio-health` report |
| Accounting flags: 48 of 120 vs 73 for doing nothing | `/demos/accounting-flags` report |
| Regime gate: +82.08% vs +2.93%, −79.15 points | `/demos/regime-classification` notes |
| Golden cross: 14.77% / 4.74% / 22.21%, BTC caveat | `/demos/golden-cross-review` notes |
| Correlation: 3.92 effective bets of 12 | `/demos/strategy-correlation` report |
| Every "THE RULE" figure | each demo's baseline row on `/benchmark` |

**One thing the editor must not do:** do not round a number up to make a beat land. If a figure is
awkward, change the sentence.

---

# APPENDIX D — WHAT IS NOT IN THIS FILM

For the pinned comment, and so nobody accuses the video of hiding it.

- **The backtest lab is not on the site.** It exists in the repository and needs a local server and
  an API key to run. It was removed from the published site deliberately. If the film mentions it at
  all, say that plainly — do not show a link that redirects.
- **One model version.** Everything is `jev-1.13.0`, recorded 18–19 September 2026. No comparison
  against other models is claimed anywhere.
- **Small samples.** Several demos have fewer than fifty items. Where an interval is quoted, quote it.
- **Mostly synthetic data.** 18 of the 50 use cached real market data. The rest are generated, which
  is exactly why a rule can win on so many of them.

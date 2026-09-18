# Jev Under Test: Full Suite Video

**Production package: voice-over script, screen-recording plan and editor notes**

| | |
|---|---|
| **Status** | Ready for production · version 1.0 · Sep 17, 2026 |
| **Source run** | `suite-2026-09-17T12-06-53-944Z`, Full suite (NVDA, JPM, XOM, BTC-USD, GLD), 300 decisions, model `jev-1.13.0` |
| **Supporting runs** | Pilot (AAPL, 12 decisions) and Pilot with indicators (AAPL, 12 decisions) |
| **Dashboard** | Jev Backtest Lab, running locally at `http://127.0.0.1:3000` |
| **Main cut** | 15:50, 16:9, 1920×1080 |
| **Social cutdowns** | 2:15 for X (16:9) and 0:60 vertical (9:16) |
| **Footage rule** | Everything on screen is the real dashboard and its built-in animations. No stock footage and no mocked charts. |

## Contents

1. [The video on one page](#1-the-video-on-one-page)
2. [Before recording](#2-before-recording)
3. [Run of show](#3-run-of-show)
4. [Shot-by-shot script](#4-shot-by-shot-script)
5. [Clean narration script](#5-clean-narration-script)
6. [Contradictions briefing](#6-contradictions-briefing)
7. [Fact sheet](#7-fact-sheet)
8. [Recording checklist](#8-recording-checklist)
9. [Edit guide](#9-edit-guide)
10. [Social cutdowns](#10-social-cutdowns)
11. [Accuracy and compliance](#11-accuracy-and-compliance)
- [Appendix A. The 15 questions](#appendix-a-the-15-questions)
- [Appendix B. What Jev receives](#appendix-b-what-jev-receives)
- [Appendix C. Screens and animations](#appendix-c-screens-and-animations)
- [Appendix D. URL sheet](#appendix-d-url-sheet)

---

## 1. The video on one page

### Working titles

- *I gave an AI model 300 trading decisions. Its answers argued with each other.*
- *300 decisions, 46 trades: stress-testing TypeSafe's Jev*
- *Watching Jev trade, one decision at a time*

### Logline

A backtest lab replays each of the 300 decisions Jev made on two years of daily candles for NVIDIA, JPMorgan, Exxon, Bitcoin and gold. Then it looks closely at the answers that contradict each other.

### Audience and tone

- **Audience:** builders, quants and AI engineers on X and YouTube. They know what a backtest is but don't need to know TypeSafe.
- **Tone:** curious, precise and fair. The video tests the model's judgment; it doesn't sell the model or dunk on it. Every number on screen comes from the run.
- **Narrator:** the channel host, speaking in the first person ("I built…"). If a team voices it, switch to "we".

### Five things the viewer should leave with

1. **Every answer can be inspected.** Jev returns typed, probabilistic answers, and each decision can be checked down to the probability.
2. **Jev is very cautious.** It stayed flat on 254 of 300 decisions (85%).
3. **Its trades roughly broke even on hit rate.** It made 46 trades, won 50% and made +3.82% net (+$382). Buying at every cutoff made +$17,783 over the same period.
4. **Its answers often contradict its decision.** All 16 shorts came with a plan whose entry, take-profit and holding-period answers were "Not applicable". The shorts that had no stop produced both the best trade and the three worst trades.
5. **Confidence didn't rank trades.** Higher-confidence trades did worse, and the answers look almost the same for winners and losers.

### Chapters

| # | Chapter | Time | Built-in animation that carries it |
|---|---|---|---|
| C0 | Cold open | 00:00–00:35 | Fast replay: dots filling in and the scoreboard ticking |
| C1 | What Jev returns | 00:35–01:50 | Decision drawer slides in; probability bars |
| C2 | The lab and the rules | 01:50–03:25 | Preset cards, live estimate, approval dialog |
| C3 | One decision, start to finish | 03:25–05:05 | Theater: reads → decides → trade plays out → scored |
| C4 | All 300 decisions | 05:05–06:35 | Theater at 8×: timeline, scoreboard, P&L curve |
| C5 | The report | 06:35–08:35 | Chart crosshair tooltips, symbol table, confidence columns |
| C6 | The contradictions | 08:35–12:35 | Contradiction checks, worst and best trades replayed, drawer answers |
| C7 | When Jev stays flat | 12:35–13:40 | No-trade replay: the move it sat out |
| C8 | The indicators pilot | 13:40–14:30 | Compare page and agreement matrix |
| C9 | Verdict and next steps | 14:30–15:50 | Final scoreboard, end card |

### Pronunciation

| Written | Say |
|---|---|
| Jev | "Jev" (rhymes with "rev"). Confirm with TypeSafe before recording. |
| TypeSafe | "type safe" |
| NVDA / JPM / XOM | "NVIDIA" / "JPMorgan" / "Exxon" |
| BTC-USD | "Bitcoin" |
| GLD | "G-L-D", or "the gold ETF" |
| AAPL | "Apple" |
| bps | "basis points" |
| jev-1.13.0 | "Jev one point thirteen" |

---

## 2. Before recording

### 2.1 Dashboard

- **Start the server.** In the project folder run `npm start`, then open `http://127.0.0.1:3000`. The server only accepts connections from the same computer, so record on the machine that runs it.
- **Record the production build.** Don't use `npm run dev:web`. The current build is up to date; if the interface changes, run `npm run build` before recording.
- **Check the starting state.** The Backtests page must list three runs: **Full suite**, **Pilot** and **Pilot with indicators**, and the sidebar count must show **3**.
- **Record the Compare page (C8) before any live run** (2.6). A new run changes the page's default selection.

Throughout this document, `SUITE` stands for:

```
http://127.0.0.1:3000/runs/suite-2026-09-17T12-06-53-944Z
```

For example, `SUITE/theater?at=28`. Full URLs are in [Appendix D](#appendix-d-url-sheet).

### 2.2 Browser and screen

- **Browser.** Use Microsoft Edge or Chrome with a clean profile: no extensions, no bookmarks bar, zoom at 100%.
- **Screen size.** Record full screen (F11) so the page gets a 1920×1080 viewport. On a 4K monitor, set Windows display scaling to 200% and record at 3840×2160. The page still lays out at 1920×1080, so every framing note below still applies, and the editor can zoom in to 200% without losing sharpness.
- **Animations must be on.** In Windows, go to Settings → Accessibility → Visual effects and turn **Animation effects** on. If it's off, the browser asks for reduced motion and the dashboard switches off its own animations: candles appear instantly and the drawer doesn't slide in.
- **Quiet screen.** Turn on Do not disturb, and hide the taskbar and desktop icons.
- **Cursor.** Move it slowly and deliberately. Keep it off the chart during replays, because hovering a chart draws a crosshair and a price tooltip. If the recorder offers a subtle cursor highlight, turn it on.
- **Never show secrets.** Don't open `.env`, a terminal, the TypeSafe console or any email on camera. The API key must never appear.

### 2.3 Recorder settings

| Setting | Value |
|---|---|
| Canvas / output | 1920×1080 (or 3840×2160 with 200% scaling) |
| Frame rate | 60 fps |
| Quality | CQP/CRF 16–18, visually lossless |
| Container | MKV while recording, then remux to MP4 |
| Clips | One clip per shot ID, with 2 seconds of handle before and after |
| Takes | At least two takes of every animated shot |
| File names | `S30-theater-nvda45-1x-take1.mp4` (shot, page, subject, speed, take) |

### 2.4 How the Theater replay works

Read this before recording anything on the Theater tab.

Each decision plays in four steps, shown as chips above the chart: **Reads the bars → Decides → Trade plays out → Scored**.

- **Reads the bars:** the decision card shows a shimmering placeholder and the text "90 daily NVDA bars up to the close of …".
- **Decides:** the card slides in with the action, confidence, the market reads and the plan.
- **Trade plays out:** the eight hidden bars rise in one at a time. On the first bar, the entry dot and the stop and target lines appear with their price tags. When the trade exits, the exit dot and the result label fade in.
- **Scored:** the result card turns final and the Scored chip lights up.

**Step timing at 1×:** reading 0.9 s, deciding 1.3 s, trade plays out 2.24 s (8 bars × 0.28 s), scored 1.7 s, for **6.14 s per decision**.

| Speed | One decision | 12 decisions | 60 decisions | All 300 |
|---|---|---|---|---|
| 1× | 6.1 s | 1m 14s | 6m 08s | 30m 42s |
| 2× | 3.1 s | 37 s | 3m 04s | 15m 21s |
| 4× | 1.5 s | 18 s | 1m 32s | 7m 40s |
| 8× | 0.77 s | 9 s | 46 s | 3m 50s |

**Controls**

- **Space** plays and pauses, as long as keyboard focus isn't on a button.
- **→ and ←** move to the next or previous decision.
- The **1× 2× 4× 8×** buttons set the speed, the slider scrubs, and clicking a dot under **Every decision** jumps to that decision.
- `?at=N` in the URL opens decision N already played out and paused.
- When **paused**, jumping (arrow, dot or slider) shows the finished decision straight away, with no animation. When **playing**, a jump starts that decision from "Reads the bars".
- Symbols replay in this order: NVDA #1–60, JPM #61–120, XOM #121–180, BTC-USD #181–240, GLD #241–300.

**Recipe A: animate one decision N from the start.** Used for S13–S17, S30, S32 and S39.

1. Type `SUITE/theater?at=` followed by N − 1 in the address bar and press Enter. This reloads the page and resets the replay.
2. Frame the shot (usually T1, below).
3. Click the speed you want (1× is the default). Then click once on an empty part of the page, such as the space beside the date above the chart, so keyboard focus leaves the speed buttons.
4. Press **Space**, then immediately **→**. Decision N starts at "Reads the bars".
5. When the **Scored** chip lights up, press **Space** to pause. At 1× this window lasts 1.7 seconds.
6. The editor trims everything before decision N's first frame.

**Recipe B: fast replay of the whole run.** Used for S01 and S18–S22.

1. Load `SUITE/theater`. It opens on decision #1, paused.
2. Frame the shot (T2), click **8×**, then click an empty part of the page.
3. Press **Space** and record until the status reads **Replay finished** (about 3m 50s).

**Recipe C: a finished decision, paused.** Used for stills and slow zooms. Load `SUITE/theater?at=N`.

### 2.5 Framing presets at 1920×1080

The top bar stays pinned (the first 80 px), and the Theater's playback bar stays pinned 16 px above the bottom edge. Positions are in page pixels at 100% zoom.

| Preset | Page | How to frame | What's in view |
|---|---|---|---|
| **T1** | Theater | Scroll until the Theater / Report / Decisions tabs just slide under the top bar (about 240 px down). | Chart and decision card (104–826), playback bar (850–928), and the "Every decision" title peeking in at the bottom. The editor may crop the bottom strip. |
| **T2** | Theater | Scroll to the very bottom. | The bottom of the chart legend, the playback bar, all 300 decision dots, the scoreboard and "Cumulative P&L so far". |
| **R1** | Report | No scroll. | Run title and facts, tabs, the six headline numbers, the Cumulative P&L chart. |
| **R2** | Report | Scroll until "Results by symbol" sits just under the top bar. | Results by symbol, How the trades ended, Confidence and results. |
| **R3** | Report | Scroll until "Contradictions to report to the Jev team" sits under the top bar, then scroll slowly. | The contradictions panel. At 1,040 px it's slightly taller than the screen, so allow 8–10 seconds to scroll through it. |
| **R4** | Report | Scroll to the very bottom. | When Jev stayed flat, and Answers behind winning and losing trades. |
| **D1** | Decisions | No scroll. | The Symbol and Outcome filters, and the first ten rows of the table. |
| **D2** | Any tab with the drawer open | Scroll inside the drawer, which is 820 px wide on the right. | Drawer groups: Decision, Market read, Setup quality, Trade plan, Request. |
| **B1** | Backtests | No scroll; scroll about 120 px to reveal **Review and start**. | The New backtest panel on the left, run cards on the right. |
| **P1 / P2** | Compare runs | No scroll (P1), then scroll to the bottom (P2). | P1: the Run A / Run B pickers and the headline results table. P2: "Did the runs decide the same way?" |

### 2.6 Live run (optional, costs API credits)

- **Get approval first.** Starting any backtest sends real requests on the owner's TypeSafe account. Record a live run only with the owner's approval.
- **Best option: a live Pilot.** 12 requests, estimated at ≈ 111.6K input tokens. The page estimates 16 s; the earlier pilot finished in about 6 s. It shows the approval dialog, the Live status pill, the "Running now" pulse in the sidebar, and decisions streaming into the Theater.
- **Record it last.** It adds a fourth run to the lab and changes the Compare page's default selection.
- **Next episode.** The full suite with indicators (300 requests, estimated ≈ 3.7M input tokens) belongs in the follow-up video. Record its live Theater when the owner runs it.

---

## 3. Run of show

Timecodes are targets. Once the narration is recorded, lock the edit to the read and let the shots breathe around it.

| Shot | Time | Page and setup | What's on screen |
|---|---|---|---|
| **C0** | **00:00** | **Cold open** | |
| S01 | 00:00–00:08 | Theater · Recipe B 8× · T2 | Dots filling in, scoreboard ticking |
| S02 | 00:08–00:20 | Theater · Recipe A 2× on #45 · T1 | NVIDIA short with no stop: candles climb, −13.07% appears |
| S03 | 00:20–00:35 | Report · R1 | Headline numbers, then the title card |
| **C1** | **00:35** | **What Jev returns** | |
| S04 | 00:35–00:55 | Theater · Recipe C #28 · T1 → drawer | "Open all 15 answers" → the drawer slides in |
| S05 | 00:55–01:20 | Drawer · D2 | Decision group: probabilities, setup exists |
| S06 | 01:20–01:38 | Drawer · D2 | Setup strength score, the Trade plan group |
| S07 | 01:38–01:50 | Drawer · D2 | Request details, "State sent to Jev" JSON |
| **C2** | **01:50** | **The lab and the rules** | |
| S08 | 01:50–02:05 | Backtests · B1 | Lab heading, run cards |
| S09 | 02:05–02:23 | Backtests · B1 | Full suite preset selected, estimate updates |
| S10 | 02:23–02:43 | Backtests · B1 | Approval dialog opens, then Cancel |
| S11 | 02:43–03:05 | Theater · Recipe C #28 · T1 | Future zone, Decision marker, stop and target levels |
| S12 | 03:05–03:25 | Theater · Recipe C #24 · T1 | A trade with no stop and no target lines |
| **C3** | **03:25** | **One decision, start to finish** | |
| S13 | 03:25–03:35 | Theater · Recipe A 1× on #28 · T1 | The whole decision in real time |
| S14 | 03:35–03:50 | Same take, held | Reads the bars |
| S15 | 03:50–04:12 | Same take, held | Decides: card, reads, plan |
| S16 | 04:12–04:35 | Same take, held | Trade plays out: entry, levels, target hit |
| S17 | 04:35–05:05 | Same take + S04 drawer footage | Scored: +2.90%, compared with always long |
| **C4** | **05:05** | **All 300 decisions** | |
| S18 | 05:05–05:22 | Theater · Recipe B 8× · T2 | Replay starts; legend for the dots |
| S19 | 05:22–05:40 | Same take | End of the NVIDIA block (#60) |
| S20 | 05:40–05:55 | Same take | JPMorgan and Exxon blocks (#61–180) |
| S21 | 05:55–06:15 | Same take | Bitcoin block (#181–240) |
| S22 | 06:15–06:35 | Same take | Gold block and the final scoreboard (#300) |
| **C5** | **06:35** | **The report** | |
| S23 | 06:35–06:55 | Report · R1 | Six headline numbers |
| S24 | 06:55–07:33 | Report · R1 | Cumulative P&L crosshair: peak, then the end |
| S25 | 07:33–07:53 | Report · R2 | Results by symbol |
| S26 | 07:53–08:10 | Report · R2 | How the trades ended |
| S27 | 08:10–08:35 | Report · R2 | Confidence and results columns |
| **C6** | **08:35** | **The contradictions** | |
| S28 | 08:35–09:00 | Report · R3 | Contradictions panel, "6 of 7 checks found cases" |
| S29 | 09:00–09:40 | Report · R3 → R2 | The counts; the two sixteens |
| S30 | 09:40–10:12 | Theater · Recipe A 1× on #45 · T1 | Worst trade plays out |
| S31 | 10:12–10:50 | Report chip → drawer #45 · D2 | The answers that contradict the trade |
| S32 | 10:50–11:12 | Theater · Recipe A 2× on #212 · T1 | Best trade, same shape |
| S33 | 11:12–11:30 | Theater · Recipe C #69 · T1 | The most confident short |
| S34 | 11:30–11:42 | Decisions · D1 | Lost trades sorted by net return, five flags each |
| S35 | 11:42–11:55 | Decisions (dimmed) + caption card | Trades with and without contradictions |
| S36 | 11:55–12:21 | Report chip → drawer #6 · D2 | A no-trade that carries a full long plan |
| S37 | 12:21–12:35 | Drawer #6 callout, pull back | Chapter close |
| **C7** | **12:35** | **When Jev stays flat** | |
| S38 | 12:35–12:57 | Report · R4 | When Jev stayed flat |
| S39 | 12:57–13:20 | Theater · Recipe A 1× on #238 · T1 | Bitcoin no-trade, then +22.18% |
| S40 | 13:20–13:40 | Report · R4 | Answers behind winning and losing trades |
| **C8** | **13:40** | **The indicators pilot** | |
| S41 | 13:40–13:55 | Backtests · B1 | The two Pilot cards |
| S42 | 13:55–14:15 | Compare · P1 | Run A set to Pilot; headline results |
| S43 | 14:15–14:30 | Compare · P2 | Agreement matrix |
| **C9** | **14:30** | **Verdict** | |
| S44 | 14:30–15:05 | Theater · Recipe C #300 · T2 | Final scoreboard, slow push-in |
| S45 | 15:05–15:30 | Report · R3 still | Contradictions panel, slow pan |
| S46 | 15:30–15:50 | End card over the Backtests page | Next episode, disclaimer |

---

## 4. Shot-by-shot script

Each shot lists the page and setup, what to record, what the animation shows, the numbers that must be visible, edit notes, and the narration that lands on it. Recipes and framing presets are defined in [section 2](#2-before-recording).

### C0 · Cold open · 00:00–00:35

#### S01 · 00:00–00:08 · Fast replay montage

- **Page:** Theater · Recipe B at 8× · framing T2.
- **Record:** the first 60 seconds of the 8× replay. Reuse the long take from S18–S22 if it's already recorded.
- **On screen:** gray, blue and orange dots filling each symbol's row. "After N of 300 decisions" counts up, and the red Following Jev line starts to move.
- **Edit:** start on black, and cut in on the first dot in time with the music. Speed-ramp the take to about 2× in the edit, and add a slow 3% push-in.

**Voice-over**
> Three hundred trading decisions. Five markets. Two years of daily candles.

#### S02 · 00:08–00:20 · The worst trade, as a hook

- **Page:** Theater · Recipe A at 2× on decision #45 (load `SUITE/theater?at=44`) · framing T1.
- **Record:** the full decision, from Reads the bars to Scored.
- **On screen:** NVDA · NasdaqGS · decision 45 of 60 · Mar 30, 2026. **Short**, confidence 40%. There are no stop or target lines, only the entry dot. The hidden candles climb bar after bar, and the **−13.07%** label fades in at the last bar.
- **Edit:** crop to the chart only; the plan is revealed in C6. End on the −13.07% label with a 6-frame hold.

**Voice-over**
> I gave every one of them to Jev, TypeSafe's model for structured analysis, and built a lab to watch each decision play out.

#### S03 · 00:20–00:35 · Headline numbers and title

- **Page:** Report · framing R1 (`SUITE/report`).
- **Record:** 10 seconds still, then move the cursor slowly across the six headline numbers.
- **On screen:** Net return **+3.82%** · P&L **+$382** · Win rate **50.0%** · Per trade **+0.08%** · Max drawdown **−$2,276** · Profit factor **1.06**.
- **Edit:** at 00:28, bring up the title card "Jev Under Test" in the dashboard style (see 9.3), then cut to C1 at 00:35.

**Voice-over**
> Jev stayed out of the market eighty-five percent of the time. When it traded, it won exactly half. And inside its own answers is a pattern that explains its best trade, and its worst.

### C1 · What Jev returns · 00:35–01:50

#### S04 · 00:35–00:55 · Open one decision

- **Page:** Theater · Recipe C on #28 (`SUITE/theater?at=28`) · framing T1.
- **Record:** hold for 3 seconds on the finished decision, move to **Open all 15 answers** at the bottom of the decision card, click it, and hold for 5 seconds while the drawer settles.
- **On screen:** the drawer slides in from the right. Header: Decision 28 of 60 · NVDA · Sep 30, 2025 · **Long** · confidence 44% · **+2.90%** · +$290.00. Below the chart, the trade facts: Entry 185.24 Oct 1 · Exit 190.80 Oct 2 · Take profit after 2 bars · Stop / target 181.54 / 190.80 · Gross / net +3.00% / +2.90% · **Always long −1.22%**.
- **Edit:** keep the slide-in at real speed. S17 reuses the trade facts, so record 5 clean seconds of them.

**Voice-over**
> First, what Jev actually returns. For every decision, I send it a state: ninety daily candles and the rules of the task, plus fifteen typed questions. It answers all of them in a single call.

#### S05 · 00:55–01:20 · Choice and yes-or-no answers

- **Page:** drawer on #28 · D2.
- **Record:** scroll inside the drawer to the **DECISION** group and hold on Trade decision and A trade setup exists.
- **On screen:** Trade decision: ✓ Long **62%**, Short 7%, No trade 31%, **Confidence 44%**. A trade setup exists: **59% yes**. Stay flat because of uncertainty: 42% yes.
- **Edit:** punch in to about 130% on the probability bars as the numbers are spoken. Use a soft spotlight on the Long row (9.4).

**Voice-over**
> A choice question comes back as probabilities for every option. Here: long sixty-two percent, no trade thirty-one, short seven, with forty-four percent confidence in that choice. A yes-or-no question comes back as the probability of yes. A trade setup exists: fifty-nine percent.

#### S06 · 01:20–01:38 · Score answers and the trade plan

- **Page:** drawer on #28 · D2.
- **Record:** scroll to **SETUP QUALITY**, hold 3 seconds, then continue into **TRADE PLAN** and hold.
- **On screen:** Setup strength: **Strong**, 3.65 of 6, confidence 63%, with the marker on the scale. Trade plan: Direction if traded Long 74% · Entry style Enter next bar 39% · Stop-loss distance 2.00% or more 54% · Take-profit distance 3.00% or more 51% · Holding period 2 to 3 bars 33%.
- **Edit:** scroll at real speed; no speed ramps inside the drawer.

**Voice-over**
> A score question lands on a scale. Setup strength: three point six five out of six. And the last five questions are a full trade plan: direction, entry style, stop-loss, take-profit and holding period.

#### S07 · 01:38–01:50 · The request and the state

- **Page:** drawer on #28 · D2.
- **Record:** scroll to **REQUEST**, click **State sent to Jev** to expand it, and scroll the JSON box a little.
- **On screen:** Model jev-1.13.0 · Latency 1,241 ms · Tokens 9.4K in, 782 out. The JSON starts with `task`, `instrument`, `timeframe`, `decision_point` "Immediately after the close of bar 90. Bar 90 represents NOW."
- **Edit:** a short request id is visible here. It isn't a secret and needs no blur. Close the chapter on the JSON.

**Voice-over**
> Every answer is typed, so every answer can be checked against what the market did next. That's what this lab does.

### C2 · The lab and the rules · 01:50–03:25

#### S08 · 01:50–02:05 · The lab

- **Page:** Backtests (`http://127.0.0.1:3000/`) · framing B1.
- **Record:** hold 3 seconds, then move slowly over the **Full suite** run card.
- **On screen:** "TypeSafe Jev · trade decision evaluation" · **Backtest lab**. Run cards: Full suite · 30 long · 16 short · 254 no trade · +3.82% · +$382 · 50.0% · 46 trades. Below it are Pilot and Pilot with indicators.
- **Edit:** a slow push toward the run cards.

**Voice-over**
> This is the lab. It runs on my own machine with my own API key, so nothing that costs money starts without an approval.

#### S09 · 02:05–02:23 · Choosing the full suite

- **Page:** Backtests · B1.
- **Record:** click the **Full suite** preset card, then open **Adjust symbols and cutoffs**. Hover **Add technical indicators** and **Blind mode** without switching them on.
- **On screen:** the preset card highlights: "NVDA, JPM, XOM, BTC-USD, GLD · 60 decisions each · 300 requests". The estimate updates to Requests **300** · Input tokens **≈ 2.8M** · Time **≈ 6m 30s**. The fields show the five symbols and **60**.
- **Edit:** a spotlight on the estimate as it changes.

**Voice-over**
> The full suite covers five very different markets: NVIDIA, JPMorgan, Exxon, Bitcoin and the gold ETF, GLD. Sixty decision points each, spread across the last two years.

#### S10 · 02:23–02:43 · The approval step

- **Page:** Backtests · B1. Scroll about 120 px so **Review and start** is visible.
- **Record:** click **Review and start**, hold 6 seconds on the dialog, then click **Cancel**.
- **Do not click Start backtest.** It sends 300 paid requests.
- **On screen:** "Approval required" · **Start full suite?** · "This sends **300 requests** to Jev using your TypeSafe API key, about 2.8M input tokens." · Decisions: "60 per symbol over the last two years, each seeing up to 90 daily bars" · State: Prompt and candles · Scoring: "Trades enter at the next open, 5 bps per side, 10,000 per trade".
- **Edit:** keep the dialog's fade-in; cut before the cursor reaches Cancel.

**Voice-over**
> At every cutoff, Jev sees only the ninety daily candles up to that close. Nothing after it. Three hundred requests, at about nine and a half thousand input tokens each.

#### S11 · 02:43–03:05 · How a trade is scored

- **Page:** Theater · Recipe C on #28 · T1.
- **Record:** move the cursor from the red **Decision** marker into the shaded area on the right. The candle tooltip reads "After the decision". Then move to the legend.
- **On screen:** the shaded future zone, the Decision marker, the entry dot, the stop line at **181.54** and the target at **190.80**. Legend: "After the decision, hidden from Jev · Entry at next open · Stop 181.54 · Target 190.80".
- **Edit:** a 115% punch-in on the right half of the chart.

**Voice-over**
> Scoring is simple on purpose. A trade enters at the next day's open, and Jev's own answers set the stop, the target and the holding period, up to eight bars. Costs are five basis points in and five out, on ten thousand dollars a trade.

#### S12 · 03:05–03:25 · The no-stop rule

- **Page:** Theater · Recipe C on #24 (`SUITE/theater?at=24`) · T1.
- **Record:** a still frame, then a slow cursor move to the Plan box.
- **On screen:** NVDA · Aug 19, 2025 · **Short** · confidence 24%. Plan: Stop-loss **None** · Take-profit **None** · Hold up to **8 bars** · Entry style **Not applicable**. The chart has an entry dot and no level lines.
- **Edit:** spotlight the Plan box. This example ended at +0.47%, which keeps the drama for C6.

**Voice-over**
> One rule matters for everything that follows. If Jev answers 'not applicable' for the stop-loss, the trade runs with no stop. I don't patch its answers. And every cutoff is also scored as if you had simply bought and held. That's the benchmark.

### C3 · One decision, start to finish · 03:25–05:05

One take drives this chapter: Recipe A at 1× on decision #28 (load `SUITE/theater?at=27`), framed T1. Record three clean takes.

#### S13 · 03:25–03:35 · Real time

- **Record:** the whole decision at 1×, about 6.1 seconds.
- **On screen:** the four chips light up in turn, the card slides in, the candles rise, and **+2.90%** fades in.
- **Edit:** play it untouched, with music only after the first line.

**Voice-over**
> Here's one decision, in real time.

#### S14 · 03:35–03:50 · Reads the bars

- **Edit:** replay the take from the start and freeze on the first frame where **Reads the bars** is lit, with the shimmering placeholder. Hold under the line, and use a slow push-in on the empty shaded area.
- **On screen:** "Jev is reading" · "90 daily NVDA bars up to the close of Sep 30, 2025."

**Voice-over**
> First, Jev reads the ninety bars up to the close on September thirtieth, 2025. The shaded area on the right is the future, and the model never sees it.

#### S15 · 03:50–04:12 · Decides

- **Edit:** let the card slide in (about 0.25 s), then freeze. Punch in on the decision card in three beats: action and confidence → the reads → the Plan box.
- **On screen:** **Long** · confidence 44% · Direction Strongly bullish 68% · Structure Bullish trend 40% · Momentum Strong bullish momentum 93% · Setup strength Strong 3.6 of 6 · Setup exists 59% yes · Stay flat 42% yes. Plan: Stop-loss 2% · Take-profit 3% · Hold up to 3 bars · Entry style Enter next bar.

**Voice-over**
> Then it decides. Long, at sixty-two percent, with forty-four percent confidence. Its reads agree with each other: strongly bullish, strong bullish momentum, a strong setup. And the plan is complete: a two percent stop, a three percent target, hold up to three bars, enter on the next bar.

#### S16 · 04:12–04:35 · Trade plays out

- **Edit:** play at real speed from the first hidden candle. When the exit dot appears, hold 2 seconds, then let the remaining bars finish. The trade exits on bar 2, and bars 3–8 keep drawing for context.
- **On screen:** "Trade open · Entered at 185.24 on Oct 1, 2025; bar 1 of up to 3." Entry dot, Stop 181.54, Target 190.80. The exit dot and **+2.90%** label appear at bar 2.

**Voice-over**
> Now the hidden candles play out, one bar at a time. It buys the next open at one eighty-five twenty-four, with the stop and the target drawn on the chart. Two bars later, the price reaches the target.

#### S17 · 04:35–05:05 · Scored

- **Edit:** hold on the Scored frame and punch in on the result card. On "Buying and holding", cut to the trade facts recorded in S04 and punch in on **Always long −1.22%**. Cut back to the scored Theater for the last sentence.
- **On screen:** Result **+2.90%** · +$290.00 · Take profit on Oct 2, 2025 after 2 bars.

**Voice-over**
> Plus two point nine percent after costs. Two hundred and ninety dollars. Buying and holding for the full eight bars would have lost one point two percent. This is Jev at its best: the decision, the read and the plan all pointing the same way. Hold on to that picture, because most of its trades didn't look like this.

### C4 · All 300 decisions · 05:05–06:35

One long take drives this chapter: Recipe B at 8× (`SUITE/theater`), framed T2, recorded for the full 3m 50s. The table shows where each symbol block ends in the take, and what the scoreboard must show at that moment.

| Take time | Decision | Scoreboard ("After N of 300 decisions") | Cumulative P&L so far |
|---|---|---|---|
| 0:46 | #60, end of NVDA | Net return −11.32% · P&L −$1,132 · Win rate 57% (4 won, 3 lost) · Stayed flat 88% (Traded 4 long, 3 short) | Jev −$1,132 · Always long +$5,876 |
| 1:32 | #120, end of JPM | −15.43% · −$1,543 · 47% (9 won, 10 lost) · 84% | Jev −$1,543 · Always long +$10,639 |
| 2:18 | #180, end of XOM | −14.19% · −$1,419 · 44% (11 won, 14 lost) · 86% | Jev −$1,419 · Always long +$14,710 |
| 3:04 | #240, end of BTC-USD | −4.56% · −$456 · 44% (16 won, 20 lost) · 85% | Jev −$456 · Always long +$12,405 |
| 3:50 | #300, end of GLD | **+3.82% · +$382 · 50% (23 won, 23 lost) · 85% (Traded 30 long, 16 short)** | **Jev +$382 · Always long +$17,783** |

Speed-ramp the take in the edit so each block fits its shot. Always land on the exact frame where the block's last decision is scored, so the numbers above are readable, and hold that frame for at least 1.5 seconds.

#### S18 · 05:05–05:22 · Replay starts

- **Record:** start of the take (0:00–0:20).
- **On screen:** the playback bar shows **8×** and "Playing". NVDA's row of dots fills in from the left, and the red Following Jev line and the gray Always long line start drawing.
- **Edit:** add a callout ring (9.4) on the legend above the dots: Long · Short · No trade · Trade won · Trade lost.

**Voice-over**
> Now all three hundred decisions, at eight times speed. Each dot is one decision: blue for long, orange for short, gray for no trade. A green ring means the trade won. A pink ring means it lost.

#### S19 · 05:22–05:40 · End of NVIDIA

- **Record:** take time 0:20–0:50.
- **On screen:** at #60, P&L **−$1,132**, with the gray line at **+$5,876** in the chart.
- **Edit:** ramp to about 3×, then freeze-hold on #60.

**Voice-over**
> Watch how much gray there is. Jev passed on two hundred and fifty-four of the three hundred. By the end of NVIDIA, it's down eleven hundred dollars, while buying NVIDIA at every cutoff made almost six thousand.

#### S20 · 05:40–05:55 · JPMorgan and Exxon

- **Record:** take time 0:50–2:20.
- **On screen:** at #180, P&L **−$1,419**.
- **Edit:** ramp to about 8× through JPMorgan and Exxon, then hold on #180.

**Voice-over**
> JPMorgan and Exxon don't help. After a hundred and eighty decisions, Jev is down about fourteen hundred.

#### S21 · 05:55–06:15 · Bitcoin

- **Record:** take time 2:18–3:06.
- **On screen:** watch for the jump when BTC-USD decision #212 scores (+14.55%). At #240, P&L **−$456**.
- **Edit:** ramp to about 3×, with a brief 1-second slow-down when #212 scores.

**Voice-over**
> Bitcoin is where it earns its keep. It's the only market here where buying every cutoff lost money, and Jev made nine hundred and sixty-three dollars on it.

#### S22 · 06:15–06:35 · Gold and the final scoreboard

- **Record:** take time 3:04 to the end, then 5 seconds after **Replay finished**.
- **On screen:** Net return **+3.82%** · P&L **+$382** · Win rate **50%** · 23 won, 23 lost · Stayed flat **85%** · Traded 30 long, 16 short.
- **Edit:** ramp to about 3×, then hold on the final frame and punch in on the scoreboard.

**Voice-over**
> Gold finishes the job, with seven wins in ten trades. Final scoreboard: forty-six trades, twenty-three won, twenty-three lost. Plus three point eight two percent. Three hundred and eighty-two dollars.

### C5 · The report · 06:35–08:35

#### S23 · 06:35–06:55 · Headline numbers

- **Page:** Report (`SUITE/report`) · framing R1.
- **Record:** a still frame, then a slow cursor pass along the six numbers.
- **On screen:** Net return **+3.82%** "Sum of 46 trades, net of 5 bps per side" · P&L **+$382** "Trading $10,000 per trade" · Win rate **50.0%** "23 won, 23 lost" · Per trade **+0.08%** "Always long: +0.59% per cutoff" · Max drawdown **−$2,276** · Profit factor **1.06**.
- **Edit:** punch in on each number as it's spoken.

**Voice-over**
> The report puts it in numbers. Forty-six trades, net plus three point eight two percent. A profit factor of one point oh six. And per trade, plus zero point zero eight percent.

#### S24 · 06:55–07:33 · Following Jev against always long

- **Page:** Report · R1.
- **Record:** move the cursor into the Cumulative P&L chart and glide left to right. A crosshair and tooltip follow the cursor. Stop on the peak of the red line, hold 4 seconds, then continue to the right edge and hold 4 seconds.
- **On screen:**
  - Peak tooltip: **#160 · BTC-USD Nov 13, 2025 · SHORT** · Following Jev **+$2,658.87** · Always long +$9,909.78.
  - Right edge: Following Jev **+$382.39** · Always long **+$17,782.75**.
- **Edit:** follow the cursor with a gentle pan at about 120%.

**Voice-over**
> Here's the honest part. The red line is following Jev. The gray line is buying at every cutoff and holding for eight bars: plus seventeen thousand, seven hundred and eighty-three dollars. Buying puts money to work at all three hundred cutoffs, so the totals aren't a fair fight. But per trade, buying still made zero point five nine percent, against Jev's zero point zero eight. Jev's own curve peaked in November 2025, on a single Bitcoin short, and gave back more than two thousand dollars after that.

#### S25 · 07:33–07:53 · Results by symbol

- **Page:** Report · framing R2.
- **Record:** a still frame, then hover the NVDA row, the BTC-USD row and the GLD row in turn.
- **On screen:**

| Symbol | Actions | Trades | Win rate | Net return | P&L | Always long |
|---|---|---|---|---|---|---|
| NVDA | 4 long · 3 short · 53 no trade | 7 | 57.1% | −11.32% | −$1,132 | +0.98% |
| JPM | 8 · 4 · 48 | 12 | 41.7% | −4.11% | −$411 | +0.79% |
| XOM | 3 · 3 · 54 | 6 | 33.3% | +1.24% | +$124 | +0.68% |
| BTC-USD | 6 · 5 · 49 | 11 | 45.5% | +9.63% | +$963 | −0.38% |
| GLD | 9 · 1 · 50 | 10 | 70% | +8.39% | +$839 | +0.90% |

- **Edit:** spotlight NVDA while it's discussed, then BTC-USD together with GLD.

**Voice-over**
> By market: NVIDIA won four of its seven trades and still lost eleven hundred dollars. Two shorts did that. Bitcoin and gold carried the whole result.

#### S26 · 07:53–08:10 · How the trades ended

- **Page:** Report · R2, left panel of the pair.
- **On screen:** Take profit **12** (26%) · Stop loss **15** (33%) · Time exit **19** (41%). Long: 30 trades · 50% · +0.30% · **+$900**. Short: 16 trades · 50% · −0.32% · **−$518**.
- **Edit:** punch in on the panel. Leave room in the frame for S29, which returns to the **Short 16** row.

**Voice-over**
> Twelve trades reached their target, fifteen hit their stop, and nineteen ran out of time. Longs made nine hundred dollars. Shorts lost five hundred and eighteen.

#### S27 · 08:10–08:35 · Confidence and results

- **Page:** Report · R2, right panel.
- **Record:** hover each column. Each tooltip shows Trades, Win rate and Net per trade.
- **On screen:** Below 35% **+1.0%** (28 trades, 53.6% won) · 35 to 50% **−0.9%** (15 trades, 46.7% won) · 50 to 65% **−3.1%** (3 trades, 33.3% won) · 65% and up: No trades.
- **Edit:** reveal the columns left to right with a spotlight as each is spoken.

**Voice-over**
> And this chart matters if you'd size trades by confidence. Trades under thirty-five percent confidence averaged plus one percent. The three trades above fifty percent averaged minus three point one. Jev never took a trade with more than fifty-five percent confidence.

### C6 · The contradictions · 08:35–12:35

This is the heart of the video. Give it room. The [contradictions briefing](#6-contradictions-briefing) explains every check and the pattern behind the shorts.

#### S28 · 08:35–09:00 · The contradiction checks

- **Page:** Report · framing R3.
- **Record:** land with "Contradictions to report to the Jev team" under the top bar and hold 4 seconds, then start a very slow scroll.
- **On screen:** the description "Every question is answered on its own, so a trade can come with a plan that contradicts it. Trades still run under the current rules, for example with no stop." The badge reads **6 of 7 checks found cases**.
- **Edit:** punch in on the badge on "Six of the seven".

**Voice-over**
> Now the part I'm sending to the Jev team. Each of the fifteen questions comes back as its own answer, and nothing in the API makes those answers agree with each other. So the lab checks every decision for answers that contradict it. Six of the seven checks found cases.

#### S29 · 09:00–09:40 · The counts, and the two sixteens

- **Page:** Report · R3, then R2.
- **Record:** a slow scroll through the seven checks, about 12 seconds. Then scroll up to How the trades ended (R2) and hold on the **Short 16** row. S26 footage also works for that row.
- **On screen:**

| Check | Count |
|---|---|
| Traded with no stop-loss | **9** of 46 |
| Traded with no take-profit | **16** of 46 |
| Traded with no holding period | **21** of 46 |
| Direction answer disagrees with the trade | **0** of 46 (green check) |
| Traded while a setup was judged unlikely | **32** of 46 |
| Traded while advising to stay flat | **21** of 46 |
| No trade, but a direction was chosen | **45** of 254 |

- **Edit:** on "these two numbers", build a two-up from real page crops. Left: the "Traded with no take-profit · 16 of 46" row. Right: the "Short · 16" row. Put a callout ring on both 16s.

**Voice-over**
> Thirty-two of forty-six trades were taken while Jev judged that a setup probably doesn't exist. Twenty-one while its own answer said to stay flat because of uncertainty. Nine had no stop-loss at all. To be fair, its direction answer always matched the side it traded. But look at these two numbers. Sixteen trades had no take-profit. Jev made sixteen shorts. They're the same sixteen trades. Every short came with a plan that reads like 'don't trade': entry style, take-profit and holding period, all not applicable.

#### S30 · 09:40–10:12 · The worst trade, played out

- **Page:** Theater · Recipe A at 1× on #45 (`SUITE/theater?at=44`) · T1. Record three takes.
- **On screen:** NVDA · NasdaqGS · decision 45 of 60 · **Mar 30, 2026**.
  - **Card:** **Short** · confidence **40%** · Direction Strongly bearish 78% · Structure Conflicting or unclear 35% · Momentum Strong bearish momentum 87% · Setup strength Moderate 2.8 of 6 · Setup exists **36% yes** · Stay flat **62% yes**.
  - **Plan:** Stop-loss **None** · Take-profit **None** · Hold up to **8 bars** · Entry style **Not applicable**.
  - **Chart:** the legend shows only "After the decision, hidden from Jev" and "Entry at next open".
  - **Trade:** Trade open: "Entered at 166.97 on Mar 31, 2026". Result **−13.07%** · −$1,307.24 · Time exit on Apr 10, 2026 after 8 bars.
- **Edit:**
  - Play the Reads and Decides steps at real speed, then freeze on the Plan box during "no stop, no target".
  - Play the eight bars at real speed. A 50% slow-motion pass is acceptable here, with frame blending off.
  - Hold 2 seconds on −13.07%.

**Voice-over**
> Here's what that looks like. NVIDIA, March thirtieth, 2026. Jev goes short, with forty percent confidence. Its read is strongly bearish, with strong bearish momentum. But the plan says no stop, no target, hold the full eight bars. There's nothing on the chart to get it out. NVIDIA rallies, and the short just sits there. Minus thirteen point oh seven percent: the worst trade of the run.

#### S31 · 10:12–10:50 · Inside the answers

- **Page:** Report · R3 → drawer · D2.
- **Record:**
  1. In the "Traded with no stop-loss" row, click the chip **NVDA Mar 30, 2026**. The drawer slides in, and the URL gains `?decision=NVDA%3A45`.
  2. Hold 4 seconds on the callout.
  3. Scroll to **DECISION** and hold 8 seconds.
  4. Scroll steadily past Market read and Setup quality to **TRADE PLAN**, and hold 10 seconds.
- **On screen:**
  - **Facts:** Entry 166.97 Mar 31 · Exit 188.63 Apr 10 · Time exit after 8 bars · Stop / target **None / None** · Gross / net −12.97% / −13.07% · Always long **+12.87%**.
  - **Callout, "Contradictions in this decision":** five bullets. No stop-loss · no take-profit · no holding period · setup judged unlikely · advising to stay flat.
  - **Decision:** Trade decision: Long 3% · ✓ **Short 60%** · No trade **37%** · Confidence 40%. A trade setup exists **36% yes**. Stay flat because of uncertainty **62% yes**.
  - **Trade plan:** Direction if traded ✓ **Short 61%** · Entry style ✓ **Not applicable 55%** · Stop-loss distance ✓ **Not applicable 49%**, with 2.00% or more at 41% · Take-profit distance ✓ **Not applicable 51%** · Holding period ✓ **Not applicable 59%**.
- **Edit:** a spotlight follows each answer as it's named. Keep scroll speed constant.

**Voice-over**
> Open the decision, and the contradiction is right there. The trade decision says short: sixty percent, against thirty-seven for no trade. A trade setup exists: only thirty-six percent. Stay flat because of uncertainty: sixty-two. Then the plan. Direction if traded: short. But entry style: not applicable. Take-profit: not applicable. Holding period: not applicable, at fifty-nine percent. And the stop-loss was nearly a coin flip: not applicable at forty-nine, two percent or more at forty-one.

#### S32 · 10:50–11:12 · The best trade has the same shape

- **Page:** Theater · Recipe A at 2× on #212 (`SUITE/theater?at=211`) · T1.
- **On screen:** BTC-USD · CCC · decision 32 of 60 · **Nov 13, 2025**.
  - **Card:** **Short** · confidence 28% · Direction Strongly bearish 87% · Structure Conflicting or unclear 52% · Momentum Strong bearish momentum 96% · Setup exists **44% yes** · Stay flat **70% yes**.
  - **Plan:** None · None · 8 bars · Not applicable.
  - **Result:** **+14.55%** · +$1,454.87 · Time exit on Nov 21, 2025 after 8 bars.
- **Edit:** cut in on the Decides step. Match-cut the Plan box against S30's Plan box: same framing, same four answers. End on +14.55%.

**Voice-over**
> Now the twist. The best trade of the entire run has exactly the same shape. Bitcoin, November thirteenth, 2025: short, no stop, no target, and stay flat at seventy percent. Bitcoin fell almost fifteen percent in eight days. Plus fourteen point five five.

#### S33 · 11:12–11:30 · The most confident short

- **Page:** Theater · Recipe C on #69 (`SUITE/theater?at=69`) · T1.
- **On screen:** JPM · NYSE · decision 9 of 60 · **Mar 13, 2025**.
  - **Card:** **Short** · confidence **55%** · Direction **Strongly bearish 96%** · Structure Bearish trend 39% · Momentum Strong bearish momentum 99% · Setup exists 46% yes · Stay flat 60% yes.
  - **Plan:** None · None · 8 bars · Not applicable.
  - **Result:** **−10.19%** · −$1,018.68 · Time exit on Mar 25, 2025 after 8 bars.
- **Edit:** a slow push from the confidence line down to the result.

**Voice-over**
> And JPMorgan, March thirteenth, 2025: the most confident short in the run, at fifty-five percent, and strongly bearish at ninety-six. JPMorgan rose about ten percent. Minus ten point one nine.

#### S34 · 11:30–11:42 · The biggest losses carry the most flags

- **Page:** Decisions (`SUITE/decisions`) · D1.
- **Record:**
  1. Click Outcome **Lost**. The summary reads "Showing 23 of 300 decisions".
  2. Click the **Net return** column header once to sort worst first.
  3. Hover the **Flags** badge on the top row until the tooltip lists the five checks.
- **On screen:** the top three rows are **NVDA #45** (Mar 30, 2026, −13.07%), **JPM #9** (Mar 13, 2025, −10.19%) and **NVDA #40** (Feb 5, 2026, −6.49%). Each has a Flags badge of **5**.
- **Edit:** spotlight the three rows. The tooltip can take a moment to appear; trim the wait.

**Voice-over**
> Sort the losing trades, and the three biggest losses each carry five contradiction flags.

#### S35 · 11:42–11:55 · Agreement pays

- **Page:** S34 footage, dimmed to about 40%, under a caption card (9.3).
- **Caption card** (derived from the run; the dashboard doesn't show this split):

| | Trades | Net return |
|---|---|---|
| Every answer agreed (no flags) | 12 | **+6.36%** |
| At least one contradiction | 34 | **−2.54%** |

  Footnote on the card: "Same run. Split computed from the dashboard's contradiction checks."

**Voice-over**
> Split the trades by whether their answers agreed. The twelve trades with no contradictions made plus six point three six percent. The other thirty-four lost two point five four.

#### S36 · 11:55–12:21 · A no-trade with a full plan

- **Page:** Report · R3 → drawer · D2.
- **Record:**
  1. Close any open drawer with Esc or the × button.
  2. In "No trade, but a direction was chosen", click the chip **NVDA Feb 10, 2025**.
  3. Hold on the drawer header, then scroll to **DECISION** and hold.
  4. Scroll to **TRADE PLAN** and hold.
- **On screen:**
  - **Header:** **No trade** · confidence 27% · "Price moved +0.64% over the next 8 bars".
  - **Decision:** Trade decision: Long **45%** · Short 3% · ✓ No trade **52%** · Confidence 27%.
  - **Trade plan:** Direction if traded ✓ **Long 62%** · Entry style ✓ **Enter next bar 37%** · Stop-loss distance ✓ **2.00% or more 42%** · Take-profit distance ✓ **3.00% or more 47%** · Holding period ✓ **2 to 3 bars 38%**.
- **Edit:** a spotlight on each plan answer as it's named.

**Voice-over**
> It happens the other way round too. Forty-five times, Jev chose no trade but still picked a direction and a full plan. NVIDIA, February tenth, 2025: no trade, at fifty-two percent. Its plan? Long at sixty-two, enter on the next bar, a two percent stop, a three percent target, hold two to three bars.

#### S37 · 12:21–12:35 · Chapter close

- **Page:** the drawer on #6, scrolled back up to the callout "Contradictions in this decision". Then close the drawer (Esc or the × button) to reveal the contradictions panel behind it.
- **Edit:** a slow pull-back, then a 12-frame dissolve into C7.

**Voice-over**
> The decision and the plan come from the same state, but they don't always tell the same story. If you trade on these answers, that's the first thing to handle.

### C7 · When Jev stays flat · 12:35–13:40

#### S38 · 12:35–12:57 · What happened after a no-trade

- **Page:** Report · framing R4.
- **Record:** a still frame, then a slow cursor pass over the four facts.
- **On screen:** "254 of 300 decisions were No trade. What the price did over the next 8 bars:"
  - Average move after No trade: **3.84%**, in either direction.
  - Average move after a trade: **4.15%**, in either direction.
  - Big moves sat out: ↑ **39** up · ↓ **26** down, moves of 5% or more.
  - Always long after No trade: **+0.60%**, versus **+0.53%** after trades.
- **Edit:** punch in on the first two facts, then the third.

**Voice-over**
> Staying flat is a valid answer; the prompt says so. The question is whether Jev stays out at the right times. After a no-trade, prices still moved three point eight four percent on average over eight bars. After a trade, four point one five. Nearly the same.

#### S39 · 12:57–13:20 · The move it sat out

- **Page:** Theater · Recipe A at 1× on #238 (`SUITE/theater?at=237`) · T1.
- **On screen:** BTC-USD · CCC · decision 58 of 60 · **Aug 18, 2026**.
  - **Card:** **No trade** · confidence **76%** · Direction Neutral or unclear 72% · Structure Range or consolidation 57% · Momentum Moderate bullish momentum 73% · Setup strength Weak 1.7 of 6 · Setup exists 25% yes · Stay flat 67% yes.
  - **Outcome:** "No position is opened." While the bars play, the text counts up: "Stayed flat. The price moved … over the next N bars so far." It finishes at **+22.18% over the next 8 bars**.
- **Edit:** let the eight bars play at real speed, then hold on +22.18%.

**Voice-over**
> And it sat out thirty-nine moves up and twenty-six moves down of five percent or more. Bitcoin, August eighteenth, 2026: no trade, at seventy-six percent confidence. Over the next eight days, Bitcoin rose twenty-two percent.

#### S40 · 13:20–13:40 · Winners and losers look the same

- **Page:** Report · R4, right panel "Answers behind winning and losing trades".
- **On screen:** "Average answers for the 23 winning and 23 losing trades."

| Answer | Winners | Losers |
|---|---|---|
| Decision confidence | 32% | 34% |
| A trade setup exists | 47% | 47% |
| Volume confirms the move | 60% | 59% |
| Price is overextended | 65% | 63% |
| Stay flat because of uncertainty | 52% | 51% |
| Setup strength | 3.23 of 6 | 3.19 of 6 |
| Risk quality | 2.41 of 6 | 2.52 of 6 |

- **Edit:** a spotlight on the first two rows while they're spoken, then widen to the whole table.

**Voice-over**
> When it did trade, its answers barely moved between winners and losers. Confidence: thirty-two percent for winners, thirty-four for losers. Setup exists: forty-seven and forty-seven. None of its answers told the good trades from the bad ones.

### C8 · The indicators pilot · 13:40–14:30

Record this chapter **before** any live run (2.6).

#### S41 · 13:40–13:55 · Two pilots on Apple

- **Page:** Backtests · B1.
- **Record:** hover the **Pilot** card, then the **Pilot with indicators** card, then click **Compare runs**.
- **On screen:**
  - Pilot: AAPL · 4 long · 0 short · 8 no trade · −1.18% · −$118 · 25.0% · 4 trades.
  - Pilot with indicators: AAPL · 0 long · 4 short · 8 no trade · −8.40% · −$840 · 0.0% · 4 trades.
- **Edit:** a two-up of the cards, the only composite in this chapter.

**Voice-over**
> Before the full suite, I ran two small pilots on Apple: the same twelve cutoffs, once with candles only, and once with ten technical indicators added to the state.

#### S42 · 13:55–14:15 · Indicators changed its mind

- **Page:** Compare runs · P1.
- **Record:** the page opens with Run A = Full suite. Open the **Run A** picker and choose **Pilot · AAPL · Sep 17, 2026, 1:49 PM**; Run B stays **Pilot with indicators**. Hold on Headline results.
- **On screen:**

| Measure | Run A · Pilot | Run B · Pilot with indicators | B minus A |
|---|---|---|---|
| Long / short / no trade | 4 / 0 / 8 | 0 / 4 / 8 | – |
| Win rate | 25% | 0% | −25.0 pts |
| Net return | −1.18% | −8.40% | −7.22% |
| P&L | −$118 | −$840 | −$722 |
| Always long per cutoff | +3.22% | +3.22% | – |
| Input tokens | 112K | 148.1K | +36,129 |

- **Note:** the clock time in the picker label follows the recording computer's time zone.
- **Edit:** a spotlight on "Long / short / no trade", then on P&L.

**Voice-over**
> Indicators changed Jev's mind completely. Four longs became four shorts, and every one of those shorts hit its stop: minus eight hundred and forty dollars, against minus a hundred and eighteen without them.

#### S43 · 14:15–14:30 · Did the runs agree?

- **Page:** Compare runs · P2.
- **On screen:** "Did the runs decide the same way?" · "4 of 12 decisions on the same symbol and date matched (33%)."

| Run A ↓ · Run B → | Long | Short | No trade |
|---|---|---|---|
| Long | 0 | 0 | 4 |
| Short | 0 | 0 | 0 |
| No trade | 0 | 4 | **4** |

- **Edit:** a callout ring on the No trade / No trade cell.

**Voice-over**
> The two runs agreed on only four of twelve decisions, all four of them no trade. Twelve cutoffs prove nothing, which is why the full suite with indicators is next.

### C9 · Verdict and next steps · 14:30–15:50

#### S44 · 14:30–15:05 · Three lessons

- **Page:** Theater · Recipe C on #300 (`SUITE/theater?at=300`) · T2.
- **On screen:** all 300 dots. Scoreboard: +3.82% · +$382 · 50% · Stayed flat 85%. The Cumulative P&L so far chart ends at Jev +$382 against Always long +$17,783.
- **Edit:** a slow push-in over 30 seconds. The timeline's current-decision ring sits on the last GLD dot; that's fine here.

**Voice-over**
> So what did three hundred decisions show? One: Jev is cautious, but its caution isn't well aimed. The market moved about as much after it passed as after it traded. Two: its probabilities are worth inspecting, but here, confidence didn't rank trades. The most confident trades did worst. Three, and most important: its answers don't hold each other to account.

#### S45 · 15:05–15:30 · What to do about it

- **Page:** Report · R3, still frame.
- **Edit:** a slow vertical pan down the contradictions list.

**Voice-over**
> Every short came with a plan that said not to trade, and without a stop, one bad call can wipe out four or five good ones. If you build on a model like this, don't trust a single answer. Cross-check them, and decide in code what happens when they disagree.

#### S46 · 15:30–15:50 · End card

- **Page:** Backtests page (B1), blurred to 20 px under the end card (9.3).
- **End card:**
  - **Title:** Next: the full suite with indicators, and a blind run.
  - **Channel CTA:** placeholder for the owner (follow, subscribe or link).
  - **Disclaimer:** "Research test on historical data. Not investment advice."

**Voice-over**
> Next, I'll run the full suite with indicators, plus a blind version that hides symbols and dates, to see whether Jev reads the chart or remembers history. This was a research test on past data, not trading advice.

---

## 5. Clean narration script

This is the narration only, in order, for the voice session. It is generated from the voice-over blocks in section 4, so the two always match; if a line changes, change it in section 4.

**1,744 words** · about **11:38** of speech at 150 words per minute, inside a 15:50 cut. The rest of the running time is animation, holds and music.

**Reading notes**

- Pace: relaxed and conversational, about 150 words per minute. Slow down on numbers.
- Read numbers as they are written in words below. Captions use digits (see 9.5).
- Pause for a beat at each paragraph break. The editor will open the gaps to fit the animations.
- Emphasis: *Six of the seven*, *the same sixteen trades*, *exactly the same shape*, *don't trust a single answer*.
- Record 2 seconds of room tone at the start, and a second read of every paragraph that contains a number.

### C0 · Cold open · 00:00–00:35

*68 words · about 27 seconds of speech*

**S01 · 00:00–00:08**

Three hundred trading decisions. Five markets. Two years of daily candles.

**S02 · 00:08–00:20**

I gave every one of them to Jev, TypeSafe's model for structured analysis, and built a lab to watch each decision play out.

**S03 · 00:20–00:35**

Jev stayed out of the market eighty-five percent of the time. When it traded, it won exactly half. And inside its own answers is a pattern that explains its best trade, and its worst.

### C1 · What Jev returns · 00:35–01:50

*132 words · about 53 seconds of speech*

**S04 · 00:35–00:55**

First, what Jev actually returns. For every decision, I send it a state: ninety daily candles and the rules of the task, plus fifteen typed questions. It answers all of them in a single call.

**S05 · 00:55–01:20**

A choice question comes back as probabilities for every option. Here: long sixty-two percent, no trade thirty-one, short seven, with forty-four percent confidence in that choice. A yes-or-no question comes back as the probability of yes. A trade setup exists: fifty-nine percent.

**S06 · 01:20–01:38**

A score question lands on a scale. Setup strength: three point six five out of six. And the last five questions are a full trade plan: direction, entry style, stop-loss, take-profit and holding period.

**S07 · 01:38–01:50**

Every answer is typed, so every answer can be checked against what the market did next. That's what this lab does.

### C2 · The lab and the rules · 01:50–03:25

*169 words · about 68 seconds of speech*

**S08 · 01:50–02:05**

This is the lab. It runs on my own machine with my own API key, so nothing that costs money starts without an approval.

**S09 · 02:05–02:23**

The full suite covers five very different markets: NVIDIA, JPMorgan, Exxon, Bitcoin and the gold ETF, GLD. Sixty decision points each, spread across the last two years.

**S10 · 02:23–02:43**

At every cutoff, Jev sees only the ninety daily candles up to that close. Nothing after it. Three hundred requests, at about nine and a half thousand input tokens each.

**S11 · 02:43–03:05**

Scoring is simple on purpose. A trade enters at the next day's open, and Jev's own answers set the stop, the target and the holding period, up to eight bars. Costs are five basis points in and five out, on ten thousand dollars a trade.

**S12 · 03:05–03:25**

One rule matters for everything that follows. If Jev answers 'not applicable' for the stop-loss, the trade runs with no stop. I don't patch its answers. And every cutoff is also scored as if you had simply bought and held. That's the benchmark.

### C3 · One decision, start to finish · 03:25–05:05

*180 words · about 72 seconds of speech*

**S13 · 03:25–03:35**

Here's one decision, in real time.

**S14 · 03:35–03:50**

First, Jev reads the ninety bars up to the close on September thirtieth, 2025. The shaded area on the right is the future, and the model never sees it.

**S15 · 03:50–04:12**

Then it decides. Long, at sixty-two percent, with forty-four percent confidence. Its reads agree with each other: strongly bullish, strong bullish momentum, a strong setup. And the plan is complete: a two percent stop, a three percent target, hold up to three bars, enter on the next bar.

**S16 · 04:12–04:35**

Now the hidden candles play out, one bar at a time. It buys the next open at one eighty-five twenty-four, with the stop and the target drawn on the chart. Two bars later, the price reaches the target.

**S17 · 04:35–05:05**

Plus two point nine percent after costs. Two hundred and ninety dollars. Buying and holding for the full eight bars would have lost one point two percent. This is Jev at its best: the decision, the read and the plan all pointing the same way. Hold on to that picture, because most of its trades didn't look like this.

### C4 · All 300 decisions · 05:05–06:35

*148 words · about 59 seconds of speech*

**S18 · 05:05–05:22**

Now all three hundred decisions, at eight times speed. Each dot is one decision: blue for long, orange for short, gray for no trade. A green ring means the trade won. A pink ring means it lost.

**S19 · 05:22–05:40**

Watch how much gray there is. Jev passed on two hundred and fifty-four of the three hundred. By the end of NVIDIA, it's down eleven hundred dollars, while buying NVIDIA at every cutoff made almost six thousand.

**S20 · 05:40–05:55**

JPMorgan and Exxon don't help. After a hundred and eighty decisions, Jev is down about fourteen hundred.

**S21 · 05:55–06:15**

Bitcoin is where it earns its keep. It's the only market here where buying every cutoff lost money, and Jev made nine hundred and sixty-three dollars on it.

**S22 · 06:15–06:35**

Gold finishes the job, with seven wins in ten trades. Final scoreboard: forty-six trades, twenty-three won, twenty-three lost. Plus three point eight two percent. Three hundred and eighty-two dollars.

### C5 · The report · 06:35–08:35

*212 words · about 85 seconds of speech*

**S23 · 06:35–06:55**

The report puts it in numbers. Forty-six trades, net plus three point eight two percent. A profit factor of one point oh six. And per trade, plus zero point zero eight percent.

**S24 · 06:55–07:33**

Here's the honest part. The red line is following Jev. The gray line is buying at every cutoff and holding for eight bars: plus seventeen thousand, seven hundred and eighty-three dollars. Buying puts money to work at all three hundred cutoffs, so the totals aren't a fair fight. But per trade, buying still made zero point five nine percent, against Jev's zero point zero eight. Jev's own curve peaked in November 2025, on a single Bitcoin short, and gave back more than two thousand dollars after that.

**S25 · 07:33–07:53**

By market: NVIDIA won four of its seven trades and still lost eleven hundred dollars. Two shorts did that. Bitcoin and gold carried the whole result.

**S26 · 07:53–08:10**

Twelve trades reached their target, fifteen hit their stop, and nineteen ran out of time. Longs made nine hundred dollars. Shorts lost five hundred and eighteen.

**S27 · 08:10–08:35**

And this chart matters if you'd size trades by confidence. Trades under thirty-five percent confidence averaged plus one percent. The three trades above fifty percent averaged minus three point one. Jev never took a trade with more than fifty-five percent confidence.

### C6 · The contradictions · 08:35–12:35

*476 words · about 190 seconds of speech*

**S28 · 08:35–09:00**

Now the part I'm sending to the Jev team. Each of the fifteen questions comes back as its own answer, and nothing in the API makes those answers agree with each other. So the lab checks every decision for answers that contradict it. Six of the seven checks found cases.

**S29 · 09:00–09:40**

Thirty-two of forty-six trades were taken while Jev judged that a setup probably doesn't exist. Twenty-one while its own answer said to stay flat because of uncertainty. Nine had no stop-loss at all. To be fair, its direction answer always matched the side it traded. But look at these two numbers. Sixteen trades had no take-profit. Jev made sixteen shorts. They're the same sixteen trades. Every short came with a plan that reads like 'don't trade': entry style, take-profit and holding period, all not applicable.

**S30 · 09:40–10:12**

Here's what that looks like. NVIDIA, March thirtieth, 2026. Jev goes short, with forty percent confidence. Its read is strongly bearish, with strong bearish momentum. But the plan says no stop, no target, hold the full eight bars. There's nothing on the chart to get it out. NVIDIA rallies, and the short just sits there. Minus thirteen point oh seven percent: the worst trade of the run.

**S31 · 10:12–10:50**

Open the decision, and the contradiction is right there. The trade decision says short: sixty percent, against thirty-seven for no trade. A trade setup exists: only thirty-six percent. Stay flat because of uncertainty: sixty-two. Then the plan. Direction if traded: short. But entry style: not applicable. Take-profit: not applicable. Holding period: not applicable, at fifty-nine percent. And the stop-loss was nearly a coin flip: not applicable at forty-nine, two percent or more at forty-one.

**S32 · 10:50–11:12**

Now the twist. The best trade of the entire run has exactly the same shape. Bitcoin, November thirteenth, 2025: short, no stop, no target, and stay flat at seventy percent. Bitcoin fell almost fifteen percent in eight days. Plus fourteen point five five.

**S33 · 11:12–11:30**

And JPMorgan, March thirteenth, 2025: the most confident short in the run, at fifty-five percent, and strongly bearish at ninety-six. JPMorgan rose about ten percent. Minus ten point one nine.

**S34 · 11:30–11:42**

Sort the losing trades, and the three biggest losses each carry five contradiction flags.

**S35 · 11:42–11:55**

Split the trades by whether their answers agreed. The twelve trades with no contradictions made plus six point three six percent. The other thirty-four lost two point five four.

**S36 · 11:55–12:21**

It happens the other way round too. Forty-five times, Jev chose no trade but still picked a direction and a full plan. NVIDIA, February tenth, 2025: no trade, at fifty-two percent. Its plan? Long at sixty-two, enter on the next bar, a two percent stop, a three percent target, hold two to three bars.

**S37 · 12:21–12:35**

The decision and the plan come from the same state, but they don't always tell the same story. If you trade on these answers, that's the first thing to handle.

### C7 · When Jev stays flat · 12:35–13:40

*119 words · about 48 seconds of speech*

**S38 · 12:35–12:57**

Staying flat is a valid answer; the prompt says so. The question is whether Jev stays out at the right times. After a no-trade, prices still moved three point eight four percent on average over eight bars. After a trade, four point one five. Nearly the same.

**S39 · 12:57–13:20**

And it sat out thirty-nine moves up and twenty-six moves down of five percent or more. Bitcoin, August eighteenth, 2026: no trade, at seventy-six percent confidence. Over the next eight days, Bitcoin rose twenty-two percent.

**S40 · 13:20–13:40**

When it did trade, its answers barely moved between winners and losers. Confidence: thirty-two percent for winners, thirty-four for losers. Setup exists: forty-seven and forty-seven. None of its answers told the good trades from the bad ones.

### C8 · The indicators pilot · 13:40–14:30

*92 words · about 37 seconds of speech*

**S41 · 13:40–13:55**

Before the full suite, I ran two small pilots on Apple: the same twelve cutoffs, once with candles only, and once with ten technical indicators added to the state.

**S42 · 13:55–14:15**

Indicators changed Jev's mind completely. Four longs became four shorts, and every one of those shorts hit its stop: minus eight hundred and forty dollars, against minus a hundred and eighteen without them.

**S43 · 14:15–14:30**

The two runs agreed on only four of twelve decisions, all four of them no trade. Twelve cutoffs prove nothing, which is why the full suite with indicators is next.

### C9 · Verdict and next steps · 14:30–15:50

*148 words · about 59 seconds of speech*

**S44 · 14:30–15:05**

So what did three hundred decisions show? One: Jev is cautious, but its caution isn't well aimed. The market moved about as much after it passed as after it traded. Two: its probabilities are worth inspecting, but here, confidence didn't rank trades. The most confident trades did worst. Three, and most important: its answers don't hold each other to account.

**S45 · 15:05–15:30**

Every short came with a plan that said not to trade, and without a stop, one bad call can wipe out four or five good ones. If you build on a model like this, don't trust a single answer. Cross-check them, and decide in code what happens when they disagree.

**S46 · 15:30–15:50**

Next, I'll run the full suite with indicators, plus a blind version that hides symbols and dates, to see whether Jev reads the chart or remembers history. This was a research test on past data, not trading advice.

---

## 6. Contradictions briefing

Background for the narrator, the editor and anyone answering comments. Everything here comes from the source run.

### 6.1 Why the answers can disagree

- **Separate answers.** Jev returns a separate typed answer for each question. TypeSafe's quickstart describes the request and answer types but doesn't say whether questions are answered jointly or independently. The video therefore only says what the run shows: the answers are not forced to agree.
- **One answer opens the trade.** The lab trades on the **Trade decision** answer alone. Long or Short opens a trade at the next open; No trade doesn't.
- **Three answers make the plan.** The plan comes from the **Stop-loss distance**, **Take-profit distance** and **Holding period** answers:
  - "2.00% or more" counts as 2%, and "3.00% or more" as 3%.
  - A holding-period range uses its upper bound ("2 to 3 bars" means up to 3).
  - Entry style is shown but not simulated.
- **The current rule, kept on purpose.** A Not applicable stop means no stop. A Not applicable take-profit means no target. A Not applicable holding period means holding for the full 8 bars. The owner chose this so the test measures Jev's judgment as it is, and so the contradictions can be reported to the Jev team.

### 6.2 The seven checks

| Check (as on screen) | Count | Test | What it shows | Example |
|---|---|---|---|---|
| Traded with no stop-loss | 9 of 46 | Stop-loss answer is Not applicable on a trade | All 9 are shorts. They include the best trade (+14.55%) and the three worst. | NVDA Mar 30, 2026 (#45) |
| Traded with no take-profit | 16 of 46 | Take-profit answer is Not applicable | Exactly the 16 shorts | JPM Mar 13, 2025 (#69) |
| Traded with no holding period | 21 of 46 | Holding period is Not applicable; held 8 bars | 16 shorts and 5 longs | NVDA Jul 9, 2025 (#20) |
| Direction answer disagrees with the trade | 0 of 46 | Direction if traded ≠ side traded | Never happened: the direction answer is consistent | – |
| Traded while a setup was judged unlikely | 32 of 46 | A trade setup exists < 50% | Most trades were taken while Jev said no setup | NVDA Mar 30, 2026 (36%) |
| Traded while advising to stay flat | 21 of 46 | Stay flat because of uncertainty ≥ 50% | All 16 shorts (58–70%) and 5 longs | BTC-USD Nov 13, 2025 (70%) |
| No trade, but a direction was chosen | 45 of 254 | Decision is No trade, direction if traded is Long or Short | The mirror image: a plan without a trade | NVDA Feb 10, 2025 (#6) |

### 6.3 The pattern behind every short

**All 16 shorts share these answers:**
- Entry style: Not applicable.
- Take-profit: Not applicable.
- Holding period: Not applicable.
- A trade setup exists: below 50% (31–48%).
- Stay flat because of uncertainty: 50% or more (58–70%).

Nine also had a Not applicable stop-loss; the other seven chose "2.00% or more".

In half of them, Short beat No trade by 10 points or less.

| # | Symbol · date | Confidence | Short / No trade | Setup exists | Stay flat | Stop answer | Exit | Net |
|---|---|---|---|---|---|---|---|---|
| 121 | XOM · Dec 16, 2024 | 45% | 63 / 34 | 44% | 58% | 2.00% or more | Time, 8 bars | +0.61% |
| 68 | JPM · Mar 4, 2025 | 25% | 50 / 47 | 37% | 68% | 2.00% or more | Time, 8 bars | +7.39% |
| 69 | JPM · Mar 13, 2025 | 55% | 70 / 28 | 46% | 60% | Not applicable | Time, 8 bars | **−10.19%** |
| 71 | JPM · Apr 3, 2025 | 29% | 53 / 41 | 43% | 62% | 2.00% or more | Stop, 2 bars | −2.10% |
| 131 | XOM · Apr 3, 2025 | 30% | 53 / 44 | 43% | 67% | 2.00% or more | Time, 8 bars | +6.06% |
| 197 | BTC-USD · Jun 5, 2025 | 44% | 62 / 35 | 48% | 62% | 2.00% or more | Stop, 1 bar | −2.10% |
| 141 | XOM · Jul 18, 2025 | 23% | 49 / 47 | 45% | 62% | 2.00% or more | Stop, 3 bars | −2.10% |
| 262 | GLD · Jul 30, 2025 | 30% | 54 / 44 | 36% | 64% | Not applicable | Time, 8 bars | −1.40% |
| 24 | NVDA · Aug 19, 2025 | 24% | 49 / 48 | 38% | 68% | Not applicable | Time, 8 bars | +0.47% |
| 204 | BTC-USD · Aug 19, 2025 | 30% | 53 / 45 | 38% | 68% | Not applicable | Time, 8 bars | +1.32% |
| 89 | JPM · Oct 10, 2025 | 26% | 50 / 48 | 31% | 70% | Not applicable | Time, 8 bars | +3.66% |
| 212 | BTC-USD · Nov 13, 2025 | 28% | 52 / 45 | 44% | 70% | Not applicable | Time, 8 bars | **+14.55%** |
| 40 | NVDA · Feb 5, 2026 | 34% | 56 / 40 | 36% | 61% | Not applicable | Time, 8 bars | **−6.49%** |
| 45 | NVDA · Mar 30, 2026 | 40% | 60 / 37 | 36% | 62% | Not applicable | Time, 8 bars | **−13.07%** |
| 231 | BTC-USD · Jun 4, 2026 | 48% | 65 / 32 | 44% | 58% | Not applicable | Time, 8 bars | +0.31% |
| 233 | BTC-USD · Jun 25, 2026 | 43% | 62 / 35 | 41% | 66% | 2.00% or more | Stop, 6 bars | −2.10% |

**What the shorts added up to**

- **All 16 shorts:** 8 won and 8 lost, for −5.18% net (−$518.03).
- **The 9 with no stop:** −10.84% net (−$1,083.74).
- **The 7 with a stop:** +5.66% net.

**Longs, for contrast**

- **Plans were filled in.** None of the 30 longs had a Not applicable entry style, stop or take-profit; 5 had a Not applicable holding period.
- **The clean trades are all longs.** The 12 trades with no contradictions at all are longs, and together they made **+6.36%**. The 34 trades with at least one contradiction made **−2.54%**.

### 6.4 Suggested note to the Jev team

Keep it factual and phrase it as questions.

1. **Plan answers on shorts.** On all 16 SHORT decisions (with Direction if traded also SHORT), Entry style, Take-profit distance and Holding period came back NOT_APPLICABLE. Is that expected when the trade decision is close to NO_TRADE?
2. **Trades against the model's own reads.** 32 of 46 trades had A trade setup exists below 0.5, and 21 of 46 had Stay flat because of uncertainty at 0.5 or more. Is there a recommended way to combine these answers with the trade decision?
3. **Plans without trades.** 45 of 254 NO_TRADE decisions still returned a direction and a full plan.
4. **Confidence.** Trade-decision confidence never exceeded 0.55 on a trade. The three trades between 0.50 and 0.65 averaged −3.13%. Is confidence meant to be comparable across decisions?
5. **Evidence.** Attach the request ids shown in each decision's **Request** group for #45, #212, #69 and #6, and the model version, jev-1.13.0.

---

## 7. Fact sheet

Every number in the video, from run `suite-2026-09-17T12-06-53-944Z`. If the suite is run again, the numbers will change, because Jev's answers can vary between runs. Re-check this sheet against the new run before reusing the script.

### 7.1 The run

| Item | Value |
|---|---|
| Symbols | NVDA (NasdaqGS), JPM (NYSE), XOM (NYSE), BTC-USD (CCC), GLD (NYSEArca) |
| Decisions | 60 per symbol, 300 in total, 0 failed |
| Cutoffs | Dec 16, 2024 → Sep 3, 2026 (BTC-USD to Sep 8, 2026, because it trades every day) |
| Candles fetched | Three years to Sep 16, 2026; each decision sees at most the last 90 daily bars |
| Horizon | 8 bars after each decision, never sent to Jev |
| Costs and size | 5 bps per side; $10,000 per trade |
| Model | jev-1.13.0 (requested as jev-latest) |
| Duration | 3m 45s (started 12:06:53 UTC) |
| Tokens | 2,867,852 input (header shows 2.9M), 235,592 output; about 9,560 in and 785 out per request |
| Latency | 707 ms average per decision |

### 7.2 Headline

| Measure | Value |
|---|---|
| Actions | 30 long · 16 short · 254 no trade (stayed flat 85%) |
| Trades | 46 · 23 won · 23 lost · win rate 50.0% |
| Net return | +3.82% (sum of trade returns) · per trade +0.08% |
| P&L | +$382.39 |
| Max drawdown | −$2,276.48: from the peak of +$2,658.87 (BTC-USD Nov 13, 2025) to +$382.39 at the end |
| Lowest point | −$359.13 (BTC-USD Jan 17, 2025) |
| Profit factor | 1.06 |
| Always long | 300 trades · 58.7% won · +0.59% per cutoff · +$17,782.75 |
| By side | Long 30 · 50% · +0.30% per trade · +$900.42. Short 16 · 50% · −0.32% · −$518.03 |
| Exits | Take profit 12 (26%) · Stop loss 15 (33%) · Time exit 19 (41%) |

### 7.3 Confidence

| Measure | Value |
|---|---|
| Decision confidence, all 300 | average 56% (15–98%); 175 decisions at 50% or more |
| Trades (46) | average 33% (16–55%) |
| No trades (254) | average 60% (15–98%) |
| Below 35% | 28 trades · 53.6% won · +0.96% per trade (chart label +1.0%) |
| 35 to 50% | 15 trades · 46.7% won · −0.92% (−0.9%) |
| 50 to 65% | 3 trades · 33.3% won · −3.13% (−3.1%) |
| 65% and up | No trades |

### 7.4 Staying flat

| Measure | Value |
|---|---|
| Average move over 8 bars after No trade | 3.84%, either direction |
| Average move over 8 bars after a trade | 4.15%, either direction |
| Moves of 5% or more sat out | 39 up · 26 down |
| Always long after No trade / after trades | +0.60% / +0.53% |
| No-trades with confidence of 65% or more | 115, of which 34 were followed by a move of 5% or more |

### 7.5 Featured decisions

| # | Label in the Decisions tab | Date | Action · confidence | Key answers | Result | Shots |
|---|---|---|---|---|---|---|
| 6 | NVDA #6 | Feb 10, 2025 | No trade · 27% | No trade 52 / Long 45; plan: Long 62, Enter next bar, 2.00% or more, 3.00% or more, 2 to 3 bars | Price +0.64% | S36–S37 |
| 20 | NVDA #20 | Jul 9, 2025 | Long · 23% | Long 49 / No trade 44; setup exists 46%; holding period Not applicable | +4.08% · Take profit, 4 bars | Thumbnail option |
| 24 | NVDA #24 | Aug 19, 2025 | Short · 24% | Plan None / None / 8 bars / Not applicable | +0.47% · Time exit | S12 |
| 28 | NVDA #28 | Sep 30, 2025 | Long · 44% | Long 62; setup exists 59%; stay flat 42%; no flags | +2.90% (+$290.00) · Take profit, 2 bars · always long −1.22% | S04–S07, S11, S13–S17 |
| 40 | NVDA #40 | Feb 5, 2026 | Short · 34% | Five flags | −6.49% (−$648.97) | S34 |
| 45 | NVDA #45 | Mar 30, 2026 | Short · 40% | Short 60 / No trade 37; setup exists 36%; stay flat 62%; plan all Not applicable | −13.07% (−$1,307.24) · always long +12.87% | S02, S30, S31, S34 |
| 69 | JPM #9 | Mar 13, 2025 | Short · 55% | Strongly bearish 96%; strong bearish momentum 99%; stay flat 60% | −10.19% (−$1,018.68) | S33, S34 |
| 212 | BTC-USD #32 | Nov 13, 2025 | Short · 28% | Short 52 / No trade 45; setup exists 44%; stay flat 70% | +14.55% (+$1,454.87) | S21, S32 |
| 238 | BTC-USD #58 | Aug 18, 2026 | No trade · 76% | No trade 84; setup exists 25%; stay flat 67% | Price +22.18% | S39 |
| 278 | GLD #38 | Jan 14, 2026 | Long · 21% | Stop 1.5%, target 2% | +3.13% · Take profit, 3 bars | Optional B-roll |

### 7.6 Pilots (AAPL, the same 12 cutoffs)

| Measure | Pilot | Pilot with indicators |
|---|---|---|
| Actions | 4 long · 0 short · 8 no trade | 0 long · 4 short · 8 no trade |
| Trades · win rate | 4 · 25% | 4 · 0% (all 4 stopped out at −2.10%) |
| Net return · P&L | −1.18% · −$118 | −8.40% · −$840 |
| Always long per cutoff | +3.22% | +3.22% |
| Input tokens | 112K (about 9,330 per request) | 148.1K (about 12,350 per request) |
| Agreement | 4 of 12 matched (33%), all four No trade | |

---

## 8. Recording checklist

Twenty-two recordings cover all 46 shots. Record them in the order below: pages that a live run would change come first, the long replay sits in the middle, and the optional live run comes last. Tick each one off when two good takes are saved.

| ✓ | Rec | Shots | Start URL | Frame | Recipe · speed | What to do | Length | File name |
|---|---|---|---|---|---|---|---|---|
| ☐ | R05 | S08–S10 | `http://127.0.0.1:3000/` | B1 | – | Hover the Full suite card → click the Full suite preset → open Adjust symbols and cutoffs → hover both switches → scroll 120 px → Review and start → hold 6 s → **Cancel** | 60 s | `R05-backtests-approval` |
| ☐ | R19 | S41 | `http://127.0.0.1:3000/` | B1 | – | Hover the Pilot card, then Pilot with indicators → click Compare runs | 25 s | `R19-backtests-pilots` |
| ☐ | R20 | S42–S43 | `http://127.0.0.1:3000/compare` | P1 → P2 | – | Run A → Pilot · AAPL → hold on the table 8 s → scroll to the bottom → hold 6 s | 45 s | `R20-compare-pilots` |
| ☐ | R08 | S13–S17 | `SUITE/theater?at=27` | T1 | A · 1× | Press Space, then →, then Space again when Scored lights up. Three takes. | 15 s each | `R08-theater-nvda28-1x` |
| ☐ | R11 | S30 | `SUITE/theater?at=44` | T1 | A · 1× | Same as R08, on #45. Three takes. | 15 s each | `R11-theater-nvda45-1x` |
| ☐ | R02 | S02 | `SUITE/theater?at=44` | T1 | A · 2× | Same, at 2×. Two takes. | 10 s each | `R02-theater-nvda45-2x` |
| ☐ | R13 | S32 | `SUITE/theater?at=211` | T1 | A · 2× | Same, on #212. Three takes. | 10 s each | `R13-theater-btc212-2x` |
| ☐ | R18 | S39 | `SUITE/theater?at=237` | T1 | A · 1× | Same, on #238. Three takes. | 15 s each | `R18-theater-btc238-1x` |
| ☐ | R06 | S11 | `SUITE/theater?at=28` | T1 | C | Cursor: Decision marker → shaded area (tooltip "After the decision") → legend | 30 s | `R06-theater-nvda28-levels` |
| ☐ | R07 | S12 | `SUITE/theater?at=24` | T1 | C | Still 8 s → slow cursor to the Plan box | 20 s | `R07-theater-nvda24-nostop` |
| ☐ | R14 | S33 | `SUITE/theater?at=69` | T1 | C | Still 25 s, cursor parked off screen | 25 s | `R14-theater-jpm69` |
| ☐ | R21 | S44 | `SUITE/theater?at=300` | T2 | C | Still 35 s | 35 s | `R21-theater-final-scoreboard` |
| ☐ | R01 | S01, S18–S22 | `SUITE/theater` | T2 | B · 8× | Click 8× → click empty space → Space → record until Replay finished + 5 s. Keep the cursor off the charts. | 4m 00s | `R01-theater-full-replay-8x` |
| ☐ | R04 | S04–S07 | `SUITE/theater?at=28` | T1 → D2 | C | Open all 15 answers → hold on the facts 5 s → scroll to Decision (hold 8 s) → Setup quality (3 s) → Trade plan (6 s) → Request → expand State sent to Jev → scroll the JSON | 90 s | `R04-drawer-nvda28` |
| ☐ | R03 | S03, S23, S24 | `SUITE/report` | R1 | – | Still 10 s → cursor across the six numbers → glide through the P&L chart, holding 4 s on the peak and 4 s at the right edge | 60 s | `R03-report-top` |
| ☐ | R09 | S25–S27 | `SUITE/report` | R2 | – | Hover the NVDA, BTC-USD and GLD rows → the How the trades ended panel → each confidence column | 60 s | `R09-report-middle` |
| ☐ | R10 | S28, S29, S45 | `SUITE/report` | R3 | – | Land, hold 4 s → slow scroll through the checks (12 s) → a separate 25 s still | 60 s | `R10-report-contradictions` |
| ☐ | R12 | S31 | `SUITE/report` | R3 → D2 | – | Chip NVDA Mar 30, 2026 → callout 4 s → Decision 8 s → Trade plan 10 s | 60 s | `R12-drawer-nvda45` |
| ☐ | R16 | S36–S37 | `SUITE/report` | R3 → D2 | – | Chip NVDA Feb 10, 2025 → header 4 s → Decision 6 s → Trade plan 8 s → back to the callout → Esc | 60 s | `R16-drawer-nvda6` |
| ☐ | R17 | S38, S40 | `SUITE/report` | R4 | – | Still 8 s → cursor over the flat facts → still on the winners and losers table | 45 s | `R17-report-bottom` |
| ☐ | R15 | S34, S35 | `SUITE/decisions` | D1 | – | Outcome Lost → click Net return → hover the Flags badge on the top row until the tooltip shows | 40 s | `R15-decisions-lost` |
| ☐ | R22 | S46 | `http://127.0.0.1:3000/` | B1 | – | Still 20 s | 20 s | `R22-backtests-still` |
| ☐ | R23 | Optional | `http://127.0.0.1:3000/` | B1 → T1 | Live | **Owner approval required.** Pilot preset → Review and start → Start backtest → follow the live Theater until the run finishes | 60 s | `R23-live-pilot` |

**Before every Theater take**

- Load the URL fresh from the address bar.
- Set the frame.
- Set the speed.
- Click empty space so keyboard focus leaves the buttons.
- Park the cursor off the chart.

**Before every drawer take**

- Close any open drawer first, with Esc or the × button.

**After each session**

- Check that no clip shows the address bar, taskbar, notifications, a terminal or `.env`.

---

## 9. Edit guide

### 9.1 Timeline and pacing

- **Timeline.** Use a 1920×1080, 60 fps timeline. With 4K recordings, scale them to 50% on the timeline and keep the full resolution for punch-ins.
- **Lock to the narration.** Cut to the recorded narration first, then fit the footage.
- **Real speed first.** Show every animated sequence at real speed at least once before any freeze, hold or ramp. Viewers should see how the page really moves.
- **Freezes.** Keep freeze frames under 4 seconds and cut before the freeze feels like a still image.
- **Speed ramps.** Use them only on the full replay (R01) and between symbol blocks. Never ramp inside a single decision, except the optional 50% slow motion on S30's eight bars.
- **Transitions.** Use straight cuts inside chapters and 6–12 frame dissolves between chapters.

### 9.2 What motion is allowed

The dashboard's own animations are the motion design.

| Allowed | Not allowed |
|---|---|
| Cuts, short dissolves | Recreated or mocked charts |
| Punch-ins up to 150% (1080p source) or 200% (4K source) | Fake cursors or clicks |
| Slow push-ins, up to 5% over 10 seconds | Numbers typed over the interface (except the S35 caption card) |
| Freeze frames and holds | 3D tilts, glitch, zoom-blur or shake effects |
| Spotlight and callout rings (9.4) | Stock footage, trading-floor B-roll |
| Chapter title cards and the S35 caption card (9.3) | Reversed footage |

### 9.3 Title and caption cards in the dashboard's style

Build every card from the dashboard's dark theme so the graphics look native.

| Token | Hex | Use |
|---|---|---|
| Page | `#0B1330` | Card backdrop, caption box |
| Panel | `#121E3B` | Card fill |
| Raised panel | `#1B2947` | Inner rows |
| Border | `#354461` | 1 px card border |
| Text | `#FAF7F3` | Titles, values |
| Muted text | `#BEC7DC` | Body, footnotes |
| Eyebrow pink | `#FF91B4` | Uppercase labels |
| Brand magenta | `#C90040` | Single accent: a rule or a dot |
| Gain | `#86DFC6` | Positive numbers |
| Loss | `#FFA6BE` | Negative numbers |
| Focus blue | `#94BAFF` | Callout rings |

**Typography and panel style**

- **Typeface:** the system interface face, the same one the dashboard uses: Segoe UI Variable on Windows, SF Pro on macOS.
- **Eyebrow:** 14–16 px, semibold, uppercase, 0.12em letter-spacing, eyebrow pink.
- **Title:** 48–56 px, semibold, −0.02em letter-spacing.
- **Body:** 22–24 px, muted text.
- **Panels:** 16 px corner radius, 1 px border, 32 px padding, and a soft shadow (0 12 px 40 px at 60% black).

**Cards**

- **Opening title (S03):** eyebrow "TypeSafe Jev · 300 decisions", title "Jev Under Test". Centered on the Report footage dimmed to 35%, on screen for 5 seconds.
- **Chapter titles:** lower left, 3 seconds each, at the start of C1–C9. Eyebrow "Chapter N", title as in the run of show.
- **Caption card (S35):** two rows. "Every answer agreed · 12 trades · +6.36%" in gain green, and "At least one contradiction · 34 trades · −2.54%" in loss pink. Footnote: "Same run. Split computed from the dashboard's contradiction checks."
- **End card (S46):** title "Next: the full suite with indicators, and a blind run", a CTA placeholder, and the disclaimer in muted text.

### 9.4 Spotlight and callout ring

- **Spotlight.** Darken everything outside the target to 55% black, with a 12 px rounded cutout 8 px larger than the target. Ease in and out over 8 frames. Use one spotlight at a time.
- **Callout ring.** A 2 px focus-blue ring, 12 px radius, 6 px outside the target, fading in over 6 frames. Use it for single numbers, such as the two 16s in S29 or the 4 in S43.

### 9.5 Captions

- **Formats.** Burn captions into the social cuts, and upload an SRT file for YouTube.
- **Numbers.** Write numbers as digits, exactly as on screen: "+3.82%", "−$1,307.24", "jev-1.13.0".
- **Layout.** At most two lines of up to 42 characters each. Text `#FAF7F3` on `#0B1330` at 80%, with an 8 px radius, centered 72 px above the bottom edge.
- **Don't cover the numbers being read.** In Theater frames (T1 and T2), keep captions off the playback bar and the scoreboard. If a caption would cover a number that's being read out, move it to the top center.

### 9.6 Music and sound

- **Music.** Minimal ambient or electronic, 85–100 BPM, no vocals.
- **Levels.** Music at about −26 LUFS under the narration. Let it rise to about −18 LUFS in the cold open, the C4 replay and the chapter transitions.
- **Loudness.** Narration at −16 LUFS. Master at −14 LUFS integrated, −1 dBTP true peak.
- **Sound effects.** None, or very soft clicks on real clicks only. Don't sonify the replay.

### 9.7 YouTube chapters

```
00:00 Cold open
00:35 What Jev returns
01:50 The lab and the rules
03:25 One decision, start to finish
05:05 All 300 decisions
06:35 The report
08:35 The contradictions
12:35 When Jev stays flat
13:40 The indicators pilot
14:30 Verdict and next steps
```

Update these to the final edit.

### 9.8 Export

| Deliverable | Settings |
|---|---|
| Master | ProRes 422 HQ, or H.264 at 40 Mbps · 1920×1080 · 60 fps · 48 kHz stereo |
| YouTube | H.264 High · 1080p60 · 12–16 Mbps VBR 2-pass · AAC 320 kbps · SRT captions |
| X | H.264 · 1080p at 30 or 60 fps · 8–10 Mbps · AAC 256 kbps · burned-in captions · under 512 MB. Check the account's current length limit before uploading. |
| Vertical | H.264 · 1080×1920 · 30 fps · 8 Mbps · burned-in captions |

### 9.9 Thumbnail

- **Frame.** Use S30's final frame: NVIDIA, the short with no stop, the −13.07% loss label on the chart, and the Plan box reading None / None. Alternatively, `screenshots/full-suite/02-theater-nvda-take-profit.png`.
- **Text.** Up to four words, such as "It argued with itself" or "300 AI trades".
- **Keep the interface real.** Don't add fake numbers.

---

## 10. Social cutdowns

Both cutdowns reuse lines from the main narration, so they need no extra voice session.

### 10.1 X cut · 2:15 · 16:9

| Time | Footage | Narration (from the main read) |
|---|---|---|
| 0:00–0:15 | S01 replay → S02 on the −13.07% label | S01 in full · S02 in full |
| 0:15–0:24 | S13, the whole decision in real time | "Here's one decision, in real time." |
| 0:24–0:43 | S22 final scoreboard → S24 at the chart's right edge | S22 from "Final scoreboard…" · S24 "The gray line is buying at every cutoff and holding for eight bars: plus seventeen thousand, seven hundred and eighty-three dollars." |
| 0:43–1:03 | S29 two-up of the 16s | S29 from "But look at these two numbers…" to the end |
| 1:03–1:30 | S30, the worst trade | S30 from "NVIDIA, March thirtieth, 2026…" to the end |
| 1:30–1:50 | S32, the best trade | S32 in full |
| 1:50–2:03 | S35 caption card | S35 in full |
| 2:03–2:15 | S45 still → end card with the disclaimer on screen | S45 from "If you build on a model like this…" |

### 10.2 Vertical · 0:60 · 9:16

Stack two crops. The top half (1080×960) is the chart area of the Theater. The bottom half (1080×960) is the decision card, scaled to about 130%. A 1080p source works; a 4K source is sharper.

| Time | Top | Bottom | Narration |
|---|---|---|---|
| 0:00–0:25 | #45 chart (R11) | #45 decision card | S30 from "NVIDIA, March thirtieth, 2026…" |
| 0:25–0:45 | #212 chart (R13) | #212 decision card | S32 in full |
| 0:45–0:57 | S35 caption card, full frame | – | S35 in full |
| 0:57–1:00 | End card with the disclaimer | – | – |

### 10.3 Draft post copy for X

Keep the copy as plain and factual as the video.

> **1/** I backtested TypeSafe's Jev on 300 trading decisions across NVDA, JPM, XOM, BTC and GLD, and built a lab that replays every one.
> Stayed flat 85% of the time. 46 trades, 50% won, +3.82% net. Buying at every cutoff made far more.

> **2/** The interesting part is the answers. Every short came with a plan that said "not applicable" for entry, take-profit and holding period. The same no-stop shorts produced the best trade (+14.55%, BTC) and the worst (−13.07%, NVDA).

> **3/** The 12 trades where every answer agreed made +6.36%. The other 34 lost 2.54%. Confidence didn't help: the most confident trades did worst.

> **4/** Method: 90 daily bars per decision, 8-bar horizon, entry at the next open, 5 bps per side, $10K per trade, model jev-1.13.0. Research test on historical data, not investment advice.

---

## 11. Accuracy and compliance

### 11.1 Numbers

- **Source of truth.** Use only numbers from the [fact sheet](#7-fact-sheet). Each one is on screen in the dashboard, except the derived split in S35, which the caption card labels as derived.
- **Rounding follows the screen.** The confidence chart shows +1.0%, −0.9% and −3.1%; the narration uses the same rounding.
- **A new run means a new sheet.** If the suite is run again, rebuild the fact sheet before recording. Answers can vary between runs of the same state.

### 11.2 Describing Jev

- **Stick to what's observable.** Describe Jev by what the API returns (typed answers with probabilities, scores and confidence) and by what this run shows. Don't describe how Jev works internally.
- **What TypeSafe documents.** TypeSafe's quickstart covers the request and the three question types. It doesn't state whether questions are answered jointly or independently.
- **The dashboard's wording.** The dashboard says "Every question is answered on its own". Read that as "each question returns its own answer", which is exactly how the narration puts it.
- **Tone.** Frame the contradictions as findings to report, not as proof that the model is broken.

### 11.3 Fair comparisons

- **Always long isn't risk-adjusted.** It also enters at all 300 cutoffs, against Jev's 46 trades. S24 says so out loud.
- **Name the market.** The period was mostly a rising market for these symbols. Bitcoin, the one exception, is where Jev beat always long.
- **The pilots are small.** They cover 12 cutoffs each, and S43 says they prove nothing.

### 11.4 Simplifications to disclose in the description

- Every trade enters at the next bar's open. Entry style isn't simulated.
- When a stop and a target are both touched in the same bar, the stop counts first.
- A gap through a level fills at the open.
- Holding-period ranges use their upper bound. A Not applicable holding period means the full 8 bars.
- A Not applicable stop or take-profit means no such level (the current rule, kept on purpose).
- Costs are 5 bps per side, with no other slippage. Trades are $10,000 each, with no compounding. Each decision is scored on its own, so trades may overlap.

### 11.5 Data and memory caveat

- **Data source.** Candles come from Yahoo Finance daily data.
- **Memory risk.** The test period may overlap with the model's training data, so Jev could recognize price history. The blind run, which hides symbols and dates and rebases prices to 100, is planned for that reason. Mention it as next steps (S46), not as a finding.

### 11.6 Security and privacy

- **Off screen.** Never show the API key, `.env`, a terminal, the TypeSafe console, emails or browser profile details.
- **Local only.** The dashboard listens only on the recording computer (127.0.0.1). Don't expose it to a network for the shoot.
- **Visible but harmless.** Request ids and the model version are visible in the drawer. They aren't secrets.

### 11.7 Names and disclaimer

- **Names.** Company, product and ticker names belong to their owners and are used only to identify the data and the model tested. No affiliation or endorsement is implied.
- **On-screen disclaimer (end card):** "Research test on historical data. Not investment advice."
- **Spoken disclaimer:** the last sentence of S46.

### 11.8 Video description template

```
I tested TypeSafe's Jev model on 300 trading decisions across NVIDIA, JPMorgan,
Exxon, Bitcoin and the gold ETF (GLD), then replayed every decision in a
backtest lab.

Results (one run, model jev-1.13.0):
- 300 decisions: 30 long, 16 short, 254 no trade (85% flat)
- 46 trades, 23 won, 23 lost, +3.82% net, +$382 at $10,000 per trade
- Buying at every cutoff and holding 8 bars: +$17,783
- All 16 shorts came with Not applicable entry, take-profit and holding period
- Trades with no contradictions (12): +6.36%; with at least one (34): -2.54%

Method: 90 daily candles per decision, 8-bar horizon, entry at the next open,
5 bps per side, stops and targets from the model's own answers (Not applicable
means none), holding ranges use their upper bound, each decision scored on its
own. Data: Yahoo Finance daily candles.

Chapters:
[paste the chapter list from section 9.7]

Research test on historical data. Not investment advice. Company and product
names belong to their owners; no affiliation or endorsement is implied.
```

---

## Appendix A. The 15 questions

Every decision sends these 15 questions with the state. The drawer shows them in four groups, with the full question text under each label.

| Group | Label on screen | Key | Type | Options | How the lab uses it |
|---|---|---|---|---|---|
| Decision | Trade decision | `trade_decision` | Choice | Long · Short · No trade | **Opens the trade.** Long or Short trades; No trade stays flat. |
| Decision | A trade setup exists | `trade_setup_exists` | Yes/no | probability of yes | Contradiction check (below 50% on a trade) |
| Decision | Stay flat because of uncertainty | `remain_flat_due_to_uncertainty` | Yes/no | probability of yes | Contradiction check (50% or more on a trade) |
| Market read | Market direction | `market_direction` | Choice | Strongly bullish · Moderately bullish · Neutral or unclear · Moderately bearish · Strongly bearish | Shown on the decision card |
| Market read | Market structure | `market_structure` | Choice | Bullish trend · Bearish trend · Bullish breakout · Bearish breakout · Bullish reversal · Bearish reversal · Range or consolidation · Conflicting or unclear | Shown on the decision card |
| Market read | Momentum | `momentum_state` | Choice | Strong bullish momentum · Moderate bullish momentum · No clear momentum · Moderate bearish momentum · Strong bearish momentum | Shown on the decision card |
| Market read | Volume confirms the move | `volume_confirmation` | Yes/no | probability of yes | Winners vs losers table |
| Market read | Price is overextended | `price_overextended` | Yes/no | probability of yes | Winners vs losers table |
| Setup quality | Setup strength | `setup_strength` | Score 0–6 | No meaningful trading evidence · Very weak · Weak · Moderate · Strong · Very strong · Exceptional | Decision card; winners vs losers |
| Setup quality | Risk quality | `risk_quality` | Score 0–6 | Unacceptable · Poor · Below average · Acceptable · Good · Very good · Exceptional | Winners vs losers table |
| Trade plan | Direction if traded | `trade_direction_if_taken` | Choice | Long · Short · Not applicable | Contradiction checks |
| Trade plan | Entry style | `entry_style` | Choice | Enter next bar · Wait for pullback · Wait for breakout confirmation · Wait for retest · Not applicable | Shown; not simulated |
| Trade plan | Stop-loss distance | `stop_loss_distance` | Choice | 0.25% · 0.50% · 0.75% · 1.00% · 1.50% · 2.00% or more · Not applicable | **Sets the stop.** Not applicable means no stop. |
| Trade plan | Take-profit distance | `take_profit_distance` | Choice | 0.50% · 0.75% · 1.00% · 1.50% · 2.00% · 3.00% or more · Not applicable | **Sets the target.** Not applicable means no target. |
| Trade plan | Holding period | `expected_holding_period` | Choice | 1 bar · 2 to 3 bars · 4 to 5 bars · 6 to 8 bars · Not applicable | **Sets the maximum hold** (upper bound). Not applicable means 8 bars. |

**Answer types, as the TypeSafe SDK defines them**

- **Choice:** the selected label, a probability for every label, and a confidence in the selected label.
- **Score:** an expected score that can fall between rubric levels, probabilities for each level, a confidence, and the rubric as a legend.
- **Yes/no:** the probability of a yes answer, from 0 to 1.

## Appendix B. What Jev receives

Each request's state is a JSON object. The drawer shows the exact state under **Request → State sent to Jev**.

| Field | Content |
|---|---|
| `task` | "You are evaluating a trading decision at one specific point in time." |
| `instrument` | Symbol, type, exchange, currency. In blind mode: "Undisclosed" and the type only. |
| `timeframe` | "Daily bars, one per trading day" |
| `decision_point` | "Immediately after the close of bar 90. Bar 90 represents NOW." |
| `causality_rule` | Use only the information provided; there's no access to future bars. |
| `position` | The system is flat and may open a long, open a short, or take no trade. |
| `objective` | Decide whether the OHLCV sequence holds a strong enough short-term opportunity. |
| `expected_trade_horizon` | "Approximately 1 to 8 future bars." |
| `trade_selection` | Trade only with meaningful directional evidence in price and volume. |
| `no_trade_policy` | No trade is a valid outcome and preferred when the structure is unclear, evidence is weak, price action conflicts, the move looks excessively extended, reversal risk is high, or evidence is insufficient. |
| `considerations` | 18 things to weigh, from higher highs and lower lows, breakouts, rejection candles and consolidation, to volume behavior, volatility, overextension and reversal risk. |
| `bars` | Up to 90 daily bars: bar number, date, open, high, low, close, volume. Blind mode drops dates and rebases prices so the first close is 100. |
| `most_recent_price` | The last close |
| `technical_indicators` | Indicator runs only. EMA 20, SMA 50, SMA 200, MACD (12, 26, 9), RSI 14, Stochastic (14, 3, 3), ADX 14, Bollinger Bands (20, 2), ATR 14 and MFI 14, each with values, recent values, a signal, the signal's rule and an explanation. |
| `execution_assumptions` | The decision comes after the close; execution happens no earlier than the next bar; there's no future information; costs and sizing are handled separately. |
| `purpose` | Judge whether the observable state supports a directional trade, not predict the exact price. |

**Size:** about 9,300–10,700 input tokens per request with candles only, and about 12,300 with indicators.

## Appendix C. Screens and animations

### C.1 Pages

| Page | URL | Main elements |
|---|---|---|
| Backtests | `/` | New backtest panel: Pilot and Full suite presets, Add technical indicators, Blind mode, Adjust symbols and cutoffs, the estimate, Review and start → approval dialog. Run cards: action mix bar, Net return, P&L, Win rate, Trades, and Replay / Report / Decisions buttons. |
| Compare runs | `/compare` | Run A and Run B pickers · Headline results with a B minus A column · Cumulative P&L · Did the runs decide the same way? |
| Theater | `/runs/<id>/theater` | Phase chips · candle chart with the Decision marker and hidden-bars zone · decision card · playback bar · Every decision timeline · Scoreboard · Cumulative P&L so far |
| Report | `/runs/<id>/report` | Six headline numbers · Cumulative P&L (with a Table view) · Results by symbol · How the trades ended · Confidence and results · Contradictions to report to the Jev team · When Jev stayed flat · Answers behind winning and losing trades |
| Decisions | `/runs/<id>/decisions` | Symbol filter · Outcome: All / Won / Lost / No trade · sortable columns · Flags badge with a tooltip |
| Decision drawer | any run tab + `?decision=SYMBOL:cutoff` | Result, chart, trade facts, "Contradictions in this decision", the 15 answers in four groups, Request, State sent to Jev, previous and next decision buttons |

The sidebar shows **Lab → Backtests** (with a run count) and **Compare runs**, plus **Running now** with a pulsing dot while a run is live. The run header shows the symbols, decision count, start time, duration, model version and input tokens.

### C.2 Built-in animations

| Element | When | Motion | Duration |
|---|---|---|---|
| Phase chips | Each replay step | Color and background change; finished steps show a check | 180 ms |
| "Jev is reading" placeholder | Reads the bars | Shimmer sweep | 1.4 s loop |
| Decision card | Decides | Fades in, rising 6 px | 240 ms |
| Hidden candles and volume bars | Each bar during Trade plays out | Fade in, rising 6 px | 180 ms, one bar every 280 ms at 1× |
| Entry dot, stop and target lines, price tags | First revealed bar | Appear with the bar | – |
| Exit dot and result label | The bar where the trade exits | Fade in | 180 ms |
| Current decision dot | Replay moves on | Grows to 150% with a ring | 120 ms |
| Scoreboard and P&L curve | Each scored decision | Update | Instant |
| Decision drawer | Opens | Slides in 48 px from the right, fading in | 240 ms |
| Dialogs | Open | Fade in, rising 8 px | 240 ms |
| Live pulse | While a run is live | Pulsing dot | 1.6 s loop |
| Run cards, preset cards, table rows | Hover | Border or background highlight | 120–180 ms |
| Chart crosshairs and tooltips | Pointer over a chart | Follow the pointer | Instant |

All of these switch off when Windows animation effects are off (2.2).

## Appendix D. URL sheet

`SUITE` = `http://127.0.0.1:3000/runs/suite-2026-09-17T12-06-53-944Z`

| Use | URL |
|---|---|
| Backtests | `http://127.0.0.1:3000/` |
| Compare runs | `http://127.0.0.1:3000/compare` |
| Suite Theater, from #1 | `SUITE/theater` |
| Suite Report | `SUITE/report` |
| Suite Decisions | `SUITE/decisions` |
| Theater, animate #28 (Recipe A) | `SUITE/theater?at=27` |
| Theater, #28 finished | `SUITE/theater?at=28` |
| Theater, #24 finished | `SUITE/theater?at=24` |
| Theater, animate #45 | `SUITE/theater?at=44` |
| Theater, #69 finished | `SUITE/theater?at=69` |
| Theater, animate #212 | `SUITE/theater?at=211` |
| Theater, animate #238 | `SUITE/theater?at=237` |
| Theater, final scoreboard | `SUITE/theater?at=300` |
| Drawer #28 | `SUITE/decisions?decision=NVDA%3A28` |
| Drawer #45 | `SUITE/report?decision=NVDA%3A45` |
| Drawer #6 | `SUITE/report?decision=NVDA%3A6` |
| Drawer #69 | `SUITE/report?decision=JPM%3A9` |
| Drawer #212 | `SUITE/report?decision=BTC-USD%3A32` |
| Drawer #238 | `SUITE/report?decision=BTC-USD%3A58` |
| Pilot report | `http://127.0.0.1:3000/runs/pilot-2026-09-17T10-49-40-359Z/report` |
| Pilot with indicators report | `http://127.0.0.1:3000/runs/pilot-indicators-2026-09-17T10-49-20-965Z/report` |

A drawer URL opens the drawer as soon as the page loads. For shots that show how a viewer gets there, click the chip or button named in the shot instead.

**Stills** for thumbnails and posts are in `screenshots/full-suite/`:

| File | Shows |
|---|---|
| `01-report-overview.png` | Report overview |
| `02-theater-nvda-take-profit.png` | Theater on the NVDA take-profit trade |
| `03-every-decision-and-scoreboard.png` | Every decision, with the scoreboard |
| `04-results-by-symbol.png` | Results by symbol |
| `05-trades-and-confidence.png` | How the trades ended, and confidence |
| `06-contradictions-for-jev-team.png` | The contradictions panel |
| `07-decision-nvda-trade.png` | The NVDA trade in the decision drawer |
| `08-jev-answers-nvda.png` | Jev's answers for that decision |

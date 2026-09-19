# Trader behaviour

- Synthetic seed: `1154`.
- Every visible norm is calculated from the prior 30 completed trading days in the generator.
- The eight good-but-lossy days are process-disciplined controls: a large loss does not itself imply a habit problem.
- Habit costs are recomputed from trade arithmetic in the report: excess-size loss, losses after normal trade count, visible profit left by early exits, or follow-on losses from increasing a losing position.
- Jev receives the full ordered trade sequence, all timestamps, sizes, results, hold times, opportunity values, prior-day result and every rolling norm.

## Recorded run

- Model: `jev-1.13.0`; 120 of 120 days cached on 2026-09-19.
- Usage: 193,646 input tokens and 17,003 output tokens.
- Exact pattern: 116/120 (96.7%). Revenge 11/11, overtrading 9/9 and early exit 7/7; two of six averaging-down days were named exactly and four were called revenge.
- The eight good-but-lossy control days produced zero false alarms.
- Reported six-month habit cost is $22,680, recomputed from the trade records rather than model answers.

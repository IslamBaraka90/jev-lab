# Trader behaviour

- Synthetic seed: `1154`.
- Every visible norm is calculated from the prior 30 completed trading days in the generator.
- The eight good-but-lossy days are process-disciplined controls: a large loss does not itself imply a habit problem.
- Habit costs are recomputed from trade arithmetic in the report: excess-size loss, losses after normal trade count, visible profit left by early exits, or follow-on losses from increasing a losing position.
- Jev receives the full ordered trade sequence, all timestamps, sizes, results, hold times, opportunity values, prior-day result and every rolling norm.

# Overfit review

- The generator fixes seed 1184 and the exact PRP mix: 22 parameter cliffs, 18 few-trade results, 14 look-ahead runs, 11 survivorship-flattered runs, 9 cost-free runs and 66 honest modest backtests.
- Labels live only in `data/synthetic/overfit-review.labels.json`. The model receives the curve, the full 5×5 sensitivity grid, trade distribution, stated costs, universe construction, signal/fill timing and research period.
- “Honest” does not mean profitable or production-ready. It means this exercise did not plant one of the five named research failures.
- Honest controls use a non-selected parameter plateau and an untouched 2022–2025 holdout. This prevents the controls themselves from accidentally encoding a parameter-cliff symptom.

# Event clustering

- Seed 1172 creates 380 fictional headlines across 46 events, three days and 22 generic outlets.
- Twelve events have a later material update, eight rumours receive later primary confirmation, and six name-similar event pairs are offered as dangerous near-duplicate candidates.
- Every headline carries its complete title, first sentence, source type, timestamp, citation flag and candidate-cluster context to Jev. Labels and event identity never enter the state.
- Estimated reading time uses 18 seconds per retained headline and is disclosed as an estimate.
- Recorded all 380 cases with `jev-1.13.0` on 2026-09-19, then re-recorded the 46 direct-source items after making their issuer-filing evidence explicit. The two paid batches used 366,658 input tokens and 44,704 output tokens in total.
- Jev achieved 100% precision and recall on candidate joins: 334 correct joins, zero wrong merges and zero missed joins. All six near-duplicate offers stayed apart, producing exactly 46 model clusters and an estimated 94.5 minutes saved once the 19 joined headlines that add a fact are counted as still read (an earlier figure of 100.2 counted them as skipped).
- Primary-source detection reached 100% precision and 93.5% recall (43 of 46), while material-information detection reached 100% precision and 97.0% recall. The three missed primary filings and two missed additions stay visible in the checks.

// The statistics every graded demo shares. A demo's `report()` hands over a confusion matrix and,
// where it can, a verdict per item; everything here is derived from those two things, so fifty
// reports state accuracy, precision and calibration the same way. Pure functions, no dependencies:
// the browser, the scoreboard script and the tests all call the same code.

/** A 95% Wilson score interval for `hits` out of `total`, as shares. Honest at small samples. */
export function wilson(hits, total, z = 1.96) {
  if (!total) return { low: 0, high: 0 };
  const share = hits / total;
  const denominator = 1 + (z * z) / total;
  const centre = share + (z * z) / (2 * total);
  const margin = z * Math.sqrt((share * (1 - share) + (z * z) / (4 * total)) / total);
  return { low: Math.max(0, (centre - margin) / denominator), high: Math.min(1, (centre + margin) / denominator) };
}

const safe = (top, bottom) => (bottom ? top / bottom : null);

/**
 * Per-class precision, recall and F1 from a confusion matrix in the report's shape:
 * `{ columns: [predicted…], rows: [{ label: actual, cells: [{ count }] }] }`.
 * Rows and columns may differ (a demo can predict a class nobody planted), so classes are matched by name.
 */
export function matrixStats(matrix) {
  if (!matrix?.rows?.length) return null;
  const columns = matrix.columns.map(String);
  const rows = matrix.rows.map((row) => ({
    label: String(row.label),
    counts: row.cells.map((cell) => cell.count ?? 0),
    // A demo marks the agreeing cell itself; names are only a fallback, since headers get shortened.
    diagonal: row.cells.findIndex((cell) => cell.diagonal),
  }));
  const total = rows.reduce((sum, row) => sum + row.counts.reduce((a, b) => a + b, 0), 0);
  if (!total) return null;

  const key = (text) => text.trim().toLowerCase();
  const columnIndex = new Map(columns.map((column, index) => [key(column), index]));
  const columnTotals = columns.map((_, index) => rows.reduce((sum, row) => sum + row.counts[index], 0));

  let correct = 0;
  const classes = rows.map((row) => {
    const support = row.counts.reduce((a, b) => a + b, 0);
    const index = row.diagonal >= 0 ? row.diagonal : columnIndex.get(key(row.label));
    const hit = index === undefined ? 0 : row.counts[index];
    const predicted = index === undefined ? 0 : columnTotals[index];
    correct += hit;
    const precision = safe(hit, predicted);
    const recall = safe(hit, support);
    const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : precision === null && recall === null ? null : 0;
    return { label: row.label, support, predicted, hit, precision, recall, f1 };
  });

  const scored = classes.filter((entry) => entry.support > 0);
  const majority = Math.max(...classes.map((entry) => entry.support));
  return {
    total,
    correct,
    accuracy: correct / total,
    interval: wilson(correct, total),
    macroF1: scored.length ? scored.reduce((sum, entry) => sum + (entry.f1 ?? 0), 0) / scored.length : null,
    // What always answering the commonest class would score. Accuracy means little without it.
    majorityBaseline: majority / total,
    majorityClass: classes.find((entry) => entry.support === majority)?.label ?? null,
    classes,
  };
}

/**
 * Confidence against correctness, in equal-width buckets. `grades` is a list of `{ agree, confidence }`.
 * The gap between what the model claimed and what happened, weighted by bucket size, is the expected
 * calibration error: 0 means a 70% answer is right 70% of the time.
 */
export function reliability(grades, bucketCount = 5) {
  const usable = grades.filter((grade) => typeof grade?.agree === 'boolean' && Number.isFinite(grade.confidence));
  if (usable.length < 10) return null;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ from: index / bucketCount, to: (index + 1) / bucketCount, count: 0, right: 0, claimed: 0 }));
  for (const grade of usable) {
    const bucket = buckets[Math.min(bucketCount - 1, Math.floor(grade.confidence * bucketCount))];
    bucket.count += 1;
    bucket.right += grade.agree ? 1 : 0;
    bucket.claimed += grade.confidence;
  }
  const filled = buckets.filter((bucket) => bucket.count);
  const ece = filled.reduce((sum, bucket) => sum + (bucket.count / usable.length) * Math.abs(bucket.right / bucket.count - bucket.claimed / bucket.count), 0);
  return {
    total: usable.length,
    ece,
    buckets: buckets.map((bucket) => ({
      ...bucket,
      accuracy: bucket.count ? bucket.right / bucket.count : null,
      meanConfidence: bucket.count ? bucket.claimed / bucket.count : null,
      interval: wilson(bucket.right, bucket.count),
    })),
  };
}

/**
 * What happens at each confidence bar: how much clears it, and how much of that was right. This is
 * the "how much can run without a person" curve, available to any demo that grades its items.
 */
export function automationCurve(grades, steps = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99]) {
  const usable = grades.filter((grade) => typeof grade?.agree === 'boolean' && Number.isFinite(grade.confidence));
  if (usable.length < 10) return null;
  return steps.map((threshold) => {
    const cleared = usable.filter((grade) => grade.confidence >= threshold);
    const right = cleared.filter((grade) => grade.agree).length;
    return { threshold, cleared: cleared.length, share: cleared.length / usable.length, right, wrong: cleared.length - right, precision: safe(right, cleared.length) };
  });
}

/** Agreement over a list of grades, with its interval. Ungraded items are left out, not counted wrong. */
export function agreement(grades) {
  const graded = grades.filter((grade) => typeof grade?.agree === 'boolean');
  const right = graded.filter((grade) => grade.agree).length;
  return { graded: graded.length, right, share: safe(right, graded.length), interval: wilson(right, graded.length) };
}

export const percent = (share, digits = 1) => (share === null || share === undefined || Number.isNaN(share) ? '–' : `${(share * 100).toFixed(share === 1 || share === 0 ? 0 : digits)}%`);

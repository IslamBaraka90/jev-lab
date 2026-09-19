// The rule is deliberately compact because it is both executable and the teaching artifact.

// #region demo:data
export function qualifyingPullbacks(bars, limit = 20) {
  const candidates = [];
  for (let index = 34; index < bars.length - 10; index++) {
    const prior = bars.slice(index - 20, index);
    const average = prior.reduce((sum, bar) => sum + bar.close, 0) / prior.length;
    const older = bars.slice(index - 25, index - 5).reduce((sum, bar) => sum + bar.close, 0) / 20;
    const rangePercent = prior.reduce((sum, bar) => sum + (bar.high - bar.low) / bar.close, 0) / 20 * 100;
    const bar = bars[index];
    const conditions = {
      risingAverage: average > older,
      touchedAverage: bar.low <= average * 1.01,
      heldPullbackFloor: bar.close >= average * 0.97,
      ordinaryRange: rangePercent >= 0.5 && rangePercent <= 5,
    };
    if (Object.values(conditions).every(Boolean)) candidates.push({ index, average, older, rangePercent, conditions, distance: Math.abs(bar.close - average) / average });
  }
  return candidates.sort((left, right) => left.distance - right.distance).slice(0, limit).sort((left, right) => left.index - right.index);
}
// #endregion

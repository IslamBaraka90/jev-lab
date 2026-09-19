// A close outside the preceding twenty-session range, separated from the prior signal by four bars.

export function rangeBreaks(bars) {
  const found = [];
  let lastSignal = -10;
  for (let index = 20; index < bars.length; index++) {
    const lookback = bars.slice(index - 20, index);
    const priorHigh = Math.max(...lookback.map((bar) => bar.high));
    const priorLow = Math.min(...lookback.map((bar) => bar.low));
    const close = bars[index].close;
    const direction = close > priorHigh ? 'LONG' : close < priorLow ? 'SHORT' : null;
    if (!direction || index - lastSignal < 4) continue;
    found.push({ index, direction, conditions: { close, prior20High: priorHigh, prior20Low: priorLow, rule: direction === 'LONG' ? 'close above the prior twenty-session high' : 'close below the prior twenty-session low' } });
    lastSignal = index;
  }
  return found;
}

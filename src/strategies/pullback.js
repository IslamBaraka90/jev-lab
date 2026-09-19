// A readable daily moving-average pullback detector. It emits the setup bar and direction only; the
// generator attaches calendar context and later outcomes outside the model state.

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function movingAveragePullbacks(bars) {
  const found = [];
  let lastSignal = -10;
  for (let index = 50; index < bars.length; index++) {
    const bar = bars[index];
    const sma20 = mean(bars.slice(index - 19, index + 1).map((entry) => entry.close));
    const sma50 = mean(bars.slice(index - 49, index + 1).map((entry) => entry.close));
    const long = bar.close > sma50 && bar.low <= sma20 * 1.006 && bar.close >= sma20;
    const short = bar.close < sma50 && bar.high >= sma20 * 0.994 && bar.close <= sma20;
    if ((!long && !short) || index - lastSignal < 4) continue;
    found.push({ index, direction: long ? 'LONG' : 'SHORT', conditions: { close: bar.close, sma20: Number(sma20.toFixed(4)), sma50: Number(sma50.toFixed(4)), rule: long ? 'close above 50-day mean; intraday pullback touched the 20-day mean and recovered' : 'close below 50-day mean; intraday rally touched the 20-day mean and failed' } });
    lastSignal = index;
  }
  return found;
}

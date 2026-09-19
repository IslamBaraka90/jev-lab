// Every fifty-over-two-hundred crossover in the cached history, found by the rule in
// src/strategies/golden-cross.js and nothing else. Nothing is invented here: the bars are real, the
// crosses are wherever the rule says they are, and the trade that follows each one is scored in the
// report from the bars that really came next.
//
// There are no labels. The ground truth is the price.

import { context, crossovers, levels } from '../../src/strategies/golden-cross.js';
import { candles, MARKET_NOTE } from './lib/market.js';

export const SEED = 1181;

const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT', 'GLD', 'SPY', 'XLE', 'BTC-USD'];

const SHOWN = 90;
const HELD = 20;

export function generate(seed = SEED) {
  const items = [];

  for (const symbol of SYMBOLS) {
    const bars = candles(symbol).bars;
    const found = crossovers(bars).filter((cross) => cross.index + HELD < bars.length && cross.index >= SHOWN);
    found.forEach((cross, order) => {
      const previous = found[order - 1];
      items.push(cross_(symbol, bars, cross, previous ? cross.index - previous.index : null));
    });
  }

  items.sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
  items.forEach((item, index) => { item.id = `GX-${String(index + 1).padStart(4, '0')}`; });

  return {
    dataset: {
      id: 'golden-cross-review',
      class: 'cached-real',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/golden-cross-review.js',
      context: {
        rule: 'The fifty-day simple moving average closing above the two-hundred-day, having been at or below it on the previous bar.',
        detector: 'src/strategies/golden-cross.js',
        barsShown: SHOWN,
        holdingPeriodBars: HELD,
        costPercentPerTrade: 0.1,
        note: `${MARKET_NOTE} Every cross on this page is one the rule really found in the cached bars; none were chosen. The trade scored in the report is a close at the cross bar, held twenty sessions, with a tenth of a per cent of cost applied the same way to every approach compared.`,
      },
      items,
    },
  };
}

// #region demo:data
/** One crossover: the chart up to it, the two averages, and the levels a stop could use. */
function cross_(symbol, bars, cross, barsSinceLast) {
  const shape = context(bars, cross.index);
  const window = bars.slice(cross.index - SHOWN + 1, cross.index + HELD + 1);

  return {
    id: null,
    symbol,
    date: cross.date,
    close: shape.close,
    fastMa: shape.fastMa,
    slowMa: shape.slowMa,
    gapPercent: shape.gapPercent,
    fastSlopePercent: shape.fastSlopePercent,
    slowSlopePercent: shape.slowSlopePercent,
    priceAboveSlowPercent: shape.priceAboveSlowPercent,
    sixtyDayRangePercent: shape.sixtyDayRangePercent,
    averageTrueRangePercent: shape.averageTrueRangePercent,
    volumeAgainstAverage: shape.volumeAgainstAverage,
    barsSinceLastCross: barsSinceLast,
    stopLevels: levels(bars, cross.index),
    chart: {
      markIndex: SHOWN - 1,
      label: `${symbol} · 50 over 200 on ${cross.date}`,
      bars: window.map((bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${Math.round((bar.volume ?? 0) / 1000)}`),
    },
  };
}
// #endregion

const round = (value, digits) => Number(value.toFixed(digits));

/**
 * Spreads `cutoffs` decision points evenly from `warmupMonths` after `start` (YYYY-MM-DD) to the
 * last candle that still has `horizonBars` candles after it.
 *
 * Each cutoff has `history`, every candle up to and including the cutoff, and `future`, the
 * candles after it that are only used to score the trade.
 */
export function selectCutoffs(candles, { start, cutoffs, warmupMonths, horizonBars }) {
  const warmupEnd = addMonths(start, warmupMonths);
  const first = candles.findLastIndex((candle) => candle.date < warmupEnd);
  const last = candles.length - 1 - horizonBars;
  if (first < 0 || last - first < cutoffs - 1) {
    throw new Error(`${candles.length} candles are not enough for ${cutoffs} cutoffs.`);
  }

  const step = cutoffs > 1 ? (last - first) / (cutoffs - 1) : 0;
  return Array.from({ length: cutoffs }, (_, i) => {
    const index = Math.round(first + i * step);
    return {
      index,
      history: candles.slice(0, index + 1),
      future: candles.slice(index + 1, index + 1 + horizonBars),
    };
  });
}

/**
 * Simulates a trade that enters at the open of the first future candle.
 *
 * The trade exits at the stop or target price when a candle reaches it, at the open when a candle
 * gaps past it, or at the close of candle `maxBars`. When one daily candle reaches both levels the
 * order is unknown, so the stop is assumed to come first. `costBpsPerSide` is charged on entry and
 * on exit, and `pnl` is the net return on a position of `notional`.
 */
export function simulateTrade({ side, stopLossPct, takeProfitPct, maxBars }, future, { costBpsPerSide, notional }) {
  const direction = side === 'LONG' ? 1 : -1;
  const bars = future.slice(0, maxBars);
  const entryPrice = bars[0].open;
  const stopPrice = stopLossPct === null ? null : entryPrice * (1 - (direction * stopLossPct) / 100);
  const targetPrice = takeProfitPct === null ? null : entryPrice * (1 + (direction * takeProfitPct) / 100);
  // How far `price` is past `level` in the trade's favour (negative when it is on the losing side).
  const gain = (price, level) => direction * (price - level);

  const exitAt = (bar) => {
    const worst = direction === 1 ? bar.low : bar.high;
    const best = direction === 1 ? bar.high : bar.low;
    if (stopPrice !== null && gain(bar.open, stopPrice) <= 0) return { price: bar.open, reason: 'stop_loss' };
    if (targetPrice !== null && gain(bar.open, targetPrice) >= 0) return { price: bar.open, reason: 'take_profit' };
    if (stopPrice !== null && gain(worst, stopPrice) <= 0) return { price: stopPrice, reason: 'stop_loss' };
    if (targetPrice !== null && gain(best, targetPrice) >= 0) return { price: targetPrice, reason: 'take_profit' };
  };

  for (const [i, bar] of bars.entries()) {
    const exit = exitAt(bar) ?? (i === bars.length - 1 ? { price: bar.close, reason: 'time_exit' } : undefined);
    if (!exit) continue;

    const grossReturnPct = (gain(exit.price, entryPrice) / entryPrice) * 100;
    const netReturnPct = grossReturnPct - (2 * costBpsPerSide) / 100;
    return {
      side,
      entryDate: bars[0].date,
      entryPrice,
      stopPrice: stopPrice === null ? null : round(stopPrice, 4),
      targetPrice: targetPrice === null ? null : round(targetPrice, 4),
      exitDate: bar.date,
      exitPrice: round(exit.price, 4),
      exitReason: exit.reason,
      barsHeld: i + 1,
      grossReturnPct: round(grossReturnPct, 4),
      netReturnPct: round(netReturnPct, 4),
      pnl: round((notional * netReturnPct) / 100, 2),
    };
  }
}

// Close-to-close change from the cutoff close to each future close, in percent.
export function forwardReturnsPct(close, future) {
  return future.map((bar) => round((bar.close / close - 1) * 100, 4));
}

/**
 * Totals for a set of decisions: actions, trade results overall and by side, exit reasons, token
 * usage, and `alwaysLong`, the result of going long at every cutoff (each decision's `baseline`).
 * Works on saved decisions and on the dashboard's decision views, which keep usage at the top level.
 */
export function summarizeDecisions(decisions) {
  const trades = decisions.map((decision) => decision.trade).filter(Boolean);
  const count = (items, test) => items.filter(test).length;
  const tokens = (field) =>
    decisions.reduce((sum, decision) => sum + ((decision.usage ?? decision.response?.usage)?.[field] ?? 0), 0);

  return {
    decisions: decisions.length,
    failed: count(decisions, (decision) => decision.error),
    long: count(decisions, (decision) => decision.action === 'LONG'),
    short: count(decisions, (decision) => decision.action === 'SHORT'),
    noTrade: count(decisions, (decision) => decision.action === 'NO_TRADE'),
    ...tradeResults(trades),
    bySide: {
      LONG: tradeResults(trades.filter((trade) => trade.side === 'LONG')),
      SHORT: tradeResults(trades.filter((trade) => trade.side === 'SHORT')),
    },
    exitReasons: {
      take_profit: count(trades, (trade) => trade.exitReason === 'take_profit'),
      stop_loss: count(trades, (trade) => trade.exitReason === 'stop_loss'),
      time_exit: count(trades, (trade) => trade.exitReason === 'time_exit'),
    },
    alwaysLong: tradeResults(decisions.map((decision) => decision.baseline).filter(Boolean)),
    usage: { input_tokens: tokens('input_tokens'), output_tokens: tokens('output_tokens') },
  };
}

function tradeResults(trades) {
  const netReturns = trades.map((trade) => trade.netReturnPct);
  const totalNetReturnPct = netReturns.reduce((sum, value) => sum + value, 0);
  const wins = netReturns.filter((value) => value > 0).length;
  return {
    trades: trades.length,
    wins,
    losses: netReturns.filter((value) => value < 0).length,
    winRatePct: trades.length ? round((wins / trades.length) * 100, 1) : null,
    totalNetReturnPct: round(totalNetReturnPct, 4),
    averageNetReturnPct: trades.length ? round(totalNetReturnPct / trades.length, 4) : null,
    totalPnl: round(trades.reduce((sum, trade) => sum + trade.pnl, 0), 2),
  };
}

function addMonths(day, months) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

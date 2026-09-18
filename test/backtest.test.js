import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTradeDecisionState, tradePlanFromAnswers } from '../src/questions/trade-decision.js';
import { selectCutoffs, simulateTrade, summarizeDecisions } from '../src/services/backtest.js';

const bar = (date, open, high, low, close) => ({ date, open, high, low, close, volume: 1000 });
const costs = { costBpsPerSide: 5, notional: 10_000 };

test('selectCutoffs spreads cutoffs from the warm-up to the last candle with a full horizon', () => {
  // One candle a day from 2024-01-01. Evaluation starts 2024-02-01, so the three warm-up months end
  // on 2024-04-30 (index 120).
  const candles = Array.from({ length: 300 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    return bar(date, 100, 101, 99, 100);
  });

  const cutoffs = selectCutoffs(candles, { start: '2024-02-01', cutoffs: 12, warmupMonths: 3, horizonBars: 8 });

  assert.equal(cutoffs.length, 12);
  assert.equal(cutoffs[0].index, 120);
  assert.equal(cutoffs.at(-1).index, 291);
  for (const [i, { index, history, future }] of cutoffs.entries()) {
    if (i > 0) assert.ok(index > cutoffs[i - 1].index);
    assert.deepEqual(history, candles.slice(0, index + 1));
    assert.deepEqual(future, candles.slice(index + 1, index + 9));
  }
});

test('simulateTrade exits a long at the take-profit price', () => {
  const trade = simulateTrade(
    { side: 'LONG', stopLossPct: 1, takeProfitPct: 2, maxBars: 3 },
    [bar('d1', 100, 101, 99.5, 100.5), bar('d2', 100.5, 102.5, 100, 102), bar('d3', 102, 103, 101, 102)],
    costs,
  );

  assert.equal(trade.exitReason, 'take_profit');
  assert.equal(trade.exitDate, 'd2');
  assert.equal(trade.exitPrice, 102);
  assert.equal(trade.barsHeld, 2);
  assert.equal(trade.grossReturnPct, 2);
  assert.equal(trade.netReturnPct, 1.9);
  assert.equal(trade.pnl, 190);
});

test('simulateTrade assumes the stop came first when one candle reaches both levels', () => {
  const trade = simulateTrade(
    { side: 'LONG', stopLossPct: 1, takeProfitPct: 2, maxBars: 3 },
    [bar('d1', 100, 102.5, 98.5, 101)],
    costs,
  );

  assert.equal(trade.exitReason, 'stop_loss');
  assert.equal(trade.exitPrice, 99);
  assert.equal(trade.grossReturnPct, -1);
});

test('simulateTrade fills at the open when a candle gaps past the stop', () => {
  const trade = simulateTrade(
    { side: 'LONG', stopLossPct: 1, takeProfitPct: 2, maxBars: 3 },
    [bar('d1', 100, 100.5, 99.5, 99.8), bar('d2', 98, 98.5, 97, 98.2)],
    costs,
  );

  assert.equal(trade.exitReason, 'stop_loss');
  assert.equal(trade.exitPrice, 98);
  assert.equal(trade.grossReturnPct, -2);
});

test('simulateTrade closes a short at the last close when neither level is reached', () => {
  const trade = simulateTrade(
    { side: 'SHORT', stopLossPct: 1, takeProfitPct: 2, maxBars: 2 },
    [bar('d1', 100, 100.5, 99, 99.5), bar('d2', 99.5, 100, 98.5, 99), bar('d3', 99, 99, 90, 90)],
    costs,
  );

  assert.equal(trade.stopPrice, 101);
  assert.equal(trade.targetPrice, 98);
  assert.equal(trade.exitReason, 'time_exit');
  assert.equal(trade.exitDate, 'd2');
  assert.equal(trade.grossReturnPct, 1);
});

test('tradePlanFromAnswers reads levels from the answer labels', () => {
  const answers = (decision, stop, target, holding) => ({
    trade_decision: { choice: decision },
    stop_loss_distance: { choice: stop },
    take_profit_distance: { choice: target },
    expected_holding_period: { choice: holding },
  });

  assert.equal(tradePlanFromAnswers(answers('NO_TRADE', '1.00_PERCENT', '2.00_PERCENT', '1_BAR'), { horizonBars: 8 }), null);
  assert.deepEqual(
    tradePlanFromAnswers(answers('LONG', '0.75_PERCENT', '3.00_PERCENT_OR_MORE', '2_TO_3_BARS'), { horizonBars: 8 }),
    { side: 'LONG', stopLossPct: 0.75, takeProfitPct: 3, maxBars: 3 },
  );
  assert.deepEqual(
    tradePlanFromAnswers(answers('SHORT', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'NOT_APPLICABLE'), { horizonBars: 8 }),
    { side: 'SHORT', stopLossPct: null, takeProfitPct: null, maxBars: 8 },
  );
});

const instrument = { symbol: 'AAPL', currency: 'USD', exchange: 'NasdaqGS', instrumentType: 'EQUITY' };

test('buildTradeDecisionState shows the last lookbackBars candles and hides identity when blind', () => {
  const history = [bar('2026-09-14', 150, 151, 149, 150), bar('2026-09-15', 198, 202, 196, 200), bar('2026-09-16', 200, 210, 199, 209)];

  const named = buildTradeDecisionState({ instrument, history, lookbackBars: 2, horizonBars: 8 });
  const blind = buildTradeDecisionState({ instrument, history, lookbackBars: 2, horizonBars: 8, blind: true });

  assert.equal(named.instrument.symbol, 'AAPL');
  assert.equal(named.bars.length, 2);
  assert.deepEqual(named.bars[1], { bar: 2, date: '2026-09-16', open: 200, high: 210, low: 199, close: 209, volume: 1000 });
  assert.equal(named.most_recent_price, 209);
  assert.match(named.decision_point, /bar 2 represents NOW/i);
  assert.equal(named.technical_indicators, undefined);

  // Rebased so the first close shown (200) is 100.
  assert.deepEqual(blind.instrument, { symbol: 'Undisclosed', type: 'EQUITY' });
  assert.deepEqual(blind.bars[1], { bar: 2, open: 100, high: 105, low: 99.5, close: 104.5, volume: 1000 });
  assert.equal(blind.most_recent_price, 104.5);
  assert.doesNotMatch(JSON.stringify(blind), /AAPL|NasdaqGS|2026-/);
});

test('buildTradeDecisionState adds indicators from the whole history, rebased when blind', () => {
  const history = Array.from({ length: 260 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    return bar(date, 1000 + i, 1001 + i, 999 + i, 1000 + i);
  });
  const sma200 = (state) => state.technical_indicators.indicators.find((indicator) => indicator.name === 'SMA(200)');

  const named = buildTradeDecisionState({ instrument, history, lookbackBars: 90, horizonBars: 8, indicators: true });
  const blind = buildTradeDecisionState({ instrument, history, lookbackBars: 90, horizonBars: 8, indicators: true, blind: true });

  assert.equal(named.bars.length, 90);
  assert.equal(named.technical_indicators.indicators.length, 10);
  assert.ok(named.considerations.includes('the supplied technical indicator values and signals'));
  // SMA(200) needs candles from before the 90 shown: the mean of closes 1060 to 1259.
  assert.equal(sma200(named).values.value, 1159.5);
  // Blind prices are rebased so the first close shown (1170) is 100.
  assert.equal(sma200(blind).values.value, Number(((1159.5 * 100) / 1170).toFixed(2)));
  assert.doesNotMatch(JSON.stringify(blind), /AAPL|NasdaqGS|2025-/);
});

test('summarizeDecisions totals actions, results by side, exits, the always-long baseline and tokens', () => {
  const usage = { input_tokens: 100, output_tokens: 10 };
  const summary = summarizeDecisions([
    {
      action: 'LONG',
      trade: { side: 'LONG', netReturnPct: 1.9, pnl: 190, exitReason: 'take_profit' },
      baseline: { netReturnPct: 2.5, pnl: 250 },
      response: { usage },
    },
    {
      action: 'SHORT',
      trade: { side: 'SHORT', netReturnPct: -1.1, pnl: -110, exitReason: 'stop_loss' },
      baseline: { netReturnPct: 0.9, pnl: 90 },
      response: { usage },
    },
    { action: 'NO_TRADE', trade: null, baseline: { netReturnPct: -0.4, pnl: -40 }, response: { usage } },
    { error: { message: 'timeout' }, trade: null, baseline: null },
  ]);

  const results = (trades, wins, losses, winRatePct, total, average, pnl) => ({
    trades,
    wins,
    losses,
    winRatePct,
    totalNetReturnPct: total,
    averageNetReturnPct: average,
    totalPnl: pnl,
  });
  assert.deepEqual(summary, {
    decisions: 4,
    failed: 1,
    long: 1,
    short: 1,
    noTrade: 1,
    ...results(2, 1, 1, 50, 0.8, 0.4, 80),
    bySide: { LONG: results(1, 1, 0, 100, 1.9, 1.9, 190), SHORT: results(1, 0, 1, 0, -1.1, -1.1, -110) },
    exitReasons: { take_profit: 1, stop_loss: 1, time_exit: 0 },
    alwaysLong: results(3, 2, 1, 66.7, 3, 1, 300),
    usage: { input_tokens: 300, output_tokens: 30 },
  });
});

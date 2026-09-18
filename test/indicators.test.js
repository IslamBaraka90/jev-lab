import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rsi } from 'fintech-algorithms/technical-indicators/momentum/rsi';
import { calculateSma } from 'fintech-algorithms/technical-indicators/trend-smoothing/sma';
import { macd } from 'fintech-algorithms/technical-indicators/trend-systems/macd';
import { describeIndicators } from '../src/services/indicators.js';

const toCandles = (closes) =>
  closes.map((close, i) => ({ date: `d${i}`, open: close, high: close + 1, low: close - 1, close, volume: 1000 + (i % 7) * 100 }));
const round = (value, digits) => Number(value.toFixed(digits));
const byName = (indicators) => Object.fromEntries(indicators.map((indicator) => [indicator.name, indicator]));

test('describeIndicators reports ten indicators with the library values at the last candle', () => {
  const closes = Array.from({ length: 260 }, (_, i) => 100 + i * 0.5 + Math.sin(i / 3) * 2);

  const { summary, indicators } = describeIndicators(toCandles(closes));
  const named = byName(indicators);

  assert.deepEqual(Object.keys(named), [
    'EMA(20)',
    'SMA(50)',
    'SMA(200)',
    'MACD(12, 26, 9)',
    'RSI(14)',
    'Stochastic(14, 3, 3)',
    'ADX(14)',
    'Bollinger Bands(20, 2)',
    'ATR(14)',
    'MFI(14)',
  ]);
  assert.equal(named['SMA(50)'].values.value, round(calculateSma(closes, 50).at(-1), 2));
  assert.equal(named['RSI(14)'].values.rsi, round(rsi(closes, 14).rsi.at(-1), 2));
  const lastMacd = macd(closes, 12, 26, 9).at(-1);
  const macdIndicator = named['MACD(12, 26, 9)'];
  assert.deepEqual(macdIndicator.values, {
    macd_line: round(lastMacd.macd, 3),
    signal_line: round(lastMacd.signal, 3),
    histogram: round(lastMacd.histogram, 3),
  });
  assert.deepEqual(macdIndicator.recent.map((row) => row.bars_ago), [4, 3, 2, 1, 0]);
  assert.equal(macdIndicator.recent.at(-1).histogram, macdIndicator.values.histogram);
  assert.match(macdIndicator.explanation, new RegExp(`histogram is ${macdIndicator.values.histogram}`));

  // A steady uptrend closes above all three moving averages, with SMA(50) above SMA(200).
  for (const name of ['EMA(20)', 'SMA(50)', 'SMA(200)']) assert.equal(named[name].signal, 'bullish');
  assert.match(named['SMA(200)'].explanation, /golden cross/);
  assert.equal(named['ATR(14)'].signal, 'not directional');
  assert.equal(summary.bullish + summary.bearish + summary.neutral, 9);
});

test('describeIndicators applies the RSI rule and marks indicators without enough history', () => {
  // 40 falling closes, then a small bounce: RSI is deep in oversold territory and rising.
  const closes = [...Array.from({ length: 40 }, (_, i) => 200 - i * 2), 122.5];

  const named = byName(describeIndicators(toCandles(closes)).indicators);

  assert.ok(named['RSI(14)'].values.rsi < 30);
  assert.equal(named['RSI(14)'].signal, 'bullish');
  assert.equal(named['EMA(20)'].signal, 'bearish');
  assert.equal(named['SMA(50)'].signal, 'unavailable');
  assert.equal(named['SMA(200)'].signal, 'unavailable');
});

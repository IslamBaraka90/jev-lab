// The cached market data, read straight off disk for the generators that build on real prices.
// Synchronous on purpose: a generator has to be a pure function of its seed, and awaiting files in the
// middle of one makes that harder to reason about than it needs to be.
//
// Everything here comes from data/market, which is fetched by hand with scripts/fetch-market.js and
// committed. Nothing in the site or the build ever fetches anything.

import { readFileSync } from 'node:fs';
import { marketFile } from '../../../src/services/dataset.js';

const cache = new Map();

/** One symbol's daily candles: `{ symbol, currency, bars: [{ date, open, high, low, close, volume }] }`. */
export function candles(symbol) {
  const key = `candles:${symbol}`;
  if (!cache.has(key)) cache.set(key, JSON.parse(readFileSync(marketFile('candles', `${symbol}.json`), 'utf8')));
  return cache.get(key);
}

/** One symbol's annual fundamentals, newest year first. The cached files are not in year order — the
 *  fetcher sorted on a value that was not a date string — so the sort happens here, once, on load. */
export function fundamentals(symbol) {
  const key = `fundamentals:${symbol}`;
  if (!cache.has(key)) {
    const data = JSON.parse(readFileSync(marketFile('fundamentals', `${symbol}.json`), 'utf8'));
    data.annual = [...data.annual].sort((left, right) => String(right.fiscalYearEnd).localeCompare(String(left.fiscalYearEnd)));
    cache.set(key, data);
  }
  return cache.get(key);
}

const round = (value, digits = 2) => Number(value.toFixed(digits));

/** The last close, and the day it was on. */
export function last(symbol) {
  const bars = candles(symbol).bars;
  return { price: bars.at(-1).close, date: bars.at(-1).date };
}

/** Total return over the last `days` trading days, as a percentage. */
export function returnOver(symbol, days = 252) {
  const bars = candles(symbol).bars;
  const from = bars[Math.max(0, bars.length - 1 - days)].close;
  return round(((bars.at(-1).close - from) / from) * 100);
}

/** Annualised volatility of daily returns over the last `days` trading days, as a percentage. */
export function volatility(symbol, days = 252) {
  const bars = candles(symbol).bars.slice(-days - 1);
  const moves = bars.slice(1).map((bar, index) => Math.log(bar.close / bars[index].close));
  const mean = moves.reduce((sum, value) => sum + value, 0) / moves.length;
  const variance = moves.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (moves.length - 1);
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

/** The largest peak-to-trough fall over the last `days` trading days, as a percentage. */
export function drawdown(symbol, days = 252) {
  const bars = candles(symbol).bars.slice(-days);
  let peak = bars[0].close;
  let worst = 0;
  for (const bar of bars) {
    peak = Math.max(peak, bar.close);
    worst = Math.min(worst, (bar.close - peak) / peak);
  }
  return round(worst * 100);
}

/** Average daily volume in shares over the last `days` trading days. */
export function averageVolume(symbol, days = 60) {
  const bars = candles(symbol).bars.slice(-days).filter((bar) => Number.isFinite(bar.volume) && bar.volume > 0);
  if (!bars.length) return 0;
  return Math.round(bars.reduce((sum, bar) => sum + bar.volume, 0) / bars.length);
}

/** Correlation of daily returns between two symbols over the last `days` trading days. */
export function correlation(left, right, days = 252) {
  const a = candles(left).bars.slice(-days - 1);
  const b = candles(right).bars.slice(-days - 1);
  const size = Math.min(a.length, b.length);
  const moves = (bars) => bars.slice(bars.length - size).slice(1).map((bar, index) => Math.log(bar.close / bars[bars.length - size + index].close));
  const x = moves(a);
  const y = moves(b);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(x);
  const my = mean(y);
  let top = 0;
  let leftSum = 0;
  let rightSum = 0;
  for (let index = 0; index < x.length; index++) {
    top += (x[index] - mx) * (y[index] - my);
    leftSum += (x[index] - mx) ** 2;
    rightSum += (y[index] - my) ** 2;
  }
  return round(top / Math.sqrt(leftSum * rightSum), 3);
}

/** What the cached file says this symbol is, for sector and currency. */
export function profile(symbol) {
  const data = fundamentals(symbol);
  return { symbol, sector: data.sector, industry: data.industry, currency: candles(symbol).currency };
}

/** The line every demo built on this data puts on its page. */
export const MARKET_NOTE = 'Prices, volumes and fundamentals are real, cached once from Yahoo Finance and committed. Nothing is fetched at build time or in the browser, and none of this is investment advice.';

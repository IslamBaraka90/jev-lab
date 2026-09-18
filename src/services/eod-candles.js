import { yahooFinance } from '../lib/yahoo-finance.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches daily (end-of-day) OHLCV candles from Yahoo Finance, oldest first.
 *
 * Only finished sessions are returned: days without prices, such as holidays, and a session that
 * is still trading are left out. `date` is the trading day in the exchange's timezone, and prices
 * are rounded to the number of decimals Yahoo shows for the symbol.
 *
 * @param {string} symbol Yahoo Finance symbol, e.g. "AAPL", "SAP.DE", "BTC-USD" or "EURUSD=X".
 * @param {{ from: string, to?: string }} range Trading days as YYYY-MM-DD, both inclusive.
 *   `to` defaults to the latest finished session.
 * @returns {Promise<{
 *   symbol: string,
 *   currency: string,
 *   exchange: string,
 *   instrumentType: string,
 *   candles: { date: string, open: number, high: number, low: number, close: number, volume: number }[],
 * }>}
 */
export async function fetchEodCandles(symbol, { from, to }) {
  // Some markets stamp a trading day's candle on the previous UTC day (FX at 23:00 UTC, for
  // example), so query a day either side of the range and filter by trading day afterwards.
  const { meta, quotes } = await yahooFinance.chart(symbol, {
    period1: shiftDays(from, -1),
    period2: to === undefined ? new Date() : shiftDays(to, 1),
    interval: '1d',
  });

  const tradingDay = dayFormatter(meta.exchangeTimezoneName);
  const round = (price) => Number(price.toFixed(meta.priceHint));
  // While a session is trading, Yahoo includes its candle with the prices and volume so far.
  const session = meta.currentTradingPeriod.regular;
  const unfinishedDay = Date.now() < session.end.getTime() ? tradingDay(session.start) : undefined;

  const candles = quotes
    .filter((quote) => [quote.open, quote.high, quote.low, quote.close, quote.volume].every(Number.isFinite))
    .map((quote) => ({
      date: tradingDay(quote.date),
      open: round(quote.open),
      high: round(quote.high),
      low: round(quote.low),
      close: round(quote.close),
      volume: quote.volume,
    }))
    .filter(({ date }) => date >= from && (to === undefined || date <= to) && date !== unfinishedDay);

  return {
    symbol: meta.symbol,
    currency: meta.currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    instrumentType: meta.instrumentType,
    candles,
  };
}

function shiftDays(day, days) {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day) : NaN;
  if (Number.isNaN(time)) throw new TypeError(`Expected a YYYY-MM-DD date, got "${day}"`);
  return new Date(time + days * DAY_MS);
}

// Returns a function that formats a Date as YYYY-MM-DD in the given IANA timezone.
function dayFormatter(timeZone) {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (date) => {
    const { year, month, day } = Object.fromEntries(format.formatToParts(date).map(({ type, value }) => [type, value]));
    return `${year}-${month}-${day}`;
  };
}

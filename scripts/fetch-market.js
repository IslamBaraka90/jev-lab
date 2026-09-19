#!/usr/bin/env node
// Fetches the market data the demos use and writes it to data/market, which is committed. Run by
// hand, rarely: the site never fetches anything, and neither does the build.
//
// Usage: node scripts/fetch-market.js [--symbols NVDA,JPM] [--what candles,fundamentals] [--years 10]

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchEodCandles } from '../src/services/eod-candles.js';
import { yahooFinance } from '../src/lib/yahoo-finance.js';
import { marketFile, readJson, repoRoot } from '../src/services/dataset.js';

/** The universe the demos draw on: five from the backtest suite, plus peers for the screening block. */
export const SYMBOLS = ['NVDA', 'JPM', 'XOM', 'BTC-USD', 'GLD', 'AAPL', 'MSFT', 'KO', 'PG', 'JNJ', 'CVX', 'BAC', 'WMT', 'PEP', 'XLE', 'SPY', 'GOOGL', 'WFC', 'C', 'COP', 'SLB'];

const FUNDAMENTAL_MODULES = ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory'];

const flags = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const entry = flags.find((flag) => flag.startsWith(`${name}=`));
  if (entry) return entry.slice(name.length + 1);
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : fallback;
};

const symbols = (flagValue('--symbols') ?? SYMBOLS.join(',')).split(',').map((symbol) => symbol.trim()).filter(Boolean);
const what = (flagValue('--what') ?? 'candles,fundamentals').split(',').map((entry) => entry.trim());
const years = Number(flagValue('--years', '10'));
const today = new Date().toISOString().slice(0, 10);
const from = new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const manifest = await readJson(marketFile('manifest.json')).catch(() => ({ files: {} }));

for (const symbol of symbols) {
  if (what.includes('candles')) {
    const { candles, currency, exchange, instrumentType } = await fetchEodCandles(symbol, { from });
    const file = marketFile('candles', `${symbol}.json`);
    await write(file, { symbol, currency, exchange, instrumentType, firstDate: candles[0]?.date, lastDate: candles.at(-1)?.date, bars: candles });
    record(file, { source: 'Yahoo Finance chart', symbol, rows: candles.length, range: `${candles[0]?.date} to ${candles.at(-1)?.date}` });
    console.log(`${symbol}: ${candles.length} candles`);
  }

  if (what.includes('fundamentals')) {
    try {
      const summary = await yahooFinance.quoteSummary(symbol, { modules: FUNDAMENTAL_MODULES });
      // The statement submodules above have returned almost nothing since late 2024, so the balance
      // sheet and cash flow come from the time series endpoint and are merged in by fiscal year.
      const series = await yahooFinance
        .fundamentalsTimeSeries(symbol, { period1: from, type: 'annual', module: 'all' })
        .catch(() => []);
      const file = marketFile('fundamentals', `${symbol}.json`);
      await write(file, compactFundamentals(symbol, summary, series));
      record(file, { source: 'Yahoo Finance quoteSummary', symbol, rows: summary.incomeStatementHistory?.incomeStatementHistory?.length ?? 0 });
      console.log(`${symbol}: fundamentals`);
    } catch (error) {
      console.log(`${symbol}: no fundamentals (${error.message.split('\n')[0]})`);
    }
  }
}

await write(marketFile('manifest.json'), manifest);
console.log(`\nmanifest: ${Object.keys(manifest.files).length} files. Cached for the demos only, not redistributed as a dataset.`);

async function write(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function record(file, entry) {
  manifest.files ??= {};
  manifest.files[path.relative(repoRoot, file).replaceAll('\\', '/')] = { ...entry, fetchedAt: today };
  manifest.note = 'Fetched once for the demos in this repository. Prices and statements are used to make the examples real; this is not a redistributed dataset.';
}

/** Keeps the statement lines the demos read, and drops the rest of Yahoo's payload. */
function compactFundamentals(symbol, summary, series = []) {
  const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);
  const years = [...series].sort((left, right) => String(day(right.date)).localeCompare(String(day(left.date))));
  const income = summary.incomeStatementHistory?.incomeStatementHistory ?? [];
  const pick = (row, ...names) => names.map((name) => row?.[name]).find((value) => typeof value === 'number') ?? null;

  return {
    symbol,
    sector: summary.summaryProfile?.sector ?? null,
    industry: summary.summaryProfile?.industry ?? null,
    marketCap: summary.defaultKeyStatistics?.marketCap ?? summary.financialData?.marketCap ?? null,
    sharesOutstanding: summary.defaultKeyStatistics?.sharesOutstanding ?? null,
    currency: summary.financialData?.financialCurrency ?? null,
    annual: (years.length ? years : income).map((row, index) => ({
      fiscalYearEnd: day(row.date ?? income[index]?.endDate),
      revenue: pick(row, 'totalRevenue', 'operatingRevenue') ?? income[index]?.totalRevenue ?? null,
      grossProfit: pick(row, 'grossProfit') ?? income[index]?.grossProfit ?? null,
      operatingIncome: pick(row, 'operatingIncome', 'ebit') ?? income[index]?.operatingIncome ?? null,
      netIncome: pick(row, 'netIncome', 'netIncomeCommonStockholders') ?? income[index]?.netIncome ?? null,
      interestExpense: pick(row, 'interestExpense'),
      interestIncome: pick(row, 'interestIncome'),
      totalAssets: pick(row, 'totalAssets'),
      totalLiabilities: pick(row, 'totalLiabilitiesNetMinorityInterest'),
      totalDebt: pick(row, 'totalDebt'),
      cash: pick(row, 'cashCashEquivalentsAndShortTermInvestments', 'cashAndCashEquivalents'),
      receivables: pick(row, 'accountsReceivable', 'receivables'),
      inventory: pick(row, 'inventory'),
      equity: pick(row, 'stockholdersEquity', 'totalEquityGrossMinorityInterest'),
      operatingCashFlow: pick(row, 'operatingCashFlow'),
      capitalExpenditure: pick(row, 'capitalExpenditure'),
      freeCashFlow: pick(row, 'freeCashFlow'),
      dividendsPaid: pick(row, 'cashDividendsPaid', 'commonStockDividendPaid'),
    })),
  };
}

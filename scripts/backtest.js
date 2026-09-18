// Backtests Jev trade decisions on daily candles from the command line. At each cutoff Jev sees only
// the candles up to that day, optionally with technical indicators computed from them, and each decision
// is scored on the candles that followed it. Runs are saved to results/, where the dashboard shows them.
//
// Usage: node scripts/backtest.js [SYMBOL...] [--suite] [--indicators] [--blind] [--cutoffs N]
//   no flags      The pilot: 12 cutoffs on AAPL.
//   --suite       The full suite: 60 cutoffs on each of NVDA, JPM, XOM, BTC-USD and GLD.
//   --indicators  Add ten technical indicators and their signals to every state.
//   --blind       Hide symbols and dates and rebase prices, so answers can't lean on remembered history.
//   --cutoffs N   Cutoffs per symbol instead of the pilot's or the suite's number.
// Ctrl+C stops after the request in flight and keeps everything saved so far.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { typesafe } from '../src/lib/typesafe.js';
import { DEFAULT_SETTINGS, PRESETS, runBacktest, runName } from '../src/services/backtest-runner.js';
import { fetchEodCandles } from '../src/services/eod-candles.js';

const { positionals, values: flags } = parseArgs({
  allowPositionals: true,
  options: {
    suite: { type: 'boolean', default: false },
    indicators: { type: 'boolean', default: false },
    blind: { type: 'boolean', default: false },
    cutoffs: { type: 'string' },
  },
});
const preset = flags.suite ? 'suite' : 'pilot';
const symbols = positionals.length ? positionals.map((symbol) => symbol.toUpperCase()) : PRESETS[preset].symbols;
const settings = {
  ...DEFAULT_SETTINGS,
  cutoffs: flags.cutoffs === undefined ? PRESETS[preset].cutoffs : Number(flags.cutoffs),
  indicators: flags.indicators,
  blind: flags.blind,
};
if (!Number.isInteger(settings.cutoffs) || settings.cutoffs < 1) throw new Error('--cutoffs must be a positive integer.');

const startedAt = new Date().toISOString();
const id = runName({ preset, settings, startedAt });
const controller = new AbortController();
process.once('SIGINT', () => {
  console.log('\nStopping after the request in flight...');
  controller.abort();
});

console.log(`${id}: ${symbols.join(', ')} with ${settings.cutoffs} cutoffs each, asking ${typesafe.defaultModel}`);
const planned = new Map();
const run = await runBacktest({
  id,
  preset,
  symbols,
  settings,
  startedAt,
  typesafe,
  fetchCandles: fetchEodCandles,
  resultsDir: path.join(import.meta.dirname, '..', 'results'),
  signal: controller.signal,
  onEvent: (event) => {
    if (event.type === 'symbol-started') planned.set(event.symbol, event.cutoffs.length);
    if (event.type === 'decision') {
      const { cutoff, date, action, error } = event.decision;
      console.log(`  ${event.symbol} ${cutoff}/${planned.get(event.symbol)}  ${date}  ${action ?? `failed: ${error.message}`}`);
    }
    if (event.type === 'symbol-finished' && event.status === 'failed') console.error(`${event.symbol} failed: ${event.error}`);
  },
});

const completed = run.symbols.filter((symbol) => symbol.decisions.length > 0);
if (run.symbols.length === 1 && completed.length === 1) printDecisions(completed[0]);
printSummary(run);
console.log(`\n${run.status === 'completed' ? 'Saved' : `Run ${run.status}; saved what finished`} to ${path.join('results', id)}`);

function printDecisions({ symbol, instrument, decisions }) {
  const level = (pct) => (pct === null ? 'none' : `${pct}%`);
  const header = ['#', 'Cutoff', 'Action', 'Conf', 'Stop', 'Target', 'Hold', 'Exit', 'Net %', `P&L ${instrument.currency}`];
  header.push(`${settings.horizonBars}-bar move %`);
  const rows = decisions.map(({ cutoff, date, action, confidence, plan, trade, forwardReturnsPct }) => [
    String(cutoff),
    date,
    action ?? 'FAILED',
    confidence === null ? '' : confidence.toFixed(2),
    plan ? level(plan.stopLossPct) : '',
    plan ? level(plan.takeProfitPct) : '',
    plan ? String(plan.maxBars) : '',
    trade ? `${trade.exitReason} ${trade.exitDate}` : '',
    trade ? signed(trade.netReturnPct) : '',
    trade ? signed(trade.pnl) : '',
    signed(forwardReturnsPct.at(-1)),
  ]);
  console.log(`\n${symbol}\n`);
  printTable(header, rows);
}

function printSummary({ symbols: results, overall }) {
  const perTrade = (value) => (value === null ? '-' : signed(value));
  const header = ['Symbol', 'Long/Short/No trade', 'Trades', 'Win rate', 'Net % total', 'Net % per trade', 'P&L'];
  header.push('Always long % per cutoff');
  const row = (label, s) => [
    label,
    `${s.long}/${s.short}/${s.noTrade}${s.failed ? ` (${s.failed} failed)` : ''}`,
    String(s.trades),
    s.winRatePct === null ? '-' : `${s.winRatePct}%`,
    signed(s.totalNetReturnPct),
    perTrade(s.averageNetReturnPct),
    signed(s.totalPnl),
    perTrade(s.alwaysLong.averageNetReturnPct),
  ];
  const rows = results.map(({ symbol, summary, error, status }) =>
    summary ? row(symbol, summary) : [symbol, error ? `failed: ${error}` : status, '', '', '', '', '', ''],
  );
  const currencies = new Set(results.filter((result) => result.instrument).map((result) => result.instrument.currency));
  const currency = currencies.size === 1 ? ` ${[...currencies][0]}` : '';

  console.log('');
  printTable(header, results.length > 1 ? [...rows, row('All', overall)] : rows);
  const side = (label, { trades, winRatePct, averageNetReturnPct }) =>
    trades ? `${label}: ${trades}, win rate ${winRatePct}%, ${signed(averageNetReturnPct)}% per trade.` : `${label}: none.`;
  console.log(`\n${side('Long trades', overall.bySide.LONG)} ${side('Short trades', overall.bySide.SHORT)}`);
  const { take_profit: takeProfit, stop_loss: stopLoss, time_exit: timeExit } = overall.exitReasons;
  console.log(`Exits: ${takeProfit} take profit, ${stopLoss} stop loss, ${timeExit} time exit.`);
  console.log(
    `Returns are net of ${settings.costBpsPerSide} bps per side; P&L is on ${settings.notional}${currency} per trade.` +
      ` Always long buys every cutoff and holds ${settings.horizonBars} bars.`,
  );
  console.log(`Tokens: ${overall.usage.input_tokens} input, ${overall.usage.output_tokens} output.`);
}

function printTable(header, rows) {
  const table = [header, ...rows];
  const widths = header.map((_, col) => Math.max(...table.map((row) => row[col].length)));
  for (const row of table) console.log(row.map((cell, col) => cell.padEnd(widths[col])).join('  ').trimEnd());
}

function signed(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

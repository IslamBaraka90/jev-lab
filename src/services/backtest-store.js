import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { summarizeDecisions } from './backtest.js';
import { symbolFileName } from './backtest-runner.js';
import { toDecisionView, toRunListing } from './run-model.js';

// Reads the runs saved by backtest-runner.js. A run's id is its folder name under the results directory.

const RUN_ID = /^[\w.-]+$/;

/** Every saved run, newest first, without candles or decisions. */
export async function listRuns(resultsDir) {
  let entries;
  try {
    entries = await readdir(resultsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const runs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && RUN_ID.test(entry.name))
      .map(async ({ name }) => {
        const summary = await readJson(path.join(resultsDir, name, 'summary.json'));
        return toRunListing(summary ? runFromSummary(name, summary) : interruptedRun(name));
      }),
  );
  return runs.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

/** A saved run with its candles and decisions, or null when there is no such run. */
export async function loadRun(resultsDir, id) {
  const dir = runDirectory(resultsDir, id);
  let names;
  try {
    names = dir && (await readdir(dir));
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
  if (!names) return null;

  const summary = await readJson(path.join(dir, 'summary.json'));
  const records = await Promise.all(names.filter((name) => name.endsWith('.json') && name !== 'summary.json').map((name) => readJson(path.join(dir, name))));
  const bySymbol = new Map(records.map((record) => [record.symbol, record]));
  const order = summary?.symbols?.map((saved) => saved.symbol) ?? records.map((record) => record.symbol);
  const run = summary ? runFromSummary(id, summary) : interruptedRun(id);

  const symbols = order.map((symbol) => {
    const record = bySymbol.get(symbol);
    const saved = summary?.symbols?.find((item) => item.symbol === symbol);
    const decisions = record?.decisions ?? [];
    return {
      symbol,
      status: saved?.status ?? (saved?.error ? 'failed' : record ? 'completed' : 'pending'),
      instrument: record?.instrument ?? null,
      evaluationStart: record?.evaluationStart ?? null,
      candles: record?.candles ?? [],
      cutoffs: decisions.map(({ cutoff, date, candleIndex }) => ({ cutoff, date, candleIndex })),
      decisions: decisions.map(toDecisionView),
      summary: saved?.summary ?? record?.summary ?? summarizeDecisions(decisions),
      error: saved?.error ?? null,
    };
  });

  const first = records[0];
  return {
    ...run,
    settings: run.settings ?? first?.settings ?? null,
    model: run.model ?? first?.decisions.find((decision) => decision.response)?.response.model ?? null,
    questions: first?.questions ?? null,
    symbols,
    overall: run.overall ?? summarizeDecisions(records.flatMap((record) => record.decisions)),
  };
}

/** One saved decision with its full state and response, or null. */
export async function loadDecision(resultsDir, id, symbol, cutoff) {
  const dir = runDirectory(resultsDir, id);
  const record = dir && (await readJson(path.join(dir, symbolFileName(symbol))));
  return record?.decisions.find((decision) => decision.cutoff === Number(cutoff)) ?? null;
}

function runFromSummary(id, summary) {
  return {
    id,
    preset: summary.preset ?? presetFromId(id),
    // A run still marked running on disk stopped before it could finish.
    status: summary.status === 'running' ? 'interrupted' : (summary.status ?? 'completed'),
    startedAt: summary.startedAt ?? startedAtFromId(id),
    finishedAt: summary.finishedAt ?? null,
    settings: summary.settings ?? null,
    model: summary.model ?? null,
    error: summary.error ?? null,
    // Summaries written before symbols had a status only record an error when one failed.
    symbols: (summary.symbols ?? []).map((symbol) => ({ ...symbol, status: symbol.status ?? (symbol.error ? 'failed' : 'completed') })),
    overall: summary.overall ?? null,
  };
}

function interruptedRun(id) {
  return {
    id,
    preset: presetFromId(id),
    status: 'interrupted',
    startedAt: startedAtFromId(id),
    finishedAt: null,
    settings: null,
    model: null,
    error: null,
    symbols: [],
    overall: null,
  };
}

function presetFromId(id) {
  return id.startsWith('suite') ? 'suite' : 'pilot';
}

// "pilot-2026-09-17T10-49-40-359Z" was started at 2026-09-17T10:49:40.359Z.
function startedAtFromId(id) {
  const match = id.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  return match ? `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z` : null;
}

function runDirectory(resultsDir, id) {
  return RUN_ID.test(id) ? path.join(resultsDir, id) : null;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

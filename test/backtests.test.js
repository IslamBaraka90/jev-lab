import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createBacktestManager } from '../src/services/backtest-manager.js';

// The backtest API runs offline here: candles are generated, and Jev is a stub that answers LONG and
// NO_TRADE in turn. `gate` holds the stub's answers until a test releases them.

let resultsDir;
let server;
let baseURL;
let gate;

const typesafe = {
  defaultModel: 'jev-test',
  calls: 0,
  systemOne(request, { signal }) {
    const call = this.calls++;
    return {
      withResponse: async () => {
        await Promise.race([
          gate.promise,
          new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Request was aborted.')))),
        ]);
        return { data: answer(request.questions, call % 2 === 0 ? 'LONG' : 'NO_TRADE'), requestId: `req_${call}` };
      },
    };
  },
};

before(async () => {
  resultsDir = await mkdtemp(path.join(os.tmpdir(), 'jev-backtests-'));
  const backtests = createBacktestManager({ typesafe, fetchCandles, resultsDir });
  server = createApp({ typesafe, backtests }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await rm(resultsDir, { recursive: true, force: true });
});

test('a backtest started from the API streams its decisions and is saved', async () => {
  gate = deferred();
  const started = await post('/api/backtests', { preset: 'pilot', symbols: ['test'], cutoffs: 3 });
  assert.equal(started.status, 201);
  const { id } = await started.json();

  const stream = await fetch(`${baseURL}/api/backtests/${id}/events`);
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  const events = [];
  for await (const event of readEvents(stream)) {
    events.push(event);
    if (event.type === 'snapshot') gate.resolve();
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ['snapshot', 'symbol-started', 'decision', 'decision', 'decision', 'symbol-finished', 'run-finished'],
  );
  assert.equal(events[0].run.status, 'running');
  const [longDecision, flatDecision] = events.filter((event) => event.type === 'decision').map((event) => event.decision);
  assert.equal(longDecision.action, 'LONG');
  assert.deepEqual(longDecision.plan, { side: 'LONG', stopLossPct: 1, takeProfitPct: 2, maxBars: 3 });
  assert.ok(longDecision.trade.exitReason);
  assert.equal(longDecision.state, undefined);
  assert.equal(flatDecision.action, 'NO_TRADE');
  assert.equal(flatDecision.trade, null);
  assert.equal(events.at(-1).status, 'completed');
  assert.equal(events.at(-1).overall.decisions, 3);

  const { runs, activeRunId, presets } = await (await fetch(`${baseURL}/api/backtests`)).json();
  assert.equal(activeRunId, null);
  assert.deepEqual(presets.suite.symbols, ['NVDA', 'JPM', 'XOM', 'BTC-USD', 'GLD']);
  assert.equal(runs[0].id, id);
  assert.equal(runs[0].status, 'completed');
  assert.equal(runs[0].symbols[0].decided, 3);

  const run = await (await fetch(`${baseURL}/api/backtests/${id}`)).json();
  assert.equal(run.symbols[0].symbol, 'TEST');
  assert.equal(run.symbols[0].decisions.length, 3);
  assert.ok(run.symbols[0].candles.length > 700);
  assert.ok(run.questions.trade_decision);

  const decision = await (await fetch(`${baseURL}/api/backtests/${id}/symbols/TEST/decisions/1`)).json();
  assert.equal(decision.state.bars.length, 90);
  assert.equal(decision.response.answers.trade_decision.choice, 'LONG');

  const summary = JSON.parse(await readFile(path.join(resultsDir, id, 'summary.json'), 'utf8'));
  assert.equal(summary.status, 'completed');
  assert.equal(summary.symbols[0].summary.decisions, 3);
});

test('only one backtest runs at a time, and a running backtest can be cancelled', async () => {
  gate = deferred();
  const { id } = await (await post('/api/backtests', { preset: 'pilot', symbols: ['TEST'], cutoffs: 5 })).json();

  assert.equal((await post('/api/backtests', { preset: 'pilot' })).status, 409);
  assert.equal((await post(`/api/backtests/${id}/cancel`)).status, 202);

  const events = [];
  for await (const event of readEvents(await fetch(`${baseURL}/api/backtests/${id}/events`))) events.push(event);
  const run = events.at(-1).run ?? (await (await fetch(`${baseURL}/api/backtests/${id}`)).json());
  assert.equal(run.status, 'cancelled');
  assert.equal((await post(`/api/backtests/${id}/cancel`)).status, 409);
});

test('invalid options and unknown runs are rejected', async () => {
  assert.equal((await post('/api/backtests', { preset: 'weekly' })).status, 400);
  assert.equal((await post('/api/backtests', { symbols: ['NOT A SYMBOL'] })).status, 400);
  assert.equal((await post('/api/backtests', { cutoffs: 0 })).status, 400);
  assert.equal((await fetch(`${baseURL}/api/backtests/no-such-run`)).status, 404);
  assert.equal((await fetch(`${baseURL}/api/backtests/..%2F..%2Fpackage`)).status, 404);
});

function post(route, body) {
  return fetch(`${baseURL}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function* readEvents(response) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const data = buffer
        .slice(0, end)
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n');
      buffer = buffer.slice(end + 2);
      if (data) yield JSON.parse(data);
    }
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

// One candle a day from `from` to today, drifting up and down.
async function fetchCandles(symbol, { from }) {
  const days = Math.floor((Date.now() - Date.parse(from)) / 86_400_000);
  const candles = Array.from({ length: days }, (_, i) => {
    const close = 100 + 10 * Math.sin(i / 9) + i * 0.02;
    const date = new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10);
    return { date, open: close - 0.5, high: close + 1.5, low: close - 1.5, close, volume: 1_000_000 + i };
  });
  return { symbol, currency: 'USD', exchange: 'TEST', instrumentType: 'EQUITY', candles };
}

// Answers in the API's shape: the first option for every choice except the ones the test sets.
function answer(questions, decision) {
  const picks = {
    trade_decision: decision,
    trade_direction_if_taken: decision === 'LONG' ? 'LONG' : 'NOT_APPLICABLE',
    stop_loss_distance: '1.00_PERCENT',
    take_profit_distance: '2.00_PERCENT',
    expected_holding_period: '2_TO_3_BARS',
  };
  const answers = Object.fromEntries(
    Object.entries(questions).map(([name, question]) => {
      if (question.type === 'noul') return [name, { type: 'noul', noul: 0.4 }];
      if (question.type === 'score') {
        const legend = Object.fromEntries(question.criteria.map((level, i) => [i, level]));
        return [name, { type: 'score', score: 3, legend, probabilities: { 3: 1 }, confidence: 0.5 }];
      }
      const choice = picks[name] ?? Object.keys(question.criteria)[0];
      const probabilities = Object.fromEntries(Object.keys(question.criteria).map((key) => [key, key === choice ? 1 : 0]));
      return [name, { type: 'choice', choice, probabilities, confidence: 0.6 }];
    }),
  );
  return { model: 'jev-test-1', answers, usage: { input_tokens: 9000, output_tokens: 700 } };
}

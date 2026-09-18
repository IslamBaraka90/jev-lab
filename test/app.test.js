import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, beforeEach, test } from 'node:test';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { createApp } from '../src/app.js';

// These tests run offline: the SDK client sends its requests to a stub instead of api.typesafe.ai.

// Request and response bodies from https://docs.typesafe.ai/introduction/quickstart
const quickstartRequest = {
  state:
    "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
  model: 'jev-latest',
  questions: {
    department: {
      type: 'choice',
      instructions: 'Which team should handle this',
      criteria: {
        billing: 'Payment or subscription issues',
        technical: 'Bugs or integration problems',
        sales: 'Pricing or account questions',
      },
    },
    frustration: {
      type: 'score',
      instructions: 'How frustrated the customer appears',
      criteria: ['Calm, just stating facts', 'Frustrated but civil', 'Very angry, strong language'],
    },
    is_urgent: {
      type: 'noul',
      instructions: 'The message conveys urgency or time-sensitivity',
    },
  },
};

const quickstartResponse = {
  model: 'jev-latest',
  answers: {
    department: {
      type: 'choice',
      choice: 'technical',
      probabilities: { billing: 0.159, technical: 0.84, sales: 0.001 },
      confidence: 0.596,
    },
    frustration: {
      type: 'score',
      score: 1.035,
      legend: { 0: 'Calm, just stating facts', 1: 'Frustrated but civil', 2: 'Very angry, strong language' },
      confidence: 0.842,
    },
    is_urgent: { type: 'noul', noul: 0.999 },
  },
  usage: { input_tokens: 312, output_tokens: 48 },
};

let upstream; // { status, body } the stub responds with
let sent; // { url, body } of each request the SDK sent

const typesafe = new TypeSafeClient({
  apiKey: 'test-key',
  baseURL: 'https://api.typesafe.ai',
  defaultModel: 'jev-latest',
  retry: { maxRetries: 0 },
  fetch: async (url, init) => {
    sent.push({ url, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    return Response.json(upstream.body, {
      status: upstream.status,
      headers: { 'x-typesafe-request-id': 'req_test' },
    });
  },
});

let server;
let baseURL;

before(async () => {
  server = createApp({ typesafe }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  upstream = { status: 200, body: quickstartResponse };
  sent = [];
});

const post = (path, body) =>
  fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /health responds without calling TypeSafe', async () => {
  const res = await fetch(`${baseURL}/health`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
  assert.equal(sent.length, 0);
});

test('GET /api/quickstart sends the quickstart request and returns the answers', async () => {
  const res = await fetch(`${baseURL}/api/quickstart`);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-typesafe-request-id'), 'req_test');
  assert.deepEqual(await res.json(), quickstartResponse);
  assert.deepEqual(sent, [{ url: 'https://api.typesafe.ai/v1/systemone', body: quickstartRequest }]);
});

test('POST /api/quickstart asks the quickstart questions about the given state', async () => {
  const res = await post('/api/quickstart', { state: 'I was charged twice.' });

  assert.equal(res.status, 200);
  assert.deepEqual(sent[0].body, { ...quickstartRequest, state: 'I was charged twice.' });
});

test('POST /api/systemone forwards the request body', async () => {
  const request = {
    state: 'Help! My payouts have been failing for 3 days.',
    model: 'jev-latest',
    questions: { is_urgent: { type: 'noul', instructions: 'Does this convey urgency?' } },
  };
  upstream.body = {
    model: 'jev-latest',
    answers: { is_urgent: { type: 'noul', noul: 0.92 } },
    usage: { input_tokens: 312, output_tokens: 48 },
  };

  const res = await post('/api/systemone', request);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), upstream.body);
  assert.deepEqual(sent[0].body, request);
});

test('POST /api/systemone rejects invalid requests without calling TypeSafe', async () => {
  const missingQuestions = await post('/api/systemone', { state: 'Hello' });
  const oneLevelScore = await post('/api/systemone', {
    state: 'Hello',
    questions: { mood: { type: 'score', instructions: 'How positive is this?', criteria: ['Negative'] } },
  });

  assert.equal(missingQuestions.status, 400);
  assert.equal(oneLevelScore.status, 400);
  assert.match((await oneLevelScore.json()).error.message, /at least two/);
  assert.equal(sent.length, 0);
});

test('GET /api/models lists the models available to the key', async () => {
  upstream.body = { models: [{ name: 'jev-latest', description: 'Jev', release_date: '2026-09-01' }] };

  const res = await fetch(`${baseURL}/api/models`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), upstream.body);
  assert.equal(sent[0].url, 'https://api.typesafe.ai/v1/models');
});

test('TypeSafe validation errors pass through with their details', async () => {
  upstream = {
    status: 422,
    body: { detail: [{ loc: ['body', 'questions', 'mood', 'type'], msg: 'Invalid question type' }] },
  };

  const res = await post('/api/systemone', { state: 'Hello', questions: { mood: { type: 'mood' } } });
  const { error } = await res.json();

  assert.equal(res.status, 422);
  assert.equal(error.typesafeStatus, 422);
  assert.deepEqual(error.details, upstream.body);
});

test('a rejected API key is reported as a 502 with a hint', async () => {
  upstream = { status: 401, body: { error: 'Invalid API key' } };

  const res = await fetch(`${baseURL}/api/quickstart`);
  const { error } = await res.json();

  assert.equal(res.status, 502);
  assert.match(error.message, /TYPESAFE_API_KEY/);
  assert.equal(error.requestId, 'req_test');
});

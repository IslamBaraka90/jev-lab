import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choice as sdkChoice, noul as sdkNoul, score as sdkScore } from '@typesafe-ai/sdk';
import { choice, noul, optionsOf, questionTypes, rubricOf, score } from '../demos/lib/questions.js';

// The site builds questions without importing the SDK, so these helpers must produce exactly what the
// SDK's own helpers produce. If the SDK changes shape, this test fails before a demo records anything.

test('choice matches the SDK', () => {
  const criteria = { LONG: 'go long', SHORT: null };
  assert.deepEqual(choice('Which way?', criteria), sdkChoice('Which way?', criteria));
});

test('score matches the SDK', () => {
  const rubric = ['None', 'Some', 'Lots'];
  assert.deepEqual(score('How much?', rubric), sdkScore('How much?', rubric));
});

test('noul matches the SDK, with and without criteria', () => {
  assert.deepEqual(noul('Is it so?'), sdkNoul('Is it so?'));
  const criteria = { true: 'it is', false: 'it is not' };
  assert.deepEqual(noul('Is it so?', criteria), sdkNoul('Is it so?', criteria));
});

test('helpers read a question set', () => {
  const questions = {
    side: choice('Which way?', { LONG: null, SHORT: null }),
    strength: score('How strong?', ['None', 'Some']),
    sure: noul('Sure?'),
  };
  assert.deepEqual(optionsOf(questions.side), ['LONG', 'SHORT']);
  assert.deepEqual(rubricOf(questions.strength), ['None', 'Some']);
  assert.deepEqual(questionTypes(questions), ['choice', 'noul', 'score']);
});

test('a score answer survives the round trip without its repeated rubric', async () => {
  const { compactAnswers, expandAnswers } = await import('../demos/lib/answers.js');
  const questions = { strength: score('How strong?', ['None', 'Some', 'Lots']), sure: noul('Sure?') };
  const answer = {
    strength: { type: 'score', score: 1.4, confidence: 0.5, legend: { 0: 'None', 1: 'Some', 2: 'Lots' }, probabilities: { 0: 0.2, 1: 0.6, 2: 0.2 } },
    sure: { type: 'noul', noul: 0.8 },
  };

  const compact = compactAnswers(answer, questions);
  assert.equal(compact.strength.legend, undefined, 'the rubric is not stored per item');
  assert.equal(JSON.stringify(compact).length < JSON.stringify(answer).length, true);
  assert.deepEqual(expandAnswers(compact, questions), answer);
});

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

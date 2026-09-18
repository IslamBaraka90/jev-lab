// Sends the quickstart request from https://docs.typesafe.ai/introduction/quickstart and prints the answers.
// Usage: npm run quickstart [-- "text to evaluate instead of the sample ticket"]
import { APIError } from '@typesafe-ai/sdk';
import { typesafe } from '../src/lib/typesafe.js';
import { sampleTicket, supportTicketQuestions } from '../src/questions/support-ticket.js';

const state = process.argv[2] ?? sampleTicket;

try {
  const started = performance.now();
  const { data, requestId } = await typesafe
    .systemOne({ state, questions: supportTicketQuestions })
    .withResponse();
  const ms = Math.round(performance.now() - started);
  const { department, frustration, is_urgent } = data.answers;

  console.log(`State: ${state}\n`);
  console.log(`department   ${department.choice} (confidence ${department.confidence})`);
  console.log(
    `frustration  ${frustration.score}, nearest level "${frustration.legend[Math.round(frustration.score)]}" (confidence ${frustration.confidence})`,
  );
  console.log(`is_urgent    ${is_urgent.noul} probability of yes`);
  console.log(
    `\n${data.model} answered in ${ms} ms, ${data.usage.input_tokens} input / ${data.usage.output_tokens} output tokens, request ${requestId ?? 'n/a'}`,
  );
  console.log(`\nFull response:\n${JSON.stringify(data, null, 2)}`);
} catch (err) {
  console.error(`TypeSafe request failed: ${err.message}`);
  if (err instanceof APIError) {
    if (err.status === 401) console.error('Check TYPESAFE_API_KEY in .env.');
    if (err.body !== undefined) console.error(JSON.stringify(err.body, null, 2));
  }
  process.exitCode = 1;
}

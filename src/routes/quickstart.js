import { Router } from 'express';
import { HttpError, sendResult } from '../lib/http.js';
import { sampleTicket, supportTicketQuestions } from '../questions/support-ticket.js';

// The quickstart request: which department, how frustrated, and whether it is urgent.
export function quickstartRouter({ typesafe }) {
  const router = Router();

  const ask = (res, state) => sendResult(res, typesafe.systemOne({ state, questions: supportTicketQuestions }));

  // The sample ticket from the docs.
  router.get('/', (req, res) => ask(res, sampleTicket));

  // Your own text: { "state": "..." }
  router.post('/', (req, res) => {
    const state = req.body?.state;
    if (state === undefined || state === null) throw new HttpError(400, '`state` is required.');
    return ask(res, state);
  });

  return router;
}

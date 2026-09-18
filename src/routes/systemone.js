import { Router } from 'express';
import { HttpError, sendResult } from '../lib/http.js';

// Forwards { state, questions, model? } to POST /v1/systemone. The body follows
// https://docs.typesafe.ai/api, so request examples from the docs can be sent unchanged.
export function systemOneRouter({ typesafe }) {
  const router = Router();

  router.post('/', (req, res) => {
    const { state, questions, model } = req.body ?? {};
    if (state === undefined || state === null) throw new HttpError(400, '`state` is required.');
    if (typeof questions !== 'object' || questions === null || Array.isArray(questions)) {
      throw new HttpError(400, '`questions` must be an object of named questions.');
    }
    return sendResult(res, typesafe.systemOne({ state, questions, model }));
  });

  return router;
}

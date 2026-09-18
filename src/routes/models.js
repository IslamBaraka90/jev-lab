import { Router } from 'express';
import { sendResult } from '../lib/http.js';

// Lists the models available to the API key, which also confirms the key works.
export function modelsRouter({ typesafe }) {
  const router = Router();

  router.get('/', (req, res) => sendResult(res, typesafe.models.list().map((models) => ({ models }))));

  return router;
}

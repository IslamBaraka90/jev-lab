import { Router } from 'express';
import { HttpError } from '../lib/http.js';
import { demoCard, DEMOS, findDemo } from '../../demos/index.js';
import { loadDataset } from '../services/dataset.js';
import { askModel, demoContext } from '../services/demo-runner.js';

// Live mode: the local server runs one demo item against the real API. The deployed site never calls
// this route, because it has no server; it replays the recorded answers instead.
export function demosRouter({ typesafe }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ demos: DEMOS.map(demoCard), live: Boolean(typesafe) });
  });

  // { itemId } -> the answers for that item, with what the call cost
  router.post('/:id/run', async (req, res) => {
    if (!typesafe) throw new HttpError(503, 'Live mode is off: no API key is configured on this server.');

    const demo = findDemo(req.params.id);
    if (!demo) throw new HttpError(404, `No demo called "${req.params.id}".`);

    const dataset = await loadDataset(demo.id);
    const item = dataset.items.find((entry) => entry.id === req.body?.itemId);
    if (!item) throw new HttpError(404, `Demo "${demo.id}" has no item "${req.body?.itemId}".`);

    const context = demoContext(dataset);
    const state = demo.buildState(item, context);
    const response = await askModel(typesafe, { state, questions: demo.questions });
    res.json({ itemId: item.id, state, ...response });
  });

  return router;
}

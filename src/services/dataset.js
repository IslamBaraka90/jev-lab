// Where datasets live on disk, and how the server and the scripts read them. The shape checks come
// from demos/lib/dataset-shape.js, which the site uses too, so everything validates the same way.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDataset } from '../../demos/lib/dataset-shape.js';

export { DATA_CLASSES, assertDataset, datasetProblems, datasetSummary } from '../../demos/lib/dataset-shape.js';

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export const demoDataFile = (slug) => path.join(repoRoot, 'demos', slug, 'data.json');
export const labelsFile = (slug) => path.join(repoRoot, 'data', 'synthetic', `${slug}.labels.json`);
export const marketFile = (...parts) => path.join(repoRoot, 'data', 'market', ...parts);

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Loads and validates one demo's dataset. */
export async function loadDataset(slug) {
  return assertDataset(await readJson(demoDataFile(slug)), `demos/${slug}/data.json`);
}

/**
 * Loads the ground-truth labels for a synthetic dataset. Labels live outside the demo folder on
 * purpose: nothing in `demos/` can import them by accident, so they cannot leak into a state.
 */
export async function loadLabels(slug) {
  return readJson(labelsFile(slug));
}

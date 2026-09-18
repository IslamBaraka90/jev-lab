// The envelope every dataset shares, and the checks for it. No Node imports, so the site, the server
// and the tests all validate datasets with the same code.

export const DATA_CLASSES = ['synthetic', 'cached-real', 'mixed'];

const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Everything wrong with a dataset, as readable lines. An empty array means it is valid. */
export function datasetProblems(dataset) {
  const problems = [];
  if (!dataset || typeof dataset !== 'object') return ['dataset is not an object'];
  if (typeof dataset.id !== 'string' || !dataset.id) problems.push('id is missing');
  if (!DATA_CLASSES.includes(dataset.class)) problems.push(`class must be one of ${DATA_CLASSES.join(', ')}`);
  if (!isDay(dataset.generatedAt)) problems.push('generatedAt must be a YYYY-MM-DD day');
  if (typeof dataset.source !== 'string' || !dataset.source) problems.push('source is missing');
  if (dataset.class !== 'cached-real' && !Number.isInteger(dataset.seed)) problems.push('synthetic data needs an integer seed');
  if (!Array.isArray(dataset.items) || dataset.items.length === 0) {
    problems.push('items must be a non-empty array');
    return problems;
  }

  const seen = new Set();
  dataset.items.forEach((item, index) => {
    if (!item || typeof item !== 'object') problems.push(`item ${index} is not an object`);
    else if (typeof item.id !== 'string' || !item.id) problems.push(`item ${index} has no id`);
    else if (seen.has(item.id)) problems.push(`item id ${item.id} appears more than once`);
    else seen.add(item.id);
  });
  return problems;
}

/** Throws with every problem listed, or returns the dataset unchanged. */
export function assertDataset(dataset, where = 'dataset') {
  const problems = datasetProblems(dataset);
  if (problems.length) throw new Error(`${where} is invalid:\n- ${problems.join('\n- ')}`);
  return dataset;
}

/** One line for the page's data chip. */
export function datasetSummary(dataset) {
  const count = `${dataset.items.length} item${dataset.items.length === 1 ? '' : 's'}`;
  if (dataset.class === 'cached-real') return `Cached · ${dataset.source} · fetched ${dataset.generatedAt} · ${count}`;
  return `Synthetic · seed ${dataset.seed} · generated ${dataset.generatedAt} · ${count}`;
}

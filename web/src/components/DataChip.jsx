import { Icon } from './Icon.jsx';
import { datasetSummary } from '../../../demos/lib/dataset-shape.js';
import { repoFile } from '../lib/links.js';

/**
 * Where a demo's data comes from, in one line: generated here from a seed, or fetched once from a
 * named source. Mixed demos show one chip for each half.
 */
export function DataChip({ dataset, file }) {
  if (!dataset) return null;
  const cached = dataset.class === 'cached-real';

  return (
    <span className={`data-chip ${cached ? 'cached' : 'synthetic'}`}>
      <Icon name={cached ? 'database' : 'seed'} size={14} />
      <span>{datasetSummary(dataset)}</span>
      {file && (
        <a href={repoFile(file)} target="_blank" rel="noreferrer">
          data file
        </a>
      )}
    </span>
  );
}

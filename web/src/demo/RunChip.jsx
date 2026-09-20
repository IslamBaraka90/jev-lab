import { Icon } from '../components/Icon.jsx';
import { formatDate } from '../lib/format.js';
import { REPO_URL } from '../lib/links.js';
import { percent } from '../../../demos/lib/metrics.js';

/**
 * Which run this page is showing: the model version, the day it was recorded, how many items, and how
 * many of them matched ground truth. One line, because every number below it depends on it.
 */
export function RunChip({ demo, run, live, items, graded }) {
  if (live) {
    return (
      <p className="run-chip live">
        <Icon name="bolt" size={16} />
        <span>
          <strong>Live.</strong> Items on this page call the TypeSafe API with your key, one request each. The report covers only what you have asked.
        </span>
      </p>
    );
  }

  return (
    <p className="run-chip">
      <span className="run-chip-part">
        <Icon name="check" size={16} />
        <strong>Recorded run</strong>
      </span>
      {run?.model && <span className="run-chip-part mono">{run.model}</span>}
      {run?.recordedAt && <span className="run-chip-part">{formatDate(run.recordedAt)}</span>}
      <span className="run-chip-part num">{items.toLocaleString('en-US')} items</span>
      <span className="run-chip-part">{demo.dataClass === 'synthetic' ? 'synthetic data' : demo.dataClass === 'mixed' ? 'real prices, synthetic records' : 'real market data'}</span>
      {graded?.graded > 0 && (
        <span className="run-chip-part run-chip-grade num">
          {percent(graded.share)} match ground truth · {graded.right} of {graded.graded}
        </span>
      )}
      <a className="run-chip-link" href={REPO_URL} target="_blank" rel="noreferrer">
        Nothing is sent from this page. Run it yourself
      </a>
    </p>
  );
}

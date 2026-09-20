import { Icon } from './Icon.jsx';
import { Link } from '../lib/router.jsx';

const DATA_LABEL = { synthetic: 'Synthetic data', 'cached-real': 'Real market data', mixed: 'Real prices, synthetic records' };

/**
 * One demo in the catalog: what it answers, and what its recorded run found. `score` is the demo's
 * row from the scoreboard, so the card carries a result without loading a dataset.
 */
export function DemoCard({ card, score, feature = false }) {
  const share = score?.graded ? score.right / score.graded : null;
  return (
    <li className={`demo-card domain-${card.domain}${feature ? ' feature' : ''}`}>
      <Link to={`/demos/${card.id}`} className="demo-card-link">
        <span className="demo-card-domain">
          {score?.number && <span className="num">{score.number}</span>}
          {card.domainTitle}
        </span>
        <strong className="demo-card-title">{card.title}</strong>
        <span className="demo-card-value">{card.value}</span>
        {card.status === 'pending-recording' && <span className="badge warn demo-card-status">Answers not recorded yet</span>}

        {score?.headline && (
          <span className="demo-card-result">
            <span className="num demo-card-number">{score.headline.display}</span>
            <span className="meta">{score.headline.label}</span>
            {share !== null && (
              <span className="demo-card-bar" role="img" aria-label={`${score.right} of ${score.graded} items match ground truth`}>
                <i style={{ width: `${share * 100}%` }} />
              </span>
            )}
          </span>
        )}
        {feature && score?.finding && <span className="demo-card-finding">{score.finding}</span>}
      </Link>
      <ul className="demo-card-facts">
        <li>
          <Icon name={card.dataClass === 'synthetic' ? 'seed' : 'database'} size={14} />
          {DATA_LABEL[card.dataClass] ?? card.dataClass}
        </li>
        <li>
          <Icon name="decisions" size={14} />
          {(score?.items ?? 0).toLocaleString('en-US')} items · {card.questionCount} questions
        </li>
      </ul>
    </li>
  );
}

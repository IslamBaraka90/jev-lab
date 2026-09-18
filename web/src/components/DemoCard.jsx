import { Icon } from './Icon.jsx';
import { Link } from '../lib/router.jsx';

const DATA_LABEL = { synthetic: 'Synthetic', 'cached-real': 'Cached', mixed: 'Cached + synthetic' };

/** One demo in the catalog: what it answers, which block it belongs to, and what its data is made of. */
export function DemoCard({ card }) {
  return (
    <li className={`demo-card domain-${card.domain}`}>
      <Link to={`/demos/${card.id}`} className="demo-card-link">
        <span className="demo-card-domain">{card.domainTitle}</span>
        <strong className="demo-card-title">{card.title}</strong>
        <span className="demo-card-value">{card.value}</span>
      </Link>
      <ul className="demo-card-facts">
        <li>
          <Icon name={card.dataClass === 'synthetic' ? 'seed' : 'database'} size={14} />
          {DATA_LABEL[card.dataClass] ?? card.dataClass}
        </li>
        <li>
          <Icon name="decisions" size={14} />
          {card.questionCount} questions
        </li>
        <li>
          <Icon name="clock" size={14} />
          {card.readMinutes} min
        </li>
      </ul>
    </li>
  );
}

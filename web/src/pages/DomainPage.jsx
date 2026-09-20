import { DemoCard } from '../components/DemoCard.jsx';
import scoreboard from '../generated/scoreboard.json';
import { Icon } from '../components/Icon.jsx';
import { EmptyState } from '../components/ui.jsx';
import { DOMAIN_BY_ID } from '../../../demos/domains.js';
import { cards } from '../lib/catalog.js';
import { Link } from '../lib/router.jsx';

const SCORES = new Map(scoreboard.rows.map((row) => [row.id, row]));

/** One block of the series: what it proves, and its demos in the order they should be watched. */
export function DomainPage({ id }) {
  const domain = DOMAIN_BY_ID[id];
  if (!domain) {
    return (
      <EmptyState title="No such domain" action={<Link to="/demos" className="button primary">Back to the catalog</Link>}>
        The nine domains are books, orders, fraud, crypto, portfolio, trades, screening, news and strategy.
      </EmptyState>
    );
  }

  const list = cards().filter((card) => card.domain === domain.id);

  return (
    <div className={`stack domain-page domain-${domain.id}`}>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/demos">Demos</Link>
        <Icon name="chevron" size={16} />
        <span aria-current="page">{domain.title}</span>
      </nav>

      <div className="page-heading">
        <span className="eyebrow">Domain</span>
        <h1>{domain.title}</h1>
        <p>{domain.blurb}</p>
        <p className="meta">
          {list.length} of {domain.planned} demos in this block are live.
        </p>
      </div>

      {list.length > 0 ? (
        <ul className="demo-grid">
          {list.map((card) => (
            <DemoCard key={card.id} card={card} score={SCORES.get(card.id)} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing here yet" action={<Link to="/demos" className="button secondary">See what is live</Link>}>
          This block has {domain.planned} demos specified and none built yet. They arrive one PRP at a time.
        </EmptyState>
      )}
    </div>
  );
}

import { Icon } from '../components/Icon.jsx';
import { DemoCard } from '../components/DemoCard.jsx';
import { cards, catalogCounts, domains } from '../lib/catalog.js';
import { Link } from '../lib/router.jsx';

const WAYS_IN = [
  { to: '/demos', icon: 'search', title: 'Find by job', text: 'Reconcile books, stop fraud, review trades, screen stocks.' },
  { to: '/demos?domain=books', icon: 'grid', title: 'Browse by domain', text: 'Nine blocks, from ledgers to strategy research.' },
  { to: '/lab', icon: 'theater', title: 'Start with the lab', text: 'Three hundred trading decisions, replayed one at a time.' },
  { to: '/about', icon: 'info', title: 'See how it works', text: 'Typed answers, recorded runs, and where the data comes from.' },
];

/** The front door: what this is, and four ways to get to the thing you came for. */
export function HomePage() {
  const counts = catalogCounts();
  const planned = domains().reduce((total, domain) => total + domain.planned, 0);
  const allCards = cards();

  return (
    <div className="stack home">
      <section className="home-hero">
        <span className="eyebrow">TypeSafe Jev · structured answers on financial data</span>
        <h1>Ask a model fifteen questions about one ledger line, and check every answer.</h1>
        <p className="reading">
          Jev returns typed answers: probabilities for every option, a position on a rubric, a probability of yes. This site
          runs those answers over real financial work — books, orders, fraud, wallets, portfolios, trades, filings and
          strategies — and grades them against data where the right answer is known.
        </p>
        <div className="row">
          <Link to="/demos" className="button primary">
            <Icon name="grid" />
            Browse the demos
          </Link>
          <Link to="/about" className="button secondary">
            How this works
          </Link>
        </div>
      </section>

      <section className="ways-in" aria-label="Ways in">
        {WAYS_IN.map((way) => (
          <Link key={way.to} to={way.to} className="way-card">
            <Icon name={way.icon} />
            <strong>{way.title}</strong>
            <span className="meta">{way.text}</span>
          </Link>
        ))}
      </section>

      <section className="panel counts" aria-label="What is here">
        <div>
          <strong className="num">{counts.demos}</strong>
          <span className="meta">demos live, of {planned} planned</span>
        </div>
        <div>
          <strong className="num">{counts.domains}</strong>
          <span className="meta">domains</span>
        </div>
        <div>
          <strong className="num">{counts.questions}</strong>
          <span className="meta">questions asked across the catalog</span>
        </div>
        <div>
          <strong className="num">{counts.cached}</strong>
          <span className="meta">demos on cached real market data</span>
        </div>
      </section>

      {allCards.length > 0 && (
        <section className="stack" aria-labelledby="all-demos-title">
          <h2 id="all-demos-title">All demos</h2>
          <ul className="demo-grid">
            {allCards.map((card) => (
              <DemoCard key={card.id} card={card} />
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-labelledby="domains-title">
        <h2 id="domains-title">The nine blocks</h2>
        <ul className="domain-list">
          {domains().map((domain) => (
            <li key={domain.id} className={`domain-row domain-${domain.id}`}>
              <Link to={`/domains/${domain.id}`}>
                <strong>{domain.title}</strong>
                <span className="meta">{domain.blurb}</span>
              </Link>
              <span className="meta num">
                {allCards.filter((card) => card.domain === domain.id).length} of {domain.planned}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

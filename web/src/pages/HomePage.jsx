import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { DemoCard } from '../components/DemoCard.jsx';
import scoreboard from '../generated/scoreboard.json';
import { cards, domains } from '../lib/catalog.js';
import { Link } from '../lib/router.jsx';

// The front door. Everything on it is a real result from a recorded run: the item in the hero, the
// numbers in the strip, the headline on every card. Nothing here is a mock-up.

// One demo per domain leads its tile and takes a turn in the hero. Chosen for the story, not recency.
const FLAGSHIPS = ['dispute-routing', 'card-fraud-triage', 'three-way-match', 'mixer-tracing', 'mandate-compliance', 'trader-behaviour', 'sharia-screen', 'news-impact', 'strategy-correlation'];
const FEATURED = ['card-fraud-triage', 'dispute-routing', 'strategy-correlation'];

const HONEST = [
  { icon: 'seed', title: 'Seeded data, planted problems', text: 'Every synthetic dataset is generated from a fixed seed, and the generator writes down what it planted.' },
  { icon: 'database', title: 'The state never holds the answer', text: 'Labels live outside the demo folders. A test fails the build if one ever reaches what the model is sent.' },
  { icon: 'decisions', title: 'Typed answers, not prose', text: 'A probability for every option, a position on a rubric, a probability of yes. Code can act on those.' },
  { icon: 'report', title: 'Graded, with the misses shown', text: 'Each report names its own false alarms, puts a simple rule beside the model, and says when the rule wins.' },
];

const percent = (value) => `${(value * 100).toFixed(1)}%`;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALL_IN = 99;

function HeroCard({ rows }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(reducedMotion() ? ALL_IN : 0);
  const [paused, setPaused] = useState(false);
  const row = rows[index % rows.length];
  const showcase = row.showcase;

  // Answers land one at a time, the decision follows, and after a pause the next domain takes over.
  useEffect(() => {
    if (reducedMotion()) return undefined;
    setShown(0);
    const timers = showcase.answers.map((_, step) => setTimeout(() => setShown(step + 1), 500 + step * 650));
    timers.push(setTimeout(() => setShown(ALL_IN), 500 + showcase.answers.length * 650));
    return () => timers.forEach(clearTimeout);
  }, [index]);

  useEffect(() => {
    if (paused || reducedMotion()) return undefined;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % rows.length), 9000);
    return () => clearTimeout(timer);
  }, [index, paused, rows.length]);

  return (
    <div className={`hero-card domain-${row.domain}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="hero-card-top">
        <span className="hero-card-domain">{domains().find((domain) => domain.id === row.domain)?.title}</span>
        <span className="meta mono">{row.run.model}</span>
      </div>
      <strong className="hero-card-item">{showcase.label}</strong>
      <ul className="hero-answers">
        {showcase.answers.map((answer, step) => (
          <li key={answer.title} className={step < shown ? 'in' : undefined}>
            <span className="hero-answer-title">
              <span className="hero-answer-type">{answer.type}</span>
              {answer.title}
            </span>
            <span className="hero-answer-value">{answer.text}</span>
            <span className="hero-answer-bar">
              <i style={{ width: step < shown ? `${Math.max(3, answer.share * 100)}%` : 0 }} />
            </span>
            <span className="num hero-answer-share">{Math.round(answer.share * 100)}%</span>
          </li>
        ))}
      </ul>
      <div className={`hero-verdict${shown >= ALL_IN ? ' in' : ''}`}>
        <span className="eyebrow">The decision these answers make</span>
        <strong>{showcase.verdict}</strong>
        {showcase.agree !== null && (
          <span className={`grade-badge ${showcase.agree ? 'agree' : 'disagree'}`}>
            <Icon name={showcase.agree ? 'check' : 'close'} size={14} />
            {showcase.agree ? 'Matches ground truth' : 'Differs from ground truth'}
          </span>
        )}
      </div>
      <div className="hero-card-foot">
        <Link to={`/demos/${row.id}?item=${encodeURIComponent(showcase.item)}`} className="link-button">
          Open this item in {row.title}
          <Icon name="chevron" size={14} />
        </Link>
        <span className="hero-dots" role="group" aria-label="Which demo is shown">
          {rows.map((entry, step) => (
            <button key={entry.id} type="button" className={step === index % rows.length ? 'current' : undefined} onClick={() => setIndex(step)} aria-label={entry.title} aria-pressed={step === index % rows.length} />
          ))}
        </span>
      </div>
    </div>
  );
}

export function HomePage() {
  const { summary, rows } = scoreboard;
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const allCards = useMemo(cards, []);
  const heroRows = FLAGSHIPS.map((id) => byId.get(id)).filter((row) => row?.showcase?.answers?.length);
  const featured = FEATURED.map((id) => allCards.find((card) => card.id === id)).filter(Boolean);
  const weakest = [...rows].filter((row) => row.graded >= 20).sort((a, b) => a.right / a.graded - b.right / b.graded)[0];

  return (
    <div className="stack home">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">TypeSafe Jev · typed answers on financial work</span>
          <h1>Fifty finance jobs. One model. Every answer typed, and every answer graded.</h1>
          <p className="reading">
            Jev does not write a paragraph about a disputed refund. It returns a probability for every action, a position on a rubric and a probability of yes, which code can act on.
            This site puts that to work on ledgers, orders, fraud queues, wallets, portfolios, trades, filings and strategies, and grades the result against data where the right answer
            is known.
          </p>
          <div className="row">
            <Link to="/demos" className="button primary">
              <Icon name="grid" />
              Browse the demos
            </Link>
            <Link to="/benchmark" className="button secondary">
              <Icon name="chart" />
              See the scoreboard
            </Link>
          </div>
        </div>
        {heroRows.length > 0 && <HeroCard rows={heroRows} />}
      </section>

      <section className="home-strip" aria-label="The suite in numbers">
        <div>
          <strong className="num">{summary.items.toLocaleString('en-US')}</strong>
          <span className="meta">real work items across {summary.demos} demos</span>
        </div>
        <div>
          <strong className="num">{summary.answers.toLocaleString('en-US')}</strong>
          <span className="meta">typed answers, recorded once and replayed here</span>
        </div>
        <div>
          <strong className="num">{percent(summary.rightItems / Math.max(summary.gradedItems, 1))}</strong>
          <span className="meta">of {summary.gradedItems.toLocaleString('en-US')} individually graded items match ground truth</span>
        </div>
        {weakest && (
          <div>
            <strong className="num">{percent(weakest.right / weakest.graded)}</strong>
            <span className="meta">
              on the weakest graded demo, <Link to={`/demos/${weakest.id}`}>{weakest.title}</Link>. It is on the scoreboard too.
            </span>
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="domains-title">
        <div className="section-title">
          <h2 id="domains-title">Nine kinds of work</h2>
          <span className="meta">Each opens on its demos, in the order they are best watched</span>
        </div>
        <ul className="domain-tiles">
          {domains().map((domain) => {
            const flagship = byId.get(FLAGSHIPS.find((id) => byId.get(id)?.domain === domain.id));
            const count = allCards.filter((card) => card.domain === domain.id).length;
            return (
              <li key={domain.id} className={`domain-tile domain-${domain.id}`}>
                <Link to={`/domains/${domain.id}`}>
                  <span className="domain-tile-count num">{count} demos</span>
                  <strong>{domain.title}</strong>
                  <span className="meta">{domain.blurb}</span>
                  {flagship && (
                    <span className="domain-tile-proof">
                      <span className="num">{flagship.headline?.display}</span>
                      <span className="meta">
                        {flagship.headline?.label} · {flagship.title}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack" aria-labelledby="featured-title">
        <div className="section-title">
          <h2 id="featured-title">Start with these three</h2>
          <Link to="/demos" className="link-button">
            All {allCards.length} demos
            <Icon name="chevron" size={14} />
          </Link>
        </div>
        <ul className="demo-grid featured">
          {featured.map((card) => (
            <DemoCard key={card.id} card={card} score={byId.get(card.id)} feature />
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="honest-title">
        <div className="section-title">
          <h2 id="honest-title">How the numbers are kept honest</h2>
          <Link to="/about" className="link-button">
            How this works
            <Icon name="chevron" size={14} />
          </Link>
        </div>
        <ol className="honest-steps">
          {HONEST.map((step, index) => (
            <li key={step.title}>
              <span className="honest-num num">{index + 1}</span>
              <Icon name={step.icon} />
              <strong>{step.title}</strong>
              <span className="meta">{step.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

import { REPO_URL } from '../lib/links.js';
import { liveAvailable } from '../lib/mode.js';
import { Link } from '../lib/router.jsx';

/** What the site is, how it runs, and what its data is made of. Short on purpose. */
export function AboutPage() {
  return (
    <div className="stack about-page about">
      <div className="page-heading">
        <span className="eyebrow">About</span>
        <h1>How this works</h1>
        <p>Fifty demos, one shape: a dataset, typed questions, recorded answers, and a report that grades them.</p>
      </div>

      <section className="panel stack" aria-labelledby="modes-title">
        <h2 id="modes-title">Two modes</h2>
        <dl className="facts">
          <div>
            <dt>Recorded</dt>
            <dd>
              What you are looking at{liveAvailable ? ' on the deployed site' : ' now'}. Every answer was captured once from the
              TypeSafe API and committed to the repository, so the site needs no key, no server and no network. The banner on
              each demo names the model version and the day it was captured.
            </dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd>
              Clone the repository, add your own key and run the local server, and each demo gains a "Run live" switch. It stays
              off until you turn it on and confirm, and the dialog says how many requests a full run would send.
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel stack" aria-labelledby="data-title">
        <h2 id="data-title">Where the data comes from</h2>
        <dl className="facts">
          <div>
            <dt>Cached real</dt>
            <dd>
              Daily candles and company statements, fetched once from Yahoo Finance and committed with a manifest that records
              what was fetched and when. Used where invented numbers would make the demo meaningless: strategies, trades,
              portfolios and screening.
            </dd>
          </div>
          <div>
            <dt>Synthetic</dt>
            <dd>
              Ledgers, orders, wallets, alerts, filings and news, generated in this repository from a fixed seed. Nobody's real
              records go on camera, and because the generator knows what it planted, the report can grade the answers. The
              planted list is kept outside the demo folders so it can never reach a state.
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel stack" aria-labelledby="honest-title">
        <h2 id="honest-title">What this is not</h2>
        <p className="reading">
          It is a research project, not a product and not advice. Numbers come from one recorded run; answers can vary between
          runs. Screening, sanctions and compliance demos illustrate a process with invented rule sets and fictional lists, and
          none of them produce a decision anyone should act on.
        </p>
        <div className="row">
          <a className="button secondary" href={REPO_URL} target="_blank" rel="noreferrer">
            Source and instructions
          </a>
          <Link to="/demos" className="button primary">
            Browse the demos
          </Link>
        </div>
      </section>
    </div>
  );
}

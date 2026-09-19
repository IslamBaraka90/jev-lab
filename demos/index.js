// The demo registry. The catalog, the router, the recorder and the tests all read this file, so a
// demo exists exactly once: adding one means adding its folder and one line here.

import example from './__example__/demo.js';
import ledgerIntegrity from './ledger-integrity/demo.js';
import bankReconciliation from './bank-reconciliation/demo.js';
import expensePosting from './expense-posting/demo.js';
import threeWayMatch from './three-way-match/demo.js';
import closeBlockers from './close-blockers/demo.js';
import orderRisk from './order-risk/demo.js';
import disputeRouting from './dispute-routing/demo.js';
import merchantOnboarding from './merchant-onboarding/demo.js';

/** The nine blocks the demos group into, in catalog order. */
export const DOMAINS = [
  { id: 'books', title: 'Books and reconciliation', blurb: 'Ledgers, statements and the month-end close, read line by line.', planned: 5 },
  { id: 'orders', title: 'Orders and customers', blurb: 'Checkout risk, disputes, delivery and the customers who cost money.', planned: 6 },
  { id: 'fraud', title: 'Fraud and financial crime', blurb: 'Alert queues worth an analyst’s hour, and the patterns behind them.', planned: 6 },
  { id: 'crypto', title: 'Crypto and on-chain', blurb: 'Wallets, traces, tokens and clusters, judged from behaviour.', planned: 5 },
  { id: 'portfolio', title: 'Portfolio', blurb: 'Holdings against a goal: risk, exposure, compliance and cash.', planned: 6 },
  { id: 'trades', title: 'Trades and execution', blurb: 'What a closed trade teaches, and what the fills really cost.', planned: 6 },
  { id: 'screening', title: 'Screening and fundamentals', blurb: 'Statements, screens and standards, with the reasoning shown.', planned: 6 },
  { id: 'news', title: 'News, filings and links', blurb: 'What matters, what repeats, and who is connected to whom.', planned: 5 },
  { id: 'strategy', title: 'Strategy research', blurb: 'Signals, regimes and backtests, judged one instance at a time.', planned: 5 },
];

export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((domain) => [domain.id, domain]));

/** Demos shown in the catalog, in the order the series walks them. Each PRP adds its own. */
export const DEMOS = [ledgerIntegrity, bankReconciliation, expensePosting, threeWayMatch, closeBlockers, orderRisk, disputeRouting, merchantOnboarding];

/** Everything the runtime can load, including the hidden example used by the tests. */
export const ALL_DEMOS = [...DEMOS, example];

export const findDemo = (id) => ALL_DEMOS.find((demo) => demo.id === id);
export const demosInDomain = (domainId) => DEMOS.filter((demo) => demo.domain === domainId);

/** The catalog card for a demo: everything the list needs, without touching its dataset. */
export function demoCard(demo) {
  return {
    id: demo.id,
    title: demo.title,
    domain: demo.domain,
    domainTitle: DOMAIN_BY_ID[demo.domain]?.title ?? demo.domain,
    value: demo.value,
    tags: demo.tags ?? [],
    dataClass: demo.dataClass,
    readMinutes: demo.readMinutes ?? 3,
    questionCount: Object.keys(demo.questions).length,
    status: demo.status ?? 'ready',
  };
}

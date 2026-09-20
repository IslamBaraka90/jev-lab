// The nine blocks the demos group into. Kept apart from the registry so that a page which only needs a
// domain's name does not pull in fifty demo definitions.

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

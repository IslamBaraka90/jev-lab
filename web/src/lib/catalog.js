// Reading the demo registry for the catalog: cards, filters, search and the "I need to" shortcuts.
// The cards come from a manifest `npm run score` writes, so the catalog and the home page load neither a
// dataset nor a demo definition, and stay cheap no matter how many demos the project ends up with.

import { DOMAINS } from '../../../demos/domains.js';
import manifest from '../generated/catalog.json';

/** Catalog cards in the order the series walks them. */
export const cards = () => manifest.cards;

export const domains = () => DOMAINS;

/** The jobs on the catalog's shortcut row, each one a filter people recognise. */
export const NEEDS = [
  { id: 'reconcile', label: 'Reconcile books', filter: { domain: 'books' } },
  { id: 'orders', label: 'Screen orders', filter: { domain: 'orders' } },
  { id: 'fraud', label: 'Stop fraud', filter: { domain: 'fraud' } },
  { id: 'wallets', label: 'Watch wallets', filter: { domain: 'crypto' } },
  { id: 'portfolio', label: 'Review a portfolio', filter: { domain: 'portfolio' } },
  { id: 'trades', label: 'Learn from trades', filter: { domain: 'trades' } },
  { id: 'screen', label: 'Screen stocks', filter: { domain: 'screening' } },
  { id: 'news', label: 'Read the news', filter: { domain: 'news' } },
  { id: 'strategy', label: 'Test a strategy', filter: { domain: 'strategy' } },
];

export const EMPTY_FILTERS = { q: '', domain: 'all', dataClass: 'all' };

/** Filters from the address bar, so any filtered view can be linked to and recorded. */
export function filtersFromSearch(searchParams) {
  return {
    q: searchParams.get('q') ?? '',
    domain: searchParams.get('domain') ?? 'all',
    dataClass: searchParams.get('data') ?? 'all',
  };
}

/** The address for a set of filters, leaving out everything at its default. */
export function searchFromFilters({ q, domain, dataClass }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (domain && domain !== 'all') params.set('domain', domain);
  if (dataClass && dataClass !== 'all') params.set('data', dataClass);
  const search = params.toString();
  return search ? `/demos?${search}` : '/demos';
}

/** Cards that match the filters: domain, data class, then a plain text match on the words people see. */
export function applyFilters(list, { q = '', domain = 'all', dataClass = 'all' } = {}) {
  const needle = q.trim().toLowerCase();
  return list.filter((card) => {
    if (domain !== 'all' && card.domain !== domain) return false;
    if (dataClass !== 'all' && !card.dataClass.includes(dataClass)) return false;
    if (!needle) return true;
    return [card.title, card.value, card.domainTitle, ...card.tags].join(' ').toLowerCase().includes(needle);
  });
}

/** The three nearest cards to a search that found nothing, by shared words. */
export function nearest(list, q, count = 3) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list.slice(0, count);
  const score = (card) => {
    const text = [card.title, card.value, ...card.tags].join(' ').toLowerCase();
    return words.reduce((total, word) => total + (text.includes(word.slice(0, 4)) ? 1 : 0), 0);
  };
  return [...list].sort((a, b) => score(b) - score(a)).slice(0, count);
}

/** Numbers for the home page, counted from the registry rather than typed by hand. */
export function catalogCounts() {
  const list = cards();
  return {
    demos: list.length,
    domains: DOMAINS.length,
    questions: list.reduce((total, card) => total + card.questionCount, 0),
    cached: list.filter((card) => card.dataClass !== 'synthetic').length,
  };
}

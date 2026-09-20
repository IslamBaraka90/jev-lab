import { DOMAIN_BY_ID } from '../../../demos/domains.js';
// The attribute is required by Node, which runs the route tests, and understood by Vite 8.
import manifest from '../generated/catalog.json' with { type: 'json' };

// Every address the site answers. Kept out of App.jsx so it is plain JavaScript that the tests can
// import without a JSX step: a router is the one piece where a silent regression takes a page down.

const TITLES = new Map(manifest.cards.map((card) => [card.id, card.title]));

// #region site:routes
/** Every address the site answers, plus the lab addresses it now redirects away from. */
export function matchRoute(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;

  if (clean === '/') return { page: 'home', section: 'home', title: null };
  if (clean === '/demos') return { page: 'catalog', section: 'demos', title: 'Demos' };
  if (clean === '/benchmark') return { page: 'benchmark', section: 'benchmark', title: 'Benchmark' };
  if (clean === '/about') return { page: 'about', section: 'about', title: 'About' };

  const demo = clean.match(/^\/demos\/([^/]+)$/);
  if (demo) return { page: 'demo', section: 'demos', title: TITLES.get(decodeURIComponent(demo[1])) ?? 'Demo', id: decodeURIComponent(demo[1]) };

  const domain = clean.match(/^\/domains\/([^/]+)$/);
  if (domain) return { page: 'domain', section: 'demos', title: DOMAIN_BY_ID[decodeURIComponent(domain[1])]?.title ?? 'Domain', id: decodeURIComponent(domain[1]) };

  // The backtest lab is a local tool and is not part of the published site. Anyone arriving on one of
  // its old addresses is sent to the demos rather than shown a dead end.
  if (clean === '/lab' || clean.startsWith('/lab/') || clean === '/compare' || clean.startsWith('/runs/')) {
    return { redirect: '/demos' };
  }

  return { page: 'missing', section: null, title: 'Not found' };
}
// #endregion

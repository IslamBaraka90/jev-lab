import { lazy, Suspense, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { SiteShell } from './components/SiteShell.jsx';
import { EmptyState } from './components/ui.jsx';
import { Link, navigate, useLocation } from './lib/router.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { DOMAIN_BY_ID } from '../../demos/domains.js';
import manifest from './generated/catalog.json';

const TITLES = new Map(manifest.cards.map((card) => [card.id, card.title]));

// Everything but the home page loads on demand, so opening the catalog does not download the demo
// runtime, and neither of them downloads the lab.
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx').then((module) => ({ default: module.CatalogPage })));
const DemoPage = lazy(() => import('./pages/DemoPage.jsx').then((module) => ({ default: module.DemoPage })));
const DomainPage = lazy(() => import('./pages/DomainPage.jsx').then((module) => ({ default: module.DomainPage })));
const BenchmarkPage = lazy(() => import('./pages/BenchmarkPage.jsx').then((module) => ({ default: module.BenchmarkPage })));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx').then((module) => ({ default: module.AboutPage })));
const LabArea = lazy(() => import('./areas/LabArea.jsx'));

const Loading = () => (
  <p className="meta" aria-live="polite">
    Loading…
  </p>
);

export function App() {
  const { pathname } = useLocation();
  const route = matchRoute(pathname);

  useEffect(() => {
    if (route.redirect) navigate(route.redirect + window.location.search, { replace: true });
  }, [route.redirect]);

  if (route.redirect) return null;

  if (route.area === 'lab') {
    return (
      <Suspense fallback={<Loading />}>
        <LabArea route={route} />
      </Suspense>
    );
  }

  return (
    <SiteShell section={route.section} title={route.title}>
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<Loading />}>
        {route.page === 'home' && <HomePage />}
        {route.page === 'catalog' && <CatalogPage />}
        {route.page === 'demo' && <DemoPage key={route.id} id={route.id} />}
        {route.page === 'domain' && <DomainPage key={route.id} id={route.id} />}
        {route.page === 'benchmark' && <BenchmarkPage />}
        {route.page === 'about' && <AboutPage />}
        {route.page === 'missing' && (
          <EmptyState title="This page does not exist" action={<Link to="/demos" className="button primary">Go to the demos</Link>}>
            The address may be mistyped, or the demo may not have been built yet.
          </EmptyState>
        )}
      </Suspense>
      </ErrorBoundary>
    </SiteShell>
  );
}

// #region site:routes
/** Every address the site answers, plus the two the lab used to live at. */
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

  if (clean === '/lab') return { area: 'lab', page: 'runs', section: 'runs', title: 'Backtests' };
  if (clean === '/lab/compare') return { area: 'lab', page: 'compare', section: 'compare', title: 'Compare runs' };

  const run = clean.match(/^\/lab\/runs\/([^/]+)(?:\/(theater|report|decisions))?$/);
  if (run) return { area: 'lab', page: 'run', section: 'runs', title: 'Backtest', id: decodeURIComponent(run[1]), view: run[2] ?? null };

  if (clean === '/compare') return { redirect: '/lab/compare' };
  if (clean.startsWith('/runs/')) return { redirect: `/lab${clean}` };

  return { page: 'missing', section: null, title: 'Not found' };
}
// #endregion

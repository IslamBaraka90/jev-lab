import { lazy, Suspense, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { SiteShell } from './components/SiteShell.jsx';
import { EmptyState } from './components/ui.jsx';
import { Link, navigate, useLocation } from './lib/router.jsx';
import { matchRoute } from './lib/routes.js';
import { HomePage } from './pages/HomePage.jsx';

// Everything but the home page loads on demand, so opening the catalog does not download the demo
// runtime, and neither of them downloads the lab.
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx').then((module) => ({ default: module.CatalogPage })));
const DemoPage = lazy(() => import('./pages/DemoPage.jsx').then((module) => ({ default: module.DemoPage })));
const DomainPage = lazy(() => import('./pages/DomainPage.jsx').then((module) => ({ default: module.DomainPage })));
const BenchmarkPage = lazy(() => import('./pages/BenchmarkPage.jsx').then((module) => ({ default: module.BenchmarkPage })));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx').then((module) => ({ default: module.AboutPage })));

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

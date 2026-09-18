import { Shell } from './components/Shell.jsx';
import { EmptyState } from './components/ui.jsx';
import { RunsProvider } from './hooks/useRuns.jsx';
import { Link, useLocation } from './lib/router.jsx';
import { ComparePage } from './pages/ComparePage.jsx';
import { RunPage } from './pages/RunPage.jsx';
import { RunsPage } from './pages/RunsPage.jsx';

export function App() {
  const { pathname } = useLocation();
  const route = matchRoute(pathname);

  return (
    <RunsProvider>
      <Shell section={route.section} title={route.title}>
        {route.page === 'runs' && <RunsPage />}
        {route.page === 'run' && <RunPage key={route.id} id={route.id} view={route.view} />}
        {route.page === 'compare' && <ComparePage />}
        {route.page === 'missing' && (
          <EmptyState title="This page does not exist" action={<Link to="/" className="button primary">Go to backtests</Link>}>
            The address may be mistyped, or the run may have been deleted from results/.
          </EmptyState>
        )}
      </Shell>
    </RunsProvider>
  );
}

function matchRoute(pathname) {
  if (pathname === '/') return { page: 'runs', section: 'runs', title: 'Backtests' };
  if (pathname === '/compare') return { page: 'compare', section: 'compare', title: 'Compare runs' };
  const match = pathname.match(/^\/runs\/([^/]+)(?:\/(theater|report|decisions))?\/?$/);
  if (match) return { page: 'run', section: 'runs', title: 'Backtest', id: decodeURIComponent(match[1]), view: match[2] ?? null };
  return { page: 'missing', section: null, title: 'Not found' };
}

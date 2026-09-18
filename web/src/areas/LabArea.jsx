import { Shell } from '../components/Shell.jsx';
import { RunsProvider } from '../hooks/useRuns.jsx';
import { ComparePage } from '../pages/ComparePage.jsx';
import { RunPage } from '../pages/RunPage.jsx';
import { RunsPage } from '../pages/RunsPage.jsx';

// The backtest lab, with its own sidebar. It loads only when someone visits /lab, so the demo site
// never pays for its charts and run machinery.
export default function LabArea({ route }) {
  return (
    <RunsProvider>
      <Shell section={route.section} title={route.title}>
        {route.page === 'runs' && <RunsPage />}
        {route.page === 'run' && <RunPage key={route.id} id={route.id} view={route.view} />}
        {route.page === 'compare' && <ComparePage />}
      </Shell>
    </RunsProvider>
  );
}

import { useEffect, useState } from 'react';
import { useRuns } from '../hooks/useRuns.jsx';
import { runTitle } from '../lib/labels.js';
import { Link, useLocation } from '../lib/router.jsx';
import { Icon } from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { Dialog } from './ui.jsx';

// The analytics dashboard shell: one persistent side navigation, a top bar with the page context and
// the primary action, and the content frame.
export function Shell({ section, title, children }) {
  const { runs, activeRunId } = useRuns();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeRun = runs.find((run) => run.id === activeRunId);

  useEffect(() => setMenuOpen(false), [pathname]);

  const navigation = (
    <nav aria-label="Main">
      <p className="nav-group-title">Lab</p>
      <Link to="/lab" className="nav-link" aria-current={section === 'runs' ? 'page' : undefined}>
        <Icon name="runs" />
        Backtests
        <span className="nav-count">{runs.length}</span>
      </Link>
      <Link to="/lab/compare" className="nav-link" aria-current={section === 'compare' ? 'page' : undefined}>
        <Icon name="compare" />
        Compare runs
      </Link>
      {activeRun && (
        <>
          <p className="nav-group-title">Running now</p>
          <Link to={`/lab/runs/${activeRun.id}/theater`} className="nav-link" aria-current={pathname.startsWith(`/lab/runs/${activeRun.id}`) ? 'page' : undefined}>
            <span className="pulse" aria-hidden="true" />
            <span className="nav-live-title">{runTitle(activeRun)}</span>
            <span className="nav-count">
              {activeRun.symbols.reduce((sum, symbol) => sum + symbol.decided, 0)}/
              {activeRun.symbols.reduce((sum, symbol) => sum + symbol.planned, 0)}
            </span>
          </Link>
        </>
      )}
    </nav>
  );

  return (
    <>
      <a href="#content" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/lab" className="sidebar-brand">
          <Logo size={44} />
          <span className="stack" style={{ gap: 2 }}>
            <strong>Jev Backtest Lab</strong>
            <span className="meta">The Fintech Builder</span>
          </span>
        </Link>
        <div className="side-content">{navigation}</div>
        <div className="sidebar-footer">
          Decisions by TypeSafe Jev. Market data from Yahoo Finance. Runs are saved in <code>results/</code>.
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button type="button" className="button ghost icon mobile-nav" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="top-context">
            <span className="meta">Jev Backtest Lab</span>
            <strong>{title}</strong>
          </div>
          {activeRun && !pathname.startsWith(`/lab/runs/${activeRun.id}`) && (
            <Link to={`/lab/runs/${activeRun.id}/theater`} className="button secondary live-chip">
              <span className="pulse" aria-hidden="true" />
              Watch live run
            </Link>
          )}
          <Link to="/lab#new-backtest" className="button primary" onClick={() => setTimeout(() => document.getElementById('new-backtest')?.scrollIntoView(), 0)}>
            <Icon name="plus" />
            New backtest
          </Link>
        </header>
        <main id="content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Jev Backtest Lab" className="nav-dialog">
        {navigation}
      </Dialog>
    </>
  );
}

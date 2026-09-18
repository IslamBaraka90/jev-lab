import { useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { REPO_URL } from '../lib/links.js';
import { liveAvailable, modeExplainer, modeLabel } from '../lib/mode.js';
import { Link, navigate, useLocation } from '../lib/router.jsx';

const NAV = [
  { to: '/demos', label: 'Demos', section: 'demos' },
  { to: '/lab', label: 'Lab', section: 'lab' },
  { to: '/about', label: 'About', section: 'about' },
];

/**
 * The frame for the demo site: one top bar, the page, and a footer that says what the site is made of.
 * The lab keeps its own sidebar layout; this is everything around it.
 */
export function SiteShell({ section, title, children }) {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = title ? `${title} · Jev Lab` : 'Jev Lab';
  }, [title]);

  // "/" focuses search, "g" then d/l/h jumps between sections.
  useEffect(() => {
    let pending = null;
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select, dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/') {
        const search = document.getElementById('demo-search');
        if (search) {
          event.preventDefault();
          search.focus();
        }
        return;
      }
      if (event.key === 'g') {
        pending = setTimeout(() => (pending = null), 900);
        return;
      }
      if (pending) {
        clearTimeout(pending);
        pending = null;
        if (event.key === 'd') navigate('/demos');
        if (event.key === 'l') navigate('/lab');
        if (event.key === 'h') navigate('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="site">
      <a href="#content" className="skip">
        Skip to content
      </a>
      <header className="site-bar">
        <Link to="/" className="site-brand">
          <Logo size={34} />
          <span>
            <strong>Jev Lab</strong>
            <span className="meta">The Fintech Builder</span>
          </span>
        </Link>
        <nav aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="site-nav-link" aria-current={section === item.section ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <span className={`mode-chip ${liveAvailable ? 'live' : 'recorded'}`} title={modeExplainer}>
          <Icon name={liveAvailable ? 'bolt' : 'check'} size={14} />
          {modeLabel}
        </span>
      </header>

      <main id="content" className="site-main" key={pathname}>
        {children}
      </main>

      <footer className="site-footer">
        <span>Decisions by TypeSafe Jev. Market data cached from Yahoo Finance; everything else is generated in this repository.</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source and instructions
        </a>
      </footer>
    </div>
  );
}

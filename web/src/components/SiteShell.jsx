import { useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { REPO_URL } from '../lib/links.js';
import { metaFor } from '../lib/meta.js';
import { liveAvailable, modeExplainer, modeLabel } from '../lib/mode.js';
import { Link, navigate, useLocation } from '../lib/router.jsx';

const NAV = [
  { to: '/demos', label: 'Demos', section: 'demos' },
  { to: '/benchmark', label: 'Benchmark', section: 'benchmark' },
  { to: '/about', label: 'About', section: 'about' },
];

/**
 * The frame for the site: one top bar, the page, and a footer that says what the site is made of.
 */
export function SiteShell({ section, title, children }) {
  const { pathname } = useLocation();

  // The build writes a real head into every page, which is what a crawler reads. Moving around inside
  // the app never reloads the document, so the same values are applied again here — otherwise the
  // second page you visit is shared and bookmarked under the first page's title and description.
  useEffect(() => {
    const meta = metaFor(pathname);
    document.title = meta.title;

    const set = (selector, attribute, value) => {
      const node = document.head.querySelector(selector);
      if (node) node.setAttribute(attribute, value);
    };
    set('meta[name="description"]', 'content', meta.description);
    set('meta[property="og:title"]', 'content', meta.title);
    set('meta[property="og:description"]', 'content', meta.description);
    set('meta[property="og:url"]', 'content', meta.canonical);
    set('meta[name="twitter:title"]', 'content', meta.title);
    set('meta[name="twitter:description"]', 'content', meta.description);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = meta.canonical;
  }, [pathname, title]);

  // "/" focuses search, "g" then d/b/l/h jumps between sections.
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
        if (event.key === 'b') navigate('/benchmark');
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

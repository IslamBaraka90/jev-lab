import { useSyncExternalStore } from 'react';

// A small history router: the dashboard has only a handful of routes.

const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

function currentHref() {
  return window.location.pathname + window.location.search;
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, currentHref);
  const url = new URL(href, window.location.origin);
  return { href, pathname: url.pathname, searchParams: url.searchParams };
}

export function navigate(to, { replace = false, scroll = true } = {}) {
  if (to === currentHref()) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
  for (const listener of listeners) listener();
  if (scroll) window.scrollTo({ top: 0 });
}

export function Link({ to, onClick, scroll = true, ...props }) {
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to, { scroll });
      }}
      {...props}
    />
  );
}

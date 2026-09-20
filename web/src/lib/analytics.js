import { SITE_URL } from './meta.js';

// Google Analytics, on the published site and nowhere else.
//
// This repository is public, so the measurement id is never committed: it arrives as VITE_GA_ID at
// build time and .env.example leaves it empty. Anyone who clones this and runs it sends nothing,
// because there is no id to send it to.
//
// The id alone is not enough, though — a fork could be deployed with one, and a preview build on
// *.vercel.app carries the same bundle as production. So the host has to match the canonical site as
// well. Between them: the real domain reports, and localhost, previews and forks stay silent.

const ID = (import.meta.env?.VITE_GA_ID ?? '').trim();

/** The one host worth measuring, taken from the canonical address rather than written out twice. */
function measuredHost() {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return null;
  }
}

/**
 * Loads gtag.js if this is the published site. Returns why it did nothing when it does nothing, which
 * is what the test asserts on and what to read in the console if a hit is missing.
 */
export function startAnalytics({ hostname = globalThis.location?.hostname, id = ID } = {}) {
  // An unset variable can arrive as an empty string or as whitespace, and whitespace is truthy.
  const key = String(id ?? '').trim();
  if (!key) return 'no-measurement-id';

  // The host is checked before the document, so the promise this makes — a fork stays silent — can
  // be asserted without a browser.
  const host = measuredHost();
  if (!host || hostname !== host) return 'not-the-published-site';

  if (typeof document === 'undefined') return 'no-document';
  if (document.getElementById('ga-src')) return 'already-loaded';

  // The same snippet the rest of thefintechbuilder.com runs, so this subdomain reports into the same
  // property and the two are comparable. Page views after the first come from the stream's history
  // tracking, exactly as they do on the main site, so nothing here sends a second one.
  const loader = document.createElement('script');
  loader.id = 'ga-src';
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(key)}`;
  document.head.append(loader);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', key);

  return 'started';
}

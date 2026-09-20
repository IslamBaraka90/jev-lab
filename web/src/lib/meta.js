import { DOMAINS, DOMAIN_BY_ID } from '../../../demos/domains.js';
import manifest from '../generated/catalog.json' with { type: 'json' };

// The head of every page, in one place. The build writes these into real HTML files so a crawler that
// does not run JavaScript — which is most of them, including the ones behind link previews — sees the
// right title and description; the shell applies the same values again when you navigate in the app.

export const SITE_NAME = 'Jev Lab';
export const SITE_URL = (import.meta.env?.VITE_SITE_URL || 'https://jev.thefintechbuilder.com').replace(/\/$/, '');

const CARDS = manifest.cards;
const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

/** Google shows about sixty characters of a title and a hundred and sixty of a description. */
const clamp = (text, limit) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).replace(/[\s,;:.—-]+$/, '')}…`;
};

const DATA_WORDS = {
  synthetic: 'generated data with the answers planted in it',
  'cached-real': 'real cached market data',
  mixed: 'real cached prices with generated events',
};

/** Every address worth putting in a sitemap, in the order a reader would meet them. */
export function siteRoutes() {
  return [
    { path: '/', priority: '1.0' },
    { path: '/demos', priority: '0.9' },
    { path: '/benchmark', priority: '0.7' },
    { path: '/about', priority: '0.5' },
    ...DOMAINS.map((domain) => ({ path: `/domains/${domain.id}`, priority: '0.8' })),
    ...CARDS.map((card) => ({ path: `/demos/${card.id}`, priority: '0.8' })),
  ];
}

/** The title, description and canonical address for one path. */
export function metaFor(pathname) {
  const meta = describe(pathname);
  return { ...meta, description: clamp(meta.description, 160), title: clamp(meta.title, 70) };
}

function describe(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const canonical = `${SITE_URL}${clean === '/' ? '/' : clean}`;
  const base = { canonical, type: 'website' };

  if (clean === '/') {
    return {
      ...base,
      title: `${SITE_NAME} — typed LLM answers on 50 real financial jobs`,
      description: 'Fifty worked examples of TypeSafe’s Jev model on real financial work — ledgers, fraud, wallets, portfolios, trades and filings. Every answer typed, recorded and graded.',
      jsonLd: websiteJsonLd(),
    };
  }

  if (clean === '/demos') {
    return {
      ...base,
      title: `All 50 demos — ${SITE_NAME}`,
      description: `All ${CARDS.length} Jev demos in one list, across ${DOMAINS.length} domains. Each one shows the state that was sent, the typed answers that came back, and how they scored.`,
      jsonLd: catalogJsonLd(),
    };
  }

  if (clean === '/benchmark') {
    return {
      ...base,
      title: `Benchmark — how Jev scored on all 50 — ${SITE_NAME}`,
      description: 'The scoreboard across all fifty demos: what each asked, what the recorded run got right, and where it did badly. Every number comes from a committed run.',
    };
  }

  if (clean === '/about') {
    return {
      ...base,
      title: `How this works — recorded runs and graded answers — ${SITE_NAME}`,
      description: 'How the site works: recorded answers replayed with no API key, where the data comes from, and why the labels live outside anything the model is ever sent.',
    };
  }

  const domainMatch = clean.match(/^\/domains\/([^/]+)$/);
  if (domainMatch) {
    const domain = DOMAIN_BY_ID[decodeURIComponent(domainMatch[1])];
    if (domain) {
      const count = CARDS.filter((card) => card.domain === domain.id).length;
      return {
        ...base,
        title: clamp(`${domain.title} — ${count} Jev demos`, 62),
        description: clamp(`${domain.blurb} ${count} worked examples, each graded against data where the right answer is known.`, 160),
        jsonLd: domainJsonLd(domain, count),
      };
    }
  }

  const demoMatch = clean.match(/^\/demos\/([^/]+)$/);
  if (demoMatch) {
    const card = CARD_BY_ID.get(decodeURIComponent(demoMatch[1]));
    if (card) {
      const data = DATA_WORDS[card.dataClass] ?? 'committed data';
      return {
        ...base,
        type: 'article',
        title: clamp(`${card.title} — Jev demo on ${card.domainTitle.toLowerCase()}`, 66),
        description: clamp(`${card.value} A recorded Jev run over ${data}, with ${card.questionCount} typed questions and a report that grades every answer.`, 160),
        keywords: [...card.tags, 'jev', 'typesafe', 'structured output', 'llm evaluation'],
        jsonLd: demoJsonLd(card, canonical),
      };
    }
  }

  return { ...base, title: `Page not found — ${SITE_NAME}`, description: 'This address does not exist on the Jev demo site.', noindex: true };
}

function websiteJsonLd() {
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/`, description: 'Fifty worked examples of typed, structured LLM answers on real financial work.' },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Jev demos',
      numberOfItems: CARDS.length,
      itemListElement: CARDS.slice(0, 50).map((card, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/demos/${card.id}`, name: card.title })),
    },
  ];
}

const catalogJsonLd = () => [{
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: `All ${CARDS.length} Jev demos`,
  url: `${SITE_URL}/demos`,
  numberOfItems: CARDS.length,
}];

const domainJsonLd = (domain, count) => [{
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: domain.title,
  description: domain.blurb,
  url: `${SITE_URL}/domains/${domain.id}`,
  numberOfItems: count,
}];

const demoJsonLd = (card, canonical) => [{
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: card.title,
  description: card.value,
  url: canonical,
  keywords: card.tags.join(', '),
  timeRequired: `PT${card.readMinutes}M`,
  isPartOf: { '@type': 'CollectionPage', name: SITE_NAME, url: `${SITE_URL}/demos` },
  about: { '@type': 'Thing', name: card.domainTitle },
}];

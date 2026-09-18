# 003 · App structure and demo catalog

**Depends on:** 001, 002 · **Blocks:** every demo

## Why

Fifty demos are useless if a visitor can't find the one that matches their job. The site's first job is to get someone from "I run an e-commerce back office" to a working demo in two clicks, and its second is to be easy to walk through on camera in one long take.

## Information architecture

```
/                          Home: what this is, how to read a demo, four ways in
/demos                     Catalog: all 50, filterable
/demos/<slug>              One demo (004 defines the page)
/domains/<domain>          One domain: its demos, shared data, and why they group
/lab                       The backtest lab, kept whole (theater, report, decisions, compare)
/about                     Modes, data classes, cost, repo, disclaimer
```

The existing lab routes move under `/lab/*` with redirects from the old paths. Its runs stay exactly as they are; it becomes the deep-dive behind the trades block, linked from 151–156 and 181–185.

## Home

One screen, no carousel:

- A line saying what the model does, in the site's own words: typed answers with probabilities, on financial data.
- **Four ways in**, as large cards: *Find by job* · *Find by domain* · *Find by question type* · *Start with the lab*.
- Three featured demos, rotated by editing one array, not by time.
- A strip of numbers that are true and computed at build time: demos, datasets, recorded answers, questions asked.

## Catalog

- **Grid of cards.** Each card: title, one-line value, domain, data badges (Synthetic / Cached), question types used, item count, and an estimated read time.
- **Filter row, one line, always visible:** domain chips, data class, question type, and a search box that matches title, value line and tags.
- **"I need to…" chips** above the filters, mapping a job to a filtered view: *reconcile books*, *stop fraud*, *review trades*, *screen stocks*, *watch wallets*, *check compliance*, *rank a portfolio*, *read news*.
- **Sort:** curated order by default, then alphabetical or newest.
- **Empty state** names what was searched and offers the nearest three demos.
- URL carries the filters (`/demos?domain=fraud&data=synthetic&q=wallet`), so any filtered view is linkable and recordable.

## Domain pages

One per block, nine in total. Each shows the domain's demos in the order they should be watched, the dataset they share, and a short paragraph on what the block proves. This is the page the video uses as a chapter opener.

## Navigation

- Persistent top bar: brand, Demos, Domains, Lab, About, and a mode chip (Recorded / Live).
- On a demo page, previous and next demo links within the domain, so a walkthrough never returns to the catalog.
- Breadcrumbs: Demos › Domain › Demo.
- `/` is reachable from the brand; the browser back button never loses filter state.

## Keyboard

| Key | Action |
|---|---|
| `/` | Focus search |
| `g` then `d` | Demos · `g` then `l` Lab · `g` then `h` Home |
| `j` / `k` | Move through cards or items |
| `Enter` | Open the focused card |
| `←` / `→` | Previous or next demo (demo page) |
| `p` | Presenter mode (005) |

## Visual language

Keep the existing dark navy theme and tokens. Add per-domain accents from the same palette, used only on badges, domain headers and the catalog chips, never on data marks: books, orders, fraud, crypto, portfolio, trades, screening, news, strategy.

## Content each demo must supply

From its `demo.js`, used by the catalog without loading the dataset:

`id`, `title`, `domain`, `value` (one line), `tags[]`, `dataClass`, `itemCount`, `questionTypes[]`, `readMinutes`, `featured`.

## Files

| Path | Change |
|---|---|
| `web/src/pages/HomePage.jsx` | new |
| `web/src/pages/CatalogPage.jsx` | new |
| `web/src/pages/DomainPage.jsx` | new |
| `web/src/pages/AboutPage.jsx` | new |
| `web/src/components/DemoCard.jsx`, `FilterBar.jsx`, `NeedChips.jsx` | new |
| `web/src/lib/catalog.js` | new: read the registry, filter, sort, search |
| `web/src/lib/router.jsx` | add routes and redirects for `/lab/*` |
| `web/src/components/Shell.jsx` | rework nav for the new sections |
| `demos/index.js` | the registry (002 defines the folder, this defines the fields) |
| `test/catalog.test.js` | new: filtering, search, redirects |

## Acceptance

- [ ] Every one of the 50 demos appears in the catalog with a value line, data badge and item count.
- [ ] Every "I need to…" chip lands on a non-empty filtered view.
- [ ] Filters survive reload and back navigation, because they live in the URL.
- [ ] Old lab URLs redirect to `/lab/...` with no dead links anywhere.
- [ ] The catalog renders without loading any dataset or fixture file.
- [ ] Keyboard map works, and focus is visible on every interactive element.
- [ ] At 400 px wide the catalog is one column with no horizontal scroll.

## Video beats

- Home, then two clicks to a demo, said out loud as a promise and kept.
- The "I need to…" chips filtering the grid live.
- A domain page as the chapter opener for that block.

## Notes and risks

- The curated order is the video order. Keep them in one array so they can't drift apart.
- Don't let the catalog import demo datasets; it is the page most likely to get slow.

import { useMemo } from 'react';
import { DemoCard } from '../components/DemoCard.jsx';
import scoreboard from '../generated/scoreboard.json';
import { FilterBar } from '../components/FilterBar.jsx';
import { EmptyState } from '../components/ui.jsx';
import { applyFilters, cards, filtersFromSearch, nearest, searchFromFilters } from '../lib/catalog.js';
import { Link, navigate, useLocation } from '../lib/router.jsx';

const SCORES = new Map(scoreboard.rows.map((row) => [row.id, row]));

/** Every demo, filtered by the job someone arrived with. The filters live in the address bar. */
export function CatalogPage() {
  const { searchParams } = useLocation();
  const filters = filtersFromSearch(searchParams);
  const all = useMemo(cards, []);
  const visible = useMemo(() => applyFilters(all, filters), [all, filters.q, filters.domain, filters.dataClass]);

  const setFilters = (next) => navigate(searchFromFilters(next), { replace: true, scroll: false });

  return (
    <div className="stack catalog">
      <div className="page-heading">
        <span className="eyebrow">Catalog</span>
        <h1>Demos</h1>
        <p>Each one is a dataset, a set of typed questions, and a report that grades the answers.</p>
      </div>

      <FilterBar filters={filters} onChange={setFilters} count={visible.length} total={all.length} />

      {visible.length > 0 && (
        <ul className="demo-grid">
          {visible.map((card) => (
            <DemoCard key={card.id} card={card} score={SCORES.get(card.id)} />
          ))}
        </ul>
      )}

      {visible.length === 0 && all.length > 0 && (
        <EmptyState title={`Nothing matches “${filters.q || 'those filters'}”`} action={<button type="button" className="button secondary" onClick={() => setFilters({ q: '', domain: 'all', dataClass: 'all' })}>Clear filters</button>}>
          <ul className="demo-grid">
            {nearest(all, filters.q).map((card) => (
              <DemoCard key={card.id} card={card} score={SCORES.get(card.id)} />
            ))}
          </ul>
        </EmptyState>
      )}

      {all.length === 0 && (
        <EmptyState
          title="The catalog is still being built"
          action={
            <Link to="/demos/__example__" className="button primary">
              Open the example demo
            </Link>
          }
        >
          The foundation is in place: recorded answers, seeded datasets, the shared runtime and the code panel. Demos land one
          PRP at a time, starting with the ledger review.
        </EmptyState>
      )}
    </div>
  );
}

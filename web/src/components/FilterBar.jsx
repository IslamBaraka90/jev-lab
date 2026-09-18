import { Icon } from './Icon.jsx';
import { NEEDS, domains } from '../lib/catalog.js';

const DATA_CLASSES = [
  { value: 'all', label: 'Any data' },
  { value: 'synthetic', label: 'Synthetic' },
  { value: 'cached-real', label: 'Cached real' },
];

/**
 * The catalog's one-line filter row, plus the jobs people arrive with. Everything it changes goes into
 * the address bar, so a filtered view can be linked, bookmarked and recorded.
 */
export function FilterBar({ filters, onChange, count, total }) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="filters">
      <div className="need-chips" role="group" aria-label="What do you need to do?">
        {NEEDS.map((need) => (
          <button
            key={need.id}
            type="button"
            className={`chip${filters.domain === need.filter.domain ? ' selected' : ''}`}
            aria-pressed={filters.domain === need.filter.domain}
            onClick={() => set({ domain: filters.domain === need.filter.domain ? 'all' : need.filter.domain })}
          >
            {need.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <div className="field search-field">
          <label className="sr-only" htmlFor="demo-search">
            Search demos
          </label>
          <Icon name="search" size={16} />
          <input
            id="demo-search"
            type="search"
            placeholder="Search demos…  (press /)"
            value={filters.q}
            onChange={(event) => set({ q: event.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label className="sr-only" htmlFor="domain-filter">
            Domain
          </label>
          <select id="domain-filter" value={filters.domain} onChange={(event) => set({ domain: event.target.value })}>
            <option value="all">All domains</option>
            {domains().map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="sr-only" htmlFor="data-filter">
            Data
          </label>
          <select id="data-filter" value={filters.dataClass} onChange={(event) => set({ dataClass: event.target.value })}>
            {DATA_CLASSES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <p className="meta filter-summary" aria-live="polite">
          Showing {count} of {total} demos
        </p>
      </div>
    </div>
  );
}

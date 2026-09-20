// Functional icons on a 24 px grid. Filled glyphs set their own fill; the rest are 2 px strokes.
const PATHS = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M7.5 5h3.5v14H7.5zM13 5h3.5v14H13z" fill="currentColor" stroke="none" />,
  previous: <path d="M17.5 6 9.5 12l8 6zM6.5 6v12" />,
  next: <path d="M6.5 6l8 6-8 6zM17.5 6v12" />,
  latest: <path d="M4.5 6.5 11 12l-6.5 5.5zM12.5 6.5 19 12l-6.5 5.5z" />,
  restart: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  runs: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  compare: <path d="M4 5h6.5v14H4zM13.5 5H20v14h-6.5z" />,
  theater: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 8.6v6.8l5.4-3.4z" fill="currentColor" stroke="none" />
    </>
  ),
  report: <path d="M5 19.5V11M10 19.5V5M15 19.5V13M20 19.5V8.5M3 19.5h18" />,
  decisions: <path d="M4 5h16v14H4zM4 10h16M4 14.5h16M9.5 5v14" />,
  table: <path d="M4 5h16v14H4zM4 10h16M4 14.5h16M9.5 5v14" />,
  chart: <path d="M4 17l5.5-5.5 4 4L20 9" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <path d="M12 4 3 19.5h18L12 4zM12 10v4.5M12 17h.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  chevron: <path d="M9.5 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15V5.5a1 1 0 0 1 1-1H15" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h6L10.5 21 19 10.5h-6z" />,
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  seed: (
    <>
      <path d="M12 21c-4.5 0-7.5-3-7.5-7.5S8 4 16.5 3c1 8.5-2 18-4.5 18z" />
      <path d="M12 21c0-5 1.5-9 4.5-12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  code: <path d="M9 7.5 4.5 12 9 16.5M15 7.5 19.5 12 15 16.5" />,
  // The GitHub mark, which is a filled glyph rather than a stroke like the rest of this set.
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 1.3a10.7 10.7 0 0 0-3.38 20.86c.53.1.73-.23.73-.51v-1.8c-2.98.65-3.6-1.44-3.6-1.44-.49-1.24-1.19-1.57-1.19-1.57-.97-.66.07-.65.07-.65 1.07.08 1.64 1.1 1.64 1.1.96 1.64 2.5 1.17 3.12.9.1-.7.37-1.17.68-1.44-2.38-.27-4.88-1.19-4.88-5.29 0-1.17.42-2.12 1.1-2.87-.11-.27-.48-1.36.1-2.83 0 0 .9-.29 2.95 1.1a10.2 10.2 0 0 1 5.35 0c2.04-1.39 2.94-1.1 2.94-1.1.59 1.47.22 2.56.11 2.83.69.75 1.1 1.7 1.1 2.87 0 4.11-2.5 5.02-4.89 5.28.39.33.73.99.73 1.99v2.94c0 .29.2.62.74.51A10.7 10.7 0 0 0 12 1.3z"
    />
  ),
  present: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11" rx="2" />
      <path d="M12 15.5V20M8.5 20h7" />
    </>
  ),
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
};

export function Icon({ name, size = 20, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

import { Icon } from '../components/Icon.jsx';
import { EmptyState } from '../components/ui.jsx';
import { DemoRuntime } from '../demo/DemoRuntime.jsx';
import { Presenter } from '../demo/Presenter.jsx';
import { ALL_DEMOS, DEMOS, DOMAIN_BY_ID, findDemo } from '../../../demos/index.js';
import { Link, useLocation } from '../lib/router.jsx';

/** One demo: its heading and neighbours, with the shared runtime underneath, or its story full screen. */
export function DemoPage({ id }) {
  const { pathname, searchParams } = useLocation();
  const demo = findDemo(id);

  if (!demo) {
    return (
      <EmptyState title="No such demo" action={<Link to="/demos" className="button primary">Back to the catalog</Link>}>
        There is no demo called {id}. It may not have been built yet.
      </EmptyState>
    );
  }

  if (searchParams.get('present') === '1') return <Presenter key={demo.id} demo={demo} />;

  const domain = DOMAIN_BY_ID[demo.domain];
  const siblings = (demo.hidden ? ALL_DEMOS : DEMOS).filter((entry) => entry.domain === demo.domain);
  const index = siblings.findIndex((entry) => entry.id === demo.id);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];

  return (
    <div className={`stack demo-page domain-${demo.domain}`}>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/demos">Demos</Link>
        <Icon name="chevron" size={16} />
        <Link to={`/domains/${demo.domain}`}>{domain?.title ?? demo.domain}</Link>
        <Icon name="chevron" size={16} />
        <span aria-current="page">{demo.title}</span>
      </nav>

      <div className="page-heading demo-heading">
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">{domain?.title ?? demo.domain}</span>
          <h1>{demo.title}</h1>
          <p>{demo.value}</p>
        </div>
        <div className="row demo-heading-actions">
          <Link to={`${pathname}?present=1`} className="button secondary" title="Presenter mode (p)">
            <Icon name="present" />
            Watch the story
          </Link>
        </div>
      </div>

      <DemoRuntime key={demo.id} demo={demo} />

      {(previous || next) && (
        <nav className="row between demo-pager" aria-label="Other demos in this block">
          {previous ? (
            <Link className="button secondary" to={`/demos/${previous.id}`}>
              <Icon name="previous" />
              {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link className="button secondary" to={`/demos/${next.id}`}>
              {next.title}
              <Icon name="next" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

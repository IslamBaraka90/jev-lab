// Session-specific stage: account baseline on top, then every timestamped event in order.

const readable = (value) => String(value).toLowerCase().replaceAll('_', ' ');
const show = (value) => typeof value === 'number' ? value.toLocaleString('en-US') : String(value);

export function TimelineView({ item }) {
  const { account, session, timeline } = item;
  return (
    <div className="stack session-view" style={{ gap: 16 }}>
      <dl className="facts session-facts">
        <div><dt>Account</dt><dd>{account.id}</dd></div>
        <div><dt>Device</dt><dd>{session.device.id}{session.device.isNew ? ' · new' : ' · known'}</dd></div>
        <div><dt>Network</dt><dd>{session.network.country} · {readable(session.network.asnType)}</dd></div>
        <div><dt>Login</dt><dd>{readable(session.loginMethod)}</dd></div>
      </dl>
      <div className="account-baseline">
        <span className="eyebrow">90-day baseline</span>
        <p>{account.usualCountries.join(', ')} · {account.usualDevices.length} usual device · average transfer {account.transferProfile.averageAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
      </div>
      <ol className="session-timeline" aria-label="Session timeline">
        {timeline.map((entry, index) => {
          const details = Object.entries(entry).filter(([key]) => !['at', 'type'].includes(key));
          return (
            <li key={`${entry.at}-${entry.type}-${index}`}>
              <span className="session-dot" aria-hidden="true" />
              <div className="session-event stack" style={{ gap: 4 }}>
                <div className="row between">
                  <strong>{readable(entry.type)}</strong>
                  <time dateTime={entry.at}>{new Date(entry.at).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
                </div>
                {details.length > 0 && <p>{details.map(([key, value]) => `${readable(key)}: ${show(value)}`).join(' · ')}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}


// Alert-shaped items: a headline, the few fields that matter, and any free text underneath. Used by
// the fraud, orders and news demos, where an item is something a person would triage.

const readable = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

const isText = (value) => typeof value === 'string' && value.length > 60;
const isSimple = (value) => ['string', 'number', 'boolean'].includes(typeof value) && !isText(value);

export function QueueView({ item, demo }) {
  const entries = Object.entries(item).filter(([key]) => key !== 'id');
  const facts = entries.filter(([, value]) => isSimple(value)).slice(0, 12);
  const texts = entries.filter(([, value]) => isText(value));

  return (
    <div className="stack queue-view" style={{ gap: 14 }}>

      <dl className="facts">
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt>{readable(key)}</dt>
            <dd className={typeof value === 'number' ? 'num' : undefined}>
              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'number' ? value.toLocaleString('en-US') : value}
            </dd>
          </div>
        ))}
      </dl>

      {texts.map(([key, value]) => (
        <div key={key} className="queue-text">
          <span className="eyebrow">{readable(key)}</span>
          <p className="reading">{value}</p>
        </div>
      ))}
    </div>
  );
}

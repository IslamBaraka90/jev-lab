async function request(path, { body, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? `The server answered with status ${response.status}.`);
  return payload;
}

const encode = encodeURIComponent;

export const api = {
  runs: () => request('/api/backtests'),
  run: (id) => request(`/api/backtests/${encode(id)}`),
  start: (options) => request('/api/backtests', { method: 'POST', body: options }),
  cancel: (id) => request(`/api/backtests/${encode(id)}/cancel`, { method: 'POST' }),
  decision: (id, symbol, cutoff) => request(`/api/backtests/${encode(id)}/symbols/${encode(symbol)}/decisions/${cutoff}`),
};

/**
 * Follows a run over server-sent events: `onEvent` gets its snapshot, then each event until it finishes.
 * `onConnection` gets "open", "reconnecting", "closed" or "failed". Returns a function that stops following.
 */
export function followRun(id, { onEvent, onConnection }) {
  const source = new EventSource(`/api/backtests/${encode(id)}/events`);
  source.onopen = () => onConnection('open');
  source.onmessage = (message) => {
    const event = JSON.parse(message.data);
    onEvent(event);
    if (event.type === 'run-finished' || (event.type === 'snapshot' && event.run.status !== 'running')) {
      source.close();
      onConnection('closed');
    }
  };
  source.onerror = () => onConnection(source.readyState === EventSource.CLOSED ? 'failed' : 'reconnecting');
  return () => source.close();
}

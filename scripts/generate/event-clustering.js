import { createRandom } from './lib/random.js';

export const SEED = 1172;
const OUTLET_TYPES = ['wire', 'newspaper', 'aggregator', 'blog'];
const OUTLETS = Array.from({ length: 22 }, (_, index) => ({ id: `Outlet ${String(index + 1).padStart(2, '0')}`, type: OUTLET_TYPES[index % OUTLET_TYPES.length] }));
const ACTIONS = ['raises guidance', 'cuts guidance', 'announces a recall', 'files merger terms', 'wins a contract', 'loses a contract', 'reports an outage', 'restores service', 'changes leadership', 'prices a bond', 'settles litigation', 'opens an investigation'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const events = Array.from({ length: 46 }, (_, index) => ({
    id: `EV-${String(index + 1).padStart(2, '0')}`,
    subject: `North ${['Harbor', 'Bridge', 'River', 'Field', 'Point', 'Lake'][index % 6]} ${String.fromCharCode(65 + index % 26)}${Math.floor(index / 26) || ''}`,
    action: ACTIONS[index % ACTIONS.length],
    laterAdds: index < 12,
    rumourConfirmed: index >= 12 && index < 20,
    nearPair: index < 12 ? `PAIR-${Math.floor(index / 2) + 1}` : null,
  }));
  const counts = events.map((_, index) => index < 12 ? 9 : 8);
  const seen = new Map(events.map((event) => [event.id, []]));
  const items = [];
  const labels = [];
  let sequence = 0;

  for (let round = 0; counts.some((count) => round < count); round++) {
    for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
      if (round >= counts[eventIndex]) continue;
      const event = events[eventIndex];
      const prior = seen.get(event.id);
      const nearCandidateEvent = round === 0 && eventIndex < 12 && eventIndex % 2 === 1 ? events[eventIndex - 1] : null;
      const candidateHeadlines = nearCandidateEvent ? seen.get(nearCandidateEvent.id) : prior;
      const candidate = candidateHeadlines.length ? {
        representativeHeadlineId: candidateHeadlines[0].id,
        headlines: candidateHeadlines.slice(-3).map((entry) => ({ id: entry.id, title: entry.title, timestamp: entry.timestamp, outlet: entry.outlet })),
        timeWindowHours: 72,
      } : null;
      const isConfirmation = event.rumourConfirmed && round === 4;
      const isPrimary = isConfirmation || (!event.rumourConfirmed && round === 0);
      const addsInformation = round === 0 || (event.laterAdds && round === 4) || isConfirmation;
      const outlet = isPrimary ? OUTLETS[eventIndex % 6] : OUTLETS[(eventIndex * 3 + round * 5) % OUTLETS.length];
      const timestamp = new Date(Date.UTC(2026, 8, 15) + sequence * 11 * 60_000).toISOString();
      const qualifier = isConfirmation ? 'Issuer filing confirms:' : isPrimary ? 'Issuer filing:' : round === 0 ? 'Market talk:' : addsInformation ? 'New detail:' : random.pick(['Update:', 'Round-up:', 'What we know:']);
      const title = `${qualifier} ${event.subject} ${event.action}${round ? ` · update ${round}` : ''}`;
      const item = {
        id: `EC-${String(sequence + 1).padStart(4, '0')}`, timestamp, outlet: outlet.id, outletType: outlet.type, title,
        firstSentence: isPrimary ? `${event.subject} states this directly in its own dated regulatory filing; ${isConfirmation ? 'the filing confirms the earlier market talk' : 'the filing introduces the event'}.` : addsInformation ? `${event.subject} ${event.action}; this dispatch ${round === 0 ? 'introduces the event as unconfirmed market talk' : 'adds a material fact not present in the earlier feed'}.` : `${event.subject} ${event.action}; this item repeats the already reported facts without a material addition.`,
        citesAnotherOutlet: !isPrimary && round % 2 === 0, candidateCluster: candidate,
      };
      items.push(item);
      prior.push(item);
      labels.push({
        headlineId: item.id, eventId: event.id, addsInformation, isPrimary,
        sameEvent: Boolean(candidate) && !nearCandidateEvent,
        nearDuplicatePair: nearCandidateEvent?.nearPair ?? null, rumourConfirmation: isConfirmation,
      });
      sequence++;
    }
  }

  return {
    dataset: { id: 'event-clustering', class: 'synthetic', seed, generatedAt: '2026-09-19', source: 'scripts/generate/event-clustering.js', context: { outlets: OUTLETS, eventCount: events.length, estimatedSecondsPerHeadline: 18, note: 'All companies, headlines and outlet names are synthetic. No article text or real outlet branding is used.' }, items },
    labels,
  };
}

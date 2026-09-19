import { createRandom } from './lib/random.js';

export const SEED = 1174;
const RELATIONS = ['OWNERSHIP', 'BOARD_SEAT', 'SUPPLIER', 'CUSTOMER', 'LITIGATION', 'SHARED_AUDITOR'];
const TYPES = ['COMPANY', 'FUND', 'INDIVIDUAL', 'AUDITOR'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const entities = Array.from({ length: 90 }, (_, index) => ({
    id: `EN-${String(index + 1).padStart(3, '0')}`,
    name: `Fictional ${['Harbor', 'River', 'Summit', 'Cedar', 'Atlas', 'Beacon'][index % 6]} ${String(index + 1).padStart(2, '0')}`,
    type: TYPES[index % TYPES.length],
    jurisdiction: ['Northland', 'Eastmere', 'Southport', 'Westhaven'][index % 4],
    registrationId: `REG-${70000 + index * 137}`,
    industry: ['Asset management', 'Industrial systems', 'Logistics', 'Consumer goods', 'Professional services'][index % 5],
  }));
  for (let chain = 0; chain < 6; chain++) {
    entities[chain * 3].type = 'FUND';
    entities[chain * 3 + 1].type = 'COMPANY';
    entities[chain * 3 + 2].type = 'COMPANY';
  }
  for (let pair = 0; pair < 12; pair++) {
    const stem = `Fictional Meridian ${String(pair + 1).padStart(2, '0')}`;
    entities[18 + pair * 2].name = `${stem} Holdings`;
    entities[19 + pair * 2].name = `${stem} Services`;
  }

  const items = [];
  const labels = [];
  const used = new Set();
  const addPair = (leftIndex, rightIndex, relationship, active, { chainId = null, coincidence = false } = {}) => {
    const [a, b] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex];
    const key = `${a}:${b}`;
    if (used.has(key)) return false;
    used.add(key);
    const left = entities[a];
    const right = entities[b];
    const id = `EL-${String(items.length + 1).padStart(4, '0')}`;
    const evidence = evidenceFor(left, right, relationship, active, coincidence);
    items.push({ id, left, right, evidence, graph: { focus: left.id, nodes: [{ id: left.id, label: left.name, note: left.type }, { id: right.id, label: right.name, note: right.type }], edges: [{ from: left.id, to: right.id, weight: evidence.length, label: 'candidate evidence' }] } });
    labels.push({ pairId: id, relationship, active, chainId, coincidence });
    return true;
  };

  for (let chain = 0; chain < 6; chain++) {
    addPair(chain * 3, chain * 3 + 1, 'OWNERSHIP', true, { chainId: `CHAIN-${chain + 1}` });
    addPair(chain * 3 + 1, chain * 3 + 2, 'SUPPLIER', true, { chainId: `CHAIN-${chain + 1}` });
  }
  for (let pair = 0; pair < 12; pair++) addPair(18 + pair * 2, 19 + pair * 2, 'NONE', false, { coincidence: true });
  let ended = 0;
  while (ended < 20) {
    const left = random.int(42, 89), right = random.int(42, 89);
    if (left !== right && addPair(left, right, RELATIONS[ended % RELATIONS.length], false)) ended++;
  }
  while (items.length < 400) {
    const left = random.int(0, 89), right = random.int(0, 89);
    if (left === right) continue;
    const relationship = random.bool(0.24) ? 'NONE' : random.pick(RELATIONS);
    addPair(left, right, relationship, relationship !== 'NONE');
  }

  return {
    dataset: { id: 'entity-links', class: 'synthetic', seed, generatedAt: '2026-09-19', source: 'scripts/generate/entity-links.js', context: { entities, note: 'All 90 entities, evidence snippets, registrations and relationships are fictional.' }, items },
    labels,
  };
}

function evidenceFor(left, right, relationship, active, coincidence) {
  if (coincidence) return [
    { date: '2026-03-14', source: 'company registry search', text: `${left.name} (${left.registrationId}) and ${right.name} (${right.registrationId}) appear beside the same name stem but have different owners, addresses and registrations.` },
    { date: '2026-03-15', source: 'aggregated search result', text: `A search snippet repeats “Fictional Meridian” without asserting any corporate relationship.` },
  ];
  if (relationship === 'NONE') return [{ date: '2026-05-08', source: 'directory search', text: `${left.name} and ${right.name} appear in the same industry directory; no ownership, contract, board, audit or litigation evidence is supplied.` }];
  const line = {
    OWNERSHIP: `${left.name} reports a 31% voting interest in ${right.name}.`,
    BOARD_SEAT: `${left.name} discloses that one of its directors also sits on the board of ${right.name}.`,
    SUPPLIER: `${right.name} supplied 38% of the critical components purchased by ${left.name}.`,
    CUSTOMER: `${right.name} represented 29% of ${left.name}'s annual revenue.`,
    LITIGATION: `${left.name} names ${right.name} as the opposing party in an active commercial claim.`,
    SHARED_AUDITOR: `${left.name} and ${right.name} identify the same audit firm and engagement office.`,
  }[relationship];
  const source = relationship === 'LITIGATION' ? 'court docket' : relationship === 'OWNERSHIP' ? 'ownership filing' : 'annual filing';
  const rows = [{ date: '2025-12-31', source, text: line }];
  if (!active) rows.push({ date: '2026-06-30', source: 'termination filing', text: `The relationship described above ended on 2026-04-30; neither party reports a continuing arrangement.` });
  else rows.push({ date: '2026-06-30', source: 'current disclosure', text: 'The latest disclosure states that the arrangement remains in force.' });
  return rows;
}

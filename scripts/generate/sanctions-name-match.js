// Two hundred candidate matches against a wholly fictional watchlist. The evidence stays in each
// item; identity truth, deciding evidence and collision cause stay only in the labels file.

import { addDays, createRandom } from './lib/random.js';
import { personName, streetAddress } from './lib/names.js';

export const SEED = 1124;

const AS_OF = '2026-09-19';
const NOTICE = 'FICTIONAL WATCHLIST — illustrative identity matching only; never a screening decision.';
const COUNTRIES = ['AE', 'EG', 'GB', 'JO', 'MA', 'SA'];
const PROGRAMS = ['DEMO PROGRAM AURORA', 'DEMO PROGRAM CEDAR', 'DEMO PROGRAM LANTERN'];
const PLAN = [
  ...Array(18).fill('TRUE_MATCH'),
  ...Array(34).fill('TRANSLITERATION'),
  ...Array(30).fill('COMMON_SURNAME'),
  ...Array(28).fill('FATHER_SON'),
  ...Array(28).fill('DOB_ONE_DIGIT'),
  ...Array(30).fill('CITY_COUNTRY'),
  ...Array(12).fill('INSUFFICIENT'),
  ...Array(20).fill('CLEAR_FALSE'),
];

const NAME_FORMS = new Map([
  ['Omar', ['Umar', 'Omer']], ['Yusuf', ['Youssef', 'Yusef']], ['Karim', ['Kareem', 'Kerim']],
  ['Layla', ['Leila', 'Laila']], ['Nabil', ['Nabeel', 'Nabil']], ['Rami', ['Ramy', 'Ramee']],
  ['Salma', ['Selma', 'Salmah']], ['Hana', ['Hanna', 'Hanaa']], ['Tarek', ['Tariq', 'Tareq']],
  ['Maya', ['Maia', 'Maja']], ['Dina', ['Deena', 'Dyna']], ['Sami', ['Samy', 'Samee']],
]);

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const plan = random.shuffle(PLAN);
  const items = [];
  const labels = [];
  const entries = [];

  for (let index = 0; index < plan.length; index++) {
    const built = buildPair(random, index, plan[index]);
    items.push(built.item);
    labels.push(built.label);
    entries.push(built.item.listEntry);
  }

  const watchlist = {
    id: 'demo-fictional-watchlist',
    fictional: true,
    generatedAt: AS_OF,
    seed,
    notice: NOTICE,
    entries,
  };

  return {
    dataset: {
      id: 'sanctions-name-match',
      class: 'synthetic',
      generatedAt: AS_OF,
      seed,
      source: 'scripts/generate/sanctions-name-match.js',
      context: {
        asOf: AS_OF,
        fictionalNotice: NOTICE,
        matchingRules: {
          requiredToConfirm: 'A name resemblance plus a corroborating date, nationality, address or identifier.',
          advisory: ['Name similarity and city alone never confirm identity.', 'Contradictory identifiers outweigh a fuzzy name score.', 'Use review when material fields are absent.'],
        },
      },
      items,
    },
    labels,
    artifacts: [{ path: 'data/synthetic/watchlist.json', data: watchlist }],
  };
}

function buildPair(random, index, cause) {
  const pairId = `SNC-${String(index + 1).padStart(4, '0')}`;
  const entryName = personName(random);
  const nationality = random.pick(COUNTRIES);
  const otherNationality = random.pick(COUNTRIES.filter((value) => value !== nationality));
  const dob = `${random.int(1952, 1996)}-${String(random.int(1, 12)).padStart(2, '0')}-${String(random.int(1, 27)).padStart(2, '0')}`;
  const country = nationality;
  const city = `Demo City ${random.int(1, 18)}`;
  const identifier = `DEMO-ID-${String(800000 + index)}`;
  const listEntry = {
    id: `FWL-${String(index + 1).padStart(4, '0')}`,
    primaryName: entryName,
    aliases: nameVariants(entryName),
    datesOfBirth: [dob],
    nationalities: [nationality],
    addresses: [{ line1: streetAddress(random), city, country }],
    identifierFragments: [identifier.slice(-6)],
    program: random.pick(PROGRAMS),
    fictional: true,
  };
  const customer = {
    id: `CUS-SNC-${String(index + 1).padStart(4, '0')}`,
    name: entryName,
    dateOfBirth: dob,
    nationality,
    address: { line1: streetAddress(random), city, country },
    identifierFragment: identifier.slice(-6),
  };
  let sameEntity = false;
  let decidingField = 'IDENTIFIER';
  let expectedDisposition = 'CLEAR';

  if (cause === 'TRUE_MATCH') {
    sameEntity = true;
    customer.name = random.pick(listEntry.aliases);
    customer.address = { ...listEntry.addresses[0] };
    decidingField = random.pick(['DATE_OF_BIRTH', 'NATIONALITY', 'ADDRESS', 'IDENTIFIER']);
    expectedDisposition = 'CONFIRM';
  } else if (cause === 'TRANSLITERATION') {
    customer.name = random.pick(listEntry.aliases);
    customer.nationality = otherNationality;
    customer.dateOfBirth = addDays(dob, random.int(600, 3200));
    customer.identifierFragment = `ALT${String(index).padStart(3, '0')}`;
    decidingField = 'NATIONALITY';
  } else if (cause === 'COMMON_SURNAME') {
    const surname = entryName.split(' ').at(-1);
    customer.name = `${personName(random).split(' ')[0]} ${surname}`;
    customer.dateOfBirth = addDays(dob, random.int(900, 5000));
    customer.identifierFragment = `ALT${String(index).padStart(3, '0')}`;
    decidingField = 'IDENTIFIER';
  } else if (cause === 'FATHER_SON') {
    customer.name = entryName;
    customer.dateOfBirth = addDays(dob, 26 * 365 + random.int(-30, 30));
    customer.address = { ...listEntry.addresses[0] };
    customer.identifierFragment = `SON${String(index).padStart(3, '0')}`;
    decidingField = 'DATE_OF_BIRTH';
  } else if (cause === 'DOB_ONE_DIGIT') {
    customer.name = random.pick(listEntry.aliases);
    customer.dateOfBirth = `${Number(dob.slice(0, 4)) + 1}${dob.slice(4)}`;
    customer.identifierFragment = `ALT${String(index).padStart(3, '0')}`;
    decidingField = 'DATE_OF_BIRTH';
  } else if (cause === 'CITY_COUNTRY') {
    customer.name = random.pick(listEntry.aliases);
    customer.nationality = otherNationality;
    customer.address = { line1: streetAddress(random), city, country: otherNationality };
    customer.identifierFragment = `ALT${String(index).padStart(3, '0')}`;
    decidingField = 'NATIONALITY';
  } else if (cause === 'INSUFFICIENT') {
    customer.name = random.pick(listEntry.aliases);
    customer.dateOfBirth = null;
    customer.address = null;
    customer.identifierFragment = null;
    listEntry.datesOfBirth = [];
    listEntry.addresses = [];
    listEntry.identifierFragments = [];
    decidingField = 'INSUFFICIENT';
    expectedDisposition = 'REVIEW';
  } else {
    customer.name = `${entryName.split(' ')[0]} ${personName(random).split(' ').at(-1)}`;
    customer.nationality = otherNationality;
    customer.dateOfBirth = addDays(dob, random.int(1200, 6200));
    customer.identifierFragment = `ALT${String(index).padStart(3, '0')}`;
  }

  const scoreBase = sameEntity ? 0.96 : cause === 'INSUFFICIENT' ? 0.88 : cause === 'CLEAR_FALSE' ? 0.7 : 0.91;
  // #region demo:data
  const item = {
    id: pairId,
    notice: NOTICE,
    customer,
    listEntry,
    screeningEngine: {
      fuzzyNameScore: Number(random.float(scoreBase - 0.035, scoreBase + 0.025, 3)),
      generatedCandidateBecause: 'The normalised customer name resembled the primary name or an alias.',
    },
  };
  // #endregion
  return { item, label: { pairId, sameEntity, decidingField, cause, expectedDisposition } };
}

function nameVariants(name) {
  const [first, last] = name.split(' ');
  const variants = NAME_FORMS.get(first) ?? [`${first}h`, `${first.slice(0, -1)}y`];
  return [`${variants[0]} ${last}`, `${first} ${last.replace(/a/g, 'e')}`];
}

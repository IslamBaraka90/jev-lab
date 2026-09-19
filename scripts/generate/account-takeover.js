// Two hundred and sixty account sessions over two weeks. Raw account, login, device, network and
// action evidence is kept in each item; takeover truth and the intended intervention stay in labels.

import { addDays, createRandom } from './lib/random.js';
import { personName } from './lib/names.js';

export const SEED = 1122;

const AS_OF = '2026-09-19';
const COUNTRIES = ['AE', 'EG', 'GB', 'US', 'SA'];
const EVENT_RISK = {
  FAILED_LOGIN: 1,
  LOGIN_SUCCESS: 0,
  VIEW_BALANCE: 0,
  PASSWORD_RESET: 4,
  DEVICE_ENROLLED: 3,
  CHANGE_EMAIL: 4,
  CHANGE_PHONE: 5,
  RAISE_LIMIT: 5,
  ADD_BENEFICIARY: 5,
  TRANSFER: 6,
  SESSION_CONTEXT_CHANGE: 6,
};
const TAKEOVER_SHAPES = ['CREDENTIAL_STUFFING', 'SIM_SWAP', 'SESSION_HIJACK', 'INSIDER_FAMILIAR_DEVICE'];
const LOOKALIKES = ['TRAVEL', 'NEW_PHONE', 'EMERGENCY_TRANSFER', 'SHARED_FAMILY_DEVICE'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const plan = random.shuffle([
    ...Array(4).fill('CREDENTIAL_STUFFING'),
    ...Array(4).fill('SIM_SWAP'),
    ...Array(3).fill('SESSION_HIJACK'),
    ...Array(3).fill('INSIDER_FAMILIAR_DEVICE'),
    ...LOOKALIKES.flatMap((shape) => Array(5).fill(shape)),
    ...Array(226).fill('NORMAL'),
  ]);
  const occurrences = new Map();
  const items = [];
  const labels = [];

  for (let index = 0; index < plan.length; index++) {
    const shape = plan[index];
    const occurrence = occurrences.get(shape) ?? 0;
    occurrences.set(shape, occurrence + 1);
    const built = buildSession(random, index, shape, occurrence);
    items.push(built.item);
    labels.push(built.label);
  }

  return {
    dataset: {
      id: 'account-takeover',
      class: 'synthetic',
      generatedAt: AS_OF,
      seed,
      source: 'scripts/generate/account-takeover.js',
      context: {
        asOf: AS_OF,
        actionRiskWeights: EVENT_RISK,
        frictionWeights: { pushApproval: 1, callBack: 3, documentCheck: 6, blockSession: 8, freezeAccount: 12 },
        policyNotes: [
          'Use the least disruptive control that is proportionate to the observed session evidence.',
          'A new device or country is not sufficient by itself when customer context explains it.',
          'Judge travel from the raw prior-login and current-event timestamps and countries.',
        ],
      },
      items,
    },
    labels,
  };
}

function buildSession(random, index, shape, occurrence) {
  const sessionId = `SES-${String(index + 1).padStart(4, '0')}`;
  const accountId = `ACC-${String(70000 + index)}`;
  const homeCountry = random.pick(['AE', 'EG', 'GB']);
  const usualDevice = `DEV-${String(index + 1).padStart(4, '0')}-A`;
  const startedDay = random.day('2026-09-05', '2026-09-19');
  const usualHour = random.int(8, 20);
  const startedAt = `${startedDay}T${String(usualHour).padStart(2, '0')}:${String(random.int(0, 50)).padStart(2, '0')}:00Z`;
  const account = baseAccount(random, accountId, homeCountry, usualDevice, startedAt);
  const session = {
    startedAt,
    device: { id: usualDevice, isNew: false, platform: random.pick(['ANDROID', 'IOS', 'WEB']) },
    network: { country: homeCountry, asnType: 'RESIDENTIAL', ip: `198.51.100.${(index % 220) + 1}` },
    loginMethod: 'PASSWORD_PLUS_DEVICE',
    hoursSinceLastLogin: 18,
  };
  let timeline = normalTimeline(startedAt, account, random);
  let takeover = TAKEOVER_SHAPES.includes(shape);
  let strongestSignal = 'NONE';
  let action = 'ALLOW';
  let stepUpMethod = 'NOT_NEEDED';
  let frictionJustified = false;
  let kind = 'normal';

  if (shape === 'CREDENTIAL_STUFFING') {
    session.device = { id: `DEV-UNKNOWN-${sessionId}`, isNew: true, platform: 'WEB' };
    session.network = { country: homeCountry, asnType: 'HOSTING', ip: `203.0.113.${(index % 220) + 1}` };
    session.loginMethod = 'PASSWORD_RESET';
    session.hoursSinceLastLogin = 2;
    timeline = credentialTimeline(startedAt, account, random);
    strongestSignal = occurrence % 2 ? 'BENEFICIARY_CHANGE' : 'CREDENTIAL_RESET_CHAIN';
    action = 'BLOCK_SESSION';
    stepUpMethod = 'NOT_NEEDED';
    frictionJustified = true;
    kind = 'takeover';
  }
  if (shape === 'SIM_SWAP') {
    session.device = { id: `DEV-UNKNOWN-${sessionId}`, isNew: true, platform: 'ANDROID' };
    session.network = { country: homeCountry, asnType: 'MOBILE', ip: `192.0.2.${(index % 220) + 1}` };
    session.loginMethod = 'SMS_RECOVERY';
    session.hoursSinceLastLogin = 1;
    timeline = simSwapTimeline(startedAt, account, random);
    strongestSignal = 'CREDENTIAL_RESET_CHAIN';
    action = 'FREEZE_ACCOUNT';
    stepUpMethod = 'NOT_NEEDED';
    frictionJustified = true;
    kind = 'takeover';
  }
  if (shape === 'SESSION_HIJACK') {
    const foreign = random.pick(COUNTRIES.filter((country) => country !== homeCountry));
    timeline = hijackTimeline(startedAt, account, random, homeCountry, foreign);
    strongestSignal = 'IMPOSSIBLE_TRAVEL';
    action = 'BLOCK_SESSION';
    stepUpMethod = 'NOT_NEEDED';
    frictionJustified = true;
    kind = 'takeover';
  }
  if (shape === 'INSIDER_FAMILIAR_DEVICE') {
    session.network.asnType = 'CORPORATE';
    session.startedAt = `${startedDay}T02:15:00Z`;
    timeline = insiderTimeline(session.startedAt, account, random);
    strongestSignal = 'BEHAVIOUR_SHIFT';
    action = 'FREEZE_ACCOUNT';
    stepUpMethod = 'NOT_NEEDED';
    frictionJustified = true;
    kind = 'takeover';
  }
  if (shape === 'TRAVEL') {
    const foreign = random.pick(COUNTRIES.filter((country) => country !== homeCountry));
    session.device = { id: `DEV-TRAVEL-${sessionId}`, isNew: true, platform: 'IOS' };
    session.network = { country: foreign, asnType: 'HOTEL_WIFI', ip: `203.0.113.${(index % 220) + 1}` };
    session.hoursSinceLastLogin = 1.5;
    account.recentLogins[0].at = minutesFrom(startedAt, -90);
    account.customerContext = { travelNotice: { country: foreign, from: startedDay, to: addDays(startedDay, 5) }, emergencyTransferNote: null };
    timeline = lookalikeTimeline(startedAt, account, random, 'TRAVEL', foreign);
    strongestSignal = 'IMPOSSIBLE_TRAVEL';
    action = 'STEP_UP';
    stepUpMethod = 'PUSH_APPROVAL';
    frictionJustified = true;
    kind = 'innocent-lookalike';
  }
  if (shape === 'NEW_PHONE') {
    session.device = { id: `DEV-NEW-${sessionId}`, isNew: true, platform: random.pick(['ANDROID', 'IOS']) };
    account.customerContext = { travelNotice: null, emergencyTransferNote: null, deviceReplacementTicket: `TKT-${sessionId}` };
    timeline = lookalikeTimeline(startedAt, account, random, 'NEW_PHONE', homeCountry);
    strongestSignal = 'NEW_DEVICE';
    action = 'STEP_UP';
    stepUpMethod = 'PUSH_APPROVAL';
    frictionJustified = true;
    kind = 'innocent-lookalike';
  }
  if (shape === 'EMERGENCY_TRANSFER') {
    account.customerContext = { travelNotice: null, emergencyTransferNote: 'Customer pre-notified the bank about a time-sensitive property deposit.' };
    timeline = lookalikeTimeline(startedAt, account, random, 'EMERGENCY_TRANSFER', homeCountry);
    strongestSignal = 'BENEFICIARY_CHANGE';
    action = 'STEP_UP';
    stepUpMethod = 'CALL_BACK';
    frictionJustified = true;
    kind = 'innocent-lookalike';
  }
  if (shape === 'SHARED_FAMILY_DEVICE') {
    session.device = { id: `FAMILY-${index % 7}`, isNew: true, platform: 'WEB' };
    account.trustedHouseholdDeviceIds = [session.device.id];
    timeline = lookalikeTimeline(startedAt, account, random, 'SHARED_FAMILY_DEVICE', homeCountry);
    strongestSignal = 'NEW_DEVICE';
    action = 'ALLOW';
    stepUpMethod = 'NOT_NEEDED';
    frictionJustified = false;
    kind = 'innocent-lookalike';
  }

  // #region demo:data
  const item = {
    id: sessionId,
    account,
    session,
    timeline,
  };
  // #endregion

  return {
    item,
    label: {
      sessionId,
      takeover,
      shape,
      strongestSignal,
      action,
      stepUpMethod,
      frictionJustified,
      kind,
    },
  };
}

function baseAccount(random, id, homeCountry, usualDevice, startedAt) {
  const previousAt = minutesFrom(startedAt, -random.int(720, 4320));
  return {
    id,
    customerName: personName(random),
    relationshipDays: random.int(180, 3600),
    usualDevices: [usualDevice],
    usualCountries: [homeCountry],
    usualLoginHoursUtc: { from: 7, to: 22 },
    transferProfile: { averageAmount: Number(random.float(80, 1200, 2)), largest90DayAmount: Number(random.float(1400, 12000, 2)), newBeneficiaries90Days: random.int(0, 3) },
    knownBeneficiaries: [`BEN-${id}-1`, `BEN-${id}-2`],
    recentLogins: [{ at: previousAt, country: homeCountry, deviceId: usualDevice, result: 'SUCCESS' }],
    trustedHouseholdDeviceIds: [],
    customerContext: { travelNotice: null, emergencyTransferNote: null },
  };
}

function normalTimeline(start, account, random) {
  return [
    event(start, 'LOGIN_SUCCESS', { country: account.usualCountries[0], deviceId: account.usualDevices[0] }),
    event(minutesFrom(start, 2), 'VIEW_BALANCE'),
    event(minutesFrom(start, 6), 'TRANSFER', { amount: Number(random.float(20, account.transferProfile.averageAmount * 1.3, 2)), beneficiaryId: random.pick(account.knownBeneficiaries), currency: 'USD' }),
  ];
}

function credentialTimeline(start, account, random) {
  return [
    event(minutesFrom(start, -8), 'FAILED_LOGIN', { attempts: 7, asnType: 'HOSTING' }),
    event(minutesFrom(start, -2), 'PASSWORD_RESET', { channel: 'EMAIL' }),
    event(start, 'LOGIN_SUCCESS', { country: account.usualCountries[0], deviceId: 'UNKNOWN' }),
    event(minutesFrom(start, 3), 'ADD_BENEFICIARY', { beneficiaryId: `BEN-NEW-${random.int(100, 999)}` }),
    event(minutesFrom(start, 7), 'TRANSFER', { amount: Number(random.float(9000, 26000, 2)), beneficiaryId: 'NEWLY_ADDED', currency: 'USD' }),
  ];
}

function simSwapTimeline(start, account, random) {
  return [
    event(start, 'LOGIN_SUCCESS', { country: account.usualCountries[0], deviceId: 'UNKNOWN' }),
    event(minutesFrom(start, 2), 'CHANGE_PHONE', { method: 'SMS_RECOVERY' }),
    event(minutesFrom(start, 4), 'RAISE_LIMIT', { from: 5000, to: 30000 }),
    event(minutesFrom(start, 6), 'ADD_BENEFICIARY', { beneficiaryId: `BEN-NEW-${random.int(100, 999)}` }),
    event(minutesFrom(start, 9), 'TRANSFER', { amount: Number(random.float(12000, 29000, 2)), beneficiaryId: 'NEWLY_ADDED', currency: 'USD' }),
  ];
}

function hijackTimeline(start, account, random, home, foreign) {
  return [
    event(start, 'LOGIN_SUCCESS', { country: home, deviceId: account.usualDevices[0] }),
    event(minutesFrom(start, 3), 'VIEW_BALANCE', { country: home }),
    event(minutesFrom(start, 7), 'SESSION_CONTEXT_CHANGE', { fromCountry: home, toCountry: foreign, newIp: `203.0.113.${random.int(1, 220)}` }),
    event(minutesFrom(start, 10), 'ADD_BENEFICIARY', { country: foreign, beneficiaryId: `BEN-NEW-${random.int(100, 999)}` }),
    event(minutesFrom(start, 13), 'TRANSFER', { country: foreign, amount: Number(random.float(8000, 24000, 2)), beneficiaryId: 'NEWLY_ADDED', currency: 'USD' }),
  ];
}

function insiderTimeline(start, account, random) {
  return [
    event(start, 'LOGIN_SUCCESS', { country: account.usualCountries[0], deviceId: account.usualDevices[0], asnType: 'CORPORATE' }),
    event(minutesFrom(start, 1), 'CHANGE_EMAIL', { channel: 'IN_SESSION' }),
    event(minutesFrom(start, 3), 'ADD_BENEFICIARY', { beneficiaryId: `BEN-NEW-${random.int(100, 999)}` }),
    event(minutesFrom(start, 5), 'RAISE_LIMIT', { from: 5000, to: 25000 }),
    event(minutesFrom(start, 8), 'TRANSFER', { amount: Number(random.float(10000, 24000, 2)), beneficiaryId: 'NEWLY_ADDED', currency: 'USD' }),
  ];
}

function lookalikeTimeline(start, account, random, shape, country) {
  const deviceId = shape === 'SHARED_FAMILY_DEVICE' ? account.trustedHouseholdDeviceIds[0] : shape === 'NEW_PHONE' ? 'NEW_REPLACEMENT_DEVICE' : account.usualDevices[0];
  const events = [event(start, 'LOGIN_SUCCESS', { country, deviceId }), event(minutesFrom(start, 2), 'VIEW_BALANCE')];
  if (shape === 'NEW_PHONE') events.push(event(minutesFrom(start, 4), 'DEVICE_ENROLLED', { supportTicketPresent: true }));
  if (shape === 'EMERGENCY_TRANSFER') {
    events.push(event(minutesFrom(start, 4), 'ADD_BENEFICIARY', { beneficiaryId: `BEN-PROPERTY-${random.int(10, 99)}` }));
    events.push(event(minutesFrom(start, 8), 'TRANSFER', { amount: Number(random.float(9000, 18000, 2)), beneficiaryId: 'NEWLY_ADDED', currency: 'USD' }));
  } else {
    events.push(event(minutesFrom(start, 7), 'TRANSFER', { amount: Number(random.float(30, account.transferProfile.averageAmount * 1.1, 2)), beneficiaryId: account.knownBeneficiaries[0], currency: 'USD' }));
  }
  return events;
}

function event(at, type, details = {}) {
  return { at, type, ...details };
}

function minutesFrom(timestamp, minutes) {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString();
}

// Two hundred and fifty delivery exceptions. The raw scans, address, contacts and prior deliveries
// carry the evidence; fault, best action and preventability are written only to separate labels.

import { addDays, createRandom } from './lib/random.js';
import { personName } from './lib/names.js';
import { generate as generateCodAbuse } from './cod-abuse.js';

export const SEED = 1116;

const AS_OF = '2026-09-19';
const COURIERS = ['Arrow Parcel', 'Blue Mile', 'CitySprint', 'Falcon Express', 'Northstar Delivery'];
const CITIES = ['Abu Dhabi', 'Alexandria', 'Cairo', 'Dubai', 'London'];
const DISTRICTS = ['Al Barsha', 'Al Zahra', 'Downtown', 'Garden City', 'Maadi', 'Marina'];
const COSTS = [7.5, 8.75, 10];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const cod = generateCodAbuse();
  const codItems = new Map(cod.dataset.items.map((item) => [item.id, item]));
  const linkedRefusers = cod.labels.filter((label) => label.pattern === 'SERIAL_REFUSER').slice(0, 11).map((label) => codItems.get(label.customerId));
  const plan = random.shuffle([
    ...Array(38).fill('ADDRESS_QUALITY'),
    ...Array(22).fill('CUSTOMER_UNAVAILABLE'),
    ...Array(19).fill('COURIER'),
    ...Array(11).fill('CUSTOMER_REFUSAL'),
    ...Array(14).fill('UNCLEAR'),
    ...Array(146).fill('BACKGROUND'),
  ]);
  const occurrences = new Map();
  const items = [];
  const labels = [];

  for (let index = 0; index < plan.length; index++) {
    const kind = plan[index];
    const occurrence = occurrences.get(kind) ?? 0;
    occurrences.set(kind, occurrence + 1);
    const fault = kind === 'BACKGROUND'
      ? random.weighted([['ADDRESS_QUALITY', 28], ['CUSTOMER_UNAVAILABLE', 34], ['COURIER', 38]])
      : kind;
    const linkedCustomer = kind === 'CUSTOMER_REFUSAL' ? linkedRefusers[occurrence] : null;
    const built = buildShipment(random, index, kind, fault, occurrence, linkedCustomer);
    items.push(built.item);
    labels.push(built.label);
  }

  return {
    dataset: {
      id: 'delivery-exceptions',
      class: 'synthetic',
      generatedAt: AS_OF,
      seed,
      source: 'scripts/generate/delivery-exceptions.js',
      context: {
        asOf: AS_OF,
        currency: 'USD',
        deliveryWindow: { opens: '09:00', closes: '21:00' },
      },
      items,
    },
    labels,
  };
}

function buildShipment(random, index, kind, fault, occurrence, linkedCustomer) {
  const id = `SHP-${String(index + 1).padStart(4, '0')}`;
  const city = random.pick(CITIES);
  const exceptionDay = random.day('2026-09-02', '2026-09-18');
  const courier = random.pick(COURIERS);
  const costPerAttempt = random.pick(COSTS);
  const failedAttempts = kind === 'UNCLEAR' ? 1 : random.int(1, 3);
  const address = buildAddress(random, fault, occurrence, city);
  const customer = linkedCustomer
    ? { id: linkedCustomer.id, name: linkedCustomer.name, phone: linkedCustomer.phone, linkedToDemo: 'cod-abuse' }
    : { id: `CUS-${String(index + 1).padStart(4, '0')}`, name: personName(random), phone: `+971 55 ${String(1000000 + index).slice(-7)}`, linkedToDemo: null };
  const tracking = trackingEvents(random, fault, kind, occurrence, exceptionDay, city, failedAttempts);
  const contactLog = contacts(random, fault, exceptionDay);
  const addressQuality = fault === 'ADDRESS_QUALITY' ? (occurrence % 3 === 0 ? 1.5 : 2.2) : fault === 'UNCLEAR' ? 3.8 : 5.2;
  const bestAction = fault === 'ADDRESS_QUALITY'
    ? 'REROUTE_PICKUP'
    : fault === 'CUSTOMER_UNAVAILABLE'
      ? 'CONTACT_CUSTOMER'
      : fault === 'CUSTOMER_REFUSAL'
        ? 'RETURN_TO_SENDER'
        : 'RETRY';
  const preventable = ['ADDRESS_QUALITY', 'CUSTOMER_UNAVAILABLE'].includes(fault);

  // #region demo:data
  const item = {
    id,
    orderId: `ORD-D-${String(index + 1).padStart(5, '0')}`,
    customer,
    shipment: {
      courier,
      serviceLevel: random.pick(['NEXT_DAY', 'STANDARD', 'TWO_DAY']),
      shippedAt: `${addDays(exceptionDay, -2)}T12:00:00Z`,
      promisedBy: `${exceptionDay}T21:00:00Z`,
      cashOnDelivery: fault === 'CUSTOMER_REFUSAL',
      orderValue: Number(random.float(25, 850, 2)),
      currency: 'USD',
      failedAttempts,
      costPerAttempt,
    },
    address,
    trackingEvents: tracking,
    contactLog,
    courierServiceNotes: {
      deliveryWindow: '09:00–21:00 local time',
      validAttempt: 'An attempt scan should occur at the destination with a matching GPS reading.',
      pickupPointAvailable: true,
    },
    sameAddressHistory: buildHistory(random, fault),
    operatingContext: {
      weather: kind === 'UNCLEAR' && random.bool(0.4) ? 'Heavy rain reported in the district' : 'No material weather alert',
      courierOutage: false,
      citywideIncident: false,
    },
  };
  // #endregion

  return {
    item,
    label: {
      shipmentId: id,
      fault,
      bestAction,
      addressQuality,
      preventable,
      kind: kind.toLowerCase().replaceAll('_', '-'),
      avoidableCost: preventable ? Number((failedAttempts * costPerAttempt).toFixed(2)) : 0,
      neverAttemptedScan: kind === 'COURIER' && occurrence % 2 === 0,
    },
  };
}

function buildAddress(random, fault, occurrence, city) {
  const address = {
    line1: `${random.int(2, 380)} ${random.pick(['Palm Street', 'River Road', 'Market Lane', 'Corniche Road'])}`,
    district: random.pick(DISTRICTS),
    city,
    postcode: String(random.int(10000, 99999)),
    floor: String(random.int(1, 24)),
    unit: String(random.int(1, 80)),
    accessInstructions: 'Call from the entrance intercom.',
  };
  if (fault !== 'ADDRESS_QUALITY') return address;
  if (occurrence % 3 === 0) address.floor = null;
  if (occurrence % 3 === 1) address.district = `${address.district} — east or west not specified`;
  if (occurrence % 3 === 2) address.postcode = '00000';
  return address;
}

function trackingEvents(random, fault, kind, occurrence, day, city, attempts) {
  const events = [
    { at: `${addDays(day, -2)}T12:00:00Z`, status: 'PICKED_UP', location: `${city} origin hub`, scanSource: 'DEPOT' },
    { at: `${addDays(day, -1)}T20:30:00Z`, status: 'ARRIVED_AT_DEPOT', location: `${city} central depot`, scanSource: 'DEPOT' },
  ];
  if (fault === 'COURIER' && kind === 'COURIER' && occurrence % 2 === 0) {
    events.push({ at: `${day}T03:10:00Z`, status: 'DELIVERY_ATTEMPTED', location: `${city} central depot`, scanSource: 'HANDHELD', gpsDistanceFromAddressKm: Number(random.float(8, 32, 1)) });
    return events;
  }
  if (fault === 'COURIER') {
    events.push({ at: `${day}T10:15:00Z`, status: 'MISROUTED', location: `${random.pick(CITIES.filter((entry) => entry !== city))} depot`, scanSource: 'DEPOT' });
    return events;
  }
  const status = fault === 'CUSTOMER_REFUSAL' ? 'DELIVERY_REFUSED' : fault === 'UNCLEAR' ? 'DELIVERY_EXCEPTION' : 'DELIVERY_ATTEMPTED';
  const reason = fault === 'ADDRESS_QUALITY' ? 'ADDRESS_INCOMPLETE' : fault === 'CUSTOMER_UNAVAILABLE' ? 'NO_ANSWER' : fault === 'CUSTOMER_REFUSAL' ? 'RECIPIENT_REFUSED' : 'NO_REASON_RECORDED';
  for (let attempt = 0; attempt < attempts; attempt++) {
    events.push({ at: `${addDays(day, attempt)}T${String(11 + attempt * 3).padStart(2, '0')}:20:00Z`, status, reason, location: `${city} destination`, scanSource: 'DRIVER_APP', gpsDistanceFromAddressKm: Number(random.float(0.02, 0.4, 2)) });
  }
  return events;
}

function contacts(random, fault, day) {
  if (fault === 'CUSTOMER_UNAVAILABLE') return [
    { at: `${day}T10:55:00Z`, channel: 'CALL', result: 'NO_ANSWER' },
    { at: `${day}T11:00:00Z`, channel: 'SMS', result: 'DELIVERED_NO_REPLY' },
    { at: `${day}T17:10:00Z`, channel: 'CALL', result: 'NO_ANSWER' },
  ];
  if (fault === 'ADDRESS_QUALITY') return [{ at: `${day}T10:40:00Z`, channel: 'SMS', result: 'REQUESTED_ADDRESS_DETAIL' }];
  if (fault === 'CUSTOMER_REFUSAL') return [{ at: `${day}T11:15:00Z`, channel: 'CALL', result: 'CUSTOMER_CONFIRMED_REFUSAL' }];
  if (fault === 'UNCLEAR') return [{ at: `${day}T12:00:00Z`, channel: random.pick(['CALL', 'SMS']), result: 'INCONCLUSIVE' }];
  return [];
}

function buildHistory(random, fault) {
  if (fault === 'ADDRESS_QUALITY') return { delivered: 0, failed: random.int(1, 3), lastOutcome: 'ADDRESS_CORRECTION_REQUIRED' };
  if (fault === 'CUSTOMER_UNAVAILABLE') return { delivered: random.int(1, 5), failed: random.int(1, 2), lastOutcome: 'DELIVERED_AFTER_CONTACT' };
  if (fault === 'CUSTOMER_REFUSAL') return { delivered: random.int(0, 2), failed: random.int(3, 8), lastOutcome: 'REFUSED' };
  return { delivered: random.int(2, 9), failed: random.int(0, 1), lastOutcome: 'DELIVERED' };
}

// Invented names for the synthetic datasets. Nothing here is a real company, person, bank, token or
// address, and identifiers are deliberately shaped so they cannot be mistaken for live ones.

const FIRST_NAMES = ['Amina', 'Omar', 'Layla', 'Yusuf', 'Hana', 'Karim', 'Noor', 'Tarek', 'Salma', 'Adel', 'Rania', 'Fadi', 'Dina', 'Sami', 'Maya', 'Hadi', 'Lina', 'Nabil', 'Zeina', 'Rami'];
const LAST_NAMES = ['Halabi', 'Farouk', 'Mansour', 'Darwish', 'Aziz', 'Kassem', 'Haddad', 'Nasser', 'Sabri', 'Tawfik', 'Ghanem', 'Shadid', 'Barakat', 'Fahmy', 'Rizk', 'Khoury', 'Selim', 'Moussa'];

const MERCHANT_WORDS = ['Northwind', 'Bluewater', 'Kestrel', 'Lantern', 'Copperline', 'Meridian', 'Cedar', 'Harbour', 'Quarry', 'Tinbridge', 'Orchard', 'Falcon', 'Ironbark', 'Saltmarsh', 'Beacon', 'Rooftop', 'Marlow', 'Pinefield'];
const MERCHANT_KINDS = ['Supplies', 'Logistics', 'Studios', 'Trading', 'Systems', 'Foods', 'Rentals', 'Print', 'Labs', 'Works', 'Travel', 'Media'];

const COMPANY_SUFFIX = ['Holdings', 'Group', 'Industries', 'Technologies', 'Resources', 'Partners', 'Corporation'];
const BANK_WORDS = ['Continental', 'Atlas', 'Harbour', 'Standard', 'Union', 'Crescent', 'Pioneer', 'Summit'];
const TOKEN_WORDS = ['Lumen', 'Verda', 'Kobalt', 'Nimbus', 'Sable', 'Quartz', 'Orbit', 'Terra', 'Vexel', 'Zephyr'];

const CITIES = ['Ashford', 'Brookvale', 'Carnford', 'Dunmore', 'Elmsworth', 'Fairholm', 'Greystone', 'Halbury', 'Iverton', 'Jarrow Bay'];
const STREETS = ['Mill', 'Station', 'Harbour', 'Kiln', 'Orchard', 'Foundry', 'Chapel', 'Weaver', 'Anchor', 'Granary'];

const pickFrom = (random, items) => items[Math.floor(random.next() * items.length)];

export function personName(random) {
  return `${pickFrom(random, FIRST_NAMES)} ${pickFrom(random, LAST_NAMES)}`;
}

export function merchantName(random) {
  return `${pickFrom(random, MERCHANT_WORDS)} ${pickFrom(random, MERCHANT_KINDS)}`;
}

export function companyName(random) {
  return `${pickFrom(random, MERCHANT_WORDS)} ${pickFrom(random, COMPANY_SUFFIX)}`;
}

export function bankName(random) {
  return `${pickFrom(random, BANK_WORDS)} Bank`;
}

export function tokenName(random) {
  const word = pickFrom(random, TOKEN_WORDS);
  return { name: word, symbol: word.slice(0, 4).toUpperCase() };
}

export function cityName(random) {
  return pickFrom(random, CITIES);
}

export function streetAddress(random) {
  return `${random.int(1, 240)} ${pickFrom(random, STREETS)} Street`;
}

/** An obviously fake account reference, shaped like an IBAN without being one. */
export function accountReference(random) {
  const block = () => String(random.int(1000, 9999));
  return `DEMO ${block()} ${block()} ${block()}`;
}

/** A masked card number; only the last four digits are ever shown anywhere. */
export function cardMask(random) {
  return `**** **** **** ${String(random.int(1000, 9999))}`;
}

/** A wallet address that no chain will ever issue. */
export function walletAddress(random) {
  const hex = '0123456789abcdef';
  let tail = '';
  for (let i = 0; i < 30; i++) tail += hex[random.int(0, 15)];
  return `0xDEMO${tail}`;
}

export const LISTS = { FIRST_NAMES, LAST_NAMES, MERCHANT_WORDS, MERCHANT_KINDS, CITIES, STREETS, TOKEN_WORDS };

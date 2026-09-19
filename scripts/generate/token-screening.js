// One hundred and sixty fictional token screens. Contract addresses use the impossible 0xDEMO
// prefix; names and pools are invented. Labels, including future rugs, live outside the demo folder.

import { createRandom } from './lib/random.js';
import { tokenName, walletAddress } from './lib/names.js';

export const SEED = 1134;

const round = (value, digits = 2) => Number(value.toFixed(digits));

function baseToken(random, overrides = {}) {
  const identity = tokenName(random);
  const ageDays = overrides.ageDays ?? random.int(20, 900);
  const buys = overrides.buys ?? random.int(120, 4_000);
  const sells = overrides.sells ?? random.int(90, 3_800);
  const creatorShare = overrides.creatorShare ?? random.float(0.01, 0.12, 3);
  const vestingShare = overrides.vestingShare ?? random.float(0, 0.08, 3);
  return {
    id: null,
    name: `${identity.name} Demo Token`,
    symbol: `D${identity.symbol}`,
    contractAddress: walletAddress(random),
    chain: random.pick(['Ethereum test fixture', 'Base test fixture', 'Arbitrum test fixture']),
    contract: {
      mintAuthorityPresent: overrides.mintAuthorityPresent ?? false,
      ownershipRenounced: overrides.ownershipRenounced ?? true,
      proxyUpgradeable: overrides.proxyUpgradeable ?? false,
      buyTaxPercent: overrides.buyTaxPercent ?? random.float(0, 4, 1),
      sellTaxPercent: overrides.sellTaxPercent ?? random.float(0, 5, 1),
      blacklistFunction: overrides.blacklistFunction ?? false,
    },
    liquidity: {
      poolUsd: overrides.poolUsd ?? random.int(180_000, 8_000_000),
      shareLocked: overrides.shareLocked ?? random.float(0.72, 1, 3),
      lockExpiry: overrides.lockExpiry ?? `202${random.int(7, 9)}-${String(random.int(1, 12)).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}`,
      largestRemovalPercent: overrides.largestRemovalPercent ?? random.float(0, 3, 2),
    },
    holders: {
      count: overrides.holderCount ?? random.int(1_200, 80_000),
      top10Share: overrides.top10Share ?? random.float(0.12, 0.48, 3),
      creatorShare,
      vestingContractShare: vestingShare,
      vestingContractVerified: overrides.vestingContractVerified ?? vestingShare > 0,
      burnAddressShare: overrides.burnAddressShare ?? random.float(0, 0.1, 3),
    },
    trading: {
      ageDays,
      buys,
      successfulSells: sells,
      failedSellAttempts: overrides.failedSellAttempts ?? random.weighted([[0, 85], [1, 15]]),
      buySellRatio: round(buys / Math.max(sells, 1), 3),
      volume24hUsd: overrides.volume24hUsd ?? random.int(20_000, 2_500_000),
      volume7dUsd: overrides.volume7dUsd ?? random.int(180_000, 16_000_000),
      volumeTrend: overrides.volumeTrend ?? random.pick(['steady', 'rising', 'falling', 'bursty']),
    },
  };
}

// #region demo:data
function rugged(random, index) {
  const flag = index < 5 ? 'MINT_AUTHORITY' : index < 10 ? 'UNLOCKED_LIQUIDITY' : 'HOLDER_CONCENTRATION';
  const overrides = flag === 'MINT_AUTHORITY'
    ? { mintAuthorityPresent: true, ownershipRenounced: false, creatorShare: random.float(0.22, 0.5, 3), top10Share: random.float(0.55, 0.88, 3) }
    : flag === 'UNLOCKED_LIQUIDITY'
      ? { shareLocked: random.float(0, 0.18, 3), largestRemovalPercent: random.float(45, 92, 2), lockExpiry: '2026-09-01' }
      : { creatorShare: random.float(0.42, 0.7, 3), top10Share: random.float(0.72, 0.94, 3), vestingShare: 0, vestingContractVerified: false };
  return { item: baseToken(random, { ageDays: random.int(4, 90), ...overrides }), label: { outcome: 'RUGGED', flag, decoy: false } };
}

function honeypot(random) {
  const buys = random.int(360, 680);
  return {
    item: baseToken(random, { ageDays: random.int(2, 45), buys, sells: random.int(0, 3), failedSellAttempts: random.int(3, 12), buyTaxPercent: random.float(0, 5, 1), sellTaxPercent: random.float(0, 8, 1), blacklistFunction: random.bool(0.45), top10Share: random.float(0.2, 0.6, 3) }),
    label: { outcome: 'HONEYPOT', flag: 'FAILED_SELLS', decoy: false },
  };
}
// #endregion

function taxTrap(random) {
  return {
    item: baseToken(random, { ageDays: random.int(8, 180), sellTaxPercent: random.float(21, 55, 1), buyTaxPercent: random.float(0, 8, 1), buys: random.int(250, 2_000), sells: random.int(80, 1_400), failedSellAttempts: random.int(0, 1) }),
    label: { outcome: 'TAX_TRAP', flag: 'SELL_TAX', decoy: false },
  };
}

function vestingDecoy(random) {
  const vesting = random.float(0.38, 0.62, 3);
  return {
    item: baseToken(random, { ageDays: random.int(7, 70), creatorShare: random.float(0.01, 0.05, 3), vestingShare: vesting, vestingContractVerified: true, top10Share: round(vesting + random.float(0.08, 0.2, 3), 3), holderCount: random.int(600, 5_000), failedSellAttempts: random.int(0, 1) }),
    label: { outcome: 'FINE', flag: 'NONE', decoy: true, decoyKind: 'verified vesting concentration' },
  };
}

function unlockedDecoy(random) {
  return {
    item: baseToken(random, { ageDays: random.int(500, 1_500), shareLocked: 0, lockExpiry: null, largestRemovalPercent: random.float(0, 0.4, 2), poolUsd: random.int(2_000_000, 15_000_000), creatorShare: random.float(0, 0.03, 3), top10Share: random.float(0.08, 0.25, 3), failedSellAttempts: random.int(0, 1), volumeTrend: 'steady' }),
    label: { outcome: 'FINE', flag: 'NONE', decoy: true, decoyKind: 'old unmoved unlocked pool' },
  };
}

function ordinary(random) {
  return { item: baseToken(random), label: { outcome: 'FINE', flag: 'NONE', decoy: false } };
}

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const entries = [];
  for (let index = 0; index < 14; index++) entries.push(rugged(random, index));
  for (let index = 0; index < 9; index++) entries.push(honeypot(random));
  for (let index = 0; index < 11; index++) entries.push(taxTrap(random));
  for (let index = 0; index < 9; index++) entries.push(vestingDecoy(random));
  for (let index = 0; index < 9; index++) entries.push(unlockedDecoy(random));
  for (let index = 0; index < 108; index++) entries.push(ordinary(random));

  random.shuffle(entries).forEach((entry, index) => { entry.item.id = `TOK-${String(index + 1).padStart(4, '0')}`; });
  const items = entries.map((entry) => entry.item).sort((a, b) => a.id.localeCompare(b.id));
  const labels = entries.map((entry) => ({ token: entry.item.id, tokenId: entry.item.id, ...entry.label })).sort((a, b) => a.token.localeCompare(b.token));
  return {
    dataset: {
      id: 'token-screening',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/token-screening.js',
      context: {
        asOf: '2026-09-19',
        norms: {
          newUnder30Days: 'New tokens often have fewer than 2,000 holders and concentrated allocations. Verified vesting contracts are not creator holdings.',
          taxes: 'A sell tax above 20% is a trap; ordinary fees are usually below 5%.',
          liquidity: 'An unlocked pool is a risk signal only with control or removal evidence. A long-unmoved old pool is not itself a rug.',
          sells: 'A few failed sells alongside hundreds of successful sells are network noise. Repeated failed sells when buys work and almost no sell succeeds are the reliable honeypot signal.',
        },
        caveat: 'All token names, tickers, contracts, pools and histories are invented. This is a screening exercise, not investment advice.',
      },
      items,
    },
    labels,
  };
}

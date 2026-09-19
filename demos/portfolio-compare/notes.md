# Portfolio compare

Eighteen fictional portfolio pairs built from invented weights over the repository's committed market
cache. Every holding carries its cached price-derived 12-month return, volatility and drawdown plus its
cached sector and currency. The goal and its hard constraints are prominent above the aligned columns.

The file contains twelve ordinary decisive pairs, four deliberately close calls and two traps. In each
trap, the side with the stronger 12-month return breaches the low-drawdown goal and should lose.

Run `npm run record portfolio-compare` to cache one complete Jev pass. The report then grades picks,
close-call restraint, both traps and the dimension named as the decisive difference.

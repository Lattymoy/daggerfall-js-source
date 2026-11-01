# Town Economy

Online, every city, hamlet and village has a Prosperity from 0 to 100 that moves its shop prices by up to a quarter
either way. The world sets most of it (the town's size, its own market cycle, a raid, its seat's ruler and Edict, its
sea lanes), and players add to it by what they do there. The player meets it on the Held Map's and the Overworld's town
card, in shop prices, in townsfolk's talk and market days, and at a port's exchange. Offline there is no town economy.

## How it works

**Prosperity** (`src/net/townEconLaw.js`, read by both client and service) is
clamp(0, 100, round(BASE + SIZE + CYCLE + SEAT + RAID + SEA + PLAYERS)):

| Term | Value |
|---|---|
| BASE | 50 |
| SIZE | city +6, hamlet +2, village -2 (`TOWN_SIZE`) |
| CYCLE | 12 sin(2π(day/11 + φ1)) + 6 sin(2π(day/29 + φ2)), phased by the town, on the real UTC day from the relay's clock |
| SEAT | a seat town: (Standing - 50) / 5, and its Edict: Market Day +6, Festival +8, Open Gates +3, Levy -6, Curfew -4 |
| RAID | -15 while a raid runs at the town |
| SEA | +2 for each sea lane ending at the town's port, at most 3 lanes |
| PLAYERS | 0 to +30, the players' share from the account service |

The bands: Destitute 0-14, Struggling 15-34, Steady 35-64, Thriving 65-84, Booming 85-100. The cycle is a closed form,
so a player away a month reads what one who stayed reads.

**The players' share** (`server-account/src/townEcon.js`). Only acts the service witnessed count: footsteps in the town
(the relay's signed Watch ticks), sales at players' traders there (market and patron sales), a raid driven from its
gates, and a captain's dealings at its port's exchange. Each is capped per account, per town, per day (`TOWN_ECON_CAPS`:
30, 10, 1, 10) and weighted (`TOWN_ECON_WEIGHTS`: 1, 4, 20, 2). The last 14 days are summed with a decay of 0.8 a day
into an activity A, and the share is 30 x A / (A + 150), so no crowd pushes a town to the top. The service learns which
town stands at a pixel from clients' reports, confirmed when three accounts a week old agree.

**The price.** What a counter asks (buy, repair) is x (1 - 0.25 (P - 50) / 50): 0.75 in a Booming town to 1.25 in a
Destitute one. What it pays (sell, sell magic) is x (1 - 0.25 |P - 50| / 50), so it only falls, and never above what it
asks this player. A seat's discount multiplies in, never below 0.70 together (`TOWN_FACTOR_FLOOR`). A piece a counter
sold online carries what was paid for it, and no counter pays more for it, so carrying goods between towns never pays.
The factor multiplies the counter's own adjustment (`worldModes.js` `shopAdjustment`), never the region's price index,
so quest gold, temples and guild training are untouched. Stock is never changed, only prices.

**The card.** Hovering a town on the Held Map or the Overworld shows its economy out of 100, the market's trend, prices
as shares of the region's usual, the strongest reason, and who holds the area: a seat town's own seat lines, else the
seat whose bailiwick it is in and the guild holding it, or that the area is unheld. The classic travel map keeps DFU's
label.

**The living world reads the band.** A town not Steady talks of its trade three days a week; a Booming town holds a
second market day a week, a Destitute one skips its market day every other week (`trips.js` `marketDay`).

**The sea.** A port's exchange sells and buys at its town's factors, the pay never above the ask, so a round trip at
one port never pays (`src/systems/naval/tradeGoods.js`). Lanes past the Bay count for ports past the Bay; a Bay port
counts the Bay's.

**Past the Bay.** Every town the world's registry stands has an economy. The staff `/town audit` lists a province's
capitals first, then its other towns by their producers' numbering, 400 a page.

## Rules

- **Prices swing up to a quarter** (Mac, "Wider swings, ±25%+"): `TOWN_PRICE_SWING` 0.25, an exception to the economy's
  fixed NPC prices.
- **Witnessed acts only** (Mac): never gold.
- **Guild control is shown, not new** (Mac): no town gains a power it lacks.
- **The card on the Held Map and the Overworld** (Mac); the classic travel map is DFU's.
- **A counter's piece never fetches more than it cost; the seat's round trip is closed; shelves are not widened** (Mac,
  leaving the choice to the design).
- Online only.

## Daggerfall Unity

DFU's shop prices read the region's price index (`FormulaHelper.CalculateTradePrice`) and never move with a town. The
town economy is this game's own, layered on the counter's adjustment so DFU's index stays as it is for everything else.

## Code and tests

- `src/net/townEconLaw.js` - the terms, bands, factors, shares, the card's lines
- `src/systems/town/townEcon.js`, `src/scenes/townEconHost.js` - the town's word and its host
- `src/net/townEconBook.js`, `server-account/src/townEcon.js` - the client's book and the service
- `test/systems/townecon.test.js`, `test/server/townecon_service.test.js`, `test/net/townecon_client.test.js`
- `test/systems/livingWorld/townecon_living.test.js`, `test/systems/naval/townecon_sea.test.js`,
  `test/server/bayleftsea_townaudit.test.js`

## Open

- LAW-3's mark is the client's honour, as every counter's price is.
- A station's put-in whose craft is then refused leaves a counter's units in the Stores.

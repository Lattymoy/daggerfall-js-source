# Economy

The frame for gold, selling and everything that moves wealth: what the economy is for, the guardrails it keeps, and
the rules for repairs, selling and online home prices. The player meets it at every counter, smith and bank. The town
economy that moves shop prices online is on `06-Systems/Town-Economy-Arc.md`; Marks, the server's currency, on
`06-Systems/Professions-Arc.md`.

## How it works

**The frame.** Influence, never control: the tools guide players toward an intended way of playing. Assume infinite
wealth: someone will get it by effort, error or exploit, so design for the system to fail with little harm to the
world. Repairs are friction that limits outings, not a sink.

**The intent.**
1. Progression is character growth (skills, crafting rank, reputation); gear is how it shows. Gold cannot buy it.
2. Friction and roleplay come from how the world reacts, never blocks on play. Fast travel between towns stays.
3. About one dungeon, one to two hours, an outing. The pressure to return is capacity, supplies and wear, never price.
4. Class-unique features stay: anyone reaches the outcome, the specialist does it cheaper, faster or anywhere.
5. Shops are the floor, crafting the ceiling. NPC prices are fixed, with bounded exceptions: a seat's members' discount
   and Market Day, a caravan friend's discount, and online the town economy. What an NPC pays for a crafted piece is
   capped.
6. Unfairness that brings people together is kept: field repair partial, arrows spent, potions easy to come by.
7. Maps and notes are items players price; the systems price none of it.

**Guardrails.** Gold buys convenience, consumables and status, never the top of power. Anything that changes another
player's game (seats, sieges, a guild's power) is priced in Marks, which gold cannot buy. A sink that scales with
wealth is one a player chooses (homes, decor, halls), never a tax on everyone.

**Selling online.** A counter pays at most half the least it asks anyone for the piece (`src/systems/shopStock.js`
`ONLINE_SALE_SHARE`), and the haggle reads Mercantile and Personality only within 0-100. Essentials (an inn room and its
food, a temple's cure, a fare, a potion) cost half online (`ONLINE_ESSENTIALS_PRICE_SCALE`). A crafted piece sells for
what the plain piece of its recipe sells for; its quality is power, never price (`src/systems/tradeModes.js`
`counterValueOf`).

**Repairs.**
- **Wear** is DFU's amount (`src/systems/equip.js` `DFU_WEAR_MULTIPLE` 1). Every weapon type shares one condition pool,
  the Warhammer's 1,600 through the material ladder (`src/characters/weapons.js` `WEAPON_CONDITION_POOL`).
- **A smith's price** is a third of Daggerfall's formula (`src/systems/repairService.js` `REPAIR_COST_SCALE`).
- **Kits stay partial**: a field or smith-made Repair Kit mends to three quarters of a piece's condition, a Superior or
  Masterwork kit to nine tenths (`src/net/recipeLaw.js` `KIT_CEILING`, `KIT_CEILING_HIGH`).

**A mend sells for a third.** Online, a piece the world handed over worn carries its found condition
(`src/systems/item/foundMark.js`). A counter pays for it at that condition plus a third (`MEND_SALE_SHARE`) of what the
owner's own mends (a kit, Repairs Objects, the Varla Stone) put past it. A smith's paid repair adds nothing to the sale.
Wear after the find spends the credit first, and what wear ate stays eaten. Offline, and for unmarked pieces, a piece
sells at its own condition.

**Homes online** (`src/net/homeLaw.js` `homeOnlinePrice`). A home costs the ground its model stands on, its box's width
by depth in square metres, at 300 gold a square metre, raised by the town's size (1 in a one-block place, about 2.75 in
an 8 x 8 city), rounded to the hundred and held to 5,000-250,000. A guild hall is half again. The account service
refuses a price outside the range or off its hundreds. Imperial City buildings are priced by their plot's ground.
Offline, the bank prices homes as Daggerfall does.

## Rules

- **Influence, never control; assume infinite wealth; repairs are friction** (the economy's frame, confirmed by Mac).
- **Prices swing with a town online** (Mac, "Wider swings, ±25%+") within the town economy's bounds.
- **Gear wears at DFU's amount, for better durability** (Mac); **one weapon condition pool, material disparity kept** (Mac).
- **A mend sells for a third, only the owner's own mends** (Mac).
- **Homes priced by what you get, inside a range the server enforces.**

## Daggerfall Unity

DFU's merchants have unlimited gold, `FormulaHelper.CalculateTradePrice` haggles on uncapped skills, repair prices
follow its formula, and `GetHousePrice` prices a house by the model's radius x 1,280. Online departures: the half-ask
sale cap and essentials at half, the haggle's 0-100 range, a third of the repair price, kit ceilings, the found mark,
crafted-worth caps and the footprint home price. Each exists because online gold must not be printable from a loop.
Offline, DFU's prices stand except the repair scale and kit ceilings.

## Code and tests

- `src/systems/shopStock.js` - online sale share, essentials
- `src/systems/tradeModes.js` - counter values, crafted worth, sale condition
- `src/systems/repairService.js`, `src/systems/smithItems.js` - repair price, kits
- `src/systems/item/foundMark.js` - the found mark and the third of a mend
- `src/net/homeLaw.js` - online home prices
- `test/systems/craftworth.test.js`, `test/systems/mend_third.test.js`, `test/systems/homeprice.test.js`

## Open

- The outing length, wear, weapon pool, kit ceiling, repair scale, potion rates, companion capacity and home pricing
  (rate, town factor, range, and whether homes need a floor, a per-account cap or upkeep) are tunable numbers, to be
  read again against the server-side gold ledger before they are turned.
- Inside the home range the price is still the client's word; a forged client can buy a large home at the floor.
- The frame's personal Vault (storage at any bank or guild hall), Loadouts and secure services in the trade window
  are not built; a guild's vault is a separate system.

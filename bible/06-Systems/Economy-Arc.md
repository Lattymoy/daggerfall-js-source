# The Economy Arc (ECON-PLAN, opened 2026-10-01)

THE DESIGN RECORD for gold, selling and everything that moves wealth around:
what the economy is FOR, decided before any number is set, and the order the
work goes in. It opened with the repair triage of 2026-10-01 (players: items
break too fast, and cost too much to fix), whose memo asked the questions
below and put the frame they are answered in. Four read-only lenses mapped
the economy as it stands (shops and selling, the online economy, every source
and sink of gold, the work in flight); the answers were proposed from what
they found and confirmed the same day ("Confirm.").

## The frame

From the memo, kept as the arc's law:

- **Influence, never control.** An economy like this is not something you can
  control, only influence; its tools guide players toward an intended
  playstyle.
- **Assume infinite wealth.** "Someone will, eventually, obtain infinite
  wealth either by great effort, error, or exploitation. Do not attempt to
  design a system to be bulletproof, design with the expectation that the
  system will fail, catastrophically, and that such a failure will minimally
  impact the world."
- **Repairs are friction, not a sink.** "Things like repairs exist to limit
  outings and force planning. Their function is not to remove money from the
  economy."

## The intent (confirmed 2026-10-01)

1. **The progression core is character growth** - skills, crafting rank,
   reputation - with gear as how it shows. Gold cannot buy it (training stops
   at skill 50; Drakes come only from acts the server saw), so it survives a
   player with infinite gold. The Loot Arc's chase stays a second loop.
2. **Friction and roleplay.** Roleplay is enforced by how the world reacts -
   dress, standing, factions, the law - never by blocks on play. Fast travel
   between towns stays; the journey matters in the wilderness and below
   ground. Field repair stays partial.
3. **Returning to hubs.** About one dungeon - one to two hours - per outing,
   stretched by preparation (kits, potions, a cart, a mage friend). The
   pressure to return is capacity, supplies and wear, never price; returning
   is cheap and worth it (selling, training, quests, people).
4. **Class-unique features stay.** Anyone can reach the outcome; the
   specialist does it cheaper, faster or anywhere. A mage teleports anywhere;
   anyone else pays the Mages Guild's teleport.
5. **Shops are the floor, crafting the ceiling.** NPC prices are fixed, which
   is what shields a newcomer from inflation among players; the world keeps
   its exclusives (Legendaries, signature drops, artifacts, the NPC-only
   services). What an NPC pays for a crafted piece is capped, or smithing
   prints gold.
6. **Unfairness that brings people together is kept.** Each class has one
   answer it can reach alone that is worse than the answer a group gives. No
   new friction to even things out (no spell components), no free
   regeneration; field repair partial; arrows spent, cheap, some recovered.
   Potions are the solo answer to healing, so they are easy to come by.
7. **Information trade, lightly.** Maps and notes become items players can
   trade at their own prices (Shared Cartography already shares a map with a
   party live); the systems price none of it.

**The three features the friction needs** (the memo: without them the
current design "does not work in an enjoyable manner"):

- **The Vault** - storage reachable at any bank branch and guild hall, held
  on the account service (which is also the answer to duplication there),
  a small fee per item.
- **Loadouts** - named sets of gear, swapped as one action out of combat.
- **Secure services** - a Service mode on the escrowed trade window: the
  customer's item never leaves them while the provider repairs, enchants or
  recharges it in the window, and one confirm settles the fee.

**The guardrails "assume infinite wealth" gives:**

- Gold buys convenience, consumables and status - never the top of power.
- Anything that changes another player's game (seats, sieges, a guild's
  power) is priced in Drakes, which gold cannot buy - the direction the Seats
  arc already took (`11-Multiplayer/Seats-Arc.md`).
- Failure must be seen to be contained: the server-side gold ledger comes
  before any tuning that depends on it.
- A sink that scales with wealth is a prestige one a player chooses (homes,
  decor, halls) - never a tax on everyone.

## Where the economy stands (2026-10-01)

- **Authority.** A realm character's gold is checked once, at its first save
  (`server-account/src/realm.js`, `src/net/realmGoldLaw.js`); every later
  checkpoint is stored as written, and every source - loot, quests, shop
  sales, gate spoils (`src/systems/gateSpoils.js`) - is computed by the
  client. "Assume infinite wealth" is already literally true. The budgets and
  telemetry `06-Systems/Realm-Arc.md` planned are not built. A market
  listing's wear is the client's word too: a lie about it buys a kit's work,
  and since KIT-CEILING a smith's - gold such a client can write for itself
  (`06-Systems/Professions-Arc.md`, "What the listing carries").
- **Sources scale; sinks do not.** Gate spoils, raid thanks and quest rewards
  climb with level and item values climb with material (DFU's x512 ladder),
  while the recurring costs are flat and online's essentials were halved
  (`src/systems/shopStock.js`). The biggest faucet by the formulas (not
  measured) is high-rank smithing: an Orcish cuirass from about 1,700 gold of
  ore sells online for some 29,000-42,000.
- **Sinks are one-time.** Houses, boats and crafting stations are bought
  once; nothing charges upkeep; bank balances are never touched; the online
  death penalty takes a tenth of the purse alone (a quarter until DEATH-TENTH, 2026-10-03)
  (`src/systems/deathPenalty.js`). Repairs were the one sink that scaled with
  gear, and they scaled hardest for the best gear.
- **Shops.** Merchants have unlimited gold; online a shop pays at most half
  the least it asks anyone for the piece (REALM P0.4, MERC-RISE), and under
  that cap a seller's Mercantile and Personality still raise the sale.
- **Already built, and used by this plan:** Drakes and the walled Gold Market
  (`src/net/marksLaw.js`, `src/net/marketLaw.js`), the escrowed trade between
  players (`server-account/src/realmTrade.js`), field and smith-made repair
  kits (`src/systems/smithItems.js`), the Mages Guild's teleport, Shared
  Cartography, homes and their containers.

## The plan

- **Phase 0 - the triage, shipped with this page.** WEAR-VANILLA (gear wears
  at DFU's amount, twice since WEAR-TWICE; `05-Combat/Physical-Combat-Overhaul.md`), REPAIR-RATE,
  KIT-CEILING and SELL-AS-FOUND (below), POTION-COMMON (a Potion of Healing
  on a looting foe 6 times in 100 and in a J-O pile 12 - 10 and 18 since
  LOOT-EASE, 2026-10-05, with a Potion of Restore Power beside it at 6 and 10,
  `06-Systems/Loot-Arc.md` section 19 - and a few at every
  alchemist's and general store's counter each day -
  `src/systems/healingSupply.js`) and COMPANION-WEIGHT (a crew companion's
  pack carries what a person of his strength can, DFU's MaxEncumbrance -
  `03-World/Naval-Combat.md`). Audited the same day (AUDIT ECON,
  `01-Overview/Audit-Econ.md`).
- **Phase 1 - see failure.** The server-side gold ledger: each checkpoint's
  gold and item deltas read against budgets, every faucet counted. Nothing
  later is tuned blind.
- **Phase 2 - close the printers.** Cap what an NPC pays for a crafted piece;
  customs reads the server's level, not the client's; a defaulted loan stops
  being free gold.
- **Phase 3 - make the friction fair.** The Vault, Loadouts and secure
  services, in that order.
- **Phase 4 - sinks by choice.** Prestige for the rich (homes, decor, halls);
  anything that reaches another player in Drakes.
- **Phase 5 - specialists and information.** Repairs and teleports as
  services a player sells; copied maps and notes as items.

## Repairs, set from the intent

- **Wear** is DFU's amount (WEAR-VANILLA; WEAR-TWICE doubled it on
  2026-10-02 - "I still want there to be some challenge" - and WEAR-ONE put it
  back the same day - Mac: "we need to buff gear durability because its really
  bad"): the mods' wear
  modules are off, a monster's natural attack wears no armour, and a blow
  wears by the damage that got through the overhaul's armour (AUDIT ECON
  W1) - DFU's armour turns a blow aside and wears nothing, the overhaul's
  absorbs a share and that share wears nothing either. At DFU's own amount
  wear put no pressure on an outing (a steel longsword lost about 6.5% to a
  hundred swings); at twice it, about 13%, and per swing armour wears
  1.4-1.7 times DFU's and a blade 2.3-2.5 times. The pressure to come back
  is wear, never price: the price below stays a third. What a weapon holds
  is one pool for every type since WEAPON-POOL (2026-10-06, Mac: "keep the
  material disparity, but unify all the weapons types condition stat"): the
  Warhammer's 1,600 through the material ladder, where Daggerfall's rows ran
  from a dagger's or a short bow's 50 - a steel longsword holds 2,400 where
  it held 1,200, so the same hundred swings take half the share. Armour's
  pools are unchanged.
- **The price** (REPAIR-RATE, `src/systems/repairService.js`
  `REPAIR_COST_SCALE`): a third of what Daggerfall's formula asks - it was two
  thirds since REPAIR-EASE (2026-09-30). Under Roleplay & Realism: Items'
  damage-scaled price, a full repair is a fifth of the smith's asking price
  for the piece: still a craftsman's fee (a broken Daedric longsword, 9,216
  gold before the haggle at a middling smith - 5,184 to 6,372 asked), not a
  punishment for using the gear. Its upkeep was 3.3-6.4 gold a landed hit
  at WEAR-TWICE's doubled wear (17.4-24.0 before the triage); the price
  being the share, DFU's own amount since WEAR-ONE halves it, and
  WEAPON-POOL's doubled longsword pool halves it again - about 0.8-1.6
  (derived, not measured again; AUDIT WEAPON-POOL P9).
- **Kits stay partial** (KIT-CEILING, `src/systems/smithItems.js`): a field
  kit or a smith-made kit mends a piece no further than three quarters of its
  condition (rounded down: a smith's Fine Buckler's 589 stops at 441; an
  Iron Dagger's 50 stopped at 37 before WEAPON-POOL, which made every weapon
  pool a multiple of four, so a weapon's three quarters is whole - 1,600
  stops at 1,200). Three quarters
  is the edge of the overhaul's normal band for a blade (61-75% strikes at
  its own damage) and for armour; the 1.1 and 1.3 of a sharp edge come back
  at the smith's. (A blunt weapon's normal band runs to 91%, so a smith adds
  nothing to a mace's blow until 92%.) A kit is not spent on less than a
  hundredth of a piece's condition, asks when the ceiling holds back a piece
  the player may have meant, and is kept, said, on every refusal.
- **Selling, online** (SELL-AS-FOUND, AUDIT ECON O1, `src/systems/tradeModes.js`):
  a counter pays for a piece no more than the condition the world handed it
  over at. Roleplay & Realism: Items hands loot over worn and prices a sale
  by condition, so at a third a repair cost less than the sale it added, and
  mending loot to sell it paid every player - a printer opened by this arc's
  own price, closed with it. A repair is for using a piece, never for
  selling it; a piece handed over whole is untouched.
- **Next** (Phase 3): the Vault and Loadouts make "the right tool for the
  job" a choice rather than a chore, and secure services let a smith or a
  mage sell repairs without either side being robbed.

## Homes, priced by what you get (HOME-PRICE, 2026-10-04)

The ask: "We need to make house pricing make sense online". Offered three ways,
the choice was a new online price "by what you get (its footprint, scaled by
town size) inside a fixed range the server enforces", with the coherence fixes
beside it. Audited the same day (`01-Overview/Audit-HomePrice.md`); what the
audit changed is folded in below.

**What did not make sense.**
- **The measure.** A door asked Daggerfall's own price: the model's bounding
  RADIUS x 1280 (`src/systems/banking.js` `housePrice`, GetHousePrice). A
  sphere grows with a roof's height and a wing's reach as much as with the
  rooms, so prices ran from a few thousand (a house at 4,000, FIELD BUGS
  2026-09-30b) to over 800,000 - a home customs carried in was priced 706,000
  (FIELD BUGS 2026-09-30 #1: its 600,100 sale quote is the deed's 85%), and a
  hall's door asked 1,274,880 from a treasury, half again a house of 849,920
  (FIELD BUGS 2026-10-03, HALL-GOLD) - while customs lets a level-10 character
  bring 120,000 in all. A cottage could cost more than a manor.
- **The authority.** The service took whatever price a client named, from 1
  gold to ten million (`homePriceOk`); it bundles no ARENA2, so it cannot
  measure a building.
- **The words.** "From your purse and this region's bank account" - online,
  EMPIRE-ACCOUNT moved every home's gold to the one Empire account - and every
  sum a bare number ("600100 gold").
- **The sale box** quoted the deed share of the house's price as the client
  measured it, while the service pays the share of what was PAID. The two
  were one number while the door asked Daggerfall's price (the same radius
  each time; a home customs carried in already had HOME-CROSSED's words) -
  a new price makes them two for every home bought before it, so the box
  had to ask the service (AUDIT HOME-PRICE E7).

**The law** (`src/net/homeLaw.js`, read by both ends): an online home costs
the GROUND its model stands on - the ARCH3D box's width by depth, in square
metres (`systems/onlineHomes.js` `homeFootprintM2`, the renderer's 0.025 m a
unit; Daggerfall's meshes are centred on x and z, RMBLayout.cs:874, so the
box's origin is no inflation) - at **300 gold a square metre**, raised by its
town's size (`homeTownFactor`: 1 in a one-block hamlet, farm or manor, rising
with the town's side, the square root of its RMB blocks - 1.5 at 3 x 3, 2 at
5 x 5, 2.75 at 8 x 8), rounded to the nearest **hundred** and held to
**5,000-250,000** (`homeOnlinePrice`). For example: a 6 x 6 m cottage in a
hamlet is 10,800; a 10 x 10 m house in a 3 x 3 town 45,000; a 12 x 12 m house
in Daggerfall (8 x 8) 118,800. The cap binds from 303 m2 (about 17.4 m square)
in an 8 x 8 city, 417 m2 in a 5 x 5 town and 833 m2 in a hamlet - a large city
house may well sit at the cap (unmeasured here), and past it price no longer
follows size (AUDIT HOME-PRICE E3). A guild's hall is still the home's price and half again
(`guildHallPrice`), so at most 375,000. Offline nothing changes: the bank's
market and its buy-back read Daggerfall's own price; customs counts every deed
at its own constant (`net/realmGoldLaw.js` `CUSTOMS_HOUSE_PRICE`, 100,000),
never either price (D10).

**The bank's deed, online** (AUDIT HOME-PRICE C1, chosen: "Online price"). The
deed an online character can hold is a knightly order's free house (the bank
sells none online and customs' are `crossed`), and the bank bought it back at
radius x 1280 - up to a million, four times the dearest home, once an order a
character. Online it buys it back at the deed share of the same online price
(`scenes/worldModes.js` `deedSellPrice`, the directory's `townBlocks`), at
most 212,500; and the grant never hands over a building that is a player's
home (HOME1: one owner a building), waiting for the town's homes to be read.

**The service holds the range.** A claim (`server-account/src/homes.js`
`claimHome`) or a hall's (`halls.js` `buyHall`) naming a price outside it, or
off its hundreds (AUDIT HOME-PRICE L2), is refused `home-update` - a build from
before HOME-PRICE asks Daggerfall's radius x 1280, a whole hundred about one
house in a hundred - and nothing is seated or paid. Inside the range the price
is still the client's word: the service can hold no building's measure without
game data (the doctrine), so a forged client can buy a manor at the floor.
"Assume infinite wealth" covers it - the range bounds the damage, which the
ten-million cap did not. The account service is acct75.

**The sale says what it pays.** The town's answer tells the NAMED character's
own home what its sale pays back (`refund`, realmRelease's deed share of what
its record `paid`) and the rent held on it (`rentDue`), and nothing to any
other home: one from before the realm, or another character's of the account,
is no sale that character's door can make (AUDIT HOME-PRICE L3). A claim's
answer says the same of the house it seated - or that it is `crossed` (C2).
The client's registry keeps both, and the door's box asks "Sell your home for
N gold, and the R gold of rent you have not collected?" (`homeSaleLines`,
`homeSaleOffer`; C3), falling back to the house's online price only against a
service that sends none. Its placed pieces' half is said in words, not summed.
A home bought at Daggerfall's price sells back at the share of what was paid.

**The words** (`systems/homeWords.js`, one spelling - AUDIT HOME-PRICE E4).
The door's, the sale's and the rent's sums carry their thousands, and online
they name "your account at the Bank of the Empire" - the rent's window and its
collection too, and a sold deed's pieces the account the half went into. The
decorator's piece lines (placed, removed, an edit's cost) still print bare
numbers, mostly hundreds.

**The sink this leaves** (AUDIT HOME-PRICE E1). The home sink shrank and is
capped: three homes a character sink at most 750,000 where the field's prices
reached about 2.1-2.5 million, a hall at most 375,000 where one asked
1,274,880, and past the cap a home no longer scales with wealth. Held for good,
a home costs 15% of its price (the sale's 85% back, no upkeep), so an account's
six realm characters can hold eighteen exclusive buildings cheaply. The
guardrail's "a sink that scales with wealth is a prestige one a player
chooses" is now decor, the look and the stations (Phase 4); if squatting shows,
the answers are a floor, a per-account cap or upkeep - open numbers, below.

**What it cannot reach.** An out-of-date build (an old desktop copy plays
against the new service) still buys the one house in a hundred whose old price
is a whole hundred inside the range, and its sale box still quotes 85% of the
old price - the service pays the share of what was paid, and its own line
after the sale says so. The refusal's words are the old build's own ("Reload
it to buy a home."), which a desktop copy answers with File > Restart to
Update (AUDIT HOME-PRICE E2).

**The four hosts.** `scenes/world.js` and `scenes/exterior.js` put the town's
blocks on every door's building record and on the bank's directory
(`townBlocks`, `homeTownBlocks`); `scenes/worldModes.js` prices the door, the
deed and the sale; the dungeon host prices no door. `test/homeprice.test.js`
(8), `tools/mutants/homeprice.json` (56, all dead). **Not verified here:** this
tree has no ARENA2, so the spread over Daggerfall's real house models was not
measured - the rate, the factor and the range are set from the field's prices
and customs' allowance, and are open numbers (below).

## Open numbers

The outing (one dungeon, one to two hours), the wear (DFU's amount since WEAR-ONE,
`src/systems/equip.js` `DFU_WEAR_MULTIPLE` = 1), the weapon pool (WEAPON-POOL,
`src/characters/weapons.js` `WEAPON_CONDITION_POOL` = 1600), the kit ceiling (75%), the repair
scale (a third), the potions' rates and the companion's capacity are all
tunable, and each is to be read again against the Phase 1 ledger before it is
turned. So are a home's (HOME-PRICE, `src/net/homeLaw.js`): 300 gold a square
metre, the town factor, and the 5,000-250,000 range - and whether a home
needs a floor, a per-account cap or upkeep (AUDIT HOME-PRICE E1).

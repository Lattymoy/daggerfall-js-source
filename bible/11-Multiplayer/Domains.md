# DOMAINS - a guild holds a region, gives to it, and keeps its castle (DOMAIN0, the design record)

Opened 2026-10-24. The port's own: a player's guild and its seats are GUILD1-GUILD3 and SEAT0's (`Seats-Arc.md`,
`Guild-Overhaul.md`, `Guilds-Made-Plain.md`), none of it DFU's. This page changes them for the Tamriel expansion and
names every law it moves.

## Asked

The owner, 2026-10-24, with three sessions building the land past the Bay (TESA, PR #1184; World-Wide,
`03-World/World-Wide.md` on its own branch): *"One of our big focuses right now is on the tamriel expansion ... my goal
for when we release this is a seamless update ... one thing I want to ensure is the guild system not only applies to
the new cities but I want to overhaul it to be even more streamlined than its current iteration.*

*1. Allowing guild mates to contribute to town material storage with gathered items/their store*

*2. Allowing the purchase of the actual castle in major cities (cyrodil excluded), using the instancing system*

*3. A transition to tamriel region control instead of just city control"*

Asked back, the owner chose:

| The question | The owner's answer |
|---|---|
| Region control: replace the town seat as the thing fought over, or sit on top of it? | **Replace seats** - one holder a region, one siege a region at its chief town, the region's towns its holdings |
| A castle: each guild its own instanced copy, or one owner a castle? | **One owner per castle** |
| What it is paid with | **Silver** |
| Who may buy it, and what happens when the region changes hands | **The region's holder buys it**; losing the region puts it back on offer and refunds part of the price |
| The capitals past the Bay have no castle interior yet - who builds them | **This lane, after TESA merges** |

## 1. What stands (FACT, main at 6f501bf5d)

- **The seats.** Every MAPS.BSA location with a Palace is a seat, and the three kingdoms' cities are crowns
  (`systems/town/townSeats.js` deriveTownSeats; SEAT0 3.1). On the freeware ARENA2 that is **322 seats - 3 crowns and
  319 palaces - in 39 regions** (`tools/seatCount.mjs`, run 2026-10-24); the service's witness rows hold more keys than
  that (1,204, Scale-Arc LEAN-WITNESS), which is why the servers trust a seat only when three clients agree on it
  (`townSeatLaw.js` seatReportOf, `server-account/src/townSeats.js`). Each seat is its own war: its own pledges, its own
  Turning, its own siege, its own works and stockpile, its own bailiwick of Notice Boards (`townSeatLaw.js`
  bailiwickOf). A guild pledges at most one seat a region and five regions (`SEAT_PLEDGE_REGIONS_MAX`), and every
  influence it earns in a region already goes to that one seat (`server-account/src/seatInfluence.js`).
- **The stockpile.** A seat's materials (`town_seat_stockpile`, never withdrawn) come in two ways: the Levy Edict's tenth
  of each harvest in the bailiwick, and seat writs - posted by the Guildmaster or an Officer, paid out of the silver
  treasury's escrow, filled by anyone else (`server-account/src/writs.js` postGuildWrit, supplyGuildWrit). No member can
  give a unit of their own, and AUDIT 31 S6 bars the Guildmaster and the Officers from filling their own guild's writs
  at all (`writ-own-guild`). The works spend it (`server-account/src/seatForts.js` supplyForts; `src/net/fortLaw.js`).
- **The castles.** Daggerfall, Wayrest and Sentinel each stand a castle - a dungeon of the city's own location, entered
  by its dungeon door and always built whole (`world/dungeon/dungeonTextures.js` MAIN_STORY_DUNGEON_IDS). The crown
  holder's banners, roster board and chest stand in its throne room (CROWN-HALL, `systems/crownHall.js`,
  `worldModes.js` openCrownPiece). Nobody can buy one. An instance is an account's (`net/instanceRoom.js`
  instanceOwnerOf), admitting its owner, its owner's party and staff; no room belongs to a guild.
- **Past the Bay.** World-Wide (unmerged, `ccr-542d30a7-oyplx0`) makes each province a region after the Bay's 62 (62
  High Rock .. 70 Cyrodiil, WW-R) and Cyrodiil the open PvP zone (WW-C2), and leaves the seats, the homes and the town
  economy the Bay's "until WW7". TESA (#1184) stands the provinces' capitals - the Imperial City, Solitude, Mournhold,
  Alinor, Falinesti, Torval and Helstrom (`world/tamrielCapitals.js` on its branch) - each castle a landmark model with a
  painted door; none has an interior.
- **The Season.** Season 0, the open beta, ends at the Turning of **Sunday 2026-11-01, 18:00 UTC** (seat week 6;
  `SEASON_ZERO_WEEK = "2"`, `SEASON_ZERO_WEEKS` 4), and that Turning wipes every Charter, every influence row, every
  work and stockpile (`seatTurning.js` SEASON_ZERO_WIPED).

## 2. The laws this arc keeps

1. **ONE REGION, ONE CHARTER.** What a guild holds is a region. Its towns are the Charter's holdings, never fought
   over apart from it.
2. **A GIFT IS A DELIVERY WITH NO PAY.** A member's materials given to the guild's stockpile follow the seat writ's
   law in everything but the silver: the same materials, the same trust in the units, the same influence. Nothing is
   paid, so nothing can be paid twice, and every rank may give.
3. **A CASTLE IS ITS REGION'S.** Only the region's holder owns its castle, and losing the region loses the castle.
4. **THE KEYS STAY.** A region's Charter is keyed by its seat of power's map id - the key every seat table, the siege
   room (`siege:<key>:<week>`), the title claim (`ts`) and the works already use. No table changes its key and no wire
   id moves (GUILD3 law 2).
5. **SEAMS, NOT A BRANCH.** Built on main. The provinces join by a table this page names when World-Wide and TESA have
   merged; nothing here imports their branches.
6. **NO BAND AIDS.** A slice moves the law where it lives - the Turning's plan, the pledge's check, the bailiwick - and
   pins the Bay's answer to every unchanged rule.

## 3. The decisions (DECIDED, at the owner's choices above)

| | Decided | Why |
|---|---|---|
| A region's seat of power | The region's seat that ranks first by HUB1's own claim (`systems/region/regionHubs.js` hubClaim: a city over a town, then the one named for its region, then the largest) - the crown city in a crown's region | The hub is "each region's main city" (HUB1, Mac: "future ownership for online guilds"); measured, it IS the seat of power in 37 of the 39, and in the other two (Wrothgarian Mountains, Koegria) the hub has no palace, so the next best palace town stands |
| How the servers learn it | A witness of its own (`domain`, keyed by the region): a client reports its region's seat of power as it reports the seat, and three agreeing confirm, as every witnessed fact (`net/nodeLaw.js` witnessedFact). A region's Charter is pledgeable once its seat of power is confirmed AND a confirmed seat of that region | The servers hold no ARENA2 (SEAT0 3.2); a fourth witnessed fact, never a table typed from the data |
| What a region's Charter is | Its seat of power's seat: the same tier (crown in Daggerfall, Wayrest, Sentinel; palace elsewhere), the same claim threshold, fee, upkeep, Standing, works, Edicts and siege - and every other seat town of the region its holding | One war a region (322 become 39 on the Bay) without a new law of numbers; balance stays an edit in `townSeatLaw.js` |
| The pledge | A region, once - the guild's pledge in a region names its Charter; five regions at most, as now | It already routed every influence in the region to one seat |
| The Watch | Kept in any seat town of the region | A region's people watched in their own towns |
| Homes | A counting member's home anywhere in the region, five a guild a region | Same |
| The bailiwick | The whole region: every Notice Board of it belongs to its Charter - the Tithe, the Levy, the Bounty, the board's Seat tab | Law 1 |
| The members' discount | In every town of the held region | Law 1 |
| The siege and the Tourney | At the seat of power, as a seat's now | Its field (`systems/siegeField.js`) is already built for any palace town and for a crown's castle |
| The words | A Charter is named for its REGION: "the Charter of Koegria" (ruled from Aldcester), "the Charter of Anticlere" (33 of the 39 seats of power bear their region's own name, so most read as they did), "the Crown Charter of Daggerfall" as now; a town of a held region: "Ripmore, in the Charter of Daggerfall, held by the Silver Hand <SH>." | The Charter is the region's |
| When it rules | From the seat week `DOMAINS_WEEK` names (the service's config, as `SEASON_ZERO_WEEK`): the settle of that week and every later one is by region, and the pledges for it are. **Recommended: week 6, Season 1's first** - Season 0's last Turning wipes every Charter, so the region law opens on an empty board and nothing needs folding | No live Charter is moved by hand |
| If it opens later | At its first Turning, each region's Charter goes to the holder of its seat of power; every other Charter of the region is released - its claim fee back to its guild's silver treasury (`domain-fold`), its stockpile and its works' held units moved to the region's stockpile, its own works left standing on a town that is no longer a Charter. Pledges made for that week at a seat that is not its region's seat of power move to the region's Charter | One rule, read once |
| Gifts | Any member of the guild that holds the region (to its stockpile) or that pledged it this week (to its Siege Camp), any rank; from the character's Stores and, through them, from the bag - the counted units alone (`profBook.ensureInStores`, the `spend` order); a fortification's material only, a Ram Kit to a Siege Camp alone; asked at a Notice Board of that region | Law 2; the owner's "gathered items/their store" |
| A gift's credit | The seat writ's: its own units at their value (1 influence a silver), its bought units at Tribute's rate inside Tribute's share (`seatInfluence.js` creditSeatWrit), only for a counting member, inside the account's 2,000 a week. No Standing (a filled writ's +1 stays the writs'), no silver, no Renown | The units cannot come back, so each raises influence once |
| A castle | The crown regions' (on the Bay: Castle Daggerfall, Castle Wayrest, Castle Sentinel - each its crown city's own dungeon); past the Bay each province's capital's, **Cyrodiil's Imperial City never** (the owner) | "Major cities" are the crowns |
| A castle's price | **120,000 silver** from the guild's silver treasury, burnt (one and a half times a crown's claim fee); bought by the Guildmaster of the guild holding that region's Charter | The owner: silver, the holder alone |
| Losing it | When the region's Charter leaves the guild by any road - a siege, a lapse, a revolt, a fold, given up - the castle is released at the next read and **half its price** (60,000) goes back to the guild's silver treasury (`castle-lost`). Given up by the Guildmaster while the region is held: 85%, as a hall (`castle-sale`) | The owner: "the old owner is refunded part of the price" |
| What a castle is | The guild's own instance of the castle, whole: `dungeon:m<castle>.i<guild>.<epoch>` - its owner a GUILD's digest (`instance:guild:<id>`, its own hash domain), its epoch minted at the purchase and never again, so the next owner walks into a fresh castle. The relay admits the owning guild's members (the token's verified guild) and staff, never a guest | Instances (`Instances.md`) carry it; the castle is "one owner" |
| What it holds | The throne room's pieces (CROWN-HALL) for its guild - banners, the roster board, the vault chest - and the vault's hall shelf (`GUILD_VAULT_HALL_SLOTS`) while the guild holds a castle or a hall, never twice; the guild's banners at the castle's door in the city | A court of its own |
| The public castle | Unchanged: the quests' castle, the region holder's banners in its throne room as now | Instances keep the public room |

Considered and NOT done:

- **Each guild its own copy of every castle.** The owner chose one owner a castle.
- **A castle anyone may buy.** The owner chose the region's holder alone - so the loop is one: give to the region, hold
  it, keep its castle.
- **A static table of the 39 seats of power.** It would be measured off the freeware's MAPS.BSA and could disagree
  with a player's own (the witness rows hold more seat keys than one data set derives); the registry's own law stands.
- **A castle that strengthens the defence.** A siege stays won in the field and at the Turning, never bought.
- **Province regions split into districts for control.** World-Wide's areas are its systems' grouping, never a region
  on the wire (World-Wide decision 5); a province is one Charter, its capital its seat of power.

## 4. The slices

| Slice | What | Status |
|---|---|---|
| DOMAIN0 | This record | WRITTEN |
| DOMAIN1 | Gifts: a member gives fortification materials from their Stores and their bag to the guild's stockpile or Siege Camp in the region - the service's act, its record, the board's form and its words | planned |
| DOMAIN2 | The castle: the law, the purchase, the release with the region, the guild's instance on the relay and at the door, the throne room's pieces in it, the Guild window's words | planned |
| DOMAIN3 | The region's Charter: the seat of power's witness, the pledge by region, the bailiwick the region, the Watch and the homes region-wide, the Turning and every read by region from `DOMAINS_WEEK`, the fold, the words and the map | planned |
| DOMAIN4 | Past the Bay, once World-Wide and TESA have merged: each province but Cyrodiil a crown Charter, its capital the seat of power (our own data - a table, never witnessed), the capitals' castle interiors and their siege fields; the regions' laws (`seatRegionOk` and the rest) to 69 | planned, waits on #1184 and World-Wide |

## 5. DOMAIN1 - a gift to the town (planned)

- **The act**: `POST /v1/seats/give` `{ character, region, material, units, rid }` (`server-account/src/writs.js`
  giveStockpile, beside the deliveries it mirrors). The service finds the place itself: the seat its character's guild
  holds in `region` (its stockpile) or else the seat it pledged there this seat week (its Siege Camp) - a guild has at
  most one of each a region. One batch whose first statement decides, as every act of the writs (PROF1's law): the
  character still a member, the place still the guild's (`SEAT_WRIT_LIVE_SQL`'s rule), the units spendable in its
  Stores (own and bought, never gold's or loose), the request id unspent; then the Stores spent (bought first), the
  stockpile or the camp filled, and a row of the gift (`town_seat_gifts`, the record and the idempotence). After it: the
  works supplied (`supplyForts`) and the influence credited (`creditSeatWrit`, its `ref` the gift's own).
- **Refusals**, each said before the press where the page can know it: `bad-region`, `bad-material` (not a
  fortification's; a Ram Kit to a stockpile), `bad-units`, `seat-none-here` (the guild holds and pledged nothing in the
  region), `stores-short`, `stores-gold`, `writ-rate` (the writs' own bucket), a held character's (`realmHoldOf`), and
  the switches (`seats-closed`, `prof-closed`).
- **The board.** The Seat tab's works panel (`ui/seatWorks.js`) gains **Give to the stockpile** (or **to the Siege
  Camp**) for a member of the guild there: each material a work still wants, what the character holds of it in the
  Stores and the bag, a count, and the button; the stockpile line names the last gifts ("Alda gave 40 Cut Stone").
  The host wraps the act in `profBook.ensureInStores` (`scenes/world.js`, as a writ's delivery), so a gathered unit in
  the bag goes in first.
- **The four hosts**: `scenes/world.js` wires it (the board's host); `worldModes.js`, `dungeonContext.js` and
  `exterior.js` stand no Seat tab - FLAGGED, nothing to wire.

## 6. DOMAIN2 - the castle (planned)

- **The law** (`net/castleLaw.js`, new): which regions keep a castle (the crowns' on the Bay; DOMAIN4's provinces), its
  name ("Castle Daggerfall"), its price, the two refunds, the powers (the Guildmaster buys and gives up; any member
  walks in), the owner's digest (`instanceGuildOwnerOf`) and the words. The castle's map id is its crown seat's key - a
  crown city's castle is its own location's dungeon - so no map id is typed twice.
- **The service** (`server-account/src/castles.js`, a migration): `guild_castles` (the region, the guild, the castle's
  key, what was paid, the epoch, when). Buy (`/v1/castles/buy`): one batch, the guild holding the region's Charter and
  the buyer its Guildmaster, the silver there, no castle on the region. Give up (`/v1/castles/sell`). The release with
  the region is SETTLED ON READ: every castle read and every Turning first releases a castle whose guild no longer
  holds its region, its half home on a ledger line keyed by the castle row, so it happens once. The guild's view
  (`guilds.js`) carries its castles, `{ region, key, name, epoch }`.
- **The relay**: `instanceAdmission` grows a `guild` arm - a socket whose verified token names the guild whose digest
  owns the room - and a member who leaves the guild while inside is refused out at its next guild order, as a party
  member is at its party's. A relay version bump; `instanceRoom.js` is in its bundle.
- **The door**: the castle's dungeon door offers **"Your guild's castle"** to a member of its owner (`instancePlaces.js`
  instanceOffer, a `guild` row), beside the public castle.
- **Inside**: the throne room's pieces stand for the castle's guild in its instance, and in no other instance (today
  `crownHere` ignores the instance, so a quest's private castle stood the holder's banners too - fixed here).
- **The Guild window**: the Hall page's **Castle** section - a castle the guild may buy, its price and the treasury's
  silver, Buy for the Guildmaster; a castle held, Give up and both refunds said before the press.

## 7. DOMAIN3 - the region's Charter (planned)

- **The seat of power**: `systems/town/townSeats.js` names each region's (`seatOfPower`, over the seats it already
  derives, by `hubClaim`); the client reports its region's beside the seat it stands in (`POST /v1/seats/witness`
  grows `domain`), the service keeps it as a witnessed fact (`world_witness` kind `domain`, key the region) and
  `confirmedDomains()` answers region -> key, a key that is a confirmed seat of that region and, in a crown's region,
  the crown.
- **The law** (`townSeatLaw.js`): `domainsFrom(week, zero)` off `DOMAINS_WEEK`; the pledge's check (a region's Charter
  alone); `bailiwickOf` the region's Charter; the Watch's and the homes' places the region's seat towns; the Turning's
  plan unchanged in its numbers, read over the regions' Charters alone; the fold (above); the words.
- **The service**: every seat route reads the region's Charter where it read a seat (`seatInfluence.js` the pledge and
  the sources, `seatHolding.js` the Tithe, Levy and Bounty, `seatTurning.js` the settle and the fold); a migration for
  the gifts' and the fold's rows.
- **The client**: the board's Seat tab speaks of the region (the Charter, the standings, the holder, the works, the
  gifts); the map rings the seat of power and marks the region's other seat towns in the holder's colours; the arrival
  line; the members' discount by region.

## 8. DOMAIN4 - past the Bay (planned)

After World-Wide's regions (62-70) and TESA's capitals are on main: each province but Cyrodiil is a crown Charter
(`CASTLE_PROVINCES`), its capital its seat of power and its castle (`capitalPlaceId(k, 0)`), read from our own table -
the capitals are the port's places, not ARENA2's, so nothing is witnessed. Each capital's castle gains an interior and
a door (a crown castle's whole dungeon under the capital's own map id, `dungeon:m<capital>`), the siege field its
entrance; `seatRegionOk`, the pledge and the D1 CHECKs reach 69; no kingdom reaches a province (its crown is its
own). Cyrodiil holds no Charter and no castle - the open zone's (WW-C2).

## 9. The threats, and the answers

| Threat | Answer |
|---|---|
| A gift of looted, bought-with-gold or save-edited units | The Stores' spendable units alone (own and bought); the bag's counted units alone, by the `spend` order |
| A gift paid twice | Nothing is paid; a writ's delivery stays barred to the guild's own takers |
| A gift's influence counted twice | One row a gift; the influence keyed on it (`ref`) |
| A castle bought and kept after the region falls | Released on the next read of anything that reads it, and at every Turning |
| A guild's castle entered by a stranger | The relay's `guild` arm reads the token's verified guild; nobody else is admitted |
| A released castle's room key reused by its old guild | Its epoch is never offered again; the room admits only the guild its key names, nothing in it stands for a guild that holds no castle, and its memory lapses (`INSTANCE_TTL_MS`). Recorded, not closed: the relay holds no castle table |
| A region law that moves a live Charter by hand | `DOMAINS_WEEK` at a Season's start; the fold is one rule at one Turning |
| The provinces' laws written into the Bay's tables before World-Wide merges | DOMAIN4 waits on the merges; DOMAIN1-3 read the Bay's regions only |

## 10. The four hosts (THE FOUR HOSTS RULE)

| Host | DOMAINS |
|---|---|
| `scenes/world.js` | the board's gifts (DOMAIN1), the castle's door and pieces (DOMAIN2), the region's words and marks (DOMAIN3) - each through a module the host wires (HOST-SPLIT) |
| `scenes/worldModes.js` | the castle's throne room in its instance (DOMAIN2) - the dungeon mode that stands it |
| `scenes/dungeonContext.js` | FLAGGED, nothing to wire: the standalone dungeon has no guild, no board and no instance |
| `scenes/exterior.js` | FLAGGED, nothing to wire: the fixed-city bench has no online guild or board |

## 11. Coordination with the Tamriel lanes

- **World-Wide** keeps the seats, the homes and the town economy the Bay's "until WW7". DOMAIN4 is the seats' part of
  that: it waits on WW-R's regions and moves `seatRegionOk` and the seat tables' CHECKs itself; WW7 keeps the homes and
  the town economy.
- **TESA** stands the capitals. DOMAIN4 adds their castles' interiors and doors once #1184 is on main, reading its
  capitals' table (`world/tamrielCapitals.js`), never a second copy.

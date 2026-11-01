# Domains: regions, gifts and castles

The region layer over the seats (`Seats-Arc.md`). From the seat week `DOMAINS_WEEK` names, a guild holds a **region's
Charter**, kept at the region's seat of power; every other seat town of the region is its holding. Members give
fortification materials from their Stores to the region's stockpile or Siege Camp. The guild holding a crown region may
buy its castle as a private instance. Players meet it at a Notice Board's Seat tab, in arrival lines ("Ripmore, in the
Charter of Anticlere, held by the Silver Hand `<SH>`."), on the map and in the Guild window.

## How it works

**The seat of power.** Every client derives it (`src/systems/town/townSeats.js` `deriveTownSeats`, its `powers`): the
crown in a crown's region, else the seat ranking first by the region hubs' claim (`hubClaim`). Clients report it beside
the seat they stand in (`POST /v1/seats/witness`), and three agreeing confirm it
(`server-account/src/domains.js`, table `town_domain_witness`). A region's Charter is its confirmed seat of power that
is a confirmed seat of that region (`src/net/domainLaw.js` `domainSeats`, `charterSeats`). A region with none confirmed
keeps the per-seat law. Past the Bay each province is one crown Charter at its capital.

**When it rules.** `domainsRule`: from week `DOMAINS_WEEK` (`server-account/wrangler.toml`, `"6"`, Season 1's first).
Unset, the seat law stands.

**By region.** The pledge names a region's Charter alone (refused `seat-not-charter`). The Watch counts in any holding's
own pixel; homes count anywhere in the region, five a guild a region. The bailiwick is the whole region: every Notice
Board's Tithe, Levy and Bounty belong to its Charter, and members get the discount, Market Day, Curfew and Festival in
every holding. The siege and the Tourney are at the seat of power. The Turning before a region-law week folds every
Charter held at another seat of the region: its claim fee goes home (`domain-fold`), its stockpile and works' units move
to the Charter's stockpile, its Edict is void.

**Gifts** (`src/net/seatGiftLaw.js`, `server-account/src/seatGifts.js` `giveToSeat`, `POST /v1/seats/give`). Any member
of any rank gives fortification materials (`giftMaterialOk`; a Ram Kit to a Siege Camp only) from their Stores, bought
units first. The bag's counted units are put into the Stores before the gift. The gift goes to the guild's stockpile in
a region it holds, else to its Siege Camp where it pledged this week. It credits influence as a seat writ does
(`creditSeatWrit`): own units at their value, bought units at Tribute's rate inside Tribute's share, only for a counting
member, inside the account's weekly cap. The board shows the guild's last `GIFTS_SHOWN` gifts.

**Castles** (`src/net/castleLaw.js`, `server-account/src/castles.js`, `POST /v1/guilds/castle/buy`). A crown region's
castle - Castle Daggerfall, Wayrest and Sentinel on the Bay, and each province capital's but Cyrodiil's
(`CASTLE_MAP_IDS` in `src/net/instanceRoom.js`) - costs `CASTLE_PRICE` (120,000 Silver), burnt, and only the Guildmaster
of the Charter's holder buys it (`CASTLE_POWERS`). One guild owns a castle. When the Charter leaves the guild by any road
the castle is released at the next read and `CASTLE_LOST_SHARE` (half) goes back; given up while the region is held,
`CASTLE_SALE_SHARE` (85%) does. The castle is the guild's own instance, `dungeon:m<castle>.i<guild>.<epoch>`, its epoch
minted at purchase so a new owner walks into a fresh castle. The relay admits the guild's members and staff, never a
guest. It holds the throne room's guild pieces and the vault's hall shelf. The public castle stays the quests' castle.

## Rules

- Region control replaces the town seat as what is fought over: one holder and one siege a region, its towns its
  holdings (the owner).
- One owner per castle, paid in Silver, bought by the region's holder; losing the region puts it back on offer and
  refunds part of the price (the owner).
- Cyrodiil's Imperial City holds a Charter but never a castle (the owner).
- A castle never strengthens the defence; a siege is won in the field and at the Turning.
- A province is one Charter; World-Wide's areas are never a region on the wire.

## Code and tests

- `src/net/domainLaw.js` - the region law: when it rules, seats of power, Charters
- `src/net/seatGiftLaw.js`, `server-account/src/seatGifts.js` - gifts
- `src/net/castleLaw.js`, `server-account/src/castles.js`, `src/net/instanceRoom.js` - castles and their instance
- `server-account/src/domains.js`, `server-account/src/seatTurning.js` - the witness, the fold
- `test/net/domain1_gifts.test.js`, `test/net/domain2_castles.test.js`, `test/net/domain3_regions.test.js` - gifts, castles, region Charters
- `test/world/worldWide/ww7_castles.test.js` - the provinces' castles

## Open

- A town that is no seat has no Seat tab and gives no members' discount, though its board's Tithe, Levy and Bounty are
  the Charter's.
- A region whose seat of power is confirmed mid-week claims nothing that week at its holdings.
- A region's seat-of-power reports have no strike of their own.

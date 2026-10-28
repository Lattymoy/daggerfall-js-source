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
| DOMAIN1 | Gifts: a member gives fortification materials from their Stores and their bag to the guild's stockpile or Siege Camp in the region - the service's act, its record, the board's form and its words | BUILT (section 5) |
| DOMAIN2 | The castle: the law, the purchase, the release with the region, the guild's instance on the relay and at the door, the throne room's pieces in it, the Guild window's words | BUILT (section 6) |
| DOMAIN3 | The region's Charter: the seat of power's witness, the pledge by region, the bailiwick the region, the Watch and the homes region-wide, the Turning and every read by region from `DOMAINS_WEEK`, the fold, the words and the map | BUILT (section 7) |
| DOMAIN4 | Past the Bay, once World-Wide and TESA have merged: each province but Cyrodiil a crown Charter, its capital the seat of power (our own data - a table, never witnessed), the capitals' castle interiors and their siege fields; the regions' laws (`seatRegionOk` and the rest) to 69 | planned, waits on #1184 and World-Wide |

## 5. DOMAIN1 - a gift to the town (BUILT, 2026-10-24)

- **The law** (`src/net/seatGiftLaw.js`, pure and wordless, read by both ends): a gift is what a seat writ may ask
  (`giftMaterialOk` - `fortLaw.js` FORT_MATERIALS to either place, a Ram Kit to a Siege Camp alone), 1 to a whole
  Stores' units (`GIFT_UNITS_MAX` = `STORES_MAX`), and the board offers each material the giver holds with its Stores,
  its bag and the most one gift moves (`giftChoices`).
- **The act** (`server-account/src/seatGifts.js` giveToSeat, `POST /v1/seats/give` `{ character, region, material,
  units, rid }`). The service finds the place itself (`giftPlaceOf`): the seat the character's guild holds in `region`
  (its stockpile), or else the seat it pledged there THIS seat week (its Siege Camp). One batch whose first statement
  decides, as every act of the writs (PROF1's law): the character still a member, the place still the guild's (held;
  or pledged this week), the units spendable in its Stores (`spendableSql`: own and bought, never gold's or loose), the
  own share what the bought units cannot cover; then the Stores spent bought first (`spendStatements`), the stockpile or
  the camp filled, the row of the gift (`town_seat_gifts`, migration 0174 - 0167 before main's own took it - the record and the idempotence). After it,
  the influence is a seat writ's delivery's (`creditSeatWrit`, keyed `gift:<player>:<rid>`): own units at their value,
  bought at Tribute's rate inside Tribute's share, only for a counting member (seven days in the guild, its account
  fighting for it this week), and the answer says whether it counted (`counted`, `why`). The answer reads the
  stockpile through the works' own read (`seatForts.js` fortsOf), which moves what a building project needs into it
  first - so a gift to a seat raising its Walls is in the Walls at once, as a writ's delivery is.
- **The read** (`readGifts`, `POST /v1/seats/gifts` `{ character, region }`): where the guild gives there (`place`
  'stockpile', 'camp' or null), the seat's `key`, what the place holds and the guild's last five gifts there
  (`GIFTS_SHOWN`), newest first - a camp's this week alone. A read the Turning's settling still answers
  (`SEAT_READS`).
- **Refusals**: `bad-region`, `bad-units`, `bad-material` (not a fortification's material; a Ram Kit to a stockpile),
  `no-guild`, `seat-none-here` (worded: "Your guild neither holds a Charter in this region nor is pledged to a seat here
  this week, so there is nowhere here to give to."), `stores-short`, `stores-gold`, `writ-rate` (the writs' own
  bucket, 429), a held character's (`realmHoldOf`, JUDGE_STATUS), and the switches (`seats-closed`, `prof-closed`).
- **The board** (`ui/seatWorks.js` drawSeatGifts, `ui/seatTab.js`): at a seat's board, where the reader's guild gives
  AT THIS seat, a panel - **Give to the stockpile** or **Give to the Siege Camp** - says every rule before the press
  (who may give, what never goes, what comes back, what it counts), lists each material the place takes that the
  character holds ("Cut Stone: 30 in your Stores, 5 in your bag"), a count bounded by what it holds, and Give; a Siege
  Camp says what it holds ("The Siege Camp holds: 30 Cut Stone."), and the guild's last gifts stand under it ("Alda
  gave 40 Cut Stone."). Give puts the bag's counted units in the Stores first (`profBook.ensureInStores` by the
  `spend` order, the market host's own `putIn` - `ui/noticeWindow.js` hands the tab `giving` off the market's reads),
  then gives; the answer says what was given and whether it counted. The read is asked AT ONCE with the standings and
  the works (BOARD-UI's rule). The seats' book (`net/townSeatBook.js` gifts, give) keeps one request id a gift, as a
  project's, so a gift asked again after an answer that never came is one gift; and it tells the professions' book the
  Stores' count the gift answered (`stores`, `profBook.applyStore`), as a writ's delivery does.
- **Words**: seventeen strings through the text core (`seat.gift.*`, `account.refusal.seatNoneHere`), drafted
  in-session into the thirteen whole languages (`tools/l10nInSession.mjs`).
- **The four hosts**: `scenes/world.js` - the seats' book told the professions' book (`stores`, one entry) - and
  HOST-SPLIT: the seats' pixel set the host built by hand beside the book moved to `systems/town/townSeats.js`
  seatPixelTest, so bootWorld's ceiling came DOWN, 36,298 -> 36,297. `worldModes.js`, `dungeonContext.js` and
  `exterior.js` stand no Seat tab - FLAGGED, nothing to wire.
- **The Season**: Season 0's last Turning wipes the gifts with the stockpiles and camps they filled (`seatTurning.js`
  SEASON_ZERO_WIPED).
- **Pins**: `test/net/domain1_gifts.test.js` (8: the law; a gift by every rank, its stockpile, its influence, its
  request id; bought first, gold's and loose never, the material's law; the Siege Camp, last week's pledge, nowhere and
  no guild; the works take it, a new member counts nothing, the wipe; the switches; the book; the board). Mutants
  `tools/mutants/domain1.json` (19, all dead; a twentieth - the supply after the batch - survived, because the answer's
  own read supplies the works: the call was redundant and went, not the pin). PIN MOVED: `seat1b_client.test.js` (the
  host's pixel set to seatPixelTest, and its answer pinned), `season1_service.test.js` (the wipe), the service's version
  in twenty test files and `server-account/wrangler.toml`. Mutant records re-aimed by content (12, all dead): the versions', BOARD-UI's read order, the host's
  ceiling.
- **Version and deploy**: the account service `acct182` (acct181 on its branch, renumbered past KETCH's at the merge; migration 0167 - 0166 on its branch; `src/net/seatGiftLaw.js` in the account
  deploy's path filter). No relay change. DEPLOY ORDER: the account service, then the site. KETCH reached main first
  with acct181, world255 and migration 0166, and this branch renumbered past it at its merge; World-Wide's branch, which
  also took acct181 (WW-R), renumbers past acct182 at its own.

## 6. DOMAIN2 - the castle (BUILT, 2026-10-24)

- **The law** (`src/net/castleLaw.js`, pure and wordless): a castle is a crown region's (`castleRegionOk`,
  `CASTLE_REGIONS` - the Bay's 17, 20 and 23, read off `townSeatLaw.js` CROWN_SEAT_REGIONS; DOMAIN4's provinces), its
  map id its crown seat's key (a crown city's castle is its own location's dungeon - Castle Daggerfall is 1291010263,
  Castle Wayrest 630439035, Castle Sentinel 6634853, `dungeonTextures.js` MAIN_STORY_DUNGEON_IDS - so no castle's id is
  typed twice); **120,000 silver** (`CASTLE_PRICE`, one and a half crown claim fees); **85%** home given up while the
  region is held (`CASTLE_SALE_SHARE` - `homeLaw.js` HOME_SALE_SHARE, one home), **half** home lost with the region
  (`CASTLE_LOST_SHARE`); the Guildmaster buys and gives up (`CASTLE_POWERS`); the castles a guild may buy - each crown
  it holds whose castle nobody keeps (`castleOffers`).
- **The service** (`server-account/src/castles.js`, migration 0175 `guild_castles` (0168 before main's own took it) - one row a castle, keyed by its
  REGION, so a second buyer finds it taken in the very statement that would write it; a guild that goes takes its castles
  with it). **Buy** (`POST /v1/guilds/castle/buy` `{ character, region, rid }`): one batch whose first statement writes
  the row only where the buyer is still the Guildmaster, the guild still holds the region's crown Charter, no castle
  stands on the region and the silver is there; the burn written off the row's nonce (`castle`); the EPOCH minted there
  - four bytes of the service's own dice - and never again. **Give up** (`/v1/guilds/castle/sell`): the share home first
  (`castle-sale`, what the treasury has room for, never a line of nothing - a full treasury is refused `marks-full`, the
  castle kept; only while the region is still held), the row deleted off that line. **The release** (`releaseCastles`,
  SETTLED ON READ and at every Turning): every guild's view, every castle act and every Turning - a castle whose guild no longer holds its
  region's crown Charter, by any road, is released: half its price home (`castle-lost`, what the room allows), written
  off the row itself and the row deleted in the same batch, so it happens once. The guild's view (`guilds.js` viewOf)
  carries `castles` (`{ region, key, epoch, paid, boughtAt }`, every member's - the epoch the door keys its room by) and,
  to the Guildmaster, `castleOffers` (`{ region, key, price }`). Refusals: `castle-none`, `castle-not-held`,
  `castle-taken`, `castle-not-yours`, `guild-marks-short`, `guild-rank`, `seats-closed`, `marks-closed`, `bad-rid`,
  `guild-rate` (twenty an hour).
- **The room** (`net/instanceRoom.js`): a castle is an instance OWNED BY A GUILD - its owner the guild's digest
  (`instanceGuildOwnerOf`, `instance:guild:<id>`, a hash domain of its own, so no account's digest is ever a guild's),
  `dungeon:m<castle>.i<guild>.<epoch>`. `instanceAdmission` grows a `guild` arm, after staff and the owner: a socket whose
  VERIFIED token names the guild whose digest owns the room - A CASTLE'S ROOM ALONE (`CASTLE_MAP_IDS`, the three crown
  cities' own dungeons, whole; the service sells no castle at any other key, `castleLaw.js` castleKeyOk). A member's party guest is not admitted (the party arm asks
  the hub with the room's owner digest, which no account's party holds) - one owner a castle.
- **The relay** (`server/src/index.js`, world256, `GUILD_INSTANCE_RELAY_MIN`): `_instanceHello` hands the token's guild
  to the door, and a socket let in as the castle's guild is marked (`ig`, the guild it came in as). The moment its
  attachment wears another guild or none - a removal or a disbanding carried in, a join elsewhere, a shard's hello: every
  road writes the attachment through `_setAttach` - it is refused out (`_instanceGuildOut`, deferred so the write's caller
  finishes first, once a socket). AUDIT TESA III E2-4 (`01-Overview/audits/Audit-Tesa-III-E2.md`): `GUILD_INSTANCE_RELAY_MIN`
  is held to the LAW row of `test/net/relayversion.test.js` that names DOMAIN2 (`domain2_castles.test.js`), as the
  world-wide gates are to theirs - main's live world260 is THE FOLD, which admits no guild, so a renumber that left the
  literal behind would offer castles to relays that refuse their members.
- **The door** (`systems/instancePlaces.js` instanceOffer's `castle` row, `scenes/instanceDoor.js`): at the castle's
  dungeon door, where my guild keeps that castle and my relay admits a guild (`online.guildInstanceOk`), the popup offers
  **Your guild's castle** beside the public castle ("Enter the shared castle, or your guild's own? Only your guild's
  members can enter it."). A save, an anchor or a staff landing inside it goes back in while the castle is still my
  guild's at that epoch (`stillHeld`), else to the public castle whole.
- **The throne room** (`scenes/seatHallHost.js`, HOST-SPLIT - SEAT-HALL's and CROWN-HALL's halls moved out of bootWorld):
  the holder's banners, roster board and vault chest stand in the public castle as CROWN-HALL built them, and in the
  holder's own castle at the epoch its view names - and in NO other instance (`crown(mapId, instance)`; the modes host
  hands the room's `placeInstance`). Before DOMAIN2 a quest's private castle stood the holder's pieces too.
- **The Guild window** (`ui/socialPanel.js` guildCastleNodes, the Overview beside the hall): a castle kept - its door,
  what was paid, both refunds said before the press, and the Guildmaster's **Give up the castle**, pressed twice; a
  castle the guild's crowns may buy - its price beside the treasury's silver, **Buy Castle Wayrest**, held with its
  reason where the silver is short; with neither, what a castle is and how one is had. The silver ledger names a castle
  bought, given up and lost (`GUILD_SILVER_LINE_SAID`). Twenty-one strings through the text core, drafted in-session into
  the thirteen whole languages.
- **The four hosts**: `scenes/world.js` - the seat hall host made once and the door handed my guild's castle (bootWorld
  36,297 -> 36,280, the halls' dressing out); `scenes/worldModes.js` - the room's instance handed to the throne room's
  dressing, one argument on a line it had; `scenes/dungeonContext.js` and `scenes/exterior.js` - FLAGGED, nothing to
  wire: neither stands a castle online.
- **Recorded, not closed**: the relay holds no castle table, so a crown castle's room keyed by a guild's digest admits
  that guild at any epoch - a released castle's old key while a member keeps it, and a modified client's made-up epoch
  for a guild that keeps none: a private copy of a crown city's castle, never of any other room (AUDIT DOMAINS R2).
  Nothing in it stands for a guild that holds no castle (the throne room reads the service's castle), its epoch is never
  offered again, and its memory lapses (`INSTANCE_TTL_MS`). A member removed while inside, whose own client never carries
  the removal, stays until it leaves or its token's next hello. Staff inspecting a guild's castle see no throne room's
  pieces (they are no member), and the throne room asks the instance's epoch, not its owner (a quest's epoch matching
  one in 2^32).
- **Pins**: `test/net/domain2_castles.test.js` (10: the law; a castle bought; who may buy, the crown lost between the read
  and the write; goes with the region, the sale, the Season's wipe; the switches; the law of the room; at the relay - a
  member, another guild, no guild, a party guest, a member who leaves; the door; the throne room; the window's words).
  Mutants `tools/mutants/domain2.json` (20, all dead; a twenty-first - the release's own guard against a second line -
  survived, because the line is written off the row the same batch deletes: the guard was redundant and went). PIN MOVED:
  the relay's version in forty-three test files and the law's row (`relayversion.test.js` world255, world256 at the merge past KETCH), the schema's tables
  (`accountworker.test.js`), the faucets (`marks1.test.js`: `castle-sale` and `castle-lost`, silver home that a
  purchase burnt), the halls' source (`seathall_client.test.js`, `crownhall.test.js`: `seatHallHost.js`). Re-aimed by
  content: soc1's, CROWN-HALL's two and SEAT-HALL's two (the halls' host), HOST-SPLIT's ceiling, INSTANCES' two, SEAT2a2's
  attach and STAFF-PANEL5-HIDDEN's door (the hello's `att`, the door's `guild`) - each run again, dead.
- **Not built here** (section 3's "What it holds"): the vault's hall shelf while a guild keeps a castle
  (`GUILD_VAULT_HALL_SLOTS`), and the guild's banners at the castle's door in the city. The castle's throne room stands
  its guild's banners, roster board and vault chest; the shelf and the door's banners are open.
- **Version and deploy**: the relay `world256` (world255 on its branch, renumbered past KETCH's at the merge), the account service `acct182` (DOMAIN1's, one release; migration 0168;
  `src/net/castleLaw.js` in the account deploy's path filter). DEPLOY ORDER: the relay first (world256), then the account
  service, then the site. World-Wide's branch, which also took world255 and acct181, renumbers past world256 and acct182
  at its merge.

## 7. DOMAIN3 - the region's Charter (BUILT, 2026-10-24)

- **The seat of power, as every client derives it** (`systems/town/townSeats.js` deriveTownSeats `powers`, region -> key):
  the region's seat whose location ranks first - the crown first in a crown's region, then HUB1's own claim
  (`regionHubs.js` hubClaim), a seat whose kind claims no hub after every one that does, the lower key last. Measured on
  the freeware (2026-10-24): 322 seats, 39 regions, 37 seats of power their hub (Wrothgaria for Newing, Aldcester for
  Koegria the two that are not), 33 named for their region - section 1's count, derived the client's way.
- **The witness** (`server-account/src/domains.js`, migration 0180 - 0169, then 0179, before main's own took them): the client standing in a seat town reports, beside the
  seat (`POST /v1/seats/witness` `{ seat, domain: { region, key } }`, `net/townSeatBook.js` witness off the derivation it
  is handed), its region's seat of power; three agreeing confirm it, the seats' own witnesses (a registered account a
  week old, never one the seats' law ignores - `townSeats.js` seatIgnored), each first answer standing, and a report
  counted only where its seat's was and only for the region that seat stands in (`domain` the answer's word: `counted`,
  `agreed`, `bad-domain`, `not-counted`). A region's Charter is the confirmed seat of power that is a confirmed seat OF
  THAT REGION, the crown in a crown's (`net/domainLaw.js` domainSeats). DEPARTURE from section 3's "`world_witness` kind
  `domain`": its own table, `town_domain_witness` - `world_witness` names its kinds in a CHECK, and a new kind would
  rebuild the service's largest table (its lean column, triggers and indexes) for some hundred rows. An answer the
  region's confirmation already says is written only while fewer than a dozen do (`DOMAIN_AGREEING_KEPT`; AUDIT DOMAINS
  S3: kept at the bare three, one confirming witness lost - deleted, or ignored a week - left the confirmation to the
  first three dissenters), so the rows stay a dozen a region and the dissenters, read whole a minute an isolate
  (`DOMAIN_ROWS_KEPT_S`).
- **When it rules** (`server-account/wrangler.toml` `DOMAINS_WEEK = "6"`, `domainLaw.js` domainsWeekOf / domainsRule):
  seat week 6, Season 1's first. Safe whenever this merges: before 2026-11-01, Season 0's last Turning wipes every Charter
  and the law opens on an empty board; after it, the week's pledges at a holding claim nothing at its Turning, and any
  Charter a Turning since gave a holding folds at the next. Empty keeps the seat law.
- **The law** (`net/domainLaw.js`, pure): `charterSeats` - each region's seat of power, and every seat of a region with
  none confirmed (it keeps the seat law until it has one); `charterOf` - the Charter a seat is held under; `chartersMarked`
  - the seats' list's marks.
- **The service, by region** (each read `domainsFor` - no read at all where the law does not rule): THE PLEDGE a region's
  Charter alone (`seatInfluence.js` pledgeSeat, refused `seat-not-charter`); THE WATCH a tick in a holding's own pixel
  counted at its Charter (claimWatch); THE HOMES a counting member's home anywhere in the region, by the home's own
  region, five a guild a region as before - at a region's seat of power alone (a region with none confirmed counts its
  seats' own towns), and for every reader of a week's standings: the board, the Turning, a Tourney's dead heat,
  Tribute's room (gatherStandings' `domains`, AUDIT DOMAINS S1); THE BAILIWICK every Notice Board of a region with a seat of
  power its Charter's - the Tithe of a sale, an order filled and an auction closed (in a read or by the minute's clock),
  the Levy of a harvest, a Bounty's camp (`seatHolding.js` bailiwickSeats, the region law's week handed through
  `market.js`, `cron.js` and `professions.js`). A gate's kill, Renown, an Orc camp and a gift (DOMAIN1) already counted
  at the guild's pledged or held seat in the region, which is now its Charter.
- **The Turning** (`seatTurning.js` settleWeek, `domainsWeek` handed from the config through settleDueOnce and settleDue):
  a Turning that opens a region-law week claims a Charter at a seat of power alone, and FOLDS every Charter held at
  another seat of a region whose seat of power is confirmed - its claim fee home where it began this Season
  (`domain-fold`, the strike's refund), its coming Edict void, its building projects fallen, what they held and its
  stockpile moved to the region's Charter's stockpile, its standing works left on a town that is no Charter now, the
  Chronicle's `fold` line. Season 0's last Turning wipes instead and folds nothing. DEPARTURE from section 3's "at its
  first Turning ... Pledges made for that week at a seat that is not its region's seat of power move": the fold is the
  Turning BEFORE the first region-law week, so that week opens on Charters alone, and its pledges are made under the law
  - none is left to move.
- **The seats' list** (`/v1/seats/list`): `domains: { from, rule, seats: [[region, key]] }` where `DOMAINS_WEEK` is set,
  and, while it rules, each seat of power marked `domain` and each holding with its Charter's key (`charter`).
- **The client**: the seats' book dresses a holding in its Charter (`charterSeat`, as the list says it); a board's
  bailiwick is read among the Charters (`townSeatLaw.js` bailiwickOf skips a holding), so its Tithe is the Charter's; a
  holding's shops give the Charter holder's members their discount and its Market Day, its Curfew is the Charter's, its
  arrival says the Charter's news and takes its Festival, and its streets keep that Festival (`systems/seatEdicts.js`,
  `scenes/seatFestival.js`); the Seat tab at a holding's board speaks of the Charter, with a line saying so
  (`ui/seatTab.js`); the arrival - "Ripmore, in the Charter of Anticlere, held by the Silver Hand <SH>." - and the map's
  box name the Charter, and the map rings a holding in the Charter holder's colours. A seat of power's Charter is named
  for its region ("the Charter of Koegria"); every Charter's name goes through the text core now (`seat.charter.crown`,
  `.region`, `.town`), and nine strings were drafted in-session into the thirteen whole languages.
- **The four hosts**: `scenes/world.js` - the book handed the seats this client derived (`seats: townSeats`, in the
  entry that handed their pixels): no line added, bootWorld stands at 36,280; `scenes/worldModes.js` - nothing to wire;
  `scenes/dungeonContext.js` and `scenes/exterior.js` - FLAGGED, nothing to wire.
- **Recorded, not closed**: a town that is no seat has no Seat tab and gives no members' discount (its shops ask the
  town's own seat, and it has none) - its board's Tithe, Levy and Bounty are the Charter's; the Chronicle's lines are
  English sentences around a translated Charter's name, as they were; a region's seat-of-power reports have no strike of
  their own (a developer clears them in D1 by hand); a region whose seat of power is confirmed mid-week claims nothing
  that week at its holdings, where its guilds had pledged.
- **Pins**: `test/net/domain3_regions.test.js` (11: the law; the seat of power derived; the witness; the pledge; a
  holding's Watch and the region's homes; the bailiwick; the fold and the wipe; a holding's pledge at the fold and the
  list's word; the book; the words and the map; a holding under its Charter). Mutants `tools/mutants/domain3.json` (37).
  PIN MOVED: the faucets (`marks1.test.js`: `domain-fold`), the hard-coded English (`l10n4_hardcoded.test.js`: the seat
  law 180 -> 177, the Charter's names routed), the schema's tables (`accountworker.test.js`: `town_domain_witness`).
- **Version and deploy**: the account service `acct182` (DOMAIN1's and DOMAIN2's, one release - acct181 on its branch, renumbered past KETCH's at the merge; migration 0169 - 0168 on its branch;
  `src/net/domainLaw.js` in the account deploy's path filter). The relay is untouched. DEPLOY ORDER: the account service,
  then the site - an older page reports no seat of power, and its seats read as they did.

## 8. DOMAIN4 - past the Bay (BUILT as World-Wide's WW7-3 and WW7-4, 2026-10-25)

BUILT, with one change to the plan below: the seats reach everywhere (the owner: *"This needs to apply everywhere"*), so
Cyrodiil's Imperial City is a crown seat and Charter too (World-Wide.md WW7-3) - but never a castle (the owner, DOMAIN2:
"cyrodil excluded"): the White-Gold Tower's halls stand open to all (WW7-4). The regions' laws reach 70; each
province's castle is a Bay palace's halls under the capital's map id, `dungeon:m<capitalPlaceId(k, 0)>`, entered by its
palace's door. The plan as it stood:

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
| A castle bought and kept after the region falls | Released by every guild's view, every castle act and every Turning (`releaseCastles`), so no view, door or purchase ever sees it held, and a crown retaken unread keeps no castle |
| A guild's castle entered by a stranger | The relay's `guild` arm reads the token's verified guild, at a castle's room alone (`CASTLE_MAP_IDS`); nobody else is admitted; the door offers the castle at its dungeon's door alone |
| A released castle's room key reused by its old guild | Its epoch is never offered again; the room admits only the guild its key names, nothing in it stands for a guild that holds no castle, and its memory lapses (`INSTANCE_TTL_MS`). Recorded, not closed: the relay holds no castle table |
| A region law that moves a live Charter by hand | `DOMAINS_WEEK` at a Season's start; the fold is one rule, read at every Turning that opens a region-law week (a region confirmed late folds at its next) |
| A seat of power witnessed wrong - three colluding accounts, or a modded MAPS.BSA | The seats' own witnesses and ignored list; a dissent after the confirmation is written and disputes it; a region's Charter must be a confirmed seat of that region, the crown in a crown's. Recorded, not closed: no strike of its own |
| A holding's war counted at the holding | The pledge refuses it (`seat-not-charter`); its Watch, its homes and its board's Tithe, Levy and Bounty are its Charter's |
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

## 12. AUDIT DOMAINS (2026-10-24)

The owner: *"Audit this amd ensure perfection."* Three cold readers, each handed the code and not the author's view - the
account service's money and SQL, the relay's castle admission, the client - read DOMAIN0-3 at `184ad9254`, and probed
what they found; every finding was then traced by hand before a line moved. And the branch met main: KETCH had taken
world255, acct181 and migration 0166, so the merge renumbered this branch to world256, acct182 and migrations 0167-0169 (and TESA x MAIN II, the audit branch's merge of main into TESA, to world260, acct189 and migrations 0174-0176: main's STAFF-EVENT to PERK-TRIAL took world256-259, acct182-188 and migrations 0167-0173)
(every pin, the version mutants, the law's row, bootWorld's ceiling 36,387 -> 36,370 on main's count).

| | Finding | Verdict |
|---|---|---|
| S1 | The region's homes were counted on the board alone - the Turning, a Tourney's dead heat and Tribute's room read the seat's own town; and the board counted them at every seat of a region the law ruled, a seat of power or not | FIXED: gatherStandings is handed the week's seats of power, and counts the region's homes at a region's seat of power alone, for every reader |
| S2 | A castle was released by its own guild's read alone - a crown's new holder was offered nothing, and an old holder that retook the crown unread kept its castle | FIXED: every guild's view releases every castle first, and every Turning releases after its batch |
| S3 | The seat of power's confirmation rested on its bare three rows - one confirming witness deleted or ignored a week, and three dissenters flipped the region (a Turning in that week folded the real Charter away) | FIXED: agreeing answers kept to a dozen a region (`DOMAIN_AGREEING_KEPT`) |
| S4 | A castle given up with a full treasury answered 500 (a line of 0 broke the ledger's CHECK) | FIXED: never a line of nothing - `marks-full`, the castle kept |
| S5 | A purchase asked again after its castle was sold or released answered 500 | FIXED: the repeat is known by its burn line, which outlives the row |
| S6 | A castle act raced the Turning (a crown about to lapse bought at full price), and a sale raced the crown's loss (85% where the loss pays 50%) | FIXED: castle acts wait while another holds the Turning (`seats-settling`); the sale's decision asks the crown still held |
| S7 | The fold's target was read off the hold row's region, which a seat's witnesses may since have moved - an undefined target would fail every Turning after | FIXED: the registry's region, the one the Charters were read by |
| R1 | Every building door of a crown city offered the castle (a building's site carries its town's map id, the castle's), and opened a guild's copy of the shop | FIXED: a castle is offered at a dungeon's door alone |
| R2 | The relay's `guild` arm admitted any room a guild's digest owned - a modified client opened its whole guild a private copy of any dungeon or building | FIXED: castles' rooms alone (`CASTLE_MAP_IDS`), the service selling none at another key. RECORDED: any epoch of a crown castle's room (section 6) |
| R3 | The door asked the main link alone whether the relay admits a guild, where the instances ask the world link too | FIXED. RECORDED: a save in the castle loaded before the guild's view is read lands in the public castle |
| R4 | The throne room asks a guild castle's epoch and not its owner; staff see no pieces there | RECORDED (section 6): one in 2^32, and staff are no member |
| R5 | A socket already gone (a replacement's close) could be refused out a second time | FIXED |
| C1 | A holding's board raised a Harbour on its Charter by the holding's own coast - Alik'ra's built one at inland Berbaaqnia | FIXED: the Charter's own town's coast alone |
| C2 | The Seat tab's header and the map's box put a translated Charter's name in an English line | FIXED: `seat.info.held` / `.unheld`, the thirteen whole languages. RECORDED: the Chronicle's lines stay English sentences (section 7) |
| C3 | A sale asked again said "0 silver came home" | FIXED: the repeat carries `back` |
| C4 | A castle's row beside a quest and a full party made a tenth row no key chose | FIXED: nine rows at most (`INSTANCE_ROWS_MAX`) |
| C5 | The castle buttons' busy word, and the castle's and the Siege Camp's numbers, in English | FIXED: `social.guild.castle.wait`; numbers in the player's own grouping (`formatNumber`) |

Pins: `test/net/domain2_castles.test.js` (11 - the castle's holes; the door's nine rows, a shop's door, the castle's room
alone, a gone socket) and `test/net/domain3_regions.test.js` (11 - the dozen agreeing answers and the flip they stop; a
region with no seat of power; every standings reader; the fold's region; the Charter's coast; the info line). Mutants
`tools/mutants/audit_domains.json` (20, all dead); DOMAIN1-3's own sets run again after the fixes, and eleven records
re-aimed by content. One re-aimed record survived its run - SEAT2b-works-inland-port: SEAT2b's own test read an inland
board only with a reader who has no lever - and `test/net/seat2b_client.test.js` now reads it as the holder's
Guildmaster (no Harbour lever), which kills it.

## 13. Merged into TESA (#1184, 2026-10-25)

The owner: *"Before we tackle the city. Merge this branch into this PR"* - branch `ccr-74dc78a3-exdzju` (DOMAIN0-3 and
AUDIT DOMAINS, no pull request of its own) merged whole into TESA's (#1184), which already carried World-Wide's fold.
Both had taken the next numbers past KETCH, neither published, so they are one release - the precedent of SOUL-LAW and
ESSENCE-LOOSE ("one release"), not a renumbering. This supersedes the lines above that say World-Wide renumbers past
DOMAINS.

- **The relay** `world256`: World-Wide's, AUDIT TESA-BIOME's and DOMAIN2's laws in one bundle, re-hashed
  (`relayversion.test.js` world256 `51615558...`; DOMAINS' own `35cb323d...` and TESA's own `d1321ded...` recorded as
  unpublished). Every RELAY_MIN gate of the three stays at 256 (`GUILD_INSTANCE_RELAY_MIN`, `GATE_LANES_RELAY_MIN`,
  `PROVINCE_REGIONS_RELAY_MIN`, `WDUN_WORLD_RELAY_MIN`).
- **The account service** `acct182`: World-Wide's (WW2, WW-R, WW-C1) and DOMAINS' (DOMAIN1-3) in one release;
  migrations 0177-0179 (0167-0169 at that merge) are DOMAINS' alone (World-Wide wrote 0180, WW7-5's).
- **bootWorld** 36,202 on TESA's count less DOMAINS' 17 logical lines out -> 36,185 (`hostceiling.test.js`,
  `tools/mutants/hostsplit.json` re-aimed).
- **Pins**: every version pin both branches moved (69 files) now names both, "X (...) and Y (...), one release"; the
  version mutant records' notes name both.
- **DEPLOY ORDER** unchanged: the relay (world256), then the account service (acct182), then the site.

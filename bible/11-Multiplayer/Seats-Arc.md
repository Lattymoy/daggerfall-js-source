# THE SEATS ARC - guilds hold the Iliac Bay (SEAT0, the design record)

**Status: DESIGN RECORD, every question decided. Nothing of SEAT's own is built** - the two slices it stands on are:
MARKS1 (PROF0's currency) and NOTICE1 (PROF0's board) SHIPPED on the professions branch (AUDIT 28 corrected this line,
which said nothing was). Opened 2026-09-28. This page is the whole
design of guild town control - SEAT1 (holding a seat) and SEAT2 (sieges) of THE HOLDINGS ARC
(`06-Systems/Online-Arc.md`, "THE HOLDINGS ARC") - written out before a line of it is built. Its companion is
`06-Systems/Professions-Arc.md` (PROF0): the life skills, the materials, the Notice Board, the market and Marks.

## Mac's words

- "So the 3 main castle hubs should be larger capture points, while every other location with a palace (must have)
  will be a lower capture point"
- asked which palace locations: **"Every palace location"**
- asked what makes a castle seat larger (more cost and pay, bigger sieges, kingdom reach, rewards of its own): **"All
  of the above"**
- "Make sure we're documenting everything before building. You have some amazing ideas, so I want this to have
  insane depth, replayabiity and everything else."
- "If theres also sub systems (like life skills + materials) that can play a part, we can do that also. The sky is
  the limit"
- answering the first record: the currency **"New currency"**; one guild a week per account **"Yes"**; the Turning
  and the siege times **"Yes"**; the kingdoms **"You"**; the registry **"Figure it out"**
- "Life skills will utilize things like tree chopping, picking up ingredients, fishing, etc. Active player
  involvement and actual UI integration for life skills."
- "The new notice board should be a physical object that houses quests, the player auction house, etc"
- and last: **"I want you to make the decisions with the intent as being as detailed as possible."**

## How to read this page

| Mark | Meaning |
|---|---|
| **DECIDED (Mac)** | Mac's own word, quoted above. |
| **DECIDED** | The record's decision, made at Mac's instruction ("I want you to make the decisions"). Binding for the build slices; Mac may overrule any of it, and a slice that ships it records the change here first. |
| **FACT** | What the tree does today, read off the file named. |
| **MEASURED** | A number the design fixes now but a named measurement may move, with the rule that moves it. |

Every number lives in ONE pure law module, src/net/townSeatLaw.js (to be written), whose table is Appendix B -
so balance is an edit to one file, pinned by its own tests, never a hunt.

## 1. The laws this arc keeps

1. **ONLINE ONLY.** Offline Daggerfall stays Daggerfall Unity, 1:1 (`01-Overview/Port-Doctrine.md`). A seat is a
   Ledger A departure (`01-Overview/Port-Ledger.md` section A, its row added when SEAT1c ships), online's alone, as
   the hubs, homes and guilds are.
2. **THE COURT IS THE GAME'S.** A palace's ruler, court faction, quests and opening hours stay what DFU makes them
   (FACT: `npcSession` routes a palace NPC to the region's court; `buildingLocks.js` keeps type 16 open
   10:00-16:00). A guild never becomes the king. It holds the town's **Charter** - a royal writ granting a guild the
   keeping of the town - and everything a seat changes is layered over the game, never written into it.
3. **A SEAT IS DECIDED WHERE NO CLIENT CAN LIE.** FACT: almost everything online trusts the client - gold and items
   live in the save, Renown XP is client-reported (bounded, never verified; `server-account/src/renownTracks.js`), a
   duel is resolved by the defender's own machine (`src/net/duelSession.js`), and no pose is speed-checked
   (`validPose`, `src/net/wire.js`). A seat is a prize other guilds lose, so:
   - every influence source is **witnessed by a server** or **bounded** and worth less (4.2);
   - every siege is **refereed by the relay**, as the Oblivion Gate's boss is (`src/net/gateBrain.js`,
     `11-Multiplayer/World-Bosses.md`) - never by a fighter's client (6.1);
   - every scheduled moment is **a pure function of the clock**, as the gate's is (`src/net/gateLaw.js`);
   - every seat cost and payment is in **Marks**, the server's currency (PROF0 10.5) - never purse gold.
4. **DERIVED OVER ENUMERATED** (`server-account/src/titles.js`). Which locations are seats is read off the game's
   own data as the hubs are (`src/systems/regionHubs.js`); titles from a seat are derived from who holds it; **the
   week settles itself when first read after its boundary**, never on a cron (AUDIT-ACC F9, restated in
   `titles.js`: "a cron is a thing that can stop running while everything looks fine").
5. **NOTHING OF ARENA2 IS COMMITTED** ("a render of game data is game data"). Heraldry and devices are the port's own
   drawn art; banners, boards and map marks are drawn at runtime; the servers never hold game data (3.2).
6. **THE WORD "SEAT" IS TAKEN IN THE CODE** - ONE-SEAT (`src/net/oneSeat.js`; its `SEAT_ELSEWHERE` in `src/net/wire.js`), SEAT-HEAL, the
   party's kept seat. The player reads "seat"; the code says **`townSeat`**: `townSeatLaw.js`, D1 tables
   `town_seat*`, relay frames `{t:'tseat'}`, room keys `siege:`.

## 2. What already stands (FACT)

| Foundation | Where | What the arc uses |
|---|---|---|
| Region hubs, capitals | `src/systems/regionHubs.js` (HUB1), built at boot in `scenes/world.js` over MAPS.BSA's own rows | The boot pass over every location; `HUB_CAPITALS` = Daggerfall, Wayrest, Sentinel; base rows only (a world-data mod's rows never count) |
| Building records | `readBuildingData` (`src/formats/blocksFile.js`), `loc.exterior.buildings[]` | `buildingType` 16 is a Palace (`src/world/buildingNames.js`) - readable for every location without loading a block |
| Castles | `castleBlockAt` / `insideDungeonCastle` (`scenes/dungeonContext.js`) | Castle Daggerfall, Wayrest and Sentinel are RDB dungeon rooms (`dungeon:m<id>`) |
| Town furniture | `src/world/rmbLayout.js`: `BULLETIN_BOARD_MODEL_ID`, the city gate models | Banner anchors (3.4) and the Notice Board (PROF0 10.1) |
| Region names | `REGION_NAMES` (`src/formats/mapsFile.js`, DFU's own table, MIT) | The kingdom map's names and indices (4.3) |
| Guilds | `server-account/src/guilds.js`, `0013_guilds.sql`, `src/net/guildLaw.js` | 50 members; ranks 0 Guildmaster, 1 Officer, 2 Member, 3 Recruit; a gold treasury and its trigger-written ledger; `gi`/`gt`/`gm` on the signed token |
| Homes, decor, stations | `server-account/src/homes.js`, `decor.js`; `src/net/homeLaw.js`, `decorLaw.js` | One owner a building (map_id, building_key); `HOME_CAP` 3; entry private/party/public; stations for a licence |
| Renown | `renown_tracks` (0009), `src/net/renown.js`, `renownTracker.js` | Online level to 50, signed into the token (`lv`); client-reported XP, 5,000 a report, 20,000 an hour an account; no region recorded |
| The Oblivion Gate | `gateLaw.js`, `gateBrain.js`, `gateReceipt.js`, relay `_gate*`, `0014_gate_kills.sql` | Relay-refereed HP, reach, rate and damage buckets; phases; `r1.` Ed25519 receipts; the day's region from a pure shuffle bag |
| Duels | `duelSession.js`, `duelCombat.js`, `0008_duels.sql` | 1v1 on a ring 12 m in radius (`DUEL_RADIUS_M`), defender-resolved - so no duel can award anything the server keeps |
| Parties | the hub (`chat:world` Durable Object) | `PARTY_MAX` 8 |
| Rooms | `roomKeyFor` (`src/net/online.js`), `wire.js` | A town online is inside a 16x16-pixel cell room; `SOCKETS_MAX` 256; 32 nearest hear every pose; 8 full bodies drawn |
| The shared clock | `sharedClassicMinutes` (`wire.js`) | A game day is 2 real hours; the relay imports the same function |
| The server's voice | RED1 `/red`, EVENT1 `{t:'stage'}`, `/dm`, MOD1 `/mute` | Announcements; developer commands ride the dev glyph |
| Titles and glyphs | `titles.js`, `identityToken.js` `TITLES`/`GLYPHS` | Derived grants; new vocabulary reaches the relay first (the SHADOW-FANG order) |
| Factions | `factionRep.js`, `regionPower.js`, `worldTick.js` (WORLD6b) | Per player, client-side; only the dice are shared - so a seat never touches them |

What does not stand, and this arc builds: a region on a Renown report; any server record of where anything
happened; a guild's colours or device; guild entry to a home; any PvP referee; any speed check; a region-to-kingdom
table; the Marks currency (PROF0).

## 3. The seats

### 3.1 Which locations are seats

- **Crown seats** - DECIDED (Mac): **Daggerfall, Wayrest, Sentinel**. Each is a city in the overworld and a castle
  dungeon beside it; the city is fought over, the castle is the holder's hall.
- **Palace seats** - DECIDED (Mac): **every location with a Palace**, hub or not.
- **No palace, no seat** - DECIDED (Mac). A hub without a palace is still a hub (HUB1's ring), not a seat.
- **The derivation** - DECIDED, src/systems/townSeats.js (to be written), run in the same boot pass as
  `pickRegionHubs`, over the same rows:

```
for each region r, for each location l < MapsFile.baseLocationCount(r):
  if l.name is in HUB_CAPITALS and REGION_NAMES[r] === l.name  -> crown seat
  else if any(l.exterior.buildings, b => b.buildingType === BUILDING_TYPES.Palace) -> palace seat   (16)
  (one seat a location however many Palace records it holds; a capital is never also a palace seat)
seat = { key: unsigned mapId, name: l.name, region: r, kingdom: KINGDOM_OF[r], tier,
         pixel: (l.mapPixelX, l.mapPixelY), isHub: hubs.byMapId.has(mapId) }
```

- **How many** - MEASURED by **SEAT-COUNT**, tools/seatCount.mjs (to be written): it walks MAPS.BSA from
  `ARENA2_PATH` exactly as the boot pass does and prints every seat (region, kingdom, name, tier, hub or not, whether
  its blocks place a bulletin board, the pixel) and the totals. It writes nothing to the tree; Mac runs it. The
  economy is built so the count does not break it: every cost is per seat, and the influence a guild can earn is
  capped per account, not per seat, so twenty seats or two hundred leave the balance where it is.

### 3.2 How the servers know a seat without game data

DECIDED (Mac: "Figure it out"): **the witnessed registry**. The servers never hold ARENA2, so they learn seats from
the clients that derived them, and trust a seat only when enough of them agree.

- A client standing in a seat town online reports `{key, name, region, tier, pixel}` once a day to the account
  service (`POST /v1/seats/witness`).
- **Witnesses**: registered accounts at least **7 days** old. Guests and new accounts report nothing.
- A row is **confirmed** when **3 distinct witnesses** report it byte-identically. Only a confirmed seat gathers
  influence, can be pledged or claimed.
- **One dispute rule.** A report that disagrees with a confirmed row is **recorded, never obeyed**: the row keeps every
  effect. A row becomes **disputed** only when **2 distinct witnesses** report the same alternative byte for byte -
  one dissenter is a modded MAPS.BSA or a lie, and is counted, not followed. A disputed row **still keeps every
  effect it had** (a held Charter, a scheduled siege, a bailiwick, a node table) until a moderator rules, and goes on
  the audit list at once. An account whose disagreements match nobody else's three times has its reports ignored for
  a week.
- **Crown seats** must also match: tier crown, name in `HUB_CAPITALS`, region index 17, 23 or 20.
- **A fake seat wins nothing a player sees**: a client never draws, lists or honours a seat its own derivation lacks,
  and a seat's only income is Marks spent at its own town's boards, which nobody reaches in a town that does not
  exist.
- **The strike**: `/seat strike <key>` (the dev glyph, RED1's authority) removes a row and its history, and the
  strike is itself a history row.
- **The audit**: a seat confirmed by exactly three witnesses whom nobody else ever joins is listed in the service's
  weekly audit for a person to read.

Why not a committed table of map ids: a list read off MAPS.BSA is ARENA2's, and the doctrine keeps ARENA2 out of
the tree.

**The witnessed world.** The registry is not a seat's alone. Every fact the servers need that only ARENA2 knows is
learnt the same way - reported by the clients that derived it, confirmed by 3 witnesses who agree byte for byte,
disputed only by 2 who agree on another answer (the one dispute rule above) - in one table and one law (`world_witness`, keyed by kind and key):

| Kind | Key | What is witnessed | Who uses it |
|---|---|---|---|
| a location | map id | name, region, pixel, kind, whether it is a seat (and its tier), whether it has a Notice Board | the seats (3.1), the bailiwicks (7.2), the boards (PROF0 10.1) |
| a map pixel | x, y | climate, region | the nodes' tables (PROF0 6) |
| a gate day | game day | the gate's region and pixel | gate kills (4.2), gate-touched ground (PROF0 4.7) |

A disputed row keeps its confirmed worth until a moderator settles it - so no lone account can zero a rival's seat,
board or gate day; an unconfirmed row is worth the least its kind allows (PROF0 6). Three colluding accounts can forge one row - which is why each kind's reward is bounded and every
confirmation is on the audit list.

### 3.3 The Charter, the words, the map

- **The Charter**: "the Charter of <Town>" for a palace seat, "the Crown Charter of <Kingdom>" for a crown seat.
- **Arrival lines** (HUB1's five-second line, extended to every seat; Enhanced Plus's notice face):
  - held palace: "Anticlere, held by the Silver Hand <SH>."
  - unheld palace: "Anticlere. Its Charter is unheld."
  - held crown: "Wayrest, capital of the Kingdom of Wayrest, held by the Ebon Oath <EO>."
  - under siege this week: the line gains " A siege is called for Wednesday at 20:00." in the siege's own words.
- **The map** (the held map, the online map):

| State | Mark |
|---|---|
| Unheld palace seat | a hollow ring, stone grey `#8a8a8a`, under the town's glyph |
| Held palace seat | the ring filled with the holder's first colour and edged in its second |
| Crown seat | the same ring, and a crown above it in the kingdom's metal (Daggerfall azure `#3b6fd8`, Wayrest crimson `#b3262e`, Sentinel gold `#d4a017`) |
| Contested (5.2) | the ring split in two, the two contenders' colours |
| Siege week | the ring's edge burns - a slow orange-to-red pulse, one beat a second |
| A march region's seats (4.3) | a thin second ring in both crowns' metals |
| A free land's seats (4.3) | a thin green ring `#2f8f4e` |

The ring is drawn in HUB1's order (under the glyph, before any halo) and names are kept clear of it (`markReach`).

### 3.4 Banners and heraldry in the town

DECIDED (Mac, the Holdings plan: "the holder's banners and colours in the city").

- **The anchors**, derived from the town's own RMB layout (`src/world/rmbLayout.js`), at most 8 a town:
  1. one beside each city gate model (the gate's two posts, the banner on the town side);
  2. two flanking the palace's door (the building record's position and facing);
  3. one pennant above each Notice Board - a town's rumour boards, every board BOUNTY1 did not take for its bounty
     board (PROF0 10.1, `systems/bountyBoard.js` questBoardIndices; AUDIT 28: this said "each bulletin board");
  4. crown seats: two more at the castle's entrance in the city.
- **The banner**: the port's own cloth quad, 1 wide by 3 tall (in DFU's scale, a man's height and a half), its
  field the holder's first colour, a border in the second, the device centred; it sways on the weather's wind
  integral (the same wind the clouds and the grass read). An unheld seat's anchors carry the kingdom's plain banner
  (the crown's metal, no device); a free land's carry nothing.
- **Nothing offline**: offline the town is DFU's, with no banner.

## 4. Influence - the currency of a claim

Influence is counted **per guild, per seat, per week**, settled at the Turning (section 5).

### 4.1 The Pledge

A region may hold several seats, so a guild's work in a region needs a target.

- Each week a guild **pledges** to at most **one seat in each region**, in at most **5 regions** (a guild's reach).
- A pledge is set or moved by an Officer or the Guildmaster, from the board's Seat tab or the Guild tab, until the
  **Reckoning** (Friday 18:00 UTC, 5.1); then it is locked until the Turning.
- A guild holding a seat is pledged to it automatically and cannot pledge elsewhere in that region.
- Influence earned in a region with no pledge is not banked. A pledge is a choice every week: stack one town or spread
  across five.

### 4.2 The sources

| Source | Trust | Influence | Detail |
|---|---|---|---|
| **The Watch** | Relay-witnessed socket; the position is the client's own claim, so it is bounded | 1 per 2 minutes, capped **60 an account a day** | A registered member's socket in the seat's cell room whose pose lies in the seat's map pixel (FACT: a pose is an absolute world position inside `POSE_BOUND`; the relay maps it to its map pixel as `cellRoomOfWire` already does - x / `PIXEL_UNITS`, and 499 - z / `PIXEL_UNITS`, the map's y running the other way - with no game data; the registry carries the seat's pixel) and has moved in the last 5 minutes (a pose carries no rest state, and a resting player does not move). A client can lie about where it stands; the daily cap is what bounds the lie (420 a week, a fifth of an account's cap) |
| **Gate kills** | Relay-signed receipt; its region witnessed | **300** a receipt | An `r1.` receipt claimed with the region the fighter's client derived for that day. FACT, the rhythm: a gate rises every game day (`GATE_EVERY_DAYS` 1), which is every **2 real hours** - twelve a real day, drawn from a shuffle bag of some forty regions - so a region sees a gate about **twice a week**. FACT: the gate's region is NOT a pure function of the day alone - `pickGateRegion(day, regions)` (`src/net/gateLaw.js`) draws from `gateRegions(scan)`, a client-side scan of MAPS.BSA (`src/systems/gateSite.js`) - so the service takes the day's region from the claims themselves: the region at least **3** of that day's receipts agree on. A claim naming another region earns nothing. **Attribution**: a receipt counts for the week holding its game day, only if claimed before that week's Turning (receipts live 7 days, so none is banked for a later week), and for its account's war-guild (a receipt names an account, not a character); at most **900 an account a week** (three receipts) |
| **Writs** | Service-witnessed | **1 per Mark of the materials' value** | Materials delivered from the Stores to the seat's stockpile at its board (PROF0 section 11): to the holder as defence, to a pledged challenger as its Siege Camp. The **value** is the delivered materials' Marks value by PROF0 4.8's table - never the writ's pay, so a guild paying itself mints no influence. **Only** a delivery by a character 7 days in the posting guild, whose account is bound to it for the week, counts, and only its **own** units (PROF0 7: harvested or crafted by that character, Essence from a provenance item it made, a Siege Honour's Spoils, or its own deposit withdrawn from the guild Stores); **bought** units count at Tribute's rate inside Tribute's cap; a counter's goods never count. Anyone else's delivery earns the pay alone and binds nobody's war |
| **Homes** | Bounded, not witnessed | **25 a home a day**, at most 5 homes a guild a seat | Members' homes in the seat's town (`homes.map_id`). FACT: `homeLaw.js` checks only the ranges of the map id and building key, and a home is bought with save gold, so a modified client could register homes that do not exist; the cap (875 a week) is the defence, and a home counts only for a 7-day member bound to the guild |
| **Renown in the region** | Client-reported, bounded | **1 per 20 Renown XP**, capped **400 an account a week** | The Renown report grows `region` (0-61); the service keeps a per-account, per-region, per-week sum beside the tracks |
| **Tribute** | Service-witnessed (Marks) | **1 per 10 Marks**, capped at **20%** of the guild's week at that seat | Marks from the guild's Marks treasury, spent on the pledge by the Guildmaster, and **burnt** - a sink: the town's favour is bought, and nobody pockets it |

- **Per-account caps**: one ACCOUNT contributes at most **2,000 influence a seat a week** from all sources, whatever
  number of its characters play (the Watch and Renown caps above are per account too). A cap per character would be
  multiplied by an account's characters in one guild - fifty characters at Renown's 400 is 20,000 influence a week.
- **Per-account war** - DECIDED (Mac: "Yes"): the first guild an account's character contributes to in a week is
  that account's guild for the week's seats; its other characters earn nothing toward any other guild's seat that
  week, and cannot fight in any other guild's siege or as a sellsword against it. Membership stays per character
  (GUILD1: "Per character"); only the war is per person.
- **A new member waits**: a character who joined a guild within the last **7 days** contributes nothing to its seats.
- **Legacy**: at the Turning, **10%** of a guild's influence at each seat it pledged carries into the next week.
- **The stockpiles are spent once**: at the Turning a challenger's **Siege Camp** is spent - its siege works (a Ram
  Kit) go to the siege it won, and everything else is burnt; a camp that won no Right of Siege is burnt whole. The
  holder's stockpile is spent by its fortification projects. Nothing is ever withdrawn, so a unit raises influence
  once.

### 4.3 The kingdoms, the Marches and the Free Lands

DECIDED (Mac: "You"). FACT, why drawn and not derived: nothing in the tree maps a region to a kingdom, and DFU's
`borderRegions` (`BORDER_REGIONS`, `src/systems/factionRelations.js`, transcribed 1:1) is not laid out in region
order - its row commented "Daggerfall" is its eighth and names Betony, Tulune, Glenpoint, Shalgora and Ilessan Hills
(Daggerfall's real neighbourhood), while its eighteenth row, Daggerfall's index in `REGION_NAMES`, names Alcaire's.
So the map is drawn from the Iliac Bay itself - High Rock north of the bay, Hammerfell south - using the labelled
rows where they agree, with `REGION_NAMES`' own indices:

| Kingdom | Regions (index) |
|---|---|
| **Daggerfall** - western High Rock | Daggerfall (17), Glenumbra Moors (59), Tulune (58), Ilessan Hills (60), Glenpoint (18), Shalgora (42), Daenia (41), Northmoor (32) |
| **Wayrest** - eastern High Rock | Wayrest (23), Menevia (33), Alcaire (34), Koegria (35), Bhoriane (36), Kambria (37), Dwynnen (5), Phrygias (38), Urvaius (39), Ykalon (40), Gavaudon (57) |
| **Sentinel** - Hammerfell | Sentinel (20), Alik'r Desert (0), Dragontail Mountains (1), Dak'fron (11), Abibon-Gora (43), Kairou (44), Pothago (45), Myrkwasa (46), Ayasofya (47), Tigonus (48), Kozanset (49), Satakalaam (50), Totambu (51), Mournoth (52), Ephesus (53), Santaki (54), Antiphyllos (55), Bergama (56), Cybiades (61) |
| **The Marches** - claimed by two crowns | Betony (19): Daggerfall and Sentinel, the quarrel Daggerfall's own story is fought over; Anticlere (21): Daggerfall and Wayrest; Lainlyn (22): Wayrest and Sentinel |
| **The Free Lands** - no crown's | Isle of Balfiera (9): the Direnni's; Orsinium Area (26) and Wrothgarian Mountains (16): the Orcs' |

The regions left out hold no seat: seventeen hold no location at all (the wildernesses, coasts and generic villages),
and the eighteenth - region 31, the High Rock sea coast - holds only Mantellan Crux and the two "Your Ship" moorings
(FACT, `travelMapWindow.js`'s own correction), none of them with a Palace.

BUILT (PROF2, 2026-09-28): this table is `src/net/kingdomLaw.js` - the one home both ends read (`kingdomOf`,
`isMarch`, `isFreeLand`); the professions' signatures and Marches read it first (`06-Systems/Professions-Arc.md` 23),
and the seats' slices will read it rather than draw it again.

- **Kingdom reach** - DECIDED (Mac, "All of the above"): a guild holding a crown seat earns **+25%** on every source
  but Tribute at the palace seats of that kingdom.
- **The Marches**: each claiming crown's holder earns **+12.5%** there; a guild holding both claiming crowns earns
  +25%.
- **The Free Lands**: no crown reaches them; instead every guild earns **+10%** there from the Watch (a free town
  welcomes whoever lives in it), and no Conscription (7.6) or vassalage (7.8) touches them.

### 4.4 A worked example

The Silver Hand (24 members) pledges Anticlere (a march) and holds the Crown of Daggerfall. In one week, 14 members
patrol the town an hour a day for five days (the Watch: 14 x 30 x 5 = 2,100), three of them are at the one gate that
rose in Anticlere's region when it falls (3 receipts x 300 = 900), members deliver 900 Marks' worth of timber and
stone they felled and quarried themselves to their Siege Camp (900), they keep three homes there (3 x 25 x 7 = 525),
earn 60,000 Renown XP there between them (3,000, under the 400-an-account cap), and pay 400 Marks of Tribute (40).
Before reach: 7,465. The march gives Daggerfall's holder +12.5% on all but Tribute, rounded down: 7,425 x 0.125 =
928, so **8,393**, above the palace claim threshold (6,000). No account hit the 2,000 cap.

## 5. The week - the Turning

### 5.1 The cycle

DECIDED (Mac: "Yes"). A seat week is a real week (the game week, 14 real hours, is far too fast for a war). FACT,
`ONLINE_EPOCH_MS` is Monday 2026-09-14 00:00 UTC, so seat week n begins at `ONLINE_EPOCH_MS` + 6 days 18 hours + n
weeks: the first Turning fell on Sunday 2026-09-20 at 18:00 UTC.

| Phase | When (UTC) | What happens |
|---|---|---|
| **Muster** | Sunday 18:00 to Friday 18:00 | Influence accrues; pledges may move; windows may move (6.3) |
| **Reckoning** | Friday 18:00 to Sunday 18:00 | Pledges lock; influence still accrues; the standings are public on every board |
| **The Turning** | **Sunday 18:00** | The week settles (5.2) |
| **Siege days** | the seven days after a Turning that named a challenger | The siege, in the holder's window (6.3) |

### 5.2 What the Turning decides

The Turning is never a job that runs. The account service settles week N **the first time anything asks about any
seat after N's boundary** (`settleWeek(N)`, one D1 transaction, idempotent on `town_seat_weeks.week` - a second
reader finds it settled). The order is written out, so nothing depends on which seat is read first:

1. **Totals.** Every guild's influence at every confirmed seat it pledged, after its caps (4.2) and reach (4.3).
   **Ties** anywhere below break by higher Legacy, then the earlier pledge, then the lower guild id.
2. **Unheld seats, in key order.** The guilds that passed the **claim threshold** (palace **6,000**, crown
   **30,000**), ranked.
   - If the second of them is within **10%** of the first, nobody takes it: the seat is **Contested**, and the coming
     week has a **Tourney** between the two (6.7). A guild below the threshold never makes a seat Contested.
   - Otherwise the first whose Marks treasury can pay the **claim fee** (palace **8,000**, crown **80,000**) takes the
     Charter; one that cannot pay passes to the next that passed. None: the seat stays unheld.
3. **Held seats - the defence.** The holder's **defence** =
   own influence at the seat this week x (1 + Standing's modifier, 7.3) x (1 - Overreach's defence cut, 7.1)
   x (1.2 if the holder held its last siege or won it by forfeit, 6.5, 6.8) + half its liege's kingdom reach on its own
   influence if it is a vassal (7.8) + its Legacy.
   No fortification changes defence (they change the battle, 7.5).
4. **Rights of Siege, one pass for the server.** Every (guild, held seat) pair where the guild passed the claim
   threshold AND exceeds the defence is a candidate. Sort all candidates by influence, highest first (ties as step 1),
   and walk the list: a pair is granted when neither the seat nor the guild has a Right yet. So each guild wins **at
   most one Right of Siege a week**, at its strongest seat, and a seat's Right falls to the next challenger in line
   when its top one is taken elsewhere. A seat with no grant is **held unchallenged**: Standing +5.
5. **Upkeep.** The holder's Marks treasury pays the week's upkeep (7.1). A treasury short of it puts the seat in
   **Neglect**: Standing -10 and one week's grace; a second short week lapses the Charter.
6. **Truce.** A seat that changed hands at this Turning or in this week's siege cannot be challenged at the next
   Turning.
7. **Legacy and clear.** 10% of each guild's influence at the seat carries (4.2); the rest is cleared; the Siege Camps
   are spent (4.2).
8. **The schedule.** Every battle the settle made - sieges, Tourneys, and revolts due (7.7) - is placed (6.3) so no
   guild has two at once.
9. **The record.** Every result is a `town_seat_history` row (9.2) and a notice on the seat's boards and the hub.

## 6. Sieges (SEAT2)

DECIDED (Mac, the Holdings plan): "the top challenger meets the holder in a scheduled team battle at the seat, built
on the duel ring"; (Mac, "All of the above") crown sieges are bigger.

### 6.1 PVP-REF - the refereed blow

FACT: no server sees a blow between players today, and "a client's damage claim is applied as sent"
(`11-Multiplayer/Multiplayer.md`). So SEAT2 waits on **PVP-REF**, built from the gate's law, which already
referees up to 256 fighters against one foe.

- **Siege vitality** - DECIDED: in a siege room the RELAY holds every fighter's vitality, and it is normalised:
  **300 + 2 x Renown level** - from 302 to 400. The level is the account service's signed number; its XP is
  client-reported but rate-bounded (20,000 an hour an account, FACT `renownTracks.js`), so an inflated level is a slow
  lie - some 116 hours at the cap to reach 50 - and the formula is flat on purpose, so even a lie buys about a third
  more vitality at most (400 against 302). A siege never touches the save's health, items or gold (DECIDED): a fallen
  fighter respawns (6.2), and leaves the room as they entered it.
- **The blow** - a claim `{target, weapon kind, material, spell?}`. The relay accepts it when: both are alive; the
  target's last pose is within the weapon's reach (DFU's effective melee reach, imported - `WEAPON_REACH`, 2.5 m:
  `DEFAULT_WEAPON_REACH` 2.25 m, WeaponManager.cs:35, plus the sphere cast's radius, `src/combat/playerWeapon.js`;
  bows 60 m) plus `POSE_SLACK`; the
  striker is under **4 blows a second** (the gate's `GATE_HIT_HZ_MAX` shape); and the damage is within the weapon
  kind's bucket - DFU's own damage range for that weapon at that material, doubled for a critical, never more
  (the table lives in src/net/siegeRef.js (to be written), generated from `WEAPON_MATERIALS` and the weapon templates). Excess is
  clipped, as the gate clips it.
- **Spells** - at most **3 damaging casts in 5 seconds**, each clamped to **60** damage; Teleport, Recall and
  Levitate do nothing in a siege room; healing a side-mate is allowed (ALLY-CAST's frame), clamped to **40** a cast.
- **Speed** - the relay refuses a pose further from the last than **12.5 m/s** plus 0.5 m, and pulls the fighter
  back to the last good pose. MEASURED: 12.5 is the starting ceiling; PVP-REF measures the fastest legal run the
  motor allows with every Speed buff and sets the ceiling 25% above it. Horses are dismounted on entry.
- **Measurement gate** - MEASURED: PVP-REF's slice must run **a full room** - 40 fighters, 60 spectators and 6
  relay-run guards (a crown siege at its largest; a revolt's 13 rebels stand in the guards' place) - with headless
  clients, the SLAM probes' way, at or under 60% of every room budget (`FOES_ROOM_BYTES_PER_S`, `HIT_ROOM_BYTES_PER_S`, the pose fan).
  If it cannot, siege sizes drop to 8 against 8 and 16 against 16 until it can.


### 6.2 The battlefield

- **The room**: `siege:<key>:<week>`, admitted only in its window (gateLaw's pattern), only to the two sides'
  signed-up fighters and to spectators (6.6). The town streams as it does for everyone; the room is separate so the
  cell's ordinary traffic and the siege never share a budget.
- **Camps**: the attackers' outside the city gate farthest from the palace; the defenders' at the palace door.
- **Palace seat** - three **Banners** and the **Throne**:
  - the banner points: the **Gate** (the attackers' nearest city gate, inside it), the **Market** (the bulletin
    board nearest the town's centre), the **Temple** (the Temple building's door; if none, the largest guild hall's);
  - **raising a banner**: stand within **8 m** with no living enemy there; **20 seconds** raises it; a contested
    point freezes; an abandoned half-raised banner falls back at 1 second a second;
  - **the Throne** (the palace door) opens to the attackers while they hold **2 of 3** banners; holding it
    uncontested for **120 seconds** (progress decays 1 s/s while not held) takes the seat;
  - **time**: **30 minutes**; at time, the holder keeps it.
- **Crown seat** - four banners (Gate, Market, Temple, and the **Palace** square), the **Gatehouse**, and the Throne:
  - the **Gatehouse** stands at the castle's entrance in the city: vitality **20,000**; a blow deals a tenth of its
    damage to it; a crewed **Ram** (PROF0, Carpentry) deals **500 every 10 seconds** while two attackers stand
    within 3 m of it; a side may field one Ram at a time, and a destroyed Ram (vitality 3,000) is gone;
  - the Throne (the castle entrance) opens while the attackers hold **3 of 4** banners AND the Gatehouse is
    breached; **180 seconds** takes it;
  - **time**: **45 minutes**.
- **Respawns**: in waves, every **20 seconds** (palace) or **30** (crown), at the side's camp, with **3 seconds** of
  protection.

### 6.3 Scheduling

- **The holder's window** - DECIDED (Mac: "Yes"): the holder sets a standing window on the board - a day from
  **Wednesday to Saturday** and a start hour, **16:00 to 02:00 UTC**, two hours long. A start from 00:00 to 02:00
  belongs to **the night after** the named day ("Wednesday 01:00" is Thursday 01:00 UTC), so the earliest siege,
  Wednesday 16:00, is exactly 70 hours after the Turning and the latest ends Sunday 04:00 - a challenger always has
  three days to sign its side (a Sunday-night window would let a holder win by the challenger's absence). **The window
  in force at the Turning is the one the siege keeps**; a change made in the Muster applies from the next Turning. A
  holder that never set one gets **Wednesday 20:00 UTC**.
- **No guild fights twice at once** - the settle's schedule (5.2 step 8): battles are placed in key order; one that
  would overlap another battle of either of its guilds (a siege, a Tourney, a revolt, a crown slot) moves to the next
  two-hour start in the Wednesday-Saturday range that clashes with nothing, and its announcement says so. A **Tourney**
  takes Wednesday 20:00 and moves the same way; a **revolt** takes the holder's window.
- **Crown sieges** - DECIDED: **Saturday**, Daggerfall at **20:00**, Wayrest at **21:00**, Sentinel at **22:00
  UTC**, whatever the holder's window - three marquee battles an hour apart, so one guild is never asked to fight two
  at once.
- **Announcements** - in the server's voice (RED1's red text, and EVENT1's welcome record for late joiners), at the
  Turning and 24 hours, 1 hour and 5 minutes before:
  "The Silver Hand <SH> has won the Right of Siege at Anticlere. The Ebon Oath <EO> holds its Charter. Battle is
  joined Wednesday at 20:00 UTC."

### 6.4 Sides and sizes

- DECIDED: **palace 10 against 10; crown 20 against 20** (subject to 6.1's measurement).
- **Signing**: each side's roster is signed on its board's Seat tab from the Turning until 10 minutes before the
  start - **members** who had been in the guild **7 days at the Turning** and whose account was bound to it (4.2) in
  the week that won the Right, and whose account is bound to no other guild in the week the siege is fought (the
  signing binds it); then **Sellswords**: up to **2** (palace) or **4** (crown) non-members hired by the
  Guildmaster under a contract (an optional Marks fee, escrowed, paid at the siege's end). A sellsword's account may
  not be in either guild, may serve only one side a week (4.2), and may not have fought for the other side's guild
  in the last 4 weeks.

### 6.5 No-shows

- **Defenders absent** - the attackers still raise the banners and hold the Throne for its full time.
- **Attackers absent** - nobody from the attacking side in the room **10 minutes** after the start: a forfeit.
  The holder gains Standing +10 and its next defence +20%; the challenger's influence at the seat is cleared and it
  may not challenge this seat at the next Turning. A forfeit against the same challenger grants Standing only once a
  Season.
- **Both absent** - the holder keeps the seat.

### 6.6 Spectators

Up to **60** spectators may enter a siege room: no body drawn to fighters, no collider, excluded from every banner
count, a free camera over the town. Wars are theatre.

### 6.7 The Tourney (a Contested unheld seat)

The same battlefield with no holder and no Throne, the two contenders only, **20 minutes**, at Wednesday 20:00 (moved
as 6.3 says): the side holding more banners at the end takes the Charter and pays the claim fee; a dead heat goes to
the higher influence. A winner that cannot pay the fee passes the Charter to the other if it can; if neither can, the
seat stays unheld.

### 6.8 What a siege gives

| Result | Winner | Loser |
|---|---|---|
| Attacker takes the seat | the Charter (Standing starts at 50); the Truce; the fortifications, each one tier down (7.5) | the Charter lost; its Legacy at the seat cleared |
| Defender holds | Standing +15 and next Turning's defence +20% - **only if the attackers raised at least one banner** (a siege nobody fought is not a victory) | influence at the seat cleared; cannot challenge it at the next Turning |

**Siege Honours** - the same two guilds earn Honours from battles with each other **once a Season** (a friendly
pair cannot stage a weekly siege for Marks and Spoils). Every fighter who stood half the siege or felled a foe earns a
signed receipt (`s1.`, the gate's
Ed25519 shape), claimed at the account service: **50 Marks and 2,000 Renown XP** on the winning side, **25 Marks and
1,000 Renown XP** on the losing side, and one roll on the **Spoils of War** table (PROF0 4.7: a rare material only war
yields - Warforged Steel ingot, a Standard-bearer's silk, a Siege-cracked gem).

## 7. Holding a seat

### 7.1 What a seat costs

| Cost | Palace | Crown |
|---|---|---|
| Claim fee | 8,000 Marks | 80,000 Marks |
| Upkeep a week | 2,500 Marks | 15,000 Marks x the server's scale |

- **The crown's scale**: a crown's upkeep is multiplied by `min(1.5, max(0.4, active / 100))`, where `active` is the
  number of accounts that played online in the settled week (the service counts them). The economy model (Appendix
  C) found a fixed 15,000 starves a crown on a server of fifty players and is trivial on one of three hundred;
  palace upkeep needs no scale, because the number of seats held already grows with the server.

- **Overreach** - DECIDED: no hard cap on seats. A palace weighs **1**, a crown **3**; a guild's **extra** is its
  seats' total weight less its heaviest seat's. Every seat it holds pays upkeep x (1 + **0.25** x extra) and defends
  at x (1 - **0.05** x extra) - added, not compounded. So a lone crown or a lone palace pays no Overreach; a crown and
  a palace, extra 1 (+25% upkeep, -5% defence); two crowns, extra 3. An empire
  is possible, and it pays for itself only if it is loved (Standing) and built (fortifications).

### 7.2 What a seat pays

- **The Tithe** - a cut of the Marks that change hands at the seat town's Notice Boards: **a share of each sale's
  price taken from the seller's proceeds**, and the same share of the courier fees paid there (PROF0 10.4; a writ
  has no fee). The holder
  sets it: palace **0-10%**, crown **0-15%**, whole percents, changed at most once a week; it lands in the holder's
  Marks treasury. The **buyer always pays the listed price**; the seller receives the price less the burnt 5% sales
  tax and the Tithe (PROF0 10.4).
- **The bailiwick** - where the Tithe reaches. Every Notice Board in a region that holds at least one seat belongs
  to exactly one seat: **the seat nearest it in that region** by map-pixel distance (ties to the lower key), derived
  from the witnessed world (3.2) - so a seat's bailiwick is its own town and every ordinary town nearer to it than to
  any other seat of the region. A listing or a courier paid at any board pays that board's seat's Tithe;
  there is no untaxed board in a seated region, so no seller escapes a Tithe by walking to a village. What remains is
  choice between seats: in a region with two seats a seller may list at either's boards, so a greedy Tithe empties
  its own bailiwick into its neighbour's. A region with no seat has no Tithe at all. Conscription (7.6) and a vassal's
  tribute (7.8) are shares of this same Tithe, so they reach as far.
  Gold purchases (homes, licences, decor) are the save's and are never tithed: a Mark minted from gold a client may
  not have had is the hole Marks close.
- **Members' discount** - **10%** at the seat town's shops (**15%** at a crown seat), **+5%** while Standing is 80 or
  more; applied on the member's own client as **a multiplier of its own where the shop's `calculateCost` is called**
  (the trade and repair windows in `scenes/worldModes.js`), for that town only - never through `regionPriceAdjustment`
  (`shopStock.js`, ECON1), a region-wide index that also sets quest gold. Their own gold, nothing to cheat but
  themselves.
- **The hall** - DECIDED (Mac, the Holdings plan): the palace interior is the holder's guild hall. The court stays
  where DFU stands it. The holder gains: the **Charter Room** - the palace's largest room, decorated by Officers
  with DECOR's catalogue (at most **100** pieces, DECOR's gold a placement); the guild's roster board; the guild
  Stores chest (PROF0 section 7). Crown: the castle is the hall (DECIDED (Mac)) - its throne room carries the
  holder's banners, the roster board and the Stores chest, and **no decor**: FACT, the decorator stands only in a
  building interior the host names (`src/ui/decorPanel.js`: "their online home, or their own house or ship"), and a
  castle is an RDB dungeon room that DFU's main quest itself walks through, so nothing placed may stand in it.
- **The Charter Room's rule**: the decor tool refuses a piece within **2 m** of any NPC or quest marker the palace's
  layout places, so no decoration can stand on a questor's spot.

### 7.3 Standing - the town's favour

Every held seat has a **Standing** from 0 to 100; a new Charter starts at **50**.

| Raises it | Lowers it |
|---|---|
| Tithe at or below half its cap: +2 a week | Tithe above three quarters of its cap: -3 a week |
| Held unchallenged at a Turning: +5 | A week with no Watch minutes from the holder's own members: -5 |
| A gate felled in the region (a witnessed receipt): +2, at most +6 a week | |
| A siege held: +15 | A siege held only after the Throne was reached: -5 |
| A Festival (7.6): +10 | Neglect (5.2): -10 |
| Writs filled for the town: +1 each, at most +5 a week | Upkeep paid late: -5 |
| A revolt put down (7.7): to 20 | Curfew (7.6): -2 |

**What Standing does**: defence **+0.5% a point above 50**, **-1% a point below 50** (at 100: +25%; at 0: -50%); at
**80+** the members' discount rises 5%; below **20** the seat is in **Unrest** (challengers earn +25% influence
there, and the arrival line says so); at **0** it revolts (7.7).

### 7.4 Titles and glyphs from a seat

DERIVED, as every title is (`titles.js`): held while the Charter is, gone from the next token when it is not.

| Held | Title (the Guildmaster's; worn if chosen) | Glyph (every member) |
|---|---|---|
| a palace seat | "Warden of <Town>" | `tower` - a small tower in the guild's first colour |
| a crown seat | "Protector of <Kingdom>" | `crownDF`, `crownWR`, `crownSN` - a crown in the kingdom's metal |
| a crown seat at a Season's end | "Crowned in Season N" - kept for good | - |
| a seat for a whole Season | "Keeper of <Town>, Season N" - kept for good | - |

Titles are worded without gender: nothing about a player is guessed. FACT: the token's `TITLES` is a closed list
(`src/net/identityToken.js`), so a town's or a Season's name cannot be a title id. The token carries five **generic
ids** - `warden`, `protector`, `crowned`, `keeper` and the Royal Tourney's `champion` (7.6) - and a bounded claim beside them (`ts`: the seat key and the
Season number, both integers), from which the client words the title ("Warden of Anticlere"). FACT, the SHADOW-FANG
order: the five ids and the claim reach the relay (a new `RELAY_VERSION` and LAW row) before the account service
mints them - once, never per town or per Season.

### 7.5 Fortifications - a seat's memory

Fortifications belong to the SEAT, not the guild. When the seat changes hands each drops **one tier**; at a Season's
end each drops one tier (9.1). So a town fought over is a rich prize, and a guild that builds, builds for whoever
comes after.

Building a tier is a project on the seat's board: its materials are delivered by writs (PROF0 section 11) to the
stockpile, its Marks paid from the treasury, and it stands **2 days** (tier 1), **4** (tier 2) or **7** (tier 3)
after its last delivery. Costs (PROF0 section 4 names every material):

| Work | Tier 1 | Tier 2 | Tier 3 | Effect per tier |
|---|---|---|---|---|
| **Walls** | 400 Cut Stone, 100 Oak Planks, 1,000 Marks | 800 Cut Stone, 200 Iron Ingots, 3,000 Marks | 1,600 Cut Stone, 200 Steel Ingots, 8,000 Marks | the defenders' respawn wave 3 s faster |
| **Gatehouse** (crown; palace seats with tier 3 Walls gain a gate of their own) | 300 Cut Stone, 200 Iron Ingots, 2,000 Marks | 600 Cut Stone, 200 Steel Ingots, 5,000 Marks | 1,000 Cut Stone, 100 Mithril Ingots, 12,000 Marks | the Gatehouse's vitality +50% |
| **Watchtowers** | 200 Cut Stone, 200 Pine Planks, 800 Marks | 400 Cut Stone, 100 Iron Ingots, 2,000 Marks | - | the holder is told when a challenger passes half its defence (tier 1) or a quarter (tier 2) |
| **Barracks** | 300 Oak Planks, 100 Iron Ingots, 1,500 Marks | 600 Oak Planks, 200 Steel Ingots, 4,000 Marks | 800 Teak Planks, 100 Mithril Ingots, 9,000 Marks | relay-run town guards fight for the holder: 2, 4, 6 (the gate's brain with adds) |
| **Market Hall** | 200 Oak Planks, 100 Cut Stone, 1,000 Marks | 400 Cherry Planks, 200 Cut Stone, 2,500 Marks | 400 Mahogany Planks, 50 Gold, 6,000 Marks | the town's boards list 25% more; the Tithe's cap +1% |
| **Shrine** | 100 Cut Stone, 20 Silver, 1,000 Marks | 200 Cut Stone, 10 Pearls, 3,000 Marks | - | Standing +1 a week; each gate felled in the region gives the holder +50 influence |
| **Forge** | 200 Cut Stone, 100 Iron Ingots, 1,000 Marks | 300 Cut Stone, 100 Steel Ingots, 2,500 Marks | - | members smithing here: quality +1 step (PROF0 9.2) |
| **Workshop** | 200 Oak Planks, 50 Iron Ingots, 1,000 Marks | 300 Teak Planks, 50 Steel Ingots, 2,500 Marks | - | members in Carpentry, Outfitting, Masonry here: +1 step |
| **Apothecary** | 100 Cut Stone, 100 Oak Planks, 1,000 Marks | 200 Cut Stone, 20 Pearls, 2,500 Marks | - | members in Alchemy, Cooking, Jewelcrafting here: +1 step |
| **Harbour** (coastal seats only) | 400 Oak Planks, 200 Cut Stone, 2,000 Marks | 800 Teak Planks, 400 Cut Stone, 5,000 Marks | - | ships (the Sea update) dock at the seat; the town is a Travel Options port for members |

### 7.6 Edicts

At each Turning the holder proclaims **one Edict** for the coming week (Guildmaster or Officer, on the board). No
Edict may be proclaimed two weeks running except Market Day.

| Edict | Tier | Effect | Cost |
|---|---|---|---|
| **Market Day** | any | the seat town's shop prices -10% for everyone (client-applied, the discount's seam, 7.2) | - |
| **Bounty** | any | World of Daggerfall camps in the region (WOD7's shared camps, `src/world/wodShared.js`) pay double loot; the treasury pays 20 Marks per camp cleared, up to the sum set aside - a transfer, never a mint. **Bounded**: a camp's clearing is validated at the reader, never the relay (`wodShared.js`), so an account is paid for at most **5 camps a UTC day** | the set-aside, escrowed |
| **Levy** | any | 10% of gathering yields goes to the seat's stockpile, from the nodes of the region nearer this seat than any other seat of the region (the bailiwick's rule, by pixel), so two holders' Levies never share a node | Standing -2 |
| **Open Gates** | any | homes in the town may not be set private this week | Standing +3 |
| **Curfew** | any | the town's guards are stronger at night and crime there costs double legal reputation (each player's own, client-side) | Standing -2 |
| **Festival** | any | music, banners, lanterns; everyone in town gets the Festive buff (+5 to all attributes, 1 game day); Standing +10 | 2,500 Marks (palace), 10,000 (crown) |
| **Royal Tourney** | crown | a duel ladder all week in the crown's **city**, at the castle's entrance square (every seat act happens in its city, 15.1): DUEL1's ring, but every blow **refereed by PVP-REF** in a `siege:`-shaped room - a defender-resolved duel cannot award a title - the relay keeping the ladder; the week's winner earns "Champion of <Kingdom>, Season N" for good (a fifth generic title id, `champion`) | 5,000 Marks prize pool, from the treasury to the winner |
| **Conscription** | crown | the kingdom's palace seats held by other guilds pay this crown 2% of their Tithe for the week (never a vassal's, 7.8; never a free land's); a **march's** seats pay 1% to each claiming crown that proclaims it | Standing -5 at every seat that pays |

### 7.7 Revolt

A seat at Standing 0 revolts at its next siege window: a relay-run uprising (the gate's brain, with the adds the
gate record named for "later", `World-Bosses.md`) - a **Rebel Captain** (vitality as a siege fighter of Renown 50)
and **12 rebels** at the palace door. The holder's side must fell the Captain inside the window's two hours. Fail,
and the Charter lapses and the seat is unheld; succeed, and Standing returns to **20**.

### 7.8 Vassals and Pacts (crown politics)

- **Fealty** - a guild holding a palace seat in a crown's kingdom (or a march it claims) may swear fealty to that
  crown's holder, both accepting on their boards. A vassal pays the crown **5%** of its Tithe each week; the crown's
  holder adds **half its kingdom reach** to the vassal's defence at the Turning; neither may pledge against the
  other's seats. Either side may break fealty at a Turning; the breaker loses **10 Standing** at every seat it holds.
- **Pacts** - two guilds may sign a **Pact of non-aggression** for the rest of a Season: neither may pledge against a
  seat the other holds. Breaking it early is allowed and announced to the whole server in red.

### 7.9 The seat on the Notice Board

DECIDED (Mac): "The new notice board should be a physical object that houses quests, the player auction house,
etc". The board is PROF0 section 10; its **Seat** tab, at every Notice Board in a seat town (not its bounty boards -
BOUNTY1 took one board in two for its hunts; AUDIT 28), carries:

- the holder, its banner and device, Standing and its trend, the Tithe, this week's Edict;
- **the standings**: every pledged guild's influence this week, live, and the claim and defence lines;
- **the siege**: the Right of Siege, the window, the countdown, both rosters as they sign;
- **the stockpile**: every fortification project and what it still needs, each need a writ on the Work tab;
- **the Chronicle**: the seat's history (9.2), the newest pinned on top;
- for the holder's Officers: the levers - the Tithe, the Edict, the window, fealty, writs from the treasury.

A seat is run from its town's board, in person. That is the point of a physical board: the war has a place.

## 8. What a guild grows

### 8.1 Heraldry

- **Two colours** from a fixed palette of sixteen, readable on the map at its smallest band: Azure `#3b6fd8`,
  Crimson `#b3262e`, Gold `#d4a017`, Argent `#e6e6e6`, Sable `#1d1d1d`, Vert `#2f8f4e`, Purpure `#7a3fa0`, Tenné
  `#c46a1b`, Sanguine `#7d1f1f`, Celeste `#7fb3e6`, Murrey `#8c2f5a`, Ochre `#b88a2e`, Teal `#1f7f7f`, Rose
  `#d98aa0`, Ash `#8a8a8a`, Umber `#5a3e22`. The two must differ; Ash is reserved alone for the unheld ring, so a
  guild may use it only as its second colour.
- **A device**, one of 24 of the port's own drawn charges (SVG silhouettes committed as the port's own art): wolf,
  bear, boar, stag, lion, eagle, raven, dragon, serpent, fish, tower, gate, crown, sword, axe, hammer, bow, shield,
  sun, moon, star, eye, rose, tree.
- Chosen by the Guildmaster on the Guild tab; changing either costs **500 Marks** and is refused in a siege week.
- It is drawn on banners (3.4), the map ring, the frame of the guild tag, the siege HUD, the board and the Chronicle.

### 8.2 The guild hall (GUILD1d)

FACT: planned as "a guild-owned home" and not built; `HOME_ENTRIES` has no `guild` entry. DECIDED:

- a guild may own **one** home as its hall, bought from the gold treasury at the home's price **x 1.5**, owned by the
  guild (not a character): the homes table gains a guild owner column;
- the `guild` entry joins private/party/public for every home, the hall's default;
- the hall carries the guild Stores chest and a private guild board (the board's Guilds tab, members only);
- decor in the hall by Officers; `DECOR_CAP` as any home;
- a guild holding a seat keeps its own hall and gains the palace (or castle) as well.

## 9. Seasons, the Chronicle, the Tides

### 9.1 Seasons

- A **Season** is **8 weeks**. **Season 0**, the four-week beta (section 18), begins at the first Turning after SEAT1c
  ships; Season 1 at the Turning that ends it. Seasons are named for the
  Tamrielic months in order (the Season of Morning Star, of Sun's Dawn, of First Seed ... of Evening Star), then the
  names repeat with a numeral.
- **At a Season's end** (the Turning that closes week 8), DECIDED - a **soft reset**:
  - every crown holder earns "Crowned in Season N"; a guild that held a seat all 8 weeks earns "Keeper of <Town>,
    Season N" for its Guildmaster, and every member of it the Season's **banner ribbon** (a thin band in the
    guild's colours under their name tag for the next Season);
  - every fortification drops one tier (the world wears);
  - Legacy is cleared; Standing moves halfway back toward 50;
  - the Charters stand - holding across Seasons is a story the server should be able to tell;
  - the Season's **Chronicle** is written (9.2).

### 9.2 The Chronicle and the Hall of Records

Every claim, siege, Tourney, revolt, Edict, fealty and change of hands is a `town_seat_history` row. A **Hall of
Records** book in every seat's palace and the three castles, and the board's Chronicle pinboard, read it as prose,
from templates in the law module:

- "In the third week of the Season of Hearthfire, the Silver Hand stormed the gates of Anticlere and took its Charter
  from the Ebon Oath after thirty-one minutes."
- "The Ebon Oath held Wayrest against the Iron Circle. The Throne was never reached."
- "Anticlere rose against the Silver Hand. The rebel captain fell at the palace door, and the Charter held."
- "Under the Silver Hand, Anticlere proclaimed a Festival."

The book is read through the enhanced book window the port already has (`src/ui/enhancedBook.js`).

### 9.3 Tides - the world moves under the war

Each week the shared clock rolls one **Tide** per kingdom, one for the Marches (all three regions share it) and one
for the Free Lands, a pure function of the week and a salt, as the gate's site is. Everyone knows the coming week's Tides at the Turning.

| Tide | Weight | Effect in that kingdom for the week |
|---|---|---|
| Calm | 40 | nothing |
| Harvest | 10 | gathering yields +25% (PROF0) |
| Blight | 5 | herbs and wood yields -25% |
| Plague | 5 | the Watch counts half; Festivals cost double |
| Orc Raids | 10 | WOD camps in the kingdom doubled; each cleared gives the clearer's war-guild +50 influence at its pledged seat in that region - **bounded** (a camp is validated at the reader, never the relay): at most 5 camps an account a UTC day and **250 an account a week** |
| Daedric Incursion | 10 | gate kills in the kingdom's regions give double influence, and double Marks (PROF0 10.5) |
| Royal Wedding | 5 | Festivals cost half; Standing +3 at every held seat |
| Bandit Summer | 5 | couriers into the kingdom take twice as long (PROF0 10.4) |
| Storm Season | 5 | fishing yields +50%, sea travel slowed |
| Tax Revolt | 5 | Tithe above 5% costs Standing -3 extra |

### 9.4 Why a guild comes back

A weekly pledge; a weekly Edict; Tides that change the arithmetic; a Standing to keep; fortifications that last and
are worth stealing; sieges with a schedule to rally for; crowns, marches and vassals; Pacts to make and break; a
Season with titles at the end; a Chronicle that remembers; and the Professions economy feeding all of it.

## 10. The threats, and the answers

| Threat | Answer |
|---|---|
| A modified client inflates Renown | Renown is the weakest source: 1 per 20 XP, 400 an account a week (4.2); siege vitality is flat (6.1) |
| A modified client fakes a blow, a speed or a position | PVP-REF: the relay referees every blow and every step (6.1) |
| A modified client fakes the gold behind a fee | No seat cost is in gold: Marks only, which only the server holds (PROF0 10.5) |
| One account feeds two guilds, or fields many characters in one | Per-account war and per-account caps (4.2) |
| Fresh alts join to pad influence | 7 days in a guild before a member counts (4.2), for writs and homes too |
| Marks buy influence through writs (materials bought at their value) | Only own units count at value; bought at Tribute's rate inside its cap (4.2; PROF0 7) |
| An outsider or an alt fills a guild's seat writ | Only a 7-day member bound to the guild earns influence by delivery (4.2) |
| A lone account disputes a rival's seat, board or gate day | One dissenter is counted, not obeyed; a disputed row keeps its effect until a moderator rules (3.2) |
| A modified client registers homes, camps or kills that never were | Each is bounded: homes 875 a week, camps 5 a day and 250 a week, gate receipts 900 a week an account (4.2, 7.6, 9.3) |
| Receipts banked for a later week | A receipt counts only for its own day's week (4.2) |
| A friendly pair stages weekly sieges | A held siege counts only if a banner was raised; Honours between two guilds once a Season (6.8) |
| Players join an ally just to fight its siege | Rosters need 7 days' membership at the Turning and the account's binding (6.4) |
| Two battles of one guild at once | The settle's schedule moves the later (6.3) |
| A holder farms its own alt challenger | Forfeit Standing only once a Season per challenger; thresholds make a fake challenger cost 6,000 influence |
| A parked tab farms the Watch | Movement in the last 5 minutes; 60 a day (4.2) |
| A zerg takes everything | Per-account caps, Overreach, fixed team sizes, Unrest, Pacts against it |
| A holder sets sieges for 4 a.m. | Windows start 16:00-02:00 UTC, fixed at the Turning, at least 70 hours ahead; crowns fixed Saturday evening |
| A holder hoards and never builds | Upkeep, Standing, revolt |
| Two readers settle a week at once | One transaction keyed by the week (5.2) |
| A fake seat | The witnessed registry (3.2) |
| A relay older than the vocabulary | The SHADOW-FANG order |

## 11. Where the Professions arc meets the seats

| Seat side | Professions side (PROF0) |
|---|---|
| Writs as influence (4.2) | Gatherers and crafters fill them from the Stores (PROF0 section 11) |
| Fortifications (7.5) | Masonry, Carpentry, Smithing; every material in PROF0 section 4 |
| The Ram (6.2) | Carpentry and Smithing craft it; a siege consumes it |
| The Levy (7.6), Harvest and Blight (9.3) | Node yields (PROF0 section 6) |
| Regional signature materials (PROF0 4.7) | The crowns and marches that tax them |
| The Forge, Workshop, Apothecary (7.5) | Quality +1 step for the holder's members |
| Siege Honours (6.8) | The Spoils of War table - materials only war yields |
| The Seat tab (7.9) | The same board's Work and Market tabs (PROF0 10.1) |

## 12. The server's shape

- **Account service (D1)**, migrations after 0017 (0016 is MARKS1's, 0017 NOTICE1's - AUDIT 28):
  - `town_seats` (key PK, name, region, tier, pixel_x, pixel_y, confirmed_at, holder_guild, held_since, standing,
    tithe, edict, window_day, window_hour, legacy JSON)
  - `world_witness` (kind, key, account, report_hash, at) and `world_facts` (kind, key, data JSON, state -
    unconfirmed, confirmed or disputed) - the witnessed world (3.2): locations and seats, pixels, gate days
  - `town_seat_pledges` (week, guild_id, region, key, set_by, at)
  - `town_seat_influence` (week, key, guild_id, account, char_id, source, amount) - summed on read, capped on write
  - `town_seat_weeks` (week PK, settled_at) - the settle's idempotence key
  - `town_seat_forts` (key, work, tier, project JSON, stands_at)
  - `town_seat_history` (seq PK, key, week, kind, data JSON) - the Chronicle
  - `town_seat_sieges` (week, key, attacker, defender, starts_at, result, roster JSON)
  - `guild_fealty` (vassal, liege, since); `guild_pacts` (a, b, season)
  - `guilds` gains `colour1`, `colour2`, `device`; the Marks treasury is PROF0's
  - the Renown report gains `region`; `renown_region_week` (player, char_id, region, week, xp)
- **Endpoints** (`/v1/seats/...`): `witness`, `list`, `standings`, `pledge`, `tribute`, `window`, `edict`,
  `tithe`, `fealty`, `pact`, `siege/sign`, `siege/claim` (a receipt), `fort/fund`, `history`.
- **Relay**: `siege:<key>:<week>` rooms stepped by Durable Object alarms (the gate's brain); PVP-REF's referee; the
  Watch counter in cell rooms (reporting presence minutes to the service in signed batches); `s1.` siege receipts;
  the Rebel Captain's brain; `{t:'tseat'}` frames for banner state, the Throne, the Gatehouse, the Ram.
- **Law modules, pure, shared by client, relay and service**: src/net/townSeatLaw.js (to be written) (Appendix B, the week, the
  phases, the windows, the Chronicle's templates, `KINGDOM_OF`), src/net/siegeRef.js (to be written) (6.1's buckets),
  src/systems/townSeats.js (to be written) (the client's derivation).
- **Versions**: each relay change a new `RELAY_VERSION` with its LAW row; every token vocabulary change relay-first.

## 13. The slices, in order

Each ships as the repo ships everything: pins that fail under a one-character mutation, the four hosts named, the
bible updated in the same change, mutants recorded.

| Slice | What | Done when |
|---|---|---|
| **SEAT0** | This record | - |
| **SEAT-COUNT** | The count tool (3.1) | Mac has run it; the count is recorded here |
| **MARKS1** | PROF0's currency - **SHIPPED** (PROF0 10.5, `06-Systems/Online-Arc.md`) | PROF0 15 |
| **NOTICE1** | PROF0's board - **SHIPPED** (PROF0 10.7) | PROF0 15 |
| **GUILD1d** | Guild halls, the guild entry, heraldry (8) | A guild buys a hall, members enter, the banner draws on a test layout |
| **SEAT1a** | The derivation; the registry; the map rings; arrival lines; banners (unheld: the kingdom's) | Pins over a fixture MAPS set: every Palace record is a seat, capitals are crowns, mod rows never count; three witnesses confirm |
| **SEAT1b** | Influence: pledges, the Watch, gate kills, homes, Renown's region, Tribute; the standings on the board | Each source's cap pinned; per-account war and the 7-day wait pinned |
| **SEAT1c** | The Turning; claims; Contested; the Charter; titles and glyphs (relay first); the Seat tab | `settleWeek` idempotent under two racing readers; a held seat's banners in the guild's colours |
| **SEAT1d** | Upkeep, Overreach, Tithe, discounts, Standing, Edicts, Neglect; the economy model as a tool reading townSeatLaw.js and professionLaw.js (PROF0 Appendix C) | Every Standing row pinned; the Tithe routes only Marks; the model re-runs Appendix C's table. The Tithe needs PROF5 (the market) |
| **PVP-REF** | The refereed blow and step; the 40-fighter measurement | 6.1's buckets pinned against DFU's damage ranges; the measurement recorded |
| **SEAT2a** | Siege rooms, banners, the Throne, windows, forfeits, spectators, the Tourney, Honours | A headless 10v10 siege runs to both endings |
| **SEAT2b** | Fortifications, the Barracks' guards, the Gatehouse, the Ram, revolts | Needs PROF11 (Masonry), PROF4 (Carpentry), PROF3 (Smithing's ingots for the Ram) and PROF8 (the Pearls tier-2 Shrine and Apothecary ask) |
| **CROWN1** | The crown tier: reach, the Marches, the Free Lands, crown glyphs, the Saturday slots, Royal Tourney, Conscription | - |
| **CROWN2** | Fealty and Pacts | - |
| **SEASON1** | Seasons, the Chronicle, the Hall of Records, Tides | - |

## 14. What remains to measure

1. **The seat count** (3.1) - SEAT-COUNT, run by Mac.
2. **Forty fighters in a room** (6.1) - PVP-REF's measurement; its failure drops the sizes to 8/16.
3. **The economy after Season 1** - the Marks report (PROF0 10.5): if claims are never made, thresholds fall by a
   quarter; if every seat changes hands every week, defence's Standing term doubles. Recorded here when done.

## 15. The four hosts and the process laws

### 15.1 The four hosts

THE FOUR HOSTS RULE (Home.md, 17e): "Four files own a motor ... A slice wiring a seam into one must NAME ALL FOUR in
its record - each either wired or FLAGGED by name." Every SEAT slice's record carries this table, updated:

| Host | What a seat is there |
|---|---|
| `scenes/world.js` - the streaming world | The seats' derivation (the boot pass beside `pickRegionHubs`); the map rings; the arrival lines; the banners at their anchors; the Notice Boards; the Watch's poses; the siege and the Royal Tourney - fought in the town as the streaming world draws it, in their own `siege:` rooms |
| `scenes/exterior.js` - the fixed city (`?exterior`) | The banners of the one city it loads, if that city is a seat - and DFU's own board, never the Notice Board or a bounty board (PROF0 10.7, Bounty-Boards 8: the fixed city keeps DFU's board; AUDIT 28 corrected "the board"). **FLAGGED by name**: no siege, no Watch, no Turning notice - the fixed city is a development host that mints its own `town:` room and runs no streamer, the way it already says so about travel (Home.md's open flags, `exterior.js` TP2) |
| `scenes/worldModes.js` - building interiors | The palace hall: the Charter Room's decor (the building host's own decor pool, `scenes/decorRoom.js`), the roster board, the guild Stores chest, the Hall of Records book; guild halls (GUILD1d); the members' discount and Market Day at the seat town's shops (the `calculateCost` call sites, 7.2) |
| `scenes/dungeonContext.js` - dungeons | The three castles (crown halls): the holder's banners in the throne room, the chest, the roster board and the Hall of Records book; **no decor, no siege, no revolt, no Tourney** inside - a castle is DFU's quest ground, and every seat act happens in its city |

### 15.2 The process laws, applied

Every law in Home.md's Process section, and what it demands of this arc:

| Law | What it means here |
|---|---|
| **THE MODAL CONTRACT** | The board's window and the siege's result card gate a host frame: each returns the same type from every exit, asserted in a test, not a comment |
| **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD** | The board's window lives in the host's overlay slot: the slot is nulled before the window is disposed, and its close dispatches its callback once however many doors call it |
| **ONE DFU MEMBER, ONE EXPORT** | Nothing DFU owns is re-typed: `REGION_NAMES`, `BUILDING_TYPES.Palace`, `BULLETIN_BOARD_MODEL_ID`, `DEFAULT_WEAPON_REACH`, `WEAPON_MATERIALS` are imported; the kingdom map is the one new table, and it lives in townSeatLaw.js alone |
| **A PIN MUST FAIL** | Every number in Appendix B is pinned by `deepEqual` against the law module's table, and each slice's mutants (`tools/mutants/seat*.json`) prove a one-character change of any rule reddens a test |
| **TEST THE SHAPE THE PRODUCER MINTS** | Seats in tests come from the derivation run over a fixture MAPS set, never hand-built rows; receipts come from the relay's own signer; a settled week from `settleWeek` itself |
| **ASYNC NEVER DROPS** | Every service call (pledge, tribute, window, edict, sign) carries a request id; a second press while one is in flight coalesces; a lost answer is re-asked with the same id (Renown's `last_rid` pattern) |
| **EVERY ALLOCATION HAS AN OWNER** | Banner quads are owned by the town's layout and freed with it; the siege HUD's elements by the siege room's session; the relay's siege state by its room, dropped when the window closes - all but its unposted result and Honours receipts, which it keeps with their ids until the service accepts them (17) |
| **THE ONE CONSTRUCTION SEAM** | One constructor builds the board's window for every host; a test sweeps the source so no host `new`s it |
| **THE NATIVE-WINDOW RULE** | It governs DFU's native windows: the offline bulletin board's parchment stays native, its ROAD A9 cites intact. The Seat tab and the siege HUD are the port's own Enhanced Plus windows and cite `src/ui/enhancedStyle.js`, not DFU rects |
| **A SLICE CLOSES ITS LEDGER ROW** | SEAT1a adds Port-Ledger section A's row (EVERY PALACE A SEAT, online's own) with its first visible departures - the map rings, the arrival lines, the banners; each later slice narrows it; none leaves it stale |
| **RETIRING A FLAG DELETES THE SENTENCE** | The fixed-city FLAGGED site above is listed in Home.md's open flags by the regenerator; the day it is wired, the sentence goes |
| **DO NOT FIX WHILE THE VERIFIER IS READING** | Every slice's pre-merge audit runs on a frozen tree |
| **THE RELAY VERSION** | Every relay change - the siege room, PVP-REF, the Watch, the frames - is a new `RELAY_VERSION` with its LAW row; token vocabulary reaches the relay first |

## 16. Lifecycles and edge cases

**Guilds**

- **Disbanding while holding a seat.** GUILD1's law already refuses a disband with gold in the treasury. FACT (MARKS1,
  AUDIT 28): the Marks treasury refuses nothing - a guild that goes gives what it holds to its guildmaster in the same
  batch, refused only past the guildmaster's cap (`server-account/src/guilds.js` endGuild, `marks.js`
  guildMarksSweep). SEAT grows three more refusals: **any Charter held**, **a Right of Siege or a Tourney pending**, and
  PROF0's **guild Stores holding anything** (PROF0 18 - the two records now list the same). FACT: a guild also ends
  when its last member leaves (`leaveGuild`), so that leave is refused on the same grounds. The Guildmaster first **relinquishes** each
  Charter at its board - the seat is unheld at once, its fortifications stay, a history row says so.
- **The Guildmaster leaves or is removed.** GUILD1's `succeed()` names a new one; the seat is untouched; the titles
  re-derive on the next tokens (the old Guildmaster stops wearing "Warden of"; the new one may choose it).
- **A member leaves mid-week.** What they contributed stays with the guild for the week. Their account is still bound
  to that guild's seats until the Turning (per-account war) - leaving cannot be used to switch sides mid-week.
- **A guild with a Right of Siege shrinks** below its side's needs: it fights with what it has; there is no minimum.
  If it is gone by some path the refusals do not cover (an account deletion cascading, 16's accounts), its siege is
  void: the holder keeps the seat and nobody earns Honours.

**Seats**

- **A seat is struck** by a developer (3.2) while held: the Charter voids, the claim fee is refunded to the holder's
  Marks treasury if struck within the Season, and the history keeps the row.
- **Neglect and Contested never meet at one Turning**: only an unheld seat can be Contested (5.2, step 2), and
  Neglect is a held seat's (step 5). A seat whose Charter lapses from Neglect is unheld from the next week, and may be
  Contested at the Turning after that.
- **Two seats in one town** cannot happen: one seat a location (3.1).
- **A crown holder's own palaces**: kingdom reach raises the crown guild's influence at its own palace seats too, so
  a crown defends its realm better - the reason crowns are coveted.

**Characters and accounts**

- **A character deleted**: its contributions this week stay; its titles vanish with it.
- **An account deleted**: its guild memberships cascade (FACT, `0013_guilds.sql`); if it was a Guildmaster,
  `succeed()` runs; its Marks go with it (PROF0 section 18).

**Sieges**

- **A fighter disconnects**: their place on the roster is kept **5 minutes**; they return at their camp with the next
  wave. After 5 minutes a signed-up substitute may take the place.
- **Two battles of one guild at once**: never - the settle places every battle of the week, sieges, Tourneys, revolts
  and crown slots, so none of a guild's overlap (6.3); windows are frozen at the Turning, so none can be moved onto
  another afterwards.
- **A spectator is also a signed fighter**: they cannot enter as a spectator; a fighter is always a fighter.

## 17. Failures, deploys and outages

- **A relay deploy during a siege.** FACT: a relay deploy "drops every connected player" (its own workflow's name,
  `.github/workflows/relay-deploy.yml`). So the workflow gains a **siege blackout** step before it deploys: it computes
  the crown slots (a pure function of the clock) and asks the account service (`GET /v1/seats/sieges/live`) whether any
  siege room is live or starts within 30 minutes; if one is, it waits, polling, **with no cap** - no guild fights two
  battles at once and each is at most two hours, but one Saturday evening can hold battles from 16:00 to 04:00. An
  urgent deploy may be forced (`workflow_dispatch` with `force`); a forced deploy during a siege **voids** it (below).
  FACT: the account deploy waits on the relay (AUDIT B1) for 60 polls 20 seconds apart - 20 minutes - and then gives
  up without deploying (`.github/workflows/account-deploy.yml`), so SEAT2a lengthens that wait to outlast the
  blackout; otherwise a seat change's account deploy would silently not ship.
- **The account service is down during a siege.** The relay needs the service only at the start (the rosters, cached)
  and at the end (the result). A siege runs to its end alone; its result and Honours are signed receipts the relay
  keeps and posts, with their ids, until the service accepts them.
- **The siege room dies.** The referee checkpoints every 2 seconds (the gate brain's rule); a restarted Durable Object
  resumes from its checkpoint. A room lost for more than **5 minutes** - or a forced deploy - **voids** the siege: the
  holder keeps the seat for now, and the challenger's Right **carries to the holder's window the next week**. At that
  Turning the carried Right is the challenger's one Right of Siege (5.2 step 4 grants it no other), and the seat is
  granted no other challenge.
- **The Turning's settle fails.** It is one D1 transaction: it rolls back whole, and the next read settles it again.
- **Clocks.** Every time is the relay's clock; clients read it through their offset (FACT, `online.js`
  `clockOffsetMs`). Daylight saving never touches UTC.

## 18. Rollout, Season 0, moderation, data

- **Switches.** The account service's config gains `SEATS_OPEN` (off, dev, on). At `dev` only accounts with the dev
  glyph see seats, so each slice is played on the live servers before anyone else sees it.
- **Season 0.** The first Season is a four-week open beta. At its end seats, influence, fortifications and history
  are wiped; Marks, the Stores and profession tracks are kept (players' effort is never wiped). Season 1 begins at
  the next Turning (9.1).
- **Patch notes** for every slice, in the house style (the pull request's `## Patch notes`, Discord-sized, player-facing).
- **Moderation.** Guild names and tags pass the name filter they already pass; heraldry is a fixed palette and fixed
  devices, so nothing offensive can be drawn on a banner. Moderators (MOD1) may **void a siege** (`/siege void`) - a
  history row, the holder keeping the seat - when a fight was won by an exploit found after it.
- **Rate limits.** Every seat endpoint is bounded per account per hour (the guild's `GUILD_OPS_MAX` shape): pledges
  30, windows 5, edicts 5, witness reports 24.
- **Data kept.** Influence rows are summed into weekly totals at the Turning and pruned after 4 weeks; the history is
  kept forever; the Watch stores minutes, never positions.

## 19. The screens

Enhanced Plus windows, drawn in its brass and bone; these are layouts, not art.

**The board's Seat tab** (7.9):

```
+--------------------------------------------------------------------------------------------+
| NOTICE BOARD - Anticlere           [Notices] [Work] [Market] [SEAT] [Guilds] [Makers]      |
+--------------------------------------------------------------------------------------------+
| [banner]  THE CHARTER OF ANTICLERE              held by the Silver Hand <SH> since week 3    |
|           Standing 62 (+2)   Tithe 6%   Edict: Market Day   Kingdoms: Daggerfall | Wayrest   |
+---------------------------------------------+----------------------------------------------+
| THIS WEEK (the Reckoning in 1 d 4 h)        | THE SIEGE                                    |
|   Silver Hand <SH>  holder  defence  7,410  |   No Right of Siege this week.               |
|   Iron Circle <IC>          4,100  ####     |   The holder's window: Wednesday 20:00 UTC   |
|   Ebon Oath   <EO>          3,650  ###      |                                              |
|   claim line  6,000  ------------|         |                                              |
+---------------------------------------------+----------------------------------------------+
| THE WORKS                                   | THE CHRONICLE                                |
|   Walls  tier 1 -> 2                        |   Week 3: the Silver Hand took the Charter   |
|     Cut Stone     520 / 800                 |   from the Ebon Oath in twenty-seven minutes.|
|     Iron Ingots   200 / 200                 |   Week 4: Market Day was proclaimed.         |
|     Marks       1,900 / 3,000               |                                              |
+---------------------------------------------+----------------------------------------------+
| Officers:  [Tithe]  [Edict]  [Window]  [Fealty]  [Post a writ]                              |
+--------------------------------------------------------------------------------------------+
```

**The siege HUD** - banners carry a shape as well as a colour (^ attackers, o defenders, ~ contested):

```
+----------------------------------------------------------------------------+
|  ANTICLERE      Silver Hand <SH>   vs   Ebon Oath <EO>            27:14    |
|  GATE [^ SH]    MARKET [~]    TEMPLE [o EO]            THRONE  0% (2 of 3) |
+----------------------------------------------------------------------------+
  SH  8 up / 2 down                                         EO  9 up / 1 down

                                   +

                                                  vitality  |||||||||..  372 / 386
                                                  next wave in 12 s
```

**A spectator** sees the same bar, both rosters, "Spectating - 41 of 60", and a free camera (WASD, the mouse, the
pad's sticks); nothing they do reaches the fight.

**The result card**, shown to fighters and spectators when the siege ends, and pinned to the board as a Chronicle
note:

```
+--------------------------------------------------------------+
|   THE SILVER HAND HOLDS THE THRONE OF ANTICLERE              |
|   27 minutes 14 seconds.  Gate ^  Market ^  Temple o          |
|   Your Honour: 50 Marks, 2,000 Renown, one Spoils of War roll |
|                                              [ Claim ]        |
+--------------------------------------------------------------+
```

## Appendix A - a week in Anticlere

- **Sunday 18:00, the Turning.** Anticlere (a march) is held by the Ebon Oath (Standing 58, tier 1 Walls). The
  Silver Hand, holders of the Crown of Daggerfall, pledge Anticlere; so does the Iron Circle.
- **Monday to Friday, the Muster.** Silver Hand members patrol the town, three of them are at the gate that rises in
  Anticlere's region when it falls, and one fills the Ebon Oath's own stone writ at the board - paid in Marks, and
  worth no influence to anyone: only the Oath's own 7-day members raise its defence by writs, and a delivery that earns
  the pay alone binds nobody's war (4.2). They deliver the timber and stone they felled and quarried to their own
  Siege Camp instead.
- **Friday 18:00, the Reckoning.** Pledges lock. The board shows the Silver Hand at 8,224 (its homes' last two days,
  150, still to accrue), the Iron Circle at 4,100.
- **Sunday 18:00, the Turning.** The Oath's defence: its own 5,900 x (1 + 0.04 Standing) x (1 - 0 Overreach) + 400
  Legacy = 6,536 (its Walls change the respawns, not the defence). The Silver Hand, at 8,393, beat it and passed
  6,000: the **Right of Siege**, its only one this week. Its Siege Camp is spent (the timber and stone burnt; no Ram - a
  palace has no Gatehouse). The Oath's window, in force at the Turning, is Wednesday 20:00.
- **Wednesday 20:00, the siege.** Ten against ten. The Hand takes Gate and Market in twelve minutes, loses Market,
  retakes it, and holds the Throne at the twenty-seventh minute.
- **After.** The Hand holds Anticlere: Standing 50, the Truce, the Walls drop to tier 0. Its Guildmaster is "Warden of
  Anticlere". The Chronicle writes it. The Iron Circle's influence is gone; the Oath pledges Anticlere for next
  week.

## Appendix B - every number (`townSeatLaw.js`)

| Name | Value |
|---|---|
| Witnesses to confirm / to dispute / witness account age / ignored after | 3 / 2 agreeing on another answer / 7 days / 3 unmatched disagreements, for a week |
| Pledge regions a guild / pledges a region | 5 / 1 |
| Watch: per 2 minutes, cap an account a day, movement window | 1, 60, 5 minutes |
| Gate kill / home a day (cap 5 homes) / writ per Mark of own materials' value / Renown per 20 XP (cap 400 an account a week) / Tribute per 10 Marks, burnt (cap 20%) | 300 / 25 / 1 / 1 / 1 |
| Gate influence an account a week / Orc Raids camp influence (camps a day, influence a week, an account) | 900 / 50 (5, 250) |
| Per-account cap a seat a week / new-member wait / Legacy | 2,000 / 7 days / 10% |
| Kingdom reach / march share / free-land Watch bonus | 25% / 12.5% / 10% |
| Claim threshold (palace / crown) | 6,000 / 30,000 |
| Claim fee (palace / crown) | 8,000 / 80,000 Marks |
| Upkeep a week (palace / crown) | 2,500 / 15,000 Marks; the crown's x min(1.5, max(0.4, active / 100)) |
| Contested margin | 10% |
| Overreach: weights (palace / crown); extra = total - heaviest; per extra (upkeep / defence), added | 1 / 3; 25% / 5% |
| Tithe cap (palace / crown) | 10% / 15% |
| Members' discount (palace / crown / Standing 80+) | 10% / 15% / +5% |
| Standing: start, Unrest below (challengers' bonus), revolt at | 50, 20 (+25%), 0 |
| Standing's changes (7.3) | Tithe at or below half its cap +2 a week, above three quarters -3; held unchallenged +5; a gate +2 (at most +6 a week); a siege held +15, only after the Throne was reached -5; Festival +10; Neglect -10; writs +1 each (at most +5 a week); upkeep late -5; a revolt put down, to 20; Curfew -2 |
| Standing on defence (above 50 / below 50, a point) | +0.5% / -1% |
| Turning / Reckoning | Sunday 18:00 / Friday 18:00 UTC |
| Window days / start range / length / fixed / default | Wednesday-Saturday / 16:00-02:00 UTC (00:00-02:00 the night after) / 2 h / at the Turning / Wednesday 20:00; a Tourney Wednesday 20:00; clashes move to the next free start |
| Crown sieges | Saturday 20:00 DF, 21:00 WR, 22:00 SN UTC |
| Sides (palace / crown), sellswords | 10 / 20; 2 / 4 |
| Siege vitality | 300 + 2 x Renown level (302-400) |
| Blows a second / casts per 5 s / cast damage / heal | 4 / 3 / 60 / 40 |
| Speed limit | 12.5 m/s + 0.5 m |
| Banner radius / raise time / Throne (palace / crown) | 8 m / 20 s / 120 s / 180 s |
| Banners to open the Throne (palace / crown) | 2 of 3 / 3 of 4 + Gatehouse |
| Gatehouse / Ram vitality; Ram damage | 20,000 / 3,000; 500 every 10 s, 2 crew within 3 m |
| Time limits (palace / crown / Tourney) | 30 / 45 / 20 minutes |
| Respawn waves (palace / crown) / protection | 20 / 30 s / 3 s |
| Forfeit after / a disconnected fighter's place kept | 10 minutes / 5 minutes |
| A held siege or a forfeit | Standing +15 (+10 a forfeit, once a Season a challenger); next defence x1.2; a held siege counts only if a banner was raised |
| Honours between the same two guilds | once a Season |
| Siege room lost / forced deploy | void after 5 minutes; the Right carries one week |
| Spectators | 60 |
| Honours (win / loss) | 50 Marks + 2,000 XP / 25 Marks + 1,000 XP, one Spoils roll |
| Fortification build time (tier 1 / 2 / 3) | 2 / 4 / 7 days |
| Fortification costs and effects | the 7.5 table, whole |
| Edicts | Market Day -10%; Bounty 20 Marks a camp, 5 camps an account a day; Levy 10%, Standing -2; Open Gates Standing +3; Curfew Standing -2; Festival +5 attributes a game day, Standing +10, 2,500 / 10,000 Marks; Royal Tourney 5,000 Marks; Conscription 2% (a march 1% to each crown), Standing -5 |
| Revolt | a Rebel Captain (vitality of Renown 50) and 12 rebels; Standing to 20 if put down |
| Tides (weights) | Calm 40, Harvest 10 (+25%), Blight 5 (-25%), Plague 5, Orc Raids 10, Daedric Incursion 10 (x2), Royal Wedding 5, Bandit Summer 5 (x2), Storm Season 5 (+50%), Tax Revolt 5 (-3); kingdoms, the Marches and the Free Lands roll one each |
| Heraldry change | 500 Marks |
| Fealty tribute / reach to a vassal / break cost | 5% / half / 10 Standing |
| Season / Season 0 | 8 weeks / 4 weeks |
| Rate limits an account an hour | pledges 30, windows 5, edicts 5, witness reports 24 |

## Appendix C - the economy model (summary)

The model lives with Marks, in `06-Systems/Professions-Arc.md` Appendix C. What it set here:

| Number | First record | Now | Why |
|---|---|---|---|
| Claim threshold | 5,000 / 25,000 | **6,000 / 30,000** | a regular 8-member guild's median week clears a palace; a crown needs a 30-member guild in a good week (its p90 is 30,201, re-run with Foraging's daylight) or a 40-member guild's median |
| Claim fee | 5,000 / 50,000 Marks | **8,000 / 80,000** | most of a 12-member guild's week of writs; three weeks of a 30-member guild's |
| Palace upkeep | 1,000 | **2,500** | at 1,000 it was 6% of a 12-member guild's writ income - a seat that cost nothing; now a quarter |
| Crown upkeep | 10,000 | **15,000 x the server's scale** | more than half a 30-member guild's income, scaled so a small server's crown is not starved |
| Whole server, Marks minted / burnt | 2.3 | **1.00** (0.83 at 50 accounts, 0.81 at 300, Court writs scaling with the server) | the Bank's exchange is the voluntary valve at the edges |

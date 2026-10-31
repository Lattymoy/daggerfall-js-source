# Seats: guilds hold the towns

Online guilds compete to hold **Charters** of palace towns and the crown cities. A guild earns influence at a seat
through the week; at the Sunday **Turning** the account service grants unheld Charters and Rights of Siege. A siege is
a refereed team battle in the town. A holder pays upkeep in Silver, sets the town's Tithe and Edicts, builds
fortifications and earns titles. Players meet it at a town's Notice Board (its Seat tab), on the map's rings, in arrival
lines and in the Guild window. From `DOMAINS_WEEK` on, the thing held is a region's Charter (`Domains.md`). In code a
seat is `townSeat` (the word "seat" is taken by ONE-SEAT), and Silver is Marks.

## How it works

**Which places are seats** (`src/systems/town/townSeats.js` `deriveTownSeats`). Every client derives them from the
game's own MAPS.BSA rows in the boot pass that picks region hubs. A **crown** is Daggerfall, Wayrest or Sentinel
(`CROWN_SEAT_REGIONS`). A **palace** seat is every other location with a Palace building. Past the Bay
(`tamrielSeatsOf`), each province's capital is a crown and each Arena city-state is a palace, Cyrodiil's Imperial City
included. The servers hold no game data, so they believe a seat only once three clients agree on it
(`SEAT_WITNESSES_AUDIT`; `server-account/src/townSeats.js`). `tools/seatCount.mjs` prints every Bay seat from ARENA2.

**The kingdoms** (`src/net/kingdomLaw.js` `kingdomOf`, `isMarch`, `isFreeLand`). The Bay's regions belong to
Daggerfall, Wayrest or Sentinel; Betony, Anticlere and Lainlyn are Marches claimed by two crowns; Balfiera, Orsinium and
Wrothgaria are Free Lands. A crown's holder gets `KINGDOM_REACH` (25%) on its kingdom's palace seats and
`MARCH_REACH` on its marches; every guild gets `FREE_LAND_WATCH_BONUS` on the Watch in the Free Lands. Each province
is its own crown.

**Influence** (`server-account/src/seatInfluence.js`; numbers in `src/net/townSeatLaw.js`). Counted per guild, per
seat, per week. Each week a guild pledges one seat a region in up to `SEAT_PLEDGE_REGIONS_MAX` (5) regions; an Officer
or the Guildmaster moves it until the Reckoning. Sources, each witnessed by a server or bounded:

- the Watch: a member's socket in the seat's pixel, `WATCH_INFLUENCE` a tick, `WATCH_DAY_CAP` an account a day;
- a gate kill's receipt in the region, `GATE_INFLUENCE` (`GATE_WEEK_CAP` a week);
- writs and gifts delivered to the stockpile, one a Silver of materials' value;
- members' homes in the town, `HOME_INFLUENCE_DAY` each, at most `HOMES_SEAT_MAX`;
- Renown earned in the region, one per `RENOWN_XP_PER_INFLUENCE` XP, `RENOWN_WEEK_CAP` a week;
- Tribute, Silver burnt at `TRIBUTE_MARKS_PER_INFLUENCE` per point, at most `TRIBUTE_SHARE_MAX` of the week;
- bounty-board clears in the region, `HUNT_INFLUENCE` each, `HUNT_WEEK_CAP` a week.

One account adds at most `ACCOUNT_SEAT_WEEK_CAP` (2,000) a seat a week. The first guild an account's character
contributes to is that account's guild for the week's war. A character in a guild under `SEAT_MEMBER_WAIT_S` (7 days)
adds nothing. `SEAT_LEGACY_SHARE` (10%) carries into the next week.

**The week** (`seatWeekOf`, `seatPhaseOf`). A real week from Sunday 18:00 UTC. The Muster runs to Friday 18:00; the
Reckoning (`SEAT_RECKONING_MS`) locks pledges and shows the standings. The Turning settles week N the first time
anything asks after its boundary, in one idempotent transaction (`server-account/src/seatTurning.js` `settleWeek`); the
minute clock (`server-account/src/cron.js`) also settles it. In order:

1. totals after caps and reach;
2. unheld seats: guilds past `CLAIM_THRESHOLD` (palace 6,000, crown 30,000) ranked; a runner-up within
   `CONTESTED_MARGIN` (10%) makes it Contested and the two fight a Tourney; else the first that can pay `CLAIM_FEE`
   (8,000 / 80,000 Silver) takes the Charter;
3. held seats: the holder's defence is its influence, scaled by Standing, Overreach and a held last siege, plus Legacy;
4. Rights of Siege: each guild over the threshold and the defence is a candidate, best first, at most one Right a
   guild and one a seat; a seat unchallenged gains Standing;
5. upkeep (`SEAT_UPKEEP`, a crown's scaled by `CROWN_SCALE`); a short treasury means Neglect, and a second short week
   lapses the Charter;
6. a truce for a seat that just changed hands; Legacy kept, Siege Camps spent;
7. the battles scheduled, and a history row and notices written.

**Sieges** (`src/net/siege/siegeRef.js`, run by the relay in `siege:<key>:<week>`). The relay holds every fighter's
vitality (`SIEGE_VITALITY`: 300 + 2 x Renown level) and judges every blow: reach, `SIEGE_BLOWS_HZ`, damage within
DFU's range for the weapon and material, `SIEGE_CASTS`, and a speed limit (`SIEGE_SPEED`, 18 m/s). A siege never
touches a save's health, items or gold. A palace field has three banners (Gate, Market, Temple) and the Throne at the
palace door; holding 2 of 3 opens the Throne, and holding it 120 s takes the seat (`SIEGE_THRONE`). A crown adds the
Palace square banner and a Gatehouse (`GATEHOUSE` in `src/net/fortLaw.js`) broken by melee and a crewed Ram (`RAM`);
3 of 4 banners and the breach open the Throne, 180 s takes it. Battles last `BATTLE_LENGTH_MS` (30 / 45 minutes); at
time the holder keeps it. Respawns come in waves (`SIEGE_WAVE_MS`) at each side's camp.

**Scheduling and sides.** The holder sets a window, Wednesday to Saturday, a start from 16:00 to 02:00 UTC
(`SIEGE_WINDOW_DAYS`, `SIEGE_WINDOW_HOURS`); crowns fight on Saturday at fixed hours (`CROWN_SIEGE_SLOT`). Sides are up
to `SIEGE_SIDE_MAX` (10 / 20) plus `SELLSWORDS_MAX` hired fighters, signing up until `SIGN_CLOSES_MS` before. A side
absent `SIEGE_FORFEIT_MS` forfeits. Up to `SIEGE_SPECTATORS_MAX` watch. A held siege gives Standing and
`SIEGE_DEFENCE_BONUS` to the next defence; honours (`SIEGE_HONOURS`) are paid once a Season between the same two guilds.
Results are signed `s1` receipts (`src/net/siege/siegeReceipt.js`).

**Holding a seat** (`server-account/src/seatHolding.js`). The holder sets a Tithe on the bailiwick's sales up to
`TITHE_CAP`, its members get `MEMBER_DISCOUNT` in its shops, and it proclaims one Edict a week (`EDICTS`: Market Day,
Open Gates, Curfew, Festival, Levy, Bounty; a crown also Conscription and the Royal Tourney). Holding more seats costs
Overreach (`SEAT_WEIGHT`, `OVERREACH`). **Standing** (0 to 100, from `STANDING_START`) moves with the Tithe, Edicts,
sieges, writs and Neglect (`STANDING_CHANGES`); under `STANDING_UNREST` challengers gain `UNREST_BONUS`, and at 0 a
revolt rises (`REVOLT`: a Rebel Captain and 12 rebels). **Fortifications** (`FORT_WORKS`: Walls, Gatehouse, Watchtowers,
Barracks, Market Hall, Shrine, Forge, Workshop, Apothecary, Harbor) are built from the stockpile over `FORT_TIER_DAYS`
and change the battle, never the defence. A Bay seat's Bounty pays for camps cleared; past the Bay it pays for
hideouts and lairs (`BOUNTY_DEN_KINDS`). Holders wear titles and glyphs (`SEAT_CROWN_GLYPHS`); crowns take vassals by
fealty (`FEALTY`).

**Seasons, records and Tides.** A Season is `SEASON_WEEKS` (8) weeks; Season 0 ran `SEASON_ZERO_WEEKS`. Each seat keeps
a Chronicle and a Hall of Records (`HALL_OF_RECORDS_ROWS`). Each kingdom, the Marches and the Free Lands roll one Tide a
week (`src/net/tideLaw.js` `TIDES`) that bends the economy and the Edicts' costs.

## Rules

- Every palace location is a seat; the three castle cities are larger crown seats with more cost, more pay, bigger
  sieges, kingdom reach and rewards of their own (Mac).
- Seats are online only and paid in the server's own currency, never purse gold (Mac).
- One guild a week per account for the seats' war (Mac).
- The Turning and the siege windows as set above (Mac).
- A guild never becomes the king: it holds the town's Charter, layered over the game; a palace's court, quests and
  hours stay DFU's.
- A seat is decided where no client can lie: every influence source is witnessed or bounded, every siege refereed by
  the relay, every moment a function of the clock.
- The seats past the Bay reach everywhere, Cyrodiil's Imperial City included (the owner).
- A Bounty past the Bay pays on hideouts and lairs (the owner).
- Every number lives in `src/net/townSeatLaw.js`; balance is an edit there.

## Daggerfall Unity

DFU has no guild seats; none of this is a DFU member. Siege blows use DFU's own damage tables for weapons and
materials (`characters/weapons.js`, `combat/formulas.js`, pinned equal in `siegeRef.js`) and DFU's melee reach. The
crown castles' fields stand at the castle entrance DFU lands a player at.

## Code and tests

- `src/net/townSeatLaw.js` - every number: week, influence, Turning, Edicts, Standing, seasons
- `src/systems/town/townSeats.js`, `src/net/kingdomLaw.js` - seats derived; kingdoms
- `src/net/siege/siegeRef.js`, `src/net/siege/siegeSession.js`, `src/net/siege/siegeReceipt.js` - the refereed battle, the page's session, receipts
- `src/net/fortLaw.js`, `src/net/tideLaw.js` - fortifications, revolts, Tides
- `src/net/townSeatBook.js`, `src/ui/seatTab.js`, `src/systems/seatEdicts.js` - the page's book, the Seat tab, Edicts in town
- `server-account/src/seatInfluence.js`, `server-account/src/seatTurning.js`, `server-account/src/seatHolding.js`, `server-account/src/seatSiege.js`, `server-account/src/seatBattles.js`, `server-account/src/seatForts.js`, `server-account/src/seatPolitics.js`, `server-account/src/seatRoyal.js` - the service
- `test/net/seat1a_service.test.js`, `test/net/seat1b_service.test.js`, `test/net/seat1c_service.test.js` - seats, influence, the Turning
- `test/net/siege/seat2a_relay.test.js`, `test/net/seat2b_battle_law.test.js`, `test/net/pvpref_measure.test.js` - sieges
- `test/net/crown1_law.test.js`, `test/net/season1_law.test.js`, `test/net/tide_law.test.js` - crowns, seasons, Tides
- `test/net/bayleftsea_bounty.test.js` - the Bounty past the Bay

## Open

- Whether the crown claim threshold falls to a 30-member guild's 90th-percentile week is Mac's call; it stands at
  30,000.

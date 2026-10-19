# THE TOWN ECONOMY (TOWN-ECON, designed 2026-10-16, built 2026-10-16 to 2026-10-18)

Mac, 2026-10-16: "One thing I want to do is enhance the living world module and give every city and village a dynamic
economy system, where even players can affect the influence. Allowing players to hover over towns and see an economy
tooltip along with guild control".

Asked four things, Mac answered:

| Asked | Mac's answer |
|---|---|
| Should a town's economy move NPC shop prices? (Economy arc law 5: "NPC prices are fixed") | "Wider swings, ±25%+" |
| How do players influence a town's economy? | "Witnessed acts only" - acts the account service sees, never gold |
| What is "guild control" for a town that is not a seat? | "Show who holds the area" - the holder of the seat whose bailiwick the town is in |
| Which maps get the card? | "Held Map + Overworld" - the classic travel map keeps DFU's layout |

**Status: TE1 BUILT 2026-10-16** (the baseline, the card, the price), **AUDITED 2026-10-16** (Mac: "Lets audit
everything we have so far" - `01-Overview/audits/Audit-Town-Econ.md`: every finding, and below each fix marked AUDIT TOWN-ECON
and its id). **SEAT-LOOP and LAW-3 BUILT 2026-10-18** - Mac's five calls decided (section 7): the seat's essentials
round trip and the carry between regions closed. **TE2 BUILT 2026-10-18** (section 4: the registry, the four sources,
the read); **TE3 BUILT 2026-10-18** (section 5: the talk of trade, the market days, the chapters' patrons). **SEA-TRADE BUILT 2026-10-18** (section 8: Mac,
"Ensure the sea trade routes plug into this system also" - a port's lanes in its Prosperity, its exchange at its town's
prices, a captain's dealing in the players' share). **AUDITED AGAIN 2026-10-18** (Mac: "Lets audit everything and ensure
perfection" - `01-Overview/audits/Audit-Town-Econ-2.md`, five cold lanes on a frozen snapshot: every finding fixed or
written down, section 9). The constants are kept as section 2 has them (section 7.1).

## 0. What stands, read against the code (2026-10-16)

- **Prices are per region, not per town.** DFU keeps one `PriceAdjustment` a region (`RegionData`), walked each day
  (`shopStock.js updateRegionalPrices`). Online it is ECON1's world walk (`worldTick.js worldRegionPricesOn`): a pure
  function of the world day, the same for everyone, moved by nothing a player does. Every counter in a region asks
  the same index; a counter's own quality (the block record's byte) is the only thing that differs inside one.
- **The living world is pure.** Every resident, trip, caravan and market day is computed alike on every client and
  nothing crosses the relay (`06-Systems/Living-World.md` LW0 decision 2; `06-Systems/Living-World-II.md` LW-II0
  decision 1). Its one service-decided slice is LW15, the patrons (`net/patronLaw.js`, read by both ends). Its price
  and tax talk (`livingWorld/lines.js`) is flavour; no town has economic state.
- **Guild control exists for seats alone.** A town with a Palace, and the three crowns, is a seat
  (`11-Multiplayer/Seats-Arc.md`): one player guild holds its Charter, rules with a Tithe and Edicts, and its Standing
  with the town is kept by the account service. A seat already answers a hover with its card on the Held Map and the
  Overworld (SEAT-TIP, `net/townSeatLaw.js seatTipOf`). Every other town is in some seat's bailiwick when its region
  has a seat (`bailiwickOf`, the Tithe's own rule) and says nothing of it.
- **A seat already moves its own counters.** `seatShopFactor` takes the holder's members' discount (10%, crown 15%,
  +5% while Standing is loved) and Market Day's 10% off what a counter asks, on the buyer's own client and never through
  `regionPriceAdjustment` (Seats-Arc 7.2: that index also sets quest gold). The deepest a seat goes is 0.70.
- **Online, a counter pays at most half what it asks** for the same piece (REALM P0.4, `shopStock.js
  ONLINE_SALE_SHARE`); an essential costs half (ESSENTIALS-HALF), so buying one to sell it back breaks even, no better.
  Across regions the walk already spreads prices: over 4,000 world days from day 3,000 (the walk untilted - FACTION.TXT
  is the player's), one day's dearest region asked up to 2.4 times its cheapest; the span's extremes, on different
  days, were 521 and 1,505 (AUDIT TOWN-ECON LAW-7).

## 1. The decisions (TE0)

Taken at the design. Each is Mac's to overrule.

1. **EVERY TOWN, ONE PROSPERITY.** A town is a MAPS location of type TownCity, TownHamlet or TownVillage (`mapsFile.js
   LOCATION_TYPES` 0, 1 and 2, the set `travelFarPlaces.js TV_FAR_TYPES` and `gateSite.js GATE_TOWN_TYPES` already
   use). Each has one Prosperity, a whole number 0 to 100, 50 the middle, read as one of five bands: Destitute,
   Struggling, Steady, Thriving, Booming. Its cycle is phased by its map pixel (`townKeyOf`, `py * 1000 + px`). An
   Ether isle's place is no row of the Bay's dictionary (`world/etherPlaces.js`), so it has no economy and no card.
2. **THE BASELINE IS THE WORLD'S; THE PLAYERS' SHARE IS THE SERVICE'S.** What the world does to a town - its size, its
   market cycle, a raid at its gates - is a pure function every client computes alike (LW0 decision 2), on the relay's
   clock (AUDIT TOWN-ECON LAW-2). Its seat's rule is the seat list each client last read from the service - one list
   for everyone, read every five to fifteen minutes (`townSeatBook.js` SEAT_LIST_CACHE_MS, SEAT_RED_READ_MS) and only
   where the seats are open to the account - so two players can read a Standing or an Edict a few minutes apart, as
   SEAT1d's own Market Day already is (AUDIT TOWN-ECON CLI-4, DOC-12). What players do to a town is counted by the
   account service and read by every client (TE2), as LW15's patrons are. TE1 and TE2 move no resident; TE3 lets the
   living world read the band, which narrows LW0 decision 2 by one input, as CHAP5b's chapter sheet did - written there
   (`06-Systems/Living-World.md`).
3. **WITNESSED ACTS ONLY** (Mac). A player raises a town by what the service saw happen there - their footsteps in it
   (the relay's signed Watch ticks), trade at its players' traders (the market's sales and LW15's patron sales), and a
   raid driven from its gates. Never by gold: "Assume infinite wealth" (`06-Systems/Economy-Arc.md`) would let one
   fortune hold every town at the top. Each act is capped per account, per town, per day, and the players' share
   saturates (section 2).
4. **THE PRICE MOVES - AN EXCEPTION TO ECONOMY LAW 5, BOUNDED** (Mac: "Wider swings, ±25%+"). Online, a town's
   Prosperity moves what its counters ask, by up to TOWN_PRICE_SWING (0.25) each way: a Booming town asks a quarter
   less, a Destitute one a quarter more. Four bounds keep "the system will fail" contained:
   - **A counter never pays more, nor more than it asks.** What a counter pays for a sale (and the Mages Guild for a
     magic piece - AUDIT TOWN-ECON LAW-5) falls by the same share either side of the middle: a Struggling town has less
     coin, a Booming one is stocked. Its factor never rises above 1, and never above the town's asking factor - AUDIT
     TOWN-ECON LAW-1: as built, a Booming counter's ask fell while its pay stood, and the essentials' half turned a
     round trip of firewood into gold at 134 of 140 counters at Prosperity 51. (The factor, not every sale: MERC-SLOPE's
     own rounding can pay a gold more on a smaller cost - LAW-4 - never a loop.) SEAT-LOOP (2026-10-18, section 7.5):
     and never above what it asks THIS player - a seat's discount (its members', Market Day's) lowers both.
   - **A counter's piece never fetches more than it cost** (LAW-3, 2026-10-18, section 7.4). Online, a piece an NPC
     counter sold carries what was paid for it, and no counter pays more for it - so neither a town's discount nor the
     regions' walk pays a carrier.
   - **The deepest price stays the seats'.** A town's discount and a seat's (members, Market Day) multiply, and the
     product never goes below 0.70, the deepest a seat already gives (TOWN_FACTOR_FLOOR).
   - **Never through `regionPriceAdjustment`.** The factor multiplies the counter's own adjustment
     (`worldModes.js shopAdjustment`), as the seat's does, so quest gold and every other reader of the region's index
     are untouched (Seats-Arc 7.2).

   Offline the town economy does not run: the one player's world prices as DFU's does.
5. **GUILD CONTROL IS SHOWN, NOT NEW** (Mac: "Show who holds the area"). A seat town's card carries its own SEAT-TIP
   lines. Every other town's card names the seat whose bailiwick it is in and the guild that holds it, or that the
   area is unheld. No town gains a Charter, an influence count or any power it lacks today.
6. **THE CARD: HELD MAP AND OVERWORLD** (Mac). One card per town: its economy, then its guild control, then (a seat)
   its Charter's own lines. The classic travel map (TRAV0I00) keeps DFU's label and no card (the native-window rule;
   EVENT-TIP's own reason).
7. **THE LIVING WORLD READS THE BAND** (TE3): the townsfolk's talk of trade and the market days follow the town's band.
   Built 2026-10-18 (section 5).

## 2. The model

**Prosperity** = clamp(0, 100, round(BASE + SIZE + CYCLE + SEAT + RAID + PLAYERS)).

| Term | What | As built (TE0's, decided in 7.1) |
|---|---|---|
| BASE | the middle | 50 |
| SIZE | the town's type | city +6, town +2, village -2 |
| CYCLE | the town's own market cycle: two waves over real (UTC) days on the relay's clock, each phased by the town's key, so every town rises and falls on its own and each player sees the same day | 12 x sin(2π(day / 11 + φ1)) + 6 x sin(2π(day / 29 + φ2)) |
| SEAT | a seat town only, online: its holder's Standing, and the Edict in force (one of the table's own names - AUDIT TOWN-ECON LAW-6) | (Standing - 50) / 5; Market Day +6, Festival +8, Open Gates +3, Levy -6, Curfew -4 |
| RAID | a raid running at the town now (`raidingParties.js raidActive`) | -15 |
| PLAYERS | TE2: the players' share, from the service | 0 to +30 (below) |

The cycle is a closed form - the day's value needs no history - so a player away a month reads what one who stayed
reads, as ECON1 does. The day is the real UTC day, not the sky's (TIME1 turns an online day each real hour, which would
move a town's prices within a sitting).

**The players' share (TE2).** Each day's witnessed acts at a town are summed by source, and the last 14 days are
weighed by DECAY (0.8) a day. The activity A = FOOT_W x footsteps + TRADE_W x sales + RAID_W x raids driven off. The
share is PLAYERS_MAX x A / (A + A_HALF): half the most at A_HALF, and a town crowded by one zerg comes no nearer the top
than PLAYERS_MAX. As built: FOOT_W 1, TRADE_W 4, RAID_W 20, PLAYERS_MAX 30, A_HALF 150; caps an account a town a day:
30 Watch ticks (an hour's walking), 10 sales, 1 raid - and SEA-TRADE's dealings (section 8), weight 2, 10 a day.

**The bands.** Destitute 0-14, Struggling 15-34, Steady 35-64, Thriving 65-84, Booming 85-100.

**The price.** For a Prosperity P:
- what a counter ASKS (Buy, Repair): x (1 - TOWN_PRICE_SWING x (P - 50) / 50), 0.75 to 1.25;
- what a counter PAYS (Sell, SellMagic): x (1 - TOWN_PRICE_SWING x |P - 50| / 50), 0.75 to 1 - never above 1, never
  above what it asks this player (AUDIT TOWN-ECON LAW-1; SEAT-LOOP: the seat's factor in that ask);
- with a seat's factor on what it asks: their product, never below TOWN_FACTOR_FLOOR (0.70);
- and for a piece a counter sold online, never more than was paid for it (LAW-3).

## 3. TE1 - the baseline, the card and the price (BUILT 2026-10-16)

- **The law** (`net/townEconLaw.js`): pure, imported by the client and by the service (TE2). The terms of section 2,
  the band, the two factors and the floor, and the card's lines (`townTipOf`), every word through the text core
  (`t()`, the `town.econ.*` keys, drafted in-session for every machine language - L10N4). The players' share is an
  argument (TE2's read, section 4).
- **The town's word** (`systems/town/townEcon.js`, wired by the world host): the Prosperity of a town by its map id, the
  factor a counter applies, and the card. It reads the town's location from the world's own index, the seat from the
  seat book the world already polls, the raids from the raid state, and the day from the relay's clock (`battleNowMs`,
  AUDIT TOWN-ECON LAW-2: it read this machine's own, so a clock set by hand chose the town's day and its prices).
  Online only: offline it answers the seat's factor (1) and no card. A seat whose place has no economy keeps
  SEAT-TIP's own card on both maps (AUDIT TOWN-ECON CLI-3); its factor is SEAT1d's on what a counter asks, and since
  SEAT-LOOP (7.5) it bounds what the counter pays too (`Math.min(1, seat)`).
- **The price.** `worldModes.js shopAdjustment` asks the host's `townShopFactor` first; the host hands in the seat's
  factor and the law applies it: a Buy's or a Repair's factor is the town's asking factor times the seat's (never
  below the floor); a Sell's or a SellMagic's the town's paying factor, never above that ask (SEAT-LOOP, 7.5; AUDIT
  TOWN-ECON 2 CLI-5, PRICE-7, REC-5: this sentence said "the town's paying factor alone" after SEAT-LOOP had changed
  it). Without it (a host that wires none) the seat's factor stands on what is asked as SEAT1d left it, and AUDIT
  TOWN-ECON 2 PRICE-4 bounds what is paid by it there too (`shopAdjustment`'s own fallback). The temple's cure and
  curse-lifting and the guilds' training and spells read the region's index themselves (`worldModes.js`), not a
  counter's: they keep the region's price (AUDIT TOWN-ECON 2 CLI-9).
- **The card.** The Held Map's place marks (`heldMap.js _hoverLabel`, the world sheet's `townTipAt`) and the
  Overworld's plates (`travelViewMarks.js`, `tip`) show `townTipOf`'s card for every town: the economy out of 100 and
  the market's trend (AUDIT TOWN-ECON UI-3: yesterday is read on today's seat and raid, so the trend is the market
  cycle's, and the card says "Market rising."), the prices as shares of the region's usual prices - what everyone is
  asked, Market Day in it (UI-4) and since AUDIT TOWN-ECON 2 PRICE-3 in what it pays too (SEAT-LOOP's bound), one
  rounding for both numbers (UI-7) - the strongest reason, then the guild's lines.
  A held seat's card leaves out its Charter line, its holder line naming the guild again (UI-1), so a town card holds
  up to TOWN_TIP_LINES_MAX (7) lines (TE3's patrons' line only where there is room - AUDIT TOWN-ECON 2 LIV-3), and
  `.hmtip` is bounded in height as CARD-FIT bounded it in width (UI-1: the
  eight-line card ran 36 px past a 640x360 landscape phone). The area's line is worded in the player's language round
  the town's (or the crown's kingdom's) name and the guild's own (UI-2); a seat's own SEAT-TIP lines stay the seats'
  English. The Held Map asks a showing card again at its poll, so a still pointer follows a new Standing or Edict
  (UI-6). Every other card keeps EVENT-TIP's five lines. On the Held Map a raided town answers with the raid's card
  (EVENT-TIP stands first under the pointer); its own card, naming the raid, is the Overworld's (UI-5, decided).

- **Pinned** in `test/systems/townecon.test.js` (TE1's 10 tests; 16 with SEAT-LOOP's, LAW-3's and TE2's law), and
  `node tools/mutate.mjs tools/mutants/townecon.json`: 67 mutants, 67 dead (TE1's 54 - each audit fix's
  `TOWNECON-AUDIT-<id>` - and SEAT-LOOP's 2 and LAW-3's 11; AUDIT TOWN-ECON 2 REC-7). SEAT-TIP's seat-only card maker left `world.js` (the
  town's card carries a seat's lines), and its pins moved with it (`fb1004e_overworld`, `tv5_far_places`; the two
  SEATTIP mutants re-aimed and dead); SEAT1d's own pin on `shopAdjustment`'s factor line moved with that line
  (`seat1d_client`).

The four hosts (THE FOUR HOSTS RULE): the counter's price is `worldModes.js`'s (interiors), where every shop stands -
wired. `world.js` wires the town's word and the Overworld's card. `dungeonContext.js` opens no counter of a town (the
Identify spell's window alone) - FLAGGED, not changed. `exterior.js` builds the interiors' modes too, as the
`?exterior` development host the online door never opens, and wires neither the seat's factor nor the town's - FLAGGED,
not changed (AUDIT TOWN-ECON DOC-7). A counter that opens outside an interior (LW11's caravan door, the merchant yards,
the shipyards) prices as it did, the yards at their own neutral index on purpose (`merchantYards.js
YARD_PRICE_INDEX`).

## 4. TE2 - the players' share (BUILT 2026-10-18)

Mac, 2026-10-18: "Everything". AUDIT TOWN-ECON DOC-1 and DOC-2 rewrote the design before it was built: as first
written, the tally was keyed by pixel and counted every Watch tick and every trader's sale "at its board's pixel" - but
the client kept a Watch receipt only at a seat's pixel (`townSeatBook.js` `keepWatch`, `isSeatPixel`), a trader's stall
row names its town by map id (`market_listings.vendor_map`) and no pixel, and a patron's sale names its map id. As built:

- **The key is the town's unsigned map id** - the seats', the homes', the stalls' and the patrons' own. The law's lines
  (`net/townEconLaw.js`: TOWN_ECON_SOURCES, _WEIGHTS, _CAPS, _DECAY, _DAYS, _HALF, `townActivity`, `townPlayersShare`, the
  report) are read by both ends; the service is `server-account/src/townEcon.js` (acct156, migration 0132; acct155 and 0131 until GRANT2 took them on main).
- **The town registry** (`POST /v1/towns/witness { town: { map, px, py, region, location } }`). The service learns which
  town stands at a pixel, and which map id a raid's `region:location` names, from the clients' word, agreed: the kind
  `town` of `world_witness` (Seats-Arc 3.2), three accounts a week registered giving the same report confirm it
  (nodeLaw.js witnessedFact) into `town_econ_towns` - one a map id, one a pixel, one a place; the first confirmed stands -
  after which the key takes no more reports (`why: 'known'`), so a town's rows stay a handful and it has no dispute. A
  guest is refused, a young account not counted, TOWN_WITNESS_HOUR (12) reports an hour. The client reports the town it
  walks into once a UTC day, until counted or known (`net/townEconBook.js` witness, at the entry edge beside the halls'
  witness). An act at a pixel or a raid the registry has not confirmed counts nothing.
  AUDIT TOWN-ECON 2 SVC-1 (the audit's MED: three aged accounts confirmed junk map ids at real towns' pixels and places,
  48 towns an hour, before any honest report, and the true town could never stand - every town reachable in days, not
  "one town's share" as this page had it): a report is a WALK - it goes with the relay's signed Watch tick that stood
  this account at the town's pixel (`receipt`; none, another's, another pixel's or an unsigned one is `town-unwalked`),
  and the client sends it with its newest tick there, a town walked into before its first tick waiting for one; a map
  id names its own pixel (`townEconLaw.js` townPixelIdOf: DFU's map id's low 20 bits are its pixel's id), so a report
  of another pixel's is none; the hour's reports a walk's (12, one a WATCH_TICK_MS); and a developer STRIKES a false
  town (`/town strike <map id>`, `POST /v1/towns/strike` - its row, reports, acts and days go, the map id never
  witnessed again: `town_econ_struck`, the halls' and the seats' strike) after reading the region's registry
  (`/town audit`, `POST /v1/towns/audit` - each confirmed town beside the town this client's own map holds at its
  pixel, a false one said FALSE, and the accounts that confirmed it). A town the registry did not take (its pixel or
  place another's) is told `taken` and its reports let go (SVC-6: it was told `confirmed` and kept taking reports for
  good), and is reported again the next day, so a struck false town's true one stands. Every report of a key is read
  (SVC-4: the oldest 64 alone, so earlier dissents could hold a true town off), and the key is `1:<map>` (SVC-11, the
  halls' versioning). LIMIT: a pose is the client's word, so accounts posing at every pixel could still walk a list in -
  a tick each two minutes a pixel, three accounts a town, and a strike to undo it; the reward one town's share each.
- **The tally.** `town_econ_acts (account, map, day, src, n)` - each account's count a town a real (UTC) day by source,
  the cap asked in the write (`ON CONFLICT ... WHERE n < cap`) - and `town_econ_days (map, day, src, n)`, the town's
  day, moved only where the account's mark moved (`changes()`), so a capped act counts nothing. (Named `acts`, not the
  design's `marks`: Marks are the service's currency.) The hourly sweep drops the acts and the days past TOWN_ECON_DAYS,
  and the ticks seen past a receipt's life and a day's skew (AUDIT TOWN-ECON 2 SVC-5: an older tick is refused by its
  own expiry).
- **The sources**, each counted on its own day:
  - Footsteps (`POST /v1/towns/watch { receipts }`, TOWN_WATCH_CLAIM_MAX 12 a claim): the client keeps the relay's
    signed Watch ticks at EVERY town's pixel - a book of its own (`net/townEconBook.js` keepWatch, handed the tick
    beside the seats' and the Motherlodes' books at `online.onWatch`), so the seats' `keepWatch` is unchanged - and
    claims a claim's worth, or the oldest after ten minutes (AUDIT TOWN-ECON 2 CLI-4: looked at by every reader's ask,
    where only a new tick at a town had asked). The service verifies each tick, counts it once (`town_econ_seen`) at
    the registry's town for its pixel on the tick's own UTC day while that day is kept (SVC-9: a tick a moment past the
    service's midnight is today's), for the account it names and a week registered - and, AUDIT TOWN-ECON 2 SVC-2 (the
    Integrity arc's INT16), whose realm character is seated and unheld, as the seats' Watch asks (`progress.js`
    PROGRESS_ROUTES; it earns its player nothing, so it spends no bucket). SVC-5: the claim reads first what the account
    has counted on the ticks' days and which ticks were seen - a tick past its town's cap, or seen before, writes
    nothing (one player a day in one town had written 720 seen rows and 2,160 statements for 30 counted) - and SVC-12
    the towns of every tick in one read; the answer names the pixels whose footsteps are full today (`full`), where the
    book keeps no more ticks until the day turns.
  - Trade: a trader's sale (`market.js` marketBuy, both currencies' batches) counts at the listing's `vendor_map` for its
    buyer, a week registered, by the sale's own row; a patron's purchase (`reckonPatrons`, behind the sale's
    `mustChange`) at its `map` for the trader's seller, on the hour's own day.
  - A raid driven off (`raids.js` claimRaid's `econ` hook): the relay's cleanse receipt counts at the registry's town
    for its `region:location`, by the claim's own row, for an account a week registered.
- **The read** (`POST /v1/towns/econ {}` - a POST, as the family's chapter sheet and seat list are, not the design's
  GET): `{ towns: [[map, share], ...] }`, every town whose share is TOWN_ECON_SHARE_LEAST (1) or more, one decimal,
  computed by the law over the days kept. AUDIT TOWN-ECON 2 SVC-3 (every isolate read every town's days of the
  fourteen each 300 s, on the primary - SEAT-FACTS' shape before SEAT-FACTS, 84,000 rows a read at 2,000 towns): the
  minute's clock counts them once a keeping (`cron.js` `town-shares`, `townEcon.js` keepTownShares) into the one row
  `town_econ_kept`, which the isolates read and hold TOWN_ECON_ISOLATE_S (60 s); counted on the ask only where no row is
  kept yet. CLI-8: the read stands back while the service is overloaded (`busyLaw.js` BUSY_READS). SVC-7: TOWNS_OPEN
  'off' shuts the doors (`towns-closed`, which stops the book for the page) and the clock's count - the load shed by a
  variable, as the seats', the market's and the chapters' are; a sale's and a raid's two statements still ride their
  own batches (SVC-8: the hour's share of the clock fell from 40 statements to 37 a job, and a patron's sale costs two
  more - accepted). SVC-10: a patron's sale counts for its seller without the week registered every other source asks
  - the seller keeps a home and a hired trader in the town, which a new account has not. The client holds it as the
  chapter sheet is held (read once a keeping, synchronous to its readers, stopped by an account's refusal), and
  `systems/town/townEcon.js` reads it as the town's `players` by its map id.
- **The host** (THE FOUR HOSTS RULE): `world.js` wires it - `scenes/townEconHost.js` builds the reading and the book
  (HOST-SPLIT: the module the host wires - the call grew its `typeAt` line, `townTipAt` folded into its one reader, and
  the entry's witness line is the one line in: bootWorld 21,185 to 21,186 code lines, at its ceiling; SEA-TRADE's
  `locAt` and AUDIT TOWN-ECON 2's `clockHeard`, `seatsHeard`, `onBandsReady`, `regionHere` and the `/town` word are
  properties and statements on lines that stood - bootWorld still 21,186). `worldModes.js`
  prices with the reading as TE1 did; `dungeonContext.js` and `exterior.js` take no tick and walk into no town - none
  wired, as TE1 flagged them.
- **Pinned**: `test/server/townecon_service.test.js` (9: the registry, the footsteps, SEA-TRADE's dealing, the read,
  AUDIT TOWN-ECON 2's registry defences, trade, the patrons, the raid, the sweep), `test/net/townecon_client.test.js` (7:
  the shares, the footsteps, the registry, the host module, the door and the wiring, SEA-TRADE's book, AUDIT TOWN-ECON
  2's client fixes), the law in `test/systems/townecon.test.js`; `node tools/mutate.mjs tools/mutants/townecon2.json`:
  38 mutants, 38 dead, and AUDIT TOWN-ECON 2's in `tools/mutants/townecon5.json` (section 9).

## 5. TE3 - the living world reads it (BUILT 2026-10-18)

Mac, 2026-10-18: "Everything". LW0 decision 2 narrowed by one input, written there (`06-Systems/Living-World.md`): online,
a town's economy band (`net/townEconLaw.js` townBandOf over its Prosperity - TE1's terms and TE2's share, as the card
reads it). Offline there is no band and the living world is LW0's and LW9's.

- **The talk of trade** (`livingWorld/lines.js` townEconNews, `livingTown.js` econNews): a town not Steady tells its
  band's news on TOWN_ECON_NEWS_DAYS (3) of the week, its own drawn on the seed by the town (the chapters' offsets,
  `dayPlan.js` GUILD_DAY_OFFSETS) - "Trade has never been better in {town}." / "Every stall sold out by noon." (Booming)
  to "Half the shops in {town} have shut." / "Hard times. Hard times." (Destitute) - told beside the town's other news
  (`lineCtx`), read live off the band (`pixelBuild.js` econBandOf, the reading's `bandOf`). Through the text core
  (L10N4: the ratchet holds `lines.js`'s 823), drafted in-session for every machine language; each pool kept while
  the language holds, so a script is its pool's own (AUDIT TOWN-ECON 2 LIV-12: its words read again only when the text
  core's revision moves - every built town's talk asked them each frame). LIV-7: the trade's lines are the one pool of
  the townsfolk's talk in the player's language - the other 823 are LW0's English, as the ratchet counts them - so one
  town's talk can be two languages until the rest are routed (L10N's owed list). LIV-5: the drafts keep the town's name
  out of a case its preposition would ask (ru, pl, cs and uk say "in the town of {town}", as TE1's area lines do; ko
  "{town}에서는"); LIV-15's drafting nits redrafted (hu, sv, tr, fi, fr).
- **The market days** (`trips.js` marketDay, LW9's): a Booming town holds a second market day a week, MARKET_BOOM_DAY
  (4) after its own; a Destitute one keeps its own day one week in MARKET_DESTITUTE_WEEKS (2); every other band, and no
  band, LW9's one in seven. A carter asks the market town's band of the trips' world (`marketBandOf`), which the town
  economy's host keeps a town a living-world day (`scenes/townEconHost.js`), read at its first asking, so a day's market
  and the plans made round it never change under it. AUDIT TOWN-ECON 2 CLI-1 (LIV-1, REC-3 - the audit's MED: a page's
  first pass froze the bands of a carter's whole window before the players' shares and the seat list had answered, so
  a Booming town lost its second market day for hours on every page loaded since): the band is kept only once both
  have answered (`book.heard`, the world host's `seatsHeard`); before, it is answered and not kept, and when they land
  the trips planned on it are made again (`onBandsReady`: the trips' memo let go). What stays, and is written down
  here as it is: a band is the band at its first asking - a carter's cycle asks days up to a week ahead, an hour of real
  time a day online - so two pages agree on the days both first asked after the same reads, and a band's crossing
  reaches a carter's market days at the next cycle he plans; the talk reads the band live. LIV-8: the bands kept are let
  go oldest first past MARKET_BANDS_MAX (4096), where the whole was wiped. LIV-6: Destitute is a misgoverned seat city's
  in a raid's ten minutes, and Booming at a town that holds no seat comes only with the players' share - the bands'
  thresholds are TE0's (7.1), and those two days are rare as their states are. LIV-14: a Destitute town's fortnight
  always falls inside a carter's online window because that window is fourteen sky days (`trips.js` paceScale at
  TimeScale 24) - written beside MARKET_DESTITUTE_WEEKS.
- **The chapters' patrons on the card** (`net/chapterSheet.js` patronsIn; `townEconLaw.js` townPatronsLine): the player
  guilds that hold the patronage of a chapter in the town's REGION - a hidden guild's chapter's never - each once, the
  most chapters first (AUDIT TOWN-ECON 2 LIV-11: by name alone a guild whose name began with A was always shown), the
  first TOWN_TIP_PATRONS_MAX (2) by name and the rest a count ("and 3 more" - LIV-3 and LIV-10: three long names ran the
  line past SEAT_TIP_TEXT_MAX in three languages, cut mid-tag, and a held seat's card in a Tourney week made it a seventh
  line wrapped to five rows past a landscape phone), "in the region" (the line above says "area" of the seat's
  bailiwick), last on the card and only where the card has TOWN_TIP_PATRONS_ROOM (5) lines before it. CLI-2: the
  region's list made once a sheet read (`chapterSheet.js` patronsIn - the Overworld asks the hovered card each frame,
  and each ask walked and split every key of the sheet: 235 to 411 µs a frame). LIV-4: "chapter" drafted in each
  language's own word for a guild's chapter (ru отделение, bg клон, ro filială, hu páholy, nb avdeling, nl afdeling,
  sv avdelning, uk відділення), where eight had a church's. A departure from the design's "the
  town's halls": a chapter is its region's (Chapters-Arc), and a far town's halls are known to no client until it is
  built.
- **The hosts**: `world.js` hands the trips' world the market band and the town economy the chapter sheet (a property
  and an argument on lines that stood - bootWorld 21,186, at its ceiling), and the pixel builder the town economy
  (`townEcon` in its host's list - AUDIT TOWN-ECON 2 REC-4: the third edit, unrecorded here and unpinned, and a living
  town's talk throws without it); `pixelBuild.js` (the module bootWorld wires) hands the living town its band; travelViewMarks reads the town economy's own card maker (the HOST-SPLIT seam: a
  binding its host declares). `worldModes.js`, `dungeonContext.js` and `exterior.js` hold no living town and no trip -
  none wired.
- **Pinned**: `test/systems/livingWorld/townecon_living.test.js` (5 - AUDIT TOWN-ECON 2 LIV-2, REC-2: the carter's pin
  makes its trip now; its trip had been null, so its day was never asked); `node tools/mutate.mjs
  tools/mutants/townecon3.json`: 14 mutants, 14 dead.

## 6. Not changed

- The classic travel map, and the classic skin's counters offline.
- What a counter pays never rises, and nothing a player pays in gold moves a town.
- SEAT-TIP's own lines (`townSeatLaw.js seatTipOf`), worded in English for every language, as they were.
- The Overworld shows no card on a tap without movement (`travelViewHud.js` reads the pointer on a move alone) - as
  before TE1, for every card on it; the Held Map's tap shows the town's (AUDIT TOWN-ECON UI-10, not this slice's).
- A counter's shelf: Prosperity moves prices, never stock (section 7.2).

## 7. Mac's calls (decided 2026-10-18)

Mac, 2026-10-18, asked the five: build "Everything"; the carry, "Whatever is the best option"; the seat's round trip,
"Close it"; the numbers and the shelves, "Whatever is the best decision".

1. **THE NUMBERS** - kept as section 2 has them: the swing 0.25 (Mac's "±25%+"; at 0.30 a Booming town alone reaches
   the floor), the sizes, the cycle's waves, the seat and raid terms, and TE2's weights, caps and saturation. Each is
   one constant in `net/townEconLaw.js`, pinned there.
2. **THE SHELVES** - not widened. A counter's stock is DFU's, rolled by its building's quality (`shopStock.js`); a
   Booming town's shelf grown by Prosperity would let TE2's players' share, which players move, farm a town's rare
   stock. Prosperity moves prices alone.
3. **TE2 and TE3** - built, in that order (sections 4 and 5).
4. **THE CARRY BETWEEN REGIONS** (AUDIT TOWN-ECON LAW-3) - CLOSED: a counter's piece never fetches more than it cost
   (LAW-3). Of the three answers it is the one that holds whatever the numbers become: TE2's share lifts towns toward
   Booming, and a Booming town's ask is what the carry bought at, so a narrower swing would have been narrowed again
   by the players. Measured before (the best haggler, a value-1,000 blade, quality 10): a carry from the cheapest
   region's town to the dearest's paid on 136 of 4,000 world days before TE1 and on 1,752 after, its average gain from
   16 gold to 28 - and an essential (half its price online, ESSENTIALS-HALF) paid wherever the dearest region asked
   more at all. Online, a counter's Buy marks each piece with its share of the lot's price (`systems/tradeModes.js`
   markCounterBought: each piece's own ask at one counter by the purchase's own holiday and guild - AUDIT TOWN-ECON 2
   PRICE-1: by the no-holiday asks a Warriors Festival's halved weapon held the armour bought beside it to less than it
   cost and itself to more, a carry of +10,560 a trip - a gold a piece first where the lot paid one (PRICE-5: a cheap
   stack bought beside a dear piece floored to 0), the rest floored a piece - `counterPaid`, `net/patronLaw.js`
   COUNTER_PAID_MARK, beside AUDIT LW-II-2's `counterBought`; and PRICE-6 the value it was bought at, `counterValue`, so
   an improvement since - a gem set, a hone, a reforge - sells as the player's own work), kept through the save, the
   item law, the wire and a stack's merge (the lower of two) and split; a sale's walk tallies those pieces (`tradeCost`'s
   `resale`) and `getTradePrice` pays them at most what was paid, the rest of the lot haggled on its own and the whole
   lot's price never passed. Every sale price hands the tally on: the classic window's offer, the enhanced window's
   quote and offer, the keyed shelf (`worldModes.js` sellPrice) - the enhanced window's quick sale too, which its
   candidate test keeps shut (`isQuickSellCandidate()`, PRICE-7). A piece found, crafted, rewarded or bought before this
   carries no price and sells as it did. AUDIT TOWN-ECON 2 PRICE-2 (the audit's HIGH: the mark washed off for free) - A
   COUNTER'S PIECE IS NO SERVICE UNIT: a Stores put-in of a bought material came back out of a withdrawal minted fresh,
   unmarked (+24,125 on 10,250 of Diamonds at twenty dear counters), so the bag's hands count the service's units
   without it (`materialsBag.js` heldOf `counter`, counterPiece), take it last and only for a station's own put-in (a
   craft, a brew, a smelt, a temper - which spends it there and then); the Stores page, a writ and the market never put
   it in, and a station still works it from the pack (`profBook.js` carriedWorkable, `deposit`'s `counter`). And a
   stone a counter sold keeps its mark on its socket (`socketBought`: set, its share of the piece's sale held to what
   it cost; extracted, it comes out marked as it went in; shattered, gone - `reforge.js`; a Diamond set and extracted
   had paid +282 over its 200-gold fee). LIMIT: a station's put-in whose craft is then refused leaves its counter's
   units in the Stores; LAW-3 is the client's honour throughout, as every counter's price is. Pinned through the real trade walk: a blade, a Daedric dai-katana, five
   firewood and a potion bought at index 500 in a Booming town and sold at 2,500 in a Steady one, every shop quality
   both ends, never pay (they did without the cap). The hosts (AUDIT TOWN-ECON 2 REC-12): `worldModes.js` and the two
   windows carry the mark, the tally and the factor, through `world.js`'s town economy; `dungeonContext.js` opens no
   counter's Buy or Sell; `exterior.js` builds the interiors' modes offline, where nothing is marked.
5. **THE ESSENTIALS' ROUND TRIP AT A SEAT TOWN** (found by the audit; SEAT1d's, live before TE1) - CLOSED (SEAT-LOOP):
   what a counter pays falls with what it asks this player (`townEconLaw.js` townShopFactor: the sale's factor never
   above the ask's, the seat's folded in; `systems/town/townEcon.js` shopFactor: where the seat's place has no economy,
   or offline, the seat's factor bounds the sale too). Before, a seat's discount lowered what its counters asked its
   holder's members, and Market Day what they asked everyone, while what they paid stood: five firewood at a
   quality-10 counter at the region's index cost 13 and sold for 15 on Market Day. Pinned through the real trade walk at
   every seat factor (Market Day's 0.90 for anyone, a member's 0.90 and 0.80 on Market Day, a crown's member 0.85, a
   loved member on Market Day 0.75, the deepest 0.70), Prosperity in steps of two, every quality and four region
   indexes (AUDIT TOWN-ECON 2 REC-15). AUDIT TOWN-ECON 2 PRICE-4: the bound where the price is made too -
   `worldModes.js` shopAdjustment's own fallback (no town law wired) holds a sale to the seat's factor, and LW11's
   friend's counter on the road gives its friend's price both ways, so its endless Campfire sold back never pays (it
   had, but for LAW-3's mark). The card says what is paid as the counter pays it (PRICE-3, REC-1: it said the town's
   paying factor alone, wrong on Market Day at 61 Prosperities of 101). The hosts: as 7.4's.

## 8. SEA-TRADE - the sea's trade in the town economy (BUILT 2026-10-18)

Mac, 2026-10-18: "Lets audit everything and ensure perfection. Ensure the sea trade routes plug into this system also".
The Bay's sea trade is ours, not DFU's (DFU has no exchange and no packets: `03-World/Captains-Sea.md` CAPT-TRADE,
`03-World/Living-World-II.md`'s lanes), so each piece below departs from nothing in DFU and is named against our own
arcs. Online only: offline there is no town economy, and the exchange and the lanes are as they were.

- **A port town's lanes in its Prosperity** (`net/townEconLaw.js` townSeaTerm, `townProsperity`'s `lanes`): each of the
  Bay's packet lanes that ends at the town's port (`systems/naval/seaLanes.js` laneNetwork - every client's the same,
  made once off the map) adds TOWN_SEA_LANE (2), TOWN_SEA_LANES_MAX (3) of them at most - a busy port +6, a world term
  as the size and the cycle are, the same for every client. The host counts them once the lanes stand
  (`scenes/townEconHost.js` lanesAt; BOOT-TDZ II: before, the map unread or the lanes' bindings not yet declared, it
  answers none and asks again). The card says "Its harbour brings trade." where no raid, Edict or players' share is
  nearer (`townReasonLine`).
- **The exchange at its town's prices** (`systems/naval/tradeGoods.js` exchangeOf's `town`; `townEconLaw.js`
  townExchangeFactors): what the port's exchange sells a captain at the town's asking factor, what it pays at its paying
  factor, the pay held to the ask (`Math.min`) - so the exchange's own spread only ever widens, it never buys at what it
  sells (AUDIT 2's rule held at every Prosperity, port, good, day and the captain's every edge), and a round trip at one
  port never pays. No seat's discount: a seat's is its shops'. A Booming port's goods are cheaper and a Destitute one's
  dearer; a Steady port's are as they were. The harbour office asks the port's town of the town economy
  (`harbourOffice.js` townAt, deps `town`), and the Exchange tab says the band (`navalYardWindow.js` exchangeText,
  `sea.exchange.band`). An isle past the Veil has no town economy (the host answers none for an `ether` port).
- **The port's town is its pixel's**: the port list (`world.js` navalPortList) places a port at
  `getPixelFromPixelID(summary.id)` and the town index at `longitudeLatitudeToMapPixel` of its MAPS record - one pixel,
  since DFU keys the map's summaries by a map id's low 20 bits and asks them by a pixel's id (`ContentReader.cs`
  `mapDict`, HasLocation's `MapsFile.GetMapPixelID(x, y)`; ours `systems/map/mapDirectory.js` buildMapDict), which
  `getPixelFromPixelID` inverts. The host reads the town at the port's
  pixel (`locAt`, the world host's `locationIndex` record's `mapTableData`).
- **A good bought of the exchange carries what it cost** (`harbourOffice.js` buyGood: `tradeModes.js`
  markCounterBought with the purchase's price, before the hold's stack takes it): LAW-3's `counterPaid` and AUDIT
  LW-II-2's `counterBought`. No shop buys the exchange's goods (`shopStock.js` shopBuysItem - AUDIT CAPTAIN'S SEA B2),
  so the mark's work is the patron's wall - no patron takes a good the exchange sold (`patronLaw.js` patronTakes) - and
  any counter that ever took one would pay no more than the exchange was paid.
- **A captain's dealing in the players' share** (TOWN_ECON_SOURCES `sea`, TOWN_ECON_WEIGHTS 2, TOWN_ECON_CAPS 10): every
  purchase and sale at a port's exchange is told to the town economy (`harbourOffice.js` `deps.town.seaDeal`), and the
  book (`net/townEconBook.js` seaDeal) vouches it with the newest Watch tick unspent that stood the captain at the port
  - within TOWN_SEA_REACH_PX (1) of its pixel (a ship at the quay, as the harbour office's own reach) and TOWN_SEA_TICK_S
  (600) old at most. One tick vouches one dealing. A tick at the town's pixel is the footstep the book already keeps; one
  beside it (the quay) is held now for the claim. The claim names the vouching ticks (`POST /v1/towns/watch { receipts,
  sea }`), and the service counts each once more as a `sea` act (`<ref>:sea` seen) at the registry's town at the tick's
  pixel, or the nearest beside it within the reach (a tie the lower map id), under the account's cap, for an account a
  week registered whose realm character is seated (the Watch's claim, INT16 - AUDIT TOWN-ECON 2 SVC-2) - the footstep
  counted as ever, a dealing past its cap or seen before writing nothing (SVC-5). Weighed half a trader's sale: a sale is this service's own record, a
  dealing the client's word that a tick vouches (a pose's worth, as the footstep is) - ten dealings a town a day are 20,
  a trader's ten sales 40. A young account's, a tick two pixels off and a tick spent count none.
- **The hosts** (THE FOUR HOSTS RULE): `world.js` hands the town economy the MAPS location at a pixel and the lanes
  (`locAt`, `portLanes` - the line that handed `typeAt`, the location's type, now hands the location) and the harbour
  office the town economy (`town: townEcon`, on the line that stood): bootWorld 21,186, at its ceiling. `worldModes.js`,
  `dungeonContext.js` and `exterior.js` hold no exchange and no port - none wired.
- **Not changed**: the exchange's stock (DAY_STOCK) and the goods' drift - Prosperity moves prices, never stock (7.2);
  the lanes' ships; the captain's ledger.
- **Pinned**: `test/systems/naval/townecon_sea.test.js` (5: the law, the exchange, no loop out of it, the harbour office,
  the host module), the dealing's claim in `test/server/townecon_service.test.js` and its book in
  `test/net/townecon_client.test.js`; `node tools/mutate.mjs tools/mutants/townecon4.json`: 28 mutants, 28 dead.

## 9. AUDIT TOWN-ECON 2 (2026-10-18)

Mac, 2026-10-18: "Lets audit everything and ensure perfection". Five cold lanes - the price laws, the account service,
the client's book and wiring, the living world and the card, the record - read the work at 61bf1707de (TE1 to TE3,
SEAT-LOOP and LAW-3) on a frozen snapshot; SEA-TRADE (section 8) was built beside them and audited against the same
findings. Every finding, its probe and what was done: `01-Overview/audits/Audit-Town-Econ-2.md`. In short:

- **Fixed**: the registry's poisoning (SVC-1: a walk's tick, the map id its pixel's, a developer's strike and audit);
  LAW-3's wash through the Stores and a socket (PRICE-2); the holiday's split (PRICE-1); the market band frozen
  before the reads (CLI-1); the town Watch outside INT16 (SVC-2); every isolate reading every day (SVC-3); the hovered
  card's per-frame cost (CLI-2); and each LOW and NIT the table names fixed but those written down here (LIV-6, LIV-7,
  SVC-8, SVC-10) and one recorded equivalent mutant (LIV-12's memo, a cost).
- **Pinned**: `test/systems/townecon_audit2.test.js` (4: the price lane's fixes) and each fix in the file of what it
  fixes; `node tools/mutate.mjs tools/mutants/townecon5.json`: 60 mutants, 59 dead and 1 equivalent as recorded.


# AUDIT LW-II-2 - THE LIVING WORLD II, AUDITED AGAIN, WHOLE, 2026-10-10

Mac: *"Can you do an audit on everything. Make sure its perfection"*, of PR #749 at `2d15046fd1`: every slice of the
Living World II (LW9-LW16, `06-Systems/Living-World-II.md`), the first audit's fixes (`01-Overview/Audit-LivingWorld-II.md`,
AUDIT LW-II) and the day's two merges from main (#741-#744's wagons, gems and balance; #743's FIELD BUGS 2026-10-10).

## The method

- **Find.** Seven independent reviewers over a frozen snapshot of the head, read-only, every claim reproduced by a
  script of its own against the real modules (the real account Worker over node:sqlite; world.js's own text lifted out
  and run; the tests' synthetic map with its real `fate`):
  - **R - the road** (LW9 the traffic, LW10 the wagon train, LW13 the companies);
  - **C - the caravan's door and the outlaws** (LW11, LW12);
  - **D - the deep's own** (LW14);
  - **S - the patrons' service** (LW15's `server-account/` half and `net/patronLaw.js`);
  - **W - the patrons seen and the word** (LW15's client half, LW16);
  - **H - the hosts, the save and the merges** (every slice's seams, the four hosts, `relations.js`, the relay);
  - **P - the pins' truth and the records** (67 new mutants written against the slices' laws - 47 survived; every
    record and patch note against the code).
- **Every earlier mutant re-run on the merged tree first**: the 26 lists the PR touched, 1,281 records - 1,277 dead, 4
  equivalent as recorded, none stale, none failing to apply.
- **Fix.** Six fixers, each in its own worktree off the head, the lanes' files disjoint (world.js split by region); the
  records written by the lead. Each fix pinned by its finding's id in its lane's file (`test/auditlwii2_<lane>.test.js`)
  and mutation-proven in its list (`tools/mutants/auditlwii2_<lane>.json`, records `AUDITLWII2-<id>-...`); the P lane's
  surviving mutants carried into the lists once a pin kills them. A pin elsewhere a fix moved says so where it stands
  (`PIN MOVED (AUDIT LW-II-2 <id>)`); an earlier record a fix moved is re-aimed by content, its name kept.

Findings seen by two lenses are pinned once, under the first id: C5 = H6, C6 = H1, C11 = W8, D4 = H5, W3 = H8,
W4 = H4, S6 = P8, D12 within P13.

## R (with D3, P6, P17) - the road (`test/auditlwii2_road.test.js`, 17; `auditlwii2_road.json`, 45)

All FIXED:

- **R1 (HIGH) - a party struck down to the last left a ghost train and an empty campfire to its trip's end**: the road
  layer laid the party's places and team without asking who stood (its Overworld mark did ask). FIXED: nobody standing,
  nothing laid - no body, no team, no camp, no fire.
- **R2 - the passing exchange repeated every beat**, began on the reply half the time, and its warning came from the
  party that met no trouble when it had the higher id. FIXED: said once from the first beat the two are near, the
  warned party first, then silence - pure, the same line for every reader.
- **R3 - a morning's trouble met while the party still lodged at its inn** pulled it onto the road behind the inn and
  back in, and dropped it from the guests. FIXED: it falls as the party sets out, at the inn.
- **R4 - a caravan beset at its night camp lost its wagons and horses for the fight**, and a halted party left its
  shared camp. FIXED: parked through the fight; the halted keep their ring; a lone camp's fire out for its halt.
- **R5 - E5 left a traveller setting out before first light nowhere** (the town had it gone, the road had it home).
  FIXED: the town's away window opens at the leg's first light.
- **R6 - a hunter jumped up to 344 m to its wild camp after a halt.** FIXED: the owed ground walked on.
- **R7 - F2 never reached a noble's retainers.** FIXED: a fated retainer sends the procession out.
- **R8 - a company hired on a train stopped being a company on the road.** FIXED: `hiredBy` read back.
- **R11 - past six wagons, a horse walked in shafts with no wagon behind.** FIXED: a team capped whole.
- **D3 - a dive turned home on the road still cleared its dungeon.** FIXED: `divesIn` skips it; one turned inside is
  cut at its turning (pinned).
- **P6, P17 - PINNED**: a patrol's cover of a trip setting out after its round; the census's new counts, classes and
  levels, the wild's tries, the inn night's walk minute and its ends, the train's tail and park, the holy day's last
  edge and a pilgrim's evening at the temple. The P lane's fifteen records carried, all dead.

Seen and not changed: at a shared camp, a party that is not the camp's first stands its fight about its own trouble's
place (the fight's place is the trouble's own, every reader's), so its people step out up to 60 m for the fight's
minutes and come back to the ring for the halt. R8's head is not mutation-pinned: on the synthetic map the merchant
never outranks the hired.

## C (with H1, R9, P4, P7) - the caravan's door (`test/auditlwii2_door.test.js`, 13; `auditlwii2_door.json`, 44)

All FIXED:

- **C1 (HIGH) - the hold-up worked by a race.** `yields` read `membersAt`, which drops the hand's dead too; a trip as the
  host mints it (through `fate` -> `trips.js handsOn`) carries every hand death, so once the last guard fell no armed
  member was left and nothing yielded - unless the caravan host's once-a-second step happened to read the roads' old
  trip object first. The pins built trips with no `fate`. FIXED: `yields` reads the party less the ROAD's own fallen
  alone (`!f.hand`); C4's law stands (only the player's own `slain` turns beat a guard). Pinned through the real `fate`;
  lw11's hold-up fixtures now mint their trips through `handsOn`.
- **C2 - an escort who robbed the caravan, or struck one of its people down, after the hire was paid at the town, with
  the party's thanks.** FIXED: the contract ends unpaid, in the merchant's words (`CARAVAN_LINES.betrayed`).
- **C3 - part of a stack, or a piece taken within the step's second, came back after a load.** A slot counted gone only
  when its object left the shelf whole, and the save never wrote the session's shelves. FIXED: a partly taken stack is
  recorded with what is left (an add-only `[place, count]` among its gone, the old form still read); the save flushes
  the counters first (world.js `getSaveData`, the host's `flush()`).
- **C6 / H1 (HIGH) - "travel on with them" worked indoors.** A caravan lodged at an inn (LW9) stands in the tavern, and
  its merchant's door offered R there: the clock moved and the player was set at the exterior's coordinates inside the
  building's scene. It skipped the journey's refusals too (enemies near, a duel, a hostile ship), and its teleport was
  never caught. FIXED: R is offered only where a journey may go (the host's `travelFree`: outdoors, none near - the
  travel map's own expression); `travelWith` refuses the same way, leaves a building first if it is ever reached
  there (`forceExitToExterior`, as every teleport here does) and catches its teleport.
- **C7 - travelled on to the town, the player was left on the empty road.** FIXED: set down where the party last
  walked, a minute short of the town.
- **C8 - a witnessed murder's report was pushed out of the book by forty reports nobody lived to carry.** FIXED: a full
  book lets a void report go first; each step drops a pending report whose witnesses are all dead now; and the victim
  is never counted among the witnesses (the slay's frame read the places before the death).
- **C9 (the lead's call; Mac's call 9 in `Living-World-II.md` section 11) - a caravan the band robbed under the escort
  paid "in one piece".** It still pays - its people came through - in its own words: "We're in - robbed, but alive."
- **C10 - a sale the counter refused still clinked, and could say "You are paid with a letter of credit."** FIXED in
  both trade skins: a refused commit clears the staging and returns before the coin and the box.
- **C12 - a counter's shelf made before the band's hold-up kept the band's half until a load.** FIXED.
- **C15 - a failed pickpocket on a road party cleared whatever crime stood.** FIXED where the flag before it is known
  (`townTalk.js activate` keeps it and puts it back); the road's door no longer writes None.
- **R9 - a deed against a hunter was charged when the hunter reached the wild.** FIXED: a wild trip's word goes home.
- **P4, P7 - PINNED**: the caravan host's real deps (the pay reaching the purse, the region at the deed's map pixel,
  the counter's stock seeded by the trip, the escort's pay by level; driven with a region that varies by pixel), and the
  journey stopping a minute short of the trouble the trip carries. The P lane's six records carried, all dead.

Seen and left for Mac: the hold-up stands on the player's deeds alone - a caravan whose only guard the character
struck down before hiring on yields as they walk beside it, and C2 then ends the contract unpaid.

## S (with W6, P1, P3, P8) - the patrons' service (`test/auditlwii2_service.test.js`, 14; `auditlwii2_service.json`, 45)

All FIXED:

- **S1 (HIGH) - a patron paid more than an online counter asks, so buying at a counter and stocking a trader printed
  gold.** REALM P0.4 shut that loop for a counter's own buy-back; the patrons reopened it. A book's floor is its
  template's 2500 where its price is its file's 300-800 (fourteen bought at a bookseller held 2.02 times their cost),
  and six tenths of any other piece's floor stands over what a good haggler pays at a quality-1 counter (a fifth up at
  the least; far more in a cheap region or a festival). FIXED (the lead's call, Mac's to overrule - the share is still
  his call 2): the worth is the lower of the floor and the record's own price, and a piece bought at a counter online is
  never a patron's (`counterBought`, stamped at both Buy doors, kept by the save, the item law, a listing, a merge and a
  split). The reviewer's farms after: no counter's piece sells to a patron at any quality. The mark is the client's to
  write, as `value` is.
- **S9 (found fixing S1) - the wire lifted a book to its template's 2500 and a recipe to its sheet's** (`loot.js
  wireLootItem`, AUDIT WORLD6a B1's floor): a book set down in a room's shared container and taken up again sold back
  for more than it cost. FIXED: the wire floors a book at its file's price and a recipe at its potion's.
- **S2 - a patron's sale never told the INT4 duplicate ledger**: the piece's escrow row and its claim stood for good,
  so a duper sold one copy for minted gold and kept the other uncharged. FIXED: the claimant charged, the row gone (or
  deleted).
- **S3 - P8's switch fix was incomplete**: reopening paid the shut hours, a developer's read under `dev` reckoned every
  seller of the region, and the migration's unmarked listings would have been paid for the hours before the patrons
  existed. FIXED: the reckoning asks the switch itself, the shut hours are marked, the migration marks them.
- **S4 - a door open a minute an hour took a whole hour of patrons.** FIXED: marked to the hour it opens in; a door
  leaving public reckons its town first.
- **S5 - held sellers crowded a town every hour** (worse than the first audit's NOT CHANGED said: never added to the
  hour's gone, drawn again every hour). FIXED: no candidates.
- **S6 / P8 - the faucet was written where no measure read it** (decision 7). FIXED: the realm's budget and its review
  tool name the patron gold.
- **S7 - a trader's read told another player's patron sales from a same-id trader.** FIXED: its own house's.
- **S8 - one listing that threw stopped the cron for every town.** FIXED: each judged in its own try;
  `validAffix` reads `Object.hasOwn`.
- **W6 - a town's trader list was the region's 300 newest listings**: an older trader lost its browsers. FIXED: every
  public trader house named.
- **P1, P3 - PINNED**: P7's door in a town of two traders; a listing's first whole hour and its expiry; a guild's hall
  never a patrons' trader. The P lane's four records carried, all dead.

## W (with H4, H7, H8, C11, P12) - the patrons seen and the word (`test/auditlwii2_town.test.js`, 11; `auditlwii2_town.json`, 32)

All FIXED:

- **W1 (HIGH) - a port town with any patron word replanned every crew hand at every read.** LW15 compared each plan's
  patron version, and a crew hand's plan carried none: every read of every frame made it again, and the day's
  incidents and walks with it - a port's frame twice as dear. FIXED: only a plan that read the word compares it.
- **W2 - the buyer was dealt over the people holding the places, which read this character's own turns**: a
  householder this reader struck down moved nearly every sale of the town to someone else on that reader alone.
  FIXED: dealt to a household's place over the census, then whoever holds it here; an empty place walks none.
- **W3 / H8 - one read clock for every region**: a region come to by a journey stood unread up to ten minutes, a read
  asked while one was out was dropped, a failed one waited the full ten. FIXED: each region its own clock, a region
  asked while busy remembered, a failure tried again in a minute.
- **W4 / H4 - the Vendor page read a whole cold town day for every sale it named** (up to 249 ms a render), and put
  the street's own day out of the town's memory. FIXED: off the households alone, kept by day.
- **W5 - any new sale replanned the whole town in one frame** (37 ms on a 4x4 town). FIXED: each plan signed with what
  it read of the word; only the plans whose own word moved are made again.
- **W7 - B11 failed at the day's turn**: the carried word blinked out while the new day's was worked. FIXED: a town's
  word done is kept as its last. **H7 - the word was never worked indoors.** FIXED: worked in the modal frame too.
- **W8 / C11 - a band's "the" opened sentences in lower case.** FIXED: a token that opens a sentence is capitalised.
- **W10 - two pins tested shapes no producer mints**: the word through a `_roads.carried` nobody set, and the dropped
  errands at a pace no patron walks. FIXED: the word through `carriedOf`; the drop pinned online too (4.03%; the
  record's 3.5% re-measured).
- **W11 - the patrons were read in the wilderness**, the region reckoned for nobody. FIXED: only while a living town
  stands.
- **P12, P17 - PINNED**: the host's visit shape (`inT` the coming in); the heard greeting's pick, a rout's known minute,
  the read's 600 s, a sale's minute's range, a browser's any trader. The P lane's records carried, all dead.

Recorded, not changed (W9, a record): the stranger's repute regard moves nothing a player sees.

## C and H (with P2, P5, P11) - the outlaws (`test/auditlwii2_outlaws.test.js`, 10; `auditlwii2_outlaws.json`, 47)

All FIXED:

- **C4 - every band's chest opened with the same Horse, Small Cart and two wagons** (about 4,050 gold to sell): the goods
  were a general store roll's first pieces, which are always its fixed ones. FIXED: drawn on the band's seed off the
  roll's back shelf, none of its fixed pieces.
- **C5 / H6 - standing a hideout read a fortnight of trips in one frame** (25-110 ms). FIXED: the take is a generator
  worked a slice a frame from the frame after the stand; the pile is laid when it is done.
- **C13 - online two readers could both stand the band.** FIXED: the election asked each second, the loser gives its
  people up, the peers within BAND_KEEP_M counted.
- **C14 - an outlaw chasing the player vanished at 281 m from the fire, and stepping out and back stood the band again
  whole.** FIXED: never let go while one is engaged; the session keeps a band's kills by its key (the record's NOT KEPT
  is gone).
- **H2 - the hideout's tents and fire stood 819.2 m behind after every map-pixel crossing.** FIXED: it follows the
  streaming origin. **H9 - a teleport left it standing a second in the new frame.** FIXED.
- **H3 - C8's re-read of the band-less troubles never reached LW16's kept word**, so a late reader told "won" where an
  early one told "robbed by the Wolves". FIXED: `resolved` remakes the told, the visitors and the carried word (the
  last word kept, B11's).
- **P2, P5, P11 - PINNED**: the eras read out of order; the real chest (`bandChest` over the real fate) and the real
  stood band over the character's routs; a pedlar's robbery's quarter purse, the rout's thanks for every robbed party,
  the nearest band's trouble, the leader's three classes. A carter's arm is not pinned: no carter travels on the
  synthetic maps (their towns stand five pixels apart, no market in a day's walk).

Seen and not changed: the trouble world's `resolved` can fire inside a read (inside `fate`, inside `townTrips`); an
entry being built then can be kept after the clear half band-less. C8's own clear of the memo has the same exposure.

## D (with H5, P10) - the deep's own (`test/auditlwii2_deep.test.js`, 15; `auditlwii2_deep.json`, 34)

All FIXED:

- **D1 (HIGH) - LEAD ON to a stop past DEEP_KEEP_M made the company vanish the next frame.** The let-go measured from
  where it was going: with the stops breadth first by block, one leg in six runs past 70 m. FIXED: from its nearest
  standing member.
- **D2 (HIGH; its root LW6's and LW6b's) - a load in the same dungeon wrote deaths and spent remains into the loaded
  game.** A quick load patches the dungeon in place, its pool the same: the divers and the remains layers stood over a
  pool the save had cut, and the next frame read the company stood after the save as fallen beside the player (`died`
  written, a courtship ended; a hostile member `slain` by the player's hand), and a pile laid after the save as taken
  (`laid`). FIXED: the load door (world.js, where every load passes) lets both layers go; a body dead and gone from the
  pool is forgotten with no turn.
- **D4 / H5 - a company held below swallowed its members' talk above.** The open world never let the divers go, and the
  divers' door answered true over a window that could not mount outside. FIXED: let go with the remains; asked only
  below; `offers` answers whether its window mounted.
- **D5 - a peer's take, or a piece put in and taken back, was charged as `poached`.** FIXED: the pile's own pieces as
  first seen, read again when the room's word lands in it.
- **D6 - the fallen of one dive were laid on top of one another** (one death minute, one stop). FIXED: a pace apart.
- **D7 - an Ocean Holes abyss was cleared by its template's dives.** FIXED: no cleared set while the abyss builds.
- **D8 - any road trouble took the deep's own fight away** (0.42 for DEEP_RISK's 0.5). FIXED: only a trouble inside.
- **D9** a death on the way out laid at the deepest stop, not the nearest; **D10** with no start marker the order began
  at the layout's first block, not the starting block; **D11** the stops' records two literals beside their homes (ONE
  DFU MEMBER, ONE EXPORT); **D13** a trim after the deep's fight that could never fire. FIXED.
- **P10 - PINNED**: the fight's pick and shift, the way out's rest, the build's cleared set routed from the ENTRY as the
  divers' own route is, DIVER_ARRIVE_SLACK_M - the P lane's five records carried, all dead.
- And the host's divers' and remains' steps wrapped as their neighbours are: a throw there ended the frame loop.

D3 (the road fixer's): see R.

## The records (no code)

- **R10** - the first audit's E9 understated what LW13's re-key moves (every turn keyed by place and cycle, the road's
  `spared` and `fallen` too; a `won`/`lost` on a later member's own trip never read again). Both records corrected.
- **W9** - the stranger's repute regard moves nothing a player sees (held inside the friend's and the enemy's lines;
  its one reader, Legacy's talk rows, asks a friend's). Section 9.2 and Mac's call 7 say so.
- **H10** - section 5.5 said the hideout is freed indoors; it waits as it stood.
- **P13 / D12** - Testing.md's lw14, lw15 and lw16 mutant counts; **P14** - the Port-Ledger's LW6 and LW14 rows and
  Living-World.md's LW6b sentence; **P15** - the moved pins no record named; **P16** - Active-Arcs' "each its own pull
  request", section 10's retired items.

## The integration

- Each lane's branch merged onto the head in turn, its records written as it landed; two moved pins only the whole
  suite could see were moved after the merges, each marked where it stands: `test/fixtures/time1_census.json` (C15's
  line in `livingRoadCaught`, named by its text) and `tv7_bands` TV7 host (the modal arm's window, 7000 to 7600: H7's
  word worked indoors and D2's wrapped steps).
- The whole suite on the merged tree, then every record of the six new lists: 247 of 247 dead, none surviving, none
  stale, every record applying.
- Measured on a quiet machine (`tools/livingPerfProbe.mjs`): a hideout's stand frame 0.09-0.66 ms reading no trip, its
  chest worked over the next one to three frames, every frame after at most 4.28 ms (C5's budget 6); THE WORD CARRIED,
  its section alone three runs a tree, the worst slice 7.7-8.6 ms against the head's 7.2-7.4 (none over its 10 ms on
  either; the mean cold day read 4% dearer, the road's fixes' cost), and in the whole probe a collection lifted one slice
  to 14-19 ms in two of three runs (the head's two runs 7.2 and 5.6) - the record's "a collection lifts one to 15 now and
  then", a little more often.

## The record

- Findings by id: R 11, C 15, D 13, S 9 (S9 found by the fix), W 11, H 10, P 17 - 86, 78 once the eight a second lens
  saw are counted once. Every code finding FIXED or PINNED; the records-only ones corrected (R10, W9, H10, P13-P16, D12).
- Pins: `test/auditlwii2_door.test.js` 13, `_deep` 15, `_outlaws` 10, `_service` 14, `_town` 11, `_road` 17 - 80
  (`09-Testing/Testing.md`). Mutants: `tools/mutants/auditlwii2_door.json` 44, `_deep` 34, `_outlaws` 47, `_service` 45,
  `_town` 32, `_road` 45 - 247, all dead; the P lane's 47 survivors among them, each now killed by its pin. The earlier
  records the fixes moved were re-aimed by content, their names kept (each lane's section of `06-Systems/Living-World-II.md`
  names them).
- Left for Mac: section 11's calls 2 (S1's mark is the lead's call beside his numbers) and 9 (a band-robbed escort's
  pay; the hold-up on the player's deeds alone).


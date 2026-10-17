# AUDIT LW-II - THE LIVING WORLD II, AUDITED, 2026-10-10

Mac: *"Lets do a deep audit and ensure this is perfection"* - of LW9-LW16 (`06-Systems/Living-World-II.md`), built
the day before on this branch and not yet on main.

## The method

- **Find.** Six lanes: five reading their slices' code whole against their sections - the road (LW9, LW10, LW13 -
  findings E), the door and the outlaws (LW11, LW12 - C), the deep (LW14 - D), the patrons' service (LW15's
  `server-account/` half and `net/patronLaw.js` - P), and the patrons' client with the word (LW15's client half and
  LW16 - B) - and one reading the eight slices' pins and mutants (F, each filed under its slice). About seventy findings
  were confirmed; each was read against the tree before it was fixed, the service's and the road's reproduced by the
  auditors' own scripts first.
- **Fix.** One fixer a lane, each in its own worktree off the same commit, the lanes' files disjoint; the deep and the
  client's lane on the branch itself. Each fix is pinned in its slice's own test file and mutated, its records named
  `<slice>-AUDIT-<finding>` in `tools/mutants/<slice>.json`. A pin another slice owned that a fix moved says so where it
  stands (`PIN MOVED (AUDIT LW-II ...)`).
- **Integrate.** Each lane's commit reviewed and merged into the branch, then the whole: lint, types, the bible's gates,
  every Living World test file, the service's market, vendor and home files, and each slice's mutants.

## LW9, LW10, LW13 - the road (E, F)

- **E1 (HIGH) - a patrol's cover read while its round waited on its way.** `patrolCover` answered `false` while the
  round it needed was still unplanned, so the trouble read meanwhile was the uncovered one and was kept: two readers,
  their ways planned a few frames apart, saw different troubles. FIXED: `patrolCover` answers undefined while it waits
  and no known round covers the trip; `townTrips` keeps nothing while any fate is undefined; world.js `fate` keeps
  nothing read under a pending cover (`livingCovered`, `_livingCoverPending`).
- **E10 - the cover sought only about the trip's `from`.** A round reaches the towns within its range of its city, at
  either end of a trip. FIXED: both ends.
- **E2 - a party lodging after dark was never listed.** `innGuestsOf` sounded the inn at dusk alone. FIXED: from dusk to
  the next first light, a quarter-hour a step and then to the minute (`firstMinute`); a party turned home that walks
  back to an inn in the dark is found too. On the way: every lodged party stays in until its day's walk catches up (96
  minutes on average past 07:00, up to five hours online) and was listed as leaving at 07:00 - `outT` is the minute it
  leaves now. Re-measured: no lodging unlisted at either pace (seven and sixty-three before).
- **E6 - a party turned home and lodging two nights was listed twice.** FIXED: one guest an id, the earlier night.
- **E3 - the stands (the talk's, the fights') laid each party out again, away from where its bodies were drawn.**
  FIXED: `livingRoads.js frame` lays each party out once, as drawn, and the stands read those places.
- **E4 - a second company hired by one train vanished.** FIXED: `formCaravans`' hire is exclusive (`trainFor`) - the
  first company in the deal takes the train, the second walks its own trip.
- **E5 - a carter's reach was more than a morning's walk, and a party camped before first light.** FIXED:
  `ROAD_RANGE_PX.carter` 1-2 (it was 1-4); `partyAt` is home before the out leg's first light.
- **E7 - "the wild" named as a place in the talk and the news.** FIXED: `trips.js placeName` - the wild has no name,
  and the words fall back to "the next town".
- **E8 - a wagon's wheels turned backwards on the way home.** FIXED: the back leg's distance runs from the far end.
- **F1 - the road jobs' tables (reach, stay, pace, cycle) had no pin.** PINNED for the patrol, the noble, the minstrel,
  the carter and the hunter.
- **F2 - no minstrel ever travelled at the calendar's pace** (a four-day cycle fits no trip of a one-to-two-day stay),
  and a fated patrol rider never sent the round out. FIXED: `ROAD_CYCLE_DAYS.minstrel` 6; a fated rider sends the round
  as a company's member does.
- **F3, F4 - the roads' layer at a camp, one fire to a shared camp, none on the march, and a friendly knight still
  halting a wanted player had no pin.** PINNED.
- **The pins' own faults:** an lw4 record mis-aimed (LW4-fated-not-forced mutates "fated ignored" now), `camps >= 0`
  (always true; `> 0`), lw13's hard-coded 0.7 (`TRIP_CHANCE.adventurer`), lw3's HUD square no longer tied to its branch.
  FIXED.
- **F7 - a pilgrim's holy day rolled the cycle's chance as well as HOLY_CHANCE.** FIXED: on HOLY_CHANCE alone, the
  cycle's draw still taken in its order (no other trip's dice move).
- **E9 - NOT FIXED: LW13 re-keys an adventurer's place to its company's cycle.** A hand's turn (`slain`, `died`) on a
  company's later member, saved within one cycle before the release, is read a cycle off: that member can stand again
  for up to one cycle, or a vacancy come a cycle late. Once, at the release that carries LW13; a load-time re-key by
  each turn's minute would need the turns' minutes mapped to the first member's cycle, which the record does not keep.
  AUDIT LW-II-2 R10: understated. Every turn keyed by a place and its cycle (world.js `livingTripTurnKey`) moves with
  it - the road's own `spared` and `fallen` as well as the hand's, so a member the player saved can fall after all
  within that cycle - and a `won` or `lost` written on a later member's own trip, which LW13 no longer makes, is never
  read again. Still once, at the release; still not changed.

## LW11, LW12 - the door and the outlaws (C)

- **C1 (CRITICAL) - a traveller looked up by id found nobody where a newcomer held the place.** The roster holds the
  census's ids; at the game's epoch nearly every place is a newcomer's (`~<gen>`). Every report was void ("no living
  witness") and every escort dropped the second after it was made. FIXED: `caravanHost.js travellerOf` mints the
  newcomer as the lives do; `tripOfId` answers undefined while the trips wait on their ways, and the step asks again
  rather than dropping a report or a contract.
- **C2 (HIGH) - a hideout's chest refilled without end.** Its take was kept `looted` only at the let-go, and by its
  count: a piece swapped in, or a save made while it stood, left it whole. FIXED: the chest's pieces and counts as
  minted, `looted` the frame it differs.
- **C3 (HIGH) - walking up to a band routed it.** The pool's relevance cull (120 m) took the band, stood at 200 m, as
  dead. FIXED: the band's bodies are `managed`; a rout needs every one killed by a blow (`killed`: dead with a body, or
  executed), latched as each falls.
- **C4 (HIGH) - the player robbed any caravan whose guards fell.** `yields` read the trip's own fallen (the dice's) as
  beaten, and a sellsword dead beside the player as the player's. FIXED: the armed the road left it, each down by the
  player's own hand (`slainAt`, the `slain` turns), the player within ESCORT_KEEP_M.
- **C5 (HIGH) - the escort paid without escorting.** (a) Hired a minute short of the town, it paid the whole walk:
  FIXED, the share ahead at the hire. (b) The clock past the town in one step (a rest, a wait, a journey, indoors) was
  never asked where the escort stood: FIXED, the contract keeps `near` (its last minute with the party), the step runs
  in the modal frame too, a rest beside the party's camp is read back and kept. FOLLOW-UP, on review: a journey
  that set the player down by the town as the party came in was paid - a moved player's last minute alone was read,
  and a rest's read-back looked only an hour behind its end. Every gap since the escort was last with the party is read
  back now against where the player stands, the party near throughout (`escortNear`); the "stood still" test
  (ESCORT_STILL_M) that chose between the two readings went with it (its mutant survived: the read-back left it
  nothing to decide). A party lodged at an inn is near whoever is at that inn, and indoors the player stands at the
  building (the first cut made every interior nowhere, and a night at the party's own inn broke the escort).
  (c) A caravan turned back paid until its halt's end: FIXED, unpaid from its trouble's minute. (d) The road's own
  death of the leader went unread: FIXED. (e) A party the character robbed offered its road, and a fight won before the
  hire counted: FIXED.
- **C6 - the player took a full purse a band had already taken.** FIXED: none.
- **C7 - a robbed caravan restocked once forty trades pushed its record out of the book.** FIXED: the session's shelf
  carries its coin and robbery and writes them back; the oldest record not robbed leaves the book first.
- **C8 - the hideouts read while a region's roads were unplanned were kept as none.** One reader's caravan was held up
  by a band where another's fought orcs. FIXED: `createHideoutBook` asks a waiting region again (HIDEOUTS_ASK_MS) and,
  its bands found, clears the troubles read band-less.
- **C9 - a hold-up whose halt ran past its leg's end was not `robbed`.** FIXED.
- **C10 - any crime and any region were charged** (legalRep[-7] = NaN), and the road's own deaths never voided a
  witness. FIXED: the law's crimes and the map's regions only (`reportOk`); a report names its trip, and its witnesses
  must still stand in it at the town.
- **C11b - online only the camp's owner saw its tents, fire and chest.** FIXED: every reader stands the camp; its
  people are the one standing it's. **C11c - a load let the last character's hideout go into the new one's record.**
  FIXED.
- **C11a - NOT FIXED: at night a band's half in camp, its leader among them, killed, is a rout.** The design keeps no
  partial rout, and the half out on the road is not in the camp to beat.
- The pins: the "never in a fight" pin is built from a real encounter; the "stream untouched" comparison covers the
  bands' own troubles.

## LW14 - the deep (D)

The thirteen, all FIXED (`06-Systems/Living-World-II.md` 7.2-7.4 carries each where it stands):

- **D1** the build's clear threw in every cleared foe's corpse (bindings declared further down) - every one vanished:
  at the build's end. **D3** keyed by the placed block (two copies of a block share LoadIDs). **D5** online none - the
  room's dungeon is the room's. **D9** the remains' places kept. **D10** the piles it passed and built empty settled.
- **D2** a company's strength was its first body in, so it quit at once: who stood, read once none is coming. **D4**
  LEAD ON's arrival each at its own stop; a new walk resets the fallen back. **D6** the way out has no stop ahead. **D7**
  a company on another floor heard, never met; the floor's rays only within hearing. **D8** let go and met again as
  left; one drawing on the player never let go. **D11** the door at the treasure's reach, never in Info. **D12** the
  rival's word once a pile. **D13** remains where a dungeon has no resting place.

## LW15 - the patrons' service (P)

All FIXED, each through the real Worker over node:sqlite:

- **P1 (HIGH) - the ceilings were read before the write.** Six towns read at once sold twelve of a seller's pieces an
  hour and 48,337 gold a day. The sale's INSERT asks the town's hour, the seller's hour and the seller's day itself.
- **P2 (HIGH) - a patron paid on the record's written value.** A found Broadsword written at 1e9 was worth 11,840 to the
  judge's ceiling. `patronWorth` judges the piece priced at nothing - what it is.
- **P3** the item law and the market's own law read again, as a buy reads them. **P4** a seller the judge holds, or one
  no checkpoint has judged, refused in the write.
- **P5 - a read's reckoning was unbounded** (5,826 statements for one region two days behind; D1 answers a thousand an
  invocation). The law's dice first (`patronCands`), one counts query an hour with a candidate,
  PATRON_READ_STATEMENTS (200) a read, the mark written only where it moves, the cron's towns the longest waiting first.
- **P6** the sales pruned with the market's history and indexed for the region's read and the day's counts. **P9** each
  sale keeps its house (`building_key`): another's piece of the same id in the town told every sale twice.
- **P7 - a door opened sold every piece stocked behind it, in the hours it stood shut.** `setHomeEntry` marks the
  trader's hours to now; a town whose traders all stand behind shut doors is marked as it is read.
- **P8** the cron paid patrons while the market was shut: only while it is open to everyone (`marketOpenFor`).
- **P10 - the dice were public.** A seller could compute the hour every piece would sell and list again until one sold
  at once. The draw takes the service's secret (`patronSalt`, of its identity key), before and after the listing.
- **P11** any failure counted as the guard's refusal and moved the mark past an unsold hour: only the guard's own now.
- NOT CHANGED: a held seller's piece is refused in the write, not left out of the hour's choice - it can take a town's
  slot that hour, which costs another seller a sale, never gold. A reckoning handed no `env` (the tests' direct calls
  alone) reads the public dice.

## LW15's client and LW16 - the patrons seen, the word (B)

All FIXED (`06-Systems/Living-World-II.md` 8.3, 9.1-9.4):

- **B1 (HIGH) - no patron was ever seen walking in online.** A living day is a real hour there, and the sale's day was
  over before any reader knew of it: the errand is PATRON_DELAY_DAYS (2) living days after. **B2** the errand an
  appointment, laid in the day's order, the stay it falls in cut and taken up again, PATRON_LATE_MIN late still in;
  only in PATRON_OPEN_H. **B12** the buyer dealt over the people holding the places that day (the dead were named).
- **B5** a sale's minute read on this machine's offset to the relay. **B6, B7** the rows' order moved errands, every
  read made every town's day again, and a shut trader kept its browsers.
- **B3** each visit's town's deeds kept with the turns that made them. **B4** whether every day of the word was read.
  **B8** a courier's relay of a town's own word told back to it as news; the region's own tales only. **B9** the road's
  news by the minute. **B10** a town with only the carried word told it as often as its own. **B11** the town's last word
  told while the next is worked. **B13** a throw wedged the slice for good. **B14** a band's whole name.

## The record

- Pins: lw9 17, lw10 9, lw11 21, lw12 16, lw13 10, lw14 12, lw15 12, lw16 8 (`09-Testing/Testing.md`).
- Mutants, every one dead or recorded equivalent: lw9 62, lw10 34, lw11 98, lw12 93, lw13 45, lw14 64, lw15
  106, lw16 73; and the records in other slices' files a fix moved (lw3, lw4, lw6b, lw7b, lwfix4), re-aimed by content.
- Pins in other files the fixes moved, each marked where it stands: `lwtalk_town` (E7), `fb1004d_placelru` (D1),
  `auditscale` (P6, P8), `legacyname` (B14) - left off this record until AUDIT LW-II-2 P15.
- `06-Systems/Living-World-II.md` and `01-Overview/Port-Ledger.md` corrected where they claimed what the code did not.

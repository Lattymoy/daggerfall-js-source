# AUDIT SEA VENTURES (2026-10-22) - the open sea's ventures, audited before they merge

The owner, of SEA VENTURES (ETHER-WILD, SEA-SET, SEA-VAULTS, SEA-EVENTS, SEA-BOUNTY, SEA-SEASON, SHIP-PVP -
`03-World/Eltheric-Ocean.md` and `11-Multiplayer/Wild-Zone.md` section 24, the answer to *"I want there to be more of a
reason to venture into this zone"*): **"Audit this and ensure perfection"**. This page is the findings, each with its
verdict. What the audit changed is written into the record's sections as they now stand, each change under its
finding's id (AUDIT SEA VENTURES E1 and on), and the code says the same at every site.

## How it was run

Six lanes, each a cold adversarial reader of the change at 886f2b4a6 (the base it branched from: a75e96b51 - 242 files,
some 19,500 lines added), told to reproduce every finding - a probe and its saved output - before reporting it, to cite
the code by its text, and to fix nothing. They read A FROZEN SNAPSHOT (a detached copy of 886f2b4a6), never the working
tree: Home.md's DO NOT FIX WHILE THE VERIFIER IS READING held - no fix was made until all six had reported. 76 probes
in all, each re-run against the fixed tree where it models the fixed design.

| Lane | Over | How |
|---|---|---|
| A - the relay | the sea's referee (`net/sea/seaRef.js`), the room's words and storage, the hub's vaults and fleet (`server/src/index.js`, `net/wild/wildLaw.js`), the wire | 13 probes over the relay's own Room (`test/fakeRoom.mjs`): a captain leaving her helm and coming back, a cell crossed mid-fight, an honest wreck in her own game, a hull with no uid, the per-mille rounding, a jumper, a guest's fleet word, a room that slept |
| B - the account service | the books: bounties, the kill, the wreck and its prize, the season, the sweeps (`server-account/src/seaBounty.js`, `seaWreck.js`, `seaSeason.js`) | 16 probes over the account Worker on sqlite (`test/accountDb.mjs` standService) with realm characters: races of two tabs, a crafted prize, a deed in the hold, a delete with gold owed, a season's turn, the tables after a month |
| C - the open zone's edges | ETHER-WILD on the client: the peace, the teleports, the rise, the words, the party, the wagon, the chart's peace | 10 probes over the world host's own text cut and run (`world.js`), the zone's leaf and the sea's law |
| D - the ventures | SEA-SET, SEA-VAULTS, SEA-EVENTS: the Tidemail's sources, the vaults' rooms, the storm and the fleet over many sailings, the host's growth | 12 probes: 3,000 vault days, every storm of a year, a legend's copy sunk twice, a reload mid-sailing, the hub's wipe |
| E - the page | the harbourmaster's boards (`scenes/seaBountyHost.js`, `seaSeasonHost.js`), the wreck's carries (`scenes/seaWreckHost.js`), the page's guns (`scenes/naval/seaBroadsides.js`), the prize law | 8 probes over the page's own hosts with a stand-in service and session: a refused read, a busy record, a refused checkpoint, a hidden tab |
| F - the record's honesty | every claim of the record and of the patch notes; every pin's force; every word in thirteen languages | 17 probes: each claim against the code that does it, each pin asked whether it could fail, the words rendered in each machine language |

**WHAT THEY FOUND.** 61 findings, four of them one finding met by two lenses (written `= E5` and so on): 57 in all. Five
were a hole any player could use or a loss: a refused board read asked again at once from the paint that ended it - a
page frozen in reads, two thousand a minute against the account's limit (E1); a captain's carry over a checkpoint that
was refused, read off a stale record - her hold's pieces given twice (E4); a prize that took a boat's deed (a second
ship), her parts, a quest's piece or a bag (E5/B1); a captain with a window open, below in her cabin or in a hidden tab
unshootable after twenty seconds (E6A); a legend's Tidemail paid with no purse, so another's copy of her sunk again paid
it every time (D1), and a treasure fleet's strongroom and piece with no once-a-sailing at all (D2). The rest: a ship
healed by leaving her helm or crossing a cell's line, the linked bank cabin past every teleport refusal, the peace's
gap before the Veil, a hold emptied in the boarding window, bounties stranded on a gone head, tables never pruned, the
hub's wipes, a fleet scattered before it sailed, the words English or the mountains', and a record that promised what
the code did not do.

## Findings

Severity: BLOCKER a dupe, a loss, a crash or a hole any player can use; HIGH a broken promise or a likely bug; MED a
wrong result a player meets; LOW an edge, a risk, a word or the record alone. Every FIXED is pinned in
`test/systems/sea/auditsea.test.js` (the finding's own id in its test's title) or in the suite its verdict names, and
where it changed code it has a mutant in `tools/mutants/auditsea.json` (AUDIT-SEA-<id>-...); a word in the record alone
has none.

### A - the relay

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | = F1, wider: a captain who left her helm, dropped her socket or crossed a cell's line came back whole; `hl` is her own word | FIXED (with F1): off the guns with her bar kept until it would mend (`offShip` - her helm's -1, her zone word, her socket's `seaGone`), and carried into the next cell through the hub with the zone's own carry (`seaCarry`, `_zoneCarry`), taken at her first helm there while newer and within `mendMs`. `hl` stays her word: KNOWN, below |
| A2 | HIGH | = E6B: her own game's wreck was said `hl` -1 - LEFT - and the referee's credit to the captain whose shot broke her never came | FIXED (with E6B) |
| A3 | HIGH | The per-mille share of a shot was rounded UP: a word of a point laid a thousandth of her bar, so tiny shots dealt some three times the purse | FIXED: what landed said rounded down, her bar left rounded up - a one-point word lays no more than it took |
| A4 | MED | `u: 0` on the wire: a hull with no uid fought, was wrecked and was never signed - no prize, no kill at sea | FIXED: a hull said (`hl` 0 to 4) needs a uid of 1 or more (`net/wire.js` `helm`); a hull with none is no ship |
| A5 | MED | A vault's (and every mountain hall's) reset wiped `dungeon:m<id>` alone, while the halls laid medium or small (SD-ONLINE's sized rooms) kept their foes slain and chests empty for good - 120 of the mountains' 200, 46 of a fortnight's vaults | FIXED: `_wdunWipe` asks the room at every size it is laid at (`DUNGEON_ROOM_TAGS`), each layer |
| A6 | LOW | A jumper boarded (`seaBoard` had no jump check, as `seaShot` has) | FIXED: a jumper boards nothing |
| A7 | LOW | Anyone - a guest among them - marked every fleet sunk before it sailed, the last sailing's and the next's | FIXED: the hub hears a flagship sunk only while she is under way (`SEA_FLEET_OFFSET_MS`, `SEA_FLEET_SAIL_MS`, a minute late - copied for the relay's bundle and held equal), and never from a guest. A registered account can still scatter a sailing under way: KNOWN |
| A8 | LOW | The receipts owed a captain away were kept in the room's memory alone - an object that slept lost them; a wreck nobody came back to was never signed, its row kept | FIXED: kept in the room's storage (`wildowed:<sub>`, its receipts' own life); the room's alarm (`_seaArm`, `_seaAlarm`) beats the wrecks past their boarding |
| A9 | LOW | The record let a reader think the relay knows the peace: it referees two sockets that both say zone 1 anywhere, Veilhaven's own cell too | FIXED in the record: the peace is each honest client's word, as the mountains' edge is - ETHER-WILD THE FIGHTS, Wild-Zone.md section 24 |
| A10 | LOW | `sendWdun` gated a vault's key on `wdunSeaOk` but not `fk` - an older relay closes the socket on it | FIXED: `fk` asked only of a hub that reads it |

### B - the account service

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | BLOCKER | = E5: the prize law let a boat's deed (a second ship), her parts (their cargo left behind), a quest's piece, a summoned piece and a Materials Bag go | FIXED (with E5) |
| B2 | HIGH | A crafted prize: no known copy was written for her - she kept the original and the piece he took was a locked copy | FIXED: the wreck's batch writes each piece taken down as his own copy, as a trade does |
| B3 | HIGH | The wrecked captain emptied her hold into her pack, packed or laid up her boat in the boarding window: the hold opens from anywhere (CARGO-ANYWHERE), and a boarded wreck took nothing | FIXED: `systems/naval/seaHoldGuard.js` - from the referee's wreck of her until her own carry lands, `SEA_HOLD_SHUT_MS` (240 s) at most, kept across a reload, her hold opens to no one (the hold's door, the mod's own box) and she is neither packed nor laid up. Her page's: KNOWN |
| B4 | MED | Bounties on a deleted or long-dead head stood for good; a character with gold owed, a wreck's prize held or its own hold's goods due back could be deleted with them | FIXED: a post on a head deleted, or dead `SEA_REFUND_AFTER_S` (two hours), is owed back to its poster and paid by its collect, once (`seaRefundSteps`); `deleteRealm` refuses (`sea-held`) until they come home |
| B5 | MED | The board and a kill scanned the whole history, and nothing was ever pruned | FIXED: the service's hourly clock sweeps a kill past the Wanted window, a wreck past its receipt's hour and what has ended past `SEA_ENDED_KEEP_S` (thirty days) - never a bounty standing, a sum owed or a prize held (`seaSweeps`, `cron.js` `sea`); the reads walk their own indexes (migrations 0146, 0148) |
| B6 | LOW | The season's turn: a world day after it, a save still filed the season before's figures, and those voyages counted for neither | FIXED: for `SEA_WORLD_DAY_S` past a turn the season before's figures are read for it, its legends bounded by that whole season |
| B7 | LOW | A seize that lost its race to her own checkpoint answered 500, and the page dropped it | FIXED: it answers `seq`, and is asked again |

### C - the open zone's edges

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | The linked bank cabin (Transport > Ship's) carried a captain from a Bay town's bank onto her boat a hundred leagues past the Veil, and back - past every zone and Veil refusal | FIXED: a teleport like any - refused into, out of or about the open sea, and across the Veil, at her boat's pixel |
| C2 | MED | Thirty-one pixels of open zone stood between Veilhaven's peace and the Veil - every captain's one way home through them | FIXED: the peace holds the way home - her rows, `ETHER_PEACE_PX` either side, east of her to the Veil - and the chart draws that shape |
| C3 | MED | A party's walk into the open sea gave no PvP warning (the walk's row read the mountains' mask alone) | FIXED: it warns in the sea's words |
| C4 | MED | A wagon parked on the open sea's ground counted as away: its cargo never dropped at a death there | FIXED: on the zone's ground it is with its owner, as in the mountains |
| C5 | MED | = F2: the rise was not the nearest freeport | FIXED (with F2) |
| C6 | LOW | `/unstuck` outdoors at sea was refused in the mountains' words | FIXED: the zone's word asked of its ground (`zoneWord('unstuckOut')`); the mountains' through the text core |
| C7 | LOW | The mountains' words at sea - a second revenant, a party left, a drop answered after the rise - and "You are in Veilhaven's peace" whenever the zone went, a hundred leagues from her | FIXED: each the ground's own (the drop's by the room the fall was in); the zone gone while still past the peace says `quiet` |

### D - the ventures

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | BLOCKER | A legend's Tidemail was paid when the ledger refused her purse - another's copy of her, sunk again before the aether raised her, paid it every time | FIXED: the piece comes with her purse alone (`legendTidemail`'s `paid`) |
| D2 | BLOCKER | The fleet's strongroom and Tidemail had no once-a-sailing: a second end, another's copy of her going down, each paid them again | FIXED: once a sailing, kept in the save (the captain's ledger's `fleets`, `endFleet`); no purse, no piece |
| D3 | HIGH | Every captain whose ball hit the flagship within twenty seconds of her end was paid it all | DECIDED: the legends' law (`SINK_CREDIT_S`) - each such captain ends her in her own game and is paid, once a sailing (D2), as a legend ended is each such captain's. The fleet is the clock's: no hub weighs who struck her most. Written in SEA-EVENTS' KNOWN |
| D4 | HIGH | A reload stood the flagship again, for her strongroom again | FIXED: a sailing whose flagship my ledger ended stands none |
| D5 | MED | `fk` was said once and never again (a socket shut as she went down lost it), and the hub's hello put my own sinking out | FIXED: my sinkings kept apart from the hub's word, told again each `FLEET_TELL_MS` until the hub's word carries it |
| D6 | HIGH | A wrack cask was hauled again after each reload, its goods and its piece with it | FIXED: hauled once, kept in the save (`wrack`, the newest sixteen) |
| D7 | MED | The hub wiped any sea ruin's room on a client's word for its key | FIXED: a vault stands in a room lane of its own (`SEA_VAULT_LANE`, `seaVaultRoomMapId`); the hub's wipe reaches no plain ruin |
| D8 | MED | At the day's turn a vault and its plain ruin shared one room, built two ways | FIXED (with D7): the vault's room is the one its gate let me into, or the day's I stand at (`seaVaultRoomId`) |
| D9 | LOW | A peer's copy of the flagship rolled the Tidemail on the observer's band | FIXED: on the sailing's band |
| D10 | LOW | Every fleet ship was placed on a rowboat's depth of water | FIXED: each on water deep enough for her own hull |
| D11 | LOW | One storm in fourteen reached the Reaches, where its wrack never gave a piece | FIXED: born far enough west that its drift and its reach never touch them |
| D12 | LOW | `createNavalHost` grew 83 logical lines with `legendTidemail` and `dueOnHull` inside it | FIXED: out to `scenes/naval/navalSeaSet.js`; the host's ceiling lowered to 6,455 (`test/scenes/hostceiling.test.js`) |

### E - the page

| # | Sev | Finding | Verdict |
|---|---|---|---|
| E1 | BLOCKER | A refused board read was asked again at once - the repaint that ends a read asked the next: a page frozen in reads, two thousand a minute against the account's limit, every checkpoint of the account refused behind them | FIXED: asked again `SEA_BOARD_READ_RETRY_MS` (5 s) on, doubling to the fresh wait; the season's boards the same |
| E2 | HIGH | An unboarded wreck was a kill at sea only if the victim's tab carried it; the carries owed were lost on a reload | FIXED: her killer carries every wreck of his, boarded or not; the carries owed kept in the page's storage until their receipt expires |
| E3 | MED | The captain's carry was asked once: a busy record's refusal, then the seize - and her hold to the title screen. The seize's grace was thirty seconds | FIXED: asked again each `SEA_WRECK_CAPTAIN_RETRY_MS` while it cannot be; every answer that says nothing of the wreck asked again; the grace 300 s |
| E4 | BLOCKER | A carry over a refused checkpoint (a duel, the death screen) read a stale record: her hold's pieces given twice | FIXED: her carry only over a checkpoint that went |
| E5 | HIGH | `prizeable` let a quest's piece, a summoned one, a boat's deed and parts, and bags go | FIXED: the prize asks the realm's trade law (`tradeableRecord`), and none of those swells the share |
| E6A | BLOCKER | The open sea's guns stepped in the exterior's unpaused frame alone: a window open, the cabin below or a hidden tab said no helm, and the referee refused every shot at a helm unsaid for twenty seconds | FIXED: stepped every online frame (`seaVentures.guns`); a shot asks only the SHOOTER's helm be fresh; a quiet captain in the zone is never forgotten; no cabin below with a stranger captain's ship within `SEA_CAPTAIN_NEAR_M` (700 m) |
| E6B | MED | Her own game's wreck said `hl` -1, so the credit arm never fired; and a shot of canvas or fire alone claimed her | FIXED: a wreck of mine said at her helm at none (`h: 0`); only a shot that took her bar claims her |
| E6C | LOW | Three ships under fire passed the referee's word rate, and the refused words' harm was dropped | FIXED: `SEA_SHOT_HZ` words a second over every ship (the referee's `hz` less two); a word unsaid kept and gathered on |
| E7a | MED | A post that landed was shown failed when the read after it was refused - a second post the player's next press | FIXED: the act's answer and the read's refusal are two lines |
| E7b | LOW | A refusal's line stayed after a good read | FIXED: a good read takes it away |
| E7c | LOW | An unread season board read as an empty season | FIXED: it says it is asking |
| E7d | LOW | A post's presses stood live whatever the purse | FIXED: a post the purse and the bank cannot pay is greyed and never asked |

### F - the record's honesty

| # | Sev | Finding | Verdict |
|---|---|---|---|
| F1 | HIGH | Leaving the helm or the zone and coming back reset the bar - a modified client was never wrecked | FIXED (with A1) |
| F2 | HIGH | A death with no freeport within 60 px rose at Veilhaven - one in twenty-five of the sea's, a hundred leagues and more from a port a few dozen off | FIXED: the reach doubled from `ETHER_RISE_PX` until a port stands within it - the nearest, however far |
| F3 | HIGH | The notes promised "up to a third" of her hold; the law takes her best piece always, which alone may be all she carries | FIXED in the words: her best piece always, and more of her best while they come to a third (the record's SHIP-PVP said so already; ETHER-WILD's line and the notes did not). The law stands |
| F4 | MED | The compass's points (the rumours, the storm's and the fleet's words, the chart's ways) and the ring's "+75% loot" were English in every language | FIXED: `etherWayWord` (sixteen keys, `sea.way.*`) and `etherRingBonus` through the text core; each machine language's templates redrafted around a way (a word that carries its preposition where the language needs it) |
| F5 | MED | The pins could not fail on the boarding's window, the reach, the credit or the rise's reach - they read their offsets off the numbers they pinned | FIXED: `SEA_REF` pinned by value, and `ETHER_RISE_PX`; the four mutants that moved a number with its pin die |
| F6 | LOW | "The peace painted under the haunts" was pinned in a view that held no haunt | FIXED: pinned in a view that holds the peace and a haunt |
| F7 | LOW | The record's mutant counts were stale (108 and 181) | FIXED: 109 and 183, all dead |
| F8 | LOW | Port-Ledger's ELTHERIC OCEAN row named none of the seven slices; Active-Arcs named four | FIXED: both name all seven, and this audit |
| F9 | LOW | "NO WIRE, NO DEPLOY" stood after SEA-VAULTS to SHIP-PVP moved both | FIXED in the record: ETHER-WILD itself moved neither; the slices after it ride world246 and migrations 0146-0148 |
| F10 | LOW | The bounty board said a captain is paid for a death, a sinking; a wreck claims, and a player's ship never sinks | FIXED: "paid to whoever ends them at sea: a death at their hand, or a wreck at their guns" |
| F11 | LOW | The notes said a ship's reach and rate of fire depend on her hull; they are every hull's - her hull sets her purse | FIXED in the notes |
| F12 | LOW | The notes said everyone at sea hears of a vault's crows; a captain in Veilhaven's peace does not | FIXED in the notes: everyone on the open sea past the peace |
| F13 | LOW | The notes said Undertow is whole "at sea"; in the peace it is half | FIXED in the notes: whole on the open sea past Veilhaven's peace, half elsewhere |

## Known, named

Each stands in its section's KNOWN, NAMED:

- A captain's hull class (`hl`) and her uid are her own words: a rowboat said a carrack claims a carrack's purse and bar,
  never more; a wrong uid seizes nothing, and she wrecks all the same (SHIP-PVP).
- A registered account can scatter a treasure fleet's sailing under way - once a sailing, never before she sails, never
  another's (SEA-EVENTS; ZONE-GIANTS' own limit).
- A ship whose captain is below in her cabin has left her helm: off the guns. So the cabin is refused with a stranger
  captain's ship near (E6A).
- A ship the sea's own guns broke is out of the fight both ways until she mends.
- The wrecked captain's hold is shut by her page (B3): a modified page holds its own save between checkpoints. The prize
  is what her record holds when the wreck is carried.
- The peace is the honest client's word: the relay reads no map (A9).
- The co-op's law at a fleet's flagship is the legends' (D3, decided).

## Pins moved

Each moved pin says PIN MOVED with its finding's id at the site: `test/systems/sea/shippvp.test.js` (E6A, E6B, F1/A1,
A6), `test/systems/sea/seaevents.test.js` (D2, A7), `test/systems/sea/seavaults.test.js` (D7, D8, A5, A10),
`test/systems/sea/seaset.test.js` (D1, D12), `test/systems/sea/seabounty.test.js` (B4, F10, the wreck's kill),
`test/systems/sea/seaseason.test.js` (E7), `test/ui/etherchart_peace.test.js` (C2, F6),
`test/systems/wild/etherwild.test.js`, `test/systems/wild/fb1009b_partytruce.test.js`,
`test/systems/fb1018b_burntsaid.test.js` and `test/systems/fb1019f_companiondrop.test.js` (C7),
`test/systems/travel/tv8_party_walk.test.js` (C3), `test/systems/naval/auditcaptsea.test.js` (C5/F2's rise),
`test/systems/comeSailAway/fb1020c_cabinfoes.test.js` (E6A's cabin), `test/systems/comeSailAway/sailingcabins.test.js`
(C1: the bank cabin's door run from world.js's text asks the two refusals of her boat's pixel, and refused boards
nothing), `test/net/holdshared.test.js` (D7, D8: the world host's room key run from its text - a Bay dungeon's its own map
id, as before), `test/net/auditscale.test.js` (B5's sweeps),
`test/systems/naval/ethercross.test.js` and `test/systems/naval/captlog.test.js` (the ledger's `fleets` and `wrack` -
D2, D4, D6: found by the touched mutant run, below, failing with no mutant), `test/systems/l10n4_hardcoded.test.js` (the
two mountain words C6 and C7 moved through the text core: world.js 346, revenantCompanions.js 3),
`test/scenes/hostceiling.test.js` (D12: createNavalHost's ceiling lowered to 6,455) and `test/net/relayversion.test.js`
(world246's bundle hash).

## Mutants

- `tools/mutants/auditsea.json` - 96 records, one or more a finding: all dead. Every survivor of the first runs was a
  pin that could not fail, made one that can, or an arm no input reaches, dropped: the wreck's `got > 0` before a bar at
  none (a shot lands only on a bar above none), the prize's bounds read twice, E6B's wreck on the canvas.
- Records re-aimed BY CONTENT where the fixes rewrote their text (`test/tooling/mutantdrift.test.js` holds every record
  to its text), the same law mutated - in `shippvp`, `seabounty`, `seaseason`, `seaevents`, `seaset`, `seavaults`,
  `etherwild`, `ethership`, `hostsplit`, `int_lane2`, `auditscale2_relay`, `auditcaptsea`, `fb1015_cartaway`,
  `fb1018b_burntsaid` and `fb1020c_cabinfoes`: all dead.
- THE TOUCHED RUN: every record of every list that names a file the fixes changed outside the six great hosts, and
  the great hosts' (world.js, the relay's index.js, navalHost.js, wire.js, comeSailAway.js, online.js) records whose text
  the fixes touched or whose tests they moved - 1,642 records (1,641 by name), run over the fixed tree and, once main
  was merged in, the rest of them over the merge: 1,633 dead, 7 equivalent as recorded (ACS-B4-mine-not, ACS-D17-fight,
  ACS-S24-card-gate, ACS-X2-yes-sailing, ACS-X4-mouth-host, HOUSE-LOSS-undo-unspends-under-a-character,
  INT9-THE-FALLEN-STRUCK - each with its why in its list), and one survivor, INT10-MEND-CLEARS-THE-CASTS (`int_lane2` -
  a duel's casts kept through a mend), which survives on a clean `main` as well: INT10's to answer, not this audit's.

## What stands

- The audit's own suite (`test/systems/sea/auditsea.test.js`, 25 tests) and every sea suite pass over the fixed tree;
  the l10n suites pass, the thirteen machine languages owe nothing.
- THE TOUCHED RUN found two pins the fixes broke and the change's own tests did not run (`ethercross`, `captlog` - the
  ledger's new fields); the whole suite two more (`sailingcabins`, `holdshared` - world.js's text run with stand-ins
  that knew none of C1's and D7's names). All four moved above.
- THE SUITE. The whole suite over the fixed tree - 32,813 tests, four failures: the two pins above, and audit24's one-home
  ratchet over two of the audit's new names, each declared beside another module's of the same name and another meaning
  (the board read's retry beside the boarding's `SEA_BOARD_RETRY_MS`; the compass's word beside the dungeon echo's
  `wayWord`) - renamed `SEA_BOARD_READ_RETRY_MS` and `etherWayWord`. All four mended, their suites and every gate (lint,
  types, the bible's, the cites, the relay's hash, the hosts' ceilings, the l10n ratchet) green after.
- THE MERGES OF MAIN (LEASE1, PARTY-PING, SPAWN-THIN, STAFF-PANEL1 and the rest; then CRAFT-PAYS, CRAFT-WRITS, PISTOLET
  and AUDIT COLLECTIONS-II): the sea renumbered world245, acct169 and migrations 0145-0147, then world246, acct172,
  migrations 0146-0148 and item law 11; bootWorld under main's ceiling again (two pure helpers to the module's scope) and the world
  host's frame under the PERF-V8 tripwire (`frameSnowCover`). The whole suite over the merge - 32,902 tests - failed
  only that tripwire, mended.
- Not verified here: two captains' broadsides in real browsers against the deployed relay; the hold's shut door in a
  running world; a fleet's flagship sunk by two captains at once online.

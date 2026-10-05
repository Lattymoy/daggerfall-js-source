# FIELD BUGS 2026-10-01 - the runaway pet's tiger; and seven lines: the yard, the market, the paint, the rent, the road, the potions, the climb past 100; and eleven: the rain in a puddle, the sprinkle, the square clouds, the sea from under it, the slow frames, the Overworld; and seven more: mining, the regeneration spell, the King's Mark, the cloak's drape, the identified trade, the shrine; and eight more: the cast when used, the friend list, the mountain, the slow fall, the 3D map, the gate's health, the cursor

*The same date, five times (the merges of PR #498 and PR #499 with main, 2026-10-01, and part four's and part five's
branches after them): KEPT-KILL was written on main (PR #497) while part two - a list of seven - was written on PR #498's branch, and
part three - two lists, eleven lines - on PR #499's, each under the same name; part four - seven screenshots and a line
- on `claude/mining-life-skill-broken-s7ustd`; part five - eight threads - on `claude/new-session-4qdvn6`. The merges keep all of them here, so every cite of this page stands; part
two's numbers (1-7), part three's (1-11), part four's (1-7) and part five's (1-8), their tags and their pins' `fb1001_` are each their
own.*

One #bug-reports thread, and Mac's ask on it: *"Report on other player's quest enemies being dead"*, then *"If someone
kills a quest target regardless of relation then it should ping the quest for the players involved regardless ... So if
it doesnt work that way now it should, imo I suggested party only sync with quest entities for best solution"*. Asked
how the one gap found should be closed - a field on the party pose (a relay deploy), the quest-share frame (none), or no
handover to a member off the quest - Mac chose the party pose.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Does anybody know if the tiger from the 'runaway pet' quest respawns?" / "Somebody entered the dungeon where the tiger was and I think it was killed" | (#bug-reports) | not the quest's tiger: a quest's foes are its player's alone, and a shared quest's ride to the party only - a stranger never sees, strikes or is hunted by one; a Natural Cave rolls ordinary Sabretooth Tigers, the room's to kill | answered |
| 2 | (found answering it) a quest foe its owner handed to a party member whose copy holds no such quest, killed with no linked copy in the room, counted on no copy - the owner came back to a fresh one at the marker | - | QUEST-PARTY counts on each copy only the deaths it sees, and AUDIT DISC28 QS-J's heir keeps the foe on the partner's word with nothing to count it on | fixed (KEPT-KILL) |

## The report (1) - what a quest foe is online

**The quest.** "Runaway Pet" is `M0B00Y17` (`vendor/dfu-quests/Quests/M0B00Y17.txt`, the Fighters Guild's): `Foe _tiger_ is
Sabretooth_tiger`, `place foe _tiger_ at _mondung_` - a `dungeon6`, a Natural Cave (`Quests-Places.txt:124`). It is
fetched ALIVE - an `injured _tiger_` and the bell (`_S.02_`, `_S.04_`, `_S.05_`'s `remove foe`); `killed 1 _tiger_`
(`_S.03_`) is the failure: "Oops. You killed the tiger.", and `_dummy_` orders the player out, unpaid. (`M0B00Y07`, "Unwanted
Houseguest", is the other tiger in the pack: a house, and a kill.)

**Whose foe it is** (verified on the code, `scenes/questFoeHost.js`, `scenes/dungeonContext.js`, `scenes/exteriorFoes.js`,
`scenes/world.js` questShareSeam):

- The quest's own mount stands it on its player's machine alone (`systems/quest/sceneMount.js:124` - only while
  `killCount < spawnCount`), past the layout's run (`dungeonContext.js:1609` spawnQuestFoe). The room's stream carries
  the layout alone (`foesFrame`), and a peer's blow past the run is refused (`applyHit`, `i >= _layoutFoes`).
- Shared with the party (QUEST-PARTY), it rides the room's own lane to the party alone, stood as a puppet for a LINKED
  copy only (DISC28-J's `accepts`), struck only by the party, hunting only the party (`isPrivateQuestFoe`,
  `questShareTag`, `peerMayHit`). Every member's linked copy counts the injury and the kill it sees; the resync's max
  merge (`machine.js:1376`) keeps the copies equal.
- It is never the room's: the hourly respawn (`RESPAWN_MS`) and the relay's memory of the dead (`sharedWorld`'s
  `slice(0, _layoutFoes)`) cover the layout's run alone. Once its copy counts it killed it is never stood again; alive,
  it stands at full health each time its player comes in.

So the reporter's tiger was a cave's own, a stranger's to kill. The quest's tiger was still standing in the reporter's
own copy of the cave - unless the player who came in was in their party, and then only by the road below.

## KEPT-KILL: a kept quest foe's fall is said in the heir's party pose (2)

**Reproduced first** (`test/keptkill.test.js`, the dungeon's own-lane doors sliced out of the source and run - the
questparty3c harness): the owner stands Runaway Pet's tiger; a party member whose copy holds no such quest (a share
refused - Runaway Pet is a guild quest, and a non-member's receipt is refused `'guild'` - or a link a reload dropped)
stands no puppet of it (DISC28-J). The owner dies to it or walks out: the handover names that member heir, who takes it
on the partner's word (QS-J's `_keptTag`). The heir kills it. No linked copy is in the room, so no copy saw it fall,
and nothing the heir's world does reaches the owner's. Back in the cave, the owner's copy (`killCount` 0) stands a fresh
tiger at the marker - to the owner, the tiger respawned.

**Why.** Each copy counts what it sees (QUEST-PARTY phase 1): its own foe's death through its QuestResourceBehaviour, a
partner's puppet's through `onPuppetDied`. A kept foe has neither - the heir has no copy to bind it to - and the own
lane is the room's, so a death nobody linked saw was nobody's word.

**The fix.**

- The heir says it. Each frame, beside the quest behaviours' update, a kept foe at zero health (the behaviour's own
  test) says its fall once with its number on the heir's stream - `keptKillTick` in both pools
  (`dungeonContext.js`, `exteriorFoes.js`), through the seam's `onKeptDied(tag, i)`.
- The heir's party pose carries it: `qk`, rows of `{q, s, i}` (the quest, the Foe's symbol, the number), held five
  minutes (`KEPT_KILL_HOLD_MS` - the hub keeps a member's last pose, so a link that drops and comes back in it still
  hears), eight at most (`net/wire.js` validPartyPose, `KEPT_KILL_POSE_MAX`).
- Every party member's linked copy counts it, wherever the member stands (`creditKeptKills`: `sharedQuestFoe`, the
  injury then the kill, as the behaviour sets them). A copy that holds no such quest counts nothing (DISC28-J's law).
- Once. The pose repeats its rows on every change for the hold, and a linked member in the room saw the puppet fall
  too: the puppet's death names its owner and number now (`onPuppetDied(tag, owner, i)`), and both doors ask one
  ledger keyed by the holder's account, the quest, the symbol and the number (`KeptKillLedger.credit`), remembered
  past the hold. Whichever lands first counts.

**The relay.** `qk` is a party-pose field, so the hub must project it: RELAY_VERSION world136 -> world137 (main's GATE-UX took world136 first), which
`relay-deploy.yml` deploys on the merge - and a relay deploy drops every open socket once. Until it is live the hub
strips the field, and the kill counts on no copy that did not see it, as before; nothing else changes.

Pins: `test/keptkill.test.js` (7): the wire's law, every vendored quest name and Foe symbol inside it, the gap and its
say in the dungeon, the witness's key equal to the heir's, the ledger, Runaway Pet's `killed 1 _tiger_` firing on the
owner's and a linked copy from the heir's word (and not on an unlinked one, and not twice), and the hosts' wiring.
Red on the code before (the module's exports are not there). Mutants: `tools/mutants/keptkill.json` (22, all dead).
PIN MOVED: `test/questparty.test.js` (the world host's
`onPuppetDied` shape); the relay's version pins to world137 and `relayversion.test.js`'s row; mutants
`questparty.json` QP-no-kill-credit and `questparty3c.json` QP3C-no-kill re-aimed by content, `soc1.json`
S38-version-not-bumped to world137.

**Not changed.** The handover itself: QS-J's reason stands (refused, the foe was lost for every linked member in the
room). A kept foe killed while its owner's relay link is down past the hold is still uncounted on the owner's copy; the
owner's next resync from a linked member who counted it (one in the room, or one that got the pose) carries it. A
quest that is not shared is its player's alone: its foe is never handed, and leaves with its owner.

## Part two - seven lines: the yard, the market, the paint, the rent, the road, the potions, the climb past 100

One list of seven, relayed as it was written:

> 1. Decorating the exterior is bugged for houses.
> 2. The market doesn't allow you to list any item that isnt bound, also it's bugged
> 3. Switching textures on houses doesnt stay and resets
> 4. Room renting is buggy
> 5. Exterior placement bounds shouldnt touch roads/pathways
> 6. Potions are durability Mages could basicly kill.for free Potions makes them cost to use magic Gold sink Same as repairs for melee
> 7. Running jumping climbing dint work passed 100

The rule of the last batch stands (Mac, `Field-Bugs-2026-09-30b.md` part two: *"I dont care about DFU. We're our own
thing now"*): every report root-caused on the real modules with a reproduction before anything changed, the faults
fixed wherever they failed the player, each fix pinned red on the code before it and mutation-checked. Five lanes ran
at once, one a report (the yard and the road together); 6 was a design ask, asked before it was built - and
withdrawn after it shipped; 2 was both.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Decorating the exterior is bugged for houses." | three: a long piece turned at an angle could stand through the house's corner (the lot asked a piece's corners, not its ground); the town's minute read, answered before a place or a remove and landing after it, stood a removed piece back and dropped a new one for a minute; at a pixel crossing every yard piece was drawn 819 m off for a frame and not at all the next | fixed (YARD-CORNER, YARD-STALE, YARD-RECENTRE) |
| 2 | "The market doesn't allow you to list any item that isnt bound, also it's bugged" | only a Stores material or a crafted piece carrying its maker's record could list, by design (10.2: "Loot does not list") - nothing bound was ever offered, and nothing from the world either; and a crafted piece handed on by a trade was destroyed when its new holder pressed List | fixed (MARKET-KEEP), built (MARKET-ANY) |
| 3 | "Switching textures on houses doesnt stay and resets" | three: the painter's "Paint it", "Put back" and "The town's own" were never drawn (they stood in the rent tab's row, which the decorator's sheet hides in every other tab), so a look could only be tried and was put away on leaving the tab; a town's read in flight when a look was painted landed over it and was believed for a minute; closing the panel left the tried look in the painter | fixed (LOOK-BUTTONS, LOOK-STALE, LOOK-TRIED) |
| 4 | "Room renting is buggy" | six: a tenant could not rest in the room they rented; the renewal window offered days the service refuses, after the purse had paid; the owner's rooms were read once a visit; a house one room again hid its offers from its owner; the owner's "Room 2" was "Room 1" at the door; a rent that landed under a plaque's read kept the door shut a minute | fixed (RENT-REST, RENT-RENEW, RENT-FRESH, RENT-ORPHANS, RENT-NUMBER, HOMES-FORCE) |
| 5 | "Exterior placement bounds shouldnt touch roads/pathways" | the lot was the house's box and six metres round it, and nothing read the ground: a piece stood in the street, and the marked edge ran across it | fixed (ROAD-LOT) |
| 6 | "Potions are durability ... Gold sink Same as repairs for melee" | a design ask: online a rest gave magicka back whole and free; asked, rest gave "Half the pool" and Restore Power sold "Everywhere, 1 g/point" | built (MANA-HALF, MANA-SHOP), shipped in #498, then withdrawn (Mac: "Revert all the potion and magic stuff") |
| 7 | "Running jumping climbing dint work passed 100" | the report reproduces whole on the code before MOVE-REAL (#475, merged the day before); on today's two remained: past 100 a run stopped counting at DFU's 20,000-use bucket - some 83 minutes between rests - and a rest's leftover was capped; Climbing past 100 bought nothing (its one law is certain at 95) | fixed (MOVE-BANK, CLIMB-PAST) |

## LOOK-BUTTONS: the painter's buttons drawn (3)

**Reproduced first** (`test/fb1001_look.test.js`: the decorator's real sheet, `DECOR_CSS`, cascaded over the real panel
and the real decorator tool by a small selector matcher - classes, attributes, `:not`, descendants, specificity - with
its own sanity pin; and the yard's decorator on the real homes registry over the real Worker): on her own lot the
owner opens the decorator, Exterior, Walls, Swamp and Manor - the house wears it (the host's preview) - and "The town's
own", "Paint it" and "Put back" are all `display: none`. The only ways out of the tab, leaving it or closing the panel,
put the tried look away, and the house wears the town's own again: the report, whole.

**Why.** The three buttons stood in a row classed `dfdecor-rent-actions` - the "Rooms to rent" tab's row - and the
decorator's own sheet hides that class in every tab but the rent tab's (`.dfdecor-card:not([data-mode="rent"])
.dfdecor-rent-actions`), and again in the painter's. HOME-LOOK's pin pressed "Paint it" in a headless document that
reads no CSS: it pressed a button nobody could see, and the housing audit's lanes read the code, not the drawn page.

**The fix** (`ui/decorPanel.js`): the row has its own class, `dfdecor-paint-btns`, laid out as a row.

**Found on the way, not changed.** A fault like this one is only caught by reading the sheet; the pin's cascade helper
could serve the other DOM windows' pins.

## LOOK-STALE: an older answer never lands over a newer look (3)

**Reproduced first** (the real service, `accountHomes` and `createOnlineHomes`, over a network that holds a town's
answer): the town's minute ran out and a door asked again; the service answered the town as it stood, and the answer
was still on its way when the paint landed. The look showed at once, then went back to the town's own when the older
answer arrived - and was believed for the town's minute. Two looks painted one after the other did the same: the first
paint's read-back put the first look back over the second.

**Why.** `ensure` handed a forced ask the read already in flight, so the read-back a write asks for was dropped (ASYNC
NEVER DROPS), and that flight's answer - from before the write - overwrote the row the write had set.

**The fix** (`systems/onlineHomes.js`): the registry counts each town's answered writes, and each read keeps the count
it set out under; an answer from before a write is not believed (a claim, a door's entry and a sale ride the same
`wrote`). A forced ask is asked after the flight it finds - the one rule HOMES-FORCE (below) shares: the two lanes
fixed the same root two ways, and the merge kept one - unless that flight was itself forced and set out after the last
write, whose answer is the one asked.

**Found on the way, not changed.** A look tried while a paint is still being written is put away on the house by the
write's answer, the panel disagreeing for that round trip; other players see a new look at their next read of the town
(a door hover or a pixel's build), nothing re-asking while they stand still; "Put back" previews the house's look rather
than clearing the preview.

## LOOK-TRIED: closing the panel is leaving the tab (3)

**Reproduced first:** try Manor, close, reopen - the painter opened on "Manor, Temperate - changed" and "Tried on your
house - paint it to keep it" over a house wearing its painted look. **Why.** Leaving the tab cleared the painter's
tried look; closing put it away on the house alone. **The fix** (`ui/decorPanel.js` `hide`): the tried look goes with
the close.

`test/fb1001_look.test.js` (7), five red on the code before (the cascade's sanity pin and the no-second-ask guard are
green both sides). `tools/mutants/fb1001_look.json` (15: 14 dead, 1 equivalent as recorded - a landed flight's count
left behind is never read); `home1`'s HOME1-two-asks-in-flight re-aimed by content.

## RENT-REST: a tenant rests in the home they rent (4)

**Reproduced first** (`test/fb1001_rent.test.js`: the real Worker and its rent route, `accountHomes`, `realmGoldAct`,
`createOnlineHomes`, and the interior host's rest bag over `interiorRestPlace` and `canRest`): walking in, the tenant
is told "You rent a room here ... You may rest here."; pressing Rest, `{ allowed: false }`, "You have not rented a room
here." The owner rests.

**Why.** `canRest` asks IsHouseOwned only inside its permanent-scene test - DFU's rule, since a house DFU sells is a
permanent scene from its purchase. The owner's visit stands in the home's own scene, made permanent at entry; a
tenant's in the building's ordinary scene, which no tenant's cache holds - so the host's `houseOwned` for a tenant was
never read.

**The fix** (`systems/restSession.js` interiorRestPlace `homeBed`; `systems/homeRent.js` `homeBedIsMine`;
`scenes/worldModes.js`): an online home's bed - its owner's, or its tenant's until the tenancy ends - stands where a
bought house stands, in both halves of the test. PIN MOVED: `homerent`, `restlodging` and `houses` re-aimed by content
at the bag's new host line.

## RENT-RENEW: the renewal window offers the days the service takes (4)

**Reproduced first:** three days held; the window offered 1, 3, 7, 14 and 30; 30 was refused `rent-long` after the
purse had paid 1,500, which came back to the region's bank (purse 4,850 -> 3,350, bank 0 -> 1,500).

**Why.** A renewal counts from the tenancy's end and never runs past thirty days ahead (`homeLaw.js` rentUntil,
`rent.js`), the window listed all five, the purse pays before the service answers, and a refusal's reserve comes back
to the region's account (the housing audit's known limit). A tenant's own room taken off the offer said "No room here
is free to rent right now." under a door that said "renew it".

**The fix** (`systems/homeRent.js` `rentDayRows`, `RENT_FULL_LINE`, `rentNoneLine`; `scenes/worldModes.js`): the door
offers only the days that fit, read on the service's clock (`now` in the rooms' answer); with none, it says the room is
paid as far ahead as a room can be; a room no longer offered says so, with the days left.

**Found on the way, not changed.** The other refusals (`rent-price`, `rent-taken`, `rent-held`, `realm-gold`) still give
the reserve back to the bank, not the purse.

## RENT-FRESH, RENT-ORPHANS, RENT-NUMBER: the owner's tab tells the truth (4)

**Reproduced first** (the real decorator and panel over the real service and the real room finder): a tenant paid
while the owner stood in the house - the service held 120 gold, and the tab, closed and opened again, said "No rent to
collect" (RENT-FRESH); two rooms offered, one rented, the door between them taken down - the tab read "Rooms to rent
(0)" and "A house of one room has none to rent out" while visitors could still rent both (RENT-ORPHANS); the owner
offered the finder's "Room 2" first and the service held room 1 - "Room 2 is offered" on the panel, "Room 1" to every
tenant (RENT-NUMBER).

**Why.** The rooms were read once a visit (`decorTool.js`), and the panel's change signature missed `loaded`, so
"Asking the account service..." stood until something else moved; rows were built only for a house of two rooms or
more, and "Finding the rooms..." tested a flag that is true only when rows exist - dead; every room not yet offered
took the first free number.

**The fix** (`scenes/decorTool.js`, `ui/decorPanel.js`, `systems/homeRent.js` `rentRoomsView`): the rooms are read
again on every opening and every `RENT_VIEW_FRESH_MS` (30 s) while the tab is up, the newest read alone counting, and
the signature carries `loaded` and `finding`; once the finder is done the rows are built for one room too, so the
offers left are listed and can be withdrawn, and `finding` says "Finding the rooms of your house..."; a room takes its
own number where no offer holds it.

**Found on the way, not changed.** An offer keeps its number after a door renumbers the rooms, and the panel's stepped
prices are keyed by the finder's number, so a renumbering mid-panel can carry a price to another row.

## HOMES-FORCE: a forced town read waits behind the one in flight (4)

**Reproduced first** (a town read the service answered before the rent, delivered after it): the rent succeeded - "Room
1 is yours for 1 day. The door will open for you." - and the registry held no tenancy; the door answered `locked` for
the town's minute.

**Why** - LOOK-STALE's root: the forced read `rentHomeRoom` asks after a rent (`homes.ensure(mapId, { force: true })`)
was handed the plaque's read in flight, answered before the rent landed.

**The fix** (`systems/onlineHomes.js`, the merge's one rule with LOOK-STALE): a forced ask is asked after the flight it
finds; one such read a town, however many ask - the first to land sets out a forced flight, and `ensure` hands the
rest that flight. `test/fb1001_rent.test.js` (6), each red on the code before. `tools/mutants/fb1001_rent.json` (28: 27
dead, 1 equivalent as recorded - `finding` in the panel's signature, which the doorway count beside it changes with);
`housing`'s HOME-RENT-the-orphans-number-taken re-aimed by content.

**Found and left open, for Mac.** A tenancy's end is read on the client's clock (the door, the plaque's days, the bed,
the welcome line), so a clock a day off locks out a paying tenant; the fix needs `now` in the town's answer - a service
change and a deploy. After a renewal the line names the days added, not the total left. `collectHomeRent`'s comment says
"the purse takes"; the gold goes to the region's account.

## MANA-HALF, MANA-SHOP: built, shipped, withdrawn (6)

Asked how much of the pool a rest should give back online and how Restore Power should be sold, Mac chose "Half the
pool" and "Everywhere, 1 g/point": online every rested hour (the rest window's, the collapse's, a cautious journey's)
filled magicka up to half the pool, and Restore Power cost what it restored at the buyer's level, a gold a point, shelved
by every alchemist and sold at the Mages Guild's magic-items counter to anyone. It shipped in PR #498 and was withdrawn
the same day - Mac: *"Revert all the potion and magic stuff"*. The revert takes all of it out (`systems/rest.js`,
`scenes/shared.js`, `scenes/world.js`, `systems/shopStock.js`, `systems/tradeModes.js`, `scenes/worldModes.js`;
`systems/restorePower.js`, `test/fb1001_mana.test.js` and `tools/mutants/fb1001_mana.json` DELETED; the pins and mutant
records it re-aimed put back; the Ledger's two rows removed). Online rest gives magicka back as REST-MANA1 left it,
and Restore Power is sold and priced as before.

What the measuring found stands for whoever asks again: every way magicka comes back online is free but the potion;
a whole pool rests back in about 3.6 real seconds, almost anywhere; Restore Power is sold only on the temples' and the
Dark Brotherhood's potion shelves, to members, a random handful a day, at a flat price whose gold a point falls as its
drinker rises (5 at level 1, 0.5 at 20). The rest window's header says eight hours take six seconds; the code takes
about 3.6.

## ROAD-LOT: a yard's lot is no road (5)

**Reproduced first** (`test/fb1001_yard.test.js`: the real yard - `createHomeYards`, the decorator, the panel, `decorRoom`,
the real `Collider` and the real account Worker over node:sqlite through `accountDecor` - over a town of the producers'
own, `test/fb1001Town.mjs`: `layoutLocation`/`layoutRmbBlock`, `setLocationTiles`, the terrain kernel with the road
painter's mask): house A's lot runs onto the street on its north (record 46) and a road-grass edge (55) cuts into its
east. A chair on the street was placed and written with nothing said; on the 55 edge the same. The marked edge was the
lot's four sides, its north band standing 2.6 m inside the street.

**Why.** The lot was the house's box and six metres round it, never inside the house nor on another building's
footprint (HOME-YARD). Nothing read the ground: `yardWhyNot` and `yardLotQuads` knew no road.

**The fix** (`scenes/homeYards.js`). The road is read off the built pixel's own tilemap - the one its terrain draws and
the feet read (`world.js` playerGroundSample): Daggerfall's path records 46, 47 and 55 (PlayerMotor.OnPathTile -
`player/exteriorSurface.js` onPathTile, the family `cityNavigation.js` and the grass placer already keep off: the town's
streets and the ring the road painter lays round a town), or a tile the road painter's own mask says it wrote (GRASS-PATH1:
a painted track writes record 11, which a field's dirt edge writes too, so only the mask can tell them apart).
`yardRoadsOf` turns them into squares in the lot's frame and `ownYardHere` hands them over as `cur.roads`. `yardWhyNot`
refuses a piece whose turned box meets one - "That is the road - keep the street and its paths clear." (`YARD_ON_ROAD`) -
touching the road's side is not on it (a 5 cm pad). The marked edge is the lot with the road cut out, run along the
road's side, each band facing into the lot (`yardLotEdges`; `scenes/decorTool.js` `DECOR_LOT_MARKS`, the batch's room).
Dirt (1) and stone (3) are ground, as Daggerfall's navigation reads them: a dirt yard stays a yard.

**Found on the way, not changed.** A flat's ground is a square of its whole radius, so a tall flat is refused well clear
of a road or a wall. The house's and the neighbours' footprints are not marked (their walls show them). The client's
lot is not clamped to the service's 48 m yard bound (`decorLaw.js`): a building whose models spread wide (Roleplay
Realism's fort block stands props 55 m from its origin) could have a lot the client takes and the service refuses
`bad-decor` - not measurable without ARENA2.

## YARD-CORNER: a piece's ground, not its corners (1)

**Reproduced first:** a 3 m bench turned 45 degrees across the house's north-east corner - none of its corners and not
its middle inside the house, the house's corner 16 cm inside the bench - was placed and written. **Why.** The housing
audit asked a piece's corners and middle; a convex piece covers a wall's corner with none of its own points in the
house. **The fix** (`scenes/homeYards.js` `yardFootMeets`): the separating axes of the piece's turned box against a
footprint - the house's, a neighbour's ground and the road's alike.

## YARD-STALE: a read from before a write stands nothing back (1)

**Reproduced first:** the town's minute read was answered before the owner placed a second piece and removed the first,
and landed after: the yard stood the removed piece again and dropped the new one while the service held the new one
alone - for the town's minute. **Why.** The answer replaced the town's whole cache, `sync` stood the yard from it, and
`keep()` covered only the writes made before the read set out. **The fix** (`scenes/homeYards.js`): the owner's writes
are kept by turn, and an answer asked before a write keeps the owner's latest list for that building - LOOK-STALE's law,
for the yards' own registry.

**Found on the way, not changed.** Where the town's answer names no pieces for the owner's yard, the yard keeps its own
pool, so a piece removed from another tab stands on this screen until the yard is made again.

## YARD-RECENTRE: yards move with the shift, in place (1)

**Reproduced first:** at a pixel crossing a yard's piece was drawn 819.2 m off on the crossing's frame, not at all on
the next, and right on the third. **Why.** The host runs the yards' frame above the motor and the recentre below it, then
draws, so the yards stood at the old offset when drawn; the next frame's re-stand put every piece again, and a model
stands only once its model's promise resolves - after that frame is drawn. The housing audit's "stood again the frame
the world recentres" held only in a test that shifted first. **The fix** (`scenes/decorRoom.js` `restand`,
`scenes/homeYards.js` `rebase`, `scenes/world.js`): the recentre moves every yard piece in place - its matrix, collider
bucket, billboard origin and light, a flat whose picture is still loading included - on the recentre's own line, so no
line cite into world.js moved.

**Found on the way, not changed.** Any other re-stand (the minute read finding a list in another order) still leaves a
yard's models undrawn for a frame.

`test/fb1001_yard.test.js` (5), each red on the code before on its own assertion. `tools/mutants/fb1001_yard.json` (34,
34 dead); `decor1` (2), `fieldbugs27g` DECOR-FLIP and `housing` (3) re-aimed by content, all dead; `homeyard`'s
lot-marks pin re-aimed at `DECOR_LOT_MARKS` (PIN MOVED). Four hosts: `world.js` WIRED (the rebase; the road read off its
built pixel); `worldModes.js` shares `createDecorRoom` (`restand` never called indoors); `dungeonContext.js` has no
street and `exterior.js` (the bench) no online homes - both FLAGGED, not wired.

## MOVE-BANK: past 100 a run is counted whole (7)

**Reproduced first** (the real chargen, `masterSkill`, `PlayerMotor`, `Collider`, `tickPlayerMinutes`, `raiseSkills`).
On the code before MOVE-REAL (#475, merged 2026-09-30) the report reproduces whole: ten minutes' running at a mastered
Running 110 counted 41 uses (2,398 now), 79 jumps counted 21, 70 climbing checks 20 - the spam weight's burst of six,
which MOVE-REAL took off the motion tallies. The chain MOVE-REAL built was walked again link by link - the odometer in
metres, the four hosts handing it to the tick, the tick's three tallies and the climb check through
`tallyMovementSkill`, the credit's mark, the masteries (all four can be mastered as primary, major or minor), mentor mode
- and holds. Two faults stood: a level-30 master ran 100 minutes and rested, and the pass banked 20,000 uses - 0.68 of
the first point - of a 24,000-use run; a 60,000-use day at level 20 landed one point and kept 0.009, and the next rest,
with no new running, landed nothing.

**Why.** `tallySkill` still clamped a mastered skill past 100 at PlayerEntity.TallySkill's 20,000 - a clamp that exists
to keep `(uses * reflexesMod) >> 16` inside an int32, where the past-100 arm spends progress in float - and
`raiseSkills` capped the carry at 0.99 and skipped any pass with no new uses. At four uses a second the bucket fills in
83 minutes; a full bucket at level 30 is 0.68 point at 100, 0.27 at 125 and 0.11 at 150, however long the run. The
notes' "if you run constantly" table held only for a player who rested every 83 minutes.

**The fix** (`systems/skills.js` tallySkill, `systems/advancement.js` raiseSkills): past 100, for a skill that can pass
it, there is no bucket; the past-100 arm reads the shift in float (`floor(uses * mod / 65536)`, the same number up to
20,000); what a pass does not land is carried whole, re-priced at the next point's cost (nothing at 200), so the next
pass lands it - still one point a pass. Below 100, unmastered, or with Master Skills off, DFU's clamp and carry stand.

**Found on the way, not changed.** Offline, switching Master Skills off with more than 20,000 uses banked leaves the
excess for the next tally's clamp. Climbing's credit is the odometer's vertical since its last check, so a hop in place
banks up to two Climbing uses for the next wall. The Master Skills boxes (`MASTER_SKILLS_INFO_ROWS`, `OFFER_ROWS`,
`INTRO_ROWS`, `ABOUT`) still say a skill past 100 learns only from tough foes, which the four movement skills do not.
Past 100 the movement gains are small (Running's speed +2.2% at 125, +4.6% at 150), and the integer `effectiveSkill`
reads 101-103 as 100: a player at 100-110 feels no difference - the global 25% law, for Mac.

## CLIMB-PAST: a mastered Climbing climbs faster past 100 (7)

**Reproduced first** (the real motor and collider, `climbingDeps` on a chargen'd, mastered character, online): Climbing
200 and Climbing 100 each climbed 7.76 m in the five seconds after the climb took hold, and `climbingChance` read the
same at 95 and at 140 - certain from Luck 40.

**Why.** In Daggerfall the skill drives one thing, CalculateClimbingChance, which clamps it to 5..95 and is certain at
95; GetClimbingSpeed reads no skill. A Climbing mastery - one of five a character has - bought nothing; Running, Swimming
and Jumping already read `effectiveSkill` in their speeds (`scenes/shared.js` motorStats, `skills.js`
jumpSpeedMultiplier), as combat does.

**The fix** (`systems/skillSoftcap.js` `CLIMB_OVERCAP_SPEED_PER_POINT`, `overcapClimbSpeed`; `player/climbing.js`
`climbingSpeed`; `player/motor.js`, the climb's move, with the live Climbing the check reads): past 100 each effective
point climbs 1% faster - x1.08 at 125, x1.17 at 150, x1.4 at 200 - bounded at the effective cap. To 100 the climb is
DFU's base/3, and the spell still doubles it. The 1% a point is the lane's own number, one constant to tune. A curse or
a Fortify that lifts the live Climbing past 100 speeds the climb as it already speeds the run.

`test/fb1001_move.test.js` (2) and `test/fb1001_climb.test.js` (2), red on the code before. `tools/mutants/fb1001_move.json`
(16, 16 dead). Four hosts: none needed wiring - MOVE-BANK lives in `skills.js` and `advancement.js`, CLIMB-PAST in the
motor and `climbing.js`; `world.js`, `exterior.js`, `worldModes.js` and `dungeonContext.js` each hand the odometer and
the climbing deps as before.

## MARKET-KEEP: a piece the service calls another's stays in the pack (2)

**Reproduced first** (`test/fb1001_market.test.js`: the real Worker and the real anvil craft, the piece handed on with
`settleRealmTrade` - the law the service settles a realm trade by): the crafter makes a sword and trades it to Ann; the
product's owner stays the crafter. Ann presses List: the piece leaves her pack, the service answers `market-not-yours`,
and her pack is empty - the piece destroyed. A listing kept through a network silence and answered "not yours" on a
later settle was dropped from the save the same way, and the game's own take had already queued a checkpoint, so the
realm record lost it too.

**Why.** AUDIT 31 H1's `PIECE_GONE` (`net/marketBook.js`) read `market-not-yours` as proof the save's piece was a copy,
beside listed, on the road and standing in a home - so the piece was never put back and a settle took it out of the
save; the writs' Fill reads the same list (`net/writBook.js`). But "not yours" is a fact about the record alone: the
hand-over of Professions-Arc section 18 (a trade moving a crafted piece's owner) was never built - the realm trade
(`server-account/src/realmTrade.js`) moves the piece between saves and never `products.owner`, and a shop's shelf, a
room's container and a looted body hand crafted pieces on without the service at all. A traded piece was its holder's
only copy, and List destroyed it.

**The fix** (`net/marketBook.js`, `net/writBook.js`'s reader): `market-not-yours` is no longer in `PIECE_GONE`; the
piece goes back to the pack on a press and on a settle, for the market and the writs, and the refusal says it stays in
the pack and can be sold from it for gold. The List form no longer offers such a piece as a crafted piece (MARKET-ANY's
`ways`, below).

**Found on the way, not changed.** A real copy can still exist: a crafted listing that lands and sells while the pack's
checkpoint is lost in a crash leaves the copy an ordinary piece now, rather than removed - it can no longer list as a
crafted piece. That is the price of never destroying a traded piece; the hand-over closes it at the root.

## MARKET-ANY: a piece from the pack lists, for gold (2)

**Reproduced first** (the real producers through the List form): a looted dagger and a looted piece of armour - not
offered; a crafted Mithril Longsword - offered; a Sigil Stone and a Sigil Broker's ware - not offered. "Only bound items"
read backwards: nothing bound was offered, and nothing from the world either - the form offers Stores materials and
crafted pieces with a maker's record (`scenes/world.js`'s filter, `ui/marketTab.js` "You carry no crafted piece to
sell"), and the service takes `material` or `piece` alone (`server-account/src/market.js`). A player who had crafted
nothing could list nothing.

**Why.** 10.2's rule ("Loot does not list": it has no provenance) was right while a save was the client's alone. Since
REALM P1 a realm character's save is a record on the service, REALM P2.1 already moves a piece between two records in
one write, and since REALM-DOOR every online character is a realm character.

**The law** (`net/marketLaw.js` `goodRefusal`; `server-account/src/market.js` `listGood`, `collectGood`;
`server-account/migrations/0044_market_goods.sql`; `net/marketBook.js`; `systems/tradePack.js` `createMarketGoods`;
`ui/marketTab.js`; `net/accountClient.js`; Ledger A). A piece from a realm character's pack lists **for gold alone** -
the move a realm trade already makes face to face, so no new trust. Never for Drakes: after the first save the service
never inspects a checkpoint, so a client could write any piece into its record, and a save-edited piece must not buy
Drakes (law 3; the threat table's "a save-edited item enters the economy"). Refused, each in words on the form: worn,
locked, quest, summoned and bound pieces; gold, letters of credit, boat deeds and parts; arrows; Stores materials (ores,
ingots, gems, herbs, hides, creature parts - GOLD-MARKET's wall: what Drakes bought never lists for gold); a record over
the request body's bound. `listGood` reads where the realm record stands and takes the record's own piece at `pick`
out of the seller's record in the listing's batch (`prepareRealmRecord` with a `mustChange` guard); the offer must be
the record's (`recordIsOffered`), and a crafted piece whose record is the seller's must list as a crafted piece
(`market-piece-route`). A gold buy writes a delivery (one bought in the board's region arrives at once); a cancel, an
expiry and a moderator's removal write a returned one; `collectGood` puts the piece into the collector's record in the
collect's batch, guarded. Nothing is copied: the piece is in one record, on the listing or on the road. The tab shows a
**Goods** view after Auctions, the road, My listings and History rows, and "A piece from your pack (gold)" to realm
characters alone; My listings sends the crafted pieces the tab holds and the service answers each one's `ways` (yours,
another's, elsewhere, no record) - the crafted picker offers only one's own and names the others.

**The service.** Migration 0044 rebuilds `market_listings`, `market_sales` and `market_deliveries` with the third kind
(SQLite widens no CHECK in place), every row carried, every index made again as 0032 and 0043 (SCALE1) wrote them; the
reports - `market_reports` names a listing by a cascading foreign key, and the drop cascades whatever
`defer_foreign_keys` says - are kept aside and put back. No other table names the three. `ACCOUNT_VERSION` is `acct44`
(`service.js`, `wrangler.toml`). **It deploys with the merge** (`account-deploy.yml` runs on `server-account/**`). A new
client before the new service degrades safely: a pack listing is refused `bad-act` and the piece comes back, the crafted
picker offers what it did with no `ways`, and the Goods view says it could not be read.

**Found on the way, not changed - for Mac.** (1) Drakes for a pack piece: not built - law 3. (2) The wall on Stores
materials keeps looted gems, herbs, metals and creature parts off the pack route too; relax it? (3) The trade hand-over
(section 18): the realm trade could move a crafted piece's owner in its settle batch, which closes MARKET-KEEP at the
root and the forged copy below - should a handed-on piece count as bought with gold, so it never relists for Drakes?
(4) A pack piece lists as its whole stack; the service takes part of one, the form offers none. Also: the original
crafter still owns the record of a piece traded away, and can list a forged copy as a crafted piece for Drakes (older
than this batch; the hand-over closes it); Stores materials withdrawn to the pack still reach gold through a trade or a
shop (older; the market walls them now); the four foods are not walled (their templates ride client settings; worth
almost nothing).

`test/fb1001_market.test.js` (3) and `test/fb1001_market_goods.test.js` (12), red on the code before (the goods file
fails to load without its modules). `tools/mutants/fb1001_market.json` (66, 66 dead - AUDIT PROF-541 R2-S2's two among them); the 246 market mutants of the
arcs before (prof5, prof5b, audit30, audit31, goldmarket and others) re-run - 236 dead, 9 equivalent as recorded, and
audit30's U2, which did not parse on the base either, re-aimed and dead. PIN MOVED: AUDIT 31 H1 at `market-listed`, the
market's views, the gold wiring's pattern, eight `acct43` pins; mutant records re-aimed by content (audit30 S7, U16,
U2; gatekeys; goldmarket's one-cache; prof5's cancel-still-listed, collect-early, collect-any-character; prof5b's
any-piece-auctioned).

## Part three - the rain in a puddle, the sprinkle, the square clouds, the sea from under it, the slow frames, the Overworld's weather and its players

Two lists through Mac, the second added while the first was being worked: eight lines on the rain, the clouds, the
sea and the frame rate, then three on the Overworld. The batch's rule is the one Mac set on 2026-09-30 ("I dont care
about DFU. We're our own thing now"): each report root-caused on the real modules, and fixed wherever it failed the
player - three of the fixes are departures from Iliac Puddle No More's own presentation and are in the Port-Ledger.
Eleven reports; every fix pinned red on the code before it, the frame rate's measured or read on the code (no GPU here).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "When sinking into a puddle rain isnt shown and disappears from screen" | the port swims wherever the drawn water is under the feet (MAC2), a puddle record's whole tile among it, and DW-D stood the rain, the snow and the sand down for any swimmer outdoors - the mod's UpdateWeatherParticles - so a body sunk in a puddle, its eye 0.2 m over the water, lost them while the rain loop played on | fixed (PUDDLE-RAIN) |
| 2 | "Rain shouldnt always be a downpour, should sometimes sprinkle" | WX2 rolled a rain's peak in 0.25..1, and on the weather map's lane the place's intensity (0.2..1 over a system's core) was the roll, so no rain drew under ~0.4 of the profile; and whatever fell, the world wore the downpour's row - its fog, its sun, its grass | fixed (RAIN-SPRINKLE) |
| 3 | "Clouds in the distance sometimes look square" | the volumetric clouds' sky map, a third of a degree a texel (6 to 23 screen pixels), read by ONE bilinear tap, each texel marched from its own jittered start: a far cloud a few texels across was soft squares and diamonds | fixed (CLOUD-SQUARE) |
| 4 | "Underwater should have a water look to it, not as clear" | under Iliac Puddle No More's sea the mod's distance fog leaves a pixel at the eye untouched and takes ~2% of its red a metre over a 66.5 m vision; the world fog is a thin neutral grey; nothing tints the water body | fixed (UNDER-LOOK) |
| 5 | "Underwater should have sun rays that dynamically show through the water" | nothing draws any | built (UNDER-RAYS) |
| 6 | "Sometimes performance issues when along the coastline" | Come Sail Away's breakers are rebuilt at every map pixel crossed on a coast, several hundred straight-down rays from 500 m over the sea, and the port's Physics.Raycast walked the ground in quarter metres asking it again at every step and halving - ~1,900 lookups a ray, a stall of a tenth to more than half a second a crossing | fixed (COAST-RAY) |
| 7 | "Sometimes performance issues when looking at AI ships" | no single cost the view switches on was found (a stub-renderer measure: a galley's frame the same in view and behind); what the view does switch on is the ships' flats - a galley's fifty, lanterns half of them - drawn from every ship to 1.9 km where her hull's meshes are left undrawn under a pixel; and the flags' cubes made five arrays a turn, two turns a triangle, every frame | fixed (SHIP-FLATS, SHIP-FLAGS); the hull's tree walk left |
| 8 | "Culling performance issues when using the morrowind model and around a large group of players" | after WB9h's budget: a body the view swung onto past the 2 m margin was skinned in the draw, outside the budget (a crowd turned onto, posed whole in a frame); every pose walked its skin for a sphere nothing read; a stand-in built per body per frame; a weapon drawn rebuilt the body, and a lingering body's rig was thrown away | fixed (MW-CROWD); the sprite pass per body left open |
| 9 | "Also in the overworld, weather is weird, it only happens around the player at small scale" | the rain's, the snow's and the sand's boxes (42-70 m) and the wind's wisps wrapped round `cam.pos` - which under the Overworld stays on the traveller's head while the view stands 150-450 m up and back: a little cube of weather round the sprite, seen from outside it | fixed (OW-WEATHER) |
| 10 | "Your sprite doesnt rotate based on direction" | the keys turned the body to the VIEW's heading and walked it camera-relative from there, so it showed its back whatever was held - S walked it backwards at the camera, A and D sideways - and the sprite's eight views and the Morrowind body never turned | fixed (OW-FACE) |
| 11 | "and you cannot see other player's sprites" | the traveller's own body is grown with the eye's distance (OW-BIG); every other player stood at their own size - a speck at 330 m under the name that stood over them | fixed (OW-PEERS) |

Pins: `test/fb1001_{puddlerain,rainsprinkle,cloudsquare,underwater,overworld,mwcrowd,coastships}.test.js`, each file red on the code
before (the four that import what this batch exports fail to load; `puddlerain` fails both tests on the old gate).
Mutants: `tools/mutants/fb1001_*.json`. PIN MOVED, each by content: `dwc_fog` (the gate's line), `weatherfront`
(four seeded floors of 0.1 restated against the episode's own peak - a seed may roll a sprinkle now - the hosts'
terms line, and the Rendering entry's and the Ledger row's quoted ranges), `wind3_windworld` and `weather2d_sandstorm`
(the world host's weather eye), `mwbody1`, `htwaistback`, `hitflash1`, `werewolf1` and `disc23b_eotb_sprites` (the
peer layers' option lists and the body hook's).

## PUDDLE-RAIN: what falls is hidden by the water over the eye (1)

**Reproduced first** (the real `exteriorSurfaces`, `exteriorSwimming` and Deep Waters' `fogPresentation`; the frame's
gate lifted off world.js and run): every puddle record (`SHALLOW_WHOLE`, 8 23 33 34 35 36) answers Swimming under
the feet anywhere on its tile (WATER-PUDDLE kept the feet on DFU's whole tile), the motor sinks the body (the eye
0.20 over the feet), a sunk body is IsPlayerSwimming, and the sea's own fog says an eye 86 m over the sea inland is
not under the water. The old gate - `_dwAirOff || (dwPlayer && walkMode && isPlayerSwimming && !waterWalking)` -
answered "hide" for it; the rain and the sand stopped drawing, the rain loop kept playing (the ear never read the
gate). The classic lane without the sea mod never hid it, and the fixed-city host (`exterior.js`) has no such gate.

**The fix** (`scenes/world.js`): `_dwPrecipOff` is `_dwAirOff` - the distance fog's "under" (the water over the
eye), which already took the wisps and the bolts. Under the sea the rain is still hidden, swimmer or not; a swimmer
with the head out of the sea sees the rain, as does a body in a puddle. A departure from the mod (Port-Ledger).
`test/fb1001_puddlerain.test.js` (2), `tools/mutants/fb1001_puddlerain.json` (4, all dead).

Found on the way, not changed: a puddle still SWIMS the body (MAC2's coverage law on DFU's shallow records) - no rest
there, no encounter roll, the swim's speed and tally, SWIM-SPENT's drain; that a puddle should not sink the player at
all is MAC2's call and Mac's to make.

## RAIN-SPRINKLE: a rain drizzles at its edge and pours at its heart, and looks like it (2)

**Measured first** (the real front, `rollPeak`, the weather map's band law): over a rain system's core, sampled
evenly by area, the drawn share at the wander's mean never fell under 0.32 of the 26,000-drop profile; the seeded
lane's floor was 0.25 x 0.6. And `blendTerms` crossed to the rain row whole once the front was in - exp fog 0.003
(half the land gone at 230 m), the sun at 0.45, the grass at 0.6 - for a sprinkle as for a storm, which is what
read as a downpour whatever the count.

**The fix** (`systems/weatherFront.js`; both exterior hosts): the ranges are rain 0.05..1.0 and snow 0.05..0.85
(a storm 0.6..1.0 and a sandstorm 0.5..1.0 as they were), the roll placed by u^skew (rain 2, snow 1.5) - on the map's
lane the place's intensity is the roll, so a system's edge drizzles and its heart pours: over the core, by area,
nearly half the ground falls under 0.3 of the profile and a quarter under 0.15, and a downpour (0.65 and up) is its
heart, an eighth of it. And `fallTerms`: under FALL_LOOK
(0.05..0.6 of the profile) a rain's or a snow's fog thins to a quarter of its row's density (the mode kept, so no
switch on the screen) and its sun and grass come up to an overcast sky's; any other word is handed back as it came.
Enhanced only, as WX2 is; the classic lane still draws DFU's cap on the sim's word. `test/fb1001_rainsprinkle.test.js`
(2), `tools/mutants/fb1001_rainsprinkle.json` (7, all dead).

## CLOUD-SQUARE: the sky map read through a B-spline (3)

**Seen first** (the sky lab in a real browser, `?clouds=lo`, a cloudy row at the horizon, before and after, the
horizon band magnified four times and stretched): the one tap's texel grid - diamonds and squares along the far
band - and the B-spline's rounded field over the same marched texels. The composite's own function run in JS over a
hardware-bilinear stand-in: the one tap's slope jumps by 2 a texel at a texel's centre (one bright texel in a dark map); the
B-spline's by a thousandth of that, there and everywhere across the cloud.

**The fix** (`render/volumetricClouds.js` `COMPOSITE_FS`): `mapBicubic`, a cubic B-spline over the map in four
bilinear taps, wrapping in azimuth and clamping at the rows as the one tap did. `test/fb1001_cloudsquare.test.js` (2),
`tools/mutants/fb1001_cloudsquare.json` (3, all dead).

Investigated, not changed: a weather cell's column in front of the deck spends part of the march's 24 km budget, so
behind a cell the deck is walked a shorter way than beside it. Measured with the march's own functions (test/
cloudSky.mjs), a cell's own profile replaces the deck's over its disc, and walking the cell's metres on top of the
budget moved the deck's colour behind it both ways - closer to the bare sky in one case, further in others - so it is
not the square, and it stays as SLAB-SPAN left it. The variation channel's 512 m texels (`VARIATION_M`, read at
level 0) were not changed either: nothing showed them as the square.

## UNDER-LOOK and UNDER-RAYS: the sea looks like water from under it (4, 5)

**Why it read clear** (the mod's numbers at its sliders' defaults, `world/deepWaterLook.js`): a 66.5 m vision; ~2.7%
of the red absorbed a metre; a grey at 0.5 kept as (0.44, 0.47, 0.47) at 5 m; nothing at the eye; the world fog a
thin neutral grey (0.02); the sun's key light untouched under the water. No caustic, no shaft anywhere in `src/`.

**The fix** (`world/underwaterLook.js`, `render/deepWatersRender.js`, `world/deepWaterLook.js`, `scenes/world.js`):
- THE MURK: the mod's vision distance times `UNDERWATER_MURK` (0.55) - `distanceFogUniforms`' new `murk` (1 is the
  mod, number for number), so the absorption and the scatter a metre, the bands and the sky's distance all follow and
  the sliders scale it as before.
- THE BODY: over every pixel the world drew while the eye is under the sea, c x keep + body - keep (0.66, 0.86, 0.88)
  at the surface to (0.26, 0.48, 0.55) at 40 m, a touch less by night; the body's light (0.016, 0.075, 0.085) by day,
  a fifth of it by night, less deeper.
- THE SHAFTS: the sun bent at the surface (Snell, n 1.333), and each point along the view out to 24 m (or the surface)
  lit by the surface point its light came in at, through a drifting two-octave pattern of the surface's focus -
  fainter with distance along the view and with depth, by e over 28 m of the eye's depth, scaled by the frame's sun
  (the weather and a cloud over the sun in it), none by night.
One full-screen triangle drawn twice (multiply, then add, alpha kept) after the arrows and before the weapon and the
HUD, on either skin; no depth is read (no program of every lane can), so the shafts are the near water's. Seen in a
real browser over a synthetic seabed: the blue-green body, the far floor closed sooner, the shafts leaning with a
morning sun, converging looking up, moving between t 0 and t 4. `test/fb1001_underwater.test.js` (5),
`tools/mutants/fb1001_underwater.json` (12, all dead).

Not in it: dungeon water (DFU's own UnderwaterFog, dense already) and the wilderness's lakes (no exterior submersion
exists - the eye never goes under them).

## OW-WEATHER, OW-FACE, OW-PEERS: the Overworld (9, 10, 11)

**OW-WEATHER** (`scenes/world.js` `wxEye`): the sand, the rain, the snow and the wisps wrap round the eye the view is
drawn from - `mwv.eye`, the view's own under it, the head's on the ground - so the air in front of the camera is full
of what falls, as it is when you stand in it. The streaming, the weather sample and the grass stay on `cam.pos`.
Travel Options' AllowWeather (off by default) still hides the rain and the snow on a journey, as the mod does.

**OW-FACE** (`player/travelCamera.js` `keysHeading`, `axesToward`; `scenes/travelView.js` `steer`; `scenes/world.js`):
the steer turns the body toward the way the keys point from the view, and the host turns the keys' vector onto the
body before the motor reads it - the walk is the keys' way from the view at every facing (TV1's camera-relative law,
unchanged), at the keys' own speed, straight ahead once turned. The sprite's eight views, the Morrowind body's walk,
the chevron and the pose sent to the others follow the heading. A journey or the autopilot drives as before.

**OW-PEERS** (`scenes/world.js` `peerGrow`; `net/peerRiders.js`, `net/remotePlayers.js`, `net/peerBodies.js`): every
other player is grown by the traveller's own law at their own feet (`tvOwnGrow` of the view's eye to them) - riders,
beasts and walkers (size, offset, reach), dolls and class sprites, Morrowind bodies (`drawThird`'s `grow` and the
view's lean, culled by their grown reach); names over the grown heads; no giant's shadow; no walker's lantern.

`test/fb1001_overworld.test.js` (5), `tools/mutants/fb1001_overworld.json` (12, all dead).

## The frame rate (6, 7, 8)

### MW-CROWD: the crowd's bodies, turned onto (8)

**Read on the code after WB9h** (no GPU here to measure; `07-Rendering/Performance-Rig.md` MW-CROWD carries the
numbers): WB9h held the crowd's skins to SKIN_BUDGET (4) a frame and culled them by the view, deciding on the LAST body
pass's view with a 2 m margin - about 11 degrees of lead at 10 m. A body the view swung onto past it arrived stale and
was posed in the draw, outside the budget: at 300 degrees a second and 30 frames, a crowd turned onto posed whole in one
frame, a CPU skin and a whole re-upload each - the hitch of turning round in a crowd. Beside it, every pose walked the
skin twice for a sphere only the shadow recorder reads (the sprite target never casts); every stepped body built a whole
stand-in entity every frame for the weapon it holds; a weapon drawn tore the body down and built it again; and a body
whose peer mounted or left the list a moment was thrown away and built again on its return.

**The fix** (`net/peerBodies.js`, `render/renderer.js`, `combat/fpArm.js`): the margin leads the turn
(`turnLeadMargin` - the angle the view turned last frame, three frames of it at the body's distance, capped), so the
bodies about to come into view are skinned on the budget before; the third-person mesh has no sphere to walk
(`bounds: false`); the weapon asked of a look is one object; a person's body key is its look less its weapons (the
hand is `setWeapon`'s); a lingering body is kept as a spare. `test/fb1001_mwcrowd.test.js` (4),
`tools/mutants/fb1001_mwcrowd.json` (8, all dead). PIN MOVED: `wb9h_crowd_bodies` (the lingering body kept),
`audit_wb9` (an armor change rebuilds, a weapon no longer does), `werewolf1` (the person's key); `wb9h.json`'s
WB9h-the-linger-spared retired (it is the law now; MW-CROWD-the-lingering-body-unloaded is its inverse), nine older
records re-aimed by content.

Still open: the sprite render is one offscreen pass a seen body a frame - batching every seen body into one bind of
the target, or keeping each body's picture across frames, is the next slice, and it needs a GPU (above all a
tile-based one) to measure. For the reporter, `?perf=cpu`'s `online` and `bodies` spans and `?perf=zones` say which.

### COAST-RAY: the coast's breakers, rebuilt in a moment (6)

**Measured first** (a replica of the real `buildWaveMesh` over the walk as it stood, a trivial `surfaceAt` - the game's
builds a key, reads the built map and the carved sea's floor at every call): Come Sail Away rebuilds its breakers at
every map pixel crossed (`OnPositionUpdate -> UpdateWaveMesh`; and at OnLoad, OnTransition and a teleport) - four
straight-down rays from 500 m over the sea for every water pixel in the window and every water neighbour, and the
port's Physics.Raycast (`world.js` csaRaycast) walked the ground in quarter metres and twenty halvings asking
`surfaceAt` at every one. A straight coast at Waves.Distance 2: 540 rays, 1,027,080 lookups, 58 ms; at Distance 4,
3,218,184 lookups, 142 ms - inland nothing (no water pixel, no ray), so a coast's walk, a zig-zag over a pixel border,
or a boat at sea stalled now and then.

**The fix** (`scenes/world.js` csaRaycast): a straight-down ray asks its one column once, and its walk starts two
quarter-steps short of the crossing (the height falls with t, so every step before is a miss; t0's steps are exact
quarters, so the step it starts on is the one it reached) - or not at all where nothing can be met. The same answer to
the bit (a thousand columns at random, and the coast's whole mesh, against the walk as it stood); 540 lookups and
1.8 ms for the coast above, 3.3 ms at Distance 4. Every straight-down ray Come Sail Away casts gains it (PlaceBoat's,
the foes' under a boat owner). `test/fb1001_coastships.test.js` (COAST-RAY, 2).

Found on the way, not changed: near a port whose shore sounds no harbour, the naval host sounds it again every ten
seconds (`navalHost.js`, HARBOUR_RETRY_S) - 10,000 to 26,000 `isWater` asks a time; and the carved sea's two blended
top passes and its floor are fill the GPU pays near a coast, not measurable here.

### SHIP-FLATS, SHIP-FLAGS: the ships in view (7)

**Measured first** (five Large Galleys of the real models in Node, a stub renderer): the pool's frame and draw cost the
same with the ships in view as behind the eye (2.91 + 1.32 ms against 2.87 + 1.27) - the walk of each hull's node tree
(594 nodes for a galley, 224 of them idle oar-effect particles) runs for every ship within 1.9 km whatever the view. What
the view does switch on: the ships' flats - a galley's fifty-one, her lanterns twenty-five of them; a small ship's
twenty-five - went to the billboard pass from every ship out to 1.9 km, three GL calls a flat, where her hull's own
meshes are left undrawn under a pixel (AUDIT NAV1's CULL_DETAIL_PX); and a flag's two dozen cubes were turned through
`quatRotate`, five arrays a turn, two turns a triangle, 36 triangles a cube, every frame.

**The fix**: `scenes/world.js` `pushSeenShipFlats` - the boats' flats take the hull's law (a sphere under a pixel across
at the drawing buffer's height from this frame's eye is not drawn; under the game's 70-degree lens on a 1080-line
buffer a flat 0.4 by 0.5 m is a pixel at ~490 m, a sail far past it); `world/quat.js` `quatRotateInto` - quatRotate's products in its order, written into a
scratch triple (to the bit, 2,000 cases), which the flag cubes turn through. `test/fb1001_coastships.test.js`
(SHIP-FLAGS, SHIP-FLATS, 2). `tools/mutants/fb1001_coastships.json` (9: 8 dead, 1 equivalent as recorded).

Left open: the hull's tree walk itself (pruning the subtrees the pool never reads - the oar effects' - would halve a
galley's), which AUDIT 0928's pin holds to every active object in order; and at night a moving ship's lanterns within
51.5 m re-render their shadow faces every frame (a change to what is lit, so not taken here).

## Part four - mining, the regeneration spell, the King's Mark, the cloak's drape, the identified trade, the shrine

Seven screenshots through Mac - six #bug-reports threads and one #suggestions post - and his own line beside them:
*"Also mining, the life skill, is broken"*. The rule is the one Mac set on 2026-09-30 (*"I dont care about DFU. We're
our own thing now"*): every report root-caused on the real modules before anything changed, each fix pinned red on the
code before it and mutation-checked. Five search lanes ran at once, one a report each; the mining lane walked E to the
ore end to end on the real modules and ranked what could make it do nothing. One report did not reproduce, and is
answered with a guard pin. Three calls were Mac's, asked after the first push: the shrine (*"Not now"*), the climb at a
vein (*"Hold it at nodes"* - CLIMB-NODE) and an area spell's caster (*"Include the caster"* - AREA-CASTER). Then two
words of his: *"let's do a comprehensive audit on this and also ensure the other professions are sound"* - the audit,
at the end of this part, twenty faults fixed and two calls asked - and *"Remove the time limit for professions"* -
ANY-HOUR, before it.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "minig is broken doesnt work"; Mac: "Also mining, the life skill, is broken" | OG; Mac | nothing in the laws (every mining suite green): four faults between E and the ore. Mid-act only the right button struck - a left click was the act's and nothing else, and the meter's "strike the glint" named no key; a finger's or a pad's Attack never reached the act, street or dungeon; a boulder was found only by aiming a metre up its rock, and the node nearest the look was hidden-tested alone, so one behind its rock hid every other; a vein with no rock left could stand inside a rock piece; and walking into a vein's rock to reach it climbed the rock (CLIMB2's free climb) | fixed (ACT-CLICK, ACT-TOUCH, NODE-AIM, VEIN-CLEAR); asked, built (CLIMB-NODE) |
| 2 | "Regen spell stopped providing healing after vampire transformation" | Skaadi | the turn's CureAll ended every live entry: a running Regenerate ticked on hidden from the HUD, the party cards and the dispel list, and every recast merged into the hidden one; CureAll never cured the poisons nor filled the pools it should | fixed (CURE-ALL) |
| 3 | "Big Regen Spell doesnt do anything" - GOD MODE: Area at Range, Magic Based, Regenerate and Fortify Attribute (Strength) | Opaldes; Skaadi: "Yeah that's precisely what my spell is as well. Same issue." | an Area at Range spell reached its caster only where it burst within 4.35 m of them, an Area Around Caster never (DFU's ignoreCaster); and where it did, its caster saved against their own gift - the Regenerate every round, the Fortify at its landing, two rounds in three zeroed for a Breton, silently | fixed (AREA-SELF); asked, built (AREA-CASTER) |
| 4 | King's Mark: "If these items spawn as wands, they cannot be equipped as wands are not an equippable effectively being useless. Solution: Make these items not roll as wands" | Cruor | a Legendary record names the piece a maker minted; the Gate's spoils and a town's thanks drew a jewel over all eight Jewellery templates, and the eighth is the Wand, which no slot takes - one jewel in eight, every tier on it read by nothing | fixed (RARITY-WEAR) |
| 5 | "With the last patch it removed the 'Use' button for cloaks and replaced it with 'Raise Hood' and I can no longer change how the cloak is worn, eg; Over shoulder, behind, etc" | SlipperyPeasant | HOOD-SAID (PR #468) put the hood's button in Use's place on a worn cloak's card, and the hood keeps the drape: a worn casual cloak's other two drapes were out of reach on the Enhanced Plus pack | fixed (CLOAK-DRAPE) |
| 6 | "If you trade someone unidentified items and they identify them, They will not be identified when traded back to the original player." | Masta_Fu | did not reproduce: the flag rides every door a traded piece passes, hand to hand and through the realm | answered; guard pin (TRADE-KNOWN) |
| 7 | "Fully restore magicka by donating to wilderness shrines" - "Make an offering of (x amount gold) and meditate for an hour?" (#suggestions) | QuinsmQuansm | a design ask - World of Daggerfall's shrines stand in the wild (`WOD_Shrine_Dibella_01`, the regions' Shrines and Roadside Shrines lists), and nothing in them is worked | asked: Mac, "Not now" - recorded, not built |

Pins: `test/fb1001_{mining,regen,wand,drape,identify,climbnode}.test.js` (8, 5, 3, 2, 2, 4), each red on the code before
but the guard pin (it passes on the code before, and its mutants are the claim) and the guards beside the reds (a jump
not held, a blast with harm in it). Mutants: `tools/mutants/fb1001_mining.json` (15), `fb1001_regen.json` (14),
`fb1001_wand.json` (11), `fb1001_drape.json` (10), `fb1001_identify.json` (5), `fb1001_climbnode.json` (6) - all dead. PIN MOVED, each by content: `prof1_client` (the world host's `gatherHost?.acting()` reads, seven to eight - the
tap's), `audit0928_input` U2 (the tap hook it lifts asks the gathering host's act, after the decorator's flight -
`gatherHost: null` in its scope), `parkour` CLIMB1 (the world host's motor hands the parkour deps its hold), `lycanthropy` V2a (the old life's fortify runs on), `curse_persist` CURSE-REPAIR1 (what the onset cures is a
drain, not a buff; a curse given back cures neither). Mutant records re-aimed by content, each dead: `audit29.json`
AUDIT29-C1-through-the-wall (the seen test is the loop's now), `fb0929h_infectionkept.json`'s turn mutant (CureAll's
import), `prof2.json` PROF2-33-no-stone-tile and `wb5.json` WB5-a-piece-without-its-row (the guards they cut grew a
clause), and the three cite-rot records whose cites the shift moved (`survtiers.json`'s potion cite, `survtiers3.json`'s
two equip cites). Six world.js cites in struck rows (the Ledger's, the Settings spec's), which the shift holds, were
moved by hand to the lines they mean (citedrift CD4).

## ACT-CLICK and ACT-TOUCH: every press the player has strikes (1)

**Reproduced first** (the real gathering host and its kinds over a stood Woodlands pixel - `test/fb0930b_toolsaid`'s
- and the world host's own input closure lifted off its source and run over the real edge ring and the shipped
bindings): E at a vein starts the act; the act strikes on `input().attack` alone, which was the frame's SwingWeapon
press - the right button (`inputActions.js` Mouse1). A left click (ActivateCenterObject) reached nothing: mid-act it is
the act's and no door's (AUDIT 32 H5), and the act never read it. The meter said "strike the glint". A finger's Attack
button or swipe and a pad's trigger never write the edge ring - they call the hooks object (`inputHooks.attack`), which
during an act refused the press ("an act's tap is the act's") and handed it to nobody; underground the dungeon's sink
does the same (`dungeonContext.js` playerAttackInput). So on a phone or a pad the meter stood, the glint moved round,
and no vein was ever mined; Logging's chop, the Basket's search and Fishing's haul read the same input. AUDIT 29 C2/H3
had met the same wall from the other side - a click or a tap started an act a swipe could not play - and took the
click's start away rather than giving the act its strike.

**The fix.** ACT-CLICK (`scenes/world.js`, the gathering host's `input`): the act's strike is the swing's press OR the
activation's - either button, on the press, never the hold. ACT-TOUCH (`scenes/gatherHost.js` `strike(held)`): the
hooks hand every press to the host before any gate (`inputHooks.attack`, so the street's and the modal rigs' alike),
and a tap mid-act is a strike (`inputHooks.tap`, right after the decorator's flight, under which a tap is no press; it
armed an activation that did nothing mid-act); the press that
lands while an act plays is its strike on the next frame - that act's, never one Escape and E swapped in under it - a
held finger or a swinging stick strikes once, and a press with no act is never banked for one that starts after. The meter names it: "click to strike the glint", "click as the
ring meets the notch" (`ui/profHud.js`). THE FOUR HOSTS: the streaming world wired (the street, and the dungeon and the
buildings through the same hooks); the fixed city (`scenes/exterior.js`) stands no nodes (PROF0 17.1, FLAGGED there);
the interiors (`scenes/worldModes.js`) and the dungeon (`scenes/dungeonContext.js`) hold their swing off an act as
before and are reached by the world host's hooks. `test/fb1001_mining.test.js` (ACT-TOUCH 4, ACT-CLICK 1).

## NODE-AIM and VEIN-CLEAR: the node you look at is the one you get (1)

**Reproduced first** (the real host over the pixel, a boulder at a rock four metres tall): a boulder's aim point is its
lift, half its rock's height up to 1.2 m (`mineHost.js` standMineNodes), and the host found a node by the angle to that
point alone, within NODE_AIM_DEG (12) - so from a metre and a half its loose stones, where NODE-MARKS' glow stands, are
some 30 degrees off it, and no look at them found it: no prompt, and E did nothing. And the host took the node nearest
the look, then asked the collider whether it was seen (AUDIT 29 C1) - only that one: a vein behind its rock nearest the
crosshair hid every other node in view. And a vein with no rock piece left to claim stood on the nearest stone tile
where nature could, with no look at the field's pieces: a rock field stands on stone, so that tile could lie under a
piece - a vein inside a rock, glowing and on the compass, that no look could reach.

**The fix** (`scenes/gatherHost.js` findTarget; `scenes/mineHost.js`). The look meets a node anywhere up its upright,
from its base to its aim point (the point of it the look passes nearest - the look's height at the node's distance
along its bearing, held between the two); of the nodes in the cone, nearest the look first, the first the collider
says is seen is the target. A vein's stone tile and its last fallback are never inside a rock piece (`insideRocks`,
AUDIT 29 C11's test for a rock's foot). The act's own aim - its glint points - is the node's aim point, as before.
`test/fb1001_mining.test.js` (NODE-AIM 2, VEIN-CLEAR 1).

## CURE-ALL: the turn cures the old life and leaves this one's buffs (2)

**Reproduced first** (Skaadi's spell through the real `applySpell`, a poison by `startPoison`, a disease by
`inflictDisease`, a drain; the turn by `createVampirismCurse`, the deploy's own constructor, and the werewolf's by its
bite walked to the turn): after the turn the Regenerate entry carried `ended` - and a timed entry ticks on whatever it
says (`effects.js` tickActiveEffects), so it healed, but `liveBundles` (`mysticism.js`) skips it: no icon on the HUD,
none on the party's cards, nothing to dispel; and `findInc` asks no `ended`, so every recast merged into the hidden
entry and the icon never came back while the spell was kept up. The poison ran on ("ended above by their own law" -
nothing ended it), and no pool was filled. The healing itself was never stopped by the turn: what zeroed GOD MODE's is
AREA-SELF's, below.

**Why.** `lycanthropy.js` endOldLifeEffects stood for PlayerEffectManager.CureAll, read as "every effect of the old life
ends". CureAll (EntityEffectManager.cs:1598-1608) fills health, fatigue and magicka, removes the poison bundles, cures
the diseases and heals attribute and skill damage - the buffs are left (VampirismEffect.Start :81, "cure everything on
player").

**The fix** (`systems/lycanthropy.js`): CureAll whole, through the port's own homes - `fillVitalSigns` (statMods.js),
`cureAllPoisons` and `cureAllDiseases` (effects.js), `cureAllAttributes` (guildServiceFlow.js; no effect of the port
holds a skill down, so CureAllSkills has nothing to cure). The buffs running at the turn run on, shown. One home for
both curses, as before. `test/fb1001_regen.test.js` (CURE-ALL 2).

## AREA-SELF: a caster's own blast of gifts lands on them as a self-cast (3)

**Reproduced first** (GOD MODE through the real cast engine, `createPlayerMagic`, test/roadh_missiles's rig, a Breton
caught two metres from the burst): the Regenerate landed with `saveScaled` and the Fortify at whatever its landing's
save left - its caster rolled Resist Magic against their own gift, every round of the Regenerate (`effects.js`
effectMagnitude). The regeneration lane's engine run: three bursts by a wall two metres off gave the Fortify 200, 0 and
950 of 1001; burst thirty metres off, or into open air until the missile's eight seconds ran out, the spell landed on
its caster nothing at all, and said nothing.

**Why.** DFU save-scales every bundle that is not CasterOnly (EntityEffect.cs:805-806) and means it for the caster too
("Allow to resist 'other target' spells, e.g. when caught inside own AOE radius", EntityEffectManager.cs:1254-1255).
The port already ruled the other way for a gift: AUDIT ALLY-CAST C1 - a party mate's buff lands as a self-cast,
because in DFU only a foe ever receives an external bundle - so a mate's blast healed its party whole and its own
caster by two rounds in three.

**The fix** (`scenes/hostMagic.js` explodeAt): where the player's own blast catches the player and every effect in it is
a gift (`allyCastable`, the ally law's one test), it lands as a self-cast. A blast with harm in it, and a foe's, are
saved against as before. A departure (Port-Ledger). The reach was DFU's - an Area at Range spell's caster in its blast
only where it bursts within 4.35 m (`spellcast.js` EXPLOSION_RADIUS and the player's 0.35 body), an Area Around
Caster's never - and Mac, asked, took it away for a spell of gifts: AREA-CASTER, below, lands it on its caster at the
cast, so the burst passes them by. `test/fb1001_regen.test.js` (AREA-SELF with AREA-CASTER 3).

## RARITY-WEAR: no slot, no tier (4)

**Reproduced first** (the real `rollSpoils` and `rollRaidSpoils` over two thousand seeds, the real `equipItem`): the
Gate's spoils and a town's thanks mint their base in `gateSpoils.js` spoilsBase, a jewel a third of the time drawn over
`ITEM_GROUPS.Jewellery` - Amulet, Bracer, Ring, Bracelet, Mark, Torc, Cloth Amulet and Wand. The Wand (140) has no slot
(GetJewelleryEquipSlot's None; `equipRules.js` has no row, `test/equipmechanics.test.js` pins "wands resolve nowhere"),
and the ladder graded it all the same: its affixes and a Held enchantment read worn pieces alone (`lootRarity.js`
wornItems, `enchantments.js` equippedEnchantedItems), so a King's Mark on one was a different picture, a WEAR that did
nothing, and a USE that said "Nothing happens." The search lane's run: 82 of 706 King's Marks on a Wand.

**The fix.** `systems/equip.js` wearableItem - GetEquipSlot asked of an empty table, the one law; `lootRarity.js`
rarityEligible refuses a piece no slot takes; the spoils' base is made again when it is one (a seed that drew no wand
draws what it drew before); and a save's rolled wands load as the Amulet (`repairRarityBases`, beside DISC29-B's repair
in `save.js`, every list the save carries): the same weight and condition, a Legendary keeping its record's name, a
Magic or Rare one named for its new base, the price moved by the two bases. DFU's own wands (MAGIC.DEF's, Use a cast)
and a plain one stay wands. `test/fb1001_wand.test.js` (3).

## CLOAK-DRAPE: the drape beside the hood (5)

**Reproduced first** (the Enhanced Plus pack mounted on the fake document, a casual cloak worn through `equipItem`):
the card offered Take off, Raise hood, Add to hotbar, Lock, Info, Post in chat - the screenshot's row; Raise hood moves
to the same drape's other drawing (`toggleHood`, `variant ^ 1`), so of the casual cloak's six drawings - three drapes,
0/1, 2/3 and 4/5, each one hood down and one hood up - two drapes were out of reach while worn. Taken off, its Use from
the pack still stepped them; the classic window's Use and middle click were never changed.

**The fix** (`systems/useItem.js` nextDrape, drapeCount; `ui/enhancedInventory.js`): a worn hooded garment of more than
one drape - the casual cloak - carries Change drape beside the hood: the next drape, the hood as it was, said ("You
rearrange your cloak."), the doll redrawn and the card kept up, as the hood's press is. A formal cloak and plain robes
hang one way and get none; an enchanted casual cloak keeps its Use beside it. `test/fb1001_drape.test.js` (2).

## TRADE-KNOWN: the report did not reproduce (6)

**Tried** (the real trade manager over the real trade pack and `validTradeData`, hand to hand; and the real account
Worker over node:sqlite with `createRealmSession` and `realmTradeEscrow`, test/realm4's two tabs): DFU's own magic
Broadsword and a ladder's Rare, both minted unknown, handed A to B; B knows them by the Identify spell's law; B hands
them back - A holds both known, reads their known names, and the realm's record keeps them known. What a piece knows is
its record's `isIdentified`; the wire's clamp keeps it as the bool it is (`loot.js` validLootItem, `itemFields.js`), the
relay reads no item, and a realm trade moves the giver's own checkpointed record, which must be the offer in every field
but the count, the price and the receiver's marks (`realmTradeLaw.js` recordIsOffered). Nothing keys a piece by an id
that could put an older copy back. So the file is a guard pin.

**Open, unconfirmed.** Knowing a piece is no realm act: it rides the holder's next checkpoint (the two-minute one, a
page hidden, a trade's hold - which checkpoints first). A tab that joins again before one lands plays the record the
first trade wrote, the piece unknown in it. For the reporter: did the piece show its known name in the trade window's
offer before the trade back, and is it known in the holder's pack after a relog?

## AREA-CASTER: an area spell of gifts lands on its caster (3; asked)

**Asked** after the first push - Area Around Caster never reaches its caster (DFU), and Area at Range only within about
4 m of its burst: should an area spell made only of buffs always land on its caster too? Mac: *"Include the caster"*.

**Built** (`scenes/hostMagic.js` giveAreaToCaster): an area spell every effect of which is a gift (`allyCastable`, the
ally law's one test) lands on its caster at the cast, as a self-cast (never saved against - AREA-SELF's law): an Area
Around Caster's beside the foes, mates, duel opponent and boss its sweep reaches; an Area at Range's as its missile
leaves, wherever it bursts and if it bursts nowhere. Once: the burst that catches its caster passes them by (AREA-SELF's
arm in explodeAt now lands nothing on them), or a second Regenerate's rounds would stack onto the first. The landing
says a Heal's "You are healed N points.", as a Caster Only cast does. A spell with harm in it is DFU's still: its caster
only where its blast reaches them, and saved against; a foe's blast of gifts is saved against. In the ledger with
AREA-SELF. `test/fb1001_regen.test.js` (AREA-CASTER 3).

## CLIMB-NODE: the free climb holds at a node (1; asked)

**Found** walking E to the ore: CLIMB2's free climb starts after Forward is held against any face for its start time
(0.6 s, 0.3 s at Climbing 100; online always - `player/motor.js` _freeStart, `player/parkour.js`), and a vein stands at
its rock's foot, so a player who walked into the rock to reach the ore climbed it and lost the target and the act.
**Asked**: Mac, *"Hold it at nodes"*.

**Built** (`player/motor.js` _freeStart, `scenes/shared.js` parkourDeps' `hold`, `scenes/world.js`): while a
profession's node is under the look - its prompt up (`gatherHost.target`) - or an act plays, the walk-in start is held,
and its count begins again when it lets go (pressed into the rock most of the start time, a node, then none: a whole
start time again, never the rest of it). A jump's grab and a mantle are a jump's and are not held; the hang, the
shimmy and climbing anywhere else are CLIMB2's. THE FOUR HOSTS: the streaming world's one motor (its dungeon and its
buildings drive the same `player`) is handed the hold; the fixed city (`scenes/exterior.js`) and the standalone
dungeon (`scenes/dungeon.js`) stand no nodes and hand none; the interiors (`scenes/worldModes.js`) and the dungeon
mode (`scenes/dungeonContext.js`) are the world host's motor. `test/fb1001_climbnode.test.js` (4).

## Found on the way, not changed

1. **Climbing at a vein** - asked, and built: CLIMB-NODE, below.
2. **Starting an act by touch or pad.** The touch corner carries no Interact, nor the pad's defaults; a tap and the
   pad's A are ActivateCenterObject, which AUDIT 29 C2/H3 kept off the nodes. With ACT-TOUCH an act struck by Attack
   (a vein, a tree, the Basket's glints, the net's tug) can be played by touch; the start is still E or the tool's
   hotbar Use (TOOL-USE). CORRECTED by the audit below: the acts HELD on E - the steady hand, the knife's trace, the
   net's haul - are not (the Sickle's Use holds the steady hand; nothing holds the other two), and a common herb, which
   no tool picks, cannot be started at all - asked of Mac (TOUCH-HOLD, below).
3. **VEIN-NEED's line** is replaced when anything else is under the ray (a far corpse, a door); underground it speaks
   only when nothing at all is hit.
4. **A dungeon vein's foe.** A vein stands off a foe marker, and the enemies-near check reaches 12 m: a live foe at its
   marker refuses the start, said ("You cannot mine with enemies nearby!").
5. **A partial save is silent.** "Save versus spell made." is said for a full save and a failed chance; a magnitude a
   save zeroed says nothing (DFU says it, EntityEffect.cs:810) - a harmful own blast's, a foe's.
6. **Area Around Caster never reached its caster** (DFU's ignoreCaster, DaggerfallMissile.cs:282) - asked, and built for
   a spell of gifts: AREA-CASTER, below.
7. **The Jewellery Legendaries name no templates**: a King's Mark lands on any wearable jewel, and Archmage's Loop -
   "one of the rings" - on any.
8. **Deep Waters' FillRandomItem** mints plain wands; none reaches the ladder today, and `rarityEligible` refuses one
   that ever does.

## ANY-HOUR: the professions keep no hours (Mac's word)

**Mac, 2026-10-01**: *"Remove the time limit for professions. Should be available at any time"*.

**What it was**: the acts borrowed Foraging's checks (FORAGE0 14.3), daylight 07:00-17:59 among them - from 18:00 to
06:59 a vein, a boulder, a patch (the Sickle's or the Basket's), a tree and the net said "You need daylight to mine
effectively!" and the like - and the service refused any surface harvest whose act ended in those hours (`prof-night`,
on the shared clock from the act's end). Dungeon veins and Hunting never kept hours; the stations never closed (online
the shops stand open - OL5's shift). An act begun at 17:59 and ended at 18:00 was played, wore its tool, and was refused
(lanes 4 and 5 below both found that edge; it goes with the rule).

**Built**: a profession's act never asks the daylight (`systems/foragingInstall.js` foragingActRefusal skips it - one
home for the five acts' starts); the net's prompt names no hour (`scenes/fishHost.js` NET_WHERE); the words say none
(the Fishing-Net's line, the Professions page's Fishing how-to: "at any hour"); the service answers a harvest at any hour
(`server-account/src/professions.js` harvestNode - the check, its hour helper and `prof-night`'s status gone; the client
keeps the word's text for a service not yet redeployed). Foraging's own Use - offline and a guest's lane, the mod's 1:1 -
keeps the mod's day (`test/forage2_tools.test.js` pins its refusal). The first and last daylight hours still halve the
net's wait: a bonus, not a gate. `test/fb1001_anyhour.test.js` (3); `tools/mutants/fb1001_anyhour.json` (5) - all dead.
PIN MOVED, each by content: `prof1_service` (02:00 harvests), `prof2_service` (a surface vein by night), `prof4_service`
(a tree by night), `prof8_service` (a haul at 23:00), `prof8_client` (the net cast at 21:00; no hour has words),
`fb0930b_toolsaid` (the net's line). MUTANTS RETIRED (the law they guarded is gone): `prof1.json` PROF1-31,
`prof2.json` PROF2-20, `prof7.json` PROF7-svc-body-by-day, `prof8.json` PROF8-svc-night-fishing.

## The audit: part four, and the professions sound (Mac: "let's do a comprehensive audit on this and also ensure the other professions are sound")

Five adversarial lanes, each in its own worktree on e01969fd, reproducing every claim on the real modules (the real
Worker over node:sqlite, the real books and hosts, the real pad and touch layers) before it was a finding: (1) part
four's two commits line by line; (2) Herbalism and the gathering shell; (3) Logging, Carpentry, Smithing and the
stations; (4) Hunting, Outfitting and Fishing; (5) the client's laws against the service's. Beside them a re-read of
part four's own fixes found three faults first (NODE-SHUT, STICK-TAP, CLICK-LIFT), each red on e01969fd before the lanes
reported, and two lanes found each of them again. No lane changed the tree; every fix below was pinned red on the code
before it and mutation-checked. Mouse and keyboard play every profession end to end; the faults were at the edges - the
ground a client stands on, the counters, the pad, the finger, and part four's own new seams.

| Tag | Lane | What it was | Done |
|---|---|---|---|
| NODE-SHUT | own; 1, 2, 3 | CLIMB-NODE's hold reads the gathering host's target, and a shut frame (a sign-out, another account, the switch) left it: the free climb's walk-in start stayed held everywhere until the professions opened again | the shut frame clears the target (`scenes/gatherHost.js`) |
| STICK-TAP | own; 1 | ACT-TOUCH struck on any tap mid-act - TS1's lock-only tap (a thumb re-placed on the move stick) and a tap in the docked bar's strip among them: an unchosen strike off the glint, a Basket's glint spent, a tug taken | the strike asked after the view's own test and never on the stick's tap (`scenes/world.js` inputHooks.tap) |
| CLICK-LIFT | own; 1, 2, 4 | ACT-CLICK made the click a strike on its PRESS; the activation fires on the RELEASE, and the ladders asked only whether an act still played - the click that finished a vein, a tree or the Basket lifted onto the door, the chest, the body or the lever under the look, street and dungeon | the click an act took is the act's to its release (`gatherHost.js` clickTaken; the street's ladder; `worldModes.js` tryExitDungeon) |
| CURE-ENDS | 1 | CURE-ALL cures a drain through the stat reset, which zeroed it and left it; a foe's drain is bundled, so the HUD kept a debuff that did nothing - blinking, never ending, on the party cards and the dispel list, through saves (the guild's stat reset did the same) | a cured drain ends (`systems/guildServiceFlow.js` cureAllAttributes), and one a save kept at nothing ends at the load door (`systems/save.js`) - never in the tick, which names no kind (CURSE-PERSIST1's law) |
| CURE-FILL | 1 | the turn filled the pools before the cures: a drained Endurance, Strength or Intelligence left fatigue and magicka short of the full the record promised | the pools are filled last (`systems/lycanthropy.js` endOldLifeEffects) |
| GROUND-STALE | 5; 2, 3 | a pixel's (or dungeon's) witnessed state was read once a UTC day, the service's at every harvest: the third witness's own harvest confirmed the ground and its client went on standing the least - "Mine Iron" offered a novice, played, worn, refused `prof-rank`, every try till midnight (a quarter of a Mountain's veins, a Woodlands Oak a Cherry, every dungeon vein) | a harvest's answer, or a refusal, marks its ground stale: it stands as it did, the next ask reads it, a moved state stands its nodes again (`net/profBook.js` staleGround, pixelWanted, dungeonWanted; `gatherHost.js`) |
| GROUND-MIDNIGHT | 5 | at 00:00 UTC the host stood every pixel again before the day's states were read, and the read stood again only what CHANGED since yesterday: ground confirmed both days stood unconfirmed all day (its signature veins gone), and so did the dungeon underfoot | yesterday's word is no word (`net/profBook.js` askPixels, askDungeon) |
| STORES-ROOM | 5; 2, 3 | the kinds asked `held` (own and bought - what a station may spend) for the Stores' room, the service every origin: with gold-bought units the prompt said ready, the act wore the tool, `stores-full` | the room as the service counts it (`net/professionLaw.js` storesFullIn - the five kinds) |
| REFUSALS-LEARNED | 5 | nothing learned from `prof-account-cap`, `prof-deep-cap`, `prof-cap` or `stores-full`: every act after was offered ready, played and refused | the character's day and the Stores read the state again; the account's craft and its unvouched dungeon veins close until the UTC day turns, and the host says so (`net/profBook.js` closed; `gatherHost.js` planFor) |
| RATE-KEPT | 5 | `prof-rate` ("Try again later") let the harvest go after the act | kept and asked again inside its ten minutes (`net/profBook.js` send) |
| NODE-SPAN | 3; 2 | a node is found up its upright, base to aim point; a tree's is 1.2 m and its glow 3.4 m - a level look from two metres passed over it, a look up never found it, the saddle never; a patch glowed 1.3 m and was found 0.3 m up its centre | the upright runs to the glow's top where that stands higher (`gatherHost.js` findTarget) |
| NODE-CLEAR | 2; 3 | VEIN-CLEAR kept veins out of the rock pieces; a patch or a tree could stand inside one, glowing, unreachable | a patch inside a piece stands nowhere, a tree claims the nearest flat outside every one (`world/terrainNature.js` insideRocks, one home; `herbHost.js`, `treeHost.js`) |
| STEADY-SAID | 2 | the steady hand ends when E is let go, and its meter said "hold still" and no key: a tap of E ended it, nothing taken | the meter names the key E's start holds (the Sickle's Use holds it itself, and names none) (`herbHost.js`; `ui/profHud.js`) |
| SEASONAL-EYE | 2 | Herbalism 100's Seasonal Eye chosen mid-session stood nothing again until the next state read or the day's turn - a winter day's patches named herbs the service did not roll | a change of it stands the pixels again (`gatherHost.js` tick) |
| PAD-PULSE | 1; 3, 4 | the Plus pad's gesture swing re-draws its stroke every 0.4 s while RT is held, and each was a press: RT held felled a tree, caught every tug, mined a vein by itself - against ACT-TOUCH's own "a held press strikes once" | a stroke after the first is the hold's, marked, and no act's strike (`ui/gamepadInput.js`; `world.js`; `gatherHost.js` strike) |
| TOUCH-RETAP | 1 | the Attack button's lift waits two frames (TOUCH-BUTTONS A1); a second tap inside them cancelled the lift, so the hook heard held, held - no second press to an act | a press lifts the one before it first (`ui/touch.js`) |
| CHARCOAL-BUY | 3 | "Steel wants Charcoal ... and the smith sells it" - but the smith's stock was bought only on an anvil recipe short of an input, and none takes Charcoal: no counter stood anywhere, and a smith who felled no tree smelted no Steel | the Forge offers it at a smith's forge (`ui/profPages.js` drawForge) |
| COUNTER-GATES | 3 | the anvil's and the workbench's counters took none of AUDIT 32 P6's gates (the loom's): offered with Marks shut or too few held, refused after the press | one counter's buy for all four (`ui/profPages.js` counterBuy) |
| PAD-CLASSIC | 3 | the Professions pages are DOM on the classic skin too, and the pad's cursor clicked the DOM only under Plus: the Forge, the Anvil, Withdraw unpressable on Classic with a pad | the pad's click reaches the page on every skin, as a mouse's does (`ui/gamepadInput.js` pointerAt) |
| NAVAL-E | 4 | at sea the net's cast stands in the look and the node had E first: the readout said "E: board her" and E cast the net (with a foe near, it said "You cannot fish with enemies nearby!") | the street asks the sea first (`scenes/navalHost.js` takesActivate; `world.js`) |

Pins: `test/fb1001_audit.test.js` (10), `fb1001_ground.test.js` (9), `fb1001_nodes.test.js` (5),
`fb1001_stations.test.js` (3); mutants `tools/mutants/fb1001_audit.json` (16), `fb1001_ground.json` (21),
`fb1001_nodes.json` (9), `fb1001_stations.json` (4) - all dead. PIN MOVED, each by content: `fb1001_mining` (the tap's
strike its third line, after the view's test; the attack hook hears a held stroke's repeat), `fb1001_regen` (the cured
drain ended), `audit32_client` H5, `audit29_host`, `disc7`, `prof1_client` (the ladders and the node's press:
the act's click, the sea's E), `auditnav2_helm` F31 (the gate's lifted segment asks the act's click), `touchbuttons` A1
(a re-press lifts the one before), `a8_pointer`, `audit62_touch` (two), `roada_activate_gate` and `deckfield` (the
street's and the modal frame's press named before the gate, the act's click asked with it), `audit39_uicore` and
`touchinput` (world.js's attack hook hears a held stroke's repeat). Mutant records re-aimed by content, each dead:
`audit32.json` H5 (two),
`auditdisc7.json` A1, `fb1001_mining.json` ACT-TOUCH-the-tap-not-a-strike, `fb1001_regen.json` (the four CURE-ALL
records, the fill now last), and those the new code moved: `audit32.json` P6 (two - the counters' one buy),
`fb0930b_toolsaid.json` TOOL-USE-the-use-plans-as-e, `fb1001_mining.json` (ACT-TOUCH's edge and hook, NODE-AIM's three
- the span to the glow), `prof3.json` PROF3-page-stock-at-home, `prof4.json` (the tree flat, the furnisher), `prof7.json`
the Weavers' door, `touch_buttons.json` A1's window gate; `auditnav2_helm.json` F31 aims at `activate`'s guard alone
(`takesActivate` words its own). Part four's one stray space (`lootRarity.js` affixesWorth) is put back (lane 1).

**Asked** (design, Mac's to call - and called: the next section):

1. **TOUCH-HOLD** (lanes 2, 3, 4). No Interact exists on a phone or in the pad's shipped layouts, and E is the
   professions' start and their hold. On those devices a common herb (no tool picks it) cannot be started, Hunting
   cannot be started at all (the Skinning Knife has no Use) nor its trace played, and the net's haul cannot hold its
   band (299 of 300 seeded hauls slipped to a plain net). The Sickle's hotbar Use holds the steady hand; nothing holds
   the trace or the haul.
2. **HERB-XP** (lane 2). Herbs stop at tier 3, and a node more than two tiers under the rank's top is worth a quarter:
   past rank 70 every herb gives a quarter of its XP (3, 11 and 16), and 70 to 100 takes 107 full days on confirmed
   ground. Fishing's XP follows its rank (Mac's earlier call); Herbalism is the one gathering track with the wall.

**Found, not changed**:

1. **The net's cast is a target only for a look between about 23 degrees down and level** (lane 4): it stands 3 m
   ahead and 0.6 m under the eye, inside the 12-degree cone; looking down at the water from a pier, E is silent and the
   net's Use says to stand in water.
2. **A trophy answered after a character switch is lost** (lane 4): the answer is the other character's, let go before
   the trophy step (AUDIT 32 B5's law), and the kept harvest with it.
3. **A touch tap strikes when the finger lifts**, not when it lands (lane 3) - a tap is told from a swipe only at its
   end; a notch or a glint timed to the landing is struck 60-100 ms late.
4. **Nothing in a smithy, an armorer's or a furniture store says its station is on the Stores page** (lane 3).
5. **The turn leaves a foe's harmful effects running** (lane 1) - paralysis among them, as DFU's CureAll does; the old
   turn ended them (and hid the damage it went on dealing). **An item's free-readied area spell of gifts lands on its
   caster** (AREA-CASTER) while party mates are passed by, as for every free ready (lane 1).
6. Suspected, not shown: a street body with an empty pack offered its search (lane 4 L5; DFU's own message answers it);
   the knife's sea check not skipped underground (L6); a client clock running fast refused `prof-late` (lane 5 L4); the
   `bad-qty` words name the withdrawal's 200 where a smelt and a stock stop at 100 - unreachable through the pages
   (lane 5 L5).

## TOUCH-HOLD and HERB-XP: Mac's calls

Asked as the audit closed, each with its options: TOUCH-HOLD - Mac: **"Interact button + knife Use"**; HERB-XP - Mac:
**"XP follows your rank"**. Both built.

**TOUCH-HOLD.** A phone and a pad could not play a common herb, Hunting or the net's haul: E is the professions' start
and their hold, and neither had an E.

- **The touch corner.** Its third slot - empty by default - is Interact (`ui/touchButtons.js`: glyph E, a HOLD slot,
  so the Interact action's live key is down while the finger is; `systems/uiPrefs.js`). A choice on the Touch card like
  any other. The default corner runs 16..344 px (the mode cycle and F a slot further in), inside the widest corner the
  HUD keeps clear of (`TOUCH_CORNER_MAX`, 392).
- **The pad, classic layer.** B is Interact in the world (`systems/inputActions.js` `DEFAULT_SECONDARY_BINDINGS` - a
  PAD1 row, filled into an old file at the next load). B did nothing in the world: DFU's Back answers only while a
  window is up, and a window's press never reaches the world's edge ring (`ui/input.js`); in a window it is Back still.
- **The pad, Enhanced Plus.** Every button held a row, so LT is Interact (`ui/plusPad.js`, layout 2): a trigger holds
  while the right thumb draws the knife's line. Recast, which LT held, is the d-pad's right held (`PLUS_DPAD_DEFAULTS`
  - so right's tap, Rest, fires on its release, as up's, down's and left's do). A store on layout 1 moves once, taking
  back layout 1's Recast on LT where it still stands (`PLUS_PAD_RETIRED`); a row the player set themselves stands. The
  Controller bindings window has an Interact row (`ui/plusPadBinds.js`).
- **The prompts.** With a pad in hand the professions' prompts, meters and tool lines name its button - "[LT] Pick Red
  Rose", "hold B and keep still" - as the sea's readout names its own (AUDIT NAV1); else the key (`scenes/world.js`
  `actKeyWord`). They said "[E]" to a hand holding no keyboard.
- **The Skinning Knife's Use.** From the hotbar or a quick slot at a body it is E there (TOOL-USE - `scenes/huntHost.js`
  `tools`, `systems/foragingInstall.js` the knife's use handler and its line), and it HOLDS the knife, as the Sickle's
  Use holds the steady hand: the line is drawn by the look alone - a swipe, the right stick, the mouse - with no key held
  (`heldByUse`); the meter says "aim the knife at the first point", never a key (`ui/profHud.js` `byUse`). It skins
  whatever the choice key picked, the pick unmoved; away from a body it says where Hunting is done; offline, or with the
  professions shut, it has no Use (the knife is the professions' alone). The Hunting card and the empty Stores say so.

So on a phone: a common herb is a press of the E button; an uncommon or rare herb the Sickle's Use (or E held); Hunting
the knife's Use, the line drawn with a swipe; the net's haul E held to raise the band; the sea's E the same button. On a
pad the same through B (classic) or LT (Plus).

**HERB-XP.** A herb is picked at the highest tier the rank opens, as a haul is worked (`src/net/professionLaw.js`
`herbXpTier`, the service's harvest): every herb a rank may pick is worth 15 x the rank's tier, x1.5 picked clean, never a
quarter. At rank 70 a common herb is 90 and an uncommon one picked clean 135 (they were 3 and 11); 70 to 100 is some nine
days of sixty plain herbs, where it was 107 on confirmed ground. Below rank 10 nothing changes; from it a common herb is
worth the rank's tier too (30 at rank 10, where it was 15) - Fishing's law exactly. The herb's own tier still opens it
and is the harvest's row. **The Basket's food keeps its tier** (not asked: at rank 70 a full search is 5) - it is
Foraging's food search, not a herb.

**The service's version.** HERB-XP is the account service's law, and so was ANY-HOUR - which shipped in part four's
first audit commit without moving `ACCOUNT_VERSION` (its law says every change to the Worker's moves it, or a deploy
that did not happen looks like one that did). Both ride **acct46** (`server-account/src/service.js`, `wrangler.toml` -
acct45 on this branch, renumbered past main's PATREON-LINK at the merge); no migration, no route changed.

Pins: `test/fb1001_touchhold.test.js` (7), `test/fb1001_herbxp.test.js` (3); mutants
`tools/mutants/fb1001_touchhold.json` (21), `fb1001_herbxp.json` (6) - all dead. PIN MOVED, each by content: `prof1_service`
(a common herb at rank 10: 30), `pad1` PAD1-C (B's UI action is Back, a window's alone - A, X and Y keep DFU's clicks),
`padplus1` PADPLUS3 (right's tap on its release), `touchbuttons` (the law; the default corner), `renown4b` (the corner
16..344), `touchinput` TI1 (the defaults), `fb0930b_toolsaid` (the knife's line among the tools'; the empty Stores' words),
`prof7_client` (the key named unless the knife's Use holds it), `audit0928_input` (Controls.md's Interact row - its Pad
cell, from the registry), and the nine account-version pins (acct46, past PATREON-LINK's acct45 at the merge). Mutant record re-aimed by content, dead:
`fb0930b_toolsaid.json` TOOL-SAID-the-world-never-says-the-professions-are-open. `actKeyWord`'s pad line is worded its
own so `navaudit_presentation.json` NAVP-pad-keys-named-as-keys names one site still (MUT-AIM).

## ROCK-FOOT and SETTLE-SAID: the boulders (Mac: "People are trying to mine boulders on the outside, but it's not letting people mine"; "it gives a notification but you cant mine")

**Reproduced first** (the real `standMineNodes` over every shipped `WOD_Rocks_*` and `WOD_Mountain_*` layout's own
transforms, a cube standing in for each model at sizes and origins that bracket a real rock's - the meshes are ARENA2's,
not in CI): under one boulder in ten of the law's stood, and one in sixteen to thirty at a rock that shows. A piece was
carried as its WHOLE mesh's box (`scenes/world.js` pixelRocks) - the fields are a few models scaled by tens to hundreds,
turned and sunk, so a box ran 90 m to over a kilometre where the rock showed a few metres. A boulder's one foot stood on
that box's edge facing its point, and AUDIT 29 C11 stood nothing when the foot fell inside a neighbour's box - most of
the time in a field whose pieces overlap - with the piece spent and no other piece or side asked; and the veins had
claimed the field's clear pieces first. Where a boulder stood, its stones lay out on open ground, so a look at the rock,
E or the Pick-Axe found no node - the Use said "Mining is done at an ore vein or a boulder ... walk up to one until the
prompt shows". And on a settlement's ground (a town, a farm, a temple, a tavern, a wealthy home - its footprint and a
city block round it) the prompt of a vein, a boulder, a patch or a tree said it was ready, and E or the tool's Use said
"You cannot mine in a settlement!" (the act's own check, FORAGE0 14.3), every time; Hunting's and Fishing's plans ask it.

**The fix.** ROCK-FOOT: a piece is carried as it stands out of the ground (`world/terrainNature.js` rockFootprint - its
mesh above the terrain, each vertex above it and each edge where it crosses it; none for a piece wholly under it); a
node takes the nearest piece with a foot clear of every piece, the side facing its point first, then its others nearest
that way (`scenes/mineHost.js` claim, footTargets); the boulders claim before the veins (a vein has the stone beside the
field to fall back on, a boulder has nothing). Over the same layouts: three boulders in four stand, every one at a rock
that shows, none inside a piece; the veins stand as often or more, and at a rock twice as often. The herbs' and trees'
NODE-CLEAR read the same, truer, pieces. SETTLE-SAID: the ground's nodes ask the settlement's check in the plan
(`net/professionLaw.js` GROUND_WHERE, each kind's `where`, `scenes/gatherHost.js` planFor) - the prompt says "not in a
settlement", E goes on to the door or says it, the tool's Use says it; a dungeon's vein asks none. Node places are the
client's alone (the service checks a node's key and slot, never where it stands): no service change.

Pins: `test/fb1001_rockfoot.test.js` (4), `test/fb1001_settlesaid.test.js` (2); `tools/mutants/fb1001_boulders.json`
(12, all dead). PIN MOVED, each by content: `prof2_client` (the rock pieces' line; PROF2 stand and DONE WHEN with the
boulders' own pieces, claimed first), `fb1001_mining` VEIN-CLEAR (the field's one piece the boulder's). Mutant records
re-aimed by content, dead: `audit29.json` AUDIT29-C11-a-foot-inside-a-neighbour, `prof2.json` PROF2-31, PROF2-32.
FOUND, not changed: a boulder on a settlement's ground still stands (glowing, on the compass) where it can never be
worked - its prompt now says why; standing none there needs the location's rect and type on the pixel. A pixel's
boulders are 1 a day in the woods, 2 in the mountain woods, 3 in the mountains and deserts, none in swamps and
rainforest (PROF0 6) - design, unchanged.

## The rest of the life skills' audit (Mac: "Fix the rest")

**BOULDERS and ROCK-SHARE.** With ROCK-FOOT a field's boulders stood, but a field holds few pieces with an open side,
and one node a piece: on the shipped layouts (the stand-in meshes) raising the day's boulders alone stood two to two and
a half a field a day whatever was asked, and took the veins' rocks - the veins at a rock fell from about 57% to 20% in the
woods, 2 to 9% in the mountains. A piece now holds a node on each of its sides, every node at the field NODE_SPACING_M
(6 m) from the next (`scenes/mineHost.js` claim), and the day's boulders are raised (`src/net/nodeLaw.js` NODE_COUNTS -
the service's slot bound, so **acct47**): the Woodlands, the Haunted Woodlands and the Subtropical 3 (were 1), the
Mountain Woods 4 (2), the Mountain and both Deserts 5 (3). The Swamp and the Rainforest keep none: their Court writs would
start asking Rough Stone (PROF2's pin, "no boulders in a Swamp"). Measured over the same layouts: 93 to 98% of the day's
boulders stand, and 93 to 98% of the veins at a rock. Deploy the account service (acct47) with or before the client: an
older service refuses a boulder past its old count (`bad-node`).

**SETTLE-STAND.** SETTLE-SAID made a ground node on a settlement's ground say so; it still stood there, glowing and on the
compass, where no act could work it. The streaming world hands the gathering host the acts' own test (`settled`: the
place's pixel's location, `isPlayerInTown` with its rect widened by a city block - Foraging's 'town', as `_musicLoc` and
`_musicInLocationRect` answer it for the player), and the host stands no vein, boulder, herb patch or tree there
(`scenes/gatherHost.js` stand: a kind with a `where`). SETTLE-SAID stays for the band's edge, where the player stands and
the node does not.

**CAST-LOOK.** Fishing's cast stood 0.6 m under the eye 3 m ahead whatever the look - inside the host's 12-degree cone only
from some 23 degrees down to under one up (the audit drove the real host: a target at 0.5 degrees, none at 1). Looking out
over the water there was no prompt, E went on to the door behind, and the net's Use told an angler in the water to
"stand in it". The cast now stands where the look crosses 3 m ahead (`scenes/fishHost.js` castAt, held within
CAST_RISE_M), and it yields: of the nodes in the cone, a node of the ground (an herb on the bank) is the target before it
(`yields`, `scenes/gatherHost.js` findTarget).

Pins: `test/fb1001_lifeskills.test.js` (4), `test/fb1001_rockfoot.test.js` ROCK-SHARE; `tools/mutants/fb1001_boulders.json`
24, all dead. PIN MOVED, each by content: `prof1_law` (the counts), `prof2_law` and `prof2_service` (the Mountain's five; a
sixth slot `bad-node`), `prof2_client` PROF2 stand (the nodes at a field 6 m apart), `fb1001_mining` VEIN-CLEAR (a stone a
metre across over each vein's own tile, the boulders' - the veins fall back), `prof8_client` (the cast at the eye's
height for a level look), and the nine account-version pins (acct47). Mutant records re-aimed by content, dead:
`audit29.json` AUDIT29-C11 (its pins with the rock-foot suite), `prof2.json` PROF2-32 (the spacing at nothing).
FOUND, not changed (the audit's "plausible"): a specialisation that changes what stands, taken mid-session, waits for
the next state read (SEASONAL-EYE handles Herbalism 100's own); fishing from a deck may find the hull in the cast's ray.

## AUDIT of the life skills' fixes (Mac: "audit this")

**CAST-E (found, fixed).** The world's E reaches the gathering host before the door, the crew, the chest or the foe under
the look (`scenes/world.js` nodeTook, PROF1's order), and CAST-LOOK made the cast the target at almost any look in the
net's water - a sea's deck and a pier among it (the Ocean's climate is the net's water). With a net in the pack, E at a
door or a crewman looked at level or up cast the net instead; a level look did so before CAST-LOOK too (the old point's
cone held 0 degrees), so NAVAL-E guarded only boarding. Now the cast passes the press on as a node with a need does
(VEIN-NEED's hand-back): `press` is false, the ladder tries what is under the look, and the host's `sayNeed` - called at
the ladder's foot when nothing opened - casts it. A press the ladder took is never cast by a later hand-back
(CAST_HANDBACK_MS). The net's Use casts at once, as before. Pins: `test/fb1001_lifeskills.test.js` CAST-LOOK and CAST-E;
`fb0930b_fishtired`'s angler presses as the world does (the press, then the hand-back) - PIN MOVED; mutants
`fb1001_boulders.json` CAST-E 3, dead; `fb0929h_veinneed.json` VEIN-NEED-said-twice re-aimed by content, dead.

MERGE of main's PROF-MENU (a node's acts the loot plaque's list): CAST-E rides the menu - `hoverHit` yields the cast to
the ray's winner in reach (the door's, the crew's or a chest's plaque kept), E unlit passes on as before, and a cast the
plaque lit over nothing is cast by E or the click at once; SETTLE-SAID's ground check moved into `learned`, so every
row of the list says it. Pin: `fb1001_lifeskills` CAST-E under PROF-MENU; CAST-E 5, dead.

**Checked and sound.** The client keeps no service-version gate (acct47 is the deploy marker alone); the raised counts
reach only the boulder law, the service's slot bound and two "any boulders" tests (`climateHolds`, the writs' Rough
Stone) whose answers are unchanged; a slot's law point is its own hash, so slot 0 stands where it stood. The settlement
test reads the location index filled at boot, before any pixel builds. `rockFootprint` reads the build's own `samples`
(the entry's), costs some 0.15 ms a piece for a thousand-vertex mesh, warm, and the build yields between pieces.

**FOOT-IN (found by the audit's independent pass, fixed).** Nothing kept a rock's foot on its own pixel: a field's pieces
reach past the edge, and a vein or a boulder stood on the next pixel's ground - lit and on the compass (the marks walk
256 m of pixels) but never the target, since the host asks only the pixels whose ground is in reach (`nearPixels`, 4.2
m), and its height read off the edge's samples. Over the real sites as the loader places them (cube stand-ins, a
seventh of the rock-field pixels): before the branch 20% of the few boulders that stood were off their pixel by more
than the reach; after ROCK-FOOT and ROCK-SHARE 15% of the boulders and 19% of the veins. A foot now stands FOOT_INSET_M
(0.5 m) inside its pixel (`scenes/mineHost.js` onPixel): none off it, 96% of the law's boulders standing, and the veins
with no foot on the pixel on its own stone instead (93% stand - the rest stood where no look reached them). Pins:
`test/fb1001_rockfoot.test.js` FOOT-IN (the host finds an edge boulder from the next pixel) and the shipped-fields test
now over the real sites, every node on its pixel; mutants `fb1001_boulders.json` FOOT-IN 2, dead; `audit29.json` C11
re-aimed by content, dead.

**Noted, not changed.** A rock piece over the pixel's edge is measured against the edge's heights for its vertices past
it (`groundAt` clamps) - its footprint there is approximate. A location a mod adds is a settlement on the client that
has the mod, and its own act refuses there alike. The cast yields to any node in the cone, a node the player cannot work
among them (E then says what that node needs) - as before when that node was nearer the look; looking away casts.

## Part five - the cast when used, the friend list, the mountain, the slow fall, the 3D map, the gate's health, the cursor

Eight #bug-reports threads through Mac, as screenshots. Every report root-caused on the real modules before anything
changed (Mac's rule of 2026-09-30), one search lane a report; each fix pinned red on the code before it and
mutation-checked. Three calls were Mac's, asked with the root causes in hand: the 3D map's drag (*"Unlock on intent"*),
the friend list (*"Build it"*) and the mountain (*"Retexture them to be as detailed as possible"*). One report was
already fixed on main.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Big Regen Spell doesnt do anything" - GOD MODE: Area at Range, Magic Based, Regenerate and Fortify Attribute (Strength) | Opaldes | part four's #3, the same screenshot: fixed there (AREA-SELF, AREA-CASTER - PR #509, on main) | answered |
| 2 | "'Cast when used' items don't work in dungeons" - "I enchanted a bracer to cast Ice Storm when used, it works fine in the overworld, but as soon as I enter a dungeon, the spell doesn't activate"; "only a fireball enchantment on the scarab"; "they work in other interiors like shops and guilds" | Skibbster; kurkku | the session's one enchant ctx readied an item's spell on the host's engine, which fires above ground and indoors only; underground the dungeon context builds and drives its own. The click swung the weapon, the item still wore, and the spell sat stranded until the first click back outside | fixed (CAST-USE) |
| 3 | "My friend list is different between devices. On my laptop and desktop." | Shanewerewolf5 | the hub keyed every social record by the BROWSER PROFILE's id (`net/social.js` accountId, minted once per app storage), never the signed-in player: a laptop and a desktop were two hub accounts with two lists, and two players on one browser one account with one list - the merge ACC1b said belonged at the hub, recorded as not built | asked, built (FRIENDS-SYNC) |
| 4 | "MASSIVE buggy mountain at 823, 399" | maya | no terrain fault (every height at and round the pixel bounded, 844-901): World of Daggerfall's `WOD_Mountain_01r1` at (824,399), a massif of ARCH3D pebbles scaled 400 to 5,800 times - a 1,434 m spire whose own UVs rode the scale, one 64x64 repeat over 600 m to 1 km of face; every one of the 2,488 WoD mountains the same (1.4 to 2.5 km), and DFU with the mod draws them so | asked, built (WOD-ROCK) |
| 5 | "When the Slowfall effect is active, falls drift to the side and catch on the wall, getting the player stuck before they touch the ground"; "then your speed weirdly accumulates and you pummel to ground HARD" | DoubleDutchess; Skeptikali | three things around the spell never heard of it: the classic climb's slip integrated plain gravity and billed the whole slip; the classic airborne grasp fired all the way down a fall five times as long; the frozen liftoff momentum kept pressing into whatever face the glide reached, and past the slope limit the collider's push-out lifted the body more than the spell lowered it | fixed (SLOW-SLIP, SLOW-GRASP, SLOW-PRESS) |
| 6 | "Holding the right-mouse button to rotate the 3D map only works on one axis (X or Y) at a time. The rotation should work for both vertical and horizontal simultaneously." | lumin | TURN-STEADY (Mac: "its a bit hard to control") let a drag's first 8 px pick turn-only, tilt-only or both for the WHOLE drag | asked, built (ORBIT-FREE) |
| 7 | "I left the Oblivion Gate with 6% health and logging in chunks my heath back down to 6% from full"; "IIRC I saved right after leaving the oblivion gate w/ 6% health" | Leafen | did not reproduce: nothing the Gate keeps holds a vital, and no wire, ledger or effect writes the player's own health back; an exact old health returns only through the save a login loads - see GATE-HP below for what can leave a heal out of it, and the questions | asked (Leafen, through Mac) |
| 8 | "Menu scrollbars change the custom cursor back to the default cursor when hovered over" - "This also happens when you move your cursor far enough to the right of the screen." | Skibbster | two Chromium laws: a native scrollbar always shows the platform arrow, and `scrollbar-color` (inherited) made every menu's scrollbar native; a custom cursor over 32 DIP a side is dropped for the arrow wherever it would not lie wholly in the viewport, and the gauntlet was 31x34 | fixed (CURSOR-EDGE) |

## CAST-USE: an item's spell is readied on the engine that fires it (2)

**Reproduced first** (two real `createPlayerMagic` engines over one player - the host's and the dungeon context's -
the real `createEnchantCtx` mounted as `scenes/world.js` mounts it, the real `useItem`, the click sent to each mode's
engine): Ice Storm, Fireball and Ice Bolt, Area at Range, Area Around Caster and Single Target at Range alike, fired in
the street and in a shop and were never armed in a dungeon; the item lost its 10 condition all the same, and the first
street click after the dungeon fired the stranded ready. A CasterOnly Heal landed everywhere (the player is one entity)
but was said on the street's channel.

**Why.** Every Use path runs `useItem` (for a bracer or a scarab, the pack's Use and the U picker - the quick slots take
potions alone, and the hotbar puts a jewel ON), whose Cast When Used payload goes through the session's ONE enchant ctx (`systems/enchantments.js` setDefaultEnchantCtx): a non-CasterOnly
spell is `setReadySpell`, which the ctx turned into the host's `magic.readySpell(record, { free: true })`. The host's
engine fires only above ground (its frame's `firePending` is gated to exterior mode) and indoors (worldModes takes it
for the interior arm); the hosted dungeon mounts no ctx of its own (`enchantCtx: false`) and drives the engine it builds
(`dungeonContext.js` playerAttackInput, its frame's `firePending`).

**The fix** (`scenes/shared.js` liveCastEngine; `scenes/hostEnchant.js`; `scenes/dungeonContext.js` castEngine): the ctx
takes a GETTER and asks it at every call - underground the dungeon context's engine, above ground and indoors the
host's; a context left from a descent never answers outside one. Cast When Strikes and reflection ride the same
getter, and so do an item's self-cast utilities (Dispel, Identify, Create Item, Recall) - underground through the
dungeon's own foe pool and windows now, not the street's. `scenes/world.js` and `scenes/exterior.js` mount it alike.
`test/fb1001_castuse.test.js` (Area at Range and Single Target at Range; Area Around Caster reproduced, not pinned).

## SLOW-SLIP, SLOW-GRASP, SLOW-PRESS: Slowfall is heard by everything a fall does (5)

**Reproduced first** (a real `PlayerMotor` over a real `Collider`, the classic climb's dice scripted). A slip off a
classic climb under the spell fell at 19-27 m/s and billed the whole slip - 10 m of wall, 25 HP; 20 m, 72 HP: the slip
arm (`player/motor.js`) integrated plain gravity and anchored its fall once, at the let-go, the one place gravity ran
without the spell's arm. A slow fall pressed into a wall with Forward held was grasped at 18.4 m on the way down: the
airborne grasp's 0.77 s timer is 1.6 m of a slow fall, its roll re-tried every 1.6 m (`player/climbing.js`). And,
without the Jump spell, no air control steers a fall: the liftoff momentum is replayed every step, so a glide five times as long carried 4.8 times
as far - into a wall it pressed all the way down, and into a face steeper than the slope limit (72 and 75 degrees) the
collider's push-out lifted the capsule more than the spell's 0.035 m a step lowered it: it hung at 12.7 m for 20 s, or
crept up the face, and fell the whole height when the spell ran out.

**The fix.** SLOW-SLIP: the slip takes the spell's arm - 2.1 m/s, its fall re-anchored every tick. SLOW-GRASP: a slow
fall is not grasped onto a wall (a departure - Port-Ledger); a climb under way is untouched, and Forward at the wall's
foot climbs as ever. SLOW-PRESS: once a slow fall's press into a face has held it up a step's height, it is spent - the frozen
momentum keeps what the collider let it do, and the Jump spell's air control is refused that way until the body
leaves the face; a lip in the step band is still stepped onto (the audit's SP1, SP2). Enhanced Climbing's own grab (Jump + Forward) is a deliberate act and is
left. `test/fb1001_slowfall.test.js`.

## ORBIT-FREE: a drag turns and tilts once it means to (6; asked)

**Reproduced first** (the real `HeldMapWindow`'s stage listeners): a right-drag of 30 px across, then 40 down, then 20
on the diagonal handed the 3D sheet `[10,0] [20,0] [0,0] [0,0] [20,0]` - all 60 px down dropped. TURN-STEADY's lock
(`ui/heldMap.js`), from Mac's "its a bit hard to control", let the first 8 px choose for the whole drag; Shift + left (a
trackpad's) the same. DFU's automap turns and orbits from one drag (`ui/automapCamera.js` dragRotate - the classic
automap port is unaffected), and the held sheet's own `orbitBy` already takes both.

**Asked** - the report against Mac's own call. Mac: *"Unlock on intent"*. **Built**: the lock still settles in the first
8 px; a locked drag then keeps what it holds back the other way, less its drift (each move forgives half its own travel
along the lock - the slope the lock's own 2:1 calls drift); past 24 px of it the drag turns AND tilts every move to its
release, the held-back travel spent first. A sideways sweep that drifts or wobbles still never tilts.
`test/fb1001_orbitfree.test.js`. The pad (right stick: turn and zoom) and two fingers (twist) never tilt; not asked.

## CURSOR-EDGE: the gauntlet everywhere (8)

**Measured** in Chromium 141 under Xvfb, the X server's own cursor read back through XFixes while a real pointer moved:
over the Settings list's scrollbar the platform arrow; within 31 px of the right edge and 34 px of the foot the arrow.
`ui/enhancedStyle.js` dressed the menus' scrollbars with `::-webkit-scrollbar` AND set `scrollbar-width` and
`scrollbar-color` on `.shell, .px-win`; since Chromium 121 either standard property draws the native bar and turns the
dress off, and `scrollbar-color` inherits - every scroller in every menu was a 15 px native bar, and Blink shows its
own arrow over a native scrollbar whatever `cursor` the scroller wears. A custom scrollbar's parts take the scroller's
cursor. And Blink drops a cursor image over 32 DIP a side for the next in its list wherever it would not lie wholly
inside the viewport: the gauntlet (`ui/plusCursor.js`) was 31x34, the classic CURSOR.IMG at 2x 64 px wide.

**The fix.** One unscoped `::-webkit-scrollbar` dress; the standard pair only under `@supports not
selector(::-webkit-scrollbar)` (Firefox), the pack card's thin bar the same; the gauntlet 31x32 (two near-twin rows of
the hand dropped, 2x the exact double), the pad's drawn box with it (`ui/gamepadInput.js`); the classic arrow cropped
to what it draws and scaled only as far as 32 DIP allows (`ui/cursor.js`). Menus' scrollbars in Chromium are now the
10 px stone slider the skin always meant. `test/fb1001_cursoredge.test.js`.

## FRIENDS-SYNC: a friend is a player, on every device (3; asked)

**Reproduced first** (the real Room over `test/fakeRoom.mjs`): one player - one token subject - friended Bob from a
laptop's profile; from a desktop's the picture came back `acct: 'aDesktop001'`, `friends: []`, and the hub held three
records. A second player signed in on the laptop's profile saw the first's Bob. The client keeps no copy of the list
(no stale cache): the hub's `acct:<id>` and `asecret:<id>` were keyed by the hello's `acct`, the profile's id
(`scenes/world.js` hands the hub's link `accountId()`), while the verified subject sat on the same socket's attachment
(`sub`) and ONE-SEAT already seated by it. `06-Systems/Accounts-And-Cloud-Saves-Arc.md` had named the fix ("THE MERGE
BELONGS AT THE HUB") and recorded it as a later slice.

**Asked** - a relay deploy and a migration of the hub's own storage. Mac: *"Build it"*. **Built** (`server/src/index.js`
`_helloAccount`, `_mergeLegacy`): the hub's account IS the token's subject. The profile pair is a legacy credential: on
a device's first hello after the deploy, proved by its secret, the profile's record is merged into the player's - a
UNION of friends and requests, the bounds kept, a request already a friend dropped - every friend's and requester's
record renamed from the profile's id to the player's (a friend of both is one friend), and the profile's record and
secret retired; the friends online are sent their picture again. A party seat under the old id is not carried; it
lapses as any seat whose tabs went (PARTY_OFFLINE_MS). The client accepts its picture under the signed-in player's id
or the profile's, from a relay before this (`net/social.js` AUDIT SOC B19), and a follower's cancel of a shared rest
reads the id the hub seats me by (`social.acct`), not the profile's. **world142**; the hub hello gains `ps` (the
audit's F5) and no other frame changes shape; no account service change. Ship the client with the relay: a page loaded before it refuses the new picture until it reloads (the
relay-version notice tells it to).

The older hub pins modelled one account as several tabs of several subjects; under ONE-SEAT one subject holds one hub
tab, and a second is a claim that closes the first. Rewritten, each saying so: `soc1_hub` (the thief its own account;
a second tab a claim; two-device presence and the party pose by claims; a new pin - the picture is the claiming
socket's alone, a closed tab the runtime still lists never tried), `auditsoc` A10/B9 (ACCOUNT_TABS_MAX over a burst of
claims), `chatchan` (the party line by claims; the room's party budget over three full parties), and the source pins
in `auditsoc` B5/B18/B10 and `soc3_socialpanel`. The harness signs a social hello's token for its account
(`fakeRoom.mjs`), and its issued-at walk restarts from the clock past MAX_TTL_S. Mutant records re-aimed by content:
`auditsoc.json` A7-replaced-socket-never-leaves, `soc1.json` S11-state-to-every-tab, and `soc1.json`
S38-version-not-bumped (it still said world140 - missed at world141's bump - now world142); 158 dead, 2 equivalent as
recorded. `test/fb1001_friendsync.test.js`.

**Main's red, ported.** `test/herald.test.js` still pinned world140 (CLIMB5's bump missed it), and five relay pins did
not parse (the bump's message carried an unescaped quote); 22 line cites into world.js, exterior.js, worldModes.js,
dungeon.js and dungeonContext.js stood where #504's merge moved the code from - struck Ledger rows, the Settings
spec's viewport row and chargenSession's overlayHover cite (citedrift CD4, CD8) - re-aimed by content.

## WOD-ROCK: a stretched World of Daggerfall piece keeps its pebble's texel density (4; asked)

**Measured first** (the real terrain pipeline and the real WoD loader over the game's own data): WOODS reads 55 at
every pixel from 820 to 827 by 396 to 402 - a flat plateau in the Dragontail Mountains - and every streamed height in
821-826 by 397-402 stands between 844 and 901, none non-finite. The spike is the mod's: `WOD_Mountain_01r1` at
(824,399), its object 7 model 60716 (a 1.9 m pebble) at 398 x 1101 x 398 topping out 1,434 m over the site, object 3
1,196 m. Its triangles' edges reach 820 m; the model's own UVs ride the scale, so one repeat of texture 141.2 covers 600
m to 1 km. Not an outlier: all nine `WOD_Mountain_*` layouts stand a spire 1.4 to 2.5 km (2,488 sites; 2,391 keep it
past the roads clearance), and some 6,500 `Rocks_Large_03` stand 424 m pinnacles alike. DFU with the mod draws them the
same - `LocationHelper.cs:1176` makes the classic mesh and nothing touches its material or UVs - so this was the port
drawing the mod faithfully.

**Asked** - retexture, cap their height, remove them, or leave them. Mac: *"Retexture them to be as detailed as
possible"*. **Built** (`world/wodRockUv.js` wodRockUvs; `scenes/world.js`, the WoD loop): a piece stretched 4x or more on
any axis is drawn with new UVs, plane by plane - each plane of the model unfolded isometrically through its own
unscaled UV map, so every face of the scaled piece carries the texture at its pebble's own texel density and
its rows along the edge they ran along (the spire's face: 74 texels a metre, where it carried 0.07), tiled REPEAT, each plane shifted by whole
repeats to start near zero, a vertex two planes share copied for the second. Positions, indices, the collider and the
mining boxes are the model's own; a camp, a house or the shrine statue (2.65 at most) is the same object, batched byte
for byte as before. A departure (Port-Ledger). `test/fb1001_wodrock.test.js`; `tools/mutants/fb1001_wodrock.json` (17,
all dead).

## GATE-HP: the report did not reproduce (7)

**Traced** on the real modules, every candidate: the Gate keeps no snapshot of a vital (its only device keys are
`wb5.gateClaims` and `wb5.spoils`, and no gate module lays an effect on the player); a court blow lands only while the
court's `feet()` stands (null outside it); GATE-HEAL (#507) adds to a figure owed the relay, after the heal has landed;
the relay's damage chart and heal bucket are figures, and no frame writes the local player's health (the duel
opponent's alone); the account service lands a checkpoint only under the tab's lease at the next sequence and restores
no older copy, and RESCUE-SAVE's device copy loses to any newer record (`test/rescuesave.test.js`); the renown layer
keeps health's fraction both ways. An EXACT old health returns only through `restorePlayer` (`systems/save.js`) from the
save the login loads, so if the 6% is the gate's, that save never held the heal. What can leave a heal out of it, none
confirmed as Leafen's: a page closed rather than Exited, then a login elsewhere (the final checkpoint usually lands
after the lease is let go - `test/rescuesave.test.js` pins that the device keeps it); a tab that lost its seat
(ONE-SEAT) plays on and saves nothing; a save past 512K characters on a full device's hidden page; a composer that
throws on every checkpoint (`[online] checkpoint failed` on the console). And "in chunks from full" argues against a
stale save - the HUD's first frame is drawn after the boot's load, so a load at 6% shows 6% at once. The two floors near
6% - the lycanthrope's urge (`NEED_TO_KILL_HEALTH_LIMIT_MINIMUM`, 4) and the survival harms' last points (`HEALTH_FLOOR`,
5) - were walked through a login and did not take a full bar down.

**Asked**, for Leafen through Mac: one device or several (a browser, the desktop app, a guest)? Was "Online in another
tab or device" or "Your last save had not reached the realm" said? At the login, does the bar start at 6%, or at 100%
and fall? A werewolf or wereboar? Any `[online] checkpoint failed` on the console? No code changed.

## The audit of part five (Mac: "audit this")

Lanes over part five's diff, one a fix each (CAST-USE; FRIENDS-SYNC; SLOW-SLIP, SLOW-GRASP, SLOW-PRESS; ORBIT-FREE
with CURSOR-EDGE; WOD-ROCK as it landed) and one the record's, each reproducing on the real modules. Every finding
pinned red on the branch before its fix (a gap pin's mutants are its claim) and mutation-checked.

| Tag | Lane | What it was | Done |
|---|---|---|---|
| F1 | FRIENDS-SYNC | under the live law a hub `acct` is any id, and a player's id is public (every roster carries `sub`): a profile hello naming a player's id planted `acct:<player>` and its secret, and after world142 the player's first hello INHERITED the planted record (the planter's alt befriended, hearing the player's presence and peers), and the planter's later hello merged it away from them | a profile secret at the player's own id is a forgery: the record is retired whole, every record it names forgetting it (`server/src/index.js` `_retireForged`) |
| F2 | FRIENDS-SYNC | the union was cut at FRIENDS_MAX (and PENDING_MAX) but every record it named was renamed onto the player: a cut friend kept the player, saw their presence, and could not be removed by them | what the player's record kept of a friend is what the friend's keeps of the player (`_mergeLegacy`) |
| F5 | FRIENDS-SYNC | a client built before world142 expects its picture under the profile's id (AUDIT SOC B19) and refused every one the hub sent: no friends, no party, no word why - and SRV-N's notice baselines on the first version a page hears | the hub hello carries `ps` (1 or nothing; `net/online.js`, `net/wire.js` parseClient); a hello without it is told "update the game to see your friends and party" in the words its chat prints |
| F3 | FRIENDS-SYNC | the reconnect-replace leave's new compare was right and unpinned - `b.acct !== m.acct` survived every suite (every reconnect a logout, a party of one deleted) | pinned |
| F4 | FRIENDS-SYNC | the A10/B9 rewrite pinned the bound with `<=`: three bound mutants that died before lived | pinned exactly again (`test/auditsoc.test.js`) |
| F6 | FRIENDS-SYNC | the merge's bounds - 129 records over the 128-record write, a friend's request, my own other device, an online friend's picture - unpinned | pinned |
| SP1 | SLOW-PRESS | under the Jump spell the airborne branch re-reads the input every step, so Forward held re-pressed a slow fall into a face past the slope limit after SLOW-PRESS had spent it: 72 degrees at a walk 19.9 s to come down 12 m, 74 at a run crept UP the face and stayed | the way the face refused is kept while it holds the body, and the air control refused it (`player/motor.js`) |
| SP2 | SLOW-PRESS | a regression of part five's own: SLOW-PRESS spent the press on the step the body first touched a wall, and the collider's step-up needs that push the step after - a slow glide a step under a lower roof's lip fell into the street (148 of 230 arrivals at 1 m/s on the roof, 216 before) | spent only once the face has held the body over the spell's line further than a step's rise (STEP_OFFSET) |
| SP3 | SLOW-PRESS, SLOW-SLIP | unpinned: the glide's along-face half (zeroing it passed every suite), a slip under the spell still the classic slip with its regain roll, and steering back once off a face | pinned |
| CU1 | CAST-USE | the same two engines at the transition: a ready held when the mode flipped stayed on the other one - a touch ready taken down the stairs (the dungeon door lets one through) fired at the first click back outside, and one held at the way out died with the dungeon's engine, the item's condition spent and no spell cast (a spellbook ready the same, before part five) | the ready, its freeness and its price, handed to the engine that fires where the player stands - down at the flip (`worldModes.js`), out in the dungeon context's teardown (the door, a Recall, a load) - `hostMagic.js` handReadyTo, takeReady |
| CU2 | CAST-USE | the dungeon's ready line priced a free ready at the spell's full cost ("Ice Storm (150)" at 50 magicka, the click spending 0) - common now item readies land there | the line prints the ready's stored price (`readiedCost`) |
| CU3 | CAST-USE | Cast When Strikes and reflection underground ride the live engine - true, and unpinned (either door on the mount-time engine passed every suite) | pinned |
| UI1 | CURSOR-EDGE | the classic skin never lays ENHANCED_CSS, and the chat (it mounts on either skin), the social panel, the profile and the decorator kept native scrollbars - the OS arrow over them on the classic skin (as before part five; the fix's word "every scrollbar on the page" was the enhanced skin's) | the document cursor brings the dress itself (`ui/cursor.js` CURSOR_SCROLLBAR_CSS) |
| UI2 | CURSOR-EDGE | the unscoped dress turned a touch screen's invisible overlay scrollbar into a standing 10 px bar (the front page 915 px wide to 905), with no cursor there to keep | for a pointer device only (`@media (any-pointer: fine)`) |
| UI3 | CURSOR-EDGE | the classic arrow's sizing was pinned by its source text alone - a fixed 2x, the whole image drawn, the full size and a moved hotspot all passed | pinned on the real canvas path |
| UI4 | ORBIT-FREE | sound (resets, chords, the pitch clamp, the pad and touch unchanged; the jump as it frees is 8.3 degrees of tilt at least, under one R/F key step, by design); a leftward drift, the freeing move's own along-lock travel and a fresh drag's clean start were unpinned | pinned |
| WR1 | WOD-ROCK | the unfolding's frame was laid along the reference triangle's first edge - often a quad's diagonal - and an in-plane stretch keeps only that direction's angle: on the re-mapped non-rock pieces the textures with a grain turned - a palisade's planks (43001) 54 degrees off the wall, a fort piece's 32, a dock's stone blocks 14 (the rock, the same either way, hid it) | the frame along the texture's own rows (dP/du); every textured face of the 847 within 0.13 degrees |
| WR2 | WOD-ROCK | one outcrop mixes pebbles under and over the 4x threshold (60610 at 3.01 beside 4.69; 60718 at 3.5 beside 60714 at 1.9): touching faces two to three and a half times each other's density | a rock pebble is unfolded from any real stretch, by the model id the host hands in (`WOD_ROCK_MODELS`) |
| ROCK-CAP | WOD-ROCK (asked) | at the pebble's density the rock read as rock within some 10 m, a lattice at 30 to 100 m, flat from 300 m - a spire is seen from hundreds of metres. Mac: *"Cap at ~8 m a repeat"* | a rock face no finer than a repeat per 8 m (`WOD_ROCK_MAX_REPEATS_PER_M`) |
| R | the record | part five's own page and rows: the FRIENDS-SYNC section said no frame changed shape (F5 added the hello's `ps`), 157 dead where 158 died, ORBIT-FREE's repro 20 px across where it was 30, the H1, the preface and Active-Arcs silent on part five, the Ledger row naming one of its two pins, a Testing row overstating its source pins, CAST-USE's audit tags F where the page said CU; and main's struck Ledger row 821, re-aimed by half (its `world.js:3491-3496` now `8855-8867`) | corrected; the cast-use tags CU1-CU3 in the source, the pins and the mutant names |

The relay's bytes moved with F1, F2 and F5, before any deploy: world142's LAW row is rewritten in place (never shipped).
Mutant records re-aimed by content: `soc1.json` S11-state-to-every-tab and `soc2.json` C2-one-half-sent. Pin moved:
`soc2_session` (the hello's `ps`); the harness's hello with an account says `ps` unless a pin asks for an old build.
`test/fb1001_friendsaudit.test.js`; `tools/mutants/fb1001_friendsaudit.json` (15, all dead). `test/fb1001_slowaudit.test.js` (SP1 and SP2 red on the branch before);
`tools/mutants/fb1001_slowaudit.json` (6, all dead), `fb1001_slowfall.json` judged dead again. `test/fb1001_castaudit.test.js`
(CU1 and CU2 red on the branch before); `tools/mutants/fb1001_castaudit.json` (8, all dead). `test/fb1001_uiaudit.test.js` (UI1 and UI2
red on the branch before); `tools/mutants/fb1001_uiaudit.json` (9, all dead). `test/fb1001_wodaudit.test.js` (WR1 and WR2 red
on the branch before); `tools/mutants/fb1001_wodaudit.json` (5, all dead), `fb1001_wodrock.json` judged again. Measured and asked:
at the pebble's density the rock read as rock within some 10 m, a regular lattice at 30 to 100 m and its mean colour
from 300 m (no anisotropy on model textures) - and the spire is seen from hundreds of metres. Mac: *"Cap at ~8 m a
repeat"* - ROCK-CAP: a rock pebble's face tiles no finer than one repeat per 8 m in its finest direction (8 texels a
metre), its grain's proportions kept; a pebble already coarser keeps its own, and a plank, a block or a palisade its
model's (`WOD_ROCK_MAX_REPEATS_PER_M`). Seen and left (before part five, not asked): the
Enhanced Plus gauntlet's pressed frame draws its fingertip about 14 px right of its hotspot (`ui/plusCursor.js`). Seen and left (no diff, every
fall's): a peer's body has no in-air pose - the others see a slow faller walk or stand mid-air (a pose field, a relay). Seen and left (main's
own): `auditworld34` A1 fails one run in two or three on main as on the branch (its 25 ms windows).

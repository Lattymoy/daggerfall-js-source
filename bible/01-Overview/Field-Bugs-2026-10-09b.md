# FIELD BUGS 2026-10-09b - nine Discord threads

Nine threads from the Discord's bug-reports, handed over as screenshots (five, then four more).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "River/Stream Creation Turned Some Roads into Canals" - "a lot of towns that usually have straight dirt roads to them now have canals" (Codename: Scheming Eunuch) | Hazelnut's arrays share an arm between a path and a river or a stream at 32 arms of 30 pixels; the water painted over the track's arm and LANDFORM3 cut it in, with the room's rivers on | fixed (CANAL-ARM) - the map half unconfirmed, below |
| 2 | "you can be teleported into a pvp zone and killed" - a newcomer invited to a party, led into the mountains and killed (Ardebitis) | every door worked: a party mate is never fair, a kick ends the party in the instant, and the party's walk in never named the zone | fixed (PARTY-TRUCE); the rest the owner's call |
| 3 | The Stolen Item's thief "doesn't seem to exist since the quest giver also doesn't know about it" (Etrius) | DFU's own law: the thief is placed (a house in another town of the region); a questor knows no more of its own quest's people than anyone, and the journal's entry names no place | not a port bug - kept |
| 4 | the Dark Brotherhood's hall not highlighted on the town map, no name at its door, a member still let in (satoshi god pack) | the port's DISC28-K re-stamp wrote a contract's questor Place's empty name over RevealGuildHallOnMap's "The Dark Brotherhood" | fixed (HALL-STAMP) |
| 5 | "market isnt accepting my drops" - "The realm does not hold that piece where your pack had it" ("confirmed by 3 others") | ACQUIRE1's `acquired` mark rode the pack's record and not the offer, and the realm's trade law counted it as part of the piece | fixed (MARK-WIRE) |
| 6 | "Can't go into Abyss Dungeon portal" - three in a row, in on the eighth Recall (Cruor, "happening to a few people") | the parked team's word went down the Shattered Hour's socket before its welcome, and the realm, still asking the hub about its Hollow, closed on it as policy | fixed (PARK-HELLO) |
| 7 | "Motherlode ore veins can spawn inside rocks! Which thus renders them unmineable!" (Cruor) | a node was asked only of its own pixel's rock pieces; a neighbour's reach in | fixed (ROCK-NEAR) |
| 8 | Lord K'avar Part 1 - "Exact quest guidance just takes me back to the exit", Privateer's Hold and then The Convocation of Elona, Repair pressed twice (Themicles, John Freeman) | no fault found in the placement - see below | not reproduced - asked for a save |
| 9 | "NPC Shrarton in Tasoparet face sprite missing." (Rook) | Immersive Travel's WALLAA09 carriage driver: his flat (357.3) has no FLATS.CFG row, so the portrait law stood 410, TFAC00I0's "OOPS! Tell Mack NOW!" - DFU with the mod does the same | fixed (DRIVER-FACE), a departure |

## CANAL-ARM: an arm a path carries is the path's (1)

His arrays carry a byte a pixel per network, one bit an arm from the pixel's centre to an edge or a corner. A path and a
water that meet a pixel's centre from the same side share the bit: 32 arms of 30 pixels (river and road 8, stream and
road 10, stream and track 13 - and a town's centre is where both run). His painter paints the water before the track,
so the whole arm painted as water where the dirt track ran, and a river on a road's arm stood its banks either side of
the road. In DFU those were tiles; here LANDFORM3 cuts painted water into the land, a stream 1 m and a river 2.4 m, and
since LANDFORM3 the room's rivers are on (`systems/onlineLane.js`) - a straight channel to the town, the track gone
(AUDIT LANDFORMS II J1's ford: a track gives way to the water's channel) or the road a causeway in it.

`world/roadsProducer.js` `waterOffPaths` drops the water's bit on each such arm, once, as `loadModRoads` answers -
before the arrays reach the kernel, the worker, the maps and World of Daggerfall's question (which reads the paths
alone). A crossing shares no bit: the water and the path meet at the centre from different sides, and every ford and
causeway stands. A departure from the mod (Port-Ledger A, CANAL-ARM; `03-World/Roads.md`).

NOT CONFIRMED: the report's second screenshot is the held map, its bands a wash under a firm line - the pen the ink
map draws the COAST with (`ui/inkMap.js` paintInkStatic's shore), not a road's or a river's. The coast is WOODS.WLD's
land and water under the one water law, and nothing in this slice or the ones before it writes those bytes; a narrow
sea inlet traced as a coast reads as such a band, ending in a ring. Where that map stands was not found from its names.
If the bands are new, their place is wanted.

Pinned by `test/fb1009b_canalarm.test.js` (his arrays as they load: no shared arm, every other water arm his to the
bit, the crossings standing; painted with the rivers on, every shared arm's tiles the path's); `tools/mutants/fb1009b_canalarm.json`.

## PARTY-TRUCE: a party left is no fight for ten minutes (2)

`11-Multiplayer/Wild-Zone.md` section 21b. A player who leaves my party, or whose party I leave, is no fight for ten
minutes, both ways, each client reading its own party; a party's walk that ends in the zone or its band names the zone
in its question. Not done, and the owner's: a floor for new players, and whether guild members fight here. THE FOUR
HOSTS: the zone's fights are world.js's alone (`wildFair`, the one fairness gate; the zone's dungeons are its modes) -
exterior.js, worldModes.js and dungeonContext.js stand no zone fight. Pinned by `test/fb1009b_partytruce.test.js` and
`test/tv8_party_walk.test.js`; `tools/mutants/fb1009b_partytruce.json`.

## The Stolen Item (3): DFU's own, kept

The quest is C0C00Y12 (a temple's, QuestId 12). The thief is `Person _thief_ ... remote anyInfo 1014 rumors 1013`, placed
at `_thiefplace_`, a remote house in another town of the region; the journal's entry (1010) names no Place, so the
tracker has nothing to point at, as DFU's journal has nothing. The questor's "I can't help you with Mordyrick
Wickwing" is record 7250: GetNPCKnowledgeAboutItem's seeded roll (35% for a temple's merchants' group) and the
reaction tier, the same for every NPC - DFU gives a questor no knowledge of its own quest's people. The way to him is
DFU's: "Any news?" (1005, "_thief_ is holed up in _thiefplace_"), other people asked about him, and Where Is in his
town. Not changed.

## HALL-STAMP: a hideout's name is the member's (4)

RevealGuildHallOnMap names a member's hall as an override, and the override is the plate (a House2 is a residence) and
the door's name. Every Dark Brotherhood contract's questor stands at the hall, so its questor Place IS the hall, named
'' (a House2 has no name of its own). DISC28-K's re-stamp (`systems/discovery.js` restampQuestName) read the '' as a
name and wrote it over the reveal at the next door's look or town map's open - no plate, no name, the members-only lock
still opening. It never stamps a Thieves Guild or Dark Brotherhood hideout now (UndiscoverBuilding's own shield), and
a nameless Place names nothing; a save that carries the blank heals on the next entry's reveal. Pinned by
`test/fb1009b_hallstamp.test.js`; `tools/mutants/fb1009b_hallstamp.json` (and `disc28.json` re-aimed).

## MARK-WIRE: the receiver's marks are one list (5)

`10-UI/Loot-Banner.md`. ACQUIRE1 marks every weapon, piece of armour or clothing, jewellery, artifact and card in the
pack `acquired`, and the mark rides the save into the realm's record; the wire's clamp strips it from the List form's
offer. The realm's trade law (`net/realmTradeLaw.js` recordIsOffered) compares every field but its volatile list, which
named `equipSlot` and `questItem` and not the new mark - so every marked piece was "not the record's piece", at the
market, a home vendor's stall and a realm trade alike. The three receiver's marks are `RECEIVER_MARKS` now, read by the
clamp (`systems/loot.js`), a wild death's record (`systems/wildDeath.js`) and the law. THE WORKER: the law is the
account service's too (`server-account/src/market.js` imports it) - the service's deploy carries the fix. Pinned by
`test/fb1009b_markwire.test.js` and `test/fb1001_market_goods.test.js` (the HUD's watcher run before the list);
`tools/mutants/fb1009b_markwire.json`.

## PARK-HELLO: nothing past a hello until the welcome (6)

SD-HELLO held the pose and every `_send` frame until a room welcomes its socket; two senders went round it, each gated
on the LAST welcome's word: the parked team's word (`net/online.js` sendPark - every online character's, the frame
after every room's hello, from `hccParkTick`) and a changed look (`_flushLook`). Most rooms answer a hello at once. The
Shattered Hour's realm asks the hub about its Hollow first whenever its copy is over ten seconds old (`_sdAdmit`); the
park arrived meanwhile, the relay refused it ('park before hello') with a policy close, and the Rift cast its player
out at the Hollow's door ("The way to the Shattered Hour is lost"). Within ten seconds of another player's hello the
realm needed no ask - the Recall that let them in. Both wait for the welcome now (the park's tick tries again; an owed
look stays owed). Client-only: the relay unchanged. Pinned by `test/fb1009b_parkhello.test.js` over the real session and
the relay's own parse; `tools/mutants/fb1009b_parkhello.json` (and `profile2.json` re-aimed). Not changed: THE RELAY'S
HALF - a frame arriving while a hello awaits is still refused there; an older client still meets it.

The "38 minutes to unstuck" in the screenshot's chat is /unstuck's own zone cooldown (60 minutes in the PvP zone),
not the Rift's.

## ROCK-NEAR: a neighbour's rock is rock too (7)

A World of Daggerfall field's pieces are hills scaled by hundreds and reach far past their pixel's edge (FOOT_INSET_M),
and every node was asked only of its own pixel's (`entry.rocks`): a Motherlode (one a day, on the compass from anywhere,
on the Mountain and Desert pixels with the largest pieces), a vein, a boulder's foot, a herb patch or a tree stood under
a neighbour's - lit and past every look. The gathering host hands every kind the pieces its eight built neighbours
stand that reach in (`scenes/gatherHost.js` nearRocks, in the pixel's own frame by the two placements' offset), and a
neighbour built after stands the pixels it reaches again. The Motherlode's heart, stood unasked before standAnywhere,
is asked too. A node stands BESIDE its own pixel's pieces alone, so a pixel with no neighbour reaching in stands as it
did. Positions are the client's alone (the service checks a node's key and slot), and every client with the same 3x3
built stands alike. Pinned by `test/fb1009b_rocknear.test.js` (the law and the real host); `tools/mutants/fb1009b_rocknear.json`
(and `audit29.json`, `auditsilver.json`, `fb1001_boulders.json`, `fb1001_nodes.json`, `prof2.json` re-aimed).

## Lord K'avar Part 1 (8): not reproduced

Driven through the real QuestMachine, Place, sceneMount and questRepair (in scratch): the site re-seated out of
Privateer's Hold (KVAR-HOLD) carries its targets, and `pc at _stronghold_ set _S.26_` places `_mtraitor_` again on every
entry - he stood in both dungeons. Exact guidance marks any living quest foe at its feet, so the exit-only compass says
he was not standing. The one state that shows nothing in two dungeons and nothing to Repair is M0B11Y18's own: once
injured (`_hittraitor_`) a minute later he is removed (`_S.36_`, popup 1073), or he was killed (`_S.29_`, popup 1072) -
he carries a random Ranger's name on screen - and the quest waits on Queen Akorithi (`_S.30_`) with no journal step
saying so. Every spawn-time scaling (champion, elite, super, the zone, progression) sets health to its new maximum, and
a quest foe is out of the infighting, so no "injured" was found firing at the spawn; a companion's blow does count. The
player's save (M0B11Y18's `_mtraitor_` hidden or killed, `_S.30_` unset) would settle it; meanwhile, the Queen ends the
quest. Not changed.

## DRIVER-FACE: the WALLAA09 driver wears a face (9)

`06-Systems/Immersive-Travel.md` departure 12. Shrarton is no street walker but the mod's carriage driver at Tasoparet's
WALLAA09 gate - flat 357.3, a bearded man, which FLATS.CFG has no row for, under the Carriage Drivers' faction with no
flat of its own. GetPortraitIndexFromStaticNPCBillboard starts at 410 and both its lookups missed; every walled city's
WALLAA09 driver showed the OOPS face. While the mod is loaded the flat wears classic's own bearded man's face (182.3,
429), written into FLATS.CFG's dictionary as Roleplay & Realism writes it. Pinned by `test/fb1009b_driverface.test.js`;
`tools/mutants/fb1009b_driverface.json`.

# FIELD BUGS 2026-10-03b - the trees on the hills drawn, a questor seated in the town as it stands, a shared quest's vermin alike, the Totem riding its cage, the Aetheric pieces the maker refuses, a ship's cabin without her hull

The Discord's bug reports of 2026-10-03, handed over as screenshots: *"Floating trees in Tamhope"* (Rissa), *"Bugged
Quest"* (RyuDouro: "the NPC to deliver no longer exists in the same shop"; TutucoGOD: "the NPC doesn't exist on the
location provide"), *"Spiders aren't spawning for shared exterminator quest"* (Starempire42), *"I need some help from
a..."* (Shortstori: "the Totem of tiber Septim isnt here ... daggerfall Castle will Never reset with 300+ people"),
*"Not sure if intentional or not, buuut: Enchanting Aetheric sets"* (Cruor: "You can enchant Ruhn's gear, lol") and,
from #general, Regi's "i got into my boats interior and then got out and i'm in the void". Every fix below is pinned
by tests that fail on the record's own code (14cd193b1), the new pins mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Floating trees in Tamhope" (Rissa) | six Beautiful Villages blocks stand TEXTURE.504's trees on the RMB Resource Pack's hills at the author's heights, and the port's stand-in mounds are a fraction of the pack's size - 121 of 130 trees hung more than 1.5 m over what is drawn | TREES-SEATED |
| 2 | "me and my friend cant deliver quest because the NPC to deliver no longer exists in the same shop" (RyuDouro) / "I can't deliver a quest because the NPC doesn't exist on the location provide" (TutucoGOD) | a `group Questor` is known to the return click by four numbers its building's block mints; #545 laid the towns out again online, where a save's records pin nothing, so a quest taken before it named nobody - and the reseat moved the questor's hall to the town's apothecary (a P2 of 0 read as Alchemist) | QUESTOR-MOVED |
| 3 | "Every time we look around inside the guild nothing seems to have spawned, even though the first spider did spawn and we killed it" (Starempire42) | each copy of a shared quest rolled The Exterminator's `pick one of` itself and the resync traded the picks at every kill, while the receiver threw its own wave away whenever the sharer stood near - the spider wave lived in the receiver's copy and never stood | VERMIN-SHARED |
| 4 | "Im about to end my mainquest but the Totem of tiber Septim isnt here" (Shortstori) | DFU parents a quest item to its marker so it rides that marker's action - the treasury cage that raises the Totem; the port stood it at the marker's start, so the cage rose empty, and online the castle room remembers the raised cage for good | TOTEM-CAGE |
| 5 | "You can enchant Ruhn's gear, lol" | an Aetheric piece carries no DFU enchantment, so DFU's one item refusal (IsEnchanted) never met it: the maker listed the Regalia, the Broker's ware and the raid sets as plain Daedric and spent their whole budget over their powers | AETHERIC-MAKER |
| 6 | "i got into my boats interior and then got out and i'm in the void" (Regi) | a ship's cabin is built at her own root with her fleet kept afloat outside, and the host's indoor arms stood that fleet in the room - her decks in its collider and drawn through it (the planks and holes), her ladder and her helm pressed from it, which stood the player on her deck in the building's frame: her hull alone in the black | CABIN-HULL |

## TREES-SEATED (1)

`world/townStandIns.js` drawnHillStandIn, blockHillSeat, seatNatureFlat; `world/rmbFlats.js` isNatureArchive,
NATURE_FLATS_Y; `scenes/world.js` buildPixelNow's block flats; `scenes/exterior.js` the same flats;
`tools/rmbrpHills.mjs` (new). Tamhope is Beautiful Villages' `location-18-157` (Glenpoint); its edit swaps one cell to
a new GENRAS04, which places no hill, and the rest of its grid is MAPS.BSA's. Six of the mod's blocks - RESIAS08,
TVRNAS00, TVRNAS01, TVRNAS03, TEMPASH3, WEAPAS02 - stand TEXTURE.504's trees as misc flats on the RMB Resource Pack's
hills (52xxx): 130 of them a metre to 13 m over the plane, at heights the author read off the pack's own meshes
(measured against those meshes, 128 of the 130 lie within 0.75 m of the hill's surface). DFU stands each where it is
authored (AddMiscBlockFlats, RMBLayout.cs:326-380, reads no terrain and swaps no archive) - on the pack's hill, and
floating without it. The port draws its own mounds there (`RMBRP_HILLS`, the catalogue's Small/Medium/Large as 3, 6
and 10 m), and 121 of the 130 hung more than 1.5 m over what is drawn. While a block's hills are drawn as the port's
stand-ins (customModelFor, the door the pipeline asks first), every flat of that block in the nature range now stands
on the higher of the drawn ground (NATURE-GROUND's `groundOffPlane`) and the stand-ins' top under it, read off the very
triangles the pipeline builds. The range is 500-511 because a misc flat keeps the archive it names, so these 504s are
not the pixel's archive in winter or in another climate. A block with no hill drawn as ours - every classic one -
keeps the plane and NATURE-GROUND's lift, byte for byte; a hill the port does not draw as its own leaves the block as
DFU stands it. All four hosts: the streamed world (world.js) and the one-location exterior (exterior.js) seat; the
interior host (worldModes.js) and the dungeon (dungeonContext.js) stand no RMB exterior flat (pinned). Port-Ledger's
NATURE-GROUND row and Beautiful-Towns' hills row narrowed. NOT SEEN ON A GPU: driven over the pack's own six blocks with
the stand-ins the pipeline builds. `test/fb1003b_trees.test.js` decodes the six blocks from the vendored pack (their
records are carried whole - no game data) through blockFromJson, layoutRmbBlock, collectBlockFlats and RMBRP_PIECES,
and measures with a ray of its own; `test/natureground.test.js`'s pins re-aimed (`tools/mutants/natureground.json`'s
lift-dropped record with them).

The mounds themselves were drawn at the pack's measured shape by FIELD BUGS 2026-10-05 HILL-SHAPES
(`01-Overview/Field-Bugs-2026-10-05.md`: a polar profile per hill; one of the 130 trees hangs over it now). Measured on
the pack's published files (`node tools/rmbrpHills.mjs <a clone of drcarademono/rmb-resource-pack>` reads each prefab,
its .blend and the scale it stands at - 0.01 Large, 0.005 Medium, 0.0025 Small; nothing of the pack is committed), the
pack's hills were mostly 3-4x wider (1.7-4.5x across the 23 ids) and 2-7x taller than the catalogue's stand-ins: 52548
is 41.2 x 36.7 m in half-extents and 7.82 m high (stand-in radius 10, 1.6 high), 52058 41.5 x 41.7 m and 16.03 m (10,
3.5), 52703 11.6 x 11.2 m and 8.99 m (3, 1.4). The seat stays either way: it stands the trees on whatever is drawn. Whether Tamhope's own grid holds one of the six blocks needs the player's MAPS.BSA
(`maps.getLocationByName('Glenpoint', 'Tamhope').exterior.exteriorData.blockNames`); the cause is the six blocks'
wherever they stand (TVRNAS0x are the roadside taverns' too). The far ring's stride-4 ground is not re-read, as for
NATURE-GROUND.

## QUESTOR-MOVED (2)

`systems/quest/person.js` reseatMovedQuestor; `systems/quest/machine.js` reseatMovedSites, _reseatMovedOf,
_reseatArrived, movedQuestorName, receiveSharedQuest, updateSharedQuest; `systems/quest/place.js` reseatMovedSite,
siteTown, townBlockGrid; `scenes/world.js` questWorld.townLayoutsKnown; `scenes/worldModes.js` npcDisplayName. Both
reports are merchant quests: K0C00Y09 ("bring %g2 back to __qgiver_ ... wanted =enemy_ alive", The Champion
Athenaeum, a library) and K0C00Y05 (The Lost Child, a tavern). In both, `_qgiver_` is `group Questor`: the NPC clicked
at the offer, bound by SetupQuestorNPC, and known to the return click only by the four numbers
QuestMachine.IsNPCDataEqual compares - the person record's position hash and name seed, the building key and the map
id - all minted by the building's own block. #545 laid 7,727 towns out again for everyone online, and online a save's
records pin nothing (only the service's homes do). So a quest taken before it named a questor whom no building as it
now stands holds: `clicked npc _qgiver_` never fired, the NPC was a stranger (and could offer new work), and the quest
could not be handed in. This was the one record AUDIT WD3 S5 left unmended. Now the load's `reseatMovedSites` seats
such a questor again in the town as it stands: in the building the journal names (`__qgiver_`, the hall's own name),
else the first named building holding a person of the questor's faction and look; on the person there of that faction
and look, else of that faction, else the first. Each candidate's record comes from the questor pool's own walk
(`talkTopics.js` questorCandidateBuildings, SetLayoutData's law), so it is exactly the record a click on them mints.
There is no roll, so a party's two copies are mended alike. The questor keeps the journal's name, and the NPC answers
to it (`movedQuestorName`, only where the questor's seed and the NPC's differ - a questor bound where they stand keeps
DFU's one name). The hall moves with its questor, re-stamped, and its site link follows. The latent half:
`Place.reseatMovedSite` chose the hall again too, by a P2 of 0 it never had - Alchemist - so a pre-update questor's
`__qgiver_` could name the town's apothecary. A Place minted where the player stood (Scopes.None) is no longer chosen
again by a Place's law. "Me and my friend": a share or a resync that lands with a copy from before the mods is mended
on arrival, once the host knows its towns' layouts (`townLayoutsKnown`, the world seam's); before that, the load's
reseat mends it, and the hall's link follows. The same mend covers a questor whose town moved for any other reason: a
town pack that failed to load in one session and loaded in the next (or the reverse), a home pin landing late,
Daggerfall city's arena cell. THE FOUR HOSTS: world.js (the seam) and worldModes.js (the interior's one name
derivation, mounted by the world and exterior hosts) are wired; exterior.js's standalone seam has no online homes and
answers "known" by its absence; dungeonContext.js stands no questor met in a building (key 0).
`test/fb1003b_questor.test.js` builds every fixture from its producer: the Person and its hall through the setup chain
off a clicked NPC, every click by collectInteriorPeople + staticNpcData, the building stood in by the directory walk,
a party copy by the share envelope. `test/wd3_layoutPins.test.js` and `test/audit1003_wd.test.js` give their
hand-built sites the scope a declared Place parses to; `test/audit24_onehome.test.js` reads the name derivation's new
first arm. `03-World/Beautiful-Towns.md`'s exception is retired, Audit-WD3's "Not changed" bullet is struck, and
Port-Ledger WD3 departure (8) names the questor.

**Said, not fixed.** A town where neither the journal's building nor any named building holding the questor's faction
and look stands keeps the record, and the questor stays unreachable there; standing them as a quest flat at a marker
is the next step if that is ever met. The re-seated person is the mod's own person of the hall, who may wear another
look than the questor did. A questor met in a house (no named hall) is never re-seated. AUDIT PRE-MERGE 1003 D17's row
is history and says what was true then.

## VERMIN-SHARED (3)

`systems/quest/actions.js` sharedPickRoll, PickOneOf; `systems/quest/machine.js` the `sharedCopy` hook;
`scenes/questFoeHost.js` partnerStandsQuestFoes' `symbol` and `foes`, sharerFoeStands; `scenes/world.js` tryPlaceFoe's
two partner calls. The Exterminator (A0C00Y07) picks its vermin once, at the house (`pick one of _S.04_ _S.05_ _S.06_
_S.07_`, :139-140; "preventing multiple spawns by using static pick", :137), and spawns it every three minutes while
the player is inside (:150-168) - its `_house_` is any building, a Mages Guild hall among them. Each copy of a shared
quest rolled its own pick. The resync (`machine.updateSharedQuest`) takes the partner's task flags whole while the pick
stays complete, so two copies that rolled apart traded picks at every crossing sync - and a kill crosses every time,
because the sharer's copy counts its own foe's death and the receiver's counts the puppet's. Meanwhile QUEST-PARTY's
receiver counted its wave as placed whenever the sharer stood near, whatever the sharer's copy was standing. So after
the first spider the spider wave lived in the receiver's copy and was thrown away there, and the sharer's copy stood
the receiver's roll (bats) - or, with the sharer's machine paused by a window, nothing at all. Now a copy kept in step
with the party (its name shared, and it that name's live copy - AUDIT Q7) draws `sharedPickRoll`: the port's one
string hash over the copy's `shareId`, the task's symbol name and the action's place, through its one seeded die
(`wind.js` seededFirst). Every copy starts the same task. Solo, offline and a copy no longer kept in step draw DFU's
roll (PickOneOf.cs; Port-Ledger A, VERMIN-SHARED, online only). And the receiver defers only while its pool holds a live
foe of the sharer's for that quest and that Foe - a building's or the street's puppet in `puppet`, a dungeon's own-lane
puppet in `_ownFrom`; otherwise it stands its own wave, as CreateFoe.TryPlacement always places (CreateFoe.cs:183-212).
Solo play was never affected. THE FOUR HOSTS: world.js is wired (both arms); worldModes.js and dungeonContext.js are
reached through `insideFoes` and needed no change; exterior.js is FLAGGED - the dev host has no session, party or
share, and stands every wave. `test/fb1003b_vermin.test.js` runs the real machine, the real share path, the real
OnlineSession floors, world.js's lifted sync, seam and partner calls, and two real pools; before the fix it reproduces
the report - a spider, killed, then bats only. `test/questparty.test.js` and `test/questparty3b.test.js` re-aimed, and
`tools/mutants/questparty.json`'s QP-sharer-anywhere and QP-world-receiver-stands-its-own with them (still dead);
Port-Ledger's QUEST-PARTY phase 1 and 3b rows and `06-Systems/Online-Arc.md`'s wave sentences narrowed.

**Said, not fixed.** A kill can count twice: each copy counts the kills it sees, and the resync keeps the larger count,
so a partner's envelope already carrying a kill that lands before this copy's own credit for it (a puppet's fall)
counts that one kill twice - reproduced, the quest closed on two spiders; a clean fix carries each kill's identity in
the envelope, not a small change. A member outside the house keeps resetting the inside copy's wave timer: the `pc
at` flag ping-pongs through the resyncs, so with one member in and one out the waves come about two-thirds as often.
Two waves in one interval are possible - the two copies' wave clocks are each their own. And a pick re-drawn in a
shared copy (its task rearmed) draws its first number again; no corpus quest re-draws one.

## TOTEM-CAGE (4)

`systems/quest/sceneMount.js` sceneMarkerOf, sceneMarkerMover, rideSceneMarker, questStandBox; `world/actionSystem.js`
objectAt; `scenes/dungeonContext.js` questMarkerMover; `scenes/worldModes.js` the dungeon adapter's standItem,
standQuestFlatIn's follow and fill, questFlatTargets. S0000008 ("Who Gets the Totem") places the Totem at `_daggerfall_
marker 5` - DaggerfallCastle2, the city's dungeon, "hidden in the treasury". DFU stands a quest item at its marker's
layout point and then PARENTS it to the marker's scene object (GameObjectHelper.cs AddQuestItem :1144-1148, "This
ensures mobile quest objects parented to action marker translates correctly"): an RDB marker can carry an action of
its own (RDBLayout.cs:403-406), and GetDaggerfallMarker (:1165-1186) names the case - "raising treasure room cage for
totem in Daggerfall castle". The port registered the acting marker as a moving flat (ActionSystem.addMoveFlat) and
stood the Totem at the marker's start for good: the cage rose without it. Online that is permanent, which the report
read as "will Never reset": the cage's pose is an action record, the castle room's memory carries it (WORLD3/WORLD34)
and lands it on every joiner, the hour's respawn (WORLD8) renews foes and containers but never a mover, and the relay
forgets a room only thirty days after it drains - Castle Daggerfall never does. No other player took it: a quest item
stands on its own player's machine and is in no room's memory, and a reset would not have helped - the next raise
strands it again, offline too. The parenting is DFU's now: GetDaggerfallMarker's unique-or-null law over the laid
dungeon's 199.11/18 markers, by the ID both sides mint (block position + object position: the layout's `loadID`, the
quest marker's `markerID`); the ActionSystem mover registered for it, answered only when it moves; and the stand
riding the mover's live offset - its billboard's origin uniform (now, or when the texture lands) and its activation
box - so the Totem is where its marker is after the player's own trigger, a peer's act heard live and the room
memory's restore, in either order. THE FOUR HOSTS: `worldModes.js` (both adapters; the interior's records why a
building's item stands still - DFU adds DaggerfallMarker in RDBLayout alone and a building marker's ID is 0,
Place.cs:1503-1506) and `dungeonContext.js` (the mover) are wired; `world.js` and `exterior.js` stand no dungeon quest
item of their own (their mount routes through worldModes); the standalone `scenes/dungeon.js` stands no quest.
`test/fb1003b_totem.test.js` - S0000008's own lines through the real Place, Item and PlaceItem, the dungeon through
layoutDungeon, the motion through the real ActionSystem, the room's word through sharedRecord and validActionRecord.
`06-Systems/Quest-Arc.md` TOTEM-CAGE. The worldModes.js lines it moved were re-aimed across the bible and the tree by
`tools/citeShift.mjs`.

**Said, not fixed.** No ARENA2 here, so the castle itself is unread: which RDB object is DaggerfallCastle2's item
marker 5 (the treasury, by the quest's own words), its action (the test's PositiveY rise is a fixture) and what raises
it - a walk with the data (tools/castleProbe.mjs to the treasury, the marker's mover read against the Totem's stand)
should confirm it. The travel is read whole from the marker's start, which is DFU's outcome on its entry and its
load; a quest that hot-places an item onto a marker that already moved this visit stands it on the marker, where
DFU's reparent leaves it off by the travel (no corpus case known). A JS spread of a marker index past the list
(`place.js` _getSiteMarker) does not throw at the assignment where C# would; it throws later, at the mount - not this
report's fault, recorded. A player already in the treasury needs nothing repaired: the quest is untouched and the
Totem rides on the next entry.

## AETHERIC-MAKER (5)

`systems/enchanting.js` itemMakerRefuses, AETHERIC_TAKES_NO_ENCHANTMENT, enchantDecision; `ui/itemMakerWindow.js`
itemMakerFilter. DFU's maker refuses an item by what it carries - `AddFilteredItem` (:419-422) skips
`item.IsEnchanted`, `HasLegacyEnchantments || HasCustomEnchantments` - and has no artifact or quest-item check:
an artifact is out because it is enchanted. An Aetheric piece (`aetheric.js` mintAetheric) is the port's own tier,
and its header says it outright: it carries no DFU enchantment, its affixes and its sigil are its powers. So the
filter read it as a plain Daedric piece - the Gatecleaver's Battle Axe a Daedric 1575 points - and the maker laid
the player's enchantments over it (the report's card: the Regalia's +40% damage, +15 Strength and +30 Axe, then
Vampiric Effect, Potent Vs Daedra, Cast When Strikes and the rest). The port's other services already refuse it
(`reforge.js` salvageRefusal answers `'aetheric'`, reforgePrice null). Now the maker does too: an Aetheric piece is
out of every tab, and `enchantDecision` answers `{ kind: 'refused', text }` before DFU's ladder - so a selection
that never came off the list (a window open across the change, a probe) lays nothing on, renames nothing and takes
no gold. The line is the port's own. Every other item is DFU's: a Legendary, an Exalted, a signature drop and an
artifact are out because they carry enchantments, a crafted piece of jewellery keeps PROF10 J2's door.
`test/fb1003b_aethericmaker.test.js`, every fixture from its producer (the gate boss's spoils, the Sigil Broker's
Regalia ware, a raid's thanks).

**Said, not fixed.** A piece enchanted before keeps its rows - stripping a player's item on load is Mac's call
(`lootRarity.js` repairRarityNames is the precedent if it is wanted) - and AUDIT SET D3's fading rule
(`rarityTier.js` stampedTier) still answers for it. The wire's `validSetMarks` does not refuse an enchanted Aetheric
piece, for the same reason: it would make those pieces unreadable to the room.

## CABIN-HULL (6)

`scenes/world.js` csaSyncColliders, csaActivationPick, csaPeerActivationPick, csaActivate; the host's drawModeMeshes,
csaDrawParticlesBlended, extraBillboards and modeLights. A ship's cabin (SAILING-CABINS) is a building interior built
at her own root - `sailingCabinEntry` stands the bank ship's room on `trs(origin)`, the origin her
`GameObject.position` - and her fleet is kept afloat while her owner is below (`keepExteriorBoats`: the network keeps
its heartbeat). This host's indoor Come Sail Away arms read a boat active indoors as CSA-C's, a boat on a dungeon's
water that stands in the mode's frame. So the kept fleet was baked into the ROOM's collider (`csaSyncColliders` over
`csaModeCollider()`, and taken out of the street's), drawn in the room (`drawModeMeshes`, the peers' boats too) and
pressed from it (`csaActivationPick` in worldModes.js's tryExit ladder). Measured over the vendored Small Ship: her
decks stood in the room at +0.38, +3.48/3.64 and +6.77 m over her root, crossing the axis-aligned room at her heading -
the planks and holes of the report's second picture, things on the room's floor down between them - and a press on
her within 3.2 m opened her rows (the list arm answers every mode but the street's), whose Board and Take the helm ran
BoardBoat or StartSailing: the player stood on her deck with the mode still the building's - INTERIOR_CLEAR's black
round her hull, nothing else, the cabin's door under them and Enter cabin refused without a word (the access asks the
street's mode). That is the void. Now below deck the fleet stays outside: every hull, mine and every peer's, stays in
the street's collider (a visitor's way out lands on the owner's deck as the owner's does), no pick answers and no
press runs, and the host draws neither the fleet nor its quads and drops in the room, nor stands its crew and lanterns'
billboards there or lights the room with them. The same change shuts a second door: the deck the way out lands on had
gone with the room's collider, and the street's motor takes its first step before the mod's step stands any boat again
(world.js: player.update, then csaUpdate) - a 0.1 s first frame dropped a body through a Small Ship's bow (7.53 to
4.19 m measured). It is there from the first step now. `keepExteriorBoats` stays. THE FOUR HOSTS: world.js is the one
host with a cabin (fixed here); worldModes.js builds the room and asks these arms (unchanged); the standalone
exterior.js has no sailing runtime and dungeonContext.js no exterior fleet. `03-World/Come-Sail-Away.md`'s cabin
section says it. `test/fb1003b_cabinhull.test.js`: a deed ship from the real runtime, a peer's off a minted wire
record, the cabin and its landing from the shipped access, the real motor and collider, world.js's own functions
lifted from its source; `test/csa_together.test.js`'s, `test/prww1_werewolf.test.js`'s and `test/wb4_gate_boss.test.js`'s
source pins, five `fb1001b_peerboats` mutants, `prww1.json`'s PRWW1-modal-hook-narrowed-back and `wb4.json`'s
WB4-the-body-not-drawn re-aimed at the lines moved (each still dead).

**Said, not fixed.** A save taken in the void before this fix restores the cabin at the saved place - the deck's
height, over a room that no longer holds her deck; `/unstuck` in the chat takes the cabin's own way out (Return to
deck). Where the bank ship's room stands against her hull is inferred, not seen: SHIPAA00/01's interior is the
player's ARENA2 and none was here. And the bank-linked Transport path enters the cabin straight after its teleport,
before the pixels round her have streamed; streaming stays frozen indoors, so they come in after the way out.

Mutation lists: `tools/mutants/fb1003b.json` (AETHERIC-MAKER, 3, 3 dead), `tools/mutants/fb1003b_trees.json`
(TREES-SEATED, 18, 18 dead), `tools/mutants/fb1003b_cabin.json` (CABIN-HULL, 9, 9 dead),
`tools/mutants/fb1003b_totem.json` (TOTEM-CAGE, 14, 14 dead), `tools/mutants/fb1003b_questor.json` (QUESTOR-MOVED, 22, 22 dead), `tools/mutants/fb1003b_vermin.json` (VERMIN-SHARED, 18, 18 dead).

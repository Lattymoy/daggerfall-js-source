# FIELD BUGS 2026-10-05 - a crypt sold as a house; a cellar shut over a quest; the town mods' hills; a paralysis that outlived its death; the net on the sand; a dungeon's beds; the Matchmaker

The Discord's #bug-reports threads of 2026-10-04 and 05, handed over as eight screenshots with no other words. Each fix
below is pinned by tests that fail on the code before it, and its pins are mutation-checked (`tools/mutants/fb1005_*`).
Measured over the player's own data - the freeware ARENA2 fetched into a scratch directory outside the tree
(`tools/fetch-data.sh`), never committed - and, for the hills, a clone of the RMB Resource Pack's published files read
by `tools/rmbrpHills.mjs`, nothing of it kept. Nothing here was seen in a browser.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Opaldes: "I bought a house and only get the following message This house has nothing of value"; chimnaut: "the house inside the graveyard in wayrest"; "Wickcroft Tombs or smth"; "+1 on having a bugged house at a graveyard" | HOME2 made House5 a home, and the graveyard's crypt is a House5 whose room holds no model: 67 were for sale online, in 67 places | CRYPT-SALE |
| 2 | TheBard: "Can't access builing basement to continue quest" - "In tigonus" - "Can't do quest at all. Supposed to be stairs down" | Beautiful Cities shuts its cellars' stairs with a floor tile; The Possessed Child's child stood in GEMSAL00 #7's | SEALED-CELLAR |
| 3 | Arde: "this particular structure is frequently flying" (a gazebo on a stepped stone base) | the roadside taverns' TVRNAS03 stands gazebo 74088 on the RMB Resource Pack's hill 52025, and the port drew a mound a third its size | HILL-SHAPES |
| 4 | BrixBlox: "Paralysis time still continues after death" - "after dying to a ghost the paralysis effect still continued after respawning" | the online revival kept every effect but three drains; a Paralyze woke with every round it had | DEATH-HOLDS |
| 5 | GHAZ: "The Matchmaker side quest ... I accidentally went to the temple first ... the second quest npc just isn't there" | not reproduced: the route is legal in DFU's script and in the port; the likeliest cause, QUEST-MARKERS, shipped after the report's build | (below) |
| 6 | Ilvi: "Houses in Ipsham are floating" - "Whole crib is f up"; Дудоня#1, more of the same | Ipsham's TEMPASH3 stands its houses on hill 52758's plateau, 4.1-4.2 m up, and the port drew a 1.6 m mound | HILL-SHAPES |
| 7 | Ilvi: "The sea level hitbox is too high in some places" - "near Westhead Moor and walking near the beach" (Open Water under a crosshair on sand) | the net's law answers for a whole map pixel of the Ocean's region, and the cast stood wherever it held | SHORE-CAST |
| 8 | Izex: "Beds in dungeons should count as beds so I can rest in a dungeon" | the dungeon's online rest point was a fire alone | DUNGEON-BEDS |

## CRYPT-SALE (1)

`world/interiorLayout.js` (hasInteriorModels - AssignBlockData's refusal, DaggerfallInterior.cs:388-389, as a law the
layout and the market both ask), `systems/talkTopics.js` (locationBuildings and buildingDataForDoor stamp
`hasInterior`), `systems/onlineHomes.js` (homePurchasable). Measured: of Daggerfall's own 11,458 building doors (the packs add no such room), ten rooms cannot be
entered - six crypts (`GRVEAS05` #19, `GRVEAS09` #11, `GRVEAL09` #11, `GRVEAM09` #11, `GRVEAM05` #19, `GRVEAL05` #0, the
only House5 records with a door) and four House2 rooms VOID-ENTRY refuses (placed in no town). The crypts stand in 67
places with a door and a price online (24,600-67,600): Wayrest's `GRVEAL09` #11 (key 66059), Fontgate Hollow's, the
Wickcroft Tombs' `GRVEAS09` #11 (key 11). DFU never sells one - GetHousesForSale takes HouseForSale and House1-4
(BuildingDirectory.cs:156-184), which the bank and the Knightly Orders read, and the port's bank and order lists hold
none; the online market's door was the only seller. Entering one fails in DFU too, in the same words. A room that cannot
be laid out is not for sale now; homeCandidate is unchanged, so a crypt already bought stays its owner's home - the
plaque says so and its "Sell it" row pays the 85% (HOME_SALE_SHARE). **A full refund is Mac's call**: the account
service reads no game data, so it would need the 67 (mapId, buildingKey) pairs. THE FOUR HOSTS: the door's offer is
worldModes.js's (world.js and exterior.js build it); dungeonContext.js sells no home. HOME2's House5 widening sells
nothing now - the six crypts were the only House5 records with a door (House6: CUSTAA05 #0 and #1). The account
service does not check the room: a tab opened before the deploy, or a desktop build not yet updated, can still claim a
crypt until it reloads (AUDIT FB1005 C1, stood - the 67 pairs the service would need are the refund's list too).
`test/fb1005_cryptsale.test.js` (6); `tools/mutants/fb1005_cryptsale.json` (10, all dead); `home1.json`'s two records
the change moved re-aimed by content.

## SEALED-CELLAR (2)

`tools/townQuestMarkers.mjs` (HATCH, hatchesOf, measureInterior's sealed arm; clearSpot's floor test),
`systems/quest/markerCuration.js` (CURATED_QUEST_MARKERS). The Possessed Child (C0B00Y02, `local house2`) stands its
child at the house's 199.11. Beautiful Cities lays Tigonus (Dak'fron, location 54) again; in its GEMSAL00 #7 the one
199.11 is 3.15 m down in a cellar whose stair (40018, the rail 6700 and posts 62319 - the "wooden frame" in the
screenshot) the author shut with a floor tile laid over its head (1000, its ceiling 2000 under it), a rug on top
(69471 - the port's stand-in, brown with a red lozenge) and its pair (69472) turned over beneath, facing the cellar. Every such hatch is marked with the editor's 199.14 over the
plug and 199.13 at the other side - numbers no interior of Daggerfall's own BLOCKS.BSA carries and DFU does not read. DFU lays the plug as
the port does (AddModels places every record), so with the mod DFU's child stands in the sealed cellar too; the floor
is sound, so QUEST-MARKERS' ray passed it. The tool lists a marker the entrance's walk does not reach and the walk from
a hatch's far side does, its spot the floor nearest the hatch's near side (with THE RAY's floor under it, and 1.5 m off the room's entrance -
AUDIT FB1005 S1: TEMPASF0 #7's foe stood 0.95 m from the door): 14 designs,
128 buildings, 14 markers - eleven cellars and three lofts. Tigonus holds 21 buildings of the list. The committed list
is the measure again (`--check`: 20 designs). **Not built: a hatch that opens.** The author's markers name both sides,
and the investigation sketched one (an activation that moves the player across) - the port's own mechanic, so Mac's
call; the curation makes every quest of the 128 doable meanwhile. THE FOUR HOSTS: as QUEST-MARKERS (worldModes.js's
interior adapter; world.js's load mend; dungeonContext.js unaffected). If a hatch that opens is ever built, these
fourteen entries retire with it. `test/fb1005_sealedcellar.test.js` (7);
`test/fb1004d_questmarkers.test.js` (its counts moved, its gated measure accepts a sealed marker, its building-type read
taught a file that edits the classic list entry by entry - KSCAAL01); `tools/mutants/fb1005_sealedcellar.json` (11, all
dead - three only with ARENA2_PATH).

## HILL-SHAPES (3, 6)

`world/rmbrpHillShapes.js` (new: RMBRP_HILL_SHAPES, SHAPE_BEARINGS, SHAPE_RINGS), `world/townStandIns.js` (RMBRP_HILLS
the surfaces alone, hillMesh), `tools/rmbrpHills.mjs` (--shapes; the table mode measures the drawn stand-in against the
pack). Ipsham is Menevia's location 110; Beautiful Villages' grid stands its new TEMPASH3 at cell (0, 1), whose houses
(127, 129, 201) and temple (402) the author stood on hill 52758's plateau, 4.13-4.22 m up, and its T-dock at the
water. The gazebo is ARCH3D 74088 (a six-sided stepped base 5.2 m under its origin, columns and a flat roof, Dibella's
statue 97_13 on pedestal 51111); TVRNAS03 - 283 of the packs' grid cells - stands it on hill 52025 with its base buried
as authored. The location's plane is DFU's (measured: 640.249 m under every drawn sample of Ipsham's rect, the origin
640.299 m); DFU stands these models at the author's heights (RMBLayout.AddModels / AddMiscBlockModels read no terrain)
on the pack's hills, and the port drew the catalogue's mounds - 3, 6 or 10 m in radius, 0.6-3.5 m high - where the
pack's reach 5-47 m and stand 1.4-16 m (TREES-SEATED said the mounds, not fixed, 2026-10-03b). Each hill is a polar
profile measured off the pack's mesh as Unity imports it (x mirrored - the orientation all 40 authored trees of
TVRNAS03 and TEMPASH3 sit on within 0.75 m): the raised footprint's centre, 16 bearings, each with its reach and ten
rings' heights, each the median of the pack's surface in its cell; the rim the mesh's base, under the plane. Drawn, it is
0.03-0.32 m from the pack's surface at the median per hill - the 90th percentile 1.05-1.34 m on the four lumpiest
(52548, 52508, 52458, 52638), and the median fills the pack's hollows: over 15.4% of 52548's raised ground the
stand-in stands more than 0.5 m over the pack (up to 2.51 m), 4.4% of 52458's and 52508's. Ipsham's houses stand on it
to 0.08 m (they hung 4.1-4.2 m), the gazebo's base is in its hill, and over both packs no classic model the author stood
up on a hill hangs a metre over the stand-in (before: five blocks, 513 grid cells, up to 7.55 m - TEMPASH4's 43715).
What the median's hollows cost, found by the audit: a DET sheep in RESIAS04 stands 0.64 m into the stand-in (the pack
leaves it 0.09 m over), a vertex of TEMPASH3's 40719 1.14 m under it, one foot of TEMPASD1's 21728 1.08 m over it; the
hill's foot meets the plane at a grazing angle over 4-81 m2 a hill, which may z-fight far off (the pack's mesh in DFU
meets it the same way). A door: Beautiful Villages' TEMPASD1 stands its House2 #6 (model 159) inside hills 52458 and
52713, under 10.1-10.4 m of the stand-ins and 10.5-11.2 m of the pack's own meshes - DFU with the pack buries it too;
the old mound did not reach it (AUDIT FB1005 T3, carried in `test/wd3_standins.test.js`, Mac's call). 12 bearings by 8 rings left one prop 1.9 m
up, so 16 by 10. TREES-SEATED's seat reads the drawn triangles, so the 130 trees follow: 1 hangs more than 1.5 m, where
121 did - and the dozen nature flats the author left on the plane under a hill, which the pack's hill buries, stand on
its slope now (AUDIT FB1005 H4). **A peer-derived measurement - and a larger one than the docks' and the domes'**: nothing of the pack's file is carried,
but 23 hills x 179 numbers (4,117) are read off it, a 16 x 10 heightfield that keeps each sculpt's footprint; the
meshes are `CPT_Mountain_*` .blend files and the pack's manifest names its authors "Asset creators (maintained by
carademono)", with no licence file in the clone. Mac's call (AUDIT FB1005 H3).
THE FOUR HOSTS: the stand-ins are the pipeline's (customModelFor) for every host that stands a town block - world.js,
exterior.js; worldModes.js's rooms hold no hill; dungeonContext.js stands none. `test/fb1005_hills.test.js` (5, two on
ARENA2_PATH: Ipsham itself, and both packs swept); `test/fb1003b_trees.test.js` (121 -> 1) and `test/wd3_standins.test.js`
(the hills' sizes; a door walled by a hill's surface, not its box) re-aimed; `tools/mutants/fb1005_hills.json` (9, 8
dead, 1 recorded equivalent).

## DEATH-HOLDS (4)

`systems/deathRespawn.js` (DEATH_HOLDS, endDeathHolds, reviveForPlay). DFU's death wipes every bundle (PlayerEntity.cs
:1199-1213 raises OnDeath; EntityEffectManager.Entity_OnDeath :2163-2167 sets wipeAllBundles; WipeAllBundles :772-779).
Offline the port's death is DFU's (a load). Online the revival is the next life, and DEATHLOOP1 ended its three drains
and said "Paralysis is kept ... it does not drain anything, and it wears off" - but it does not wear off across a death:
the death screen holds the tick and skipDeadMinutes runs no magic round, so a ghost's Paralyze woke with every round it
had, beside the ghost (a Resurrect where one fell, Privateer's Hold in place). The revival ends the paralysis, the
Wraith's silence and the fatigue and magicka drains (a fatigue drain defeats DISC28-E's floor). The KEPT list stands -
a disease and an infection are not cured by dying - and a living release ends nothing. THE FOUR HOSTS: every revival is
reviveForPlay's (world.js's respawn and Resurrect; worldModes.js's interior screen and Privateer's Hold;
dungeonContext.js through worldModes.js); exterior.js ends the run. `test/fb1005_deathholds.test.js` (5, the effects
minted by applySpell); `test/deathloop1.test.js`'s comment retired; `tools/mutants/fb1005_deathholds.json` (8, all dead).

## The Matchmaker (5) - not reproduced

The quest is A0C10Y05 (byte-identical to DFU's). Its betrothed is placed at a `remote house2` at start-up and hidden
only on being clicked; the temple's `pc at` only spawns its two warriors; a priest clicked early is re-armed
(`_clearclick_`); success wants both in either order. So the temple first is a legal route in DFU too. Driven through
the real QuestMachine over the real script (temple first, leave, a day on, the house): the betrothed stood in its
house, linked, through a save and a load's reseat, across four seeds and with both sites in one town. The likeliest
cause is the one QUEST-MARKERS fixed - 402 of the town packs' House2 interiors stood a second person marker 3.75 m under
the floor and 267 their only one in the attic - which reached main at 17:58 UTC on 2026-10-04, the report's build
probably before it; a load on the current build moves the marker (`Place.mendCuratedMarkers`). What to ask the player:
the build's date, the town, online or in a party, the console's `[quest]` lines or the save. No change made.

## SHORE-CAST (7)

`scenes/fishHost.js` (looseNodesOf asks `host.waterAt` at the cast's point), `scenes/world.js` (the fish host's
`waterAt`: `groundSampleAt` - playerGroundSample's read at any scene point - and MAC2's `feetWaterCoverage >=
SWIM_COVERAGE`). Westhead Moor is a city at map pixel (207, 223); the pixels north and west of it are POLITIC 64 - the
Ocean's region 31 - and the net's law (foragingLaw.js netHasWater) holds anywhere on them, so the Open Water target,
which stands 3 m along the look, stood on 20,321 m2 of dry ground north of the town (up to 31 m above the sea; beach
dirt to 78.5 m from it, grass to 141.9 m) and on the dry half of every shore record. Measured on the player's data through
generatePixelTerrain. The cast stands only over water the feet would swim in now; ground not built is not refused; a
cast already flying keeps its node when the look swings onto the bank. The swim and the water walk were never the
fault (they follow the drawn coverage since MAC2). THE FOUR HOSTS: the gather host is world.js's alone.
The audit (AUDIT FB1005) found two holes: a cast the gathering host DROPPED (a window, a door, the helm) was
never ended, so its exemption kept the sand a target until the next cast finished (W2 - `gatherHost.js` ends a dropped
act now, as at every other drop); and the exemption began at the WIND, so a look turned onto the sand while E was held
threw the net there (W3 - it begins at the throw). A throw lands 3-12 m out and only the 3 m point is asked, so a long
throw across a narrow inlet may land on the far bank (stood). `test/fb1005_shorecast.test.js` (5);
`tools/mutants/fb1005_shorecast.json` (10, all dead); MAC2's source pin (`test/roadb_exterior_water.test.js`) re-aimed at
`groundSampleAt`.

## DUNGEON-BEDS (8)

`systems/restAct.js` (bedInReach), `scenes/dungeonContext.js` (dungeonBeds collected in the placement loop; restKind
and restPoint). REST1's rest point online is a fire, a camp, a tent or a bed; the Rest-Arc wrote its beds for the rooms
DFU rests in, and the dungeon host's point was `camps.restPointAt` - fires alone - so the 108 bed placements of 42 RDB
blocks (in 2,056 of the 4,232 dungeons) said "Find a fire or a bed to rest." A bed within a fire's reach (BY_FIRE_REACH,
4 m to its box's nearest point) is a bed's rest point now, priced as a bed, and a bed pressed below deck (CSA-J's
`_restFromBed`, which restPoint never read) is one too; the enemies-near gates and the night's interval are unchanged.
The audit (AUDIT FB1005) narrowed it: on the bed's own floor (B4 - five beds were in reach from the storey above or
below), none in a palace (B3, AUDIT REST II F2's own predicate - Castle Daggerfall's and Sentinel's beds), and a bed's
night spends no Bedroll or Campfire laid beside it (B1). Offline the hosts' restKind reads it too, so in Hard a rest
beside a dungeon's bed is priced as a bed's (B2 - SURV4's "a bed is the sleep", kept); an elite dungeon halves its
fires and keeps every bed.
The reply in the thread ("That Torch to the right you can click on to rest like a campfire") holds only for a brazier
(210_20) - HEARTH1 counts no wall torch. Not built: a dungeon bed is no click target (Roleplay Realism's activation;
AUDIT-RR named "beds only in buildings"); the rest key and the rest window find it. THE FOUR HOSTS: dungeonContext.js
wired; worldModes.js's rooms rest anywhere already; world.js's beds are a ship's; exterior.js stands none.
`test/fb1005_dungeonbeds.test.js` (3, 108 beds in 42 blocks on ARENA2_PATH); `test/rest1_act.test.js` and
`test/surv4_rest.test.js`'s and `test/rest6_consumables.test.js`'s source pins and `survtiers.json`'s record re-aimed;
`tools/mutants/fb1005_dungeonbeds.json` (11, all dead).

## Integration

Built in one branch off main at `ca4b0760`. Every cite the changes moved was re-resolved by `tools/citeShift.mjs`
against main (184 moved, each content-checked); the struck Ledger and Settings-Screen-Spec cites CD4 gates were moved by
hand to the tool's mapping, each checked by content, the other struck rows keeping their numbers; chargenSession.js's
`overlayHover` cite (CD8) re-aimed by content.

## Not verified here

- Nothing was rendered or played: no browser, no GPU, no online room. The hills were measured as triangles, not seen;
  their grass and rock texture wraps the larger mesh at the old 4 m a repeat.
- CRYPT-SALE needs no service deploy; a refund of crypts already bought, or a refusal the service makes itself, does.
- SEALED-CELLAR's spots were measured through the port's own layout and stand-ins, not in Daggerfall Unity.
- The Matchmaker report stays open until the player answers.
- The audit of this batch: `01-Overview/Audit-FB1005.md` (AUDIT FB1005).

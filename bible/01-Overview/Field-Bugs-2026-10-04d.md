# FIELD BUGS 2026-10-04d - the town mods' quests, walls and rooms; a camp cap that locked players out; a knight's house for sale; a book that would not shut; giants in crates; the GPU's memory

The Discord's reports of 2026-10-04, handed over as screenshots with: *"So the integration of beautiful cities and
beautiful villages really messed up a lot of quests, left a lot of weird geometry and I really want to audit to fix any
issues. Along with the following bugs"* - four reports, then six more while the work ran. Each fix below is pinned by
tests that fail on the code before it, and its pins are mutation-checked. The town mods are carademono's Beautiful
Villages and Beautiful Cities (WD3, `03-World/Beautiful-Towns.md`). Written as 2026-10-04b on its branch; main's own 04b
(the companions) and 04c (WHERE-ROBES) merged first, so it is 04d (Integration, below).

Two audits ran beside the fixes - the quests (read-only, then fixed: QUEST-AUDIT below) and the towns' geometry (with
CITY-WALLS). Both measured over the player's own data: the freeware ARENA2 fetched into a scratch directory outside the
tree, never committed (its `test/wd3_pack.test.js` sweep rebuilt all 8,547 of both packs' files sha256-exact against
it, so it is the data the packs were built over). It held no TEXTURE files, so nothing here was rendered.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Unable to sleep in the wilderness due to too many camps being left behind"; "Locked out of placing Tents and Campfires because I lost too many Tents in the overworld" - "You have enough camps standing already." | four camps left anywhere refused every later placing, for good: the save carries every camp, and none burns away (REST2) | CAMP-CAP |
| 2 | "my letter says for me to steal priests Robes from Hawkton residence and i did it ... i didn't get the letter" | the quest is sound; its Priestess Robes stood in the house nameless under the crosshair while the wardrobes were named, and the player took a wardrobe's Priest Robes | QUEST-ITEM-NAMED - main's WHERE-ROBES (04c) landed it first |
| 3 | "Entering a house sent me to the void" (Warvale Village); "Complete darkness and possibly stuck" (a lockpicked house) | the town mods keep a building's own exterior model in its room, door facing out; DFU's landing chose it and stood the player over nothing | VOID-ENTRY |
| 4 | "small chunks of walls seem to be missing in some cities ... I was stuck inside invisible walls after investigating the hole in the wall" | CITY-WALL's corner holes (posted before it merged); Daggerfall's wall is hollow, and the hole let the player into it | CITY-WALLS |
| 5 | "After long plays there are consistent GPU memory leaks"; "world instances are cached ... never dispose of them" | each place freed its own; what places SHARE - models, pictures, ground tiles - never went | PLACE-LRU |
| 6 | "Vital quest enemies stuck in dungeon crates" | a crate is a closed model and the collider's push is facing-blind; a marker inside one, and SEARCH1's spots, stood foes in it for good | CRATE-FREE |
| 7 | "When using this item, the screen froze; no other key would close it" (the Hall of Records of Hearthton Manor) | a close asked while the book rose was dropped, and its latch refused every later one | BOOK-RISE |
| 8 | "Houses earned through Knightly Orders still possibly purchaseable?" - "To Arde's residence", "Buy it: 554330 gold" | the order's house was a deed in the save alone: its knight was offered it, and another player's claim took it | KNIGHT-HOUSE |
| 9 | "Disappearing Horse? It's there but it gets culled on its right side" | not reproduced - the cart's horse culls correctly; every walking sprite's cull sphere was its birth size | CULL-SIZE |
| 10 | (the audits) | the quests the town mods broke - unreachable markers, house-less temples, a re-seat that turned a house into a shop, quick loot that never told a quest - and two stand-ins off their pack's own law | QUEST-AUDIT (RESEAT-DECLARED, RESEAT-GAPS, QUEST-MARKERS, TEMPLE-HOME; LOOT-CLICK landed first on main as ROBES-CLICK), CROPS, DOMES |

## CAMP-CAP (1)

`systems/survival/camp.js` (placeCampItem's `strike`, strikeCamp, CAMP_TEXT's three struck lines - `tooMany` gone),
`scenes/camps.js` (placeItem, strikeOldest). Reproduced on the real modules first: four camps saved, a new page loaded,
a fifth placing 9 km away answered "You have enough camps standing already." placeCampItem refused at
`CAMPS_PER_OWNER` (4), counting every camp of the player's in the world host's pool - and that pool holds them all,
wherever they stand: the streaming sweep spares them, every save writes them (and a dungeon save's `outerCamps`), every
load stands them all again as the player's own, and since REST2 none burns away (a cold Campfire is "cold, not gone",
Rest-Arc 3). Online the save is the realm checkpoint; a cell camp rides its owner's foes frame and the relay keeps
none; a dungeon room's memory holds the room's own fires, packed on the way out. So four camps left anywhere locked a
character out of camping until they walked back to one.

A placing at the cap is never refused now: one that every other rule lets stand strikes the owner's OLDEST camp - the
first of its own in the pool, which keeps placement order (a placing appends; a load and a teleport stand the save's
rows in the order the pool wrote them) - packed where it stands as the menu's Pack packs it: the tent's Camping
Equipment with its wear, a Campfire with its charges, a fire with no fuel of its own (an Ember Jar's) nothing. One line
says it: "Your oldest camp is packed away." / "Your oldest Campfire is packed away." / "Your oldest fire is put out."
Then the new camp stands and the room is told once. A placing refused for any other reason strikes nothing. Existing
saves heal on the first placing.

No item twice: the strike is the same synchronous act as Pack, in the player's own pool - the camp dropped, the gear
into the pack, then one publish - so no save holds both halves (loading the save before the strike rewinds both), and
every other copy (a cell peer's, a dungeon host's memory) is a view of the owner's word that only the owner's pool can
pack: a peer drops it on the owner's next full frame, a room's memory forgets it at its next publish. World camps are
never in a room's memory, and a dungeon pool's fires are struck from inside that same room. Decay was weighed and
refused: it unlocks nobody until a timer passes, takes or returns gear unasked, and breaks REST2's "cold, not gone".
Not built: a map mark for one's camps, a pick-up when attacked, an abandon command - the strike leaves none of them
needed to camp again.

The four hosts: `scenes/world.js` (its pack and hotbar place through `camps.placeItem`; its onChanged asks the full foes
frame) and `scenes/exterior.js` (the same placeItem; no save, no room) wired; `scenes/dungeonContext.js` wired (its own
pool and pack doors; its onChanged the act); `scenes/worldModes.js` unaffected (a building's placing is refused for being
indoors before any strike). The dungeon's own campfires (`world/dungeonFires.js`) and the world's hearths (HEARTH1) are
not in the pool and are never struck. `test/fb1004d_campcap.test.js` (5: the law; the brick - four saved camps, a fifth
placed, the oldest's gear home once; no item twice over nine placings at the cap; online - a cell peer, a dungeon host's
memory, a joiner, a stale memory; the four hosts by source); `test/surv3_camps.test.js`'s cap pin re-aimed to the new
law. `tools/mutants/fb1004d_campcap.json` (21, all dead); the 113 older records aimed at the two camp modules re-run -
110 dead, 3 equivalent as recorded.

## QUEST-ITEM-NAMED (2) - landed first on main as WHERE-ROBES (FIELD BUGS 2026-10-04c)

The same report reached main and was fixed there before this branch merged: `01-Overview/Field-Bugs-2026-10-04c.md`
(WHERE-ROBES). Its ROBES-NAME is this branch's QUEST-ITEM-NAMED - both hosts' quest-stand namers read `daggerfallItem ??
item`, which no Item resource has, so every quest item a building or a dungeon stood was nameless under the crosshair
while the wardrobes beside it were named - and it found one cause more, ROBES-PRESS: the press raced a building's
furniture by its whole box, so robes on a mattress or a shelf could not be picked up at all. At the merge of main this
branch's copy (`worldTooltips.js` questStandName and the two namers) was withdrawn for main's (`questStandItem`), with
its pins and mutants; main's `test/fb1004c_robes.test.js` holds the law.

Kept from this branch, as the record's regression pins (`test/fb1004d_questtrace.test.js`, 2): the trace - O0A0AL00 on
the real parser and machine in Beautiful Villages' Moorham Manor (Shalgora), the robes standing at the farmhouse's own
199.18 item marker and the click handing them over with message 1018 and the note - and where the robes on the
reporter's paperdoll came from: a wardrobe mints clothing by the PLAYER's gender (StockHouseContainer,
CreateRandomClothing), Priest Robes (164) for a man and Priestess Robes (201) for a woman, while `womens_clothing` is
women's clothing for every character, so Priest Robes are no record O0A0AL00 can mint.

## VOID-ENTRY (3)

`player/enterExit.js` (interiorLanding's `standsAt`, standsOnFloor, interiorVoidRescue, standFromVoid),
`scenes/worldModes.js` (the building's transition). One cause behind both reports. Both town mods keep a copy of the
building's own EXTERIOR model inside its room, its door facing out as every exterior door does. Where that door is the
interior door nearest the enter marker, TransitionInterior's landing (PlayerEnterExit.cs:735-760: the door + its normal
* 0.75) stands the player outside the room's one-sided shell, over nothing; floorLanding finds no floor and hands the
body to gravity, and a building's collider has no ground - so it falls for good, with no door in reach, nothing to
light, and the HUD still drawn. No failsafe caught it (the landing's throw fires only for a room with no door and no
marker; `/unstuck` must be typed), and a building that failed to lay out said nothing where DFU says "This house has
nothing of value." (PlayerEnterExit.cs:719-730). Measured by entering every exterior door of every block with the
player's data: 146 of the packs' 10,309 entries landed over nothing (villages 54 of 2,805, cities 92 of 7,504) -
Warvale (location 17-842) lays `GENRAS00`, whose houses #1, #2 and #7 all did - and 18 of Daggerfall's own 11,452. The
lockpicked house was not named, and is matched to this cause by its signs.

Each of DFU's two arms takes only a spot with a floor under it now, in DFU's own order: the doors nearest the enter
marker, then the markers nearest the street's door, lifted 1.08 - so no landing DFU makes on a floor moves (0 of
21,597), and one over nothing goes to the nearest that stands. A room with none is refused in DFU's words and the player
stays in the street; a build that throws says the same, unless the world moved under it; and a body ten metres under the
room's lowest triangle is stood back at its door with "There was no floor beneath you. You are back at the door." The
quest audit's two shapes, checked: the House2 design it listed with no enter marker (`TVRNAS03` #4, `PAWNAM02` #9,
`RESIAS02` #5, `DARKAA00` #8 among nine) carries the 199.4 rest marker DFU counts as one (DaggerfallInterior.cs:242-246)
- all nine landed over nothing before and on a floor now; an enter marker in the void or in geometry only picks the door,
and the packs' never leaves the landing over nothing. Of Daggerfall's own blocks, 12 of its 16 such rooms now land on a
floor and four are refused (`ALCHAS01` #1, `LIBRAS00` #4 and #8, `BOOKAS02` #5) where DFU drops the player into the
void - a departure (Port-Ledger, Ledger A). The four hosts: `scenes/worldModes.js` wired (the one door into a building);
`scenes/world.js` and `scenes/exterior.js` through createWorldModes; `scenes/dungeonContext.js` has its own landing and
no void failsafe. `test/fb1004d_voidentry.test.js` (10: nine over the real packs, one sweep on the player's data);
`test/fb1001b_vampsun.test.js`'s stub tavern given a floor (a room of nothing is refused now);
`tools/mutants/fb1004d_voidentry.json` (24, all dead). Not changed: DFU's marker lift (AddFlats) needs `TEXTURE.199`;
seven of DFU's floored landings stand 0.05 m inside geometry; a throw after the room is set up; six graveyard blocks that
fail to lay out ("No interior 3D models") now say DFU's line.

## CITY-WALLS (4) - and the geometry audit's CROPS and DOMES

No hole is left in any city's wall. The report's holes were CITY-WALL's (FIELD BUGS 2026-10-03c): posted at 23:09 UTC on
the 3rd, three hours before #575 merged. From the packs alone, all 628 wall lines of the 400 wall blocks are covered edge
to edge; with the player's data through the port's own loader, all 410 rings are shut with no open end, each of the
1,266 corner pieces is the middle of a `445` with nothing on its cut faces, `WALLAA04`'s subrecords (476 references) are
plain unturned `445`s, and Daggerfall's own corner towers reach exactly 448 from where their lines cross.

The invisible walls: Daggerfall's wall segment `445`, its gates `446`/`447` and its tower `444`'s arms are HOLLOW - below
the walkway each is two long faces and no ends. Through a corner's hole a player walked into the corridor inside, which
runs on through every segment and tower; every face there is seen from behind, which the renderer culls and the
facing-blind collider does not, so the walls held unseen. CITY-WALL's stand-in meets the arm and the segment with the
same cross-section, so the corridor has no opening left. Checked clean: the gates' passages are lined; the colliders
match the drawn meshes in both exterior hosts; a stand-in with no mesh is neither drawn nor collided; the House5 boxes
have no size; the terrain flattens as Daggerfall Unity flattens it. The author's farms stand inside the ring and reach
at most 50 units into a wall piece (house `215` in `WALLAA06/12/13.FARMAA01`; fence `518` 27; windmill `41600` 3 off the
face) - as Daggerfall Unity places them, recorded and unchanged. `test/fb1004d_citywalls.test.js` (three over the packs,
one on the player's data); `tools/mutants/fb1004d_citywalls.json` (5, all dead).

**CROPS** (`world/flatFields.js` sowField, cropRecordsFor, blockSolids, CROP_OVERLAP_RADIUS; `world/rmbFlats.js`;
`world/rmbLayout.js`; `scenes/world.js` and `scenes/exterior.js` hand the climate and the block's solids). The crop
fields' stand-in had drifted from the RMB Resource Pack's own component (RMBCropBillboardBatch) in six ways: the grid
runs over C#'s integer halves (-42 to 42 for an 85 m field, not -42.5 to 41.5); it is laid in the world's axes, the
batch's turn never read; no plant within a metre of the block's models (IsOverlapping, overlapCheckRadius 1); each
plant at the field's own height; each a random record (GetRandomRecord), not the climate's taken in turn; the second
desert its own record, 20. Measured: 30,503 of 6,195,788 plants refused, over 33,497 fields in 4,290 towns (19 of them
in the second desert). Not copied: the component gives every plant the last record's billboard size. Some 144,000
plants stand inside the hollow walls, more than a metre from any face, as the component's own check would sow them -
unseen with every ring shut. `test/fb1004d_crops.test.js` (7); `tools/mutants/fb1004d_crops.json` (16, all dead);
`test/wd3_standins.test.js`, `test/fb1003b_trees.test.js`, `test/natureground.test.js` and fieldgun20's FIELD-GUN20-7
follow the new law.

**DOMES** (`world/townStandIns.js` DOME_UNIT, DOME_PROFILE, DOME_SPIRE, DOME_BANDS). The three domes (`53182`, `53187`,
`53194`; ten placements, on gem stores', markets' and pawnshops' roofs) were a 3.6 m cap over a drum sunk 1.2 m into the
roof. They stand at the pack's own profile now, measured off its HF Dome 03 and 04 meshes at the prefabs' 4.6875: an
octagonal drum 4.8 m across on the origin to 3.63 m, the dome to 8.43 m, 03's spire to 10.75 m, each band the picture
its prefab names. `test/fb1004d_domes.test.js` (5); `tools/mutants/fb1004d_domes.json` (7, all dead).

The four hosts: `scenes/world.js` and `scenes/exterior.js` wired (the fields' climate and solids); `scenes/worldModes.js`
and `scenes/dungeonContext.js` sow no exterior field and stand no dome or wall. Not changed: the collider ignores
facing, so any hollow model with an opening would hold a player the same way.

## PLACE-LRU (5)

`scenes/placeHolds.js` (new, pure: createPlaceHolds, PLACES_KEPT), `scenes/dataPipeline.js` (holdPlace, keepPlaces,
placeStats; the ordinary doors pin), `render/renderer.js` (evictTexture, evictEmissionTexture, releaseTileArray, the
upload sink, the draw's miss door), `scenes/world.js`, `scenes/worldModes.js`, `scenes/interiorContext.js`,
`scenes/dungeonContext.js`. The player was half right. What a place builds for itself alone already went with it - a
streamed pixel's terrain, merged statics, flats, water and tilemap (destroyPixel), a building's and a dungeon's batches
(their contexts' destroy()). What places SHARE never went: the renderer's pictures and emission maps (every model's
materials and every flat's frames - up to about 245 MB over the classic corpus, gigabytes with texture packs), the data
pipeline's models (`gpuMeshes`, whose own comment said "never destroyed", about 30 MB, and their CPU copies, about 30 MB
more), and the ground's tile arrays (about 10 MB classic, about 78 MB an archive with terrain mods). Every town, climate
and dungeon visited stayed on the GPU for the session: on the real Renderer and data pipeline over a counting WebGL2,
48 places kept 49 models, 146 pictures, 48 tile arrays, 50 VAOs and 197 buffers, and the count grew with every place.

Each place now HOLDS what it asks for, a model holds the pictures its own build uploaded, and what is asked for outside
any place (the UI, the foes outdoors, the arrows, the wagon, a mill's parts, the fixed city) is pinned - kept, as
everything was. A place that goes is kept warm on its kind's shelf - one view of pixels ((2 * terrainDistance + 1)^2,
49 by default), four buildings, two dungeons - so a walk back over a pixel's edge or a step out of a door and back in
rebuilds nothing; past that the oldest is dropped and what nothing holds and nothing pinned is freed. The places in view
are live and never dropped: the player's "minimum set for chunks visible by viewing range" is the view itself. A freed
model is made inert, a picture a place let go that something outside it still draws (a foe outdoors drawing a frame a
dungeon uploaded) is made again at the draw, and nothing is freed mid-draw (a sweep runs only as a place goes, settles
or the keep changes). The tab's close was already handled: GL-LEAK (2026-10-03) loses the context on `pagehide`, a
bfcache restore excepted. The four hosts: `scenes/world.js` wired (each pixel's build holds through its hold, released
in destroyPixel and a failed build's ledger, settled once published; the pixels' keep is the view);
`scenes/worldModes.js` wired (a building's and a dungeon's hold, handed to their contexts, which settle once built and
release last in destroy()); `scenes/dungeonContext.js` wired; `scenes/exterior.js` unaffected (its one city through the
pinned doors; its buildings and dungeons through worldModes). `test/fb1004d_placelru.test.js` (10: the same census at 12
places and at 48, what live places draw, shared and pinned things, a revisit, the keep and the settle, the miss door,
the stamp, the hosts by source); `tools/mutants/fb1004d_placelru.json` (47, all dead); perfextb's PERF-EXT11-5
re-aimed. Still kept for the session, bounded by content: the frames the hosts' own lazy doors upload (outdoor foes,
townspeople, peers), the UI's art, the tents', wagons', arrows', decor's and mills' parts, Seasons of the Iliac Bay's
flats (uploaded straight to the renderer), and the pipeline's CPU texture files.

## CRATE-FREE (6)

`characters/foeSpacing.js` (lodgedIn, bodyFits, clearPast, freeLodgedFeet), `scenes/dungeonContext.js` (buildFoeAt's two
arms, patchFoe, searchFoeSpots' clear line), `scenes/exteriorFoes.js` (spawnFoe). A dungeon crate is a model (41815 to
41834: five one-sided faces, no bottom, 0.3 to 2.1 m tall), solid as DFU combines it, and the collider's push is
facing-blind: a body whose centre stands inside a closed model is pushed back in by the model's own walls for good.
DFU's foe is not held there (Unity's sweep reads no back face - ROCK-FREE's law - and its controller depenetrates). No
stand asked: a marker's foe landed on the floor inside the crate, the pool every other host stands through kept the feet
it was handed, and a restore put saved feet back as they were. And SEARCH1's spot picker drew its clear line from the
searched object's centre 0.9 m up - inside any crate taller than that - so the crate's own skin refused every ring spot
and the woken foes stood at the unchecked last resort: one of a party of three's six inside the crate searched.

The real data: the quest's dungeon is Glenpoint's Ruins of Tower Yeomcroft (a Giant Stronghold, B0B40Y09's
`remote dungeon13`; Ilessan Hills' namesake is of another type). Two of its rooms (`N0000049`, `N0000050`) lay a random
foe's marker (object 16070) inside crate 41833, a 2.1 m cube, which rolls a Giant at player levels 6, 9, 11, 15 and 17
on; those two and `N0000048`'s are the only three of BLOCKS.BSA's 2,563 foe and 144 quest markers the landing stands in a
model (none of its 1,905 building quest markers, none of its 177 start and enter markers). Over the dungeon's 18
searchables with a party of three, the old line stood 12 of 108 foes inside a crate, the new none. The plate over the
crate in the screenshot ("Narve the Greenbiter", 118/118) matches no foe name the tree makes and reads like the party
list beside it, so it does not say which giant this was; the data points to the layout's and the searches'.

A stand whose body is lodged in a model - a lid met from behind straight up from the knee, walls from behind on two of
four bearings - is moved to the nearest spot within 3 m on the same floor, reached passing only the skin it stands in,
where a body fits; a flyer keeps its height; with no spot it stays. Puppets are their owner's, bodies lie where they
fell. The foe stands beside the crate rather than overlapping it and walking out as in DFU - a departure (Port-Ledger,
Ledger A). The four hosts: `scenes/dungeonContext.js` wired; `scenes/worldModes.js`, `scenes/exterior.js` and
`scenes/world.js` through the shared pool's spawnFoe (a building's quest marker, a save's restore, a boulder outdoors),
unchanged; the player's own spawn not wired (no case in the data). `test/fb1004d_cratefree.test.js` (17: 13 on fixtures,
four on the player's data); `tools/mutants/fb1004d_cratefree.json` (22, all dead); `test/audit0928_merge.test.js`,
`test/disc28_flyer.test.js` and `test/incident_ceiling_bats.test.js` take the new door. Not changed: SEARCH1's last
resort still checks nothing (reached far less often); a swimmer restored mid-water inside a model.

## BOOK-RISE (7)

`ui/enhancedBook.js` (frame). There was no hung tab: the book stood open for good and refused every way out.
`exit()` latched `closing` and asked Raum's `closeBook`, which refuses a book still rising (its 260 ms 'slide-in'), so a
close asked in the rise was dropped, and the latch refused every later one - Escape, Enter, E, a tap (any tap while the
book moves reads as outside), Tab, the host's own close. frame() finished only a close the book had taken, so the door
never reported done, the interior host kept its pausing slot, and every key went to the dead book, F5, F6 and F11 among
them. The Hall of Records meets it most: its shelf is pressed with E, E is the book's way out, and the book arrives a
service read after the press - a second press, the held key's repeat, Escape or a click lands in the rise. Hearthton
Manor is a seat by design (its building list holds a Palace). The × the screenshot shows at the top is drawn by no game
code over a book; it is most likely the browser's own way out of fullscreen, which, with the reload keys eaten, left a
restart (inferred). frame() now asks closeBook again every frame while a close is pending, until the book takes it -
Home.md's ASYNC NEVER DROPS. No sync loop on the path runs long (242 frames in 7-31 ms for an empty hall, a 400-row hall,
a phone at 3x and a 120x90 view). The four hosts: one face, so all reach it - `scenes/worldModes.js` (a seat palace's
shelf; a crown castle's, on the dungeon's stack), `scenes/dungeonContext.js` (its castle shelves), `scenes/world.js`
(the board's Seat tab), `scenes/exterior.js` (its ordinary books). `test/fb1004d_bookrise.test.js` (2: every way out at
every moment of the book's life; a long hall in its rise, its opening, open, mid-turn and under a held E);
`tools/mutants/fb1004d_bookrise.json` (7, all dead).

## KNIGHT-HOUSE (8)

The law is `06-Systems/Online-Arc.md` KNIGHT-HOUSE and the service's `06-Systems/Accounts-And-Cloud-Saves-Arc.md`
(acct77). The order's house (KnightlyOrder.ReceiveHouse) was Daggerfall's deed in the save and nothing else; the door's
offer read only the account service's list. Measured on the real modules and the real service over SQLite, the deed
minted by the real producers: another player's `/v1/homes/claim` on the knight's house answered 200, and the knight's
own claim answered 200 and took 554,330 gold. The door never prices a building the character's own deed names now, and
the service holds it from every other claim (migration 0079, `/v1/homes/deed`); the market leaves out any building
someone owns online; the bank's sale gives the hold up first. **Deploy the account service before the client.**
Four calls left to Mac, built as follows: a held house costs none of the three homes; a deed customs carried in is not held (HOME1's "Stay
offline only"); to other players a knight's house is the knight's home, always shut; the knight may still sell it at the
bank for Daggerfall's share. Not reconciled: a knight's house another player claimed before this stays theirs.
`test/fb1004d_knight_house.test.js` (10); `tools/mutants/fb1004d_knight_house.json` (40, all dead); eight older records
(`home1` 5, `arena4b_homes` 2, `gatekeys` 1) re-aimed by content and twelve version pins moved to acct75 on its branch, acct77 at the merge of main (past HOME-PRICE's acct75 and PRIMARCH and FOUNDER4's acct76).

## CULL-SIZE (9)

`render/bounds.js` (batchReach, read by batchSphere). Not the report's cause, but the same family, found chasing it. The
horse is Horse Cart and Cargo's hitched team, one billboard 3.1 m ahead of the parked wagon, and its cull is correct:
on the real runtime, pool, renderer and both culls, 4,368 on-screen views and 15,552 more orbiting all eight headings
(the mirrored views among them) dropped none. Its mirrored side views draw - the flats' pass runs with face culling off
and the shader takes a negative width - and all five views' pictures ship. Unproven, and Mac's call: the horse stands
0.6 m past where its rider dismounted, so against a wall the rider rode up to its anchor can be a quarter metre inside
it, and its 3 m camera-facing quad then hides behind the wall from some angles - as the mod stands it (DFU's Billboard,
no wall check); moving the hitch would be a departure.

What was wrong: createBillboardBatch sizes a batch's sphere by the quad it is BORN with, and a producer that writes its
size every frame never re-sizes it. Every walking pool is born at 1 x 1 - the street's foes, the watch, both exterior
hosts' townspeople, a ship's crew, a dungeon's mobiles - so all were culled by a 0.707 m sphere whatever they drew: a
2.5 m foe dropped with half a metre of it on screen, a tall sprite's head lost at the top edge. The radius is the larger
of the stored one and the drawn quad's half-diagonal now - the stored float bit for bit where the size has not grown, so
it never culls more than before. The four hosts: every reader takes it through the one file (the crowd and peer cull,
the flats' pass, the shadow replays, the air pass, SC1's scans, the ship-flat rule); none edited.
`test/fb1004d_cullsize.test.js` (4); `tools/mutants/fb1004d_cullsize.json` (8, all dead); AUDIT 68's S16 pin moved;
tv1's AUDIT-DEEP-R7 re-aimed. Two older records survive unchanged on HEAD's bounds.js and are noted, not fixed:
`perfon2.json` PERF-ON2-the-peers-are-submitted-uncut-again and `shadowreach.json` world-peer-gate-still-skips (their
source patterns match identical lines further down world.js).

## QUEST-AUDIT (10) - what the town mods did to the quests

Read-only first, every claim run or measured over the player's data through the port's own readers, the world-data
door, Place and the interior layout. The mods do not break the quests wholesale: they ADD quest sites. Across the
15,251 locations, the candidates a quest's building can be chosen from rise from 174,634 to 274,882, and those without
an NPC marker fall from 56.1% to 2.7%, without an item marker from 17.0% to 2.1% (Daggerfall's own 9,005 building records:
7,155 with no NPC marker, 6,174 with no item marker; Beautiful Villages' 1,901: 318 and 298; Beautiful Cities' 5,249: 875
and 826). A building with no marker is never a quest's site, as in DFU. What they did break is narrower, by player
impact:

1. **Unreachable quest markers in six of the mods' interior designs** - 1,104 town buildings, none in Daggerfall's own
   towns: a House2 whose second NPC marker is 3.75 m under its floor (402 buildings), a House2 whose only NPC marker is
   in the attic of an exterior model the room keeps (267), two House4s with an item marker inside a stair (422), and the
   library's two bad NPC markers of five (13). A person or an item sent there cannot be reached.
2. **34 Arkay temples (`TEMPASA2`) hold no house**, so a temple quest whose person takes a local home cannot start -
   C0B00Y01 nearly always, C0B00Y03 half the time, C0B00Y02 always.
3. **A moved quest site's re-seat could turn a house into a tavern or a shop**: where a town had no house of the type,
   the search's fallback left p2 at -1, which the re-seat read as "any building" - 125 re-seats over 40 villages landed
   86 in a House2, 28 in a tavern, 10 in a House4, one in a General Store.
4. **Quick loot never told a quest its item was taken** (not the mods' doing): R0C20Y07 could not be finished, S0000503
   and three more were touched; DFU's own click does tell it (DaggerfallInventoryWindow.cs:2027-2037).
5. **Sites that moved, as the mods mean them** (recorded, nothing broken): a palace in 1,193 manors now (232 cities
   before), so `remote palace` and a noble's home usually land in a manor; fewer House1s in manors; 18 cities lost their
   weaponsmiths, and Pothago has none left, so L0B60Y10's `remote weaponstore` cannot start there.
6. **Gaps in QUESTOR-MOVED's re-seat**: a site with no candidate kept its old key (a stranger's building), and a quest's
   sibling places were checked against each other's OLD keys (two could land in one building); a questor met in a house
   is never re-seated (recorded as known at FIELD BUGS 2026-10-03b).

Checked and found clean: all 66 permanent places resolve as before (the castles' markers too); every location keeps its
map id, location id, name, type and position (3,360 change only their size); 4,232 towns keep their dungeon's doors at
the same cells; every quest-eligible building has an exterior door; all 7,150 of the packs' building records lay out; no
interior NPC of a named building stands in the void beyond the 83 Daggerfall's own data already has; the guilds',
temples', Thieves Guild's and Dark Brotherhood's halls keep their factions; no quest marker stands inside a stand-in bed
(13,398 checked); the world's click and both inventory windows' remote clicks tell the quest; a re-seated site's new name
reaches the journal and the letters (both re-expand when shown). The Thieves Guild's invitation (O0A0AL00) meets no bad
marker among its 2,640 House1 candidates.

The fixes, one each (verified over the player's data where it decides, and pinned without it where it can be):

### LOOT-CLICK (4) - landed first on main as ROBES-CLICK (FIELD BUGS 2026-10-04c)

Quick loot and the enhanced window's take moved a quest item off a body without telling its quest (DFU's remote-list
click does, DaggerfallInventoryWindow.cs:2027-2037). Main's WHERE-ROBES fixed it first, through the same one door
(`systems/itemTransfer.js` sendQuestItemClick) - quick loot's take, the enhanced menu at its opening and the pad's quick
act - with its audit's pins (a menu closed unused has clicked; the local list sends none). This branch's copy - which
also clicked in the card's Take, and would have clicked twice under main's menu - was withdrawn at the merge for main's,
with its pins and mutants. The quests it named stand fixed by main's: R0C20Y07, S0000503, N0B00Y06, O0B00Y11 and
Q0C4XY04.

### RESEAT-DECLARED (3)

`systems/quest/place.js` (declaredSiteLaw, _searchTownSites - one search for the setup and the re-seat, with the house
fallback). A house site that found none of its kind falls back to any house and writes p2 = -1 (Place.cs:735, and the
remote search's after 250 darts, :815); the re-seat (QUESTOR-MOVED's `reseatMovedSite`) read that as "any building". It
re-reads the place's declared P2/P3 from Quests-Places by its name now: over the audit's forty villages, 130 re-seats,
every one into a house. No departure beyond WD3's re-seat itself, which now keeps DFU's own declared law and fallback.
The four hosts: the quest machine's, run by `scenes/world.js`'s load (applyLayoutPins) and as a shared quest arrives;
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` never call it. `test/fb1004d_reseatdeclared.test.js`
(4); `tools/mutants/fb1004d_reseatdeclared.json` (5, all dead).

### RESEAT-GAPS (6)

`systems/quest/place.js` (_unseat, _seatBack, _isBuildingAssigned's `recordStands`), `systems/layoutPins.js`
(layoutRecordsOf). A site with no candidate in the town as it stands kept its old key - a stranger's building - and a
quest's sibling sites were compared by their stale keys. Now such a site is UNSEATED: its key is DFU's none (0), its
record kept, and every load tries it again - seated back on its own key when its town stands in its layout again, or
chosen again where a building of its kind stands, what was assigned to it carried. Nothing of its quest stands in a
stranger's house meanwhile, and `pc at` cannot fire there. Siblings are compared only where their records stand (the
"two in one building" did not reproduce with re-seats in turn; the stale keys' over-exclusion was the defect). Measured:
of 265 cities with a weaponsmith in Daggerfall's layout, 247 have one chosen again in Beautiful Cities' and 18 are
unseated (none stands). A port-only mechanism, as the re-seat is. `test/fb1004d_reseatgaps.test.js` (5);
`tools/mutants/fb1004d_reseatgaps.json` (8, all dead); `audit1003_wd`'s markerless arm, its two mutant records and
`arena1_move`'s pin re-aimed.

### QUEST-MARKERS (1)

`systems/quest/markerCuration.js` (CURATED_QUEST_MARKERS), `systems/quest/place.js` (the building's marker enumeration;
mendCuratedMarkers, called from the machine's load), `systems/quest/sceneMount.js` (MARKER_FLOOR_REACH, siteMarkerSpots,
standSpot), `scenes/worldModes.js` (standQuestFlatIn, interiorStandSpots and the person, item and foe arms),
`tools/townQuestMarkers.mjs` (which measures the list). Each of the eight unreachable markers - six interior designs, 51
of the packs' interiors - is keyed by the pack that lays it out (and only on a block the door serves from world data),
the block, the building's record, its kind and its exact position, and STANDS AT ITS MEASURED FLOOR SPOT: the nearest
floor a person walks to from the room's entrance, with half a metre of floor round it. A move, not a drop, so every
marker DFU's quest law counts and indexes stays (`marker N`, anymarker's lists, the spawn-to-item fallback, the draws).
Saves enumerated before it are mended at the load, their selected markers and targets kept. And a backstop for any
building marker: with no floor within 4 m under it, its person, foe or item stands at the site's nearest marker that has
one, else the room's nearest enter marker; one with a floor stands exactly as DFU stands it. The library (`DALIBRBL01/03`)
is Beautiful Cities' own interior, made over `LIBRAL01/03`; Daggerfall's own libraries are sound. BLOCKS.BSA holds one
bad design of its own (`WEAPAL02` #1, `SENT6` #11, four markers) that no town lays out; the backstop covers it. With the
player's data the gated test finds every one of 1,105 buildings in 665 towns curated where the door serves it.
Departures: the eight markers moved, the backstop, the load's mend (Port-Ledger, Ledger A). The four hosts:
`scenes/worldModes.js` wired (its interior adapter serves `scenes/world.js` and `scenes/exterior.js`); `scenes/world.js`'s
load runs the mend; `scenes/dungeonContext.js` unaffected (a dungeon's markers are Daggerfall's RDB). 
`test/fb1004d_questmarkers.test.js` (11, two gated); `tools/mutants/fb1004d_questmarkers.json` (19, all dead); six source
pins re-aimed (audit24_wave22, audit26_questitem, questflatanchor, fb1003b_totem, interiorfoes, rogueimp). Not changed: a
void marker whose 4 m ray reaches a lower storey's floor.

### TEMPLE-HOME (2)

`systems/layoutPins.js` (CURATED_CLASSIC's second row, by location key; curatedOut asks the key first). The consequence,
measured at the 34 temples with the questor clicked (sixteen draws each): `_assignHomeTown` makes `Place _x_home_ local
house`, Beautiful Villages' `TEMPASA2` holds the temple and 25 House5 and no House1-4, the place throws, SelectQuest
answers none, and the questor says TEXT.RSC 600 ("You're too late..."): C0B00Y01 505 times in 544, C0B00Y03 273, against
0 and 0 in Daggerfall's own temple; C0B00Y02 fails everywhere (it wants a local tavern, which no temple has - DFU's
own). DFU does the same with the mod. The 34 are kept Daggerfall's own by their KEYS, never by a grid: the mod replaces
their location files, `scenes/world.js` fills its index before the pins can ask a town's grid, and a grid-keyed row
would have indexed the mod's temple and then built it asking for a block the door no longer serves (the temple gone).
The housing promise stands as CURATED_CLASSIC's: a save's own records there pin the mod back in, new ones are stamped
classic, and discoveries made there under the mod are forgotten once (WD3's law). The twelve villages laying `TEMPASA2`
out among their own houses stay the author's. A curation of the mod's data (Port-Ledger, Ledger A); DFU's quest law is
untouched. The four hosts: the door asks the pins on every location and block read, so `scenes/world.js`,
`scenes/exterior.js` and `scenes/worldModes.js` serve the same towns; `scenes/dungeonContext.js` unaffected (none of the
34 has a dungeon). `test/fb1004d_templehome.test.js` (4); `tools/mutants/fb1004d_templehome.json` (4, all dead);
`wd3_layoutPins`' row pin re-aimed.

Recorded, not changed here: the destinations that moved (5) - changed since by QUEST-AUDIT II (`01-Overview/Quest-Audit-II.md`): a local destination a town's own layout held and the mods' no longer does is taken in the nearest town that has one (NEAR-SITE), and Pothago's L0B60Y10 in the region's own towns, else the nearest town of another region (NEAR-REGION); a questor met in a house is seated again where their own person still stands on their own key, and a guild's contact (a Thieves Guild or Dark Brotherhood House2 hall) in a hall of their guild (HOUSE-HALL) - a commoner who no longer stands is not, and their hall is unseated.


## Integration

The fixes were built on separate branches off one base and taken onto one, in this order: BOOK-RISE, CAMP-CAP,
KNIGHT-HOUSE, QUEST-ITEM-NAMED, CULL-SIZE, PLACE-LRU, VOID-ENTRY, DOMES, CROPS, CITY-WALLS, CRATE-FREE, then the quest
audit's (LOOT-CLICK, RESEAT-DECLARED, RESEAT-GAPS, QUEST-MARKERS, TEMPLE-HOME), merged from a branch forked before most
of the others: its ten conflicted files differed in cite numbers alone, ours taken and `tools/citeMerge.mjs` moving each
line's cites from the side it came from. Every cite a change moved was re-resolved by `tools/citeShift.mjs` against the
tree before it, each content checked; the struck Ledger and Settings-Screen-Spec cites that CD4 gates were moved by hand
to the tool's own mapping, the other struck rows keeping their numbers; the cite mutants survtiers' and survtiers3's
re-aimed by content (PIN MOVED). PLACE-LRU and VOID-ENTRY wrote the same line - the interior build's catch - on their
two branches: it carries both now (the building's hold released, DFU's line said), and the three mutants aimed at it and
PLACE-LRU's source pin were re-aimed at their own halves.
**The merge of main.** This page was written as FIELD BUGS 2026-10-04b on its branch (its commits say so). Main merged
another 04b first (the companions, #590) and a 04c (WHERE-ROBES), so at the merge of main it became 04d: the page, every
fix id in the tree (`FIELD BUGS 2026-10-04d <ID>`), the suites and mutant lists (`test/fb1004d_*`,
`tools/mutants/fb1004d_*`) - only this branch's own lines renamed, main's 04b text untouched. KNIGHT-HOUSE's migration
became `0079_home_deed.sql` (FOUNDER4 took 0078) and its version acct77 (HOME-PRICE took acct75, PRIMARCH and FOUNDER4
acct76), the version pins moved with it, main's history kept in their notes. WHERE-ROBES had already landed this
branch's QUEST-ITEM-NAMED and LOOT-CLICK (its ROBES-NAME and ROBES-CLICK, through the same one door): main's code was
taken and this branch's copies withdrawn with their pins (sections 2 and 4). HOME-PRICE and KNIGHT-HOUSE met in the
homes: the door's price is HOME-PRICE's `homeListPrice`, never asked of the knight's own deed; the bank's sale of a held
deed releases its hold and pays HOME-PRICE's `deedSellPrice`; the town's answer selects both `rent_due` and `deed`.
The conflicts that were cite numbers alone were taken from this branch and every cite then moved by
`tools/citeMerge.mjs` from the side its line came from. Main's laws moved four of this branch's pins and one of its own:
ENDLESS PROVISIONS made a camp every tier's, so CAMP-CAP's refusals at the cap no longer count the arc Off; HOME-PRICE
refuses a claim outside 5,000-250,000 (`home-update`), so KNIGHT-HOUSE's claims are priced inside it (the field's 554330
was Daggerfall's, from a build before it), its door pin reads `homeListPrice`, its market pin the Seneschal's C1 filter
over `currentHousesForSale()`, and its offline pin lets `?exterior` import HOME-PRICE's `homeTownBlocks` (a module, no
registry); FOUNDER4's "the newest migration" pin asks now that 0078 is one of the service's, since 0079 follows it.


## Not verified here

- Nothing was rendered or played: no browser, no GPU, no online room. The black screen, the floating book, the giants'
  sprites and the horse were explained from the code and the data, not seen. The player's data held no TEXTURE files.
- PLACE-LRU in a real browser: Firefox's GPU memory over a long walk through many towns and dungeons should plateau;
  no hitch at an eviction or a remake; a revisit rebuilds nothing; texture packs and terrain mods' tile arrays.
- KNIGHT-HOUSE needs the account service deployed (0079, acct77) before the client.
- VOID-ENTRY's eighteen classic voids and four refusals were measured through the port's layout, not in Daggerfall
  Unity; CRATE-FREE cites Unity's sweep (ROCK-FREE's law), not a run of it.
- CULL-SIZE leaves the horse report unreproduced: a parked team against a wall wants an in-game look.
- The quest fixes in a browser: the enhanced window's takes (the tests use a fake DOM), how the journal shows an
  unseated site, the curated markers' floor spots as the port's own pipeline stands them, the 34 temples at boot and load,
  and online and party takes.


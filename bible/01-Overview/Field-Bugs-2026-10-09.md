# FIELD BUGS 2026-10-09 - seven Discord threads, and two from #general

Seven threads from the Discord's bug-reports, handed over by Mac as screenshots; then two more from #general, the same
way (8, 9).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | snow in desert and swamp towns with snow turned off for them (Toomgis) | Snowless Swamps and Jungles greened the tiles alone: Snowfall and the enhanced weather asked the climate and season, laid snow on the green ground and dropped it from every winter rain; and snow systems drifted over the desert kept snowing | fixed (SNOWLESS1) |
| 2 | casting again adds to the effect's timer instead of resetting it - Light at 613 (Doctor Bill) | DFU's own law: an incumbent effect's `AddState` stacks the new cast's rounds onto it (audit F12, `systems/effects.js`) | not a port bug - kept |
| 3 | the first open of overworld travel freezes, and frames fall the longer one travels (Shabalako) | the Overworld's first frame started all twelve dungeon-model loads at once; their climate pictures were uploaded pinned and never freed; Snowfall sampled and uploaded its snow round the traveller under a view that draws none | fixed (TV-BURST, TV-PIN, TV-SNOW) |
| 4 | the game freezes opening chat, the wagon (EvoAva) | nothing in opening chat or the wagon is heavy; the likeliest hitch found is every save re-packing Snowfall's whole track field (80-90 ms at its limit), online every two minutes, plus clean snow masks swept twice a second | partly fixed (TV-SAVE, TV-REFILL) - the windows' own freeze not reproduced |
| 5 | Knightspire's tavern sign hangs on a residence (DarkScorpyon) | the game's own data: block TVRNAM00 record 0 is a tavern's model with a tavern's interior and sign, typed House2 in the block's building list, which is where DFU reads a building's type | not a port bug - kept (SIGN-HOUSE) |
| 6 | a torch cannot be placed before my own door, but can before a stranger's (Shiki_Eternal) | the yard measured a house as the box round its models; Hammerfell's houses are L-shaped or stand an outside stair, and their doors open onto open ground inside that box | fixed (HOME-FOOT) |
| 7 | `TypeError: Cannot read properties of undefined (reading 'velocity')` at `poseAhead`, on a ship's deck (Cruor) | a peer's word dropped a boat between two frames; the peek read the place it no longer names | fixed (PEEK-WORD) |
| 8 | "if i bug the game outside of the bay i can become invisible to everyone and everyone becomes invisible to me" - "i relogged and im still invisible" (maya) | not a bug to find a way into: TAMRIEL2 streams the land past the Bay, and the wire still held the Bay - a pose past 1024 pixels refused and the socket closed on it, a cell west or north of the Bay no cell any halo reached | fixed (TV-BEYOND, world180 - the relay first) |
| 9 | `CRASH (2) RangeError: invalid array length` up through `onPick`, a click on the Overworld in the wilds past the Alik'r (maya) | the route planner's box was clamped to the map: two ends past one edge clamped it inside out | fixed (TV-BEYOND) |

## SNOWLESS1: snow off means the snow too (1)

Toomgis's screenshot is a swamp town at night with white ground, a green road through it and snow falling. The player
had switched on Vanilla Enhanced's Snowless Swamps and Jungles (the Texture Overhaul card). It decides the winter
archive 403 for the Ocean, Rainforest and Swamp climates, and the tiles were drawn green - but two other systems never
asked it. They asked the archive law alone (`world/climateSwaps.js` groundIsSnowy: not a desert, and winter):

- Snowfall's deep snow (`scenes/snowfallHost.js`) laid its snow over the swamp, bare only where its own snowy 403's
  masks leave the roads - the white ground with the green road strip. DFU's two mods clash the same way.
- The enhanced weather's ground law (WEATHER2a, `systems/weatherSim.js` overGround) turned every winter rain and storm
  there into snow - about 37% of a jungle's winter days, in a climate DFU's table never snows.

And the desert's half: the weather map's snow systems, born in a snowy climate's winter, drift tens of kilometres and
nothing turned them back to rain over a desert; Snowfall counts ground with no mask as snowed, so standing in a snowy
climate it laid snow over a desert pixel next door.

The ground AS DRAWN is the law now. `groundWearsSnow` (`world/climateSwaps.js`) is the archive law unless the winter
set drawn is the add-on's - the texture door's own decision (`systems/dfmodTextures.js` winterGroundSnowless, which
registers itself there so the weather never imports the texture code). The terrain still keys 403: the add-on dresses
it. The weather asks it both ways: rain or a storm over a snowy ground is snow, as before, and snow over a ground that
wears none is rain - the desert's drifted snow, and, under the add-on, the swamp table's own 15% winter snow, an
extension of WEATHER2a's departure on the enhanced lane (Port-Ledger's row); the classic lane keeps every word.
Snowfall treats a climate the add-on decides as it treats the desert (no tier stands while the player is in it), and
its tiles - and every desert tile - are bare from a neighbour. A switch made mid-session reaches the weather and
Snowfall at once; the drawn ground, as the card says, at the world's next load.

`test/fb1009_snowless.test.js` (5); `tools/mutants/fb1009_snowless.json` (10, all dead; `weather3f.json`'s `WEATHER3f-ground-skips-thunder` re-aimed at the widened guard). Recorded on
`07-Rendering/Weather-Arc.md`, `03-World/Snowfall.md`, `07-Rendering/Vanilla-Enhanced.md` and the Ledger.

## HOME-FOOT: the step before my own door is my yard (6)

Shiki_Eternal's screenshot: a desert street from above, a torch held over the cobbles between two houses - the left
theirs, the right nobody's. The home yard (HOME-YARD, `06-Systems/Online-Arc.md`) took a building's ground to be the
box round its models (`scenes/homeYards.js` yardLot). Hammerfell's houses are L-shaped or stand an outside stair, and
their ground door opens onto open ground INSIDE that box - ARCH3D 709's door at (-5.4, -3.2) faces a forecourt that
runs to -6.4, and ARCH3D 600's opens into the L's own corner - so a piece on the step before the owner's own door was
"inside your house". A neighbour whose door is in its box's side had free ground before it, within the owner's lot:
the asymmetry reported. Read over the real layouts of all 813 desert towns, a 1 m piece 1.5 m before the owner's own
door was refused as the house at 5,166 of 11,701 houses (51% across every climate).

A building's ground is now what its models' faces cover seen from above - roofs, eaves, a stair's treads, never a wall
(`modelFootRects`, 0.4 m cells merged into rects, measured once per model at the pixel's build, `scenes/world.js`;
`footRectsAt` stands them by the placement). The lot's margin is still the box's, and the house and every neighbour are
asked by their ground; a piece whose middle sits on any rect is on it, so the seams between rects let nothing through.
Of the desert's 5,166, 3,389 now stand, 847 are the road (its own rule), and 930 are still the house: their door is
under their own roof or eaves - whether a porch is a yard is a design question, not this bug. No point inside a door is
let through (11,701 of 11,701). A stranger's door within the owner's lot may still be decorated before: the lot's rule.

`test/fb1009_yardfoot.test.js` (5, one over ARENA2, skipped without it); `tools/mutants/fb1009_yardfoot.json` (14, all
dead), and FB1001's three YARD-CORNER and HOUSING's two HOME-YARD records re-aimed.

## TV-BURST, TV-PIN, TV-SNOW, TV-SAVE, TV-REFILL: the Overworld's freeze, its falling frames, the saves' hitch (3, 4)

Read from the code and measured in node over synthetic data - no browser, no ARENA2 here, so the freezes' lengths in
the game are not measured. The Overworld is the Travel View (`06-Systems/Travel-View.md`), the eye raised over the
streamed world.

- **TV-BURST (3, the first open).** OW-DUNGEONS (2026-10-08, pull request #690) stands each nearby dungeon's own model
  under the view, and the view's first frame started all twelve loads inside its draw - each one's blocks laid and its
  ARCH3D meshes read on that frame, its model built and its pictures uploaded straight after. They start one a frame
  now, the nearest first, none until the view is fully up (`systems/travelDungeonModels.js` startDungeonLoads), and the
  view coming down lets every model go to its shelf (they were held, undrawn, until a load).
- **TV-PIN (3, "past map pixels don't get unloaded").** Those models' climate pictures went up through the host's
  pinned door, so every climate and season picture of every dungeon the view ever stood stayed on the GPU for the
  session, growing with the land travelled. They go through the dungeon's own hold now and are freed with it.
- **TV-SNOW (3, the frames while travelling).** Snowfall (2026-10-08, #692) sampled, committed and uploaded its window
  and ring round a traveller crossing the land at the journey's x60, under a view that draws no snow. Under the view it
  is handed no player now - its tiers stand down - while its snowpack and refill keep their clocks, as in play.
- **TV-SAVE (4, the freezes).** Nothing in opening chat or the wagon is heavy (`ui/chatPanel.js` unchanged since
  2026-10-06). The likeliest hitch found is the save: Snowfall's track field fills to its 65,536 cells within minutes of
  a winter town's walkers, and every save packed it again - 80-90 ms on the page's thread, online every two minutes,
  whatever the player was doing. A field unchanged since the last record writes that record's text again now,
  character for character.
- **TV-REFILL.** The refill swept the 256 x 256 window and the 641 x 641 far mask twice a second whenever any tier
  held a track, clean or not; a clean one is skipped now.

Not fixed, leads only: the pad cursor's per-frame hit tests while a window is up (controller players), the Overworld's
town rects never pruned (memory), TAMRIEL3's fit at boot (one-off). If EvoAva's freezes outlast this, the next step is a
profile from their machine - whether they play with a controller, and whether it is every open or now and then.
`test/fb1009_travelperf.test.js` (8); `tools/mutants/fb1009_travelperf.json` (32, all dead). Recorded on
`06-Systems/Travel-View.md` and `03-World/Snowfall.md`.

## STACK: a re-cast stacks its rounds (2)

Not a port bug. DFU's `IncumbentEffect.AddState` is "Stack my rounds onto incumbent" for Light and the other
incumbent effects, and the port carries it as audit F12 (`systems/effects.js` header: "re-casts of an incumbent STACK
rounds onto it"). Classic Daggerfall stacks too. Resetting instead would be a departure from DFU, which is Mac's call
(Port Doctrine); nothing changed.

## SIGN-HOUSE: a tavern's sign on a residence (5)

Not a port bug. No location is named Knightspire; the snowy candidates are Knightscester (Wrothgarian Mountains), and,
with Beautiful Villages worn, Knightswych and Knightswood. Read with the port's own readers over the freeware ARENA2:
block `TVRNAM00.RMB` record 0 is tavern model 249 with the tavern interior `DTAVR001.HS2` and tavern sign 43727 2.4 m
from its door - and its building list types it 18, House2, a residence. The block's real tavern is record 6, 54 m
off, with its own sign. `ARMRAM01.RMB` record 10 is the same (sign 43746). Beautiful Villages retypes TVRNAM00 record 0
as a tavern but leaves the same mismatch in its own `TVRNAS04` record 6, `TVRNAS06` record 5 (the block it rebuilt as
houses, `03-World/Beautiful-Towns.md`) and `TVRNAS07` record 8 - the author's bytes, checked by sha256. The port reads
a building's type from the block's list and a door's key from its record, as DFU does (`world/rmbLayout.js`,
`systems/talkTopics.js`), and stands a shop sign as an ordinary scene model tied to no building, as DFU does. Of
BLOCKS.BSA's 249 tavern signs, 244 hang at a tavern's door. Making that house a tavern would be a departure from DFU,
and would get no name: the town's MAPS.BSA list names one tavern per tavern record. Nothing changed.

## PEEK-WORD: a peer's boat that her word no longer names (7)

Cruor's error, on another player's ship: `Cannot read properties of undefined (reading 'velocity')` in `nextPose`, under
`poseAhead`. A word from a peer (`applyOwner`) replaces her boats at once and marks them dirty; the boats that stand are
matched to it only in the next `frame`'s `realign`. The world's online frame runs BEFORE the peers' frame and asks
`poseAhead` for the boat a passenger stands on (`scenes/world.js` `csaPoseAhead`), so on the frame a word arrived that
named fewer boats - a boat packed away, sunk, or sold - the stood list was longer than the word, `l.boats[i]` was
undefined, and `nextPose` threw outside the peers' own `try` (their frame's throw is that owner's loss alone, AUDIT
PRE-MERGE 0928 O1; the peek had no such guard). Uncaught, it was the red console over the deck.

`poseAhead` now reads the word's place first and answers null when the word names no boat there, or a boat of another
hull (a word that reordered her boats) - the host's own fallback, the boat's pose as it stands, carries the passenger
for that one frame, and the frame's realign matches the word as before (`scenes/comeSailAwayPeers.js`
`poseAhead`). `test/csa_together.test.js` (+1) drops a boat and changes a hull between frames and fails, with the
reported error, without the guard; `tools/mutants/csa_together.json` +2 (the missing place, the other hull), and the
`CSAK-peers-peek-late` record re-aimed at the guarded line.

## TV-BEYOND: the land past the Bay is the world's (8, 9)

maya's two screenshots came from the same place: the wilds past the Alik'r, the region reading the Alik'r Desert as
`getRegionIndexAt`'s clamp reads every pixel past the Bay. Nothing there is a bug to get into - TAMRIEL2 streams the land
beyond the edge on purpose, on by default and the player's own online (`03-World/Tamriel.md`). Two laws still ended at
the edge.

**The crash (9).** A click on the Overworld plans a route (`systems/travelRoute.js` `planRoute`), and its search box was
clamped to the map's 1000 x 500. With the traveller and the spot both past one edge - two pixels apart west of the
map, as the view's reach makes them - the clamp turned the box inside out, its width negative, and the typed arrays
threw (`Invalid typed array length: -13` in Node, `invalid array length` in maya's browser; reproduced first). One end
past the edge planned without throwing and was wrong: the traveller's pixel was indexed into the box's far side, so the
route began where the traveller never stood. And the planner's ground (`routeGround`) called every pixel off the map
the sea, so nothing past the Bay could be walked to, and its land pieces (`apart`) said "no way by land" for every
pick there. Now the box's bounds are the map AND the two ends; `routeGround` takes the host's `beyond` (whether a pixel
past its table is dry ground, asked once a pixel and kept, `BEYOND_CACHE_MAX`); `apart` leaves an end past the table to
the search; and a step past the table reads no road's byte (a column west of the map read the row above's last bytes,
a road a whole map away). The host's water law (`scenes/world.js` `tvWater`) is the ground's own where TAMRIEL2
composed the reader (`woods.isTamrielGround`), and the sea off the map where it did not - DFU's empty edge, the classic
skin and the switch off exactly as before - and the planner is handed it.

**The invisibility (8).** The wire (`net/wire.js`, both ends' one law) held the Bay. A pose past 1024 pixels (`POSE_BOUND`)
was refused, and the relay refuses a bad pose by closing the socket as a policy breach - the client takes that close
as final, so every peer went at once and the rejoin was refused again; the save keeps the position, so a relog stood
there again. Nearer, a cell west or north of the Bay was no cell (`CELL_ROOM` admitted no sign): the room was opened,
but no halo reached it from the Bay (`cellHaloFor` stopped at cell 0) and none reached out of it - two players a pixel
apart astride the edge never met. A traveller's mark and a party pose west or north of the Bay were withheld by the
client's own check of the same law, and a mark east or south of it was clamped onto the Bay's edge
(`systems/travellerMarks.js`). TAMRIEL2's record had said this honestly ("walks unseen by the room until they come
back"); with the open zone's PvP, unseen is an exploit. Now the wire's pixels are the world's: `WORLD_PIXEL_BOUND`
(8192 either way of the Bay's corner - every fit TAMRIEL3 reads, 16 to 21 pixels a picture unit, inside it; a fixed
bound, because the relay knows no picture), `POSE_BOUND` from it, `worldPixelOk` for a pixel; the cell key takes a sign,
the halo crosses the edge both ways; the traveller's mark is floored past the corner and its 256ths stay 0..255; a
party pose's pixel, its trip (`tv`), its walk (`tw`) and its feet (`wx`/`wz`), a duel's ring and a park's anchor are
taken either side of the corner. The widest hub attachment, the world's widest party pose, still fits its 2048 bytes.
RELAY_VERSION world180 (`test/relayversion.test.js` row): **deploy the relay before the clients** - a new client
against the old relay is no worse than today (refused as before).

Pins: `test/fb1009_beyond.test.js` (8) - the field's crash on four edges and the half-off route, the ground past the
table and its keep, the land's pieces, the road byte across the west edge, the host's own water line lifted and run
both ways, the frame's corners at three fits as poses the relay takes, the cells and the halo across the edge, the
marks and the party past the Bay; `tools/mutants/fb1009_beyond.json` (28, all dead). PIN MOVED (TV-BEYOND), each to
the world's edge from the Bay's: `duel_wire`, `hcc_park`, `partytravel` (and its widest attachment), `soc1_hub`,
`tv3_travellers`, `tv8_party_walk`, `world6b`, `world6biiib`; the host's `tvRouteGround` text in `tv2_click_to_move`
and `ow_wod`; the version pins to world180.

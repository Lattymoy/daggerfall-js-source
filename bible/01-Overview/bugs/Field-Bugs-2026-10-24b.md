# FIELD BUGS 2026-10-24b - Peers under the ground, and their foes out of reach

The owner, relaying players: "Players are reporting seeing other players underneath the ground. This also causes
monsters that spawn on those other players' clients to be unreachable, so you can't hit them." Mostly at world events,
"outside breach portals with a lot of players nearby", on current builds ("maybe 1 or 2 versions worth of drift today").

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Peers under the ground and their foes unhittable, outside the breach portals | A clearing - each Elite Breach arch a client believes, the gate's, each fallen star's - refused a World of Daggerfall site at its pick, and the pick is what levels the ground: a client that believed a stranger's arch stood on other ground than one that did not | fixed (GATE-AGREE) |
| 2 | The same, anywhere a spawned dungeon's clocks have run | A spawned dungeon levels its whole pixel, and whether one stands was each client's clocks at the moment it built the pixel | fixed (GROUND-AGREE) |

## Why a peer sinks

A pose's height is its sender's own ground's (`scenes/world.js` sheds only the floating origin from it), and a foe
record's feet are its owner's (`scenes/exteriorFoes.js` puppetStep stands a puppet at `_net.toScene(p.wire)`). No
receiver stands either on its own ground. So wherever two clients build one pixel on two grounds, each draws the
other's body and foes at the other's height: under its own ground where the sender's is lower. A foe sunk past about
1.7 m is out of every blow: the melee reach is 2.5 m from the eye to the foe's middle (`combat/playerWeapon.js`
WEAPON_REACH, the eye at 1.7 m), and a missile meets the viewer's own ground first (GROUND-BOLT). One cause, both
reports.

GROUND-GATE (`Field-Bugs-2026-10-17f.md`) keeps two BUILDS on one ground. These two grounds come from one build.
`test/net/fb1017f_groundgate.test.js` still matches its print under GROUND_LAW 1, and the print reads neither a spawn
nor a clearing (`03-World/Landforms.md`, TWO BELIEFS IN ONE ROOM).

## GATE-AGREE: a clearing never moves the ground

`src/scenes/pixelBuild.js` (the pick and the placements), `src/world/gate/gateClearance.js` unchanged.

FOUND. GATE-CLEAR (2026-09-28) kept World of Daggerfall's rock off the Oblivion Gate: a camp, fort, shrine, ruin, cave
or nature spot whose objects reach the clearing was refused at its pick, a `continue` that let a later instance take
the pixel. The pick levels the ground (`applyPicks` levels the samples toward each picked site's mean, over the whole
pixel), so a refused site took its levelled ground with it. While the clearing was the gate's alone it was the day's
law and every client agreed. EG-F made it a set (every Elite Breach arch, `eg:<b>`) and STAR-CLEAR added each fallen
star. A stranger's arch is believed only within EG_ARCH_PEER_M (40 m) of its opener's feet, once the hub's signature
verifies, and two to a cell at most (`scenes/eliteGates/egArch.js` `heard`). So in a crowd outside the portals, each
client held its own set of clearings, and the sweep built each pixel again at the moment that client heard an arch or
lost one. The record of 10-17f says the strangers' clearings differ between clients, and set them aside for the gate
alone (no arch stands within 300 m of a Dagon's Breach); the portals themselves were where it showed.

On the landforms' synthetic world, within 50 m of the site, one camp's levelled ground (16 x 16 tiles) parts from the
ground without it by a median 0.9 m, 3.2 m at the 90th percentile and 29.5 m at most, a quarter of it past the 1.7 m.
A 500 m site parts by a median 4.3 m, 13.7 m at the 90th and 90.2 m at most.

FIXED. The road test alone decides a pick (`wodSiteClear`, the network every client holds). The clearing asks each pick
after it is made (`wodHeld`): a whole site reaching it stands none of its objects - no model, flat, light, animal or
marker - and keeps its pick, so the kernel levels its ground as every other client's does. The ledger is the same:
a held site marks the pixel `gateRefused`, so the sweep builds it again when the clearing goes, and a stood site's
objects go in the reach for the next clearing to ask. A rebuild for a clearing now moves objects only, never the
ground. A held site keeps the pixel, so no later levelling instance (the loop's types 0 and 2) takes it in the site's
place near a clearing; a rock field or a mountain is still asked piece by piece. The rock still keeps off the gate, the arches and the stars, which is what GATE-CLEAR is
for.

WHAT A PLAYER SEES. Near a clearing, where a camp, fort, shrine, ruin, cave or nature spot reaches it, the site's
levelled footprint now lies empty - no tents, no fire, no bandits. Before, the site was dropped and the next levelling
instance the lists name for the pixel could stand there instead, on its own levelled ground. When the clearing goes (the arch sinks, the star is gone, the gate's day
turns) the pixel is built again and the site stands on the same ground.

## GROUND-AGREE: a spawn's ground is the roll's, alive or dead

`src/world/spawnGroundPlace.js` (new: `createSpawnGroundPlace` - `groundLocationAt` and `spawnAt`), `src/scenes/world.js`
(its construction, `tvSpawnAt` and `_liftLocationAt` bound to it), `src/scenes/pixelBuild.js`.

EXTRACTED, NOT GROWN (THE HOSTS DO NOT GROW, `01-Overview/Host-Split.md`). The law is a module the host wires: the
host hands it what it holds (the map, the page's `online`, the Eltheric Ocean's switch, the plateau test, the
terrain client, the clone and the clocks) and keeps the construction and its two call sites. The Overworld's far
found spawn (`tvSpawnAt`, AUDIT OW4 D4) moved with it, since the ground's spawn is the same gates with the clocks not
asked; `bootWorld` stands at its ceiling on main's count, 36,392.

FOUND. A spawned dungeon is a location (`world/spawnedDungeons.js`), and the build levels a location's pixel
(`terrainTiles.js` blendLocationTerrain, DFU's own: its rect to the pixel's mean, the rest eased toward it out to the
pixel's edge). Whether one stands is the TTL1 clocks (seven days from first entry, two from its clearing, twelve dead
before it stands again) and `_insideSpawn`, read at the build, and the ground stands as built until the pixel is built
again (AUDIT OW5b D2, SPAWN-REBIRTH F2). Two clients that built one pixel on either side of a spawn's death or return
stood on two grounds until both rebuilt. So did a boot's own pixel, built before the clock runs (nothing expires on
NaN), against a client that arrived later. About 30% of the open land can hold a spawn (SPAWN_CHANCE and ELITE_CHANCE,
less SPAWN-THIN's quarter, the sea, the wet plateaus and the roads): 78,930 pixels of the real map. Measured on the
real map (the freeware's WOODS.WLD and CLIMATE.PAK, Basic Roads' arrays, the landforms on; LANDFORM4's pulls toward
towns left out, as a spawn's pixel holds no town), over 161 of those pixels, a one-block ruin's levelling parts the
pixel's ground by a median 1.7 m, 11.8 m at the 90th percentile and 128.8 m at most, half the pixel past the 1.7 m;
within 150 m of the door, where a party meets and its foes stand, by a median 5.5 m and 23.3 m at the 90th, 83% of it
past the 1.7 m. (The landforms' synthetic world: a median 1.5 m, 64.8 m at most.)

The gate itself never stands on a spawn's pixel (`systems/gate/gateSite.js` skips the roll), and a neighbour's
levelling fades to nothing at the pixel's edge, so this is the open land's half; GATE-AGREE is the events'.

FIXED. `groundLocationAt(px, py, stood)` (`world/spawnGroundPlace.js`) is the place the ground is shaped for: what stands there, else online the
spawn the roll stands with the clocks never asked - spawnedDungeonAt's gates (the zone, the roll, the sea, a wet
plateau) and the Overworld's path test, `spawnAt(px, py, { clocks: false })`, none past the Veil. The build shapes the blend, the
location's ground tiles, World of Daggerfall's pick (`hasLocation`), and the woods' and the jungle's clearings for it.
`_liftLocationAt`, the records' lift for a pixel not built yet, reads the same place. What stands is still the clocks':
the ruin's blocks, its door, its plate, its foes, the built entry's `location` that tvSpawnGone reads. A dead spawn's
pixel keeps the ruin's level clearing and its ground tiles, empty, until the spawn stands again. The road network's
late landing is unchanged: a pixel built before it is built again by the roads sweep, and asks again.

THE FOUR HOSTS: `scenes/world.js` is the one host that streams terrain, and both fixes are in its pixel build.
`scenes/exterior.js` (the fixed city) stands no spawned dungeon and no clearing online, and `scenes/worldModes.js` and
`scenes/dungeonContext.js` build no terrain; none is touched.

DFU has no spawned dungeons and no arches; BlendLocationTerrain is DFU's and stays verbatim. World of Daggerfall's pick
is the mod's, and GATE-CLEAR's departure from it is narrowed on its page (`03-World/World-Of-Daggerfall.md`) and its
ledger row (`Port-Ledger.md`, THE ROCK YIELDS TO THE OBLIVION GATE).

## Pins

`test/scenes/fb1024_groundagree.test.js` (5): the module imported and run over a fake world - `groundLocationAt` (what stands, else the
roll's spawn with the clocks off; none offline, past the Veil or in the zone; the roll asked of its own pixel); the
build's wiring (the rect, both `hasLocation`s, both clearings, the lift); on the real producer, a ruin's levelling
moves the ground past a blow's reach and is one ground whoever holds the clocks; and a clearing held over a camp keeps
the pick that levels it, where the old pick refused it and moved the ground past a blow's reach.

Pins moved: `gateclear.test.js` (the pick through the host's composition: the first instance keeps the pixel, held;
the shipped lists' clearing leaves no whole site; the build's source), `tv6_dungeons.test.js` (the Overworld's stand, run through
the module), `auditlandforms.test.js` (B1 and II F1: the lift reads the ground's place), `spawnshore.test.js`,
`terrainworker.test.js`, `tamriel2.test.js`, `wod2_loader.test.js`, `wodbush.test.js`, `fb1002_rocksunk.test.js` and
`roadsclear.test.js` (the lines they quote).

`test/scenes/starfall/starclear.test.js` (the shipped lists' and the player's map's stars, through the same
composition).

`tools/mutants/fb1024_groundagree.json`: 13 mutants, all dead. Fifteen records re-aimed by content in
`auditlandforms.json`, `fb1002_rocksunk.json`, `gateclear.json`, `ow4d.json`, `roadsclear.json`, `spawnshore.json` and
`wodbush.json` - two renamed for what they now kill (GROUND-AGREE-the-lift-asks-the-clocks,
GROUND-AGREE-roll-transposed). Those seven lists run whole: 242 dead, none survived, 6 equivalent as recorded.

## Not verified here

- A camp's levelling (GATE-AGREE) is measured on the synthetic world only; the spawns' on the real map.
- No two-client run: no crowd at a portal was stood up, and how often a crowd's clients hold different arches is not
  measured.
- Other ground a client's own belief can still move, each building its pixel again when the belief turns: the open
  zone's halls at the day's turn, a Hollow's rise (SD2b), World of Daggerfall's late region packs (WOD6), and the road
  network before it lands. A pose still carries its sender's own height, so any ground two clients do not share still
  sinks a peer; standing a peer on the receiver's own ground was the option declined on 2026-10-18 (`Field-Bugs-2026-10-17f.md`).

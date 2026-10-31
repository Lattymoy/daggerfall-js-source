# Red Mountain - the volcano at Vvardenfell's heart (RED-MOUNTAIN)

Opened 2026-10-27 on the Tamriel arc's branch (#1184). The owner, with the lore's own pictures of it (ESO's Morrowind,
UESP's Red Mountain): *"Im not sure they they implemented the red mountain yet but this is the goal. An absolute massive
volcano true to lore that towers in the distance."*

They had not. The heightmap (TAMRIEL-RELIEF, `Tamriel.md`) stands Red Mountain as a swell of 2,343 m in a plateau of about
2 km, a kilometre under Skyrim's High Peaks. Its zone (`Tamriel-Biomes.md`, `morrowindRedMountain`) and its bare, warm ash
(`Peaks.md`, PEAKS1) were there; the mountain was not.

## The decisions

1. **The lore's mountain, in Daggerfall's day (3E 417).** UESP: a volcano at Vvardenfell's centre, its slopes cut by
   lava-carved ravines (foyada) and lava pools, the ash storms born in its crater, the Ghostfence round it with its gate
   in the south. Before the Red Year, so a smoking, burning cone, not a ruin. ESO's pictures show its lava running.
2. **Where.** Red Mountain's summit on the relief, the point the zones about it already stand on (`tamrielBiomes.js`
   heartsAnchor: `namedSummit` where the relief stands, the authored spine's middle else). On the freeware's trace that is
   picture (234.75, 53.75), Bay pixel (3049.6, -50.4).
3. **How big.** A stratovolcano's shape at the scale of this world's Vvardenfell, about 400 km across: the summit about
   7.3 km over the sea, twice the next highest ground on the continent; the crater 5.2 km across and 700 to 840 m deep;
   its flanks about 29 degrees under the rim, 12 at 7 km past it, 3 at the Ghostfence, under 2 by 30 km, and nothing
   past 97 km (AUDIT RED-MOUNTAIN L3: the figures re-measured).
4. **One law of world position, in the kernel.** The cone is the land the player walks, the far views stand and every
   reader of the ground asks - not a picture on the horizon.

## The law (`world/tamriel/redMountain.js`)

`RED_MOUNTAIN_DIALS` holds every number, in metres:

| Dial | Value | What |
|---|---|---|
| `rim`, `floor`, `depth` | 2,600, 1,300, 700 | the rim's radius, the flat floor's, the floor under the rim |
| `lift` | 4,500 | the cone over the land at the rim |
| `lobes` | 5%, radius 1.6 | the rim's height wandering round the crater: the summit is a crown, not a ring |
| `tiers` | 0.54 / 10 km, 0.2 / 35 km, 0.26 / 95 km, each squared | the flank: summit cone, body, shield |
| `keep` | 16,000 | how far down the land's own landforms come back |
| `gully` | 45 deep, grain 4, 24 km | ravines down every flank, deepest where it is steep |
| `foyada` | south-west 11 km, north-east 9 km, north-west 7 km | the lava-cut ravines from breaches in the rim |
| `trough` | 60 deep, half-width 220 to 260, lava 70% | the foyada's own measure |

- `coneProfile(d)` the flank's lift at `d` past the rim; `redMountainFrame()` the centre and the foyada's lines, made
  once a land and a fit.
- `redMountainLand(gx, gy, base, hills, ground)` the land with the volcano stood on it: the crowned cone, the gullies,
  the land's own landforms faded up it, each foyada laid to its floor, the crater laid to its floor.
- `redMountainGround(baseAt, key)` the levels the lava lies at: the crater's one floor, and each foyada's floor down its
  line - only ever falling, never over the lake's, so the lake spills through the breaches. `baseAt` is the land without
  the volcano, read off the world's own bytes (`world/landforms.js` byteBase), so every thread and the far views read one
  set of levels. The kernel lays the ravines to them and the lava is drawn on them: the two never part.
- `redMountainSmooth`, `redMountainLiftAt` the smooth cone (no gully, no foyada) for readers with no feet on the ground;
  `redMountainTopNear` the most it stands over a pixel.

Pure, and one float in every engine (AUDIT LANDFORMS III A8: no `Math.cos`, `Math.exp`, `Math.atan2` or `**`): powers
are products and a square root, the direction's noise is read on a circle in the noise's plane. The terrain worker holds
the same module (TAMRIEL2-WORKER: world/ alone).

## The kernel (`world/landforms.js`)

- **The shaper.** Past the Bay's seam, where the volcano reaches a pixel, its `landAt` stands the land through
  `redMountainLand` - so the pixel's grid, the ghost rows, a road's profile and a promotion all read one ground, and a
  sample on a pixel's edge is one number from both pixels (pinned). Cyrodiil's carved waters and the volcano never meet.
- **A site's level** (`siteLevel`) stands on it too, so a town on its foot stands on the flank, not in a pit.
- **`groundTopOf`** adds `redMountainTopNear`, the snowpack's bound; **`meanGroundField`** the smooth cone, the air's ground.
- **The Landforms row.** The cone is the landforms' own, as the lift is. Without the row the relief's 2.3 km swell
  stands as before, and online the row is always on, so every client stands one mountain.
- **The ceiling.** The land past the Bay stood under LANDFORM_CEILING (3,644 m). The volcano alone stands over it; the
  kernel's shaped samples have no ceiling, and nothing else past the Bay moves.

On the freeware's ground, on the base's large map (its land stands about 450 m higher than this page first measured): the
crater floor 6,508 m, the summit 7,333 m on its west rim, about 4,800 m at 8 km, 4,050 m at 12 km, 3,250 to 3,850 m at
20 km. No town, farm or Arena place stands on its summit cone; eight lairs do, within 12.6 km of its centre - Dagoth Ur's
strongholds, as the lore has them (AUDIT RED-MOUNTAIN R3: this page said no place). Its whole reach is Morrowind's land.

## Its fire and the weather

The lore's ash is never snow (`Peaks.md`: "none - its ash is warm"), and a 7.3 km summit would be.

- **The snow line rides its cone** (`world/peaks/snowcap.js` capLineOfPixel): a zone's line over the cone's lift there,
  so the Ashlands and the Grazelands on its foot stay as bare as their plateau.
- **The air takes its heat** (`systems/weather/airGround.js` heatAt, read by airParamsAt): as much as its cone's height
  cools it down the lapse. Its ash is the plateau's air at any height - no pack lies on it, and nobody freezes on it.
- **The snowpack's levels reach 8,200 m** (`SNOWPACK.levels.count` 45, was 23 to 3,800 m): a place whose ground stood
  over every held level read white over the last.
- **No pack lies on its ash** (`snowcap.js` ashShareAt, `scenes/snowCoverHost.js`): each lattice point's lines are lifted
  to bare ground by the share of Red Mountain's zone about it. AUDIT RED-MOUNTAIN L1: the heat cancelled only the cone's
  own height, the plateau under it froze, and on the coldest day the crater, the rim and the flank lay white.

## The horizon

`render/farRing.js` `ringGroundAt` adds `redMountainLiftAt` with the Landforms row - the far ring, the middle ring's eased
rim and the travel view stand the smooth cone at a pixel's centre. The far field stands it at each vertex's own node
(`redMountainNodeLift`, a pixel corner: RELIEF-PEAKS's node ground). The middle ring runs the kernel itself. So the
summit stands on the horizon to the far field's rim (361 km).

**Its colour.** The far views paint a pixel by the overworld's tint, which reads a byte over 104 as a snowfield, so
the relief's swell stood white on the horizon. The cone's own colour is laid over it by how far the cone lifts the land
(`render/redMountainFire.js` ashTint, `farRing.js` ringTintAt at the ring's, the middle ring's and the far field's tint):
dark ash on its flanks, red-brown rock up its summit cone.

**The haze lies under the summits** (`render/horizonHaze.js` SUMMIT_HAZE, `summitHold` in both lanes' far ring). The
far ring held every distant hill at 85% of the fog's colour, and the cone 60 km off was a faint shape in a tan band
(seen in the game). Ground over 3,700 m - the land's old ceiling, so the cone alone - eases that hold down to 30% of
itself by 6,500 m: the summit stands clear over the haze, and the rim still closes it into the sky. AUDIT RED-MOUNTAIN
F6: the thinner air comes in over 8 km past the streamed grid's edge (`uSummitFrom`), so beside the grid the cone is
hazed as the streamed ground is, and no seam stands where the grid ends.

## The fire (`render/redMountainFire.js`)

- **The lava lake** on the crater's floor, a fan of 1.2 km, and **the lava** down the upper 70% of each foyada on its
  floor - a crust and its melt churning, hottest at the breach, its own light.
- **The ash plume** from the lake: 8.5 km tall, 850 m in radius at its foot (inside the crater's floor) swelling from
  the rim to 9 km at its top, leaning east-north-east. It is drawn its far side first, its near side over it. Its billows are noise in the world's own space, rising through it, so it is a column of ash and
  never a funnel. The sun lights its sunward side, and the crater's fire is a glow in its foot, muted by day.
- **Drawn in the far ring's pass**, after the land, twice: by the world's lens nearer than its far plane, and past it by
  its own lens at the far plane - one haze law in both, the far ring's own, and nothing drawn twice (the far draw drops
  what is nearer than the world's far plane).
- **Hidden by the cone where no depth stands** - past the far plane, and past the streamed grid's built pixels
  (`hidden`): the eye's ray stepped against the cone's profile and its crown (the rim's wander, 64 samples round)
  within 22.6 km of its centre, tested at the rim's crest where it crosses it, and asked to 300 m short of the point.
  The profile stands on the land at the centre, and the land falls away from the plateau, so its error at the eye's
  own ground is given back at the eye, none by the rim.
- AUDIT RED-MOUNTAIN F1: the ray stopped at 97% of the way, so from 100 km the crater wall lay in the 3 km never asked,
  and the eye's slack was given back the whole ray - from low land far off, the lake showed through the summit. A river
  is never thinner than a few pixels: a line of fire at night.
- **Its door** is `?redfire=off`. It stands with the Landforms row, and where the far ring is drawn - in a clear day's
  linear fog, not in rain or snow. Its programs are started at the boot's idle and its pass built through a door that
  never waits on their compile (AUDIT RED-MOUNTAIN F5).

## The Ghostfence (GHOSTFENCE)

Opened 2026-10-27, the owner: *"Im really wanting to push this beyond limits and make it some truely amazing and lore
accurate."* UESP: the Tribunal raised the Ghostfence round Red Mountain after the Battle of Red Mountain to hold Dagoth
Ur and the Blight within it, a ring of pylons the ancestors' spirits hold up; no body passes it but at Ghostgate, the
fortress in its south, its Tower of Dawn and Tower of Dusk either side of the gate. In 3E 417 it stands, and nobody
lives past it. No one walks or rides past it but at Ghostgate; one who levitates may fly over it, as in the lore (AUDIT
RED-MOUNTAIN R10).

- **The ring** (`world/tamriel/ghostfence.js`): 14 km from the volcano's centre, wandering 5% either way - past the
  summit cone, where the flank eases to 3 degrees, every foyada's end within it. A pylon every 48 m (1,833), each on
  its turn of the ring by `dirOf`'s series, so every engine stands the same fence. Ghostgate is the pylon due south.
- **The pixels it crosses** (`band`): a closed, 4-connected line, so no step of eight directions crosses it. The
  countryside keeps off every pixel whose centre lies within the fence or a pixel past it (`insideGhostfence`, read by
  countryPick - the world host's roll, the held map's, the roads' worker's); no lair stands on its line
  (`onGhostfence`, lairStandsAt and lairMayStandAt); and the roads' build routes round it, Ghostgate's pixels open
  (`ghostfenceRoadBlocks`, tamrielRoads.js). The lairs within it stand - the mountain's own strongholds and ruins. No
  spawned ruin stands on its line (`createSpawnGround`), and the Overworld's route planner crosses it only at Ghostgate
  (`ghostfenceShuts`, travelRoute.js routeGround) - AUDIT RED-MOUNTAIN G1 and G2. GROUND_ROLL_VERSION 6 lays every
  client's roads past the Bay again; its fingerprint reads the line and the gate (G3).
- **On the freeware's trace** the line lies on Morrowind's land in Red Mountain's zone; it kept off 21 places of the
  countryside (3 villages, a hamlet, farms, inns and temples, up to 6 km high on the summit cone) and 2 lairs on its
  line. No Arena place stands within it (AUDIT RED-MOUNTAIN G4: the count and the zone re-read).

**Stood in a pixel's build** (`scenes/ghostfenceBuild.js`, called by `scenes/pixelBuild.js` past the Bay, before the
bucket settles - no host grows). Each pylon stands on the ground at its centre, turned to the fence, a footing carried
down to the lowest ground under its plinth on a slope (`ghostfenceModel.js` PYLON, pylonFooting): a basalt plinth, an
eight-sided shaft banded at its middle, a collar, four horns curling in to 28.6 m, and the orb they hold at 24.8 m.
Ghostgate (GHOSTGATE) is its two towers 37 m tall and the lintel over the passage, an orb on each. Both go in the
pixel's batch on GHOSTFENCE_ARCHIVE's own pictures - the stone in Daggerfall's colours (`dfLook`), the orb its own
light (an emission map).

AUDIT RED-MOUNTAIN N4 and R11: seated on its lowest ground, a pylon was buried uphill to 24 m; the page had the orb at
the horns' tip and the towers 3 m too tall.

**Solid** through the world's one gate (player/lateSolid.js): each pylon's plinth and shaft, its footing, the towers and
the lintel, and the curtain between the pylons in pieces of 6.4 m at most, cut at every pixel's edge
(`ghostfenceRunCuts`). The pixel holding a piece's middle builds it, from 4 m under its lowest ground to the collars over
its highest, read exactly on the drawn triangles (`groundAlong`), one solid a run. The passage under the lintel is open.
AUDIT RED-MOUNTAIN N1: a run was one flat quad on its two feet - gullies opened under it and ridges buried its top, and a
body walked through at 22 runs.

**Nothing stands in the lava or on the line** (LAVA-CLEAR, FENCE-CLEAR, at the fold into #1184). On the freeware's
ground the kernel laid 449 of TESA-LANDS' scoria spires and 9,887 flats on the lava's beds (81,748 flats with the lands'
row off), and flats and landmarks within 8 m of the line. The build now keeps them off the beds - the crater's floor,
and the middle half of each foyada's floor down its lava's run (`redMountainLavaBed`), the lava 17 m inside - and 8 m
off the line and Ghostgate's span, a landmark 8 m past its reach (`fireClearing`, `ghostfenceNear`). A place levels
its pixel, so no lair, spawn, gate, star or Hollow stands on a pixel a bed reaches (`redMountainLavaIn`), nor a gate,
star or Hollow on the line. Today 17 of those 68 pixels roll a spawn; no lair site or gate pixel stood on either.

**Its ghost-light** (`render/ghostfenceGlow.js`): the curtain between the pylons, strands of light climbing it, and a
halo about each orb, never under a few pixels. It is drawn after the water and the flats (the renderer's `afterFlats`,
armed by the far ring: it writes no depth, and drawn before them it was painted over - N2), in the fire's two lenses,
hidden by the cone where no depth stands (a margin of 250 m), even with the fire off; with no cone it has no far draw.

The curtain stands point by point (8 a run, `ghostfenceCurtainPoint`) on the ground its layer draws: a built pixel's own
(`noteFenceFeet`, the build's, for its frame alone - N6), the middle ring's kernel eased onto the far ring as that ring
eases, the far ring's - each read on its ring's own triangles, a point on no ring dropped (N5). The kernel stands up to
about 130 m off the far views' smooth ground there. By day it keeps 30% of its night's light; the curtain fades out by
12 km, the halos by 45 km. Its door is `?fenceglow=off`.

## Recorded departures and readings

- DFU stops at the Bay's edge. The volcano, its fire and its heat are the port's own (Port-Ledger section A,
  RED-MOUNTAIN).
- The snowpack's levels reach 8 km (section A's BIOME PRECIPITATION law; the classic lane is untouched).
- The plume leans the same way every day: no wind is read (the rite smoke's own reading).
- The lava casts no light on the ground. The lava and the plume are not drawn under a weather fog, nor where the far
  ring is not (the classic skin, the heavy fog, the sandstorm, `?ring=off`).
- The Ghostfence stands with the Landforms row or without it (the Tribunal's, not the land's). Its curtain and halos
  are the far ring's pass: on the classic skin, in rain, snow or ASHFALL1's ashfall (exp fog, Red Mountain's half of
  its hours) and by `?ring=off` its pylons stand and their orbs glow, without them.
- **RED-MOUNTAIN-SEEN** (FIELD FEEDBACK 2026-10-31, #feature-feedback: "Red Mountain doesn't always render, not sure if
  bug or just issue with how distant terrain works. Or an issue with my setup."). Past the streamed grid the cone stands
  in the far views alone, and they were drawn under a linear fog row only. Every exp row has hidden the ground by the
  grid's edge at the default Land View (4,096 m): the rain 5e-6 of it, the ash 2e-11, Dynamic Skies' overcast 8e-5, a
  rain sprinkle's thinnest 4.6%. Under a sky drawn clear (`excludeSky`: rain, snow, the ash, and with Dynamic Skies on,
  its overcast) the land's shape against the sky went with them: the cone went with the sun, and came back with it.
- Now such a row stands the far views (`render/farRing.js` `ringFogOf`, no summit in thinner air); a fog over the sky
  (the heavy fog, the sandstorm) stands none - there is no shape to see. The host hands the frame's row
  (`world.js:"    if (farRing && ringFogOf(fogNow)) {"`).
- **AUDIT FB1031 L2.** The far views had stood wholly in the fog's colour, but at a nearer Land View the streamed ground
  still shows at the grid's edge: a sprinkle 54% of it at Land View 1 and 16% at 3, Dynamic Skies' exp2 rows 69% at 1.
  So a seam stood there. Now the far views fog by the row's own law and density (`render/horizonHaze.js` horizonHazeOf,
  the uniform `uFogLaw`: 1 - the world's exp or exp2 factor at their distance) - the ring, the middle ring, the far
  field and the band's trees alike. At the grid's edge they show what the ground shows at Land View 1, 3, 4 and 5 (the
  seam 0 in every row), and past it they close to the fog. The law reads no place, so it holds in every province.
- **What shows by day** (AUDIT FB1031 L3, measured on the port's dome, the enhanced sky without Dynamic Skies). The cone
  stands against the sky in rain, snow and ash. In the rain the fog is the sky's horizon (157, 171, 185 at noon), paler
  than the sky behind the cone up to 5 degrees (the dome 139 to 152, the deck 109 to 141). In the snow it is DFU's grey,
  128, darker than the sky behind (132 to 188); in the ash the same grey, 8 to 24 levels in 255 from it.
- **What shows at night** (AUDIT FB1031 L3). In the rain the fog is the sky's own horizon (53, 58, 68 at 23:00), 1 to 6
  levels in 255 from the dome behind the cone: it is not seen, as a mountain 50 km off is not in night rain. In a whole
  snow or ash the far views stand in DFU's grey over the dark sky (128 against 51 to 55), a grey skyline, as the
  streamed ground's far hills stand. In a dusting the fog is the sky's colour, as in the rain, and between the two it
  eases (`07-Rendering/Weather-Arc.md` AUDIT FB1031 L4). Under Dynamic Skies the fog is the mod's own colour, lit at
  night (NIGHT-FOG): not measured here.
- **The night's grey, decided** (AUDIT FB1031 L4). DFU fogs Color.gray past the rain's density at every hour
  (DaggerfallSky.SetSkyFogColor, DaggerfallSky.cs:310-330; WeatherManager.SetFog writes no outdoor colour, and
  SunlightManager has no fog). The far views do not take the sky's light apart from the ground: they stand in the colour
  the streamed ground closes into at the grid's edge, and a far view lit apart would put a step there. The grey skyline
  at night is the world fog's. A darker snow at night would be a change to the world's fog for the whole frame - OPEN,
  the owner's call.
- Not changed: after a fast travel past the far field's reach (480 pixels about its base) the ring alone closes the
  horizon at 28 km until the new field is laid - in node a cold field took 1.3 s about Vvardenfell and 0.26 s in the Bay,
  a band at a time between the stream's pixel jobs; a nearer jump keeps the old field standing. On the classic skin, and
  offline with the Landforms row off, no cone stands past the grid. The far field's rim is 361 km.
- Ghostgate is the gate alone: no Temple compound, no garrison, no road to it (nothing within the fence is a road's).
- ASHFALL1's ashfall (`07-Rendering/Weather-Arc.md` E) falls on Red Mountain's zone half its hours, the Ashlands' 30%.
  It is the zone's weather: not born in the crater, as the lore's storms are, and the plume does not feed it.
- Not yet: Dagoth Ur's citadel in the crater, the held map's caret for the cone (its bytes are the relief's).

## Pins

- **`test/world/redmountain_seen.test.js` (3)** and **`tools/mutants/redmountainseen.json` (13, all dead):** the rows
  (the classic and Dynamic Skies'), the reading at the grid's edge, the draw under a GL stub (the ash, clear air, the
  heavy fog) and the host by source. **AUDIT FB1031 L2:** `test/render/fb1031_light.test.js` (the law at every Land
  View's edge on the shader's own text, the draw handing it to the ring and the band's trees) and
  `tools/mutants/fb1031_light.json`; PIN MOVED: the rows' shapes here (their law and density),
  `test/render/farsea1.test.js`, `test/render/fartrees.test.js` and `test/systems/dynamicSkies.test.js` (the shaders'
  call), four of this list's mutants and EL-DISTANCE's far-ring one re-aimed by content. **PIN MOVED:** `test/ui/farring.test.js` and `test/render/farsea1.test.js` (the
  gate), `test/render/tv4_weather_above.test.js` (the reading, the ash added), `test/systems/dynamicSkies.test.js` (the
  row handed whole).

- **`test/world/redmountain.test.js` (8, one gated on ARENA2):** the flank's measure and its directions; the frame on
  the authored shape and on a fit; the land (past its reach to the bit, the floor, the crown, the keep, the breach, each
  foyada's floor its level and never rising, the gullies' depth, the bound over a pixel); the kernel (the floor at the
  centre's bytes, the seams, groundTopOf, a site on the flank); by source and the A8 law; its fire and its horizon (the
  cap line, the air's heat, the levels, the ring and the field, the mean ground); the fire (its profile, its mesh, the
  shader's hiding run on its own source, the far ring's wiring and door); and on the freeware's trace the rim over
  6.5 km, 3 km over its plateau, its reach on land, the zone at its centre Red Mountain's, no Arena place on its cone.
- **Mutants** `tools/mutants/redmountain.json` (37, all dead - the rim's crest no longer marked equivalent: AUDIT
  RED-MOUNTAIN R2 found the eye it matters to, 20 km out on the flank).
- **`test/world/audit_redmountain.test.js` (16, one gated on ARENA2)** and **`tools/mutants/audit_redmountain.json`
  (51)**: every finding of AUDIT RED-MOUNTAIN pinned where it was fixed (`01-Overview/audits/Audit-Red-Mountain.md`).
- **`test/world/ghostfence.test.js` (11, two gated on ARENA2):** the ring (radius, wander, spacing, tangents, Ghostgate
  due south, the line closed against an 8-step walk, the gate's pixels the only open ones); the places and the roads;
  the real roads' builder joining two towns round it; the models, the passage open; the build (each seat and footing,
  the solids, the curtain's pieces over their exact ground, the feet, Ghostgate); the glow (the feet on each layer's
  triangles, a stale note unread, the shaders on their own sources, the wiring and door); the A8 law; LAVA-CLEAR and
  FENCE-CLEAR (the drawn lava on its beds, the pixels, the clearance, a landmark's reach, the readers); and on the
  freeware's ground no countryside within the fence and no flat or spire left on the beds or the line. **Mutants**
  `tools/mutants/ghostfence.json` (49, all dead).
- **PIN MOVED (GHOSTFENCE):** `test/world/road/river_fords.test.js` and `test/world/rumarewater.test.js`
  (GROUND_ROLL_VERSION 6), `test/world/audittesa2r_roads.test.js` (6's fingerprint, its fixture off the fence),
  `test/combat/blood1_decals.test.js` (the tenth bucket translation, the fence's).
- **PIN MOVED:** `test/render/precip4_snowground.test.js` (the levels' count 44); `test/render/farsea1.test.js` and
  `test/systems/dynamicSkies.test.js` (the ring's haze line, `summitHold`); `test/systems/l10n4_hardcoded.test.js` (the
  fire's shader sources, 3; the range's key `RED_MOUNTAIN` exported from `tamrielBiomes.js`). Re-aimed by content:
  `tools/mutants/audit_farsea1.json` (the pass's depth range put back after the fire) and `tools/mutants/farlandmark.json`
  (the far field's law asks the cell's highest), `tools/mutants/eldistance.json` (the lane's ring line, `summitHold`).
- **PIN MOVED (AUDIT RED-MOUNTAIN):** `test/world/ghostfence.test.js` (the build: N1 and N4; the glow: N1, N5, N6; the
  wiring: F5, F9), `test/world/redmountain.test.js` (the fire's wiring: F5; `summitHold` by the distance: F6; R4's two
  checks of a law against itself), `test/world/audittesa2r_roads.test.js` (6's print with the fence's line, G3). Re-aimed
  by content: `audit_farsea1.json`, `audit_perfpass.json`, `aurastall.json`, `eldistance.json`, `ow4j.json`,
  `owwod.json`, `peaks1.json`, `spawnshore.json`, `tamrielrelief.json`, `wilddry.json`, and `ghostfence.json`'s seat
  (its mutant now the old lowest seat).
- **PIN MOVED (the merge with #1184, one Red Mountain):** `test/world/reliefpeaks.test.js` (RELIEF-PEAKS's cone retired),
  `test/render/precip4_snowground.test.js` (the levels' count 45), `test/scenes/perfcol2.test.js`,
  `test/combat/blood1_decals.test.js`, `test/world/road/river_fords.test.js`, `test/systems/l10n4_hardcoded.test.js`
  (`tamrielRanges.js` holds no English). Re-aimed: `reliefpeaks.json` (5 cone records gone), `farlandmark.json`.
- **PIN MOVED (LAVA-CLEAR):** `test/world/ghostfence.test.js` (the lairs' two lines read the lava too).
- **The probe** `tools/redMountainProbe.mjs` photographs it in the real game from stations about it, day and night.

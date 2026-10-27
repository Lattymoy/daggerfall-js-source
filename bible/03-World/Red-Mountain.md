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
3. **How big.** A stratovolcano's shape at the scale of this world's Vvardenfell, about 400 km across: the summit 6.9 km
   over the sea, twice the next highest ground on the continent; the crater 5.2 km across and 840 m deep; its flanks about
   29 degrees under the rim, 10 at 7 km out, 1 at 30 km, and nothing past 97 km.
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

On the freeware's ground: the crater floor 6,047 m, the summit 6,885 m on its west rim, 4,400 m at 8 km, 3,600 m at
12 km, 2,900 to 3,200 m at 20 km. No place past the Bay stands on its summit cone; its whole reach is Morrowind's land.

## Its fire and the weather

The lore's ash is never snow (`Peaks.md`: "none - its ash is warm"), and a 6.9 km summit would be.

- **The snow line rides its cone** (`world/peaks/snowcap.js` capLineOfPixel): a zone's line over the cone's lift there,
  so the Ashlands and the Grazelands on its foot stay as bare as their plateau.
- **The air takes its heat** (`systems/weather/airGround.js` heatAt, read by airParamsAt): as much as its cone's height
  cools it down the lapse. Its ash is the plateau's air at any height - no pack lies on it, and nobody freezes on it.
- **The snowpack's levels reach 8,000 m** (`SNOWPACK.levels.count` 44, was 23 to 3,800 m): a place whose ground stood
  over every held level read white over the last.

## The horizon

`render/farRing.js` `ringHeightAt` adds `redMountainLiftAt` with the Landforms row - the far ring, the middle ring's eased
rim and the travel view stand the smooth cone at a pixel's centre. The far field asks the cone's highest in its 6.5 km
cell (`half` FAR_CELL / 2), as its byte is its highest. The middle ring runs the kernel itself. So the summit stands on
the horizon to the far field's rim (361 km).

**The haze lies under the summits** (`render/horizonHaze.js` SUMMIT_HAZE, `summitHold` in both lanes' far ring). The
far ring held every distant hill at 85% of the fog's colour, and the cone 60 km off was a faint shape in a tan band
(seen in the game). Ground over 3,700 m - the land's old ceiling, so the cone alone - eases that hold down to 30% of
itself by 6,500 m: the summit stands clear over the haze, and the rim still closes it into the sky.

## The fire (`render/redMountainFire.js`)

- **The lava lake** on the crater's floor, a fan of 1.2 km, and **the lava** down the upper 70% of each foyada on its
  floor - a crust and its melt churning, hottest at the breach, its own light.
- **The ash plume** from the lake: 7.5 km tall, 0.9 km at its foot, 6.5 km at its top, leaning east-north-east; the rite
  smoke's law (`riteSmoke.js`) at a volcano's size. Lit as the frame is; the crater's fire a glow in its foot.
- **Drawn last of the far ring's pass**, twice: by the world's lens nearer than its far plane, against the world's depth,
  and past it by its own lens at the far plane. The far pass has no depth, so there the cone hides the fire
  analytically (`hidden`): the eye's ray stepped against the cone's profile within 22.6 km of its centre, and tested
  at the rim's crest where it crosses it. The profile stands on the land at the centre, and the land falls away from
  the plateau, so its error at the eye's own ground is given back - the first photograph from 60 km showed no fire,
  every ray starting "inside" the model. A river is never thinner than a few pixels: a line of fire at night.
- **Its door** is `?redfire=off`. It stands with the Landforms row, and where the far ring is drawn - in a clear day's
  linear fog, not in rain, snow or an ash storm.

## Recorded departures and readings

- DFU stops at the Bay's edge. The volcano, its fire and its heat are the port's own (Port-Ledger section A,
  RED-MOUNTAIN).
- The snowpack's levels reach 8 km (section A's BIOME PRECIPITATION law; the classic lane is untouched).
- The plume leans the same way every day: no wind is read (the rite smoke's own reading).
- The lava casts no light on the ground, and the plume is not drawn when the far ring is not (bad weather, `?ring=off`).
- Not yet: the Ghostfence and Ghostgate, Dagoth Ur's citadel in the crater, ash storms as weather, the held map's caret
  for the cone (its bytes are the relief's).

## Pins

- **`test/world/redmountain.test.js` (8, one gated on ARENA2):** the flank's measure and its directions; the frame on
  the authored shape and on a fit; the land (past its reach to the bit, the floor, the crown, the keep, the breach, each
  foyada's floor its level and never rising, the gullies' depth, the bound over a pixel); the kernel (the floor at the
  centre's bytes, the seams, groundTopOf, a site on the flank); by source and the A8 law; its fire and its horizon (the
  cap line, the air's heat, the levels, the ring and the field, the mean ground); the fire (its profile, its mesh, the
  shader's hiding run on its own source, the far ring's wiring and door); and on the freeware's trace the rim over
  6.5 km, 3 km over its plateau, its reach on land, no place on its cone.
- **Mutants** `tools/mutants/redmountain.json` (33: 32 dead, 1 equivalent as recorded - the rim's crest, which the
  profile's crowded steps already catch).
- **PIN MOVED:** `test/render/precip4_snowground.test.js` (the levels' count 44); `test/render/farsea1.test.js` and
  `test/systems/dynamicSkies.test.js` (the ring's haze line, `summitHold`); `test/systems/l10n4_hardcoded.test.js` (the
  fire's shader sources, 3; the range's key `RED_MOUNTAIN` exported from `tamrielBiomes.js`). Re-aimed by content:
  `tools/mutants/audit_farsea1.json` (the pass's depth range put back after the fire) and `tools/mutants/farlandmark.json`
  (the far field's law asks the cell's highest), `tools/mutants/eldistance.json` (the lane's ring line, `summitHold`).
- **The probe** `tools/redMountainProbe.mjs` photographs it in the real game from stations about it, day and night.

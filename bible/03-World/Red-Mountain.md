# Red Mountain

The volcano at Vvardenfell's heart: a lore-true stratovolcano about 7.3 km over the sea, twice the next highest ground
on the continent, with a crater lake of lava, lava-cut ravines (foyada), an ash plume, and the Ghostfence round it with
Ghostgate in its south. It stands in Daggerfall's day (3E 417), before the Red Year. The player sees it towering on the
horizon from much of Morrowind and can walk its flanks.

## How it works

- **The law** (`src/world/tamriel/redMountain.js`). `RED_MOUNTAIN_DIALS` holds every number in metres: the rim's radius
  2,600, the crater floor's 1,300, the floor 700 under the rim, the cone 4,500 over the land at the rim, a wandering
  crown, three flank tiers, gullies down every flank and three foyada from breaches in the rim. `redMountainLand`
  stands the volcano on the land; `redMountainGround` gives the levels the lava lies at, only ever falling, so the lake
  spills through the breaches. `redMountainSmooth` and `redMountainLiftAt` are the smooth cone for far readers. The law
  is pure, one float in every engine, and runs in the terrain worker.
- **The kernel** (`src/world/landforms.js`). Past the Bay's seam, where the cone reaches a pixel, the land is
  `redMountainLand`, so the grid, roads, promotions and site levels (`siteLevel`) all read one ground. The cone belongs
  to the Landforms row; online the row is always on. The volcano alone stands over the land's ceiling past the Bay.
- **Its heat.** The snowline rides its cone (`src/world/peaks/snowcap.js` `capLineOfPixel`). The air takes its heat
  (`src/systems/weather/airGround.js` `heatAt`), so nobody freezes on it, and no snowpack lies on its ash
  (`ashShareAt`).
- **The horizon.** `src/render/farRing.js` `ringGroundAt` adds the smooth cone to the far ring and travel view; the far
  field stands it at each node. Its own ash and rock colours lay over the overworld tint (`ashTint`). The haze eases
  under the summit (`src/render/horizonHaze.js` `SUMMIT_HAZE`), so the cone stands clear over it. Under a weather fog
  that leaves the sky clear (rain, snow, ash, Dynamic Skies' overcast) the far views are drawn too, fogged by that fog's
  own law and density (`src/render/farRing.js` `ringFogOf`, `horizonHazeOf`), so no seam stands at the grid's edge. A
  fog over the sky, the heavy fog or the sandstorm, stands no far view.
- **The fire** (`src/render/redMountainFire.js`). The lava lake on the crater floor and lava down the upper 70% of each
  foyada; an 8.5 km ash plume leaning east-north-east, lit on its sunward side. Drawn in the far ring's pass, in two
  lenses, hidden by the cone where no depth stands. Under weather it fogs by the weather's own law from the world fog's
  point (`hazeAt`), so each draw keeps what the land keeps at its distance. `?redfire=off` turns it off.
- **The Ghostfence** (`src/world/tamriel/ghostfence.js`). A ring of pylons 14 km from the centre, one every 48 m, with
  Ghostgate the pylon due south. Its pixel band is a closed line: the countryside keeps off it (`insideGhostfence`), no
  lair stands on it, the roads route round it with Ghostgate open, and the Overworld's route planner crosses it only at
  Ghostgate. `src/scenes/ghostfenceBuild.js` stands the pylons and Ghostgate's two towers and lintel in a pixel's build
  (`src/world/tamriel/ghostfenceModel.js`), in Daggerfall's colours. Plinths, shafts, towers and the curtain between
  pylons are solid; the passage under the lintel is open.
- **Ghost-light** (`src/render/ghostfenceGlow.js`): the curtain, strands climbing it and a halo round each orb, drawn
  after water and flats on the ground each ring draws, fogged as the fire is. `?fenceglow=off` turns it off.
- **What shows in weather.** By day the cone stands against the sky in rain, snow and ash. At night in rain the fog is
  the sky's own colour, and the cone is not seen. In a whole snow or ash the fog is DFU's grey, so the far views stand
  as a grey skyline over the dark sky (`07-Rendering/Weather-Arc.md`).
- **Clear ground.** No flat, spire or landmark stands on the lava beds (`redMountainLavaBed`) or within 8 m of the fence
  line; no lair, spawn, gate, star or Hollow stands on a pixel the lava reaches.

## Rules

- An absolute massive volcano, true to lore, towering in the distance (the owner). Pushed beyond limits and lore
  accurate, the Ghostfence included (the owner).
- One law of world position in the kernel: the cone is the land the player walks, not a picture on the horizon.
- Placed at the relief's summit, where the zones round it stand (`src/world/tamriel/tamrielBiomes.js`).
- Nobody walks or rides past the Ghostfence except at Ghostgate. One who levitates may fly over it.
- The lairs within the fence stand, Dagoth Ur's strongholds; no town, farm or Arena place stands on the summit cone.

## Daggerfall Unity

DFU stops at the Bay's edge. The volcano, its fire, its heat and the Ghostfence are the port's own. Readings kept:

- The plume leans the same way every day: no wind is read.
- The lava lights nothing on the ground. The lava, plume, curtain and halos are the far ring's pass, so they are absent
  on the classic skin, in the heavy fog or the sandstorm, or with `?ring=off`. The pylons and orbs stand regardless.
- Ghostgate is the gate alone: no Temple compound, garrison or road.
- The zone's ashfall is its weather, not born in the crater.

## Code and tests

- `src/world/tamriel/redMountain.js` - the cone, gullies, foyada and lava levels
- `src/render/redMountainFire.js` - lake, lava, plume and its hiding
- `src/world/tamriel/ghostfence.js`, `src/world/tamriel/ghostfenceModel.js`, `src/scenes/ghostfenceBuild.js`,
  `src/render/ghostfenceGlow.js` - the Ghostfence
- `test/world/redmountain.test.js` - the profile, land, kernel seams, heat, horizon and fire; on ARENA2 the rim, reach
  and zone
- `test/world/audit_redmountain.test.js` - the audit's pins
- `test/world/redmountain_seen.test.js`, `test/render/fb1031_light.test.js`, `test/world/fb1031ii_fire.test.js` - the
  far views and the fire under each fog row
- `test/world/ghostfence.test.js` - the ring, band, build, solids and glow
- `tools/mutants/redmountain.json`, `tools/mutants/redmountainseen.json`, `tools/mutants/fb1031_light.json`,
  `tools/mutants/fb1031ii_fire.json` - the mutants

## Open

- Dagoth Ur's citadel in the crater is not built.
- The held map has no caret for the cone.
- A night snow or ash darker than DFU's grey is the owner's call: it would change the world's fog for the whole frame.

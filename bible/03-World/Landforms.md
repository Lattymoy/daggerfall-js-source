# Landforms

The port's own terrain on top of Daggerfall's: the heightmap raised so ranges read as mountains, roads graded and cut
in, rivers lying in channels, towns standing in their land instead of pits, rolling hills, and each climate wearing its
own hills, with sharp tall Dragontail and Wrothgarian peaks. The player walks it everywhere outdoors. Past the Bay the
continent's own landforms take over (`Tamriel.md`).

## How it works

`src/world/landforms.js` is one function of world position inside the terrain kernel: `sampleKernel`'s `landform`
argument (`src/world/terrain/terrainSampler.js`), so every reader (a pixel's samples, the ghost rows its edge normals
read, a promotion's restride, the gate's beacon) gets the same ground, and a sample on a pixel's edge is the same number
from both pixels. Its inputs are world position, WOODS.WLD and the road network.

- **The knee.** At or under `LANDFORM_KNEE` (the beach line with its jitter) a height is DFU's exactly, and a height
  over it never falls under `LANDFORM_FLOOR`. The sea, the beach, every tile class and every water reader stand where
  they stood. A location's tiles and nature's beach test are read from DFU's own blend, which the kernel writes in the
  same pass, so landforms move the ground, never a tile.
- **The heightmap raised** (`reliefLift`). The small-heightmap term alone is lifted, nothing up to 200 units over the
  knee, then eased in toward 0.9 of it by a smoothstep.
- **Roads cut in.** A road or track is graded to the kernel's macro height along the network's own centre line, so the
  cut runs under the painted tiles; Basic Roads' own smoother still runs after. A road eases the hills beside it.
- **Rivers in the land.** Basic Roads' rivers and streams take the same cut, dropped under the land: a flat floor across
  the painted width with a bank on the high side and a levee on the low.
- **A town stands in its land** (`landformSites`). Every one of the game's own locations is a site from its footprint,
  read off the map table (and through the world-data door where a town pack replaces it), handed to both kernels before
  the first pixel. Each site pulls the ground round it so the rise is not one wall inside its pixel.
- **The land rolls** (`hillsAt`). A field of hills over every land sample: three octaves of Perlin noise at 1.9 km,
  800 m and 320 m, scaled by the land's own macro height.
- **Each climate its own land** (`LANDFORM_DIALS.lands`). Each CLIMATE.PAK value names a land with its own shape and
  dials, centred so the land's mean height is untouched.
- **Mountains sharp.** The Mountain land's peaks are sharp and tall; the mountain woods keep rounder bells.
- **Saves in DFU's frame.** Every exterior height a record carries (the player, piles, camps, foes, the scene cache,
  the ship's deck, the recall anchor) is written with the landforms' lift at its spot taken off (`landformLiftAt`), and
  put back on read, so a save reads the same with landforms on or off.
- **Past the Bay.** The lift continues past the 7-bit top under `LANDFORM_CEILING`; the climate hills give way to the
  continent's landforms (`src/world/tamriel/tamrielLandforms.js`) over 8 pixels past the seam. Sites past the Bay come
  from places every client stands (`landformSitesBeyond`), and saves there use the same frame.

## Rules

- Raise the heightmap, carve roads through terrain, give rivers depth, without breaking anything (Mac).
- Detailed generation, rolling hills, varied terrain; this is not about being 1:1 with DFU (Mac). Go all out per climate
  (Mac). Mountains more pointed, sharper and taller (the owner).
- The Features row `landforms` (Enhanced, World), on by default and forced on online; `?landforms=off` the offline kill
  door. On the classic skin and with the row off, every height is DFU's to the bit.
- Every height is derived on the player's machine from the player's own WOODS.WLD; the reference picture is game data
  and never enters the repository.
- A mod's added location and a spawn never move the ground, so every client of a room stands on one.

## Daggerfall Unity

DFU's `DefaultTerrainSampler` and `BlendLocationTerrainJob` are the classic kernel, bit-identical with landforms off
(`kernelTerms` factors its bicubic terms without changing them). Departure (LANDFORMS): everything above the knee.

## Code and tests

- `src/world/landforms.js` - the shaper, the knee, sites, hills, lands, the lift frame
- `src/world/terrain/terrainSampler.js` - the kernel that carries it
- `test/systems/landform.test.js` - the knee, lift, seams, roads, rivers, sites, the saves' frame, the switch, the
  worker byte for byte, the ceiling
- `test/world/terrain/auditlandforms.test.js`, `test/world/terrain/auditlandforms3.test.js` - the audits' pins, the
  law written out a second time

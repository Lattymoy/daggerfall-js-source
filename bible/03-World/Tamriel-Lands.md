# The Lands Past the Bay

Every biome zone past the Iliac Bay wears its own ground, grows its own nature flats and stands its own landmarks, so
Skyrim, High Rock, Hammerfell, Summerset, Elsweyr, Black Marsh and Morrowind each look like their lore. Cyrodiil has
the Jungle of Bantha (`Bantha-Jungle.md`) and Valenwood its graht-oaks (`Graht-Oaks.md`); Black Marsh's Blackwood is one
country with Cyrodiil's. The zones themselves are `Tamriel-Biomes.md`'s. The table is
`src/world/tamriel/tamrielLands.js` (`LANDS`).

## How it works

- **The ground: a zone's dress** (`src/world/tamriel/groundDress.js`). Daggerfall grows its ground from four sets of 56
  tiles (TEXTURE.002, .102, .302, .402). A dress lays the zone's colours over the set as it is drawn (the classic records
  or the texture pack worn over them), keeping the set's grain, tile shapes and transitions. Each class (water, dirt,
  grass, stone, paving) has a prototype read off the set; transition texels share classes softly, then crisply. A
  dressed class is a gradient map: a four-colour ramp from the zone's research, read at the texel's luminance, with
  some of the texel's own noise kept, laid at an albedo that matches the renderer's light. Flecks (pumice, tundra
  cotton, petals) are single-texel cells. The dress runs on its own worker, the page's thread the fallback.
- **Never dressed:** water (its alpha carries the puddle mask), the town's paving, and every winter set. A snowless
  winter set is its summer's, dressed.
- **The growth** (`src/world/terrain/terrainNature.js` `layoutLands`). A zone's recipe lays Daggerfall's own nature
  flats (TEXTURE.500-510, any climate's) by the forest law, with the zone's woods share (the field's quantiles measured
  over the continent, `FOREST_QUANTILES`, `tools/landsMeasure.mjs`), its tree picks in a wood and cover picks on a plain.
  Flats are chosen as they stand: Low Poly Trees replaces most nature records with its own mesh, so dead trees come from
  `DEAD_TREES`. Skyrim's four Lands zones also grow the port's plant archive (`SKYRIM_FLORA_ARCHIVE` 38362,
  `src/world/tamriel/skyrimFlora.js` / `skyrimFloraArt.js`, pictures under `src/assets/skyrim/flora/`) as crossed cards and
  hanging moss (`skyrimFloraMesh.js`). Artists preview a full Lands pixel at `/2d-playground`
  (`src/tools/floraPlayground.js`).
- **The landmarks** (`src/world/lands/landProps.js`, `src/world/lands/landPropMesh.js`). Features no flat stands,
  procedural low-poly meshes from each kind's seed, flat-shaded, three LODs: Morrowind's parasols, pods and xylaria;
  spires, hoodoos, crags, standing stones and termite mounds; the Hist; reed beds and sugarcane; Summerset's vineyard
  rows. They stand off roads, water, steep faces and beaches, on the lowest ground, and flats keep off their feet.
- **The far views** (`src/render/farFlora.js`, `src/world/terrain/floraCover.js`, `src/render/farTrees.js`). With the
  row on, the far ring, middle ring and far field ask a pixel's zone for its woods, its trees' art (`landTreeArt`) and
  its dressed ground (`landGroundArt`). Only Trees among a recipe's picks count as canopy afar.

## Rules

- Each region gets proper landscape details, textures and refined detail, researched from the lore, without breaking
  anything; Cyrodiil and Valenwood excepted (the owner).
- The switch: the Features row `tamriel-lands` (Lands of Tamriel) on the enhanced skin, on by default, forced on
  online, because Logging's trees and the landmarks' bodies must stand where the room agrees.
  `?lands=off` is the offline kill door (`src/systems/landsSwitch.js` `tamrielLandsOn`). Off, every zone wears its
  climate's ground and flats as the biome zones lay them, byte for byte.
- The ground is dressed, not repainted, so the player's texture pack still dresses the land past the Bay.
- The flats are Daggerfall's own, save Skyrim's four Lands zones which also grow the port's plant archive; landmarks are
  only what no record stands.
- The Tenmar and Murkmire stay off Bantha's storeys (the jungle is Cyrodiil's) and grow Daggerfall's rainforest and
  swamp instead.
- Winter is the snow's: no winter set is dressed and the landmarks wear no snow of their own.
- A zone's trees are the trees its lore names.
- On the Bay nothing changes.

## Daggerfall Unity

DFU shows no province past the Bay. The dressed ground, the zones' flats and the landmarks are the port's own departure
(THE LANDS PAST THE BAY).

## Code and tests

- `src/world/tamriel/tamrielLands.js` - the zones' table
- `src/world/tamriel/groundDress.js` - the dress
- `src/world/terrain/terrainNature.js` `layoutLands` - the growth
- `src/world/tamriel/skyrimFlora.js` / `skyrimFloraArt.js` / `skyrimFloraMesh.js` - Skyrim's plant archive
- `src/tools/floraPlayground.js` - `/2d-playground` Lands pixel preview
- `src/world/lands/` - the landmarks
- `test/world/tesalands_ground.test.js` - the dress, its worker and the ground sets
- `test/world/tesalands_flora.test.js` - the recipes, borders, woods shares and far views
- `test/world/tesalands_props.test.js` - the landmarks' meshes, placement and laws
- `test/world/skyrim_flora.test.js` - the Skyrim plant catalog and meshes
- `test/tools/flora_playground.test.js` - the playground entry

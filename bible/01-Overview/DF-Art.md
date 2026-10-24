# DF-ART and DF-LOOK - the port's own models' textures

## The history: DF-ART I-IV (2026-10-14 and 15)

- **DF-ART** (2026-10-14). Mac: *"For all textures you implemented that are AI (Ships, wagons, caravans, etc) I want to
  instead use daggerfall textures instead of AI generated. Download Daggerfall if needed"*. Asked, Mac chose the
  real-world things and every surface Daggerfall's. The ships, the wagons and the caravan's room, the yards, the
  shipyard and the lighthouse, the LeFay monument and the town's hangings then read Daggerfall records from the
  player's ARENA2 (`world/classicArt.js`, DELETED by DF-LOOK). Their painted liveries, boards and emblems went.
- **DF-ART II** (the same day): *"Bring back the sign text. Bring back the old plaque texture. Also, windows should
  always be see through. Ensure texture swapping still works for wagons"*.
- **DF-ART III** (2026-10-15): *"Wait... you removed the backlit windows from the ship.."*. Asked, Mac chose **see-through
  by day, lit at night**.
- **DF-ART IV** (2026-10-15): *"Can we bring back the wheels we had before we replaced them"*.

## DF-LOOK (2026-10-15): the painted art back, in Daggerfall's colours

Mac: *"we recently took away custom textures for certain models. Is there any way to revert those changes and instead
make those textures more daggerfall-esq"*. Asked which models, Mac chose **all four**: the ships, the wagons and the
caravan, the yards and the port with the LeFay monument, and the town's hangings. Asked what "Daggerfall-esque" means,
Mac chose **Palette + grain**: keep each design, snap every texel to Daggerfall's own texture palette, and grain it.

DF-ART's four commits are reverted in code (06d8943eb, 927118deb, 996fbcdcd, ad2af6bab). Every painted picture is back
byte for byte as it was before DF-ART: the galleon's and the carrack's liveries, the caravan's oxblood skirt, gilt
lines, shutters, curtains and sunburst, the signboards with their emblems (the horseshoe, the wheel, the saw, the
anchor, the coil), the regions' and the gods' drawn charges, the plaque and the wheels. Their own pins and mutant lists
came back with them. One part of DF-ART is **kept**: DF-ART II's and III's windows (below). Those were asks about how a
window behaves, not about where its picture comes from.

## The law (`src/world/dfLook.js`)

A painted picture goes up in **Daggerfall's look**: `dfLook(picture, lookSeed(archive, record))`.

- **Grained.** Each texel's light is jittered by up to `DF_GRAIN` (10 steps of each channel) either way. Half of it is
  the texel's own and half its 2 x 2 block's, because a classic wall's grain comes in clumps. The grain is a hash of the
  picture's seed and the texel's place (`texelGrain`). It is white noise with no lattice, so every client paints the same
  ship, and a tiling picture shows no seam.
- **Snapped.** The texel then takes the nearest colour of the player's own **ART_PAL.COL**, the palette every TEXTURE
  record is drawn in. It may be any index from 1 to 255. Index 0 is a record's clear texel, never a colour. "Nearest"
  is measured in OKLab with hue weighed `HUE_WEIGHT` (4) above light, so the grain moves a texel along its own hue's
  ramp. A sail stays canvas and an oxblood strake stays red. A 6-bit-a-channel lookup holds each answer once it is
  found.
- **Alpha is never touched.** A clear texel comes out byte for byte, and a cut-out keeps its holes.
- **The palette is the player's** (Port-Doctrine: nothing of Daggerfall's ships). The data pipeline hands over the one
  it loaded (`setDfLookPalette`, `scenes/dataPipeline.js`). With none (no pipeline up, or a test's), a picture goes up
  as painted. The tests use ramps of their own.
- **Seeds.** Each record has its own seed. A wagon paint's picture takes its built record's seed, so every paint has the
  same grain. A ship's night twin takes its day record's seed.
- **Glows stay painted.** Only the picture is looked. The ships' window glow and the beacon fire's own light are
  uploaded as painted.

### The doors

| Model | Archive | Where the look is laid on |
|---|---|---|
| Galleon, carrack, large boat | 38131, 38141, 38171 | `shipStandIns` (`world/ships/galleonArt.js`): each stand-in's build, on the texture door |
| Town hangings and rugs | 38202 | `townPictureEntries` (`world/townPictures.js`): each stand-in's build |
| Wagons and caravan | 38181 | `scenes/horseCartPool.js` uploadWagonPicture, `scenes/caravanRoom.js` paintCaravanRoom, and the wagon's item icon (`world/wagonModels.js` wagonIconSource) |
| Stable, Wagon Yard, Joinery | 38221 | `scenes/merchantYardsHost.js`, as the art goes up |
| Shipyard, lighthouse | 38231 | `scenes/portHost.js` paintArt, a few pictures a frame as before (L5-5) |
| LeFay monument | 38211 | `scenes/lefayMonumentHost.js` ensureMesh |

STUDIO1 (2026-10-17, `07-Rendering/Studio-Art.md`): every one of these models now wears an artist's picture from the
studio (`public/art/studio/`) in place of its painted one, where an artist has drawn one. The ships' and the hangings'
through the vendor tier the studio outranks; the other four through `wearPainted`, which asks before it paints (the
wagon's icon asks `paintedReplacement` once the studio has landed). A studio picture goes up as drawn: the look is laid
on painted pictures only.

## The windows (DF-ART II and III, kept)

**A SHIP'S STERN WINDOWS ARE SEEN THROUGH BY DAY AND LIT AT NIGHT.** Each of the galleon's two stern-gallery slices
(records 6 and 21) and the carrack's two transom slices (the same two records of hers) has a **night twin** `NIGHT_RECORD_OFFSET` (100) past it
(`GALLEON_NIGHT`, `CARRACK_NIGHT`).

- **By day** the slice is drawn as painted, with its glass cut out (`cutGlass`). Its glass is exactly where its glow
  mask lights: the painted glass and its glint. It is uploaded as a cut-out through the pipeline's door (`uploadRecord`'s
  `cutout`). The eye sees into the galleon's great cabin.
- **At night** the twin is drawn instead: the same painted slice, whole, with its glow as its emission. A hole draws
  nothing, emission included, so a window can't be open and glowing at once. While the lanterns are lit (the pool's
  `frame` reads `cityLightsOn`), the pool draws every ship through `NIGHT_REMAP`. It is one Map, or a host's remap with
  the twins added (made once), so the renderer's per-sub-mesh lookups stay cached.
- A pack that repaints a stern slice should repaint its twin too (`38131_106` and `_121`, `38141_106` and `_121`).

The caravan's windows are cut as WAGONS2 always cut them (`isGlassRecord`), inside and out. The port's own windows stay
whole: they sit 2 cm proud of solid walls with no room behind them.

## Measured

Every number was read off a real ARENA2 downloaded into the session's scratch directory, never the repo. The look was
judged on contact sheets: each painted picture beside its looked one, and real records beside both.

- **The grain's size.** Mean step in light between horizontal neighbours, per record:
  - TEXTURE.050 (Come Sail Away's ship planks): 1.5-6.7
  - .067 (woods): 1.5-11.5
  - .054 (a building's planking): 6.4-19.3
  - .171 (upright boards): 6.1-9.9
  - .324 (coursed stone): 9.5-15.2
  - .341 (marble and granite): 5.5-10.3
  - The painted art ran smooth. Medians: the ships 3.1-3.3, the wagons 2.6, the monument 1.9. Looked: the ships 6.4-7.5,
    the wagons 5.8, the monument 6.2, the yards 12.3 (9.2 painted), the port 10.4 (8.1), the hangings 19.4 (21.7, their
    charges' hard edges).
- **Tried and left.**
  - A grain proportional to the texel's light speckled the pale canvas.
  - The "redmean" RGB distance hopped hues: the oxblood went orange with bright red specks, and the canvas and marble
    went green and blue.
  - Hue weighed 3 above light still sent 3% of a cream canvas's texels to the palette's pale mint (202,221,196), as
    specks. At 4, none.
  - Snapping only to the colours Daggerfall's walls use dropped indices 9-31 and 176-180, which are under 0.01% of the
    texels of TEXTURE.002 and up. Without the tans (16-31), a cream canvas broke into peach, mint and grey. All 255 it
    is.
- **Daggerfall's reds carry no blue** (its oxbloods run 92-130 red, 22-34 green, 0-3 blue). So the painted oxblood lands
  on Daggerfall's own red-brown, and a deep purple or navy lands on the nearest muted one. That is the palette, kept.
- **Not checked:** nothing was drawn in the game on a GPU. The models in the world are unseen.

## Pinned

- `test/world/dflook.test.js` (8): with no palette, painted as painted; every opaque texel a palette colour, never index 0's;
  alpha untouched; the grain bounded, deterministic, its seed's own and clumped; hue above light; the port rows' shape;
  the pipeline's hand-over; every door.
- **The windows:**
  - `galleon_model` and `ships2_carrack`: each slice cut exactly where it glows, its twin whole as painted.
  - `auditgalleon_sea` T4(b): the slices uploaded as cut-outs, the twins whole and glowing, drawn through NIGHT_REMAP
    only at night.
  - `auditgalleon2_prefab` PF5: the cut-out carried through the real pipeline into the renderer.
- **Mutants.** `tools/mutants/dflook.json` (33, all dead): twenty on the look and thirteen on the windows.
- **The models' own suites** are back to their pre-DF-ART pins, with their mutant lists.
- **Retired with DF-ART's code:**
  - DELETED: `test/dfart_classicart.test.js` and `test/dfart_wagonlooks.test.js`, and their stand-in ARENA2,
    `test/classicArtFake.mjs` (DELETED).
  - DELETED: `tools/mutants/dfart.json`.
  - DELETED: `src/world/classicArt.js`.
  - DELETED: `src/world/wagonWheelArt.js` - its wheels are WAGONS1's painting again, in `world/wagonArt.js`.

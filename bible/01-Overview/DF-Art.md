# DF-Art: the Daggerfall look on our own models

The game's own models wear pictures painted in code, not Daggerfall records. Those pictures are the ships, the wagons
and the caravan room, the merchant yards, the shipyard and lighthouse, the LeFay monument and the town hangings. Each
one goes up in Daggerfall's look: grained, then snapped to the player's own ART_PAL.COL. The player meets it on every
such model, in the Iliac Bay and in every other province alike.

## How it works

`src/world/dfLook.js` `dfLook(picture, lookSeed(archive, record))` returns a new picture of the same shape (`data`, or a
port row's `colors`).

- **Grain.** Each texel's light is jittered up to `DF_GRAIN` steps either way: half from the texel itself, half from its
  2 x 2 block, so the grain comes in clumps. `texelGrain` hashes the seed and the texel's place. It has no stream and
  no lattice, so every client paints the same ship and a tiling picture shows no seam.
- **Snap.** The texel then takes the nearest palette colour, index 1 to 255. Index 0 is a record's clear texel, never
  a colour. `nearestIndex` measures in OKLab with hue weighed `HUE_WEIGHT` above light, so a texel moves along its own
  hue's ramp. A 6-bit-a-channel lookup keeps each answer once found.
- **Alpha** is never touched. A clear texel comes out byte for byte, so a cut-out keeps its holes.
- **Seed.** Each record has its own (`lookSeed`). A wagon paint's picture uses its built record's seed. A ship's night
  twin uses its day record's seed.
- **Glows** are not looked. A window's glow and the beacon fire's light go up as painted.

`src/scenes/dataPipeline.js` hands over the palette it loaded (`setDfLookPalette`). With no palette set, `dfLook`
returns the picture unchanged.

### Where the look is laid on

| Model | Archive | Door |
|---|---|---|
| Galleon, carrack, large boat | 38131, 38141, 38171 | `src/world/ships/galleonArt.js` `shipStandIns` |
| Town hangings and rugs | 38202 | `src/world/townPictures.js` `townPictureEntries` |
| Wagons, caravan room, wagon icon | 38181 | `src/scenes/horseCartPool.js` `uploadWagonPicture`, `src/scenes/caravanRoom.js` `paintCaravanRoom`, `src/world/wagonModels.js` `wagonIconSource` |
| Stable, Wagon Yard, Joinery | 38221 | `src/scenes/merchantYardsHost.js` |
| Shipyard, lighthouse | 38231 | `src/scenes/portHost.js` `paintArt`, a few pictures a frame |
| LeFay monument | 38211 | `src/scenes/lefayMonumentHost.js` `ensureMesh` |

The paint shop's liveries, stained planks and tinted sails (`src/scenes/comeSailAway/shipLiveryPaint.js`), a ship's
stained cabin (`src/scenes/cabinLook.js`) and the Ghostfence stone (`src/scenes/ghostfenceBuild.js`) go through the
look too.

Where the studio has a drawn picture for a record, the studio's picture is worn as drawn and the look is not laid on.
The ships and hangings reach it through the vendor tier. The other doors ask `src/systems/studioArt/studioArt.js`
`wearPainted` before they paint.

### Windows

A ship's stern gallery is seen through by day and lit at night. The galleon's two stern-window slices and the
carrack's two transom slices (records 6 and 21 of each) each have a night twin `NIGHT_RECORD_OFFSET` (100) past them
(`GALLEON_NIGHT`, `CARRACK_NIGHT`).

- By day the slice goes up with its glass cut out (`cutGlass`), exactly where its glow mask lights. It uploads as a
  cut-out, and the eye sees into the cabin.
- At night the pool draws every ship through `NIGHT_REMAP` (`src/scenes/comeSailAway/comeSailAwayPool.js`) while
  `cityLightsOn` holds. The twin is the same slice whole, its glow its emission. A hole draws nothing, so a window is
  never open and lit at once.
- A pack that repaints a stern slice must repaint its twin too (`38131_106`, `38131_121`, `38141_106`, `38141_121`).

The caravan's windows are cut inside and out (`src/world/wagonArt.js` `isGlassRecord`).

## Rules

- Our models keep their painted designs, snapped to Daggerfall's palette and grained ("Palette + grain"). This covers
  the ships, the wagons and caravan, the yards, the port and LeFay monument, and the town hangings (Mac).
- Windows are see-through. A ship's stern windows are see-through by day and lit at night (Mac).
- The palette is the player's own ART_PAL.COL, never in the repo (Port-Doctrine).
- All 255 colours are candidates. Dropping the rarely used tans breaks a cream canvas into peach, mint and grey.
- Hue weighs 4 above light: at 3, a cream canvas still threw pale mint specks.

## Daggerfall Unity

DFU has no counterpart: these models are ours. Each picture is a stand-in on the texture door, so a player's loose
pack's `<archive>_<record>-0.png` still answers first, as DFU's `TextureReplacement.TryImportTexture` does for any
record.

## Code and tests

- `src/world/dfLook.js` - the look: `dfLook`, `lookSeed`, `setDfLookPalette`, `nearestIndex`, `texelGrain`
- `src/world/ships/galleonArt.js` - `shipStandIns`, `cutGlass`, `NIGHT_RECORD_OFFSET`, `GALLEON_NIGHT`
- `src/world/ships/carrackArt.js` - `CARRACK_NIGHT`
- `src/world/ships/standInsKept.js` - keeps looked ship pictures across launches, keyed by build and palette
- `test/world/dflook.test.js` - no palette paints as painted, every texel a palette colour, alpha kept, grain bounded
  and clumped, hue above light, the palette hand-over, every door
- `test/world/ships/galleon_model.test.js`, `test/systems/naval/ships2_carrack.test.js` - each slice cut where it
  glows, its twin whole
- `test/systems/naval/auditgalleon_sea.test.js` - cut-outs by day, twins drawn through `NIGHT_REMAP` only at night
- `tools/mutants/dflook.json` - the look's and the windows' mutants

## Open

- The looked models are not checked on a GPU in the running game.

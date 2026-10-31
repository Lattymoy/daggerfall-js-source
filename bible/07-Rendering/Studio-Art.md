# Studio Art

The studio is the folder where the game's own artists put their pictures, `public/art/studio/`. A picture named for a
texture it replaces is worn by the game in place of that texture: a painted ship, a wagon, a town's hanging, a yard, or
any Daggerfall texture. The player sees the artists' work over the port's painted stand-ins and over every texture
mod.

## How it works

### The folder

- `public/art/studio/README.md` is the artists' guide; `artists.json` is the roster (`{ artists: [{ folder, name,
  approved }] }`); each artist's drawings sit under `<artist>/`, any folders deep. No artist folder exists until an
  artist's first picture makes it.
- **Naming.** A picture is named for the texture it replaces, as every Daggerfall texture pack names one:
  `<archive>_<record>-<frame>[_<dye>][_<map>].png` (`src/systems/textureReplacement.js` `textureName`). A label for
  people may follow `--`, which no DFU name holds. `src/systems/studioArt/studioArt.js` `studioFile` reads a path; a dye
  must be one the game asks by (`askedDye`).
- **The rules** (`scripts/studioArtIndex.mjs` `studioListing`): a file is worn only if it is in a rostered artist's
  folder; every path name is letters, digits and `_ . -` and none of Windows' reserved names; it is a real PNG file, not
  a link; it is named for what it replaces; it is at most 2048 texels a side and 4 MB; one picture a slot (first path
  wins). Artist-computer litter (`.DS_Store`, `Thumbs.db` and the like) is passed over.
- A refused file is left out of what the game is served and named as a problem. `node tools/studioArt.mjs check` tells
  the artist; the folder test fails the suite on any problem, so none ships.

### How the game finds the pictures

- The dev server answers `art/studio/index.json` by reading the folder on every ask, so a dropped picture is worn on
  the next load. The build writes the same listing beside the copied pictures for the site and the desktop app.
- `installStudioArt` runs once from `src/scenes/shared.js` `ensureAudio`. It registers every picture on the texture
  door's vendor tier. An archive's first load waits for that registration at most `STUDIO_HOLD_MS` (3 s), so a slow
  network costs the art, never the world. Pictures of archives past TEXTURE.511 are decoded up front for the painted
  doors; Daggerfall's own records decode with their archive's load. No listing served means the game as it was.

### Where it stands

- On the vendor tier the studio's entry wins whichever registers first, and keeps what it covers
  (`src/systems/textureReplacement.js` `addVendorTextures`). A studio picture that will not load falls back to the
  picture it covers. Over a stand-in it takes the stand-in's size, scale and box, so a billboard stands as big as the
  one it replaces at any resolution.
- So a studio picture draws over the painted ship and hanging stand-ins, over every texture mod (shipped or attached),
  over the mods' vendored art, and on the ground (`src/systems/dfmodTextures.js` `dfmodGroundLayers` lays its records
  into the tile set). It draws with Replace Game Artwork off and on Classic: it is the game's own art.
- A player's own loose texture pack still answers first. The spectral archives take no replacement.
- An artist's picture is worn as drawn; the palette look laid on pictures painted from numbers is not laid on it.

### The painted doors

| Model | Archive | Door |
|---|---|---|
| Galleon, carrack, large boat | 38131, 38141, 38171 | vendor tier stand-ins (`src/world/ships/galleonArt.js`) |
| Tapestries, banners, rugs | 38202 | vendor tier (`src/world/detStandIns.js`) |
| Wagons, carts, caravan and its room | 38181 | `src/scenes/horseCartPool.js`, `src/scenes/caravanRoom.js`, `src/world/wagonModels.js` |
| Stable, wagon yard, joinery | 38221 | `src/scenes/merchantYardsHost.js` |
| Shipyard, lighthouse | 38231 | `src/scenes/portHost.js` |
| LeFay monument | 38211 | `src/scenes/lefayMonumentHost.js` |

The painted doors upload their own pictures through `wearPainted`, which asks `paintedReplacement` first. Each door asks
in its own row order. A picture that lands after its slot was painted is handed again, and only the newest wear of a slot
takes it. A wagon's paint `i` is its own record, `i` x 100 past the built one, so each paint is its own slot.

### The slots

`src/systems/studioArt/studioSlots.js` `STUDIO_SETS` is the catalogue of the eight painted models: 248 slots, 29 of them
cut-outs (clear texels cut a hole; on a solid slot a clear texel draws black). `studio.html` (`src/tools/studioLab.js`)
shows every slot as painted, the studio's picture beside it, and saves a slot's template.
`node tools/studioArt.mjs templates` writes them all. Daggerfall's own textures are slots too, but they are the player's
data, so nothing draws them as templates.

## Rules

- The studio exists for the team's own 2D art (Mac). The roster holds trashBattery and Redclaw (Mac) and maya (the
  owner).
- The studio's pictures are claimed as the port's own, not as a render of game data; Port-Doctrine stands unchanged. By
  committing a picture, an artist says it is their own drawing with no pixel of ARENA2's.
- `test/tooling/doctrine.test.js` reads the folder by the studio's own membership rule: a served picture is ours, and
  anything else in the folder is unexplained.
- No index file is committed. Unlike every other texture pack (third-party archives with tool-made indexes), the studio
  is a folder people paint into, so the listing is made where it is served.

## Code and tests

- `src/systems/studioArt/studioArt.js` - `studioFile`, `installStudioArt`, `paintedReplacement`, `wearPainted`
- `src/systems/studioArt/studioSlots.js` - `STUDIO_SETS`, `studioSlots`
- `scripts/studioArtIndex.mjs` - the folder's rules and the listing (Vite plugin and build)
- `tools/studioArt.mjs` - `check` and `templates`
- `src/tools/studioLab.js` - `studio.html`
- `test/systems/studioArt/studio1_door.test.js` - names, the vendor tier's law, the install, row orders, late pictures,
  every door
- `test/systems/studioArt/studio1_folder.test.js` - the folder as it stands, the rules, the plugin, the check, the slots
- `test/systems/studioArt/auditstudio1.test.js` - the audit's fixes

## Open

- UI pictures (IMG, CIF, RCI: the HUD, windows, first-person weapons) have no general door; the studio wears TEXTURE
  archives only.
- Other painted archives have no slot set: the gate (38101) and its court (38111), the Abyss realm (38151) and remnant
  (38155), the blood atlas (38001). Hand-uploaded mod art (torches, waves) has no door either.
- The horses' coats are re-tinted from one picture (`src/systems/horse/horseCoats.js`) and need slots of their own.
- Maps beyond albedo are registered under their DFU names and drawn only where the pipeline asks; a ship's night window
  reads its emission map.

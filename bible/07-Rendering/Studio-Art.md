# THE STUDIO - the game's own artists' pictures (STUDIO1)

Opened 2026-10-17. trashBattery, on the dev chat: *"what Latty is working to build right now, and what I'm waiting for,
is a centralized location for you and I to put 2d art assets ... currently the game only uses art from mods they told
klod to integrate or re-uses textures from ARENA2. the reason the cart textures look strange is cause they're being
hue-shifted. they're not unique textures yet"*. Mac, sharing it: *"We need to build what trash is talking about"*.

Audited the same day (AUDIT STUDIO1, `01-Overview/audits/Audit-Studio1.md`): five cold lanes on a frozen snapshot. What
the audit changed is written into the sections below as they now stand.

## Why

Before STUDIO1, every picture the game drew came from one of three places:

- **A mod it was handed** (Vanilla Enhanced, Roleplay Realism, Diverse Weapons and the rest, under `public/art/` and
  `vendor/`).
- **A record of the player's own ARENA2.**
- **A picture the port painted from numbers.** These are the ships, the wagons, carts and caravan, the yards, the
  shipyard and lighthouse, the LeFay monument and the towns' hangings (`01-Overview/DF-Art.md`), laid in Daggerfall's
  palette as they load (DF-LOOK). The wagons' are recoloured for each paint a wagon can wear (`world/wagonArt.js` PAINTS
  and DYES: one picture, re-tinted).

There was nowhere an artist could put a picture of their own and have the game wear it.

## The folder

```
public/art/studio/
  README.md          the artists' guide - naming, the rules, what wins
  artists.json       the roster: { artists: [{ folder, name, approved }] }
  <artist>/...       an artist's own drawings, any folders deep
```

- **Naming.** A picture is named for the texture it replaces, the way every Daggerfall texture pack names one:
  `<archive>_<record>-<frame>[_<dye>][_<map>].png`. This is `systems/textureReplacement.js` textureName, which is
  TextureReplacement.GetName (TextureReplacement.cs:725-736).
- **Labels.** A label for people may follow `--` (`38181_1-0--cart-side-boards-weathered-oak.png`). A DFU name never
  holds `--`: its record and frame are digits on either side of one dash.
- **Parsing.** `systems/studioArt/studioArt.js` studioFile reads a path. Its artist is the first folder, and the name
  before the label is read by textureEntry. A dye must be one the game asks a picture by (`askedDye`: `_Iron`, never
  `_iron`, `_Silver` or `_Unchanged` - GetName prints no dye for Unchanged).
- **The rules** (`scripts/studioArtIndex.mjs` studioListing):
  - A file is worn only if it is in the folder of an artist the roster names.
  - Every name in its path is letters, digits and `_ . -`, a letter or digit at each end, and none of Windows' own
    (`STUDIO_NAME`, `STUDIO_RESERVED`): the game asks for the picture by its name over the web, where `#`, `?` and `+`
    are not a file's, git lists an accented name quoted, and the desktop release is checked out on Windows.
  - It must be a PNG, and a picture itself, not a link to one (what a link points at is not in the commit).
  - It must be named for what it replaces.
  - It may be at most 2048 texels a side (STUDIO_MAX_SIDE) and 4 MB (STUDIO_MAX_BYTES). The vendor tier decodes whole,
    with no Texture detail cap.
  - One picture a slot: the first path in order keeps a key.
  - The studio's own folder holds only the guide and the roster.
  - What an artist's computer leaves (`.DS_Store`, `._*`, `Thumbs.db`, `desktop.ini` - `STUDIO_LITTER`, all ignored by
    git) is passed over.
- **Refused files.** A file the rules refuse is left out of what the game is served, and named in the problems.
  `node tools/studioArt.mjs check` says them to the artist, and `test/systems/studioArt/studio1_folder.test.js` F1 fails
  the suite on any problem, so none ships. The check also refuses a picture git would never commit (a folder named as
  a `.gitignore` pattern) and a name of a painted model's archive that is none of its slots. It exits 1 on a problem
  (`studioCli`, which takes the tree it reads - AUDIT STUDIO1 E13).
- **The roster.** Each row is the doctrine decision: who may paint here, and the word that approved them. Three artists
  are on it: trashBattery, Redclaw and maya. trashBattery's "you and I" was said to Redclaw, and Mac's word covers both.
  maya (weapon sprites) was proposed by trashBattery in #1108 and approved by the owner on 2026-10-21. An artist's
  folder is made by their first picture, never a placeholder: the studio refuses any file that is not a PNG.

## How the game finds the pictures: the folder, listed where it is served

- **Dev server.** It answers `art/studio/index.json` by reading the folder at every ask (`studioArtIndex`, the Vite
  plugin). A picture dropped in is worn on the next load.
- **Build.** The build writes the same listing beside the pictures it copies, so the site and the desktop app (whose
  seed lists `dist/`) carry it.

**A departure from the house's convention, named.** Every other texture pack the port registers on the texture door
ships a committed index made by a tool (`vendor/*/*.index.json`, `rriIndex.js`, `diverseWeaponsIndex.js`). Those are
third-party archives, and they change only when a tool re-extracts them. The studio is a folder people paint into, from
a checkout or through GitHub's own upload page. A committed index would be a list for them to keep, or a tool for them
to run, and trashBattery asked for neither. No index file is ever in the tree, and studioListing reserves the name.

**The install** (`studioArt.js` installStudioArt):

- It runs once, from `scenes/shared.js` ensureAudio, the bootstrap every host runs.
- It reads the listing and registers every picture on the texture door's vendor tier. The boot waits for that alone,
  and so does an archive's first load: `dataPipeline.js` getTexture waits for a registration on its way
  (`textureReplacement.js` holdTextureTiers), at most STUDIO_HOLD_MS (3 s), so the first area is drawn in the studio's
  pictures and a slow network costs the art, never the world.
- It then decodes the pictures of every archive past TEXTURE.511 (`formats/textureFile.js`
  LAST_CLASSIC_TEXTURE_ARCHIVE), PRELOAD_CONCURRENCY at a time, for the painted doors, which upload without an archive
  load. The stand-in archives (the ships, the hangings, the mods' icons) would be decoded at their load anyway.
- Daggerfall's records are decoded with their archive's load, as every replacement is (`preloadTextureArchive`).
- No listing served (a page off a plain static server) is 0, and the game as it was. A listing that would not read is
  0 and asked again at the next boot. It never throws.

## Where it stands

**THE STUDIO'S PICTURE HOLDS ITS KEY** (`textureReplacement.js` addVendorTextures, STUDIO1). On the vendor tier, the
port's own art, the studio's entry wins whichever registers first, and keeps what it covers (`under`): the art
registered before it, or after it (a ship's painted stand-in registers when her pool loads, long after the boot).

- **What the archive is** comes from the art it covers: the stand-in mark, a place on the doll, decoded only when asked
  (`lazy`). A ship whose every record the studio repaints is still a stand-in archive (`isVendorArchive`).
- **A studio picture that will not load** is stood in for by the picture it covers, never a hole (entryColor32).
- **Size and scale.** A studio picture over a stand-in takes the stand-in's size, scale and box
  (`vendorTextureStandIn` getSize, getScale, getBox): a billboard stands as big as the one it replaces, at any
  resolution, and a doll piece fits the stand-in's box (`ui/paperDoll.js`). Its own texels are drawn (getDFBitmap). A
  studio picture decoded before the art it covers registered is decoded again with it.
- **Dyes.** A studio picture of one dye of a stand-in's record makes no dyed set of it: the other dyes still find the
  stand-in (standInDye).

So a studio picture is drawn:

- over the painted ship and hanging stand-ins;
- over every texture mod, shipped or attached (Vanilla Enhanced and its add-ons, Sands of the Alik'r, Snowfall, a
  player's own .dfmod), which sit on the bundle tier below the vendor tier;
- over the mods' own vendored art;
- on the ground: the terrain's tile sets are built apart from the texture door, and `systems/dfmodTextures.js`
  dfmodGroundLayers lays the studio's records into the set it builds (a mod's array, a pack's records, or Daggerfall's
  own), each where its record is, every layer at the size of the set's largest picture;
- with Replace Game Artwork off and on Classic. The vendor tier answers with the gate shut: it is the game's own art,
  not a pack.

**A player's own loose texture pack still answers first** (liveEntry's order) - a folder of pictures, behind Replace
Game Artwork - as it does over every picture of the port's. A studio entry never `yields`, so no .dfmod outranks it.

**Not drawn:** the spectral archives (the ghosts' and wraiths'), which take DFU's spectral remap and no replacement
(`dataPipeline.js` uploadRecord).

**Worn as drawn.** DF-LOOK's grain and palette snap are for pictures painted from numbers. An artist's picture is
already the look they meant, so no door lays the look on it.

## The doors

| Model | Archive | How its pictures reach the game |
|---|---|---|
| Galleon, carrack, large boat | 38131, 38141, 38171 | Vendor tier stand-ins (`world/ships/galleonArt.js` shipStandIns): the studio outranks them there |
| Towns' tapestries, banners and rugs | 38202 | Vendor tier (`world/detStandIns.js`, townPictureEntries), the same |
| Wagons, carts, the caravan and its room | 38181 | `scenes/horseCartPool.js` uploadWagonPicture; `scenes/caravanRoom.js` paintCaravanRoom; the item icon `world/wagonModels.js` wagonIconSource |
| Stable, wagon yard, joinery | 38221 | `scenes/merchantYardsHost.js` meshOf |
| Shipyard, lighthouse | 38231 | `scenes/portHost.js` paintArt (the beacon's glow is the studio's picture where it is the studio's) |
| LeFay monument | 38211 | `scenes/lefayMonumentHost.js` ensureMesh |

**The painted doors** (the last four rows) upload their own pictures. Each goes through `wearPainted`, which asks
`paintedReplacement` before it paints, but the wagon's icon, which asks `paintedReplacement` once the install has
landed (`studioLanded`, which asks for the install itself):

- **Row order.** The wagons' pictures go up in the port's color32 order: row 0 is the bottom (`formats/color32Order.js`).
  The yards', the port's and the monument's go up top-down, because their faces are laid that way ("Row 0 is its top",
  `world/portArt.js`). Each door asks in its own order (`{ topDown: true }`).
- **A late picture.** The world host streams before the boot's install has landed, and a picture can answer and not be
  decoded yet. A picture painted while its replacement is on its way is handed again, `late`, when it lands. The host
  lets the painted one go first, because the renderer keeps the first picture a key is given. Only the newest wear of a
  slot takes a late picture (ASYNC NEVER DROPS): the caravan's room repainted while one was on its way keeps its new
  paint. A picture already up keeps itself until its area is drawn again, as for every texture pack.
- **The caravan's room.** Its live records (`CARAVAN_LIVE_CHOICE`) wear the studio's picture of the record each one
  shows: the built record or its paint's (caravanRoomPictures' third field), the live record its slot.
- **A ship's night window.** By day a stern window's record is cut where it is clear; at night its twin is drawn whole
  and lit. The twin's light is its own emission picture where it has one (`38131_106-0_Emission.png`, the studio's or a
  pack's - `scenes/comeSailAway/comeSailAwayPool.js` uploadFace); without one, the painted glass's glow.

**Paints are records.** Paint `i` of a wagon is its own record, `i` × `LOOK_RECORD_STRIDE` (100) past the built one, so
an artist paints each one. A paint with no studio picture keeps its painted one.

## What the artists start from: the slots

`systems/studioArt/studioSlots.js` is the catalogue: STUDIO_SETS lists the eight models the studio covers, with each
slot's key, its name, whether its door cuts holes where it is clear (`cutout`), the template's file name and its
picture.

- **248 slots today**, pinned (`auditstudio1` S9):
  - the wagons: 86, every built picture and every paint's;
  - the galleon: 25;
  - the carrack: 27;
  - the large boat: 17;
  - the hangings: 48;
  - the yards: 14;
  - the port: 26;
  - the monument: 5.
- **29 are cut-outs**: the caravan's side, front, room wall and room front in every paint, the ships' stern windows by
  day, the beacon's flame. Every other slot is drawn solid, and a clear texel on one comes out black.
- **The pictures** are painted as the game paints them before DF-LOOK lays the player's palette on. They are the port's
  own numbers, so a template of them is ours to hand out.
- **A ship's window** is cut as her day picture is cut, with a night twin of its own.

There are two ways to see them:

- **`studio.html`** (`src/tools/studioLab.js`), on the dev server and the site, draws every slot as painted. Beside
  each, it shows the studio's own picture where an artist has drawn one, marks the cut-outs, and a button saves the
  slot's template under the name the studio reads.
- **`node tools/studioArt.mjs`** lists the same slots. `templates [dir]` writes them to `studio-templates/` at the
  checkout's root (ignored by git) or the folder named, and `check` runs the folder's rules, decodes every picture whole,
  refuses what git would not commit and a painted model's name that is no slot, and notes a picture whose shape is not
  its slot's, clear texels on a slot drawn solid, and an archive past 511 that is no painted model's.

**Daggerfall's own textures are slots too**: any name a texture pack can use, the ground's included. They are the
player's data, so nothing here draws them and the check cannot tell a mistyped one. `archive-sheet.html` numbers them
from the player's own ARENA2.

## The doctrine

- **The studio's pictures are claimed as the port's own**, not as a render of game data. Port-Doctrine's
  non-negotiables stand unchanged, and no exception is asked for.
- **Membership.** `test/tooling/doctrine.test.js` reads the folder by the studio's own rule (studioMembers): a picture
  the listing serves is ours, and anything else in the folder is unexplained. Its own pin holds the rule on a tree of
  its own (a stranger's picture, a file that is no picture and a link are not ours). The sweep lists files with
  `git ls-files -z`, so a name git would quote is still found.
- **The artist's word.** By committing a picture to their folder, an artist says it is their own drawing with no pixel of
  ARENA2's: no trace, repaint, upscale or screenshot. The roster's preamble and the guide say so.
- **The guide and the roster** are allow-list rows.

## Not yet

- **UI pictures** (IMG, CIF and RCI): the HUD, the windows, the first-person weapons. They have no general door yet
  (`combat/fpsSpellCasting.js`'s FLAGGED note; the UI pack and .dfmod tiers carry them piecemeal). The studio wears
  TEXTURE-archive pictures: the world's surfaces and ground, its flats and billboards, and the item icons.
- **The port's other painted archives**, each with an upload door of its own and in no set: the gate (38101) and its
  court (38111), the Abyss realm (38151) and remnant (38155), the blood atlas (38001). The mods' own art uploaded by
  hand (the torches 112358-9, the waves 112395) has no door either; the lamp keeper's lamp is the player's classic
  197_6, never replaced. Pictures on the texture door's vendor tier (survival, foraging, the Thunderlock's icons, the
  town's beds and clutter) are already outranked by a studio picture of their key.
- **The horses' coats** (`systems/horse/horseCoats.js` recolorHorse) are dyed per look from one picture. That is the
  same "hue-shifted" kind trashBattery named, and it needs its own slots.
- **Maps beyond albedo**: a ship's night emission is read (above); the rest are registered under their DFU names and
  drawn only where the pipeline asks for them.

## Verified, and not

**Verified:**

- The dev server's listing.
- A real build (`art/studio/index.json` written beside the copied picture) and `vite preview` of it, at the site root
  and under a project path (AUDIT STUDIO1 lane C).
- Chromium driving `studio.html` on both: 248 slots, the studio's picture shown beside the painted one it replaces.
- In a real browser, `installStudioArt` through its real fetch and decode, with `paintedReplacement` answering in both
  row orders (a test picture's arrow tip where each order puts it).
- Every painted slot's template, installed as a studio picture, lands byte for byte as its painted picture does at its
  door (AUDIT STUDIO1 lane B).

**Not seen:** a studio picture on a wagon in the world. This container has no ARENA2 to boot the game with.

## Pinned

- **`test/systems/studioArt/studio1_door.test.js`** (6):
  - D1: names;
  - D2: the vendor tier's law, through the galleon's real registration;
  - D3: the install;
  - D4: the rows;
  - D5: wearPainted and the late picture;
  - D6: the caravan's room through its real producer, and every door's line.
- **`test/systems/studioArt/studio1_folder.test.js`** (6):
  - F1: the folder as it stands;
  - F2: the rules on trees of the test's own;
  - F3: the PNG header;
  - F4: the plugin, build and dev;
  - F5: the check;
  - F6: the slots and each model's door.
- **`test/systems/studioArt/auditstudio1.test.js`** (16): the audit's fixes, S1-S10, and lane E's killers, S11-S16
  (`01-Overview/audits/Audit-Studio1.md`).
- **`test/tooling/doctrine.test.js`**: the studio arm on a tree of its own, and the arm itself over the real tree
  (AUDIT STUDIO1 E5).
- **Updated pins:**
  - `test/world/dflook.test.js` L8: the look is laid inside wearPainted's paint;
  - `test/systems/texturereplacement.test.js`: the bootstrap's Promise.all carries the studio's registration;
  - `test/systems/dfmod1.test.js`: the icons' cache key carries the studio's generation.
- **Mutants:** `tools/mutants/studio1.json`, 140, all dead; the records of other slices the studio moved (DF-LOOK,
  BEACON-TOWER, RRI1, THUNDERLOCK-ART, AUDIT VIRT, VE2) re-aimed by content, all dead.

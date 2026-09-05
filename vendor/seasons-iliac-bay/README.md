# Seasons of the Iliac Bay 1.1 - RosyTheRascal (ported, with the author's permission)

**Seasons of the Iliac Bay 1.1** for Daggerfall Unity, by
**RosyTheRascal** - Nexus mod 1377 - "implements custom textures and
behavior for Spring, Autumn and Winter seasons": the woodland, hills,
haunted-woodland and mountain nature flats (the trees, rocks and
plants) take autumn colour in Fall, flowers in Spring and snow in
Winter, drawn at 3.1 times their classic size. Contact, per its
manifest: the Lysandus' Tomb DFU mod server.

**Permission: granted by the author to Mac (Lattymoy), 2026-09-05.**
Record of the permission:

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here

- `seasons-of-the-iliac-bay.dfmod.json` - the mod's manifest, verbatim
  (title, version, author, contact, GUID, and the file list the mod's
  script reads its textures off: 374 entries - 372 textures in eleven
  `Textures/<Folder>/` sets, the script, and the manifest itself).
- This note.

## What is NOT here, and why

**The 372 textures.** They are seasonal repaints of Daggerfall's own
nature flats - the same rocks, trees and plants as `TEXTURE.504` to
`TEXTURE.510`, with autumn colour, spring flowers and snow painted
over them (put the mod's `K1` beside the classic record 1 of
`TEXTURE.505` and the silhouette is the same). The port's doctrine
(`bible/01-Overview/Port-Doctrine.md`) is that A RENDER OF GAME DATA IS
GAME DATA, and it names this case exactly: "a re-shaded sprite that
keeps the original silhouette" answers yes to "did these pixels come
from ARENA2?". The author's permission covers the author's work; the
silhouettes are Bethesda's to waive, not RosyTheRascal's - the same
ruling `vendor/windmills-kamer/README.md` records for that mod's
exported PNGs.

So the textures reach the game the way ARENA2 does: FROM THE PLAYER'S
OWN COPY OF THE MOD, at play time, and never from this repository.
`test/doctrine.test.js` keeps it so (no tracked raster without an
allow-list row), and `test/seasonsIliacBay.test.js` pins this folder's
tracked contents to exactly the manifest and this note.

**The script.** `SeasonHelper` ships as a compiled DLL (`Seasons of the
Iliac Bay.dll`, 25,600 bytes; the `.cs` the manifest names is not in
the bundle). Its behaviour was read off the IL, method by method, and
is ported to `src/systems/seasonsIliacBay.js`, which documents every
method and the ones that are unreachable in 1.1 (the organic position
jitter and the per-batch custom remap: nothing wires them).

**The bundle itself** (`seasons of the iliac bay.dfmod`) - the player's
to supply, see below.

## How the player installs it

Open the **Your own textures** pick (the same door as a Daggerfall
Unity texture pack) and point it at a folder holding EITHER:

1. the mod's **`seasons of the iliac bay.dfmod`** - the file Nexus
   ships and DFU loads (that file by name; other mods' bundles in the
   same folder are left alone). The port reads the bundle itself
   (`src/formats/unityBundle.js`: UnityFS 7, LZ4 blocks, SerializedFile
   21 with its type tree, RGBA32 and DXT5 textures) and takes the
   textures out exactly as DFU's mod system hands them to the script;
   or
2. the mod's **`Textures/`** folders as loose PNGs (`HauntedF`,
   `HauntedS`, `HauntedW`, `HillsF`, `HillsS`, `HillsW`, `MountainF`,
   `MountainsS`, `TempF`, `TempS`, `TempW`) - the shape its source is
   kept in.

Nothing is uploaded; the files are stored in the browser, as the
ARENA2 pick's are. With neither present the mod is inert and the
classic flats draw in every season. The mod's switch is in the Enhanced
menu's Mods pane (on by default - a DFU mod is on by being installed).

## Verification

The bundle reader was validated against a reference extraction
(UnityPy 1.x) of this mod's bundle: 372 of 372 textures byte for byte
(354 RGBA32, 18 DXT5, after the bottom-up flip) and both text assets
(the manifest and the DLL). The reader's own pins build a bundle of
the same layout in the test, because the real one cannot be tracked.

# GrimoireUI 1.2 - LordSquacquerone (OVH2, the first UI Overhaul)

**GrimoireUI 1.2** for Daggerfall Unity, by **LordSquacquerone** (Nexus Mods,
Daggerfall Unity mod 1222: https://www.nexusmods.com/daggerfallunity/mods/1222).
Its own description: a spellbook that is actually a book, and an alternative to
the rocky background while keeping the pixelated look.

Mac (Lattymoy) handed the shipped zip (`GrimoireUI-1222-1-2-1780429570.zip`)
over on 2026-09-24: "Our first overhaul option will be the file attached."

**Permission: [Mac: record the author's permission, or the link to it, here -
the earlier mod records carry theirs in this line. The pack's pictures are the
author's own art and carry no licence line of their own.]**

## What is here

- `grimoire-ui.files.json` - the archive's own listing, every file in the order
  the zip stores it, with the zip's name and sha256. A loose-file pack ships no
  `.dfmod` and so no manifest of its own; this listing was generated from the
  zip, not written by hand, and it is the authority test/doctrine.test.js and
  src/systems/uiPack.js both read.
- The files themselves stand under `public/art/grimoire-ui/`, byte for byte:
  `Img/*.IMG.png` (93 whole screens at 3x), `CifRci/BUTTONS.RCI_<r>-0.png`
  (records 0-37 - its 21-37 are Roleplay & Realism's extra labels, redrawn),
  the save window's eight `*backgroundcolor.png` textures, and
  `Fonts/FONT0002-SDF.ttf` / `FONT0003-SDF.ttf`.

## How the port wears it

The UI Overhaul panel (main menu > Overhauls) - Classic, Enhanced, GrimoireUI.
GrimoireUI is the classic skin with the pack worn over it, as Daggerfall Unity's
loose-file injection does: every classic screen keeps its 320x200 layout and hit
rects, only the texture behind it is the pack's (src/ui/packArt.js), and the two
fonts draw through DFU's SDF arm (src/ui/text.js) when GUI/SDFFontRendering is on.

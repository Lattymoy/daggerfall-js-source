# World Tooltips 1.1 - jefetienne (to be ported 1:1, its source vendored)

**World Tooltips 1.1** for Daggerfall Unity 0.13.4, by **jefetienne**
(Nexus mod 158; the manifest's ContactInfo is
`forums.dfworkshop.net/memberlist.php?mode=viewprofile&u=2186`). The
mod's own description: "Displays info about NPCs, buildings, and items
and other interactables". Its GUID is
`88e77a95-fca0-4c13-a3b9-55ddf40ee01e`.

Mac (Lattymoy) handed the shipped zip
(`World_Tooltips_-_Windows_1.1-158-1-1-1655327614`) over on
2026-09-21: "This is perfect and honestly it fits in with the next mod
I want to integrate 1:1", with two additions of his own - an enhanced
skin for it rather than the mod's own tooltip panel, and a merge with
the port's existing loot plaque (`ui/lootHover.js`, PX21c).

**Licence.** MIT, "Copyright (c) 2009-2018 jefetienne", shipped as
`LICENSE-world-tooltips` in the zip beside a second MIT notice for
Daggerfall Workshop. Kept verbatim as `LICENSE` here. The port's
implementation is written FROM the source below and cites it line by
line, exactly as the other ported mods in this tree do.

## What is here

- `Scripts/Modded_HUDTooltipWindow.cs` - the mod's whole
  implementation, 1190 lines in one file. **This is the author's own
  source, shipped inside the bundle**, not a decompile: the `.dfmod`
  carries it as a Unity TextAsset beside the manifest and the settings,
  and `tools/worldTooltipsAssets.mjs` is what extracts it (the same
  `src/formats/unityBundle.js` reader `tools/travelOptionsAssets.mjs`
  uses). So every cite in the port resolves against a file anyone
  holding the shipped zip can reproduce byte for byte.
- `tooltip.dfmod.json` - the bundle's manifest, verbatim.
- `modsettings.json` - the bundle's settings schema, verbatim. One
  key: `HideDefaultInteractTooltip`, which suppresses the generic
  `<Interact>` label so the main quest's puzzles are not given away.
- `LICENSE` - the zip's licence file, verbatim.

There are no textures or sounds: the mod draws with DFU's own default
font and tooltip colours, which is precisely the part this port
replaces with its own enhanced skin.

## What the mod does, in its own order

One ray per frame from the camera forward, out to
`PlayerActivate.StaticNPCActivationDistance` (the farthest reach it
cares about), then a ladder in which **every arm is gated by its own
activation distance** - so a label appears only when the thing is
within the reach that activating it would actually need:

1. custom tooltips registered by other mods (`RegisterCustomTooltip`)
2. terrain, which stops the ladder
3. mobile NPCs, non-hostile enemies, bulletin boards
4. static NPCs, including the sixteen Daedra by billboard record
5. actions (levers, wheels, the Mantella), ladders, bookshelves,
   quest-resource items
6. loot: corpses, dropped piles, shop shelves, house containers by
   mesh record (Wardrobe, Cabinets, Shelf, Dresser, Cupboard, Crate,
   Chest)
7. action doors, with the lock level
8. static doors, last because they are the expensive pass: the
   building's discovered name, its lock level, and the store/guild
   closed line with its open hours

It caches on the transform it hit, so holding the crosshair still
costs one ray and a pointer comparison rather than a ladder walk.

## The port's departures, recorded

See `bible/10-UI/UI-Arc.md` (the WORLD-HOVER section) and the Ledger A
row. In outline: the enhanced skin's own plaque instead of the mod's
tooltip panel; the loot arm keeps the port's itemised list rather than
the mod's "Loot Pile"; and the port's own world objects (dropped
torches, camps, water sources, the wagon, the Thunderlock) ride the
mod's own extension API rather than being wedged into its ladder.

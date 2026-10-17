# Immersive Travel 1.5 - kkgobkk (ported 1:1; its script's IL and its edits of the four gate blocks vendored, the blocks rebuilt from the player's own data)

**Immersive Travel 1.5** for Daggerfall Unity 1.1.1, by **kkgobkk** (Nexus mod
986; the manifest's ContactInfo is `kkgobkk@hotmail.com`; GUID
`bcd05411-2d0c-4cf3-aa99-0df24c267aeb`). The mod's own description:
"Implements diegetic fast-travel by adding carriages outside of city gates."

The owner handed the shipped zip (`ImmersiveTravel_986_1.5_2026-08-05T19-52Z_UQppONgpe`,
one file, `immersivetravel.dfmod`) over on 2026-10-04: "Actually lets let this be the
next mod we integrate 1:1" - after asking how instant travel could come back online
"as an option but with a cost".

**Permission: [Mac: record kkgobkk's permission, or the link to it, here - the earlier
mod records carry theirs in this line.]** The zip carries no readme and the manifest no
licence.

## What the mod is

A compiled script (`ImmersiveTravel.dll` - the manifest names eight C# files and the
bundle carries their build, not the sources), its settings, its manifest, and four
world-data files: Daggerfall's city-gate blocks `WALLAA08.RMB` to `WALLAA11.RMB`, each with
a carriage (model 41214) and its team or a cart (41207, 41209, 41109), the horses
(TEXTURE.201), a hay bale or a crate, and the driver - a person flat in faction 8642.

- Init registers two factions - **Carriage Drivers** (8642) and **Sailors** (8643, under
  it), Merchants both - and a "Fast Travel" custom merchant service for each.
- A driver's service opens the mod's **CarriageMap** (DFU's travel map with Travel
  Options' five-texel page, roads and tracks); a place picked there is refused by type
  (AllowedDestinations), or by region with RegionLockedCarriages, or opens the mod's
  **ImmersiveTravelPopUp** - DFU's popup, priced by a daily carriage fee on top of the inn
  nights, never by ship with DisableShipTravelOutsideDocks. The trip is DFU's own fast
  travel.
- A sailor's service opens the **SeafarersMap** - places by one of 382 dock pixels, a
  small dock limited to its region - and the **SeafarersPopUp**: ship and camping out
  forced, 51 minutes a map pixel, the ship and her captain paid by the day. No block the
  mod ships stands a sailor.
- With **DisableNormalTravel** the player's own map's popup is the mod's, and it refuses
  every trip to a place: "You must take a carriage to initiate fast travel."

## What is here, and what deliberately is NOT

- `immersive-travel.dfmod.json` - the shipped manifest, verbatim (the bundle names it
  `ImmersiveTravel.dfmod`; CRLF, as shipped).
- `modsettings.json` - the three sections as the bundle ships them (General, ShipTravel,
  AllowedDestinations; CRLF, as shipped). `src/systems/modSettings.js` restates every key
  under the vendor key `immersive-travel`, section and name joined with a dot.
- `ImmersiveTravel.dll` - the shipped assembly, byte for byte, and
  `il/ImmersiveTravel.il.txt` - every method body as CIL, dumped by `tools/ilDump.py`.
  The port (`src/systems/immersiveTravel.js`) cites the IL offsets it restates. Its three
  hard-coded tables (40 capitals, 15 large docks, 382 dock pixels) are field data the dump
  does not print; `src/systems/immersiveTravelTables.js` carries them and
  `test/systems/guild/it1_immersivetravel.test.js` finds each one, whole, in this DLL's bytes.
- `WorldDataPatches/WALLAA0x.RMB.json` - **the author's edit of each gate block, and only
  the edit** (5 to 10 inserted records and 34 round-trip ops, 2,962 to 3,895 bytes against
  the shipped 186,594 to 188,400). A whole RMB block is Daggerfall's layout - game data, which this repository
  never carries (Port-Doctrine) - so each is rebuilt at load from the player's own
  `BLOCKS.BSA` and served under its own name through the world-data door
  (`src/formats/worldData/worldDataPatch.js`, `src/scenes/modWorldData.js`). Each patch records the
  sha256 of the author's file in canonical form.

  **BUILT WITHOUT A BLOCKS.BSA, AND SAID SO.** The container these were made in carries
  no ARENA2. `tools/immersiveTravelPatches.mjs` read the edit off the files alone: the
  editor appends what the author placed and leaves the header's record counts as the
  classic block had them (NumMisc3dObjectRecords 2, NumMiscFlatObjectRecords 1 in all
  four), so the records past those counts are the author's. AUDIT IT1 G1 added the two
  round-trip changes the editor makes to every block and the files show on their own:
  BuildingDataList written at its count where the classic block reads 32 slots (28
  removed), and a scale of 1 on the two classic models, whose records carry none (6 set).
  What that still cannot carry is any other round-trip change to a classic record
  (`bible/02-Formats/World-Data-Patches.md` names two: an automap ground-flat byte zeroed,
  a rotation written as its equivalent).
  The loader checks every rebuild against the recorded sha256 and says when it differs;
  `test/formats/worldData/it1_worlddata.test.js` checks all four with `ARENA2_PATH` set. Run the tool again
  with an ARENA2 to replace them with WD1's diff, checked byte for byte:

      node tools/immersiveTravelPatches.mjs <immersivetravel.dfmod> <arena2>

- **Not here:** the four shipped world-data files and the C# sources, which the bundle
  does not carry.

## The port

`src/systems/immersiveTravel.js` is the mod - its factions, services, settings, the
carriage's and the captain's laws and calculators, its popup's overrides;
`src/systems/immersiveTravelTables.js` its tables; `src/world/immersiveTravelGates.js`
lays its gate records onto whichever gate block the door serves (Beautiful Cities' too -
a recorded departure). The two map skins carry its maps and popups:
`src/ui/travel/travelMapWindow.js` and `src/ui/travel/travelPopUp.js` (the classic window),
`src/ui/heldMap.js` (the enhanced sheet). `src/scenes/world.js` opens a driver's map
(`openImmersiveMap`) and travels it; online it is the one fast travel the room keeps
(`src/systems/online/onlineLane.js`).

See `bible/06-Systems/Immersive-Travel.md`. Thank you, kkgobkk.

# World of Daggerfall 2.0 - Kamer (ported 1:1, its source vendored)

**World of Daggerfall 2.0** for Daggerfall Unity 0.11.0, by **Kamer**
(Nexus mod 181; the manifest's ContactInfo is "DFU forums"). The mod's
own description: "Adds details to the wilderness, New Locations, and
Dungeon Exterior detail." Its GUID is
`98f05888-989f-4ff1-b455-f4cafedaeb88`. Kamer is also the author of
Windmills of Daggerfall (`vendor/windmills-kamer/`).

Mac (Lattymoy) handed the shipped archive
(`World_of_Daggerfall_WindowsLinux-181-2-0-1773339543.rar`) over on
2026-09-23: "This will be our next mod to implement 1:1".

**Licence.** The archive states none. The manifest names Kamer and
nobody else.

**Permission: granted by the author - the same grant that brought his
Windmills of Daggerfall into this tree - confirmed by Mac 2026-09-23.**

## What is here

- `Scripts/` - the mod's whole implementation, eight C# files and 3,267
  lines. **This is the author's own source, shipped inside the
  bundle**, not a decompile: `world_of_daggerfall.dfmod` carries it as
  Unity TextAssets beside the manifest, and
  `tools/worldOfDaggerfallAssets.mjs` extracts it byte for byte (mixed
  CRLF/LF line endings kept) through `src/formats/unityBundle.js`, the
  reader World Tooltips' tool uses. Five files are the loader
  (`LocationLoader.cs`, `LocationHelper.cs`, `LocationData.cs`,
  `LocationEnemySpawner.cs`, `LocationModLoader.cs`); three are the
  main-quest exterior (`MainQuestLocationOverhaul.cs`,
  `DungeonExterior.cs`, `PrivateersHold.cs`).
- `worldofdaggerfall.dfmod.json` - the bundle's manifest, verbatim. The
  mod ships no `modsettings.json`; the port gives it `Enabled` alone,
  as Daggerfall Unity enables a mod by listing it.
- `LocationPrefab/` - the 65 prefab layouts, byte for byte: each a
  footprint in terrain samples and a list of objects (a classic model
  by ID, or a flat as `ARCHIVE.RECORD`) with a position, rotation and
  scale.
- `Locations/<region>.bin` - the 44 region folders of instance lists,
  one file per folder. Each is the ported
  `LocationHelper.LoadLocationInstance`'s OUTPUT over that folder's
  files, in the order the mod reads them - see "What is NOT here".
- `locations.json` - the record those packs were read from: every
  source file's name, byte size, sha256 and instance count, folder by
  folder, with each pack's own size and sha256, and the prefabs'.

## What is NOT here, and why

- **The 2,413 instance files themselves.** They are 63 MB of XML - the
  size of this whole vendor tree again - for 227,938 instances of eight
  numbers and two short strings each. The packs carry exactly what the
  mod's own reader takes out of them, in the order it takes it
  (`src/world/wodLocationPack.js`), and `locations.json` names every
  file with its hash, so anyone holding the archive can run the tool
  and get the same packs byte for byte.
- **The compiled bundle.** Nothing in it is anything but the text
  above; its size and sha256 are in `locations.json`.
- **Any art.** There is none to carry: every object a layout names is
  a classic ARCH3D model or a TEXTURE flat, which the port reads from
  the player's own ARENA2 like every other model.

## Integrity (sha256, pinned by `test/wod1_vendor.test.js`)

- `world_of_daggerfall.dfmod` (not vendored) 72960f2dd828a8cbccb83521b532d74d1e10927772c9cf8a69050c13ca699ded
- `Scripts/DungeonExterior.cs` 25e82a5eef715c0e3b005ffce5506d4cd38f070a633801dc1710fd9c6de3799d
- `Scripts/LocationData.cs` c3a8ede41034e4f287781f0540e9a437e81edbedb50d4a34be310fdbfef5cf5e
- `Scripts/LocationEnemySpawner.cs` 8b08119791b64820d3e3535ce692f8b5bd077a3b8a1e9191c58f717bcd6488a7
- `Scripts/LocationHelper.cs` fc9269fe75fc98433a8a15d309bb74785aedb906e9916cd2ec2fd97c9133fcd5
- `Scripts/LocationLoader.cs` f194472b13053705f03522ec48fd685aca1b2816d38fb41229bcc8c935edc650
- `Scripts/LocationModLoader.cs` 384d8be4373312a2d9617d8252292b0bbadbd04030f859b5df4e26ddb901f791
- `Scripts/MainQuestLocationOverhaul.cs` 897a64db39a3bdffdf43dce5311d1acbed0290eb6dcf297135407c686d3496ec
- `Scripts/PrivateersHold.cs` 1a715cae1704a36f3f910f3c2ffc5c6169b749514a79070fe0625bac46d33ed1
- `worldofdaggerfall.dfmod.json` 15b66ae1eb9e785f6178a2a531cd265e2c99e50e8ac646bb7e15402676da6d04

The packs' and prefabs' hashes are in `locations.json`, and the suite
checks every one.

## The port

`bible/03-World/World-Of-Daggerfall.md` is the arc page: what each C#
member became, the readings taken where the C# leaves a choice, and the
four-hosts record. The Port-Ledger carries the section-A row.

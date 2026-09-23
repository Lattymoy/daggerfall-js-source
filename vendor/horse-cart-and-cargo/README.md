# Horse Cart and Cargo 1.0.0-rc12 - demifiend000 (ported 1:1 off the IL, its horse art vendored)

**Horse Cart and Cargo 1.0.0-rc12** for Daggerfall Unity 1.1.1, by
**demifiend000** (Nexus mod 1374; GUID
`8f8c9e8c-3190-4a66-a4f8-bc38e4761830`; the manifest's ContactInfo is
empty). The mod's own description: "A persistent animated horse and
cargo cart with physical hitching and mounting, Follow/Wait commands,
local storage access, animated wheels, and weight-based cargo fullness.
Built for DFU 1.1.1." Its one optional dependency is `daggerfall.harmony`,
for a UI-compatibility sidecar it installs only beside UncannyUI,
Dragon Rider or Expanded Inventory.

It is one MonoBehaviour, `TrailingWagonRuntime` (207 methods: the
persistent horse and wagon, their five modes each, following, hitching,
mounting, the summon, the interior wagon access, the save data), with
`HorseFollowController` and `HorseFollowPath` (the following horse, its
combat evasion), `DeployedWagonVisual`, `StationaryHorseVisual`,
`StationaryHorseBillboard`, `WagonCargoVisual` and
`Wagon41214VisualBuilder` (the wagon model 41214 split into body, wheels
and shafts so the wheels turn; the cargo pieces by fullness; the
directional horse billboard), `HorseNameTooltipController`, three
window subclasses (inventory, trade, transport), and a mod-message API
(`HorseCartCompatibilityApi`). The assembly is `TrailingWagon.dll`
(276,480 bytes); the sidecar is `HorseCartUiCompatibility.bytes`
(15,872 bytes). Forty-five PNGs - the author's own horse art - are
EMBEDDED IN THE ASSEMBLY as manifest resources.

Mac (Lattymoy) handed the shipped bundle
(`Horse_Cart_And_Cargo_1374_1.2.4_2026-09-16T01-22Z`) over on
2026-09-23: "Next mod I want to implement 1 to 1 and also enhance its
online integration functionality."

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## What is here

- `horse-cart-and-cargo.dfmod.json` - the shipped bundle's manifest,
  verbatim (title, version 1.0.0-rc12, author, DFUnity 1.1.1, the GUID,
  the one optional dependency; its `Files` list is empty - the bundle
  was built without one).
- `modsettings.json` - the five sections as the bundle ships them:
  Persistence (PhysicalPersistence), Presentation (ShowTrailingWagon),
  Following (HorseFollowDistance 2..8 default 3, AvoidCombat,
  FollowFastTravel), WagonAccess (InteriorAccessDistance 10..100 default
  50), Hotkeys (QuickMountDismount `K`, SummonTransport `G` - TextKeys, a
  Unity KeyCode name or None). `src/systems/modSettings.js` restates
  every key under the vendor key `horse-cart-and-cargo`, section and
  name joined with a dot, with the port's own `Enabled` in front - with
  ONE departure: the two hotkeys ship on `F7` and `F10` here, because K
  is Travel Options' follow key and G is Handheld Torches' drop key in
  this tree, and no letter is free (HCC-KEYS; HT4's own gate,
  `test/ht1_handheldtorches.test.js`, refuses a shipped collision).
- `textdatabase.csv` - the settings' display names, the mod's own text
  table, verbatim.
- `TrailingWagon.dll`, `HorseCartUiCompatibility.dll` - the two
  assemblies, byte for byte out of the bundle (the sidecar is stored in
  the bundle under the `.bytes` name; the port keeps the assembly's own
  extension). The port's law is their IL, in `il/`, dumped by
  `tools/ilDump.py` (dnfile + dncil), every method body with its members
  resolved; every function of the port names the method it restates and
  the IL offset it was read at.
- `Textures/` - the 45 PNGs out of the assembly's manifest resources
  (`src/formats/dotnetResources.js` reads them; `tools/hccAssets.mjs`
  reproduces every file here from the shipped bundle): `horse1..5.png`
  (121x94) the five stationary directions of a saddled horse, and
  `Walk.<direction>-<frame>.png` (121x95) five directions of an
  eight-frame walk. The mod's `HorseTextureSet.LoadAll` and
  `HorseWalkAnimationSet.LoadAll` read exactly these names.
- This note.

## Why the textures ARE here

The port's doctrine (`bible/01-Overview/Port-Doctrine.md`) keeps ARENA2
and every render of it out of the repository. No ARENA2 file shows a
saddled horse standing in a field from five sides; the mod's own
`StationaryHorseBillboard` draws these, and the walk is the mod's own
animation. They are the author's pixel art, drawn in Daggerfall's idiom,
and they are the mod's data the way Handheld Torches' hands and Dynamic
Skies' skies are - carried with the port under the permission recorded
above.

## The one thing the port does not carry from the bundle

The UI-compatibility sidecar's Harmony patches (over UncannyUI, Dragon
Rider and Expanded Inventory) have no target here: none of those three
mods is part of this port, and `HorseCartUiCompatibilityCoordinator`
resolves to `Native` when none is enabled, which is the mode the port
runs in. The sidecar and its IL are vendored for the record and read
for the scope table (`test/hcc_scope.test.js`), and nothing of them is
ported.

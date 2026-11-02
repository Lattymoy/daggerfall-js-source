# There's a Hole in the Bottom of the Ocean 1.1.0 - jet082 (ported 1:1 off the assembly)

**There's a Hole in the Bottom of the Ocean 1.1.0** for Daggerfall Unity
1.1.1, by **jet082** (Nexus mod 1313; GUID
`e16033ea-15c5-430b-a042-4a6192acb7ed`; the manifest's ContactInfo is
empty). The mod's own description: "Adds deterministic blue holes in the
deep ocean leading to flooded abyssal dungeons with stronger loot." Its
assembly's namespace calls it *OceanHoles*, and its bundle folder
`ocean-holes`. It REQUIRES Iliac Puddle No More (the manifest's one
dependency, not optional): the pits are cut into that mod's carved
seafloor, found through that mod's public seafloor, bake, decoration and
enemy-roster APIs.

Mac (Lattymoy) handed the shipped archive
(`Theres_a_Hole_in_The_Bottom_of_the_Ocean_1313_1.1.0_2026-07-27T00-07Z_Z0nnzkOZH.7z`)
over on 2026-09-25, beside Iliac Puddle No More's, and again on
2026-09-26: "All mods attached are to be compatible and implemented 1:1."

**Permission: granted (Mac handed the archive over 2026-09-25) - the
archive carries no licence text and no readme.**

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here

- `ocean-holes.dfmod.json` - the shipped manifest, verbatim (the bundle
  carries it as `ocean-holes.dfmod`).
- `modsettings.json` - the shipped settings, verbatim: one section,
  General, seven 0..1 sliders. `src/systems/modSettings.js` restates them
  key by key (`General.<Name>`), with the port's own `Enabled` in front.
- `There's a Hole in the Bottom of the Ocean.dll` - the shipped assembly,
  byte for byte (sha256 `fa6fb394...49e5`). The bundle carries no C#
  source (its manifest lists `Scripts/OceanHoles.cs`, compiled into this
  assembly); the port's law is this assembly, read back to C#, and the
  port's modules cite the C# by class and member name
  (`OceanHoles.StableHash`, `OceanHoles.DeformSeafloor`...).
  `OceanHolesDiagnosticsRunner` is the author's own test harness (a
  command-line switch that teleports a character through pits and
  screenshots them) and is not ported.

## What is NOT here, and why

- **No textures, meshes or sounds** - the mod ships none. Its blue hole
  is three discs of one 48-segment mesh the script builds, flat colours
  on Unity's `Unlit/Color`; its miasma is a particle system whose 32x32
  puff texture the script paints; its dungeons are Daggerfall's own
  dungeons, borrowed from MAPS.BSA and flooded at run time.

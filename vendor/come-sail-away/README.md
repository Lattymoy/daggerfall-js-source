# Come Sail Away 2.1 - RedRoryOTheGlen (ported 1:1 off the assembly)

**Come Sail Away 2.1** for Daggerfall Unity 1.1.1, by **RedRoryOTheGlen**
(Nexus mod 1131; GUID `dbe3e8ff-9059-45f1-a8be-732bb6000df7`; the
manifest's ContactInfo is the author's e-mail, kept out of this note).
The mod's own description: "Adds a usable boat and sailing mechanics."
Its assembly's namespace is *ComeSailAwayMod*: one MonoBehaviour,
`ComeSailAway` (6,808 lines read back to C#), and ten small classes
beside it - `Boat`, `ComeSailAwaySaveData` (with `PlacedBoatData` and
`MapMarkerData`), the two item classes `ItemBoatParts` and
`ItemBoatDeed`, `WaterWalkingSilent`, `FixDeformations`,
`ApplyGameTextures` and `RudderAnimationEventListener`.

Mac (Lattymoy) handed the shipped zip
(`Come_Sail_Away_1131_2.1_2026-06-22T11-24Z_FKUUdDR9a`, one file:
`Mods/come sail away.dfmod`) over on 2026-09-26 with the Ocean Holes
archive - "All mods attached are to be compatible and implemented 1:1" -
lifting the hold of 2026-09-25 ("Let's hold off on sail away").

**Permission: granted (Mac handed the archive over 2026-09-26) - the
archive carries no licence text and no readme.**

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here

- `come-sail-away.dfmod.json` - the shipped manifest, verbatim (the
  bundle carries it as `ComeSailAway.dfmod`): title, version 2.1,
  author, DFUnity 1.1.1, the GUID, and the 336 files it was built from.
- `modsettings.json` - the shipped settings, verbatim: ten sections
  (Controls, WindDirectionWidget, Waves, Cargo, Audio, Handling,
  SailingAssist, Compatibility, Map, Debug) and four unnamed spacers.
  `src/systems/modSettings.js` restates every key under the vendor key
  `come-sail-away`, section and name joined with a dot
  (`Waves.Distance`), with the port's own `Enabled` in front. Three keys
  ship that the assembly never reads (`Handling.BadTack`,
  `Handling.BadTackMultiplier`, `SailingAssist.AutoStowGaffSails`); they
  are declared, and do nothing, as in DFU.
- `ItemTemplates.json` - the mod's two item templates, the bundle's text
  verbatim: 1320 "Parts of" (a boat packed up to carry, 120 kg) and 1321
  "Deed to" (0.5 kg). The file ends its array with a trailing comma,
  which DFU's parser takes (FullSerializer's `fsJsonParser` reads an
  element, skips one comma and stops at the bracket -
  `TextAssetReader.Merge` hands it the text as shipped); a strict JSON
  reader does not, so the port reads it as DFU does.
- `Come Sail Away.dll` - the shipped assembly, byte for byte (sha256
  `5ffe5463...bdf5`). The bundle's manifest lists seven C# files, all
  compiled into it; the port's law is this assembly, read back to C#, and
  the port's modules cite it by class and member name
  (`ComeSailAway.UpdateWind`, `Boat.modifierCargoThreshold`...).

- `Textures/` - the mod's own texture archive, 112395, as far as it is
  the author's, written by `tools/comeSailAwayExtract.mjs` after each
  picture was measured against every record of every TEXTURE file:
  - `112395_0-0.png` (a 52x41 splash) and `112395_1-<0..23>.png` (the
    wind widget's arrow, 24 frames) - the author's drawings, indexed PNGs
    of the bundle's pixels;
  - `112395_2-base0.paint.png`, `112395_2-base1.paint.png` and
    `derived.json` - the waves' 32 frames. Every crest pixel of a frame is
    Daggerfall's own snow (TEXTURE.303 record 1) repeated across it, so
    the frames are carried as what the author drew over it: two paints
    (the troughs and the wave shapes, the crests as a key colour), each
    scrolled down the same sixteen steps, and for each frame its paint,
    scroll and the snow's phase. `src/formats/derivedTexture.js`
    `composeTiledPicture` rebuilds a frame from the player's own record -
    the tool checked every rebuild exact against the bundle's frame;
  - `textures.json` - each picture's import settings (point-sampled, one
    mip; the waves repeat, the rest clamp).
- `come-sail-away.files.json` - every file the extractor writes under
  `Textures/`, with the bundle's sha256: the listing `test/tooling/doctrine.test.js`
  holds that folder to, both ways. The bundle's own manifest cannot be that
  authority here, because it names pictures the port does not carry.
- `Sounds/` - the five clips the assembly loads (`ComeSailAway.Start`:
  SmallShipAmbience, ShipExteriorAmbience2, Oars_In, Oars_Sweep,
  Oars_Out), each the bundle's own Vorbis audio, packet for packet, in an
  Ogg stream rebuilt around it (Unity stores a clip as an FMOD bank with
  its Vorbis headers stripped; `tools/lib/fsb5Vorbis.mjs` puts them back,
  the setup header from `vendor/vorbis-fsb-setups/`), and `sounds.json`
  (channels, rate, samples, length).

- `Models/` - the boats, read out of the bundle (`tools/lib/unityScene.mjs`):
  - `prefabs.json` - the twelve prefabs the assembly asks DFU for: the five
    hulls (`SpawnBoat`: 112410 + hull - the dinghy, the old skiff, the
    galleon, the trireme, the carrack) and the seven trigger boxes
    (112400-112406), each the tree `GetBoatTransforms` walks by name -
    every node's name, active flag, layer, position, rotation and scale,
    its components and its children, in Unity's order - with the
    components that are the same shared (1,147 nodes, 482 components);
  - `meshes.json` + `meshes.bin` - the 209 meshes they draw and collide
    with: position, normal, uv0 and the one-bone skin index, the index
    buffer and its submeshes, a skinned mesh's bind poses (the tangents and
    the extra UV sets the models were imported with are not written: no
    shader the boats wear reads them);
  - `materials.json` - the 46 materials (a `TEXTURE.AAA_R` material's
    picture is the player's own, through DFU's `RuntimeMaterials`);
  - `animation.json` - the 5 animator controllers, their 26 overrides and
    the 141 clips they play, each clip's curves as Unity's compiled muscle
    clip holds them.

## What is NOT here, and why

- **Record 3 of archive 112395** (1000x500): it is Daggerfall's own
  travel map - `TRAV0I00.IMG`'s 320x160 interior scaled up - which the
  mod draws the boat's position on. The port builds it from the player's
  own file.
- **The snow under the waves' crests** - TEXTURE.303 record 1, the
  player's own (above).
- **Unity's own pictures** - `Default-Particle`, `Default-ParticleSystem`
  and the two Bayer dither tables: the engine's, not the author's.
- **The three clips the mod ships and never plays** (All_Together,
  oars_cut_1, oars_cut_2): no method loads them, and the rudder's audio
  source that holds one only ever plays the three oar clips over it.
- **The prefabs the assembly never asks for** - the bundle's other 36
  (`boat*.prefab`, the loose crew, lanterns and furniture, the effects):
  the ones a hull uses are already inside its tree, as Unity bakes a
  nested prefab into the one that holds it.
- **Unity's own primitives** (a cube, a sphere, a plane) that a few nodes
  point at: they are named as such (`{ builtin: 'Cube' }`), not carried.
- **The Daggerfall textures the boats wear.** A material named
  `TEXTURE.AAA_R` is Daggerfall's texture archive AAA, record R, which
  the mod (`ApplyGameTextures`) and the port both load from the player's
  own ARENA2 at run time.

`node tools/comeSailAwayExtract.mjs "<come sail away.dfmod>" --arena2 <ARENA2>`
writes `Textures/`, `Sounds/` and `Models/` from the shipped bundle; the
output is a function of the bundle and the ARENA2 alone.

The page for the whole port is `bible/03-World/Come-Sail-Away.md`.

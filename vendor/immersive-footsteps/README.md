# Immersive Footsteps 1.01 - Kirk.O (ported 1:1, its sources and clips vendored)

**Immersive Footsteps 1.01** for Daggerfall Unity 1.0.0, by **Kirk.O**
(Nexus mod 706; the manifest's ContactInfo is the author's e-mail, kept
out of this note). The author's own description: "Adds New Footsteps
Sounds That Change Based On What Terrain Is Being Walked On, Also Armor
Sway Sounds Based On What Type Of Armor You Have Equipped." Two
MonoBehaviours - `ImmersiveFootstepsMain` (the settings, the clip
tables, the worn-armour slots, the transition and window handlers, the
building floor law) and `ImmersiveFootstepsObject` (the fixed-step
stride and sway clocks, the swim distance, the exterior climate and
tile law, the dungeon water law, the landing sounds, the no-repeat
rolls) - and 210 sound clips of the author's own in two qualities.

Mac (Lattymoy) handed the shipped zip
(`Immersive_Footsteps_v1.01_-_DFU_v1.0.0_-_Windows-706-1-01`) over on
2026-09-16: "Next mod we will be adding 1:1."

**Licence: MIT.** The author publishes the mod's sources at
https://github.com/magicono43/DFU-Mod_Immersive-Footsteps, and
`ImmersiveFootstepsMain.cs` carries the MIT header in its first lines
(`License: MIT License (http://www.opensource.org/licenses/mit-license.php)`,
`Author: Kirk.O`). `ImmersiveFootstepsObject.cs` carries no header of
its own and the repository has no LICENSE file; the port takes the main
script's header as the author's statement for the mod.

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## What is here

- `immersive-footsteps.dfmod.json` - the shipped bundle's manifest,
  verbatim (title `ImmersiveFootsteps`, version 1.01, author, DFUnity
  1.0.0, GUID `8c75cd21-ca71-4841-b637-7728433c99f1`, an optional
  dependency on Better Ambience, and the 214 files it was built from:
  two scripts, this settings file, the manifest, 210 clips).
- `modsettings.json` - the four sections as the bundle ships them:
  AudioQualitySettings, FootstepSettings, ArmorSwaySettings,
  ErrorLoggingAndCompatibilitySettings. `src/systems/modSettings.js`
  restates every key under the vendor key `immersive-footsteps`,
  section and name joined with a dot (`FootstepSettings.FootstepFrequency`),
  with the port's own `Enabled` in front.
- `Scripts/ImmersiveFootstepsMain.cs`, `Scripts/ImmersiveFootstepsObject.cs`
  - the two sources the manifest names, copied from the author's
  repository at commit `ac03581` (the bundle carries only their compiled
  `ImmersiveFootsteps.dll`, which is not carried here). Every function in
  `src/systems/immersiveFootsteps.js` names the method it restates and
  the line it was read at.
- `Audio/High_Quality/{Armor_Footsteps,Armor_Swaying,Climate_Footsteps,Fall_Landing}/`
  and `Audio/Low_Quality/{Armor,Armor_Swaying,Climate,Fall_Landing}/` -
  the 210 MP3 clips, 105 per quality, as the author's repository ships
  them (the bundle carries the same clips as Unity's import of each,
  FSB5 Vorbis inside the AssetBundle's `.resource`, which nothing here
  can decode; the set was checked name for name against the manifest).
  Per quality: fourteen footstep sets of six (`<Set>_Footstep_1..6`,
  the mod's `Main` table 1-3 and its `Alt` table 4-6), three sway sets
  of four, four hard-landing pairs, one water landing.
- This note.

## Why the clips ARE here

The port's doctrine (`bible/01-Overview/Port-Doctrine.md`) keeps ARENA2
and every render of it out of the repository. These are not that: no
DAGGER.SND record is a boot on gravel or a chain shirt swaying. They
are the author's own recordings, the mod's data the way Handheld
Torches' hand sprites and Eye Of The Beholder's body sprites are those
authors' - vendored under the author's MIT licence, credited on the
About screen, and without them the mod is a set of empty tables.

## What is NOT here, and why

**The DLL.** `ImmersiveFootsteps.dll` is the author's compiled work
and the sources above are its inputs; it is not carried. **The Unity
import** of the clips (the FSB5 blobs) is not carried either - the MP3s
are the same recordings, and the port's audio engine decodes MP3
through the browser.

**Three arms with no twin.** The mod asks Travel Options whether
accelerated travel is running and stands down while it is
(`CheckForTravelOptionsAcceleratedTravel`); warns about Better Ambience's
footstep module and Tempered Interiors; and logs its exceptions once per
session. None of those mods is vendored, the port has no log file, and
the three keys under ErrorLoggingAndCompatibilitySettings are declared so
the pane matches the mod's and do nothing.

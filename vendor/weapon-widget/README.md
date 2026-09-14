# Weapon Widget 1.6 - RedRoryOTheGlen (ported 1:1)

**Weapon Widget 1.6** for Daggerfall Unity 1.1.1, by **RedRoryOTheGlen**
(Nexus mod 860; the manifest's ContactInfo is the author's e-mail, kept
out of this note). The mod's own description: "Custom first-person
weapon sprite handler for new features." It replaces DFU's `FPSWeapon`
with a clone (`FPSWeaponClone`) that draws the classic weapon sprite
with nine modules - Swings, Ambidexterity, Offset, Bob, Inertia, Step,
DoubleScaleTextures, TrueTextureSize, Recoil - each its own switch.

Mac (Lattymoy) handed the shipped zip (`Weapon_Widget-860-1-6`) over on
2026-09-14: "This is our next mod I want to add 1:1 while also having it
work with morrowind's first person view."

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## What is here

- `weapon-widget.dfmod.json` - the shipped bundle's manifest, verbatim
  (title, version 1.6, author, DFUnity 1.1.1, GUID
  `9f301f2b-298b-43d8-8f3f-c54deaa841e0`, and the 176 files it was
  built from: the one script, this settings file, the manifest, and
  173 textures).
- `modsettings.json` - the nine sections as the bundle ships them:
  Modules (nine toggles), Swings, Offset, Bob, Step, Inertia,
  TrueTextureSize, Recoil, Miscellaneous. `src/systems/modSettings.js`
  restates every key under the vendor key `weapon-widget`, section and
  name joined with a dot (`Bob.Length`), with the port's own `Enabled`
  in front.
- This note.

## What is NOT here, and why

**The script.** The bundle carries `Weapon Widget.dll` (42,496 bytes),
a compiled assembly; the `FPSWeaponClone.cs` its manifest names is not
in the bundle. The port read the IL method by method - the record is
`bible/05-Combat/Weapon-Widget.md`, a table of every method against
where it lives in `src/combat/weaponWidget.js`. The DLL itself is the
author's compiled work and is not carried.

**The 173 textures.** They are the classic weapon sprites -
`WEAPON00.CIF` to `WEAPON11.CIF` and the enchanted `WEAPO101-108.CIF`
set, record 0 frame 0 (the idle pose), one per metal - repainted at
double size for the DoubleScaleTextures and Inertia modules
(`w_WEAPON04.CIF_0-0_Elven.png` and the rest). The port's doctrine
(`bible/01-Overview/Port-Doctrine.md`) is that A RENDER OF GAME DATA IS
GAME DATA, and a re-shaded, re-scaled sprite that keeps the original
silhouette answers yes to "did these pixels come from ARENA2?" - the
same ruling `vendor/seasons-iliac-bay/README.md` records for that mod's
repainted flats. So they reach the game the way ARENA2 does: FROM THE
PLAYER'S OWN COPY OF THE MOD, at play time, and never from this
repository. Attach the mod's `.dfmod` through the textures pick (the
Mods page), as Seasons of the Iliac Bay is attached, and
`src/combat/weaponWidgetAssets.js` reads the double-scale textures off
it by the names the mod asks for. Without the bundle the modules that
need them run as the mod runs without them: the classic frame at
double size.

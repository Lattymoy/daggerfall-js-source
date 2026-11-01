# Weapon Sheathing

Greatness7's Weapon Sheathing 1.6 (an OpenMW mod, Nexus Morrowind mod 46069), ported for the Morrowind body: a
sheathed weapon hangs at the hip or across the back in its scabbard, and a bow or crossbow carries a filled quiver. The
player sees it in third person on their own Morrowind body and on other players' online. Vanilla Morrowind draws no
sheathed weapon at all. The art is vendored under `vendor/weapon-sheathing/` (the mod's permission: credit and no fee).

## How it works

On OpenMW the mod is art plus a setting that turns on the engine's own mechanism. The port vendors the art (71
scabbard meshes and three skeleton addons carrying thirteen new bones) and ports the mechanism, all in
`src/systems/weaponSheathing.js`.

1. **The bones** (`src/formats/morrowind/mwSkin.js` `injectSkeletonNodes`, OpenMW's `injectCustomBones`). Every addon
   under `animations/<model>/` joins its bones to the skeleton: only a node marked with a "BONE" extra data joins, under
   the skeleton's node named as its addon parent, at rest. Unmarked nodes, unknown parents and duplicate names are
   skipped. The addons are taken before any part binds, so a part may attach at a bone they brought.
2. **The holster** (`resolveHolsterParts`, OpenMW's `updateHolsteredWeapon`). A sheathed weapon of type T hangs at
   `SHEATHING_BONE[T]`, OpenMW's sheath-bone column. If `<model>_sh.nif` exists it is the scabbard: it stays attached,
   and its `Bip01 Weapon` node shows while the weapon is sheathed and hides while drawn; an empty weapon node takes the
   base weapon mesh. With no scabbard, the base mesh itself hangs at the bone. A thrown weapon's holster is forced off.
   Holstered meshes are bare instances under the bone, with no bone offset and no mirror.
3. **The quiver** (OpenMW's `updateQuiver`). A scabbard with `Bip01 Ammo` takes one instance of the equipped
   ammunition under each slot, as many as the pack holds (`ammoCountFor`); the last slot empties while a round is on the
   string. A peer's quiver shows full while the wire's ammo bit is up.

**Where it shows.** Third person only; the first-person skeleton has no addon. The holster shows while the weapon is
not in the hand, swapping at the same animation keys as the hand's blade; the scabbard and quiver always show. Peers
ride the same rig.

**The files.** `src/systems/weaponSheathingAssets.js` serves the vendored tree as an archive ranked after the player's
own loose files (a replacer wins) and before every `.bsa`. The switch is the Features row `mod-weapon-sheathing`, on by
default and forced on online, beside "Use Morrowind assets" on the Mods page.

## Rules

- **Implemented for the Morrowind model** (Mac); OpenMW's reference source decides each law.
- Not ported: the mod's MWSE Lua half (not applicable) and its alternate draw animations (a separate slice).
- The holstered weapon's enchantment glow is not drawn; the hand's glow is (`05-Combat/Weapon-Glow.md`).

## Daggerfall Unity

DFU draws no Morrowind body, and Daggerfall no sheathed weapon. The reference is OpenMW 0.48.0
(`actoranimation.cpp`, `animation.cpp`, `npcanimation.cpp`, `weapontype.hpp`, `nifloader.cpp`). The sprite bodies of
Eye Of The Beholder have their own back holster (`06-Systems/Eye-Of-The-Beholder.md`).

## Code and tests

- `src/systems/weaponSheathing.js` - bones, holster, quiver
- `src/systems/weaponSheathingAssets.js` - the vendored archive
- `src/formats/morrowind/mwSkin.js` - bone injection
- `test/formats/morrowind/ws1_sheathing.test.js` - the vendored files through the real parser, injector and binder

## Open

- Not seen on a GPU here: the placement on a retail rig (blade at the hip, bow across the back) is Mac's to confirm.

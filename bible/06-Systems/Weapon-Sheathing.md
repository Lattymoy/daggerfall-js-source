# Weapon Sheathing

Greatness7's Weapon Sheathing 1.6 (an OpenMW mod), ported for the Morrowind body: a
sheathed weapon hangs at the hip or across the back in its scabbard, and a bow or crossbow carries a filled quiver. The
player sees it in third person on their own Morrowind body and on other players' online. Vanilla Morrowind draws no
sheathed weapon at all. The mechanism is OpenMW's, ported; the bones and scabbards are our own, built in code
(`src/systems/ownSheathing.js`). The release's record is in `01-Overview/Own-Work.md`.

## How it works

On OpenMW the mod is art plus a setting that turns on the engine's own mechanism. The port ports the mechanism
(`src/systems/weaponSheathing.js`) and builds its own art (`src/systems/ownSheathing.js`): `SHEATH_POINTS` hangs each
sheath bone the mechanism names under a bone the skeleton already has, at our own place on the body, and
`sheathingAddonBytes` writes them as a bone addon (`SHEATHING_ADDON_PATH`), each node marked "BONE". `ownScabbardBytes`
builds a `_sh` file for the weapon in hand, sized to its own mesh - a sheath, a ring or a quiver - on the mechanism's
file law: `Bip01 Sheath` always shown, an empty `Bip01 Weapon` where the weapon itself hangs, a quiver's `Bip01 Ammo`
with a node a round (`QUIVER_SLOTS`).

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

**The files.** `src/systems/weaponSheathingAssets.js` serves our bone addon as an archive ranked after the player's own
loose files (a replacer, or the mod itself, wins) and before every `.bsa`; the scabbards are built at the holster's
resolve (`resolveHolsterParts`). Morrowind's skeleton is the player's, never the tree's: the pins and bakes stand on our
own biped (`tools/ownBiped.mjs`). The switch is the Features row `mod-weapon-sheathing`, on by
default and forced on online, beside "Use Morrowind assets" on the Mods page.

## Rules

- **Implemented for the Morrowind model** (Mac); OpenMW's reference source decides each law. The bones and scabbards
  are ours (OWN-WORK, the owner).
- Not ported: the mod's MWSE Lua half (not applicable) and its alternate draw animations (a separate slice).
- The holstered weapon's enchantment glow is not drawn; the hand's glow is (`05-Combat/Weapon-Glow.md`).

## Daggerfall Unity

DFU draws no Morrowind body, and Daggerfall no sheathed weapon. The reference is OpenMW 0.48.0
(`actoranimation.cpp`, `animation.cpp`, `npcanimation.cpp`, `weapontype.hpp`, `nifloader.cpp`). The sprite bodies of
Eye Of The Beholder have their own back holster (`06-Systems/Eye-Of-The-Beholder.md`).

## Code and tests

- `src/systems/weaponSheathing.js` - bones, holster, quiver
- `src/systems/ownSheathing.js` - our bone addon and scabbards
- `src/systems/weaponSheathingAssets.js` - the archive of our files
- `src/formats/morrowind/mwSkin.js` - bone injection
- `test/formats/morrowind/ws1_sheathing.test.js` - our files through the real parser, injector and binder

## Open

- Not seen on a GPU here: the placement on a retail rig (blade at the hip, bow across the back) is Mac's to confirm.

# Weapon Sheathing 1.6 - Greatness7 (the OpenMW archive; its art vendored, its mechanism ported)

**Weapon Sheathing 1.6** for Morrowind, by **Greatness7** (Nexus
morrowind mod 46069; the archive is `WeaponSheathing1.6-OpenMW`). The
mod's own description: "Makes equipped weapons no longer disappear
when lowered. Instead they will shown on the character's hip or back
... Additionally features a comprehensive set of high quality quiver
and scabbard assets." On OpenMW the mechanism is the engine's
(`weapon sheathing = true`, `use additional anim sources = true`; the
readme credits "akortunov and the OpenMW team" for it) and the mod is
the ART: seventy-one `_sh` scabbard meshes and three skeleton addons.

Mac (Lattymoy) handed the archive over on 2026-09-17: "Can we
implement this for the morrowind model" - the port's Morrowind
third-person body (the player's own behind the wheel camera, and other
players' online). The mechanism is ported in `src/systems/
weaponSheathing.js` (WS1); see `bible/06-Systems/Weapon-Sheathing.md`.

**Permission**, the mod's own, verbatim from `WeaponSheathing.txt`:
"Everything included in this mod is free to use for your own Morrowind
projects, so long as you give credit to the original authors and do
not charge a monetary fee." The credit is on the About screen
(`src/ui/credits.js`) and below; the port charges nothing.

## What is here

- `Data Files/Meshes/w/*_sh.nif` - the seventy-one scabbards, verbatim.
  Each carries a `Bip01 Sheath` node (always shown) and a `Bip01
  Weapon` node (shown while the weapon is sheathed); twelve bows and
  crossbows carry a `Bip01 Ammo` node whose `Bip01 Ammo N` children
  take the quiver's arrows.
- `Data Files/Animations/xbase_anim/xbase_anim_sh.nif`,
  `xbase_anim_female/`, `xbase_animkna/` - the skeleton addons: the
  retail hierarchy carrying the fourteen sheathing nodes (`Bip01
  ShortBladeOneHand` ... `Bip01 MarksmanCrossbow`, `Bip01
  AttachShield`, `Bip01 AttachWeapon`).
- `WeaponSheathing.txt` - the shipped readme: the change log, the
  modder notes, the permission, and the full credits of every artist
  whose asset is here (akortunov, Greatness7, Heinrich, London Rook,
  Lord Berandas, Melchior Dahrk, MementoMoritius, Petethegoat,
  PikachunoTM, Remiros).

## What is NOT here

- `Extras/alternate draw animations/` - replacement `.kf` files that
  draw two-handed weapons from the back rather than the hip. Not
  vendored: the port's third-person rig plays the player's own `.kf`
  sources, and an animation replacer is a separate slice.
- The MWSE half of the mod (its Lua) - not applicable; the port speaks
  the OpenMW mechanism.

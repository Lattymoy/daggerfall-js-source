# Combat

How a blow, an arrow or a shot is swung, drawn and resolved, for the player and for foes. The core is DFU's
FormulaHelper and weapon state machine, ported; around it sit the port's own swing law, the classic first-person
weapon sprites, the Morrowind arms when Morrowind's data is attached, and the combat mods. The player meets it in
every fight.

## How it works

- **Formulas** (`src/combat/formulas.js`): DFU's `FormulaHelper` with injectable rolls: to-hit (`skillsToHit`,
  `calculateSuccessfulHit`), damage (`calculateAttackDamage`, `handToHandAttackDamage`), backstab
  (`backstabDamage`), material and body-part rules (`WEAPON_MATERIAL_MODIFIER`, `calculateStruckBodyPart`),
  equipment wear (`damageEquipment`) and knockback (`weaponKnockbackSpeed`, `weaponKnockbackApplies`). A mod
  replaces a formula through `registerFormulaOverride`, as DFU's mods do.
- **The swing machine** (`src/characters/weaponStates.js`): DFU's weapon states for the player and foes: strike
  frames, the hit frame, the bow's draw, hold and loose, equip delays.
- **The player's swing law** (`swingFrameSeconds`): a frame's time is DFU's frame at Speed 50
  (`SWING_BASE_FRAME`) times `swingTempo(Speed)` (1.4 at 0, 1 at 50, 0.6 at 100) times `swingHeft` (the weapon's
  base weight as the arm feels it, `(150 - Strength)%` of it, 4.5% a kilogram past 2.5 kg, at most 35%) times
  `swingHandling` (per weapon type; every short blade handles as a dagger; two-handers 6% more). A frame is held to
  `SWING_FRAME_MIN`..`SWING_FRAME_MAX` (0.09 to 0.4 s). `src/combat/swingLaw.js` reads the weapon in hand for it.
  Foes, peers' walkers and viewers keep DFU's line.
- **Mods on the swing.** Roleplay & Realism's weapon speed and Items' weapon balance set the Speed the swing is read
  at; Items' weight law replaces the port's heft.
- **First person.** The classic hand is DFU's method with the true art: WEAPON*.CIF frames, the metal's dye and
  FPSWeapon's screen alignment (`src/combat/fpsWeapon.js`), driven by the weapon rig (`src/combat/weapon/weaponRig.js`).
  With Morrowind's data the Morrowind arms stand instead (`src/combat/fpArm.js`); the arm fits each blow's wind-up and
  release to the machine's hit (`blowSchedule`), so a fast swing draws every blow.
- **Player melee** (`src/combat/playerWeapon.js`): drag-to-swing, the direction buttons, the hit's reach and
  resolution. Arrows fly as missiles (`src/combat/arrowFlight.js`).
- **Foes** use the same formulas and machine through the enemy port (`Characters-Arc.md`), with their equipment and
  per-part armour from `src/combat/enemyEquipment.js`.
- **Voices** (`src/combat/combatVoices.js`) and blood (`Blood-Arc.md`) answer hits.

## Rules

- The classic first-person weapon is the Daggerfall method, 1:1 with the true art (Mac).
- The player's swing is the port's own law, not DFU's hyperbola: do whatever is most detailed, departures allowed
  where better (Mac). Short blades swing faster (the owner).
- A blow is never quicker than 0.45 s or slower than 2 s, and a frame is never zero.
- The Morrowind arm's blows scale with attack speed (Mac).

## Daggerfall Unity

The formulas, machine and first-person sprite follow `FormulaHelper.cs`, `WeaponManager.cs` and `FPSWeapon.cs`.
Departures: the swing law (DFU's `GetMeleeWeaponAnimTime`, `3 * (115 - Speed) / 980` a frame, runs four times as fast
at Speed 100 as at 50); the Morrowind arms; the techniques and martial paths; online combat.

## Pages

- `Two-Hands.md` - dual wielding and the off hand, spell hand
- `Weapon-Techniques.md`, `Martial-Specialisations.md` - weapon techniques and martial paths
- `Balance-Arc.md`, `Power-Ceiling.md`, `Boss-Traits.md` - balance, the power ceiling, boss traits
- `Weapon-Glow.md`, `Blood-Arc.md` - enchanted weapon glow, blood
- `Weapon-Widget.md`, `Shield-Widget.md`, `Diverse-Weapons.md`, `Physical-Combat-Overhaul.md`,
  `Readied-Spellcasting-Hands.md` - the combat mods
- `Dwarven-Thunderlock.md`, `Dwarven-Pistolet.md`, `Gun-Lab.md`, `Pistol-Lab.md` - guns
- `Arrow-Supply.md`, `Hand-Wraps.md` - arrows, hand wraps

## Code and tests

- `src/combat/formulas.js` - FormulaHelper
- `src/characters/weaponStates.js` - the swing machine and the swing law
- `src/combat/swingLaw.js` - the weapon the swing reads
- `src/combat/playerWeapon.js`, `src/combat/fpsWeapon.js`, `src/combat/weapon/weaponRig.js` - the player's weapon
- `test/systems/swinglaw.test.js`, `test/systems/audit0929_swing.test.js` - the swing law, one clip a blow

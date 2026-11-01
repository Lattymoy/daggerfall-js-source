# Weapon Widget

RedRoryOTheGlen's DFU mod Weapon Widget 1.6, ported 1:1 from its DLL's IL, and extended to move the Morrowind arms. It
draws the classic first-person weapon itself, beside DFU's `FPSWeapon`, with nine modules: Swings, Ambidexterity,
Offset, Bob, Inertia, Step, DoubleScaleTextures, TrueTextureSize and Recoil. It is on by default; its 41 settings are
under its card on the Mods page. The vendored record is `vendor/weapon-widget/`.

## How it works

- **The clone** (`createWeaponWidget`, `src/combat/weapon/weaponWidget.js`) is the mod's `FPSWeaponClone`, one per
  host, owned by the weapon rig (`src/combat/weapon/weaponRig.js`). `lateUpdate(dt, ctx)` is its `LateUpdate`, after
  the swing machine steps; `ctx` carries the art, the weapon, the machine, the motor's words and the frame's look in
  DFU's own axes. `draw` is its repaint: one screen quad of the current frame over `GetWeaponRect`.
- **Coroutines** are generators on Unity's clock: `WaitForSeconds` and `WaitForEndOfFrame` (`endOfFrame`, called by
  the rig after its draw).
- **Arithmetic split out** (`src/combat/weapon/weaponWidgetMotion.js`): settings (`readWidgetSettings`), the Offset,
  Bob and Inertia modules and the rect transform, so the gun and pistol labs run the same code.
- **The hit seam.** `onAttackDamageCalculated` is fed from `resolveHit` for the player's own blows (recoil, parry
  sounds, the miss effect).
- **The Morrowind arms.** The rig sets `fpArm.setScreenTransform` to the widget's arms transform while the mod is on:
  Position and Scale only (Bob, Inertia, Step, the floor), not the Offset slide, since the arms sheathe with their own
  clips. The arms use the plain bob shape (`armsPosition`); the doubled-idle shape is for a doubled texture.
- **Textures.** The mod's 173 repainted weapon PNGs are renders of ARENA2 art, so they are not in the repository. They
  reach the game from the player's own copy of the mod, attached through the Mods page
  (`src/combat/weapon/weaponWidgetAssets.js`, found by the manifest's GUID). Without them, the modules run as the mod
  runs without them.
- **Two hands.** Both fists or a pair: the rig's clone is the right hand and `twoHands.js` owns a second
  (`offWidget`) for the left, mirrored, on the right clone's clock (`Two-Hands.md`). A gun hand of a blade-and-gun pair
  gets a still machine; a readied spell hand stands on the side the clone is not.

## Rules

- Integrated 1:1, and working with the Morrowind first-person view (Mac).
- Every default is the mod's shipped default (Mac); Diverse Weapons' preset is off by default.
- The settings restate the shipped `modsettings.json` under `weapon-widget` (`src/systems/modSettings.js`), including
  float sliders; the widget reads its switches every frame.
- A StrikeUp of anything but a dagger recovers in reverse at half the tick (the mod's `VanillaRecoveryOverride`, on);
  the reverse is latched to run once.
- Not carried: cross-mod seams for mods the port lacks; six duplicates of laws the port runs once (the bow's
  out-of-arrows sheathe, the unsheathe sound, the original's hide, the combat voice, the lycanthrope's move clock, the
  bow's loose sound); the clang's emissive material; the boot sheathe artefact.

## Daggerfall Unity

DFU's `FPSWeapon` draws the classic weapon; the mod hides it every frame and draws its own. Departures: the Morrowind
arms take the clone's Position and Scale; the arms keep a plain bob.

## Code and tests

- `src/combat/weapon/weaponWidget.js` - the clone
- `src/combat/weapon/weaponWidgetMotion.js` - settings and motion arithmetic
- `src/combat/weapon/weaponWidgetAssets.js` - the texture door
- `test/combat/weapon/ww1_weaponwidget.test.js` - the clone, the thrust, the shipped defaults

## Open

- The permission record is open in the Mod-Registry (Mac handed the zip over).

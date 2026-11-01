# Shield Widget

RedRoryOTheGlen's DFU mod Shield Widget 1.6, ported 1:1 from its DLL's IL: a shield sprite in the first-person view
when the character has one equipped, which classic Daggerfall never draws. It raises and lowers, blocks, recoils and
visibly batters as the shield wears. It is on by default; its settings are under its card on the Mods page. The
vendored record is `vendor/shield-widget/`.

## How it works

- **The component** (`src/combat/shieldWidget.js`), owned by the weapon rig, draws the shield as a screen quad in its
  pose (`SHIELD_POSE`: Hide, Off-screen, Corner, Ready) for each state: sheathed, attacking, casting.
- **The sprites** (`vendor/shield-widget/Textures/`, through `src/combat/shieldWidgetAssets.js`): 600 pictures
  (`SHIELD_TEXTURE_COUNT`). The archive is the shield's kind (`SHIELD_ARCHIVE_FIRST` 112360: Buckler, Round, Kite,
  Tower); the record is a material group plus a condition tier; the frame (`SHIELD_FRAMES`, 5) is the raise and
  lower. `shieldTextureIndex` picks one. The condition tier changes live as the shield is hit (`HitShield`), so it
  batters in the fight.
- **Blocks and recoil.** A hit on a part the shield covers (`isPartShielded`) drives the block and the recoil; parry
  sounds are DFU's clips (`PARRY_CLIP_FIRST`). The parts a shield covers are its own template's numbers, whatever look
  the Wardrobe dresses it in (`coverTemplate`).
- **Cross-mod seams the port can carry:** Eye of the Beholder's third-person toggle hides the sprite in third person;
  the combat overhaul's damage message triggers the Recoil module.
- **The gate ladder.** The sprite is refused for eleven reasons; each of sheathed, attacking and casting hides it when
  its pose is Hide, or, with the Animation module, Hide or Off-screen once the slide has finished. Sheathed yields to
  the other two.
- **Under the Morrowind arms** the shield sprite does not draw.
- **Settings** (`readShieldWidgetSettings`; restated flat in `src/systems/modSettings.js` under `shield-widget`): the
  mod's eight sections, 36 keys, its defaults, plus the port's `Enabled` (on).

## Rules

- Integrated 1:1 (Mac). The sprites are the modder's own art, not renders of ARENA2, so they are carried in the repo
  (Mac: integrated directly, not read from the player's bundle).
- The sprites are indexed PNGs with 1-bit alpha, every drawn pixel identical to the bundle's, stored top row first:
  every sprite's top row is transparent and its bottom row holds the arm.
- Kept bug for bug: a left-handed player's animated block snaps instead of easing; Silver draws the leather art.
- Departure: the sheet reload is keyed on the template and material pair (`templateIndex * 1024 +
  nativeMaterialValue`), where the mod's sum collides.
- Not carried: the FPS-models seam (no such mod here) and Unity's own plumbing.

## Daggerfall Unity

DFU draws no first-person shield; the mod adds one. The port follows its IL method by method.

## Code and tests

- `src/combat/shieldWidget.js` - the component
- `src/combat/shieldWidgetAssets.js` - the sprite door
- `test/combat/sw1_shield_widget.test.js` - the component, the gate ladder, the key, all 600 sprites the right way up

## Open

- The permission record is open in the Mod-Registry (Mac handed the zip over).

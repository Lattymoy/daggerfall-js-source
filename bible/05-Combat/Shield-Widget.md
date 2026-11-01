# Shield Widget

RedRoryOTheGlen's DFU mod Shield Widget 1.6, ported 1:1 from its DLL's IL: a shield sprite in the first-person view
when the character has one equipped, which classic Daggerfall never draws. It raises and lowers, blocks, recoils and
visibly batters as the shield wears. It is on by default; its settings are under its card on the Mods page. Every
face is our own painting; the release's provenance is in `01-Overview/Own-Work.md`.

## How it works

- **The component** (`src/combat/shieldWidget.js`), owned by the weapon rig, draws the shield as a screen quad in its
  pose (`SHIELD_POSE`: Hide, Off-screen, Corner, Ready) for each state: sheathed, attacking, casting.
- **The faces** (`src/combat/shieldFaces.js` `paintShieldFace`, through `src/combat/shieldWidgetAssets.js`): 600 slots
  (`SHIELD_TEXTURE_COUNT`), each painted in code the first time the widget asks for it. The archive is the shield's kind
  (`SHIELD_ARCHIVE_FIRST` 112360: Buckler, Round, Kite, Tower, at the mod's four sizes); the record is one of ten
  material groups plus one of three wear tiers; the frame (`SHIELD_FRAMES`, 5) runs from the guard to the shield turned
  out of the way. `shieldTextureIndex` picks one. Each face takes the painter's light: a bevelled rim, a boss that casts
  its shadow, studs that glint, metal with a sheen, and the leather group's face in planks of wood. The forearm runs off
  the bottom edge and the top edge stays clear. The condition tier changes live as the shield is hit (`HitShield`), so
  it batters in the fight.
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
  mod's eight sections, 36 keys, its defaults, plus our `Enabled` (on). Our presets (`SHIELD_WIDGET_PRESETS`) follow
  one rule: a section at its defaults, or every slider of it half the way toward one end of its range.
- **Off the screen, nothing.** `draw` emits nothing for a rect wholly past the screen's edge; `drawRect` still answers
  it, the gate ladder's own verdict.

## Rules

- Integrated 1:1 (Mac), with our own faces (OWN-WORK, the owner): the settings, slots, frames and timing are the mod's.
- Every face's top row is transparent and its bottom rows hold the arm.
- Kept bug for bug: a left-handed player's animated block snaps instead of easing; Silver draws the leather art.
- Departure: the sheet reload is keyed on the template and material pair (`templateIndex * 1024 +
  nativeMaterialValue`), where the mod's sum collides.
- Not carried: the FPS-models seam (no such mod here) and Unity's own plumbing.

## Daggerfall Unity

DFU draws no first-person shield; the mod adds one. The port follows its IL method by method.

## Code and tests

- `src/combat/shieldWidget.js` - the component
- `src/combat/shieldFaces.js` - our faces; `src/combat/shieldWidgetAssets.js` - the face door and the presets
- `test/combat/sw1_shield_widget.test.js` - the component, the gate ladder, the key, all 600 faces the right way up

## Open

- The permission record for the ported code is open in `01-Overview/Own-Work.md` (Mac handed the zip over).

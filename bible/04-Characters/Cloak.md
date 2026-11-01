# The Cloak

The port's own cloak for the Morrowind body, and the switch that shows or hides a player's cloak. Daggerfall's Casual
and Formal Cloaks (templates 154, 155, 191, 192) wear one mesh in eight paintings, rigid on the chest, with stowed
weapons fitted around it. The player meets the switch as an eye in the inventory's Cloaks panel.

## How it works

- **The mesh.** `tools/bakeCloak.mjs` bakes one sheet hung from the shoulders to the calves, smoothed round the
  shoulders (`tools/meshSubdivide.mjs`), skinned to `CHEST_BONE` (`Bip01 Spine2`) alone at weight one. A stride, an arm
  or a seat moves none of it; a chest lean carries it all. It is one mesh per painting (`cloakModel`).
- **Worn.** `ownCloakFor` (`src/characters/ownModels/ownClothingModels.js`) answers for a Casual or Formal Cloak by its
  dye; a dye Mac did not paint wears the nearest of the eight (`CLOAK_DYE_PAINTING`). `composeWornArmor`
  (`src/formats/morrowind/mwItemMap.js`) adds the cloak last, claiming and reserving no slot, so armour and clothes
  under it compose as without it. The first person never draws it. The item's icon is the cloak in its painting.
- **The fits** (`src/formats/morrowind/mwCloakFit.js`, run by `fitThirdPersonCloak` in `src/combat/fpArm.js`):
  - `fitCloakOver` eases the sheet back over the body and armour under it, held over `CLOAK_FIT_POSES` (rest,
    strides, arms back, a 10-degree lean). A point more than `CLOAK_PUSH_LIMIT` through it is left and named on the
    card.
  - `fitStowedGear`: gear slung on the back (greatswords, the bow) is worn over the cloak, turned within
    `SLUNG_PITCH_LIMIT` to lie along it; gear hung at the hip stays under it, pitched forward the least that clears it.
  - `followCloak` ties each holster to the cloak at rest and, every pose, turns hip gear the least that keeps it clear
    (`FOLLOW`: at most 25 degrees and 8 units a pose).
- **The cape switch** (`src/systems/capeShown.js`). One device pref, `capeShown` (on by default).
  `drawnEquipTable(entity)` is the player's equip table with Cloak1 and Cloak2 empty while capes are hidden. Every
  drawer of the player's own body reads it: the Eye of the Beholder sprite's outfit, the Morrowind body, the pack's
  figure, and the look sent to others (`composeLook`), which then carries `hc`. The eye in the Cloaks panel turns it
  (`capeSwitch` in `src/ui/enhanced/enhancedInventory.js`).

## Rules

- The cloak animates with the body and does not clip stowed weapons: slung gear rides over it (Mac).
- Both cloaks wear it, a man's and a woman's (Mac).
- The cloak is rigid on the chest bone alone; no other bone moves it (the owner).
- Hiding the cape hides only how it is drawn. The cloak stays worn: its warmth, a raised hood and a vampire's shade read
  the real table.
- Everyone sees a hidden cape as hidden (the owner). The switch is this player's, on this machine.
- The aura stays shown when the cape is hidden; taking the cloak off is how a player shows an aura
  (`src/scenes/auraHost.js` reads no cape switch). Aura Armory pieces are not capes.
- The helmet has no toggle: Layered Gearing has no bare head (the owner: cape only for now).

## Tamriel

The switch reads no place: the pref, the drawn table, the look and `hc` are the same in every province.

## Daggerfall Unity

DFU draws no body of the player and has no cloak mesh or cape switch. On the Morrowind body a Daggerfall cloak would
map to a Morrowind robe that hides every armour piece; the port's cloak replaces that.

## Code and tests

- `src/characters/ownModels/ownClothingModels.js` - cloak names, paintings, dye map
- `src/formats/morrowind/mwCloakFit.js` - the three fits
- `src/systems/capeShown.js` - the cape switch
- `tools/bakeCloak.mjs`, `tools/meshSubdivide.mjs` - the bake
- `test/tooling/mwcloak1.test.js`, `test/formats/morrowind/auditmwcloak.test.js` - the bake, the cloak in motion
- `test/ui/capetoggle.test.js` - the switch, the look and wire, the auras, the one door

## Open

- No cloth simulation: the cloak follows the chest. The hood in the paintings has no shape in the mesh.
- One cloak is drawn of two worn.
- Seated, the hem stands about 3.5 units into the floor (the owner's chest-only rig, kept as asked).
- Leaning back past 10 degrees, the hem can sweep past the hip gear's turn cap.
- The hip lantern is in neither fit; stowed shields are not in the port.

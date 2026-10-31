# Weapon Glow

A weapon whose blow carries fire, frost or shock wears an animated outline of its element in the hand: fire's tongues
climb, frost's rime breathes and glints, shock's edge crackles. The classic sprite draws it in its own pixels; a
Morrowind weapon draws it round its model and lights its own surface. An enchanted Morrowind weapon with no element
takes an arcane glow. The Aura Armory's weapon pieces, Gilded weapons and staff-set glows use the same drawer. Other
players see a glowing weapon on a Morrowind body as its owner does. It is a Settings row, Weapon glow, on by default.

## How it works

- **Which look** (`src/systems/weaponGlow.js`, `weaponGlow`, `spriteGlow`, `meshGlow`), in order of what shows first:
  1. A glow a staff member set on the piece with `/glow` (`glowSet`, `src/systems/staffGlow.js`).
  2. A Gilded weapon's crimson (`gilded`, `GILDED_LEVEL`).
  3. The element its blow carries: its `elemental` loot lines and socketed gems, read as the blow reads them
     (`weaponElement`). The most of one element shows; a tie goes fire, frost, shock. Strength 1 to 3 by the total
     (`GLOW_LEVEL_EDGES`).
  4. The Aura Armory's weapon piece (`brand`, `edge`; `armoryWeaponLook`), on every weapon in the player's hand.
  5. The arcane look on a Morrowind weapon that is enchanted (`ARCANE_LEVEL`).

  Bare fists wear the armory's weapon piece (`fistGlow`); Hand Wraps wear only that piece or a set glow.
- **Looks** (`src/render/weaponGlowGlsl.js`, ramps in `GLOW_RAMPS`): fire, frost, shock, arcane, brand, edge, gilded,
  each a band round the silhouette, hottest at the edge and cooling outward in four palette steps, its reach moving in
  its own way. The weapon's own edge takes the element's light inside the silhouette. The clock wraps at 240 s with
  every rate whole over it.
- **The classic drawer** (`drawScreenQuadGlow`, `src/render/renderer.js`): drawn over the sprite on the same rect and
  mirror, emissive, from a distance field baked once per frame, look and cut (`_glowField`). The classic sprite, the
  Weapon Widget clone and the Thunderlock all take it. While an element shows, the hand swings the plain sheet under it
  (`plainWeaponType`).
- **The Morrowind drawer** (`glowLook` in `drawRigSpriteBox`, `src/render/characterSprite.js`; `src/combat/fpArm.js`):
  the outline round the weapon's model and its ranges lit by the element.
- **Online.** A weapon in a player's hand carries `glow`, one of thirteen words (`glowWord`, `glowFromWord`;
  `LOOK_GLOW_RE`, `lookGlowOk` in `src/net/wire.js`), written from the owner's card and omitted when none. A peer's
  Morrowind body reads it and glows by the viewer's switch. A foe's kit carries no glow.

## Rules

- The owner gave this to the port to decide, not bound to DFU parity.
- The element is the blow's: only `elemental` lines and gems name one. A Legendary's power and a cast-when-strikes
  enchantment do not.
- The outline says no more than the card: an unidentified piece hides its element; the classic hand swings DFU's
  enchanted sheet and the Morrowind hand the arcane glow.
- The switch (`weaponGlow`, `?weaponglow=off`) is read every frame; the loot ladder's switch answers first, so with it
  off no element shows. A Gilded rung shows only with the ladder on.
- The armory piece is on both hands when dual wielding.
- Every spec is built once and frozen; the frame's ask builds nothing.

## Daggerfall Unity

DFU says only enchanted or not: `ConvertItemToAPIWeaponType` promotes an enchanted item to its `*_Magic` sheet
(WEAPO1xx). Departures: the promotion is undone while an element shows; the outline wraps the whole frame's silhouette,
hand included, since a classic frame has no weapon mask; the Morrowind glow is the port's own (OpenMW lays an animated
texture from the archives, coloured by the first effect).

## Code and tests

- `src/systems/weaponGlow.js` - the laws, specs, words
- `src/render/weaponGlowGlsl.js` - the looks
- `src/render/renderer.js`, `src/render/characterSprite.js`, `src/combat/fpArm.js` - the drawers
- `src/systems/staffGlow.js` - the staff `/glow` command
- `tools/weaponGlowProbe.mjs` - the drawer's frame cost
- `test/systems/weaponglow1.test.js`, `test/systems/glowset.test.js`, `test/systems/gildedglow.test.js` - the laws,
  set glows, Gilded

## Open

- A holstered weapon does not glow.
- A classic-lane peer's mobile sprite, a foe's weapon and the inventory figure draw no glow. The fixed-city bench draws
  no sprite glow.
- A Legendary's elemental power and an Aetheric weapon with no element line show nothing of their own.
- Enchanted armour and clothing do not glow.

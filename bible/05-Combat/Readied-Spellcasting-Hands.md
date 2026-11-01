# Readied Spellcasting Hands

jefetienne's DFU mod Readied Spellcasting Hands 1.3 (MIT), ported 1:1 from its own source: while a spell is readied,
the first-person view shows the casting hands raised, where DFU shows nothing until the click starts the cast. It is a
Features row under Combat, on by default. The vendored source is `vendor/readied-spellcasting-hands/`.

## How it works

- **The mod** is DFU's `FPSSpellCasting` copied whole, with one change to `AnimateSpellCast`: every 0.04 s it shows
  frame 0 of the readied spell's element while a spell is readied, it is not caster-only, and no cast is playing. A
  self-only spell casts the moment it is readied, so it raises nothing.
- **The answer** (`readiedHandsFrame`, `src/combat/fpsSpellCasting.js`): frame 0 or -1. Caster-only is the spell
  record's `rangeType` 0; an element with no art draws nothing.
- **The draw** (`src/combat/weapon/weaponRig.js`), at the cast hands' own site through `drawSpellCastHands` at that
  frame: the same art cache, layout, large-HUD offset and first-person light. Each host hands the readied record from
  its spell engine (`src/scenes/hostMagic.js`).
- **The spell hand.** With a one-handed weapon in the fighting hand and nothing in the other, the readied spell takes
  only the free hand (`drawSpellHand`, `src/combat/twoHands/spellHand.js`), on the side the weapon is not, lowered while
  the weapon swings (`Two-Hands.md`). Otherwise the mod's two hands stand.

## Rules

- Implemented into the source, 1:1 (Mac); on by default, as every mod.
- Classic sprite lane only: the Morrowind arms hold their own spell stance, and Eye of the Beholder's third person
  hides the readied hands as it hides the cast's.
- Online it is the player's own: hands on one's own screen; the cast and its wire are unchanged.
- The readied hands stand down while the enhanced climb's fists are on the wall (`climbHands.showing()`), and return
  once they are gone; the spell stays readied and a click on the wall casts it.

## Daggerfall Unity

DFU's `FPSSpellCasting` shows nothing while a spell is merely readied; the mod adds the readied frame. Departures from
the mod: the readied hands wait on the enhanced climb's fists (DFU's climb draws none), and the spell hand beside a
one-handed weapon.

## Code and tests

- `src/combat/fpsSpellCasting.js` `readiedHandsFrame` - the mod's condition
- `src/combat/weapon/weaponRig.js` - the draw
- `tools/readiedHandsAssets.mjs` - reproduces the vendored files from the bundle
- `test/systems/rsh1_readiedhands.test.js` - the condition, the draw, the lanes

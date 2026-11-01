# The Dwarven Pistolet

The port's second gun: a one-handed Dwemer flintlock-style pistol that spends the Thunderlock's Dwemer Pellet, so two
of them (or a Pistolet and a blade) make a pair. It is not found as loot; players who hold one keep it. Its feel
is tuned in the pistol lab (`Pistol-Lab.md`), which runs the same code.

## How it works

- **The item** (`PISTOLET_TEMPLATES`, `src/systems/pistolet.js`): template and art archive 562
  (`PISTOLET_TEMPLATE`, `src/characters/thunderlockIds.js`), 2.5 kg, 260 gold, damage 4-15 (`PISTOLET_SPAN`, stated
  once on the leaf), Archery, either hand. It spends the Dwemer Pellet (`ammoTemplateFor`) and fires the same shock orb.
- **Guns answered together.** Every reader that asks about a gun rather than one gun answers for both: `isGunTemplate`,
  `isGunType` (`src/combat/fpsWeapon.js`), the technique family (Piercing Shot), the siege referee, the item law, the
  icons. An element line glows on each pistol of a pair and lands its damage on a shot as on a swing. Its name says its
  metal once.
- **One gun in first person.** The pistol lab's strip and viewmodel draw it (`src/combat/gun/pistolStrip.js`,
  `src/combat/gun/pistolViewmodel.js`, wired by `src/combat/gun/pistolLane.js`), placed by `PISTOLET_FEEL`
  (`src/combat/gun/gunFeel.js`), raised -60. A Pistolet takes the room's light. Each frame's forearm is carried past
  its canvas along the arm's lean so the sprite never shows an unfilled edge.
- **The pair** (`DUAL_GUN_TYPES`, `src/combat/twoHands/handsLaw.js`). Two machines, one a pistol, each with its own six
  frames and reload (`src/combat/gun/pistolPair.js`). The hands alternate by the flurry law; a pull given to a hand
  still reloading falls to the loaded one; a gun's flurry never skips a frame. The off hand's shot carries the dual
  terms (0.8 damage, Agility's to-hit, 0.8 of a blow), read where the shot lands. A reload is kept through a pair broken
  for a frame. A technique is the lead hand's. A blade and a Pistolet also pair (`Two-Hands.md`).
- **The paperdoll** has both hands' layers (`PISTOLET_PAPERDOLL_OFFSET`, `PISTOLET_ART_RECORDS`), with the hand's gap cut.
- **The Morrowind arm.** The model is built part by part and painted (`tools/modelPistolet.mjs`, baked by
  `tools/bakePistolet.mjs`). While drawn, the arms are solved onto the pistol in an idle and an aim stance
  (`src/combat/gun/pistolStance.js`, chosen by `holdAs` in `src/combat/gun/gunHold.js`); a pair holds one in each hand,
  the left mirrored.
- **Gilded.** A gold Pistolet a save holds stays lawful as its record's Pistolet era (`SOVEREIGN_PISTOLET_ERA`,
  `src/systems/gilded.js`); the serpent's Gilded record itself is the Ebony Saber. A Legendary
  Pistolet is The Last Lock, the Thunderlock's record.

## Rules

- A dwarven flintlock-style pistol that can be dual wielded, named the Dwarven Pistolet, using the Thunderlock's ammo
  (the owner).
- The lab's values and sounds exactly (the owner); the pistols sit at raise -60 (Mac).
- Its own stance, idle and active, like the Thunderlock's (the owner).
- Neither gun drops any more; held guns stay the player's (the owner).
- A Morrowind model built from the sprite as a real 3D model (the owner).

## Daggerfall Unity

DFU has no gun and no dual wielding. Departures: the arms solved onto the pistol rather than a borrowed throw clip; the
gun pair and its per-hand reload; the lab's camera shake, tint, Offset and Bob switches, holster and handedness; a
weapon's own Weapon Widget tuning over Diverse Weapons' preset; the doll's two hands for a custom weapon; the forearm
carried past its canvas.

## Code and tests

- `src/systems/pistolet.js` - templates, damage, icons, paperdoll
- `src/combat/gun/` - `pistoletArt.js`, `pistolStrip.js`, `pistolViewmodel.js`, `pistolLane.js`, `pistolPair.js`,
  `pistolStance.js`, `gunFeel.js`
- `tools/pistoletArt.mjs`, `tools/modelPistolet.mjs`, `tools/bakePistolet.mjs` - art and the Morrowind model
- `test/systems/pistolet.test.js`, `test/combat/pistolet_law.test.js` - the item and the pair
- `test/combat/pistolstance.test.js`, `test/combat/gun/pistolport.test.js`, `test/combat/gun/pistoledge.test.js` - the
  stance, the lab's port, the edge

## Open

- The stance was picked on the vendored retail skeleton, not on Morrowind's own bodies.
- The pistol's sounds are the gun lab's clips; a flintlock's own were never searched for.
- The doll's placement waits on the owner's eye.
- No Legendary of its own: it borrows The Last Lock.

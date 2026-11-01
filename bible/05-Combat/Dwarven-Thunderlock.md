# The Dwarven Thunderlock

The port's own two-handed Dwemer long gun and its ammunition, the Dwemer Pellet: the first item Daggerfall does not
have. It fires a ball of bound lightning on the Archery skill, with a visible reload. It is not found as loot;
players who hold one keep it. Pellets are a rare find. The gun lab (`Gun-Lab.md`) is where its feel is tuned.

## How it works

- **Templates** (`src/characters/thunderlockIds.js`, a leaf that imports nothing): the gun is 560 and the Pellet 561
  (`THUNDERLOCK_TEMPLATE`, `PELLET_TEMPLATE`), past DFU's 288 and Climates & Calories' rows, registered through
  `registerCustomTemplates` (`THUNDERLOCK_TEMPLATES`, `src/systems/thunderlock.js`). DFU's tables are untouched; the
  damage and skill arms sit ahead of the verbatim tables in `src/characters/weapons.js` as named departures.
- **The numbers.** Damage 7-26 (`THUNDERLOCK_DAMAGE`), weight 6.0 (the heaviest weapon), base price 480 on the
  material ladder. The Pellet weighs 0.2, costs 4 and stacks.
- **Skill.** `weaponSkillUsed` names Archery, so every host's ranged gate takes the gun: the loose, the fatigue, the
  Archery and Critical Strike tally, the projectile.
- **A trigger, not a draw.** The swing machine keeps the gun on the melee one-shot (`isBow` false) and takes only the
  ranged half of the bow's laws (`machine.ranged`), with seven frames (`THUNDERLOCK_NUM_FRAMES`,
  `src/characters/weaponStates.js`), 14 frames a second. A shot is followed by the reload: 1.7 s at Speed 50, 0.4%
  shorter a point of Speed above it, never under 1 s (`thunderlockReloadSeconds`, `src/combat/gun/gunFeel.js`).
- **Ammunition** is asked of the weapon (`spendAmmoFor`, `ammoCountFor`, `ammoTemplateFor`): the gun spends a Pellet;
  everything else spends an Arrow.
- **The shot** is an orb, Daggerfall's own spell-missile billboard, not an arrow (`orbArchiveFor`, read by
  `src/combat/arrowFlight.js`), and leaves no shaft to pull out. The muzzle lights the room on the flash
  (`thunderlockMuzzleLight`).
- **First-person art** (`src/combat/thunderlockArt.js`): the owner's seven-frame strip
  (`public/art/thunderlock-frames.png`), cut at a fixed stride and drawn at the owner's placement (`THUNDERLOCK_ART`:
  44% of the screen's width, offset 0.085, raised -11, seated so the shot's kick never shows the cut). An enchanted gun
  shimmers blue-violet on the brass and the bright parts (`thunderlockShimmer`); a Gilded gun's brass is gilded
  (`thunderlockGildKeep`). A gun whose blow carries an element draws the plain frames under the element's outline.
- **The paperdoll and icon** are the port's own pictures (`installThunderlockIcons`, `PAPERDOLL_OFFSET`).
- **Morrowind.** With Morrowind's data, the gun is a baked NIF held by its grip (`GUN_GRIP_ATTITUDE`,
  `src/characters/ownModels/ownWeaponModels.js`), and the arms hold it as a long gun: a low ready at rest, the aim in
  combat (`src/combat/gun/rifleStance.js`).
- **Lore** (`GUN_LORE`, shown as its own box in the item's Info): Rourken work; a tonal coil sings one note that
  unbinds the aetherium in a Pellet as lightning; the coil must be wound again (the reload). Two port books,
  *Rourken Thunder* (418) and *The Ketch That Never Lands* (419), tell it (`src/systems/portBooks.js`).
- **Pellets found** (`PELLET_FIND_WEIGHTS`, `rollFinalFinds` in `src/systems/loot/lootRarity.js`): a final find, the
  loot door's last draw, from source tier 1 at a few lists in a hundred at most, 4 to 12 a find
  (`PELLET_FIND_STACK`). It rolls even with the loot ladder off. The Sky-Ketch's hold also pays Pellets.

## Rules

- Called the Dwarven Thunderlock; ammo the Dwemer Pellet; works with Archery (Mac).
- Never for sale: a shop's shelf is built from DFU's group table, which holds no custom template.
- Neither gun drops any more; a held gun is the player's and stays lawful. Its old find stays registered and takes its
  one draw, but mints nothing, so every seeded list draws what it drew (the owner).
- No shop sells Pellets; they are a rare find (the owner). A smith still buys them back.
- The Last Lock, the guns' exclusive Legendary, stays registered so held pieces keep it.
- Held as a rifle on the Morrowind body, idle and ready stances (Mac).
- A left-handed player's gun is drawn mirrored.

## Daggerfall Unity

DFU has no firearm. Everything here is the port's own departure, reached through doors DFU already has: custom
templates, the skill table, the ranged machine, the ammunition question and the spell-missile billboard.

## Code and tests

- `src/characters/thunderlockIds.js`, `src/systems/thunderlock.js` - ids, templates, numbers, finds, lore, sounds
- `src/combat/thunderlockArt.js`, `src/combat/gun/` - art, feel, flash, stance
- `test/systems/thunderlock.test.js`, `thunderlockart.test.js`, `thunderlockart2.test.js` - the weapon, its art
- `test/systems/pelletsscarce.test.js`, `test/systems/gunlore.test.js` - Pellets, lore
- `test/combat/riflestance.test.js`, `test/combat/mwgunfeel.test.js` - the Morrowind hold and feel

## Open

- The paperdoll layer is still the old art; its placement is the owner's to make.

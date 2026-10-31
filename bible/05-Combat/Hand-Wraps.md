# Hand Wraps

A weapon for the fists. Hand Wraps are worn in either hand; the player then fights bare-handed (the fists' art and
swing, Hand-to-Hand, both fists up), and the wraps add what they carry: a DFU enchantment and the loot ladder's lines.
They glow with the Aura Armory's weapon piece or a staff-set glow. Weaponsmiths sell them and the random weapon roll
finds them.

## How it works

- **The item** (`HAND_WRAPS_TEMPLATES`, `src/systems/handWraps.js`; the index in the leaf
  `src/characters/handWrapsIds.js`, `HAND_WRAPS_TEMPLATE` 563). Cloth: every mint is material 0 and the name says no
  metal. Rarity 3. The list shows the Mummy Wrappings' cloth strip from the player's ARENA2; the card has no Damage
  row.
- **The blow** (`calculateAttackDamage`, `src/combat/formulas.js`; `src/combat/pcaao.js`). The wraps are taken out of
  the blow at its first line, so the hit, skill and damage are the fists' as DFU rolls them. The wraps ride beside it
  as `wraps`: their weapon modifiers over the fists' roll (`weaponDamageMods`), their loot lines at the blow and strike
  (`lootBlow`, `lootStrike`), their own powers and sigil, and their Strikes payload on a hit. A fist's blow wears
  nothing; an enchantment's use wears the wraps, so a pair can break.
- **The hands.** `weaponTypeForItem` answers Melee (the fists' sheet), `weaponSkillUsed` Hand-to-Hand, `getItemHands`
  Either; `handsModeOf` reads a wrapped hand as a fist. `handItem` answers null for the wraps and `wrapsOf(hand)`
  names them (`fistWrapsOf`: a hand's own pair, or the other hand's when this one is empty), so both fists wear one
  pair. Every reader of the weapon (duels, the siege, boss traits, foe tells, sounds) sees a fist.
- **The glow.** Only the Aura Armory's weapon piece or a staff `/glow` lights them (`Weapon-Glow.md`). On the classic
  hands it shows in every frame, the running hands too. On the Morrowind arm the wraps key as the empty hand
  (`fpWeaponKey`); the arm lays the glow on its hand ranges (`setHandGlow`, `handGlow`; the renderer's `hands` slot)
  while the fists are up, and the third-person body keeps it when they are put away. A peer's body reads it from the
  look (`peerWrapsGlow`).
- **The beast keeps its wraps.** Turning into a werebeast takes a weapon off but leaves Hand Wraps on
  (`src/systems/lycanthropy.js`); the claws strike in them, their damage lines and gems riding the claws' roll. The
  loot ladder's blow powers stay off the claws.

## Rules

- Hand-to-hand fighters get the enchanted outlines others get, through a new weapon type that carries lines only: the
  fists' own damage (the owner).
- The beast keeps its wraps, may loot and use potions, but cannot open the inventory (the owner). With quick loot on a
  press takes one row and P takes all; with it off a press takes all. Only a potion on the hotbar may be used.
- A line's numbers are the ladder's own bands; nothing passes the power ceiling.
- The item law knows template 563 (`CUSTOM_TEMPLATE_GROUPS`, `src/systems/item/itemLaw.js`).

## Daggerfall Unity

DFU's fists hold no item and `FormulaHelper.CalculateHandToHandAttackDamage` reads none. The wraps are a custom
template that fights as the empty hand; reading their enchantment and lines on a fist's blow is a departure. Keeping
the wraps through `MorphSelf`, which empties both hands, is another.

## Code and tests

- `src/systems/handWraps.js`, `src/characters/handWrapsIds.js` - the item
- `src/combat/formulas.js`, `src/combat/pcaao.js` - the blow
- `src/combat/playerWeapon.js`, `src/combat/weapon/weaponRig.js`, `src/combat/fpArm.js` - the hands and the glow
- `test/combat/handwraps.test.js`, `test/combat/handwraps_arm.test.js`, `test/combat/handwraps_audit.test.js` - the
  item, the blow in both cores, the arm, the readers

## Open

- The doll draws no layer, so wraps are taken off from the list.
- No foe's equipment table carries wraps.
- Wraps carry no poison (no weapon is poisoned in this port).

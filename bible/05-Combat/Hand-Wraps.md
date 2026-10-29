# Hand Wraps - a weapon for the fists (HAND-WRAPS)

*2026-10-29. The owner, with a #feature-feedback thread: "can you allow players using hand combat to recieve the
outlines others recieve when a weapon is enchanted? Maybe a new weapon type like hand wraps?" Asked what they should do
in a fight, the owner chose "Carry lines only": the fists' own damage, and the wraps carry what a weapon carries.*

## What it is

**Hand Wraps** (template 563, `src/systems/handWraps.js`; the index and its test in the leaf
`src/characters/handWrapsIds.js`) are a weapon worn in either hand. With them on, the player fights with the bare hands:
the fists' art and swing, the Hand-to-Hand skill, both fists up. The blow is the fists' blow. What the wraps add is what
they carry: a DFU enchantment (the item maker's, a Magic piece's) and the loot ladder's lines. So the fists glow as a
weapon does (`05-Combat/Weapon-Glow.md`): an element's outline for an `elemental` line, the arcane look for an
enchantment.

They are cloth. Every mint is material 0, whatever a shelf or the random weapon roll asked, and the name says no metal.
A weaponsmith shelves them and the random weapon roll finds them (`registerCustomItemGroup`), at rarity 3. The list shows
the Mummy Wrappings' strip of cloth (TEXTURE.254 #41, the player's own ARENA2); the doll draws no layer for them. The card
has no Damage row: the damage is the fists'.

## The blow (`combat/formulas.js`, `combat/pcaao.js`)

`calculateAttackDamage` takes the wraps out of the blow at its first line: either core, the report and the listeners see
no weapon, so the hit, the skill, the proficiency and the damage are the fists' as DFU rolls them, with no weapon damage
and no metal. The wraps ride beside the blow as `wraps`:

- **Their weapon modifiers over the fists' roll** (`weaponDamageMods` - the ladder's `damage` line, an heirloom's), as a
  weapon's modifiers go over its own roll, in both cores' Hand-to-Hand arm.
- **Their lines at the blow** (`lootPowers.js` `lootBlow`: slayer, elemental) and at the strike (`lootStrike`: leech),
  through the blow modifiers' and the strike listeners' `info.wraps`. The fists' own powers still see a weaponless blow.
- **Their Strikes payload** (Cast When Strikes, Potent Vs and the rest) on a fist's hit.

A fist's blow wears nothing, as DFU's does, so the wraps never lose condition. A line's numbers are the ladder's own
bands (`AFFIX_RANGES`), the same as on any weapon: nothing here is past the POWER-CEILING.

## The hands

- `combat/fpsWeapon.js` `weaponTypeForItem`: Melee, the fists' sheet. Melee has no WEAPO1xx sheet, so the classic hand
  takes law 5's arcane outline for enchanted wraps (`systems/weaponGlow.js` `spriteGlow`).
- `characters/weapons.js` `weaponSkillUsed`: Hand-to-Hand. `characters/equipTable.js` `getItemHands`: Either.
- `combat/twoHands/handsLaw.js` `handsModeOf`: a hand in wraps is a fist, so both fists are up. `combat/playerWeapon.js`
  `handItem`: with both fists up, an empty hand beside the wraps strikes with them, so both fists wear them and glow.
- The Stats page (`combat/combatStats.js`) reads them as the fists, their modifiers over the roll.

## The glow on the Morrowind hands

The wraps key as the empty hand (`combat/fpArm.js` `fpWeaponKey`), so nothing is held. The arm takes the wraps' glow
through `setHandGlow` and lays it on its meshes as `handGlow` while the fists are up: drawn, no spell readied, not
climbing. The renderer draws it as a weapon's glow over the hands' ranges (`render/renderer.js` `inGlowSlot` 'hands': the
skin's `hand` row and a worn glove's hand parts). The rig tells the arm each frame (`combat/weapon/weaponRig.js`), and a
peer's body reads it off their look's `glow` word, which a weapon in a hand already carries (`net/peer/peerBodies.js`).

## Departures, named

- **A weapon Daggerfall does not have.** DFU's fists hold no item. The wraps are a custom template that fights as the
  empty hand (ItemHelper.ConvertItemToAPIWeaponType's Melee, GetWeaponSkillUsed's Hand-to-Hand). Ledger A, HAND-WRAPS.
- **A fist's blow carries an item's enchantment and lines.** DFU's Hand-to-Hand arm
  (FormulaHelper.CalculateHandToHandAttackDamage) reads no item; the port reads the wraps' modifiers over its roll, and
  the Strikes payload at the tail runs for them.

## Not done

- **A doll layer.** The doll draws none, so the wraps are taken off from the list, not the doll.
- **A foe in wraps.** No enemy's equipment table carries them.
- **Poison.** A player poisons no weapon in this port; the wraps carry none.

## The account service

The item law knows template 563 (`systems/item/itemLaw.js` `CUSTOM_TEMPLATE_GROUPS`). ITEM_LAW_VERSION stays 14: no pair
existed for an older law to find against. The service that judges it is acct220: deploy the account service before the
site, or an honest pair reads as a forgery.

## THE FOUR HOSTS RULE

No host changed. Every host builds its rig through `createWeaponRig` - `scenes/exterior.js`, `scenes/world.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` - so the fists glow, swing and strike the same in all four. A
peer's body glows wherever `peerBodies.js` draws it.

## Verification

`test/combat/handwraps.test.js` (7): the row and its mints, the fists, the blow in both cores, the Stats page, the
classic glow, the Morrowind arm on the fixture rig, the renderer's ranges, and a peer's body. Its mutants:
`tools/mutants/handwraps.json`, 31, all dead. Not run in a browser here: the glow's drawing is WEAPON-GLOW1's, pinned by
its own probe (`tools/weaponGlowProbe.mjs`).

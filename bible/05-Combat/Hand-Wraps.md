# Hand Wraps - a weapon for the fists (HAND-WRAPS)

*2026-10-29. The owner, with a #feature-feedback thread: "can you allow players using hand combat to recieve the
outlines others recieve when a weapon is enchanted? Maybe a new weapon type like hand wraps?" Asked what they should do
in a fight, the owner chose "Carry lines only": the fists' own damage, and the wraps carry what a weapon carries.*

## What it is

**Hand Wraps** (template 563, `src/systems/handWraps.js`; the index and its test in the leaf
`src/characters/handWrapsIds.js`) are a weapon worn in either hand. With them on, the player fights with the bare hands:
the fists' art and swing, the Hand-to-Hand skill, both fists up. The blow is the fists' blow. What the wraps add is what
they carry: a DFU enchantment (the item maker's, a Magic piece's) and the loot ladder's lines. The fists glow by the
Aura Armory weapon piece alone, or a staff `/glow` (WRAPS-AURA, 2026-10-30, mob: "wraps are glowing without the aura
on"; `05-Combat/Weapon-Glow.md` law 10): an element or an enchantment lights them no more.

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
  through the blow modifiers' and the strike listeners' `info.wraps`.
- **Their own powers and sigil** (a Rare's imprint, Earthshaker on a fist; `sigil.js` `sigilBlow`), as a weapon's ride
  its blow. The fists' own powers (Open Hand) still see a weaponless blow.
- **Their Strikes payload** (Cast When Strikes, Potent Vs and the rest) on a fist's hit.

A fist's blow wears nothing, as DFU's does. An enchantment's use wears the wraps as it wears a weapon (Cast When
Strikes' `durabilityLoss`), so a pair can break and is repaired. A line's numbers are the ladder's own bands
(`AFFIX_RANGES`), the same as on any weapon: nothing here is past the POWER-CEILING.

## The hands

- `combat/fpsWeapon.js` `weaponTypeForItem`: Melee, the fists' sheet. Melee has no WEAPO1xx sheet, so an
  enchantment shows nothing on the classic fists.
- `characters/weapons.js` `weaponSkillUsed`: Hand-to-Hand. `characters/equipTable.js` `getItemHands`: Either.
- `combat/twoHands/handsLaw.js` `handsModeOf`: a hand in wraps is a fist, so both fists are up.
- `combat/playerWeapon.js` `handItem` answers null for the wraps, so `weapon` and `strikingWeapon` are the bare hand's.
  `wrapsOf(hand)` names them (`characters/handWrapsIds.js` `fistWrapsOf`): a hand's own pair, or with the hand empty
  the other hand's. So both fists wear one pair and glow.
- Every reader of the weapon sees a fist: a duel's and the siege's blow (`duelWeaponOf`), a boss's Stoneskin and
  Bladeturning (`bossTraits.js`), a foe's read of the blow (`ai/tells.js`), the swing's and the hit's sound.
- The Stats page (`combat/combatStats.js`) reads them as the fists, their modifiers over the roll and their lines in its
  estimate; an empty fist beside them wears them there too.

## The glow on the Morrowind hands

The wraps key as the empty hand (`combat/fpArm.js` `fpWeaponKey`), so nothing is held. The arm takes the wraps' glow
through `setHandGlow` and lays it on its first- and third-person meshes as `handGlow` while the fists are up: drawn, no
spell readied, not climbing, no sheet held up, and the empty hand's key worn (a swap from a blade has landed). Put
away, the third-person body keeps the glow (WRAPS-AWAY, 2026-10-30, mob: "keep glow on wrap whern put away"). Drawn
fists put the torch away (`carriedLeftVisible`), so the glow never lights one. The renderer draws it as a weapon's glow
over the hands' shown ranges (`render/renderer.js` `inGlowSlot` 'hands': the skin's `hand` row and a glove's `right
hand (...)` and `left hand (...)` parts). A glove is one mesh to the elbow, so its cuff glows too.

The arm has one glow for both fists: the rig gives it the first pair that
glows, right hand first (`combat/weapon/weaponRig.js` `wrapsMeshGlow`). A peer's body reads it off their look's `glow`
word the same way, from either hand (`net/peer/peerBodies.js` `peerWrapsGlow`). The classic hands glow in every frame
they draw, the running hands too.

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

The item law knows template 563 (`systems/item/itemLaw.js` `CUSTOM_TEMPLATE_GROUPS`, which imports the row, so a
headless judge knows it too). ITEM_LAW_VERSION stays 15 (DRAGON5's): no pair existed for an older law to find against. The
service that judges it is acct224: deploy the account service before the site, or an honest pair reads as a forgery. A loot
room's hello says law 2 (`net/wire.js` `LOOT_HELLO_LAW`, world289): while `lootDoor` is on, the relay refuses an older
build, which would drop a pair from a shared container. Deploy the relay first, then the account service, then the site.

## THE FOUR HOSTS RULE

No host changed. Every host builds its rig through `createWeaponRig` - `scenes/exterior.js`, `scenes/world.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` - so the fists glow, swing and strike the same in all four. A
peer's body glows wherever `peerBodies.js` draws it.

## Verification

`test/combat/handwraps.test.js` (7): the row and its mints, the fists, the blow in both cores, the Stats page, the
classic glow, the Morrowind keys and ranges, and a peer's body. `test/combat/handwraps_arm.test.js` (4): the arm's two
meshes on the retail skeleton, bare and in steel gauntlets, its gates, and the renderer's pass on a logging GL.
`test/combat/handwraps_audit.test.js` (7): the readers that see a fist, the Stats page's hand, PCAAO's modifiers, the
wraps' leech, power and sigil, the item law loaded alone, the running hands, and the Strikes payload. Its mutants:
`tools/mutants/handwraps.json`, 55, all dead. The audit's record: `01-Overview/audits/Audit-Westhead-Hand-Wraps.md`. Not run in a browser here: the glow's drawing is WEAPON-GLOW1's, pinned by
its own probe (`tools/weaponGlowProbe.mjs`).

## WERE-WRAPS, WERE-LOOT, WERE-POTIONS: the beast keeps its wraps

2026-10-30, the owner: "let them keep the wraps and let them loot and use potions just dont let them open inventory",
"keep wraps and make them useful". A DEPARTURE from DFU's MorphSelf, which empties both hands: the change takes a weapon
off and leaves a pair of Hand Wraps on (`lycanthropy.js:"if (!isHandWraps(equipTableOf(entity)[slot])) unequipSlot"`).
The claws strike in them (`playerWeapon.js:"get wraps() {"`): their damage
lines and gems ride the claws' roll as a fist's, their skill lines and enchantments count while worn, and between players
their lines are the claws' (PvP-Rework PVP-GEAR). The loot ladder's blow powers stay off the claws (BAL10).

The pack window stays shut. With quick loot on, a press on a pile or a body takes one row - the one the plaque has lit,
else its first - and P takes the lot (WERE-PICK, `bugs/Field-Bugs-2026-10-30g.md`). With quick loot off a press takes
the lot (`quickLoot.js:"if (how === 'all' || (beast && !quickLootOn())) {"`). A picked item comes into the pack. A
potion on the hotbar is drunk; any other pack item stays refused (`quickslots.js:"if (sup && !isPotion(r?.item))"`).

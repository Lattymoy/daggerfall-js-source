# THE GILDED RUNG, AND THE HOURLOCK (GILDED1, 2026-10-07)

Mac: "I want to add a new weapon of a new rarity. The thunderlock of rarity above atheric. The most rare and gilded item
in the entire game with a static role. Ensure its powerful but not overpowered." Asked alongside: "This also means
overhauling the thunderlock in general including the morrowinds gun model and proper animations and allowing the
purchase of the ammunition in stores. The thunderlock/ammo also doesnt recieve proper artwork in slots like the hotbar or
inventory" - THUNDERLOCK-ART and SHOP-PELLETS, `05-Combat/Dwarven-Thunderlock.md`.

The port's own, whole: Daggerfall has no rarity ladder (`06-Systems/Loot-Rarity.md` is the port's), no Thunderlock
(`05-Combat/Dwarven-Thunderlock.md`) and no Shattered Hour (`11-Multiplayer/Super-Dungeons.md`). Nothing here departs
from a DFU law, because no DFU law reaches it; its Port-Ledger row (section A) names its files.

## 1. The rung

`systems/loot/lootRarity.js` RARITIES gains a seventh rung, **Gilded** - rank 6, over the Artifact's 5 - in gold leaf
(`#ffcf4d`), its tint `[1.00, 0.80, 0.26, 0.60]`; since GILDED-RED (section 8) in crimson, `#ff3b4a`, its tint
`[1.00, 0.23, 0.29, 0.60]`, its pieces' own art still gold leaf. "The most rare ... in the entire game" puts it over the Artifact too:
an artifact is a Daedric Prince's gift for a quest done, there for anyone who asks the right Prince; a Gilded piece is
one roll in fifty off the hardest fight the port has.

NOTHING ROLLS IT, as nothing rolls the Aetheric: `ROLLED_TIERS` (systems/rarityTier.js) is still Magic, Rare and
Legendary, `applyRarity` answers a piece untouched when asked for any other tier, and `rarityEligible` - the question
every door asks before it rolls - answers false for a piece that already wears one. `stampedTier` counts it (a tier
minted whole, as the Aetheric's is), so the doors that read "is this piece's tier its own" read it so.

Every reader of the ladder carries it - each found by grepping the Aetheric's own word and walking every hit:

| Reader | What it does with the rung |
|---|---|
| `ui/enhanced/enhancedPlusStyle.js` RARITY_VARS | the rung's colour, its light and its shade; a gold crown for pips (`GILDED_CROWN_SVG`) - gold and two stars (`\2726\2726`) until GILDED-RED, section 8 |
| `ui/enhanced/enhancedPlusStyle.js` `gilded-glow` | the frame of a Gilded row, slot, hotbar cell and quick-diamond cell breathes in the rung's colour - stepped (8 steps over 2.6 s); under reduced motion, a still glow at its brighter end |
| `ui/enhanced/enhancedStyle.js` | the name in the rung's colour in a list, a card, a plaque |
| `render/spoilsGlow.js` SPOILS_LINE_H | 2.5 m - the tallest line, at the line's own cap (WB5's "a line, not a beam") |
| `systems/physicalItems.js` PI_RIM | 0.8 - the strongest rim |
| `systems/reforge.js` salvageRefusal | `'gilded'` - "A Gilded piece will not break" (ui/reforgeWindow.js) |
| `systems/enchanting.js` itemMakerRefuses | true - the item maker takes no static roll |
| `systems/legacy/heirloom.js` NEVER_RARITY | never an heirloom - it is its record's |
| `systems/item/itemInfo.js` | named as an artifact is - "The Hourlock", never "Dwarven The Hourlock" |
| `systems/quickslots.js` quickslotKey | `|g<record>` - only when set, so every save's keys still resolve |
| `systems/item/itemFields.js` | `gilded: str()` - the record's id, a declared field |
| `systems/loot/loot.js` validLootItem | `validGildedMarks` - below |
| `systems/loot/lootCodex.js` | its own kind - section 5 |

## 2. The Hourlock

(GUNS-UNFOUND, 2026-10-23: a Dwarven Long Bow now, the record otherwise as below; a Thunderlock minted before is its gun
era - section 9. This section is GILDED1's record of the gun.)

`systems/gilded.js` - the rung's one record, and it is a Thunderlock: what the Warp kept of a Dwemer smith's last
commission, gilded in the Hour that never ended.

| | |
|---|---|
| Template, make | 560 (the Thunderlock, `systems/thunderlock.js`), Dwarven - the gun's own brass |
| Lines | +40% damage, +15 Agility, +30 Archery, +10 shock a shot - each the Legendary band's TOP (AFFIX_RANGES), none past it |
| Power | THE HOUR TOLLS - every third of its shots that LANDS strikes for double; a foe it fells gives back the pellet that felled it |
| Price | its make + its lines' worth + GILDED_WORTH (12,500 - the Aetheric's 2,500 five times over): 39,740 |
| Lore | "Struck in the Hour that never ended, from the brass of a god that walked. Its gilding has never dulled." |

**A STATIC ROLL.** Every number is its record's, minted whole and KNOWN, never rolled. The record is frozen; a mint is
a fresh item whose lines are copies (`mintGilded`). So the wire can hold it to its record EXACTLY, as no rolled tier
can be held (`validGildedMarks`, beside the Aetheric's `validSetMarks` in `validLootItem`): a record that exists, its
group, template and make, its lines in its record's order with its record's params and values - one number off is a
forgery, there is no band to sit inside - and none of the marks another door lays (`sigil`, `legendary`, `aetheric`,
`imprint`, `cursed`, `socket`, `reforged`, `honed`, `exalted`), no DFU enchantment and no made one. A bare `rarity:
'gilded'` naming no record is refused (RF5's word for the Aetheric, now the Gilded's too).

No door alters it: the Reforge's lines and the hone's are a Magic's, a Rare's or an Exalted's (`reforgeableLines`,
`honeableLines` answer none); `exaltLegendary` is a Legendary's; `cursePiece` a Rare's or a Legendary's; the socket's
per-mille has no row for it; the imprint is a Rare's; the salvage, the item maker and the heirloom refuse it by name;
and the crafter's temper (CRAFT4, `net/temperLaw.js` TEMPER_SHUT - law 7, which main's arc wrote for the Legendary,
the Aetheric and the Artifact while this one was being built) shuts the rung too, at the merge that brought it.

### The power, as it runs

`systems/loot/lootPowers.js`, kind `'toll'` - one more arm at the seams every Legendary power already uses:

- **The blow** (`lootBlow`): `tollDue` - this weapon's landed-shot count is `every - 1` - adds `pct` (100) to the blow's
  percentage, which `shareOf` lays over the WHOLE blow (the material, the strength, the slayer's - formulas.js
  `weaponBlowMods`, after them).
- **The strike** (`lootStrike`, a blow that LANDED): the count turns (`% every`), and the last landed shot is kept -
  `{ foe, at }`. A shot asked and never landed counts nothing; the count is the weapon's own (a WeakMap keyed by the
  item), so another weapon's blows neither toll nor move it, and a reload starts every gun at nought.
- **The kill** (`lootKill`): a foe whose fall comes within TOLL_REFUND_S (1 s) of the Hourlock's last landed shot ON IT
  gives one pellet back (`createPellets(1)` into the pack), once - the record is spent. A foe it never struck, a fall
  past the bound, or a foe it struck before the gun's last shot went elsewhere gives nothing.

Like every power: MY entity's worn pieces only, a weapon's power on that weapon's blows, asleep in a duel, nothing with
the switch off. Its brief fits the card's row (BRIEF_MAX 32): "Every 3rd hit x2; kills refund".

## 3. The numbers - powerful, not overpowered

Measured with the port's own laws (`characters/weapons.js` spans, `combat/formulas.js` order and WEAPON_MATERIAL_MODIFIER,
`combat/gun/gunFeel.js` cadence), at each span's mean, Strength 50, Speed 50, before the hit roll, a critical and armour:

| Weapon | A landed blow | A cycle | A second |
|---|---|---|---|
| Dwarven Thunderlock | 16.5 + 2 = 18.5 | 6 frames at 14 fps + 1.7 s reload = 2.13 s | 8.7 |
| The Last Lock (Legendary) | 16.5 x 1.2 + 2 = 21.8 (32.7 at a daedra), and its struck spell | 2.13 s | 10.2 (15.4) |
| **The Hourlock** | 16.5 x 1.4 + 2 = 25.1; the toll x4/3; +10 shock = **43.5** | 2.13 s | **20.4** |
| A Legendary Daedric Dai-Katana at the band's top | 12 x 1.4 + 6 = 22.8, and its power | about 1 s | about 22.8 |

So the Hourlock lands about twice what The Last Lock does a shot, and a second it sits just under the best of the
melee's - ahead only where the gun always is: at range. The price stays the gun's: the slowest cycle in the game, a
pellet a shot (the refund pays back a kill, never a miss), the heaviest weapon at 6 kg. In a duel its power sleeps
and it is a plain Thunderlock with Legendary lines. Its +15 Agility and +30 Archery are the hand that holds it - a
Legendary bow's ceiling, no more.

## 4. The drop

The Brass Remnant's spoils (`systems/superDungeon/sdSpoils.js`, `11-Multiplayer/Super-Dungeons.md` section 11) roll ONE MORE THING
after everything they rolled before - the gold, the first piece, the two Rare-or-better, the ladder's last pass, the
Brass of Numidium - so every earlier spoils is exactly what it was for its seed: `rollHourlock` draws once, always, and
answers the Hourlock under GILDED_CHANCE (1 in 50). Online alone, because the Hour is. sd9e_spoils.test.js's oracle and
its mutant (the Hourlock before the Brass) hold the order.

## 5. The look

- **The card** (`rarityLines`): "Gilded", its four lines (no band - a static roll has none to show), "The Hour Tolls:
  Every 3rd hit x2; kills refund", its lore. Its name in the rung's colour (crimson, section 8), its frame breathing.
- **The codex** (`systems/loot/lootCodex.js`): a kind of its own, `gilded`. The first find is said and heard as a
  Legendary's is - "The Hourlock - a Gilded piece! It joins your codex." - and the Codex page lists the rung at its
  HEAD, over the Legendaries, as it stands over them (`codexGilded`; unfound, "Said to lie in the brass of the Hour,
  once in a long while"). The save carries `gilded: { id: day }`; a save from before it reads as none found.
- **In a list and on the doll** (THUNDERLOCK-ART, `systems/thunderlock.js` ART_RECORDS): a list draws the whole gun
  (archive 560 record 1; the Hourlock's gold one, record 3) and the doll its own layer (record 0; the gold, record 2) -
  `tools/gunIcons.mjs` derives every one from the committed art, the gold off the same gold-leaf ramp the sprite takes.
- **In the classic hand** (`combat/thunderlockArt.js`): the same six frames, gilded - but only the gun. The glove's
  browns lean pink and the brass's yellow, which no hue threshold parts (the idle frame's glove at 18-35 degrees, the
  gun at 30-38) but a neighbourhood's chromaticity does: `handMask` reads each pixel's yellow lean `(g - b) - 0.9 (r - g)`
  of its share, box-blurred twice (GILD.blur 10) and weighed by what is drawn; what reads as glove AND is joined to the
  frame's foot in its left 45% (where the fist enters) is the hand. Found once on the idle frame - the sheet's cells
  share one union box, so the fist stands in the same pixels throughout - and spared in every frame; only the idle
  frame's own silhouette is gilded, so the flash and the smoke stay theirs. `gildFrame` pulls each kept pixel toward
  GILD_RAMP by its lightness, alpha never written. The rig keys the art `:gilded` (`combat/weapon/weaponRig.js`), so a gold
  gun and a plain one never share frames.
- **In the Morrowind hand** (`characters/ownModels/ownWeaponModels.js` OWN_MW_GILDED): its own twin, `thunderlock_gilded.nif`
  over `thunderlock_gilded.dds` - the same capped mesh, the same bone, animation and speed, its texture baked off the
  same occlusion in gold leaf (`tools/meshTexture.mjs` GILDED_BANDS, `tools/bakeThunderlock.mjs`). The preload asks the
  table for both rows (FIELD-GUN-MW2's law).

## 6. The test room, and the pins

The loot test character (`systems/testRoom.js` `seedTestLoot`, "test:loot") carries the Hourlock, minted whole as the
Brass Remnant drops it, and thirty pellets to hear it toll - after every draw the room made before (LR1's count moved
with it).


`test/systems/gilded1_gilded.test.js` - the rung, the record, the mint, a static roll, no door alters it, the drop, the power
(the toll and the pellet back), the look, the art and the gold in the hand (a sketch of the idle frame: a glove at the
foot, the brass above, a glove-hued crevice that touches nothing). Its mutants, `tools/mutants/gilded1.json`: 24, all
dead. The ladder's own enumerations moved with it, each saying so: LR1, SET6, PI1, WB5, RF5, LOOT9 (the salvage's
refusals), LOOT10/AUDIT LOOT (the codex count), DW1 and AUDIT-DW F4 (the rig's key), FIELD-GUN-MW2 (the preload's two
rows and the bake's two twins), SD9e (the spoils' order and the Hourlock's rate).

## 7. The world's two - the Dragonfire Oath and the Sunken Sovereign (GILDED2, 2026-10-15)

**PISTOLET (2026-10-21, the owner: "replace the serpent boss gilded weapon with this new weapon").** The Sunken Sovereign
is an Ebony **Dwarven Pistolet** now (`systems/gilded.js`, template 562 - `05-Combat/Dwarven-Pistolet.md`), its skill line
Archery's where it was Long Blade's; its id, make, damage, Agility and leech lines, its power Undertow (which charges on a
shot that lands as on a swing - `systems/loot/lootPowers.js`) and its drop are unchanged. Its gold is the Pistolet's own
pictures through tools/gunIcons.mjs's ramp (`tools/pistoletArt.mjs`) and, in first person, the pistol's pixels and never
the hand's, nor its muzzle flame (`combat/gun/pistoletArt.js` pistoletGildKeep and flashMask - AUDIT PISTOLET B3: the
first cut gilded the flash). The tables below are GILDED2's, measured on the saber. (GUNS-UNFOUND, 2026-10-23, the owner:
"revert the gilded weapon from the serpent": the Ebony Saber again, the Pistolet minted between its era - section 9.)

**The saber era (AUDIT PISTOLET A7/C1/D8).** A Sovereign minted before PISTOLET is an Ebony Saber with a Long Blade line,
and every save keeps what it holds. Against the re-pointed record it read as a forgery: the item law's Gilded marks
compared its template to the Pistolet's, so the realm judge held its owner's trade at every checkpoint, the market
refused it and the siege arms dropped it. The record now carries its era (`SOVEREIGN_SABER_ERA` in `systems/gilded.js`:
the Saber, Long Blade, the saber's lore), and `gildedRecordOf(item)` answers the era's shape for a saber minted under the
Sovereign's id - the item law (`validGildedMarks`) and the lore read through it. Nothing new mints a saber. The item law
moved to 10 (`ITEM_LAW_VERSION`) and the account service to acct170 with it (acct168 on its branch, renumbered at the merge): deploy the account service.

Mac: "With the introduction of elite dungeons soon. I want to enhance the rewards for each world activety. We need to add
a rare gilded weapon to the oblivion gates. A gilded weapon to the serpent + a rare chance of a title/aura drop." The
title and the aura are the serpent's own slice (`11-Multiplayer/Sea-Serpent.md` section 17, SERPENT5); this section is
the two weapons. The rung was one record (sections 1 to 6, which say so as they were written); it is three now -
`GILDED_RECORDS` is the Hourlock, then the gate's, then the serpent's, and every reader of the rung already walked the
list (the codex, the wire's `validGildedMarks`, the item law, the card). AUDIT WORLD-REWARDS (`01-Overview/Audit-World-
Rewards.md`) read the slice cold and moved what this section says where it was wrong; each such place is marked.

| | The Dragonfire Oath (the gate's) | The Sunken Sovereign (the serpent's) |
|---|---|---|
| Weapon, make | Dai-Katana (123), Daedric - two hands, Long Blade | Saber (119), Ebony - either hand, Long Blade, a shield beside it. **A Dwarven Pistolet (562), Ebony, Archery since PISTOLET** (above) |
| Lines | +40% damage, +15 Strength, +30 Long Blade, +15 Endurance (AUDIT B1: no longer a slayer of the Daedra) | +40% damage, +15 Agility, +30 Long Blade, 10% leech |
| Power | DRAGONFIRE - a landed blow on a Daedra burns it again for a third of the blow, and every OTHER Daedra within 3 m for as much; no Daedra resists it | UNDERTOW - each landed blow on a foe adds +10% to its next blows on that foe, up to +50%, for 6 s from the last; a foe it fells heals 10% of your health |
| Brief (the card's 32) | "Daedra burn +33%, and all in 3m" | "+10%/hit on a foe; kills heal" |
| Drop | the gate Warden's spoils, 1 in 100 (`GATE_GILDED_CHANCE`) | a dealing ship's serpent hoard, 1 in 100 (`SERPENT_GILDED_CHANCE`); a ship that stood, never |
| Price | 93,750 | 21,608 |
| Lore | "A Dragonguard carried it through the first gate and never carried it back. The Deadlands blackened its steel; the Dragonfire in its gilding never went out." | "A Sentinel admiral's saber, swallowed with her flagship off Stros M'kai. The Old Coil gave back only the blade, and the sea never touched its gilding." |
| The codex's hint | "Said to fall from the Warden of the Burning Gate, once in a long while" | "Said to lie in the Old Coil's belly, once in a long while" |

**The mint** (`systems/gilded.js` `mintGilded`). A DFU weapon's own - `combat/enemyEquipment.js` `createWeapon`
(ItemBuilder.CreateWeapon: its make's value, its span, its condition; no draw - its arrow arm alone rolls) - where the
Hourlock keeps the gun's (`createThunderlock`), so its record and every gift already minted of it (the HOURS-FIRST post,
migration 0094) are byte for byte what they were. Each a STATIC ROLL, as the Hourlock is: every line its record's, held
exactly on the wire, no door alters it (section 2's list - the Reforge, the hone, the salvage, the item maker, the
exalt, the curse, the heirloom, the temper, a socket, a technique; the audit walked every one of them with the real
pieces). The item law moved with them: ITEM_LAW_VERSION 5, the account service's acct137 (TECH1's LAW_SERVICE), so a
finding a law of 4 made against one - a piece found on a site that shipped ahead of its judge - is asked again.

**Why these two.** Each answers its fight. The gate is Mehrunes Dagon's: the Oath is an Akaviri Dragonguard's blade
(the Dai-Katana is the Akaviri's own), and Dragonfire is Akatosh's - the fire that sealed the gates - so it burns Daedra
alone and none of them resists it (a fire-immune Daedra takes it whole: no element's share is taken). **AUDIT B1:** as
first built it only BURST on the Daedra about a struck one, through the player door's foe records - and the gate's
court, its Warden, his crystals and his host are the relay's bodies, no record of any door (`world/gate/gateArena.js`, an
empty dungeon; `dungeonContext.js` keeps them out of `foes`), as an Elite Gate's legion will be: in the fights it is
named for it did nothing (twenty real blows of it on the Warden's stand-in, no burst). Now the STRUCK Daedra burns
too, as Many Endings' echo strikes again (`lootPowers.js` `dragonfire` -> `again`): through its record where the world
runs it, and OWED to the claim its blow sends where the relay does (`playerDoor.js` `oweFoe`, taken by `landOnBoss`,
`landOnHost`, `landOnCrystal` - OPEN-HAND's path, the relay's caps deciding what lands); the burst on the others
reaches only the foes the world runs. Of the Legion-Lord's host, by DFU's own groups, the Ward-Bearers and the Warden
are Daedra (the Harriers, Imps, are humanoid; the Sappers, atronachs, none). The serpent is the sea's: the Sovereign is
a sailor's saber, one hand and a shield, and its power is the undertow - the longer it holds a foe the harder it drags,
and a foe it drowns gives the tide back.

**The numbers - powerful, not overpowered.** AUDIT E6: section 3's method (each span's mean, the material's modifier)
missed the Oath's own +15 Strength - `combat/formulas.js` `damageModifier` is a point of damage for every 5 over 50, +3
a blow - which the Hourlock's Agility never touched. So the table is MEASURED now, the real `weaponAttackDamage` over
20,000 rolls (the mean with its integer floors; before the hit roll, a critical and armour), Strength 50 before the
weapon's own line:

| Weapon | A landed blow | Beside it |
|---|---|---|
| A Daedric Dai-Katana with +40% damage alone (a Legendary at the band's top, no Strength line) | 22.4 | section 3's best of the melee |
| **The Dragonfire Oath** | **25.4** at any foe (its Strength's +3); at a Daedra **+8.5** burnt again (a third of the blow, rounded a blow), and **8.5** to every other Daedra within 3 m where the world runs them | Earthshaker (a Legendary): a quarter of every blow to every foe within 3 m |
| Sethrakul's Fang (Aetheric, Ebony Katana) | 9.5 x 1.3 + 4 = 16.35 (section 3's way) | the serpent's own set's weapon |
| **The Sunken Sovereign** | **14.1** at a foe's first blow; **21.2** from its sixth on the same foe (+50%); 10% of each healed back | one hand - a shield beside it |

So the Oath stands a Strength line over a Legendary dai-katana anywhere, and a third again at a Daedra - about 34 a
blow at the gate's Warden and his Ward-Bearers, where the Hourlock lands 43.5 a shot at its 2.13 s cycle; the
Sovereign never outhits a two-handed Legendary, and what it has is staying power: a shield, a leech, a heal at every
kill, and a blow that grows on a foe that lasts. Like every power, each sleeps in a duel and wakes only for MY entity's
worn weapon's own blows - and (AUDIT B3) a blow the Warden's ward turns answers nothing (`lootStrike` refuses a warded
foe, as `lootBlow` already did: the strike is told before the court turns a melee swing).

**Undertow, as it runs** (`lootPowers.js`, kind `'undertow'`): the stacks are the FOE's - a WeakMap keyed by the struck
entity, `{ n, until, at }` - counted at the strike and read at the next blow (blow one +0%, blow six +50%). AUDIT B4:
they hold for `seconds` (6) from the last landed blow and are let go after, as Flow's are - kept for good, a crystal
of the next Reckoning (`gateCourt.js` keeps its stand-in for the whole fight) and a foe a quickload un-killed came back
with their old stacks. AUDIT B2: the kill's heal is the felled foe's own record (`at`), never one slot for the last
struck - a swing strikes every foe in its box before the hosts apply any, so a slot kept the second foe's and the
first one's fall healed nothing.

**The drops.** Each is its spoils' very LAST draw - after the technique pass, after everything the gate's and the
serpent's spoils rolled before - so every spoils and hoard ever rolled is what it was for its seed: `rollDragonfireOath`
at the end of `systems/gate/gateSpoils.js` `rollSpoils`, `rollSunkenSovereign` at the end of `systems/serpent/serpentSpoils.js`
`rollSerpentSpoils` (a ship that DEALT; one that stood draws nothing, as it draws no set piece, card or gem). One in a
hundred each: a gate opens every two hours and a serpent rises every four, where the Hour - the Hourlock's one in fifty -
comes a few times a week. Every pin that read "the last draw" moved with them, each saying so: WB5's roll, SET6's drop,
LOOT4's seeded doors, LOOT2's Exalted, GEM2's and TECH1's (the Oath and the Sovereign set aside, as the technique is).
AUDIT A1: on the gate's floor the Oath's picture is drawn LAST of all (`scenes/spoilsPool.js` `spoilsList`) - drawn in
its place among the pieces it moved the ember's, the gold's, the card's and the gems' pictures off what the seed gave
them (AUDIT CARDS-6 A8's law); it still leaves among the pieces, inside the glow's eight.

**The look.** Named as an artifact is; its card the tier, its four lines, its power and its lore; its own codex row
under the Hourlock's, unfound by its OWN hint (`hint` on the record, `lootCodex.js` `codexGilded`) - on the Reforge's
Codex page and (AUDIT A5) on the Collections page too, which said its rows were the Reforge's and never showed the rung
(GILDED1's gap, wider by two hints); the rung's name, the breathing frame, the spoils' line, the banner and the rim, every
one the rung's. The loot test character carries both, minted whole, after the Hourlock and its shot
(`systems/testRoom.js`; LR1's count moved with it). Their words - names, powers, lore and hints - are English, as the
Hourlock's are and as every record of the ladder's is (`lootRarity.js` 251 such, `aetheric.js` 97 on L10N4's ratchet):
the ladder's records are routed as one, by the localization arc, never record by record.

**What the audit left, and why.**
- AUDIT A2: a gate list of the three pieces, a Regalia piece, the Oath and the card puts the gold pile ninth - past the
  glow's eight (`render/spoilsGlow.js` SPOILS_GLOW_MAX), its line undrawn (7 lists in 20,000). The Oath is always
  inside the eight; the gold pile's line is the least of them.
- AUDIT A3: the wealth budget's spoils grant (`server-account/src/budget.js` `spoilsGrant`) is not sized for a 93,750
  piece one fight in a hundred. The budget is a measure today (`enforce: false`), its numbers "a guess the measure exists
  to replace", and loosening the grant for every claim to cover the Oath would loosen what it catches for all of them -
  the measure is left to say what the drop is.
- AUDIT A4: a build from before this one refuses a container or a lot holding either record whole (`systems/loot/loot.js`
  `validLootList` - a Gilded piece's marks are the shape's, as SERPENT-SET's were): the hosts read it as "from a newer
  version" and keep it, nothing is lost, and the relay's world206 brings every client to the new build at once.

**Not done, and why.** The gold IN THE HAND is the Hourlock's alone: its gold sprite and its gold Morrowind twin are
baked from the gun's own committed art (section 5), and a DFU weapon's art is the player's ARENA2 - no gilded frame of
it can be committed, and none can be eyed here without the data. So the Oath and the Sovereign are held, worn and
listed in their make's own art; a gilding of the classic frames at load (the metal band, 0x70-0x7F, mapped to a gold
ramp - `combat/fpsWeapon.js` `frameToColor32`'s dye seam) and of the Morrowind meshes is the next slice's, to be looked
at against the player's own data.

**The pins.** `test/systems/gilded2_world.test.js` (8) - the records, the mint, the drops, the floor's pictures, Dragonfire (a
relay body's burn owed, a warded blow nothing), Undertow (the window, a heal for each foe one swing fells) and the look;
`test/systems/auditcards5_ui.test.js` the Collections page's rows. `tools/mutants/gilded2.json`: 25, all dead (the law's version,
the audit's own among them). GILDED1's own pins that read one record moved (`gilded1_gilded.test.js`'s record and codex,
`loot10_codex.test.js`'s count), and GILDED1's mutant on the Hourlock's first line was re-aimed by content (its first
three lines, which the Oath's and the Sovereign's first lines share in part).

## 8. The crimson rung, and its crown (GILDED-RED, 2026-10-22)

Mac: "Can we change the gilded rarity to red instead of gold (keep the gold skins) and give it a better indicator than
2 stars". The rung's colour told it apart from nothing: in the pack its gold frame stood a shade from the Rare's yellow,
and its pips were the Artifact's star doubled in that same gold. The owner chose from sheets rendered in the real
Enhanced pack over ARENA2 (the grid, a close-up tile, the loot banner and the hover card; three reds, then three marks
on the red chosen): **Crimson**, and **a gold crown set with red jewels**. The port's own, as section 1 is - no DFU law
reaches the ladder's colours.

**The colour.** RARITIES' `gilded` is `#ff3b4a`, its tint `[1.00, 0.23, 0.29, 0.60]` (the native scroller's cell). Its
Plus vars (`ui/enhanced/enhancedPlusStyle.js` RARITY_VARS): the light `#ff7480`, 30% of the way to white - every other
tier's light stands past 40%, and a red's at 50% is pink, which is how the first sheet's bevels read - the shade
`#8e1622`, the rgb `255,59,74`. Every reader of the table moved with it (the native scroller's tint, the spoils' line,
the dropped piece's rim, the Iliac card frame, the companion roster, the loot banner's stack); every hand copy moved
to it: the name in a list, a card and a plaque and the post's win line (`enhancedStyle.js`), the breathing frame and
its still form under reduced motion and the big picture's glow and glint (`gilded-glow`), the codex's found row
(`REFORGE_CSS`), the quick loot's gem (`ui/lootTierMarks.js` TIER_MARKS - a crimson stone set in a rim of the crown's
gold, where it was leaf with a pale rim so it never read as the Rare's).

**The crown.** The rung's pips are a picture, `GILDED_CROWN_SVG` beside the padlock's glyph: an 11 px gold crown
(`#f6c945`), its black outline drawn in, three jewels of the rung's crimson - so the leaf's gold still stands beside the
rung's red wherever the tier is marked. `--rar-pips` holds it as a `url()`, so the three places that draw a tier's pips
draw it unchanged: the pack's tile corner, the card's tier line and the loot banner's kicker. The other tiers keep their
glyphs. The sheet's other marks were a red seal with a gold star (a dot at tile size) and a gold sunburst (busy at 11 px,
and near the Artifact's star).

**The page.** DFO Grimoire deepens each tier into an ink (`ui/grimoireDress.js` RARITY_INK): the rung's is `#a3122e`,
5.8:1 on the cream and 4.9:1 on the page, red where the old amber (`#7a4a00`) was a brown beside the Rare's and the
Legendary's. TEMP_INK's hot keeps the amber - it was the gilded tone's, and is the warmth's own now.

**Stone's ground.** The crimson is darker than the gold was: on the Stone theme's window ground (`#51514c`,
`PLUS_THEMES.stone.ground`) it reads 2.3:1 where the gold read 5.4:1. The post's win line, which AUDIT SERVER-POST lifted
for the three darkest tiers on Stone alone, lifts it too - to its own light, `#ffb1b7`, 4.65:1. Measured and left as
every tier stands: a tier's name in the pack on Stone's panel, drawn over its black outline and glow, reads 2.0:1 in
crimson where the magic, the legendary and the artifact read 2.3-2.6:1 - Stone's tier names are every tier's question,
not this slice's.

**The gold kept.** Nothing the pieces wear changed: the Hourlock's gilded frames and its Morrowind twin, the
Pistolet's gold, the list and doll pictures - `combat/thunderlockArt.js` GILD_RAMP and the baked textures. Looked at
after the change, in the real pack with nothing laid over it: the grid, the card, the banner, and the quick loot's plaque on Plus's
stone and on the Grimoire's page.

**The pins.** `test/ui/gildedred.test.js` (6) - the rung in crimson and its light short of pink, the crown and every
place that draws the pips, every hand copy held to the table and the old gold nowhere in the sheets, the Stone lift
(past 4.5:1 on the theme's ground), the page's ink (contrast on both grounds, a red), the gold ramp kept.
`tools/mutants/gildedred.json`: 26, all dead. PIN MOVED, each
saying so: `gilded1_gilded.test.js` (the rung's colour), `lootmarks1.test.js` (the Gilded's gem: set in the crown's gold,
not leaf).

## 9. The guns leave the loot - the Hourlock a bow, the Sovereign a saber again (GUNS-UNFOUND, 2026-10-23)

The owner: "So I want to remove the thunderlock and pistolet from the loot pool and revert the gilded weapon from the
serpent. Dont remove them from players who have them, but it should no longer be able to drop. Ammo should still drop".
Asked whether the Hourlock - a gilded Thunderlock - goes too: "Replace it"; offered a bow, a warhammer or a claymore,
the owner picked the Dwarven Long Bow that keeps the record, its lines and its power. So no Gilded record mints a gun,
and no drop does (`05-Combat/Dwarven-Thunderlock.md` GUNS-UNFOUND).

| | The Hourlock | The Sunken Sovereign |
|---|---|---|
| Now | a **Dwarven Long Bow** (130), Dwarven - `WEAPONS.Long_Bow` | the **Ebony Saber** (119) GILDED2 made it, its skill line Long Blade's, its saber lore |
| Kept | its id, name, four lines, power (The Hour Tolls), lore, drop (the Brass Remnant's one in fifty) and codex hint | its id, make, lines, power (Undertow), hint and drop (a dealing ship's one in a hundred) |
| Its era | `HOURLOCK_GUN_ERA` - the Thunderlock (560) GILDED1 minted | `SOVEREIGN_PISTOLET_ERA` - the Pistolet (562), Archery, its pistolet lore, that PISTOLET minted |
| Minted by | `createWeapon` (CreateWeapon), as the Oath | `createWeapon`, as GILDED2 did |

**The eras.** A save's item keeps its template, so a gun minted under either id is a gun still, and the player keeps
it. AUDIT PISTOLET's saber era is the shape (section 7): `GILDED_ERAS` names each record's older shape, and
`gildedRecordOf(item)` answers the era an item's template was minted under - the item law (`validGildedMarks`), the
wire and the lore read through it, so a held gun Hourlock or gold Pistolet stays lawful, tradeable and its own. Nothing
mints an era's piece but `mintGilded` asked for one (the tests' fixtures and `test/honestItems.mjs`, the shape a save
holds). `SOVEREIGN_SABER_ERA` is gone: the saber is the record again, so a saber minted under GILDED2 is the record's own
shape. The art of a held gun is untouched - its gold list and doll pictures, its gilded frames, its Morrowind twin
(sections 5 and 7) still key on a gun wearing the rung.

**The Hour Tolls on a bow.** The power is the record's, unchanged: every third of its shots that LANDS strikes for
double. The refund gives back the shot that felled the foe - an Arrow off the bow (`combat/enemyEquipment.js`
`bowDamageArrow`, the one arrow minter), a Pellet off a held gun Hourlock: the toll keeps the weapon that struck
(`_lastToll.weapon`, `systems/loot/lootPowers.js`) and asks `isGunTemplate`. Its text says "the shot" now, not "the
pellet".

**The numbers** (section 3's reading - the span's mean, Strength 50, before the hit roll, a critical and armour): a
Dwarven Long Bow is 4-18, so a landed arrow is 11 x 1.4 + 2 = 17.4, the toll x4/3 and +10 shock: **33.2**, where the gun
was 43.5. Its price is its make + its lines + GILDED_WORTH: 17,660 (the gun's was 39,740 - a held one keeps it). Lower
than the gun, by the bow's span: the Hourlock was measured as powerful, not overpowered, and a bow at the band's top
with the toll is still the Remnant's prize - the owner picked the bow.

**The law and the service.** A bow Hourlock is a shape law 11 never saw, so the item law moves to 12
(`systems/item/itemLaw.js` ITEM_LAW_VERSION) and the account service to acct178 with it (acct177 on its branch, renumbered past ACCOUNT-HOMES at the merge; `server-account/src/service.js`
ACCOUNT_VERSION, `wrangler.toml`) - `tech1_roster.test.js`'s LAW_SERVICE holds the pair. No migration.

**The test room** (section 6): the loot character carries the bow Hourlock and thirty arrows, where it carried thirty
pellets.

**The pins.** PIN MOVED, each saying so: `gilded1_gilded.test.js` (the record a bow, its gun era; the mint CreateWeapon's,
the gun era's at its old price; the shot back - the gun era's pellet, the bow's arrow; the gold art the gun era's),
`gilded2_world.test.js` (the Sovereign the Saber again; the Hourlock in the DFU mint's loop), `pistolet.test.js` (the
pistolet era lawful and its own; the gold Pistolet the era's), `pistolet_pins.test.js` and `pistoletRig.test.js` (the
gold Pistolet the era's), `thunderlockart.test.js` (the gold doll layer the gun era's), `serverpost_send.test.js` (the
HOURS-FIRST gift, frozen as a gun, is the gun era's mint and lawful still), `thunderlock.test.js` and `loot7check.test.js`
(the find, and a body's find, its Pellets alone - no gun), `auditloot.test.js` (The Last Lock's hint), the item law's
version pins and the account version's. The probes that wanted a gold gun ask the eras (`tools/gunSlotsProbe.mjs`, `tools/pistoletRigProbe.mjs`,
`tools/pistoletDollProbe.mjs`).

**The honest sweep** (`test/honestItems.mjs`): with the gun's tier roll gone from a find that fires, the sweep's seeded
loot shifted and its exalt branch reached a CURSED Legendary - and exalted it, which no door does (each exalts before it
curses, and the law holds the two apart: `validCurse`). The branch skips a cursed base now, as its technique branch
already did.

**The mutants.** `tools/mutants/gunsunfound.json`, 11: the gun found again, the Pellets miscounted, the Hourlock still a
gun, the Sovereign still a Pistolet or its Archery line, either era dropped, an era read for any record, the bow paid in
pellets, the gun era paid in arrows, the toll forgetting its weapon. Re-aimed by content: `gilded1.json` GILDED1-no-refund,
`gilded2.json` GILDED2-the-thunderlock-for-every-record, `pistolet.json` GF-two-draws, GF-unloaded, GF-half-weight-back,
SE-era-dropped and SE-era-for-any-template. Retired from `pistolet.json` with the code they mutated: GF-second-gun-never,
GF-share-flipped, GF-pellets-off-the-raw-draw, GF-pistolet-never-handed (45 records now). The four lists: 105, all dead.

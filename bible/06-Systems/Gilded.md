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

`systems/lootRarity.js` RARITIES gains a seventh rung, **Gilded** - rank 6, over the Artifact's 5 - in gold leaf
(`#ffcf4d`), its tint `[1.00, 0.80, 0.26, 0.60]`. "The most rare ... in the entire game" puts it over the Artifact too:
an artifact is a Daedric Prince's gift for a quest done, there for anyone who asks the right Prince; a Gilded piece is
one roll in fifty off the hardest fight the port has.

NOTHING ROLLS IT, as nothing rolls the Aetheric: `ROLLED_TIERS` (systems/rarityTier.js) is still Magic, Rare and
Legendary, `applyRarity` answers a piece untouched when asked for any other tier, and `rarityEligible` - the question
every door asks before it rolls - answers false for a piece that already wears one. `stampedTier` counts it (a tier
minted whole, as the Aetheric's is), so the doors that read "is this piece's tier its own" read it so.

Every reader of the ladder carries it - each found by grepping the Aetheric's own word and walking every hit:

| Reader | What it does with the rung |
|---|---|
| `ui/enhancedPlusStyle.js` RARITY_VARS | gold, gold-hi, gold-lo; two stars for pips (`\2726\2726`, the Artifact's one doubled) |
| `ui/enhancedPlusStyle.js` `gilded-glow` | the frame of a Gilded row, slot, hotbar cell and quick-diamond cell breathes - stepped (8 steps over 2.6 s); under reduced motion, a still glow at its brighter end |
| `ui/enhancedStyle.js` | the name in gold in a list, a card, a plaque |
| `render/spoilsGlow.js` SPOILS_LINE_H | 2.5 m - the tallest line, at the line's own cap (WB5's "a line, not a beam") |
| `systems/physicalItems.js` PI_RIM | 0.8 - the strongest rim |
| `systems/reforge.js` salvageRefusal | `'gilded'` - "A Gilded piece will not break" (ui/reforgeWindow.js) |
| `systems/enchanting.js` itemMakerRefuses | true - the item maker takes no static roll |
| `systems/legacy/heirloom.js` NEVER_RARITY | never an heirloom - it is its record's |
| `systems/itemInfo.js` | named as an artifact is - "The Hourlock", never "Dwarven The Hourlock" |
| `systems/quickslots.js` quickslotKey | `|g<record>` - only when set, so every save's keys still resolve |
| `systems/itemFields.js` | `gilded: str()` - the record's id, a declared field |
| `systems/loot.js` validLootItem | `validGildedMarks` - below |
| `systems/lootCodex.js` | its own kind - section 5 |

## 2. The Hourlock

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
per-mille has no row for it; the imprint is a Rare's; the salvage, the item maker and the heirloom refuse it by name.

### The power, as it runs

`systems/lootPowers.js`, kind `'toll'` - one more arm at the seams every Legendary power already uses:

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
`combat/gunFeel.js` cadence), at each span's mean, Strength 50, Speed 50, before the hit roll, a critical and armour:

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

The Brass Remnant's spoils (`systems/sdSpoils.js`, `11-Multiplayer/Super-Dungeons.md` section 11) roll ONE MORE THING
after everything they rolled before - the gold, the first piece, the two Rare-or-better, the ladder's last pass, the
Brass of Numidium - so every earlier spoils is exactly what it was for its seed: `rollHourlock` draws once, always, and
answers the Hourlock under GILDED_CHANCE (1 in 50). Online alone, because the Hour is. sd9e_spoils.test.js's oracle and
its mutant (the Hourlock before the Brass) hold the order.

## 5. The look

- **The card** (`rarityLines`): "Gilded", its four lines (no band - a static roll has none to show), "The Hour Tolls:
  Every 3rd hit x2; kills refund", its lore. Its name in gold, its frame breathing.
- **The codex** (`systems/lootCodex.js`): a kind of its own, `gilded`. The first find is said and heard as a
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
  GILD_RAMP by its lightness, alpha never written. The rig keys the art `:gilded` (`combat/weaponRig.js`), so a gold
  gun and a plain one never share frames.
- **In the Morrowind hand** (`characters/ownWeaponModels.js` OWN_MW_GILDED): its own twin, `thunderlock_gilded.nif`
  over `thunderlock_gilded.dds` - the same capped mesh, the same bone, animation and speed, its texture baked off the
  same occlusion in gold leaf (`tools/meshTexture.mjs` GILDED_BANDS, `tools/bakeThunderlock.mjs`). The preload asks the
  table for both rows (FIELD-GUN-MW2's law).

## 6. The pins

`test/gilded1_gilded.test.js` - the rung, the record, the mint, a static roll, no door alters it, the drop, the power
(the toll and the pellet back), the look, the art and the gold in the hand (a sketch of the idle frame: a glove at the
foot, the brass above, a glove-hued crevice that touches nothing). Its mutants, `tools/mutants/gilded1.json`: 23, all
dead. The ladder's own enumerations moved with it, each saying so: LR1, SET6, PI1, WB5, RF5, LOOT9 (the salvage's
refusals), LOOT10/AUDIT LOOT (the codex count), DW1 and AUDIT-DW F4 (the rig's key), FIELD-GUN-MW2 (the preload's two
rows and the bake's two twins), SD9e (the spoils' order and the Hourlock's rate).

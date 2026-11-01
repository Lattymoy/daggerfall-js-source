# Gilded

Gilded is the loot ladder's top rung, above Artifact: five named weapons, each a static roll, each the rare last
draw of one of the hardest fights online. The player meets it as a crimson name with a gold crown set with red jewels,
and a crimson glow on the weapon in hand. Daggerfall has no rarity ladder; this is the game's own.

## How it works

**The rung** (`src/systems/loot/lootRarity.js` `RARITIES`). `gilded`, rank 6, over the Artifact's 5, in crimson
`#ff3b4a`; its mark is a gold crown set with red jewels, and its pieces' own art stays gold leaf. Nothing rolls it: the
ladder's roll takes the rolled tiers alone, so no drop, pile, shelf, Broker or Reforge lands on it. A Gilded piece adds
12,500 to its price (`GILDED_WORTH`).

**The five records** (`src/systems/gilded.js` `GILDED_RECORDS`). Each line stands at the Legendary band's top and no
higher; each power is something nothing else has:

| Record | Weapon | Power | From |
|---|---|---|---|
| The Hourlock | Dwarven Long Bow | The Hour Tolls: every third hit double, a kill returns the shot | the Brass Remnant's spoils, 1 in 100 |
| The Dragonfire Oath | Daedric Dai-Katana | Dragonfire: a hit on a Daedra burns it and every other Daedra within 3 m for a third | the gate Warden's spoils, 1 in 250 |
| The Sunken Sovereign | Ebony Saber | Undertow: +10% a hit on a foe for 6 s, to +50%; a kill heals 10% | a dealing ship's serpent hoard, 1 in 250 |
| Volendrung's Echo | Dwarven Thunderlock | Hammerfall: a hit rings half the shot as shock on every other foe within 3.5 m | the Sky-Ketch's Tonal Warden, 1 in 100 |
| The Ketchmaster's Word | Dwarven Pistolet | Broadside: a hit marks the foe; the other hand's next blow on it +60% | the Sky-Ketch's Tonal Warden, 1 in 100 |

Each drop is the last draw of its spoils, so every earlier spoils stays what it was for its seed. Guns drop only from
the Sky-Ketch. An Hourlock minted as a Thunderlock or a Sunken Sovereign minted as a Pistolet stays lawful as its
record's era (`HOURLOCK_GUN_ERA`, `SOVEREIGN_PISTOLET_ERA`) and are never minted again.

**A static roll.** Every number is the record's, minted whole (`mintGilded`). It is never rolled, reforged, honed,
socketed, imprinted, cursed, salvaged, tempered or made an heirloom. The wire and the item law hold it to its record
exactly (`validGildedMarks`); anything else on it reads as a forgery.

**The item maker.** A Gilded piece takes DFU's item maker rows as a Rare does, paid from its make's own points and the
player's gold, ten rows at most, beside its record's lines (`src/systems/enchanting.js` `gildedKeeps`). Its lines never
move, and the maker never renames it (`makerKeepsName`). A counter pays what it paid; a smith repairs it under
AllowMagicRepairs.

**The glow.** In hand, a Gilded weapon wears the glow look `gilded`: garnet through crimson to a hot pink-white core, a
slow pulse, a crest and a glint. It wins over the element, the Aura Armory's piece and the arcane look, in the classic
outline and the Morrowind arm, and peers see it. With the ladder switched off there is no rung and no glow.

## Rules

- **A rarity above Aetheric, the rarest in the game, a static roll, powerful but not overpowered** (Mac): lines at the
  Legendary band's top, `src/systems/loot/lootRarity.js` `AFFIX_RANGES`.
- **Crimson, with a crown** (Mac; the owner chose the red and the mark).
- **No guns in the loot pool; guns only from the Sky-Ketch** (the owner); pieces players already hold are kept.
- **Gilded drops are rare across the board** (the owner): `GILDED_CHANCE`, `GATE_GILDED_CHANCE`,
  `SERPENT_GILDED_CHANCE`, `KETCH_GILDED_CHANCE`.
- **Enchantable as a Rare, lines never raised, a crimson glow of its own.**
- Online only: every source is an online fight.

## Daggerfall Unity

DFU has no rarity tiers, no Thunderlock and none of these fights; no DFU law reaches the rung. What it borrows is DFU's
own: `CreateWeapon` for the bow, dai-katana and saber, the item maker's rows, and AllowMagicRepairs.

## Code and tests

- `src/systems/gilded.js` - the records, powers, chances, mint, eras and the wire's check
- `src/systems/loot/lootRarity.js` - the rung; `src/systems/loot/lootPowers.js` - the powers
- `src/systems/enchanting.js` - the item maker's rules for a Gilded piece
- `test/systems/gilded1_gilded.test.js`, `test/systems/gildedmaker.test.js`, `test/systems/gildedglow.test.js`

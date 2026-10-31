# Gem Sockets

Weapons, armour and jewellery from the loot ladder can carry sockets, shown as wells on the item card and pips on its
tile, filled with gems the player finds. Each of DFU's eight gems comes in five grades. The player sets a gem in the
pack with no guild between; the Mages Guild's Reforge takes one out whole for gold. Daggerfall has no sockets; this
builds on the loot ladder (`06-Systems/Loot-Rarity.md`).

## How it works

**Sockets** (`src/systems/loot/lootRarity.js`). An item's `sockets` is a list of one to three values, each `'empty'` or
the id of the gem set in it; the older single `socket` field is still read (`socketsOf`). A weapon holds as many as its
size allows (`WEAPON_SOCKETS`): a short blade one, a one-handed weapon two, a two-handed weapon or bow three, by DFU's
hands table. Armour or a jewel holds one. Never ammunition or a garment.

**How many it is given.** The ladder's own pass gives a Rare a socket 150 times in a thousand and a Legendary 300, any
group. Then the weapons' pass (`weaponSocketPass`) gives a weapon with none a socket (Magic 120, Rare 250, Legendary 400
in a thousand), and each further socket up to its size (Rare 300, Legendary 450), stopping at the first miss. A Magic
weapon holds one.

**The gems** (`src/systems/loot/gemGrades.js`, `src/systems/gems.js`). DFU's eight are the plain grade. Four more grades
of each are the game's own rows 1900-1931, on the gem's own DFU art: Chipped, Flawed, plain, Flawless, Perfect. Each
grade gives its line:

| Gem | In a weapon (chipped / flawed / plain / flawless / perfect) | In anything else |
|---|---|---|
| Ruby | +1 / 2 / 3 / 4 / 6 Fire damage | +4 / 7 / 10 / 15 / 20% Fire resistance |
| Sapphire | the same, Frost | the same, Frost |
| Emerald | 1 / 2 / 3 / 5 / 7% life leech | the same, Poison resistance |
| Diamond | +2 / 4 / 6 / 9 / 12% damage | the same, Magic resistance |
| Amber | +1 / 2 / 4 / 6 / 8 Speed | +1 / 2 / 3 / 4 / 6 Luck |
| Jade | +1 / 2 / 4 / 6 / 8 Willpower | the same |
| Turquoise | +1 / 2 / 4 / 6 / 8 Agility | +1 / 2 / 4 / 6 / 8 Personality |
| Malachite | +1 / 2 / 4 / 6 / 8 Strength | +1 / 2 / 4 / 6 / 8 Endurance |

**In the world** (`rollGemFind`, `GEM_FIND`). Every door the ladder rolls at (a corpse, a pile, a tavern's or guild's
marker) may find one graded gem: 10 in a thousand, 2 more a tier of the source, at most 50; a pile 1.3 times, a boss 2.5,
times the finder's Luck multiplier. The grade follows the source's tier (`GEM_GRADE_BANDS`; a boss reads four tiers
deeper), the kind is even over the eight. World bosses' spoils run the socket passes over their pieces and add gems at
the top band: the Oblivion Gate's Warden one, the Old Coil one to a ship that dealt, the Brass Remnant two. No counter
stocks a graded gem.

**Setting and taking out.** In the pack, pressing an empty well offers every loose gem with the line it would give
that piece; pressing a set well shatters its gem after asking. A gem's own card offers "Set in..." for every piece with
an empty socket. Setting is free and works on a worn piece. At the Reforge's Sockets page a gem comes out whole for gold
by grade (`src/systems/reforge.js` `EXTRACT_PRICE`: 50, 100, 200, 400, 800). A stone a counter sold keeps its counter
mark through the socket (`socketBought`).

**At the jeweller's bench.** Every grade is also a Jewelcrafting material and recipe, its enchantment points by grade
(`06-Systems/Professions-Arc.md`).

**On the wire and in the save.** `sockets` is a declared item field; `validSocket` is the one law both lanes read: only
on a piece whose group and tier may hold one, never past its cap, and each gem line exactly its gem's line for that
piece. Gem lines stay in `affixes`, marked with their gem.

## Rules

- **Physical gem slots shown on the weapon, new gems in world loot and from world bosses** (Mac).
- **Gems that can be slotted are rare** (Mac): `GEM_FIND`.
- **Every grade is accepted at the jeweller's bench** (the owner).
- **A piece's gems give at most one Rare line of a kind**: gems of one kind together read no more than the top of that
  kind's Rare band (fire 6, leech 7, damage 25, an attribute 10). The card shows each gem's number and says when the cap
  bites.
- **The source sets the odds**; **shops do not roll** graded gems; **off is DFU exactly** (with the `loot-rarity` row
  off there are no sockets and no graded finds); **a seed's draws stay its seed's** (every new draw comes after the old).
- **A socket is a place, filled where the weapon is**, by the player; only extracting whole needs the Reforge.

## Daggerfall Unity

DFU's eight gems are plain ingredients found in its loot tables and sold at its counters, untouched here. Sockets,
grades, the find and the bosses' gems are the game's own. A graded gem is a DFU-style ingredient, so the potion maker
lists it; no potion recipe takes one.

## Code and tests

- `src/systems/loot/lootRarity.js` - sockets, the passes, `validSocket`
- `src/systems/loot/gemGrades.js`, `src/systems/gems.js` - grades, lines, the world's find
- `src/systems/reforge.js` - setting and extracting at the Reforge
- `test/systems/gem1_sockets.test.js` - sockets, grades, the find; `test/net/clothgems_gems.test.js` - grades at the bench

## Open

- Combining three gems of a grade into the next is not built; it would turn loose stones into gold, and it is the
  owner's question.
- Gem kinds of the bosses' own wait for lines the game reads.
- Sockets show on the card and tile only; the 3D weapon models carry no socket mesh.
- Setting a gem changes a quickslot weapon's key, so its hotbar slot goes to a ghost.

# Gem Sockets - the weapon's wells, and the gems that fill them (GEM1-GEM3)

> Design page, written before the code (2026-10-09). The slices at the foot ship in that order in one pull request;
> each is verifiable without the next. Where this page and a shipped slice disagree, the slice's own record (section 9)
> is what runs. It builds on LOOT20 (`06-Systems/Loot-II-Arc.md` section 12), the ladder (`06-Systems/Loot-Rarity.md`)
> and the world bosses' spoils (`11-Multiplayer/World-Bosses.md`, `Sea-Serpent.md`, `Super-Dungeons.md`).

## What Mac asked for

Mac, 2026-10-09: *"For the rarity system we implemented. Id like to have and show weapons with physical gem slots that
can be slotted into, along with introducing new gem items into the world loot pool and world bosses."*

## 1. What stood before

LOOT20 gave a Rare (15 in a hundred) or a Legendary (30) ONE socket, on a weapon, a piece of armour or a jewel, written
as a string (`socket: 'empty'` or the gem's id). The only way to fill it was the Mages Guild's Reforge page, for 100
gold; unsetting shattered the gem. DFU's eight gems were the only gems, and the card said "Socket: empty" as one more
line of text. The world bosses' spoils (the gate's, the serpent's, the Abyss's) never ran the socket pass at all: a
boss's piece was never socketed. So a socket was a rare line of text that a player never saw as a place on the weapon,
and filling one meant a trip to a guild.

## 2. The laws this arc keeps

The Loot arcs' ten stand (`Loot-II-Arc.md` section 1). The ones this arc leans on:

1. **The source sets the odds, never the player.** A gem's grade is the source's: a rat's pocket holds a chipped
   stone, the Warden's hoard a flawless one.
2. **Shops do not roll.** No counter stocks a graded gem: the rows are in no group's enum a shelf draws from (the
   Sigil Stone's own law).
3. **Off is DFU exactly.** With the `loot-rarity` row off no socket is given, no graded gem is found, and the fold
   reads no gem's line.
4. **A seed's draws stay its seed's** (law 9). Every draw this arc adds is taken AFTER every draw a door already makes:
   at the host door after the late finds (LOOT21), in a boss's spoils after its card (CARDS9). A seeded mint mints
   what it did, and then a socket or a gem more.

And two of its own:

5. **A socket is a place, not a line.** It is drawn where the weapon is drawn - a row of wells on the card, pips on the
   tile - and it is filled where the weapon is: in the pack, by the player, with no guild between. The Reforge keeps
   the one thing a player cannot do alone: taking a gem out WHOLE.
6. **A piece's gems give at most one Rare line of a kind.** A weapon's gems of one kind, together, read no more than
   the top of that kind's Rare band (fire 6, leech 7, damage 25, an attribute 10). Two Perfect Rubies read +6 Fire, not
   +12: a second socket is a second KIND, never the same line doubled. Every line still says its own number on the
   card; the readers (the fold, the blow, the strike, the compare) read the capped sum, and the card says when the cap
   bites. LOOT12's 45-an-element resistance cap stands across pieces as before.

## 3. Sockets on weapons (GEM1)

A socket list replaces the string: `sockets`, one to three values, each `'empty'` or the id of the gem set in it. The
string LOOT20 wrote (`socket`) is still read wherever a socket is read (`socketsOf`) - a save, a room's memory or a
market listing written before this arc reads as one socket - and the first write turns it into the list.

**How many a weapon can hold** is its size's (`socketMax`): a short blade (Dagger, Tanto, Shortsword, Wakizashi) one;
a one-handed weapon (Broadsword, Saber, Longsword, Katana, Mace, Battle Axe) two; a two-handed one (Staff, Claymore,
Dai-katana, Flail, Warhammer, War Axe, the bows, the Thunderlock) three - DFU's own hands table (`WEAPON_HANDS`), read
without the bow-hand setting, so a piece's sockets never move with a switch. A piece of armour or a jewel holds one,
as LOOT20 made it. Never ammunition, never a garment.

**How many it is given.** LOOT20's pass stands as it is (a Rare 150 in a thousand, a Legendary 300, every group). Then,
after the late finds, the weapons' own pass (`weaponSocketPass`):

| tier | a weapon with no socket gets one | each further socket, up to its size |
| --- | --- | --- |
| Magic | 120 in a thousand | - (a Magic weapon holds one) |
| Rare | 250 | 300, stopping at the first miss |
| Legendary | 400 | 450, stopping at the first miss |

Measured against LOOT20's pass before it, a Rare weapon has a socket about 36 times in a hundred and a Legendary 58; a
two-handed Legendary holds all three about 12 times in a hundred.

**Filling one.** In the pack, a socket well on the card is pressed: an empty one offers every loose gem the pack holds,
each with the line it would give THIS piece; a set one asks first and shatters its gem. A gem's own card offers "Set
in..." for every piece with an empty socket. Setting is free - the gem is the price - and works on a worn piece too (the
wearer's fold is run again at once). At the Reforge, the Sockets page sets as the pack does, and EXTRACTS: the gem
comes out whole, for gold by its grade (`EXTRACT_PRICE`: Chipped 50, Flawed 100, plain 200, Flawless 400, Perfect 800).

## 4. The gems (GEM2)

DFU's eight gems stay what they are: the plain grade, found as DFU finds them and on every counter that sells them.
The port adds four grades of each - thirty-two rows of its own, 1900 to 1931 (`GEM_GRADE_TEMPLATE_BASE`), each on its
kind's own DFU art (TEXTURE.254) with the grade in its name: **Chipped**, **Flawed**, (plain), **Flawless**,
**Perfect**. A graded gem is a gem in every way DFU's are - the Gems group, an ingredient that stacks with its own row
alone, worn as a crystal - and its line is its grade's:

| gem | in a weapon: chipped / flawed / plain / flawless / perfect | in anything else |
| --- | --- | --- |
| Ruby | +1 / +2 / +3 / +4 / +6 Fire damage | +4 / 7 / 10 / 15 / 20% Fire resistance |
| Sapphire | the same, Frost | the same, Frost |
| Emerald | 1 / 2 / 3 / 5 / 7% life leech | the same, Poison |
| Diamond | +2 / 4 / 6 / 9 / 12% damage | the same, Magic |
| Amber | +1 / 2 / 4 / 6 / 8 Speed | +1 / 2 / 3 / 4 / 6 Luck |
| Jade | +1 / 2 / 4 / 6 / 8 Willpower | the same |
| Turquoise | +1 / 2 / 4 / 6 / 8 Agility | +1 / 2 / 4 / 6 / 8 Personality |
| Malachite | +1 / 2 / 4 / 6 / 8 Strength | +1 / 2 / 4 / 6 / 8 Endurance |

The plain column is LOOT20's table, unchanged. A Perfect weapon line never stands past the top of its kind's Rare band
(fire's, frost's and the leech's stand at it), so one Perfect Ruby is the most fire a piece can read (law 6), and a
three-socket blade wants three kinds.

**In the world** (`rollGemFind`): every door the ladder rolls at (a corpse, a dungeon's pile, a tavern's or a guild's
marker) has a chance at one graded gem, after the weapons' socket pass - 30 in a thousand, 5 more a tier of the source,
to 150; a pile 1.3 times, a boss 2.5; the player's luck the ladder's own multiplier. Its grade is the source's tier's
(`GEM_GRADE_BANDS`, a boss four tiers deeper):

| source tier | chipped | flawed | plain | flawless | perfect |
| --- | --- | --- | --- | --- | --- |
| 0-4 | 70 | 30 | | | |
| 5-9 | 30 | 50 | 20 | | |
| 10-14 | | 30 | 45 | 25 | |
| 15-19 | | | 35 | 50 | 15 |
| 20+ | | | | 60 | 40 |

Its kind is drawn evenly over the eight. A plain grade is DFU's own row.

**From the world bosses.** Each boss's spoils grow two last draws, after its card: the socket passes over its pieces
(LOOT20's, then the weapons'), and its gems at the boss's own grade (tier 21, a boss - the table's last row): the
Oblivion Gate's Warden one, the Old Coil one to a ship that dealt, the Brass Remnant two. Every gem is known and thrown
with the rest of the spoils.

## 5. Where it shows (GEM3)

- **The card's wells.** Under the item's picture on the enhanced card, a row of round wells, one a socket: an empty one
  sunk and dark, a set one holding its gem's own picture with a ring in its grade's colour. Pressed (the pack's own
  piece), a well opens its chooser; hovered, it says its line.
- **The tile's pips.** A socketed piece's tile in the pack, the loot list and the worn panels carries one pip a socket
  in its corner, filled for a set gem.
- **The lines.** The card's tier list keeps a line a gem ("Flawless Ruby: +4 Fire damage") and one line for the empty
  ones ("Sockets: 2 empty"); when law 6's cap bites, one line says so ("Gems: Fire damage held at +6"). The classic
  scroller's tooltip reads the same lines.
- **The Reforge's Sockets page** rows every socket of every socketed piece, sets in an empty one, and extracts from a
  set one.

## 6. The wire and the save

`sockets` is a declared item field (an array of at most three `SOCKET_VALUES`); `socket` stays declared, so a peer on
the build before this one is still read. `validSocket` is the one law both lanes read: a socket list only on a piece
whose group and tier may hold one, never longer than its `socketMax`, never both fields; and the gem lines after the
piece's own, one a set socket, in the sockets' order, each exactly its gem's line for this piece. The gem lines stay in
`affixes`, marked with their gem (LOOT20's shape), so every reader that already read one gem reads three.

## 7. What is recorded, not built

- **Combining gems** (three Flawed into a Rubies' Flawless at a jeweller's bench) is the natural next slice - it gives
  the low grades a road up and Jewelcrafting a job - and is not in this one.
- **Gem kinds of the bosses' own** (a Coil Pearl, an ember of Ruhn) want lines the port does not read yet; law 8 of the
  Loot arc II (no dead lines) holds them back until they have readers.
- **A socket on the 3D weapon.** The wells are the card's and the tile's; the Morrowind models carry no socket mesh.

## 8. The slices

| slice | what | shippable alone because |
| --- | --- | --- |
| GEM1 | the socket list, a weapon's size, the weapons' pass, setting in the pack, extracting at the Reforge, law 6 | a field, a law, a pass and two presses |
| GEM2 | thirty-two graded rows, the world's gem find, the bosses' gems and sockets | rows, a pass and three last draws |
| GEM3 | the wells, the pips, the lines, the Sockets page | the faces of what GEM1 and GEM2 made |

## 9. What shipped

Written as each slice lands.

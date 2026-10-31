# Loot II: the wardrobe and the craft

The second layer on the loot rarity ladder (`06-Systems/Loot-Rarity.md`, first layer `06-Systems/Loot-Arc.md`): a cap
on rolled resistance, luck as a nudge on the odds, rarity for clothing with its own pool of lines, six Legendary
garments, cursed finds and the temple that lifts them, the hone, line-by-line comparison, junk marks and a loot filter,
scrying, sockets, and two Ayleid stones. The player meets it on item cards, at the Reforge, at a temple's priest, in
the shop's Sell and in quick loot. Gem sockets grew further on their own page (`06-Systems/Gem-Sockets.md`).

## How it works

**Honest resistance** (`src/systems/loot/lootRarity.js` `RESIST_CAP`). The ladder's rolled resistance lines (Magic,
Rare, Legendary, an Exalted's extra line and a socketed gem's) count together to 45 an element; the rest is carried and
does nothing, and the card says how much counts. A body's own resistances (race, career, spells) and an Aetheric design
or set tier are their own and stay whole.

**Luck, a nudge** (`luckMult`). Luck multiplies every rarity threshold before its cap: 1% a point away from 50, from
`LUCK_MULT_MIN` (half) to `LUCK_MULT_MAX` (half again). At Luck 50 nothing moves.

**The wardrobe.** All 76 DFU clothing templates roll the ladder from a pool of their own: breadth, never power.

| Kind | Magic | Rare | Legendary | Read by |
|---|---|---|---|---|
| `standing` (one social group) | 2-3 | 3-5 | 5-8 | the player's reaction mods, capped at 10 a group |
| `warmth` | 2-4 | 4-7 | 7-10 | Climates & Calories' clothing warmth |
| `dry` (%) | 10-20 | 20-35 | 35-50 | the weather's soaking, at most 75% off |
| `skill` | | | | the feet's five skills on footwear, the street's seven on the rest |
| `stat` (Personality only) | | | | live stats |

Never on a garment: damage, armour, capacity, resistance, Luck or an active line. A Rare garment's enchantment comes from
DFU's catalogue (Good Rep With, Enhances Skill, Improves Talents), never Cast When Held. Warmth and dry lines say
"(survival off)" when the player's survival tier is Off. A garment's lines are priced at half a weapon's. A Superior
crafted garment takes its Magic roll, a Masterwork its Rare.

**Six Legendary garments** (`WARDROBE_LEGENDARIES`): the Alik'r Wayfarer's Robes (Desert-Born, heat felt 20 degrees
less), the Wrothgar Pass Mantle (Mountain-Born, cold felt 20 less), the Vestments of Stendarr (Restoration spells a
quarter cheaper), the Pilgrim's Sandals (The Long Road: tire a quarter slower, falls hurt half), the Silks of Queen
Barenziah (Royal Bearing, +5 standing with every group) and the Shade's Cowl (Unseen, more Stealth while its hood is
up).

**Cursed finds** (`CURSE_IN` 12). One Rare or Legendary in twelve minted at a body or a pile (never an Exalted, a craft,
the Broker's, spoils or a quest's) is cursed: one extra line from the top half of its band and one drawback from DFU's
catalogue that the port reads live (Bad Rep With, Bad Reactions From, Item Deteriorates or User Takes Damage in holy
places, and on a weapon Low Damage Vs or Health Leech unless used daily). The drawback is an enchantment, so the curse
is unknown until identified. A temple's Cure Disease priest lifts it (`src/systems/loot/lootCurse.js` `liftPrice`: a
quarter of the piece's price, at least 300 gold), keeping the extra line. One cursed Legendary weapon in four
(`DAMNED_IN`) is **Damned**: its line at the top of its band, its drawback Health Leech whenever used, and no temple
lifts it.

**The hone** (`src/systems/reforge.js` `honePrice`). At the Reforge, a line is rolled again within its band, always
higher. Magic 1 shard and 50 gold, Rare 2 and 150, an Exalted's line 4 and 500, doubling with each hone on the piece. A
line at its top is not honed. The Imbue and the Reforge draw lines with no lean; found and made pieces keep their lean.

**Seen.** A card compares every line, by kind and param, against the piece it would replace (`new` for a line the worn
piece lacks). A **junk** mark sells every junk piece in one press at a shop's Sell and is never quick-looted.
**Salvage every Magic** in one press. Quick loot takes all gear, Magic and up, or Rare and up; gold, supplies and quest
items always.

**Scrying** (`src/systems/loot/lootScry.js` `SCRY_PRICE`: 3 Welkynd Shards and 500 gold). Name a family, or an unfound
codex record, and the guild reveals the nearest undiscovered dungeon of that family's kinds in the region. Nothing to
find, nothing paid. It changes no odds.

**Sockets.** A Rare or Legendary minted at a body or a pile may carry a socket; one of DFU's eight gems gives one line
by the piece's kind (a weapon's blow or the wearer). A socket's resistance counts toward the cap. The current socket,
gem and grade law is `06-Systems/Gem-Sockets.md`.

**The Ayleid stones** (`src/systems/ayleidStones.js`). A Welkynd Stone (from source tier `WELKYND_STONE_TIER` 6) fills
magicka when used; a Varla Stone (tier `VARLA_STONE_TIER` 10) restores every worn enchanted piece to full condition.

## Rules

- Go all in, as detailed as possible (Mac).
- Scrying tells where, never makes a find likelier.
- Shops and quest rewards do not roll. Loot never enters the Stores.
- Off is DFU exactly: with the `loot-rarity` row off, no garment rolls, no curse, socket, hone, scrying, compare or
  luck lean.
- No dead lines: every affix and power has a live reader, and a line whose reader is switched off says so.
- A seed's draws stay its seed's: every new roll (wardrobe, curse, damning, socket) is taken after every draw a door
  already makes, so seeded mints are unchanged.
- Gear alone never makes a body immune.
- No lean on the Reforge or Imbue (the owner).
- LOOT-GATE: the level gate's numbers (`src/systems/loot/lootLevelGate.js`) are never published to players.

## Daggerfall Unity

DFU's loot (`LootTables`, `ItemBuilder`, MAGIC.DEF) has no rarity ladder; clothing is Common, or Magic only when DFU's
own magic item roll lands on it. Everything here is the port's own. It reuses DFU's enchantment catalogue for
garments' enchantments and curses, DFU's eight gems for sockets, `IsIdentified` for a hidden curse, and the temple's
Cure Disease service for lifting.

## Code and tests

- `src/systems/loot/lootRarity.js` - the cap, luck, the wardrobe pool and garments, curses, damning, line compare
- `src/systems/loot/lootCurse.js` - the temple's lift
- `src/systems/reforge.js` - the hone, sockets' setting
- `src/systems/loot/lootScry.js` - scrying
- `src/systems/ayleidStones.js` - the two stones
- `test/systems/loot12_resistcap.test.js`, `test/systems/loot13_luck.test.js` - the cap and luck
- `test/systems/loot14_wardrobe.test.js`, `test/systems/loot15_garments.test.js` - the wardrobe and its Legendaries
- `test/systems/loot16_curses.test.js` - cursed finds and the lift
- `test/systems/loot17_hone.test.js`, `test/systems/loot18_seen.test.js` - the hone, the compare, junk and the filter
- `test/systems/loot19_scry.test.js` - scrying
- `test/systems/loot20_sockets.test.js` - sockets
- `test/systems/loot21_stones.test.js` - the Ayleid stones
- `test/systems/auditloot2.test.js` - the arc's audit
- `test/systems/loot/pressflat.test.js` - no lean on a press

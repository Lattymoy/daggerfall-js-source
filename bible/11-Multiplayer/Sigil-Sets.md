# Sigil Sets

Armour, shields and weapons whose sigil names a set. Worn together, 2, 4 and 6 pieces of one set wake its three named
abilities. Sets work online only, never in a duel. Four sets of the world, each answering to a Prince, drop from any
online win. Each world event has its own **Aetheric** set, a rarity above Legendary. The Sigil Broker at each breach
sells the day's stock for Deadlands Embers. Players meet sets on loot, on the item card, in the inventory's set panel
and at the Broker.

## How it works

**A set piece** (`src/systems/sigil/sigil.js`). The weapon sigil's record `{ power, party, xp }` gains a `set` id
(`SIGIL_SET_IDS`). A Magic-or-better armour piece, shield or weapon may carry one, never jewellery, clothing, an
artifact or a quest item. A set has nine places (`SET_PLACES`): helm, two pauldrons, cuirass, gauntlets, greaves,
boots, shield and weapon. A set weapon's blow and its set share one `xp`.

**Counting and tiers** (`src/systems/sigil/sigilSets.js`). Worn pieces are counted per set; a pack piece counts for
nothing, and two weapons of one set in the two hands are one piece. Tiers wake at `SET_TIERS` (2, 4, 6); lower tiers
stay awake under higher ones.

**The stage.** A piece's stage is the lower of its rank by `xp` and the stage the wearer's Renown opens
(`SIGIL_STAGES`: Faint 0 / Renown 1, Kindled 5,000 / 10, Bright 12,500 / 20, Radiant 22,500 / 30, Ascendant 37,500 /
40). **A set's stage is its lowest worn piece's**, and the card names the piece holding it back. Every number is given
at Faint and at Ascendant, and a stage between takes its place on the line.

**Growth.** Every worn set piece drinks the Renown XP of every online kill and quest, with the party's bonus, up to
`SIGIL_XP_MAX`. A rise is said once for the set. A set's reach is the highest stage it has stood at for this character
(`src/systems/sigil/setReach.js`); a piece below it drinks `CATCH_UP_MULT` (3x) XP until it gets there.

**Asleep.** Offline, before the page knows its Renown, and in a duel or a live arena bout between players
(`setSetsDueling`), every set sleeps: no tier, no growth. The card still shows what it would do.

**The sets of the world** (`WORLD_SET_IDS`, any material, any online win):

| Set | Role | 2 / 4 / 6 |
|---|---|---|
| Malacath's Bulwark | tank | Orc-Hide / Spite of the Spurned / Unbroken |
| Dagon's Brand | melee | Ravager / Bloodfury / Rampage |
| Nocturnal's Shroud | stealth, archery | Shadow's Grace / Nightfall Strike / Eventide |
| Mora's Mantle | magic | Forbidden Lore / Waters of Oblivion / Eye of Mora |

When a list is won online, every Magic-or-better armour piece and shield rolls a set sigil by the weapon sigil's chance
law (`SIGIL_CHANCE_BASE` per mille, `SIGIL_CHANCE_PER` more a fighter past the first), one of the four at even odds. A
weapon's sigil joins a set one time in `SET_WEAPON_JOIN_IN`. A piece never gains or loses a sigil after it is won.

**Aetheric** (`src/systems/aetheric.js`). The top rung under Artifact, with its own colour, pip, frame and worth
(`AETHERIC_WORTH`). Nothing rolls it: each Aetheric set is nine fixed records (`AETHERIC_RECORDS`) from one source.

| Set | Source |
|---|---|
| Ruhn's Regalia | a breach's spoils, `REGALIA_CHANCE` (1/6); the Broker |
| The Broken Oath, The Thief-Taker's Garb, Orcsbane Harness | the raiding parties, `RAID_SET_CHANCE` (1/4) |
| Sethrakul's Coilscale | the sea serpent, `SERPENT_SET_CHANCE` |
| The Brass of Numidium | the Brass Remnant, `NUMIDIUM_SET_CHANCE` (1/3) |
| The Battlemage's Panoply | the Elite Gates' Spire; the Broker once a week |
| The Wyrd's Raiment | the Witches' Festival |
| The Starspun Weave | the Starfall, `STARSPUN_SET_CHANCE` |
| The Tidemail | the deep sea's legends, vaults and hoards (`ELTHERIC_CHANCE`) |

Each is rolled after everything its event's spoils already roll, so earlier rolls never move.

**The Sigil Broker** (`src/systems/sigil/sigilBroker.js`, `src/ui/brokerWindow.js`). A Daedra trader held caged at each
breach's rite circle, freed when its faithful fall, standing until the Wrath. Her stock is the UTC day's, minted from the
day alone from fixed tables, so everyone sees the same pieces. Each character buys each offer once a day; the record
rides the save. Prices (`BROKER_PRICES`) in Deadlands Embers: a world-set piece 4 (Legendary 6), a set weapon 6, a
Regalia piece 12. Every piece is known, of a finer make, fresh at Faint. Once an account an arena week she sells a
Panoply piece for 20 embers, recorded by the account service (`server-account/src/egEconomy.js`). Embers and her wares
are bound: never traded, dropped or sold to a counter. A ware can be dismantled in the pack for `BROKER_DISMANTLE_SHARE`
of its price.

## Rules

- Sets come from any source, like weapons; boss kills may drop a boss-themed Aetheric set; the Broker trades embers for
  a daily stock (Mac).
- Tiers at 2 / 4 / 6 pieces (Mac).
- The pieces grow together: the set's stage is its lowest worn piece's (Mac).
- Sets work online, never in duels (Mac).
- Aetheric sits between Legendary and Artifact; a set's weapon counts as a piece; the Broker stands at each breach only
  while it stands, the same stock for everyone, one of each a player a day (Mac).
- The Broker's prices were doubled at Mac's word; embers and her wares are bound.
- The breach's Warden is outside every set power's reach: no reflect, cleave, nova or kill-trigger touches him.

## Daggerfall Unity

DFU has no sets, no Aetheric rarity and no Broker. Set pieces are built on DFU's own item templates and materials, and
Eventide casts DFU's own Chameleon effect. Departure: the Broker's stock reads fixed tables, never the player's level or
registered custom items, so every player sees the same shop.

## Code and tests

- `src/systems/sigil/sigil.js` - the sigil record, stages, chance law
- `src/systems/sigil/sigilSets.js`, `src/systems/sigil/setReach.js` - every set's tiers and numbers, counting, catch-up
- `src/systems/aetheric.js` - Aetheric records and each event set's roll
- `src/systems/sigil/sigilBroker.js`, `src/ui/brokerWindow.js` - the Broker's stock, sales and dismantling
- `test/systems/sigil/set1_law.test.js`, `test/systems/set3_powers.test.js` - the law, the powers
- `test/systems/set4_drops_growth.test.js`, `test/systems/sigil/setcatchup.test.js` - drops, growth, catch-up
- `test/systems/set6_aetheric.test.js`, `test/systems/item/set7_broker.test.js` - Aetheric, the Broker
- `test/systems/auditsetsonline.test.js` - sets online, asleep in duels

## Open

- No server checks a set piece, as none checks a sigil: a forged save can carry one.

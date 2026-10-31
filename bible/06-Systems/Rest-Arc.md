# Rest

Online, a rest is an act at a rest point, not hours on a dial. The player faces a lit fire, a bed or a laid Bedroll,
picks **Rest** on the loot plaque, holds still a few seconds, and wakes after one night. Offline, rest is DFU's rest
window, unchanged. The player meets it at campfires (their own, a dungeon's, a hearth), rented and owned beds, and the
R key.

## How it works

**Rest points.** A lit fire (a placed Campfire, a tent's fire, a dungeon's campfire, a world brazier or hearth), a bed
where DFU lets the player rest (a rented room, an owned house, a ship, a guild hall, a dungeon's bed), or a laid
Bedroll as the poor substitute. The R key rests at the point in reach, or says where one is needed. The rest window's
hours, "rest until healed" and loitering are gone online.

**The act** (`src/systems/rest/restAct.js`). The player holds still for `REST_CHANNEL_SECONDS` (6; a Bedroll 10). A
blow, a foe arriving, or the fire or Bedroll going interrupts it. The night is the timed rest's own `RestSession` run in
one step: the character's own clock moves eight hours, so every system that reads the character's time (spells,
diseases, needs, rooms, training, guild waits) sees a normal eight-hour rest. The resting encounter roll still rides
each sub-tick, and an ambush breaks the night at the hour it lands.

**The night interval.** A night passes at most once every 120 minutes of the character's clock, about ten real
minutes of play (`NIGHT_INTERVAL_MINUTES`). A rest inside it is a short rest: it heals and pays the sleep need, but no
clock moves, nothing ages and no encounter rolls. A fire is a place to recover, never a fast-forward button.

**What a night gives.** A night at a bed or a fire ends with full health, fatigue and magicka where the difficulty tier
prices it whole; a rough night on Hard keeps what its eight hours gave. A short rest heals in full where the tier
prices whole, otherwise half of what is missing.

**The Campfire** (template 541; `src/systems/survival/camp.js`, `src/scenes/camps.js`). Placed, rested at, cooked at
and picked back up. It holds 8 nights of fuel (`CAMPFIRE_USES`); a night its owner sleeps at it spends one, and
Firewood refuels it. Every new online character starts with one, and General Stores sell them. A Campfire left in a
dungeon comes back into the pack on leaving. It cannot be repaired.

**Dungeon fires** (`src/world/dungeon/dungeonFires.js`). Every dungeon stands permanent campfires by a deterministic
law: one by the entrance, one before the deepest reach, the rest spaced between, each on flat open floor clear of doors,
enemy and quest markers. They are the same on every client with nothing on the wire. They warm, cook, light and rest,
never burn out and cannot be picked up. Online, no wandering spawn stands within 15 m of one.

**Consumables** (`src/systems/rest/restItems.js`, templates 1700-1706): the Bedroll (10 nights), the Ember Jar (a fire
for one night), Firewood (refuels a Campfire), the Restorative Tonic, the Meditation Candle (magicka at the next
rest), Waking Salts (an hour awake) and the Sleeping Draught (a rough night slept as a bed's). They come from General
Stores and Alchemists, treasure piles and foes, online and offline.

**The party's night** (`src/systems/party/partyRestLaw.js`). Members within 15 m of a rester who sleeps a night are
carried into it and sleep the better of the rester's spot and their own. Nobody is carried in a tavern, temple or
guild hall. Members who press Rest together share one ambush roll. A member inside their own night interval gets a
short rest.

**Quest waits.** A rest never spends a quest's deadline online, and a quest's delay is cut short; the rule is on
`06-Systems/Quest-Arc.md`.

## Rules

- **Resting online is an act at a rest point, one night at a time** (Mac).
- **The Campfire is a reusable tool**; new players start with one, and shops sell more (Mac).
- **Dungeons get multiple strategic campfires** (Mac).
- **Consumables fill the gaps** where no fire stands (Mac).
- **A Field Cook's night at their own Campfire spends no fuel** (Mac; `camp.js` `fieldCookKeeps`).
- **Offline is untouched**: DFU's rest window and its ambushes.

## Daggerfall Unity

DFU's `DaggerfallRestWindow` rests by the hour, until healed, or loiters, and rolls an encounter each hour; the port
keeps it whole offline (`src/systems/rest/restSession.js`). Online the shared world clock cannot be moved by one
player, so the rest window would only fast-forward the character's own clock; the rest act bounds that to one night
per interval at a rest point. The night itself is DFU's session, so nothing it does is restated.

## Code and tests

- `src/systems/rest/restAct.js` - the act, the night, the short rest, the party marks
- `src/systems/rest/restSession.js`, `rest.js` - DFU's rest session and its rules
- `src/systems/rest/restItems.js`, `restItemRows.js` - the seven consumables
- `src/systems/survival/camp.js`, `src/scenes/camps.js` - the Campfire and placed camps
- `src/world/dungeon/dungeonFires.js` - the dungeon fire law; `tools/dungeonFireProbe.mjs` measures it on real data
- `src/systems/party/partyRestLaw.js` - the party's night
- `test/systems/rest/rest1_act.test.js`, `test/systems/rest/auditrestparty.test.js`,
  `test/systems/rest/fb1005_dungeonbeds.test.js`, `test/world/auditrest2_fires.test.js`

## Open

- Crafting recipes for the rest consumables (Bedroll, Firewood, the tonic, salts and draught) are not built.

# Loot: powers, the chase and the loop

The Loot arc builds on the rarity ladder (`bible/06-Systems/Loot-Rarity.md`) and gives found gear depth, a chase and a
use. Players meet it as affixes that do things, Legendaries with powers, champion foes, a line of light over a good
find, salvage into Welkynd Shards, the Reforge and the Legendary codex. Everything here hangs off the `loot-rarity`
setting; with it off, loot is Daggerfall Unity's. Later loot work is in `bible/06-Systems/Loot-II-Arc.md`.

## How it works

### Depth

- **Affixes lean to the item.** A skill affix favours the item's own skills (`SKILL_OWN_SHARE`, `SKILL_KIN_SHARE` in
  `src/systems/loot/lootRarity.js`).
- **Affixes that do things.** Beyond stat lines, `AFFIX_KINDS` includes elemental (a sear), leech, thorns, focus and
  slayer, each capped in `src/systems/loot/lootPowers.js` (`LEECH_CAP`, `THORNS_CAP`, `FOCUS_CAP`).
- **Legendaries.** `LEGENDARIES` holds thirty records, each with a power (`lootPowers.js`). A Legendary rolls Exalted
  `EXALTED_PER_MILLE` in a thousand: a variant with an extra line, not a new tier.
- **The roll seen.** The item card shows each line's band and marks a perfect roll.

### The chase

- **Signature drops.** A source's family weighs its own signature Legendaries `SIGNATURE_WEIGHT` to one. It steers
  which Legendary drops, never whether.
- **Champions** (`src/systems/champions.js`). From level `CHAMPION_MIN_LEVEL`, a foe is a champion
  `CHAMPION_PER_MILLE` in a thousand: a trait, a name, `CHAMPION_HEALTH` times the health and `CHAMPION_DAMAGE` the
  damage. A champion rolls its own loot as a source.
- **The drought** (`src/systems/loot/lootDrought.js`). Every `DROUGHT_STEP` pieces taken below Legendary raise the
  source's own Legendary chance by `DROUGHT_STEP_MULT`, up to `DROUGHT_MAX_MULT` times. A Legendary resets it. It rides
  the save.
- **A plain foe's loot.** A foe with no title (not an elite, champion, revenant, named foe or boss) drops at most
  `PLAIN_FOE_LOOT_CAP` items, gold included, and an Elite Dungeon's ordinary foe at most `ELITE_DUNGEON_FOE_LOOT_CAP`
  (`src/systems/foeLootCap.js`). `spawnEnemyLoot` in `src/scenes/hostCombat.js` keeps a share of a plain foe's pieces.
- **Renown.** Online, the plain-foe buff (pieces kept, the ladder's chances, healing and Restore Power potions, rest
  supplies) scales with the roller's own Renown in the sigils' five stages: half, three quarters, all, five quarters,
  half again (`src/systems/renownLoot.js` `RENOWN_LOOT_QUARTERS`). Offline it is the whole buff.
- **The level gate.** A young character finds Rare and Legendary gear less often, and more as they grow
  (`src/systems/loot/lootLevelGate.js`).
- **A Legendary counts once.** A second worn copy of the same Legendary record adds nothing (`countedPieces`).

### The loop

- **Salvage** (`src/systems/reforge.js`). A graded Magic or better piece breaks into Welkynd Shards
  (`SALVAGE_SHARDS`). Never an artifact, a quest item, a bound, worn or locked piece, or a piece the ladder did not
  grade. The shard is bound.
- **The Reforge**, at the Mages Guild: one line of a Magic or Rare piece, or an Exalted's extra line, replaced by a
  line of another kind for shards and gold. The price doubles with each reforge on the piece. The hone and sockets
  share the window (`src/ui/reforgeWindow.js`).
- **The Imbue**, at the same window: a piece raised one tier for a flat price at any level, plain to Magic or Magic
  to Rare, never to Legendary (`IMBUE_PRICE`). The piece is marked `imbued` and sells as the piece it was (Dudey).
- **The codex** (`src/systems/loot/lootCodex.js`) records each Legendary found. A Rare of the same group can take a
  found Legendary's power as an imprint and stays Rare.
- **A line of light** stands over a body or pile holding Rare or better, in its tier's colour
  (`src/scenes/lootLines.js` `createLootLines`, drawn in every mode).

## Rules

- The source sets the odds, never the player (Mac). See Open for the level gate and Renown.
- Shops and quest rewards do not roll. The Reforge works on a piece the player owns; nothing is rolled for sale (Mac).
- A craft reaches Rare at most; an imprinted Rare stays Rare (Mac; `bible/06-Systems/Professions-Arc.md`).
- Loot never enters the Stores; the shard is a bound pack item (Mac).
- A set works online only, never in a duel. Affixes and Legendary powers work offline and online, and never on a player
  (Mac; `bible/11-Multiplayer/Sigil-Sets.md`).
- Off is DFU exactly: with `loot-rarity` off no field is written, no champion stands, no tier line is drawn, no shard is
  minted (Mac).
- The Aetheric is never rolled; the Exalted is a Legendary's variant, and the ladder keeps its six tiers (Mac).
- A plain foe drops at most three items, gold included; an Elite Dungeon's at most five; champions are not plain (Mac).
- Renown-scaled loot: half, then all, then half again; the roller's own Renown; offline keeps the whole buff (Mac).
- Fortune's Favour counts once and multiplies by 1.25 (the owner).
- LOOT-GATE: the level gate's numbers are never published (Dudey).

## Daggerfall Unity

DFU rolls loot from its tables (`LootTables`, `DaggerfallLoot`) with no rarity, affixes, champions or caps. Every rule
above is a departure, and each is off when `loot-rarity` is off. The plain-foe cap reads DFU's own ladder output and
keeps a share of what it made.

## Code and tests

- `src/systems/loot/lootRarity.js` - affixes, Legendaries, the Exalted, signatures, Luck, the imprint line
- `src/systems/loot/lootPowers.js` - Legendary powers and the doing affixes
- `src/systems/loot/lootDrought.js` - the drought
- `src/systems/loot/lootLevelGate.js` - the level gate
- `src/systems/loot/lootCodex.js` - the codex and imprint
- `src/systems/champions.js` - champion foes
- `src/systems/foeLootCap.js` - the plain-foe cap and the corpse kit
- `src/systems/renownLoot.js` - Renown scaling
- `src/systems/reforge.js` - salvage, the Reforge, the hone
- `src/scenes/hostCombat.js` `spawnEnemyLoot` - the body's loot chain
- `src/scenes/lootLines.js` - the lines of light
- `test/systems/rf2_spawnloot.test.js` - the plain-foe keep
- `test/systems/loot/foxstack.test.js` - a Legendary counts once

## Open

- LOOT-GATE (Dudey) holds Rare and Legendary back by the roller's level, and Renown scales the plain-foe buff by the
  roller's Renown. Both move odds by the player, against Mac's "the source sets the odds"; awaiting Mac's ruling.
- A Master crafter makes a Legendary-tier piece with no record or power (`src/net/masterLaw.js`, MASTER-ART), against
  Mac's "a craft reaches Rare at most"; awaiting Mac's ruling.

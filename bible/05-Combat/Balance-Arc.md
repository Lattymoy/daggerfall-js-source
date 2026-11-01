# Balance

The port's difficulty laws: where a foe's threat comes from, one rule for every striker, what the curses and the loot
may do, and how the world answers a growing hero. Mac asked to raise the difficulty without a band-aid: no flat
multiplier on every foe's health. Each law below removes a measured cause or extends a law the port already keeps.

## How it works

- **The sharp edge rides the wear.** In the Physical Combat overhaul (`src/combat/pcaao.js`), a weapon or armour
  piece above 75% condition strikes or reduces at its own value unless the mod's equipment wear
  (`equipmentDamageEnhanced`) is on; the bands below 76% (the cost of worn gear) always stand. Both condition functions
  take a `sharpEdge` flag their callers set from the module.
- **One rule for every striker.** Every striker's to-hit takes its weapon skill at x1.5, every striker's crit is
  rolled at `crit / (4 - luckTerm)`, and a landed crit multiplies the blow by `1 + floor(crit / 5) * 0.05` and adds
  `floor(crit / 4)` to hit. Without the crit module every striker rolls the classic `crit / 3`. The armour term stays
  the mod's.
- **The place sets the threat** (`PLACE_THREAT`, `placeVeteran`, `wildernessThreat` in `src/systems/skillSoftcap.js`).
  The loot ladder's dungeon tier (`DUNGEON_RARITY_TIER`, `src/systems/loot/lootRarity.js`) also scales a dungeon's
  foes: nothing at tier 4 (a town, a mine, a cave), the whole veteran row at 18 (a Dragon's Den): x2 health, x1.25
  damage, +10 skill for a full-share foe. A monster's share grows with its base level, so a rat stays a rat. The wilds
  stand at tier 5 by day and 7 at night. Towns, interiors and the port's own stages never scale. With Master Skills,
  the greater of the place's and the player's veteran layer applies.
- **Offline defaults.** Elites stand offline wherever the loot ladder stands (`elitesAllowed`,
  `src/systems/eliteFoes.js`) and compound with the place. The Enhanced AI (`enhanced-ai`, pref `enhancedAI`) is on by
  default and forced on online. A death that respawns, online or offline, takes a tenth of the gold carried, rounded
  down (`deathGoldLoss`, `src/systems/deathPenalty.js`); a death with no rise takes nothing (Mac).
- **The hero's threat** (`HERO_THREAT`, `heroThreat`, `heroThreatOf` in `src/systems/heroThreat.js`). Each level past
  10, to 30, a foe's blows land x1.07 and its health x1.04; each Renown past 15, to 50, x1.01 and x1.005, compounding.
  It answers three quarters of the hero's measured growth, mostly in the blow. It stands while the loot ladder does; a
  mentor's Renown is not read; a puppet takes the blows only.

## Rules

- No band-aid: every change removes a cause or extends an existing law (Mac).
- **A blow paid back never kills.** Thorns and Spite never take a foe's last point (`paidBack`,
  `src/systems/playerDoor.js`); the kill is the player's (Mac: make the best balancing decisions).
- Thorns pay back at most `THORNS_CAP` (10) a blow; a weapon's leech sums to at most `LEECH_CAP` (10)
  (`src/systems/loot/lootPowers.js`). Troll's Blood and Vampiric Effect are retired from the Rare draws; pieces that
  drew them keep them. Open Hand's second blow lands for half.
- **The curses.** A lycanthrope's DFU advantages apply only while transformed (`lycanthropeAdvantages`), and one change
  a day heals (`morphHeals`, `src/systems/lycanthropy.js`) (the owner).
- The beast's claws meet no metal gate, as DFU's bare hand (the owner reverted the silver claws).
- Worn plate gauntlets add their metal's damage modifier to a beast's claw hit, never below the bare claws, with no
  to-hit or gate (`clawMetalDamage`, `src/combat/clawMetal.js`) (the owner).
- A vampire is -20 bare in the street's sun, 0 hooded there, and DFU's +20 out of the sun, hood or not
  (`vampireStatMod`, `src/systems/vampirism.js`) (Mac).
- A spell notes its foe, so a school past 100 learns by the foe it fights; online, Destruction's climb past 100 lands
  its damage-health effects harder (`src/systems/spell/spellPower.js`) (the owner: Destruction needs a buff).
- A player's bare-handed blow reads the port's blow modifiers (`weaponBlowMods`, `src/systems/entityMods.js`) as a
  weapon's blow does, in both cores (the owner).
- Every short blade handles as a dagger in the swing law (`SWING_SHORT_BLADE`) (the owner).
- Both bows are one point higher at each end (Short Bow 5-17, Long Bow 5-19, `src/characters/weapons.js`); a bow takes
  the overhaul's two-handed strength term; a shaft flies at `ARROW_FLIGHT_SPEED`, 1.35 times a spell's
  (`src/systems/spellcast.js`) (the owner).
- No backstab is read off an arena rival or a gate body: their stand-ins carry no facing.

## Daggerfall Unity

Departures from DFU and the ported overhaul: the shared to-hit and crit rule, the condition bands' gate, the place
and hero scaling, offline elites, the curse changes, the gauntlet claws, the vampire's hood, the bows' damage and the
shaft's speed. DFU's foes never scale past their row.

## Code and tests

- `src/combat/pcaao.js` - the overhaul's hit, crit and condition laws
- `src/systems/skillSoftcap.js` - place threat and Master Skills layers
- `src/systems/heroThreat.js`, `src/systems/eliteFoes.js` - hero threat, elites
- `src/systems/loot/lootPowers.js`, `src/systems/playerDoor.js` - loot caps, paid-back blows
- `src/systems/lycanthropy.js`, `src/systems/vampirism.js`, `src/combat/clawMetal.js` - the curses
- `test/systems/bal_arc.test.js` - the first four laws by execution
- `test/systems/bal5_blowback.test.js`, `bal6_curses.test.js`, `bal7_loot.test.js`, `bal9_destruction.test.js`,
  `bal11_hero.test.js` - the later laws

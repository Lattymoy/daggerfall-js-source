# Fixed PvE - the world sets the foe (FIXED-PVE, 2026-10-28)

The PvE overhaul replaces player-scaled foes with fixed ones: a foe's level, health and blow come from its own
template, never from the player who meets it. This page is Stage 2 of twelve: the data layer. Nothing in the game
reads it yet - `src/systems/pve/pveSwitch.js` `fixedPveOn` is off, and every foe stands as it does today. Daggerfall
Unity has no templates: its monsters stand at their row and its class foes at the player's level
(`EnemyEntity.SetEnemyCareer`). A departure: Ledger A (FIXED-PVE).

## 1. The pieces

| Piece | Module | What it holds |
|---|---|---|
| Species | `pveSpecies.js` | A body and what it can draw: bow frames (`shoots`), a spell list (`casts`), flying, water. The 60 vanilla bodies; 39 named creatures with no art stand as candidates and never spawn |
| Category | `pveCategories.js` | Normal, Strong, Elite, Champion, Boss, Raid Boss: health and blow factors over a Normal foe, on the reference player line |
| Role | `pveRoles.js` | 9 combat roles (a stance and a target for `ai/tactics.js`, a share of health and blow) and 13 noncombat roles |
| Ability | `pveAbilities.js` | Abilities on systems the game has: tactics gap closers, boss traits, a body's classic spell list, heals |
| Disposition | `pveDisposition.js` | 7 states, 5 wildlife ways, the services a peaceful creature offers |
| Template | `pveTemplates.js` | One gameplay variant: species, level 1-45, category, 1-2 roles, abilities, disposition, faction, kit metal |

## 2. The numbers

The reference player is a planning line: the blow and health a player of each level brings in that level's band of
gear (`REFERENCE_PLAYER`). A Normal foe falls to it in 5 blows (`NORMAL_BLOWS`) and needs a fifth more to fell it
(`PLAYER_EDGE`, 10-30%). Elite and above take the edge away. Roles combine by their mean, so two roles never make a
stronger foe. A group weighs the square root of each member's health times blow over a Normal's, summed: four Normal
foes weigh four players. Every value is a starting value for Stage 3's reference builds to measure.

## 3. The validator

`templateProblems` refuses a template whose role its body cannot draw (an Archer on a body with no bow frames), an
unknown species, role, ability or state, a level outside 1-45, more than two roles, two that clash, two complex ones,
and a hostile creature that offers a service. `groupProblems` refuses unknown members and a leader who is not one.
The tests: `test/systems/pve/pve_core.test.js`.

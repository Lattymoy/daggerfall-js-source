# Fixed PvE - the world sets the foe (FIXED-PVE, 2026-10-28)

The PvE overhaul replaces player-scaled foes with fixed ones: a foe's level, health and blow come from its own
template, never from the player who meets it. This page holds Stages 2 and 3 of twelve: the data and the balance tools. Nothing in the game
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

The reference player is a planning line: what a swing lands and the health it can lose, for a player of each level in
that level's gear (`REFERENCE_PLAYER`). Stage 3 set it to the middle of the six reference builds, and a test holds the
two together. A Normal foe falls to it in 5 swings (`NORMAL_BLOWS`) and takes a fifth longer to fell it
(`PLAYER_EDGE`, 10-30%). A foe strikes every `FOE_BLOW_S` (the tactics brain's swing and recovery, 1.9 s) and the
player every swing of its Speed, so the blow carries the gap.

Each category names its party, its length in swings and the margin that party keeps. Health is the party's swings.
The blow fells the party one by one in that time, and a party that loses a player deals less, so what it deals by
the last fall is (party + 1) / 2 of its full rate. Roles combine by their mean. A group weighs the square root of
each member's health times blow over a Normal's, summed.

## 3. The validator

`templateProblems` refuses a template whose role its body cannot draw (an Archer on a body with no bow frames), an
unknown species, role, ability or state, a level outside 1-45, more than two roles, two that clash, two complex ones,
and a hostile creature that offers a service. `groupProblems` refuses unknown members and a leader who is not one.
The tests: `test/systems/pve/pve_core.test.js`.

## 4. Stage 3: the builds, the score and the simulator

| Piece | Module | What it holds |
|---|---|---|
| Builds | `pveBuilds.js` | Melee, Archer, Destruction Mage, Defensive Fighter, Battlemage, Hand-to-Hand, at six tiers of skill and gear (levels 1, 10, 20, 30, 40, 45). The top tier holds the live hits of a fully geared build: 1,550 for a two-hander or a bow, 1,310 a fist, 1,375 a cast under the mages' rework. Tempos come from the swing law, the bow's cooldown and the cast clock |
| Profile | `pveProfile.js` | Offense (damage a second), defense (health over guards), sustain, control, mobility; the Combat Score; one build against one template, and a danger word |
| Simulator | `pveSim.js` | A party against foes: two melee and two ranged tokens a player, the boss traits, heals, summons, shield walls, rage, seeded |
| Report | `tools/pveBalance.mjs` | Every build alone against Normal and Strong foes, and every template against its party, beside a plain foe of its category |

The Combat Score is the square root of offense times defense: no weight to tune. It is advice only. No module that
makes a foe imports it, and the tests hold that. The danger word reads the margin, and names what it cannot count:
armour, magicka, and abilities it does not model.

What the first report found: archers and mages trail the other builds alone below level 40, as the bow's cooldown
and cloth health stand today. Unyielding and Vigil make every foe past level 40 easier for a set wearer. A lone
healer is weak, and berserker rage and the raid leader's seven abilities run hot. Boss blows come out small, because
the builds bring no healing yet. Stage 9 adds that. The tests: `test/systems/pve/pve_sim.test.js`.


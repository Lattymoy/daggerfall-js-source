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
| Builds | `pveBuilds.js` | Melee, Archer, Destruction Mage, Defensive Fighter, Battlemage, Hand-to-Hand, at six tiers of skill and gear (levels 1, 10, 20, 30, 40, 45). Each tier's hit is the live formula's mean (`tierBlow`): about 1,650 a Dai-Katana or a long bow, 1,410 a fist and 1,390 a cast under the mages' rework at the top. Tempos come from the swing law, the bow's cooldown and the cast clock |
| Profile | `pveProfile.js` | Offense (damage a second), defense (health over guards), sustain, control, mobility; the Combat Score; one build against one template, and a danger word |
| Simulator | `pveSim.js` | A party against foes: two melee and two ranged tokens a player, the boss traits, heals, summons, shield walls, rage, seeded |
| Report | `tools/pveBalance.mjs` | Every build alone against Normal and Strong foes, and every template against its party, beside a plain foe of its category |

The Combat Score is the square root of offense times defense: no weight to tune. It is advice only. No module that
makes a foe imports it, and the tests hold that. The danger word reads the margin, and names what it cannot count:
armour, magicka, and abilities it does not model.

Each build is the best custom class for its job, never the base game's: 30 health a level, every attribute first,
its skill and Critical Strike primary, expert in its weapon. It wears the gear it would build, climbing slowly: spell
potency to 30%, cast speed to 45%, and the Imprinted Unyielding and Vigil from level 30 (`loot/lootCodex.js`).
Section 5's two laws are in the builds. What the report found: alone against a Normal foe of its level, each kind
wins 69-94% below level 30 (the fist 47% at level 1, its roll still small), and every kind wins all of them from 30. A lone healer is
weak, and berserker rage and the raid leader's seven abilities run hot. Boss blows come out small, because the builds
bring no healing yet. Stage 9 adds that. The tests: `test/systems/pve/pve_sim.test.js`.

## 5. The archer's bow and the mage's cast (BOW-LAW, PVE-CAST, 2026-10-29)

Two departures that run in the game now, so that an archer and a mage keep up with a swordsman.

| Law | Where | What it does |
|---|---|---|
| BOW-LAW | `characters/weaponStates.js` `bowReloadSeconds`, read by `combat/playerWeapon.js` and the Weapon Widget | DFU's bow waits 1.4-1.6 s a shot at any Speed (`GetBowCooldownTime`), and nothing quickens it. A player's bow now reloads on the swing law: a two-handed swing of the bow's weight against Strength, the pace powers and the 0.45 s floor, less the draw and the loose. A foe's and a stand-in's keep DFU's line |
| PVE-CAST | `systems/spell/pveCast.js`, read by `systems/effects.js` `casterDamageScaled` | MY damage spell at a foe that is no player, online: a landing is held to Destruction x0.15 (live, gear counted) plus a start of 15 at level 1, gone by 30. Then it crits as a blow does and lands x1.1. The loot's potency still counts. The school past 100 does not, because the hold reads the skill. Duels, sieges, the Wild Zone and the arena are untouched |

The tests: `test/systems/pve/pve_fixes.test.js`.


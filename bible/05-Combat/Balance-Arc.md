# The Balance arc - the place sets the threat, one rule for every striker (BAL1-BAL11)

> Design page, written from the measurement before the code (2026-10-10). The slices ship in one pull request, in this
> order, each verifiable without the next. Where this page and a shipped slice disagree, the slice's own record
> (section 10) is what runs.

## 1. What Mac asked for

Mac, 2026-10-09: *"I also want to talk about general balance to bring up the difficulty without implementing a band
aid fix"*. The answer was a measurement (section 2) and four structural changes, offered as a list: fix the two
interactions between the vendored combat overhaul and the port's own wear; make the overhaul's rules the same for
every striker; let the place set the threat, the way the source already sets loot; and decide the offline defaults
(the smarter AI, elites, a real cost for dying). Mac, 2026-10-10: *"Do everything and be extremely detailed"*.

A band-aid is a multiplier on every foe's health. Nothing here is one: each change removes a cause the measurement
found, or extends a law the port already keeps (the loot ladder's "the source sets the odds, never the player") to
the one place it did not reach.

## 2. What was measured

Two lanes, both read-only, both through the real code: an analysis of every difficulty lever (who is on by default,
what each multiplies), and a deep read of the Physical Combat And Armor Overhaul (`combat/pcaao.js`, PCO1 - on by
default since MO1) with simulations through its own `pcaaoAttackDamage`, 40,000-60,000 swings a cell. The builds
were stated, not taken from a save: a level-12 player (STR 70, AGI 65, END 65, SPD 60, LUC 55, WIL 50, health 130;
Long Blade 60, Critical Strike 40, Dodging 45, every other skill 40) and a level-20 one (STR 80, AGI 75, END 75, SPD 70,
LUC 60, WIL 55, health 210; Long Blade 85, Critical Strike 65, Dodging 65, every other skill 50), each in seven pieces
of steel or ebony (no shield) and a fresh longsword; a monster's attributes at 50 (MONSTER.BSA's own values are not in
the tree). Melee alone - a Lich's spells are not in any table here. The causes, ranked by what they move:

1. **The overhaul's hit and crit rules favour the player.** `pcaaoAttackDamage` gave the player half his skill again
   to hit (`skill * 1.5`) and a foe its skill alone; `pcaaoCriticalStrike` rolled the player's crit at
   `crit / (4 - luck)` and a foe's at `crit / (5 - luck)`, and a landed crit multiplied the player's blow by up to
   x2.0 (+25 to hit) and a foe's by up to x1.5 (+10). A foe's Long Blade and Critical Strike are the same skills as
   the player's. The mod's own design (AUDIT PCO1 checked "the 150% skill" and "the two critical arms"), and a
   departure from DFU, which reads both sides alike.
2. **A reward with no upkeep.** `pcaaoAlterDamageBasedOnWepCondition` strikes with a blade at x1.3 at 92% condition
   and over, x1.1 at 76-91%; `pcaaoAlterArmorReducBasedOnItemCondition` lets a piece over 92% reduce to 0.85. The mod
   pays that for keeping gear sharp against its own fast wear (`equipmentDamageEnhanced`). The port ships that wear
   OFF (WEAR-VANILLA) and holds every weapon on one pool (WEAPON-POOL: the Warhammer's 1,600 through the material
   ladder - a steel longsword's 2,400): a fresh steel longsword took 128
   landed hits on an Orc Warlord to fall under 92% and 417 to fall under 76% (the mod's wear: 57 and 186), and a
   monster's natural blow wears no armour at all with the module off - so the edge was every fight's. AUDIT
   WEAPON-POOL recorded it and left it ("an iron dagger strikes at x1.3 for 65 blows of 20 damage (it was 3)").
3. **Offline, the world never answers.** SOFTCAP2's veteran layer (`systems/skillSoftcap.js` ENEMY_SCALING: up to
   +10 skill, x2 health, x1.25 damage) reads the PLAYER's best skills, and only with Master Skills in force -
   `masterSkillsActive` is always true online and the player's own switch offline, off by default. Offline, every
   foe in the deepest dungeon was DFU's own.
4. **The hard content is online's.** Elites (x5 health, x3 damage) stood online alone (`eliteFoes.js`
   elitesAllowed); the Enhanced AI is forced on online and off offline (`features.js` 'enhancedAI', `initial:
   false, online: true`).
5. **Failure costs little offline** (section 6).

Checked and found sound, so not changed: the overhaul's natural damage resistance has no lost clamp - the C#
computes `Mathf.Clamp(-0.2, 0.2)` and discards it, and the port's `liveStat` holds every attribute to 0..100, so the
term can only fall in [-0.2, 0.2] (three attributes of 100 reach exactly 0.2). The armour term is section 4's.

The baseline (the port as it shipped, PCO1 and Meaner Monsters on) - damage dealt a swing / taken a foe's attack, and
their ratio:

| fight | dealt / taken | ratio |
| --- | --- | --- |
| level 12, steel, an Orc Warlord | 8.51 / 9.10 | 0.93 |
| level 12, steel, an Orc | 14.37 / 2.58 | 5.57 |
| level 20, ebony, an Orc Warlord | 22.36 / 5.01 | 4.46 |
| level 20, ebony, a Lich | 20.61 / 7.41 | 2.78 |
| level 20, ebony, an Ancient Lich | 18.60 / 9.40 | 1.98 |

## 3. BAL1 - the sharp edge rides the wear

THE LAW. The condition bands over 75% are the mod's wear's reward, and they stand while the mod's wear stands. With
`equipmentDamageEnhanced` off (the port's default), a weapon at 76% and over strikes at its own damage (the normal
band, x1) and a piece of armour at 76% and over reduces at its own factor (1). The bands under 76% - the cost of worn
gear - stand whatever the wear: a blade at 41-60% still strikes at x0.85, a piece at 6-15% still lets x1.35 through.
`pcaaoAlterDamageBasedOnWepCondition` and `pcaaoAlterArmorReducBasedOnItemCondition` take a `sharpEdge`, and every
caller hands them `modules.equipmentDamageEnhanced` (the blow, the armour rows' `condOf`, the stats card's
`combatStats.js` damage).

Why not switch the condition module off with the wear (the other way the measurement offered): that would forgive
worn gear its cost too. The edge is a reward for upkeep; the cost is the world's, and DFU's own (a broken blade is
worse than a whole one).

What moves with it: a fresh blade's swing about 23% less, and about 18% more gets through a fresh piece (1 / 0.85;
measured, a foe's blow 19-22% more). KIT-CEILING's
reading ("the sharp edge above is a smith's") holds while the mod's wear is on; off, there is no edge above a kit's
three quarters for a smith to restore - a smith's repair is the condition back, as DFU's is.

## 4. BAL2 - one rule for every striker

THE LAW. Every striker's chance to hit takes its weapon skill at x1.5 (`Math.ceil(skill * 1.5)`), every striker's
crit is rolled at `crit / (4 - luckTerm)`, and every landed crit multiplies the blow by `1 + floor(crit / 5) * 0.05`
and adds `floor(crit / 4)` to hit; without the crit module, every striker rolls the classic `crit / 3` for
`+crit / 3`. A duel was always both players' and does not move. A departure from the mod, recorded here and in the
PCAAO page's departures.

THE ARMOUR TERM STAYS THE MOD'S. The player reads a flat 100 (less the enchantment channels and the port's armour
points - AUDIT SET P-M1), a class enemy a flat 60, a monster its part's value. That is the mod's premise - "Armor no
longer increases your chance to avoid damage, but instead reduces the damage that you do take" - and every even
version of it measured EASIER: a monster reading 100 wipes out its hide and the Meaner Monsters edit tuned against
it (the player's hit on an Orc Warlord 57% -> 97%); a class enemy reading the player's rule took a level-12 player's
hit on a Knight from 62% to 97%. The one double benefit in the term is the class enemy's (a flat 60 to dodge AND its
armour reducing), and it is the foe's, not the player's.

What moves: against a foe already at the 97% clamp (an Orc Warlord, a Lich at skill 100), nothing from the to-hit -
the crit carries it (damage taken about 14% more); against a lower foe the to-hit carries it (a level-20 player with
Dodging 65: a rat's hit roll 43% -> 62%, an Orc's 69% -> 97% - the roll alone; a monster's reflex gate still lets
half its attacks through to it, so a rat's blow lands 21% -> 31% of its tries).

FULL-GUARD (FIELD BUGS 2026-10-11b, the Discord's "One shot bug"; Mac: "No kill from full health"). With BAL4's offline
elites (x3) and the Enhanced AI's slams (x1.75) on top of BAL2's crit, nothing capped one blow: a level-12 elite's
claymore slam killed a 110-health player from full in about one landed slam in ten. BAL2 stands; the damage door now
leaves a player at full health at 1 when one foe's blow would kill them (`characters/playerEntity.js` hurtPlayer),
before any death save, and the next blow kills as it always has. A fall, a spell or a world boss's strike is no blow.
`01-Overview/bugs/Field-Bugs-2026-10-11b.md`.

## 5. BAL3 - the place sets the threat

THE LAW. The loot ladder grades every place a foe stands in (`lootRarity.js` DUNGEON_RARITY_TIER - a Cemetery 3, a
mine or a natural cave 4, a Prison, a Spider Nest or a Scorpion Nest 5, a Human Stronghold or a Ruined Castle 6, a
Harpy Nest 7, a Giant Stronghold 8, a Crypt or an Orc Stronghold 9, a Laboratory 10, a Barbarian Stronghold 11, a
Coven 13, a Vampire Haunt 14, a Desecrated Temple 15, a Dragon's Den or the Volcanic Caves 18), and a corpse's or a
pile's odds are that place's. The veteran layer now reads the same grade: the place's veteran is
`clamp((tier - 4) / (18 - 4), 0, 1)` (`skillSoftcap.js` PLACE_THREAT, placeVeteran) - nothing at a town's or a cave's
4, the whole veteran row at a Dragon's Den's 18 - times the foe's own share (`foeShare`: a monster by its base level
from 4 to 12, so a rat stays a rat; a class foe in full). The wilderness stands as the dungeons it reads like -
SOFTCAP5's own equivalence, "by day like a cemetery or a ruined castle, at night like a prison or a harpy nest" - at
tier 5 by day and 7 at night (`wildernessThreat`). Towns, interiors and `exterior.js`'s fixed city never scale (the
two seams never run there), nor the port's own stages that wear a Crypt's type for want of one - the arena's floor,
the gate's court, the Shattered Hour (AUDIT BAL). A dungeon's puppets (another client's foes) take the place too - it is
every client's - and none of the owner's standing; their health is the owner's record's (AUDIT BAL). Offline, with
Master Skills off, at any level, mentoring or not.

THE GATE IS THE LADDER'S. The grading is the loot ladder's, so the layer stands while the ladder does (`lootRarityOn`,
on by default, forced on online - LR5): the ladder off, the place hands 0 and a dungeon's foes are DFU's again, as
the ladder's champions (LOOT7) and now its elites (section 6) are. The hosts read the switch at every spawn, so
turning the ladder off mid-dungeon reaches the next foe built. `skillSoftcap.js` stays pure (it cannot import the
ladder: `skills.js` imports it and the ladder imports `skills.js`) - the host hands the place's veteran in, or 0.

| tier | places | health | damage | skill |
| --- | --- | --- | --- | --- |
| 4 | a town, a mine, a natural cave | x1 | x1 | +0 |
| 5 | a Prison, a Spider or Scorpion Nest; the wilds by day | x1.07 | x1.02 | +0.7 |
| 7 | a Harpy Nest; the wilds at night | x1.21 | x1.05 | +2.1 |
| 9 | a Crypt, an Orc Stronghold | x1.36 | x1.09 | +3.6 |
| 11 | a Barbarian Stronghold | x1.50 | x1.13 | +5.0 |
| 14 | a Vampire Haunt | x1.71 | x1.18 | +7.1 |
| 15 | a Desecrated Temple | x1.79 | x1.20 | +7.9 |
| 18 | a Dragon's Den, the Volcanic Caves | x2.00 | x1.25 | +10 |

(At a full-share foe; the foe's level is left alone, so its spells, loot and gear are not scaled again - what it
teaches rises with its skill, `challengeLevel`, as SOFTCAP2's does.)

THE MASTER SKILLS LAYERS KEEP THEIR PLACE. `progressionScaling(standing, dShare, fShare, place)`: the veteran layer is
the place's (`fShare * place`) or the player's veteran in this kind of place (`dShare * fShare * veteran`, SOFTCAP2's
own), whichever is more - so no Master Skills player finds a place easier than before - and the overcap (the climb
past 100) is the player's alone, as it was. One writer still: `enemyEntity.js` applyProgressionScaling. The two
seams are the ones SOFTCAP already runs through: `dungeonContext.js` applyProgressionScalingTo (every dungeon foe,
`worldModes.js`'s dungeon mode among them; the dungeon's tier read once at the build, every client alike) and
`exteriorFoes.js` spawnFoe's wilderness arm (`world.js`'s streamed wilds; never a puppet, an ally, or a foe on a
location's ground).

THE FOUR HOSTS. `scenes/dungeonContext.js` wired (the dungeon's tier); `scenes/world.js` wired (the wilds, through
`exteriorFoes.js`); `scenes/worldModes.js` wired for its dungeon mode (the same context) and FLAGGED for its
interiors - a building is a town's ground, tier 4, so nothing scales there by design; `scenes/exterior.js` FLAGGED -
the fixed city is a town's ground (its pool passes no `inLocation`, so the wilds' arm never runs), tier 4.

## 6. BAL4 - the offline defaults

Section 2's fourth and fifth causes: the hard content was online's, and failing cost little offline. Three changes,
each a default the port already ships online or a rule it already keeps, extended to the lane it skipped.

**THE ELITES.** `eliteFoes.js` elitesAllowed: online always (an online page, a host in a room), and offline wherever
the loot ladder stands. An elite's drop is the ladder's (eliteLoot's tiers) and its gate is the champions'
(`systems/champions.js`), so with the ladder off no foe is ever one - DFU's lane. Nothing else about them moves:
ELITE-RATES' one foe in twenty in the open world (off `Math.random`, never the encounter's dice), at most one in a
plain dungeon one time in five and three or four in an Elite Dungeon (a pure pick by the dungeon's id), never under
level 3 (ELITE-FLOOR - offline a class foe by the level it is built at, AUDIT BAL; online the pick stays every client's,
a class foe's level each client's own), never the watch, an ally, a quest's foe or a retype; a search's waking dead
stand as one only where elites do (AUDIT BAL). They compound with the place: the hosts
promote first (x5 health, x3 damage), then the place scales the elite (an elite in a Dragon's Den stands at x10
health, x3.75 damage) - as an elite and the Master Skills veteran always compounded online. Offline, the rule the
code carried in Mac's words ("elite enemies are online mode only") stood until this arc measured that offline fielded
nothing past DFU's own foes; Mac's 2026-10-10 "Do everything" (of "smarter AI and elites offline") is the word that
turns it. A save keeps its own: a dungeon's elites are the save's word on a load (AUDIT BAL), as the open world's
always were.

**THE ENHANCED AI.** `features.js` 'enhanced-ai': `initial: true` (it was false - "DFU's classic motor is the 1:1
law"); `online: true` stands, so every room still forces it on. What it brings (`12-Enhanced-AI/`): attack tokens
and the ring (two swinging at once, the rest holding - a crowd is LESS deadly than the classic motor's, where every
foe swings), backing off and fleeing, archers keeping their range, telegraphed blows to stagger or punish, iron
blows that cannot be stopped, cover for sight and missiles, and the dungeon navmesh. Net difficulty is mixed by
design (TACT5's field report softened it: "New monster AI is painful"); it is turned on because it is the port's
game, played online by everyone, and the offline lane was the only place it was not.

The shelf (PREF1, `uiPrefs.js`): a shelf stamped since 2026-09-15 never stored the old default (a default is never
written), so the flip reaches it unasked - and a player who pressed it Off after pressing it On cannot be told apart
from one who never chose, which PREF1 already accepts for every default. An UNSTAMPED shelf materialised every
default as if chosen; the row shipped Off on 2026-09-14, one day before the stamp, so its `false` is the shelf's
writing and not an answer. `enhancedAI` joins `PREF1_ADOPT_NEW_DEFAULT` beside `lootRarity`: adopted once, never
again over a real choice. No `SHELF_REV` bump (the adoption reads the stamp's absence).

Pins that leaned on the old default without saying so (LR5's trap): `enemymotor` P17, FALL-HOLD and CRATE-FREE now
set the switch Off outright, their laws the classic motor's - and each has a brain-On twin (AUDIT BAL) that ticks the
tactics brain's clock as every host does. That clock is the foes' own time (`ai/tacticsClock.js`, AUDIT TACT A3/D1),
never the wall: a test that never ticks it holds the brain's timers and tokens still, which is what failed those three
with the switch On - not a defect players meet.

**A REAL COST FOR DYING OFFLINE.** Measured: an offline death cost nothing a save did not already hold. With Project
Legacy on (its default) an Enduring member rises (LEGACY2, 2026-10-05: the online respawn's own `respawnOnlinePlayer`
- half health, drains cleared, the nearest temple, town or graveyard, or the dungeon's door), and the rise took
Arkay's years alone (a Breton 5 of a 90-year span a death: fourteen rises, the fifteenth final) - and the ageless (a
vampire, a werewolf - AGELESS-CURSE) paid nothing at all. No XP, no skill, no gold, no item. The online rule was
written for exactly that gap ("Online, a death RESPAWNS you ... and that is free, which is the gap this closes" -
`deathPenalty.js`), and its reason for being online-only ("offline a death ends the run") stopped being true at
LEGACY2. So the rule is the respawn's now, not the lane's: an offline rise takes the same tenth of the purse -
rounded down, never the bank, never a letter of credit, capped at the purse, exactly what the death screen said.

Where: `ui/deathScreen.js` takes `rises`, a predicate the host hands when its reset asks Project Legacy first -
`world.js`'s street (`legacyHost.willRise`), `worldModes.js`'s buildings (`host.legacyWillRise`) and the dungeon the
mode machine builds (its opts' `legacyWillRise`). Legacy's outcome is decided before the screen goes up (its
`onDeath` runs first in `playerEntity.js` hearDeath), so the screen reads it once, states the tenth
(`stateDeathLoss`), and SAYS SO: the classic face's hint reads `ENTER rise` (riseHint), the enhanced face's plate
`Rise` and its line "Your body falls. The Bay is not done with you yet." - where both said "End the journey" and
"Your tale in the Iliac Bay ends here" over a death that raised the player (a screen that misled, found by this
measurement). `legacyDeathReset` no longer states 0 offline (the revenant's theft stays online's, `forgetLastSlew`);
Privateer's Hold's start-marker arm pays the tenth on every rise it takes. The fixed city and the standalone dungeon
hand no `rises` and never rise. Legacy off, or Bloodline's fall: the run ends (or the Succession opens) and nothing
is taken - there is no purse after it.

What it leaves: F11 on the screen still loads the last save (the port's own affordance) - the player pays in lost
progress instead of gold, and Arkay's years stay paid (Legacy writes them before the screen). Recorded, not built: a
gold cost tied to the Toll setting (two gold rules, and a setting labelled in years costing gold); wear on worn gear
at a death (a broken legendary, nothing on the screen to say it); skill-tally loss (unseen, two leveling systems,
and FormulaHelper is 1:1).

## 7. Before and after

The same fights, through the real `pcaaoAttackDamage` at the commit before the arc and in the working tree, with
BAL3's layer on the foe for the place it stands in (dealt a swing / taken an attack; ratio; swings to kill it;
attacks it takes to kill the player):

| fight (place, tier) | before | BAL1 + BAL2 | + BAL3 |
| --- | --- | --- | --- |
| L12 steel, an Orc Warlord (a Crypt, 9) | 8.51 / 9.10, 0.93; 12.1 / 14.3 | 6.56 / 12.35, 0.53; 15.7 / 10.5 | 6.33 / 13.56, 0.47; 22.1 / 9.6 |
| L12 steel, an Orc (a Human Stronghold, 6) | 14.37 / 2.58, 5.57; 3.8 / 50.4 | 11.11 / 3.62, 3.07; 5.0 / 35.9 | 11.11 / 3.64, 3.05; 5.0 / 35.7 |
| L20 ebony, an Orc Warlord (a Barbarian Stronghold, 11) | 22.36 / 5.01, 4.46; 4.6 / 41.9 | 17.16 / 6.99, 2.46; 6.0 / 30.1 | 17.16 / 8.01, 2.14; 9.0 / 26.2 |
| L20 ebony, a Lich (a Vampire Haunt, 14) | 20.61 / 7.41, 2.78; 5.3 / 28.4 | 15.82 / 10.20, 1.55; 7.0 / 20.6 | 15.26 / 12.35, 1.24; 12.4 / 17.0 |
| L20 ebony, an Ancient Lich (a Dragon's Den, 18) | 18.60 / 9.40, 1.98; 8.3 / 22.3 | 14.28 / 12.95, 1.10; 10.9 / 16.2 | 13.35 / 16.79, 0.79; 23.2 / 12.5 |

A weak foe in a weak place stays weak (the Orc); the deepest places are where the fight changed most - an Ancient Lich
in a Dragon's Den took eight swings and could not kill a level-20 player in twenty; it takes twenty-three and kills in
thirteen. The simulation leaves out the formulas' tail (an elite, the mentor, a stagger), a foe's spells and BAL4.

## 8. What is recorded, not built

- **The class enemy's flat 60.** The one double benefit in the armour term is the class foe's; making it the player's
  rule eases every humanoid fight, so it stays the mod's.
- **The 3..97 clamp** (DISC19-D) stays applied both ways - a field bug's fix, Mac's call.
- **DUNGEON_SHARE and DUNGEON_RARITY_TIER grade the dungeons twice** (a Laboratory 1.00 against tier 10). The share is
  the Master Skills layers' weighting, the tier the place's; both stand, each for its own layer.
- **A dungeon's allies.** `buildFoeAt` scales before a foe is allied, so a summoned ally in a deep dungeon stands
  stronger too - as it already did online under Master Skills.
- **The Elite and Super dungeons compound.** Their own scale (an Elite dungeon's x2, a Super dungeon's x4 health)
  is applied before the place's, as it was before Master Skills' layer online; a Super dungeon in a Dragon's Den's
  grade stands at x8 health. Online, a player with veteran skills already met that; now every player does.
- **The tactics brain's clock is the hosts' to tick.** It reads the foes' own time (`ai/tacticsClock.js`), ticked
  with each frame's foe step by the hosts, and rolls `Math.random` for its slots, beats and blows (TACT2). Ticked so,
  a 10 fps and a 60 fps foe pursue to the same spot under it too (AUDIT BAL's P17 twin); a harness that never ticks it
  is the only place its timers stand still.
- **The open world's puppets take no place.** A dungeon's do (its tier is every client's, AUDIT BAL); a wilds puppet
  cannot - whether its owner stood on a location's ground is the owner's, and the pool's `inLocation` is the viewer's.
  At the wilds' 5 and 7 that is at most +2.1 skill and x1.05 damage between an owner's copy and a peer's.
- **An offline crime chase still ends at a rise** (`respawnOnlinePlayer` clears the crime and abandons the arrest,
  in both lanes). A death is not a free escape any more - it costs the tenth - but the chase is not carried over.

## 9. The slices

| slice | what | shippable alone because |
| --- | --- | --- |
| BAL1 | the sharp edge rides the wear | two bands and their callers |
| BAL2 | one rule for every striker | the hit and the crit |
| BAL3 | the place sets the threat | one law, two seams |
| BAL4 | the offline defaults | three switches and the death's cost |
| BAL5 | the blow paid back (section 11, 2026-10-11) | one law at the door, one cap, one flavour retired |
| BAL6 | the curses (section 12, 2026-10-12) | the beast's advantages, its heal, its claws; the vampire's hood |
| BAL6-CLAWS | the claws' silver taken back (section 12, 2026-10-12) | one law reverted: both cores' gates as before BAL6 |
| BAL6-GAUNTLETS | the gauntlets are the claws' metal (section 12, 2026-10-12) | one law, read by both cores and the stats card |
| BAL7 | the loot that wins alone (section 13, 2026-10-12) | one flavour retired, one cap, two powers halved |
| BAL8 | the PvP referee, one rule for every striker (section 14, 2026-10-12) | one ceiling at the referee, one door's facing |
| BAL9 | Destruction's channels (section 15, 2026-10-12) | a spell's foe noted, the school's climb its potency, the ladder's arcana |
| BAL10 | the weapons' own (section 16, 2026-10-17) | the fists' modifiers, the short blades' handling, the Firmament's notables |
| BAL11 | the hero's threat (section 17, 2026-10-17) | one table, one reader, the one writer's two seams |

## 10. What shipped

All four slices in one pull request, each with its pins and mutants (`test/systems/bal_arc.test.js`, 14 tests since AUDIT
BAL, below; `tools/mutants/bal.json`, 61 mutants).

**BAL1** - `combat/pcaao.js` pcaaoAlterDamageBasedOnWepCondition and pcaaoAlterArmorReducBasedOnItemCondition take
`sharpEdge` (default on: the mod's); the blow, `condOf` and `combat/combatStats.js` hand
`modules.equipmentDamageEnhanced`. Pinned: every band at 0-100% both ways, edged and blunt, weapon and armour; through
`pcaaoAttackDamage` (400 seeded swings of a fresh longsword at an Orc Warlord: x1.3 with the wear, x1 without; a
foe's blow on fresh plate: more taken without the wear's 0.85); the stats card's headline swing (x1.3 / x1).
`test/systems/pcaao.test.js` (the mod's own numbers, its wear on) unmoved.

**BAL2** - one line for the hit (`chanceToHitMod = Math.ceil(F(skill(attacker, skillID) * F(1.5)))`), one roll for the
crit (`crit / (4 - luckTerm)`), one multiplier and aim (`1 + floor(crit / 5) * 0.05`, `+floor(crit / 4)`), one classic
arm without the module (`crit / 3` for `+crit / 3`). Pinned by execution: a class foe's landing over a hundred
evenly spaced rolls on a bare player (Long Blade 20: 62; ten more skill, fifteen more to hit; the 97 clamp), its crit
doubling a blow (10 -> 20) at the player's quarter (0.24 crits, 0.25 does not), and a crit's +25 to hit on a player
who dodges at 100 (the 3% floor -> 25). PIN MOVED in `test/systems/pcaao.test.js`: a monster's classic crit roll (crit/3 for
+crit/3) and its divisor (90 / (4 - 2) = 45%). PIN MOVED by the full suite: two overhaul blows whose first roll is a
monster's crit (`audit39_combat`, `diseases`: 2 x 1.2 = 2.4 -> 2 is now 2 x 1.4 = 2.8 -> 3), and CI's
`wear_vanilla` - an armed Knight's 300 blows on iron plate fall under 5 damage 29 or 52 times by the spawn's own
`Math.random` draw (it was 80 or 105), so its "both kinds of blow land" floor is 20 where it was 30 (a 50% red on CI;
the test's 21 mutants still die).

**BAL3** - `systems/skillSoftcap.js` PLACE_THREAT, placeVeteran, wildernessThreat and progressionScaling's `place`;
`characters/enemy/enemyEntity.js` records `progression.place`; the two seams gated on `lootRarityOn`. Pinned: the numbers
and the section 5 table; every dungeon kind at its ladder tier; the max rule, the foe's share, the clamp, the overcap,
three arguments SOFTCAP2's own; the wilds by execution (a crafted MONSTER.BSA, an Orc Warlord at midnight: x1.214
health with the ladder, DFU's with it off or on a location's ground); the dungeon's seam and the four hosts by
source (world.js's wilds pass the location rect; exterior.js's city and worldModes.js's interiors pass none).

**BAL4** - `systems/eliteFoes.js` elitesAllowed; `systems/features.js` 'enhanced-ai' `initial: true`; `systems/uiPrefs.js`
PREF1_ADOPT_NEW_DEFAULT; `ui/deathScreen.js` `rises` and riseHint, `ui/enhanced/enhancedDeath.js` deathKeys' Rise; the hosts'
`rises` (`world.js`, `worldModes.js` and its dungeon opts, `dungeonContext.js`); `legacyDeathReset`; Privateer's Hold;
`systems/deathPenalty.js`'s header. Pinned: elites by the ladder and the lane, and the open world's own roll by
execution; the AI's default, the brain's and the cover's switch; the death cost by execution (a rising screen states
34 of 345 and the respawn takes it from a purse that grew; no rise, nothing; online, the room's), the plates and the
line. PIN MOVED: FT5's row; FT18's online lock (on the dungeon sizes' row, the forced row that still ships Off);
UXB1-E's card (the player's own Off); PREF1's control; deathpenalty (2), AUDIT 28 B5, FEUD H2, LEGACY B5, D-ONLINE1
(3), FIX-E (2), AUDIT 21 F6, DISC19-C. Made explicit (the classic motor): enemymotor, FALL-HOLD, CRATE-FREE. Mutants
re-aimed by content: `bounty1.json` DEATH-PENALTY-3 and -5, `legacy1.json`'s street reset.

**AUDIT BAL** (2026-10-10, Mac: "We need to audit this and ensure perfection") - four independent lanes (the balance
code, the gem code, the tests and mutants, the docs and every number) read the pull request at its head; each finding
was checked against the code before it was fixed:

- **A saved dungeon's elites were the build's pick, not the save's.** The pick follows the ladder's switch offline, so a
  save made before offline elites (or with the ladder set the other way) met a pick that crowned a foe it held plain:
  the glow, the title and x3 blows on the save's plain health, its elite drop overwritten. `collectWorld` writes each
  foe's `eliteFoe`; `applyWorld` rebuilds a foe whose pick disagrees as the record has it (the species arm's path); a
  save without the field is plain offline, and online and on the wire the pick stands (`validSharedFoe` carries none).
  The word is the save's alone: `sharedWorld` strips it from the room's memory, as it strips `noBody` (RESPAWN1's door
  admits the record the dungeon really publishes). The word is laid on each record's source in a pre-pass after the
  load takes its puppets down and ahead of the restore's clock, so WORLD8's memory arm reads as it did. PIN MOVED:
  WORLD1's `sharedWorld` names the strip and AUDIT WORLD34 C2's admits it; RESPAWN1 publishes a real elite; OH-F B1
  reads the whole restore.
- **ELITE-FLOOR missed class foes offline** - a class foe counted as Infinity, so a level-1 character's Human Stronghold
  could hold a level-1 x5 Knight. `pickDungeonElites` takes `classLevel`: offline the level class foes are built at;
  online Infinity, the pick every client's.
- **A search woke an elite with the ladder off** - `rollSearchElite` asks `elitesAllowed` after its roll (a search's
  dice the same either way).
- **All off stood the AI up** - a shelf in the Features page's All off stored nothing for the AI while Off was its
  default; `loadPrefs` keeps it Off while the All-off keep stands and the shelf holds no word of its own.
- **A dungeon's puppets took no place** - a peer's copy of the host's foe struck at DFU's own while the host's struck
  at the place's; the place is every client's, so a puppet takes it (and none of its owner's standing). The wilds'
  puppets are recorded in section 8.
- **The port's own stages read as Crypts** (the arena's floor, the gate's court, the Shattered Hour wear type 0) - they
  never scale.
- **A kit's comment promised a sharp edge BAL1 took** (`net/recipeLaw.js` KIT-CEILING) - it says so now.
- **The pins** (lane C): the dungeon's seam, the saved elites, the class floor, the search and the ground run by
  execution in `bal_arc`; the enhanced death face drawn (its plates and line); the AI's three classic-motor pins each
  got a brain-On twin that ticks the brain's clock as the hosts do (`enemymotor` P17, FALL-HOLD, CRATE-FREE) - the
  "wall clock" this page first said was wrong, the clock is the foes' own time; `pref1_shelf`'s All off. The docs
  (lane D): the builds stated whole, the 18%-through figure, a rat's 62, the Port-Ledger's PROJECT LEGACY and PCO1
  rows, the PCAAO page's counts and the fourth departure's arms, the patch notes' paths and their "up to".
## 11. BAL5 - the blow paid back (2026-10-11)

A player's report (feature-feedback, 2026-10-11, with a clip): *"the Ancient Lich is an endgame mob in OG Daggerfall
and I can just give it the light skin stare and let it attack me until thorns damage kills him"*, and of Troll's
Blood held on a Rare: *"in the original you had to activate the item for and you couldn't repair it, which served as a
form of balance"*. Mac: *"Make the best balancing decisions"*.

THE CAUSE THE MEASUREMENT COULD NOT SEE. Section 2's builds wore plain steel or ebony - no loot line, no set. Two
things the loot ladder hands out decide a fight without the player in it:

1. **The thorns** (LOOT4, `systems/loot/lootPowers.js`) paid back every worn line, summed to at most 25, on every foe's
   blow that took health - flat, with no roll to hit, past the foe's armour and past the metal it asks of a weapon (an
   Ancient Lich's is Mithril). Section 7's player deals an Ancient Lich in a Dragon's Den 13.35 a swing, so 25 was
   nearly two swings paid back for every blow it landed, and the kill with it: Meaner Monsters' 80-210 health at the
   Den's x2 is 7 to 17 of its own landed blows, the player never swinging. Three Legendary lines or five Rares reached
   the cap. Spite of the Spurned (Malacath's four) pays back 10-30% of what a blow took, the same way.
2. **Troll's Blood, held**, one Rare armour flavour in nine (LR2's `RARE_FLAVOURS`): a Regenerate every magic round
   for as long as the piece is worn. DFU makes it at the item maker for 920 points and charges for it in the piece's
   life - CastWhenHeld's 1 condition every 4 rounds, and no smith mends a magic piece (AllowMagicRepairs, False). The
   port mends one by default and online (DISC22-A, Mac's), so a random drop handed out a regeneration that never
   ended. (The player's "you had to activate it" is DFU's Cast When Used; Cast When Held: Troll's Blood is in DFU's
   own catalogue - the cost DFU puts on it is the piece's wear.)

THE LAW. **A blow paid back never kills.** Damage a foe's own blow turns back on it - the thorns, Spite - takes what
it would, but never the foe's last point (`systems/playerDoor.js` paidBack: `min(n, ceil(health) - 1)`, a whole
point left whatever a shared foe's toughness divides it by; a record that carries no health is taken at its word).
The kill is the player's to take: standing still wins no fight and farms no corpse, at any gear and under any later
tuning of the numbers. **The thorns pay back at most 10 a blow** (`THORNS_CAP`, 25): the top of a Legendary line's
band and a Legendary sear's own most - 0.75 of section 7's swing, not 1.87. The bands (1-3, 3-6, 6-10) stand, so
every line already rolled stays lawful (`itemLaw.js` reads its band). **Troll's Blood is retired from the Rare draw**:
it stays in `RARE_FLAVOURS.Armor` marked `retired` - the law and the market (`smithItems.js` asMinted) still read a
piece that drew it as minted, so a player who has one keeps it - and `rareFlavour` draws among the eight others. The
item maker still sells it at DFU's price.

What moves: the thorns at the cap pay back 2/5 of what they did; neither power ends a fight on its own; one Rare
armour flavour in eight is each of the others (it was one in nine). Not moved: a Legendary, which carries its
record's enchantment, never a flavour.

RECORDED, NOT CHANGED:

- **The drop rates.** The report asks whether Rares and Legendaries come too often. The ladder's odds are LR1's table
  as LOOT13 (luck a nudge), FOE-CAP (a plain foe's own table) and CHAMP-LOOT tuned it, each on Mac's word; the clip's
  fight is lost to two powers, not to the number of pieces. Taking pieces away would leave both powers where they were.
- **The Ring of Namira** reflects an undead foe's blow doubled and can kill with it (`artifactEffects.js`
  onPlayerStruckByEnemy). It is DFU's own (FormulaHelper.cs:702-719), a Daedric Prince's quest reward, and 1:1.
- **The repair defaults** (DISC22-A's AllowMagicRepairs, REPAIR-EASE's InstantRepairs) are Mac's; BAL5 retires the
  one flavour they made endless instead of taking the mending back.
- **The other held flavours** (jewellery's Chameleon, Shadow Form, Tongues, Spell Resistance; armour's Slowfalling and
  the two waters) are utility or a resistance, not a heal.
- **The Legendaries' guards** (Unyielding, Divine Grace, Dawnward, Raven's Evasion, Hex, Bedrock, Hist-Sap) stack, and
  a player wearing many of them takes little from any one foe. Without a blow paid back that is a long fight, not a
  won one; they are a watch item for the next measurement, which should wear the loot.
- **A puppet's health** is the owner's record as last mirrored; a paid-back blow on another client's foe is held
  under that copy's last point, and the owner lands it on its own. A copy that lags its owner's a hit behind could let
  one through - a two-client edge, not the report's lane.

Pinned: `test/systems/bal5_blowback.test.js` (5) by execution - the real Ancient Lich's row struck at a player in Rare thorns
lines through the real damage door, worn to its last point and never killed; Spite alone and both together the same;
3,000 seeded Rare cuirasses never drawing Troll's Blood and drawing every other armour flavour; a piece that drew it
lawful to `itemFindings`. `tools/mutants/bal5.json` (12, all dead).

## 12. BAL6 - the curses (2026-10-12)

The owner, 2026-10-12: *"I want to continue balancing the online world. Mages have been adjusted a lot, but what about
were wolves, vampires, melee users, etc. The goal isnt to strip people of fun but to balance things out to where things
arent overpowered"*. Four read-only measurements ran through the real code before anything changed (the curses, the
loot a melee player wears, the ranged and stealth lanes, and a recap of the mage work - CAST-SPEED, STACK-CAP, INT10);
the three calls that move a DFU law or an earlier call of Mac's were put to the owner and answered.

THE MEASUREMENT (40,000 seeded swings a cell through the real `pcaaoAttackDamage`; section 2's builds; damage a second
with each form's own swing tempo):

| fight | human, sword | lycanthrope, human form, sword | beast, claws |
| --- | --- | --- | --- |
| L12 steel, an Orc Warlord | 6.8 | 19.5 | 29.9 |
| L12 steel, a Lich | 0.9 | 2.8 | 23.2 |
| L20 ebony, an Orc Warlord | 19.9 | 35.6 | 39.6 |
| L20 ebony, an Ancient Lich | 16.6 | 33.4 | 31.6 |

1. **The lycanthrope's +40 / +30 stood in both forms** (LycanthropyEffect's ConstantEffect, ported verbatim): a
   lycanthrope with a sword, a shield, potions and talk struck at x1.8-2.9 a plain character's damage a second and took
   14-17% less, and changing added only x1.1-1.5 on top. In a duel the same: 30.1 a second to a mortal's 18.2 at level 20.
2. **Every change healed whole** (MorphSelf, both ways): two full heals a day, and as many as the player liked under
   Hircine's Ring, which lifts the once-a-day gate.
3. **The claws met no metal.** DFU's material gate asks a weapon, and the claws are the bare hand: with the curse's +30
   Hand-to-Hand (+45 to hit through the overhaul's x1.5) a level-12 beast struck a Lich, whose hide asks Mithril, at x15
   what a steel blade does (12.48 a swing to 0.85).
4. **A hooded vampire stood +20 at every hour.** VAMP-DAY made the day's cost a -20 for the burn; VAMP-SUN gave the
   interiors DFU's +20 back; HOOD-SUN gave a raised hood in the street the +20 too - so with a hood the curse was +20
   everywhere and always: x1.67-2.07 a mortal's damage a second, x0.80-0.89 of what it takes.

THE LAWS.

- **The advantages are the beast's** (asked: "Beast-only bonuses"). `systems/lycanthropy.js` lycanthropeAdvantages
  writes DFU's four stats and seven skills only while transformed, on every round (after the moon's forced change, so
  the round never reads the other form) and at the change itself, both ways (morphSelf) - never a round late. The beast
  is exactly what it was; the man is his own character, and changing is the trade it reads as (no weapon, shield, pack
  or talk for the beast's numbers). A curse saved before BAL6 carries the man's +40 until its first round rewrites it.
- **One change a day heals.** `morphHeals`: a change heals when a whole day (STRICTLY more than 1,440 minutes, the gate's
  own day) has passed since the last change that healed (`lastMorphHeal`, a curse clock's marker: `save.js`
  clampMarkersAheadOf brings it back to a save's clock), whichever way it goes and whatever forced it. The Ring frees the
  change, never the heal. A curse from before BAL6 has no stamp: its next change heals.
- **The beast's claws meet no metal - DFU's** (BAL6-CLAWS, 2026-10-12; the owner: *"revert the material nerf on
  werewolf"*). BAL6 had the claws strike as silver (asked: "Beast claws count as silver"): a Mithril foe took them at
  x0.4 under the overhaul's soft rule, and refused them with DFU's line without it. The owner took that back the same
  day. Both cores' material gates ask a weapon alone again (`combat/pcaao.js`, `combat/formulas.js`, as before BAL6;
  `characters/weapons.js` strikeMaterialOf and BEAST_CLAW_MATERIAL are gone), so the claws are the bare hand:
  hand-to-hand and ungated, as a monk's and a vampire's fists are. Measurement 3 stands as it was measured.
- **The gauntlets are the claws' metal - its damage** (BAL6-GAUNTLETS, 2026-10-12; the owner: *"based on your
  equipped gauntlets it would affect your attacks as a wereboar/werewolf. Like scaling without being overpowered"*;
  asked: "Metal's damage bonus"). MorphSelf empties the hands, never the gauntlets, and the pack is refused to the
  beast, so it fights in what it wore. `combat/clawMetal.js` clawMetalDamage: in beast form, plate gauntlets
  (`systems/armorMaterials.js` plateMetal - DFU mints plate as `0x0200` plus the metal) add their metal's
  GetWeaponMaterialModifier to every claw hit: the points DFU's core adds to a blade of it, Elven +1 to Daedric +6,
  never below the bare claws (Iron's -1 is not taken). Leather and chain have no metal, nor gloves whose class reads as
  leather (Roleplay & Realism's Brigandine Gloves, AUDIT CLAWS B1), nor a broken pair (B3); the piece is what the equip
  rules seat in the Gloves slot (B4). Damage alone: no to-hit, no gate, no silver's double, no condition band. Both
  cores add it where a weapon's material modifier stands (`combat/pcaao.js` pcaaoHandToHandAttackDamage, after the
  strength term and before the floor; `combat/formulas.js` handToHandAttackDamage, before the enemy-type term), inside
  a backstab's treble. The refereed lanes' stand-in carries it (`combat/duelCombat.js`, A1), and the stats card models
  it (`combat/combatStats.js`), though the card is not open to a beast - it is the pack's flip side. A man's fist takes
  none, nor a monk's or a vampire's.
- **The hood shields, it does not make it night** (asked: "Hood only shields"). `systems/vampirism.js` vampireStatMod:
  bare in the street's sun -20, hooded there 0, out of the sun (a roof, underground, a cell, the night) DFU's +20, hood
  or not - Mac's "Should be buffed in interiors" and "shielding against the sun" both kept.

THE GAUNTLETS, MEASURED (BAL6-GAUNTLETS; 40,000 seeded swings a cell through both cores, section 2's builds, the real
curse and change). Three shapes were put to the owner. The metal's damage alone scales evenly: at level 20 with the
overhaul, Elven +6%, Mithril +17%, Ebony +22% and Daedric +34% a swing, against an Orc Warlord, a Lich and an Ancient
Lich alike (level 12, Daedric +36%; DFU's core +26-28%). A blade's metal whole, its to-hit with it, reached +41%, +71%
and +84% at Daedric on the three - and in DFU's core, whose to-hit takes the metal x10, up to x25 a bare beast's on an
Ancient Lich. Half of both reached +22%, +34% and +39%. The owner chose the damage alone.

WHAT MOVES. A lycanthrope in human form strikes and takes as the character it is (19.5 -> 6.8 a second at level 12,
35.6 -> 19.9 at level 20; a duel's 30.1 -> 18.2); the bare-clawed beast is unchanged, a metal-hided foe included
(BAL6-CLAWS), and a beast in plate gauntlets strikes its metal's points harder a hit (BAL6-GAUNTLETS: Daedric about a
third more a swing). Two healing changes a day are one, and the Ring's endless ones are one. A hooded vampire in the
street by day is +0 where it was +20 (its +30 skills alone: about x1.10-1.17 a mortal's damage). THE FOUR HOSTS: none
is touched - each law is the curse's or the blow's, read wherever the curse runs its round and the blow is struck
(`scenes/world.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js` all strike through the
same two cores and run the same round; world.js's refereed lanes strike through `combat/duelCombat.js`'s sheet, which
carries the claws' metal since AUDIT CLAWS A1).

RECORDED, NOT CHANGED:

- **The vampire out of the sun.** Indoors, underground and at night the vampire keeps DFU's +20 and the measured
  x1.67-2.07 (Mac's VAMP-SUN). The other lever offered - the +20 the night's alone, 0 sheltered by day - was not chosen.
- **The vampire's clan spells** stay at DFU's flat 5 spell points (MinimumCastingCost; asked: "Leave at 5"), Ice Storm
  and Wildfire among them. A refereed fight bounds every cast whatever it cost (INT10, and section 14's ceiling).
- **Every fist** - a vampire's, a monk's and, since BAL6-CLAWS, the beast's - stays ungated: DFU's rule.
- **The referees' fist bounds** (BAL6-GAUNTLETS, read again by AUDIT CLAWS). Both clip a claim, never refuse it. The
  duel, the siege, the Royal Tourney, a siege work and the wild zone roll through the striker's sheet of
  `combat/duelCombat.js` (duelAttackerOf - against the neutral stand-in since AUDIT C&C H5), which holds every stat and
  skill at 100 at most: there the siege's bound (`net/siege/siegeRef.js` siegeBlowMax: the bare
  hand's 21 at skill 100 and the bonuses at their caps, x2) holds a beast in Daedric gauntlets with every bonus at its
  cap - 55 of its 56 before the critical and 110 of 112 after under the overhaul, 52 in DFU's core. The arena strikes
  through the real entity, and its cap (`net/arena/arenaLaw.js`: a bare hand's 41 at the softcap's 200, ARENA_MOD_MAX's 20,
  x2) already clips a level-30 beast's top critical, the beast's +30 Critical Strike taking the overhaul's multiplier
  past x2 (x2.3 at 130): a Khajiit hand-to-hand expert's bare critical 127 (5 clipped), in Daedric 140 (18). Both are
  the relay's, and neither moved here.
- **The silver-to-hit of a beast in a refereed fight**: every referee's claim is rolled on a stand-in, never the beast
  (the striker's own sheet until AUDIT C&C H5, a neutral one since), so the beast's defence never counts there -
  reading it would make the beast stronger in PvP, not weaker.
- **The wereboar** is the werewolf in another skin (the same advantages, claws and change), as in DFU.

Pinned: `test/systems/bal6_curses.test.js` (6) by execution - the advantages through liveStat and skillValue in both forms, at
the change's instant and after a round, a pre-BAL6 save's word rewritten; the heal's day, the Ring's change without it,
the stamp clamped on a load; BAL6-CLAWS: 2,000 seeded beast swings at a Lich's Mithril whole, as at no metal, with
the soft rule on and off and nothing said, a man's fist the same, and DFU's core seed for seed; BAL6-GAUNTLETS:
plateMetal over every armour material, the claws' metal through the curse, CreateArmor's gauntlets, the equip table and
the change (Elven +1 to Daedric +6; iron, leather, chain, bare claws, human form, the change back and a man nothing),
+6 a hit in both cores at one roll, before the overhaul's floor and inside a backstab's treble, 2,000 seeded swings in
each core landing the same blows (DFU's exactly 6 heavier each, at an Orc Warlord), and the stats card's model in both
cores - its span, its part, its hit chance at every reference foe, its floor; vampireStatMod in the street and under a
roof, bare and hooded. `tools/mutants/bal6.json` (26, all dead: BAL6-CLAWS retired the five claw records and aimed
four at the restored gates - the claws as silver in either core, the claws refused with DFU's line under the overhaul
with its soft rule off, every fist gated; BAL6-GAUNTLETS aimed eleven - every fist's, iron's -1 taken, leather or chain
a metal, a metal past Daedric, the wrong slot, either core without it, the metal as to-hit in either core, the card
without it, and mintCondition's plate offset, which `test/systems/audit23_systems.test.js` pins). AUDIT CLAWS's own, below.

### AUDIT CLAWS (2026-10-12, the owner: "Audit this") - BAL6-CLAWS and BAL6-GAUNTLETS read again before they merge

Three independent lanes, each a cold read of the pull request (#841) against a frozen snapshot of its head, with
repros: every place a claw blow is struck, refereed, predicted or shown, and the beast-form flag's life; every gauntlet
the game can put on and what it is made of; and what the change says and pins (every number recomputed, its pins
mutated past their 26 records - 47 more, and 5). CI's own run found one more. Every finding was reproduced before it
was fixed. FOUND, each fixed and pinned (`test/systems/auditclaws.test.js` 4; `test/systems/bal6_curses.test.js`'s pins strengthened,
still 6; `tools/mutants/auditclaws.json` 22 of 22 dead, `bal6.json` 26 of 26):

- **HIGH - A1: the gauntlets never reached a refereed blow.** The duel, the siege, the Royal Tourney, a siege work and
  the wild zone (and its PvP halls) strike through a stand-in of the striker's sheet (`scenes/world.js` duelStrikeOut
  and its kin; `combat/duelCombat.js` duelAttackerOf, duelStub), which carried no beast form and no equip table: a
  beast in Daedric gauntlets claimed exactly what a bare-clawed one did there, while the arena (the host's own blow)
  and every fight with a foe carried the metal. FIXED: the sheet carries the law's word (`cm`, read off the striker's
  own entity), the stub carries it as `clawMetal`, and the law reads it - never the gauntlets themselves, because the
  striker rolled against a stand-in of its own sheet, which would have worn them as the defender's armour (AUDIT C&C H5:
  a neutral stand-in since, which carries no `cm`; the stub has no equip table either way). The client's
  alone: since INT8 the sheet never goes on the wire (a strike carries its rolled `d`), and the referees' bounds hold
  the claim (RECORDED above).
- **MEDIUM - A2: a load kept the last game's beast form.** `systems/save/save.js` restorePlayer writes a save onto the same
  entity, and it rebuilt the curse's marker but not `isInBeastForm`, its mirror. A man's save loaded over a transformed
  werewolf kept it (the curse's round returns at once with no curse), so his fist took the gauntlets' +6 and the
  street's politeness gate and the tells read a beast; a transformed save on a fresh page waited a round for it, the
  claws without their metal until then. FIXED: set from the curse it restores, beside the marker.
- **MEDIUM - B1: Roleplay & Realism's Brigandine Gloves counted as plate.** The mod (on by default) seats its gloves
  (template 524) in the Gloves slot at any metal; their class reads them as leather (ItemGloves.cs: "This fools the DFU
  code into treating this item as leather for forbidden checks"), and so do the forbidden-armour test, Better Ambience
  and Immersive Footsteps. The law read the raw material: a career barred from plate wore Daedric brigandine for
  Daedric claws - about half the Gloves-slot pieces random loot draws, and the Master Armorer sells them. FIXED: the
  class's material (`systems/roleplayRealismItems/rriItems.js` rriNativeMaterialValue, the port's one reader of it).
- **LOW - B3: a broken pair kept its metal.** Survival's rust writes a worn piece's condition straight down and leaves
  it on, and a classic import keeps a worn 0-condition piece worn. FIXED: a broken piece (`equip.js` isBrokenItem) is
  no metal.
- **LOW - B4: the law read whatever sat in the slot.** A load seats each item at its saved slot and trusts it: a
  cuirass saved at the Gloves slot, or the mod's gloves left there with the mod off, read as gauntlets. FIXED: only a
  piece the equip rules seat in the Gloves slot (`equip.js` getEquipSlot).
- **LOW - B2: "the plate offset's one home" was not.** Three readers of the same member still wrote `m - 0x0200`
  themselves: a plate piece's value (`itemTemplates.js` itemBaseValue), weight (`inventory.js` unitWeightInKg) and
  armour value (`armorMaterials.js` materialArmorValue). FIXED: all read `plateMetal`, identical for every input (an
  index past Daedric reads each table's own fallback, as it did), each still pinned by the suites that pinned it
  (`audit18_systems_items`, `shopstock`; `audit18_combat` and four more). The docstring names FormulaHelper's
  RandomArmorMaterial, not ItemBuilder's.
- **LOW - C2 to C8: pins that could not fail.** DFU's "the same blows land" sat at a Lich's 3% floor, where +6 to hit
  lands nothing more (now at an Orc Warlord: 854 of 2,000 land); the order the pages give - after Strength, before the
  overhaul's floor - and a backstab trebling the metal were unpinned in both cores and on the card; so were the card's
  hit chance with the metal, and DFU's silence for the claws at Mithril; and the gauntlets were a hand-built literal,
  not CreateArmor's (`combat/enemyEquipment.js` armorOfMaterial). FIXED, each with the mutant that survived it, now
  dead (nine records).
- **LOW - A4: the stats card's line could not be seen.** The card is the pack's flip side, and the pack is refused to
  a beast: the patch notes promised a "Gauntlets" line no player could open. FIXED: the label is taken back
  (`ui/statsCard.js` as it was); the card still models the cores for whatever entity it is handed, and the pages say
  what a player can see.
- **LOW - CI: the account Worker bundles the law.** The account service reaches `combat/formulas.js`, so
  `combat/clawMetal.js` joined its bundle without joining its deploy's path filter (`test/server/accountdeploy.test.js` walks
  the graph): a change to it alone would never have deployed the service. FIXED
  (`.github/workflows/account-deploy.yml`). The change's own fast runs could not see it - a Worker's import walk
  imports nothing of the file and names it nowhere - so the suite's eight import-graph walks ran with them after.
- **LOW - C9: pages and comments.** "Past skill 100 the siege's bound already clipped any fist" was false (the refereed
  stand-in holds every skill at 100); "the same points a blade of it adds" holds in DFU's core, not under the
  overhaul's condition bands; the fifth departure's parenthetical and the overhaul page's part table; the test file's
  header; `playerWeapon.js` strikingWeapon's comment. FIXED.

RECORDED, NOT FIXED (each another arc's, or the relay's):

- **The arena's fist cap clips a beast's top critical** (A5) - above, under the referees' fist bounds.
- **The plate encoding is still written beside its home**: `combat/enemyEquipment.js` ARMOR_MATERIAL (Leather, Chain,
  PLATE_BASE), `net/recipeLaw.js` ARMOR_LEATHER/CHAIN/PLATE (read by `net/temperLaw.js` and `systems/smithItems.js`),
  `systems/item/itemLaw.js`'s literal list of the thirteen, `ui/paperDoll.js`'s dye index (a second GetArmorDyeColor beside
  `systems/item/itemDye.js` armorDyeColor), and `systems/item/itemInfo.js`'s name index (`& 0xff`, which names a quest's
  materialless Gauntlets "Iron" while they are priced and armoured as leather).
- **`systems/physicalItems.js` itemLook reads `nativeMaterialValue`**, which no producer writes: a leather and a Daedric
  pair share one look key in the world's item pool.
- **The claws' metal is not scaled by the gauntlets' condition**: the overhaul's bands scale a weapon's whole blow,
  and the claws' blow is the beast's own. Only a broken pair is nothing (B3).

## 13. BAL7 - the loot that wins alone (2026-10-12)

BAL5 left the next measurement to "wear the loot", and it did: a level-20 kit of the ladder's own pieces (Ansei's Edge
with two Flawless Diamonds; Titanheart, Mountain's Root, Raven's Wings, the Visor; three Rares imprinted Dawnward,
Last Stand and Bulwark; Divine Grace, Hex, Hist-Sap, First Blood and a Rare ring), through the real blow, the real door
and every guard and save. Foes killed in a row before the player fell (stopping at 50):

| fight (place, tier) | plain ebony | the kit, no guards | the kit |
| --- | --- | --- | --- |
| an Orc Warlord (a Barbarian Stronghold, 11) | 8 | 43 | 50 |
| a Lich (a Vampire Haunt, 14) | 3.6 | 18 | 50 |
| an Ancient Lich (a Dragon's Den, 18) | 1.1 | 6.6 | 47 |

Four things decided a fight without the player in it:

1. **Vampiric Effect when strikes**, one Rare weapon flavour in eleven (LR2's `RARE_FLAVOURS`): DFU's own payload heals
   the wearer every point the blow deals; DFU charges 1,000 of an item maker's points for it (Troll's Blood was 920).
   The plain build with that one blade went from 1.1 Ancient Liches to 50 and counting.
2. **The leech** summed a weapon's line and its gems uncapped: an Exalted 10 and a Perfect Emerald's 7 healed 17% of
   every landed blow, and the heal grew with every point of offence - the kit without a guard went from 6.6 to 49.7.
3. **Hist-Sap** regenerated 2% a round (4% under half): taken away, the kit fell after 21 Ancient Liches, not 47 - worth
   more than any guard (Bulwark 36, Divine Grace 38, Dawnward 41, the Raven 42).
4. **Open Hand** struck every landed bare-handed blow twice, whole: a kitted monk's 74 a swing, 3.2x the plain monk's
   and 4.3-5.5x the plain sword's.

THE LAWS. Vampiric Effect is retired from the Rare weapon draw as BAL5 retired Troll's Blood (`retired`: the law and
the market still read a piece that drew it as minted, so it keeps it; the item maker still sells it at DFU's price;
Gortwog's Cleaver carries it as its record's - a Legendary's enchantment is never a flavour). The leech a weapon's lines
and gems sum to is at most `LEECH_CAP` 10 (`systems/loot/lootPowers.js`) - the top of a Legendary line's band, as THORNS_CAP
is; every line already rolled stays lawful. Hist-Sap is 1% a round, 2% under half. Open Hand's second blow lands for
half (`share`, the record's), never less than a point; its card says so.

WHAT MOVES. A new Rare blade never heals its whole blow; a leech kit heals 10 of a hundred where it healed 17; Hist-Sap
half (the measured kit's Ancient Liches about 47 -> 31); a kitted monk's 74 a swing about 56. Not moved: every guard,
every set, the techniques, a Legendary's own power but these two.

RECORDED, NOT CHANGED:

- **The guards** compose with no overall ceiling (all eight about x0.49 of what lands; past their avoidance about 96%
  off a blow at the extreme). A 50% ceiling at the door barely bound (7.22 -> 7.28 a blow) once the heals above were
  answered, so the heals were the cause and the guards stand.
- **Skill lines past the softcap** (gear's Critical Strike to 110 in the kit, x2.1 a crit): -6% in the measured kit;
  a ceiling on them is a watch item, not a cause.
- **The blow powers** multiply across their three registries (sigil, sets, loot) with no ceiling; they bind only in a
  stacked burst on a cooldown.
- **Gortwog's Cleaver** keeps its record's Vampiric Effect: one named Legendary, never a random draw.

FIELD BUGS 2026-10-18f VAMPIRIC-WARD: the heal is the damage a blow DEALS, and a blow a referee's ward turns whole deals
none. The stand-in says so (`warded`: the Warden's ward, the Brass Remnant shut, the Spire's turned blows - Elite-Gates.md
section 11.7, TURNED-BLOW). Every other heal and power of a landed blow already refused one (the leech since AUDIT
WORLD-REWARDS B3). The payload did not, and healed the whole claim (`systems/enchantments.js` VampiricEffect `strikes`).
DFU never meets the case - its target is always the entity whose health the blow then takes - so this is VampiricEffect.cs's
own law told what the blow dealt. Pinned: `test/systems/fb1018f_vampiricward.test.js` (2).

Pinned: `test/systems/bal7_loot.test.js` (3) by execution - 3,000 seeded Rare blades never drawing Vampiric Effect and drawing
every other weapon flavour, a piece that drew it lawful, the Cleaver's record; a line and a gem healing 10 of 100;
Hist-Sap's round at 61 and 42 of 100; Open Hand's 20 again for 10, a 1 for 1, a weapon's for nothing.
`tools/mutants/bal7.json` (6). PIN MOVED: `loot5_powers` (Hist-Sap's 62 and 44 are 61 and 42, Open Hand's 7 is 4) and
its LOOT5-open-hand-on-a-sword mutant, re-aimed by content.

## 14. BAL8 - the PvP referee, one rule for every striker (2026-10-12)

BAL2's law for the foes - one rule for every striker - had not reached the referee of a fight between players.

1. **A caster had a ceiling and a blade did not.** INT10 holds a caster to 3 damaging casts of 60 in 5 s (180, 36 a
   second); a blade or a bare hand was held to 4 blows a second and one blow's bucket (`siegeBlowMax`, ~110), which no
   measured blow came near (the highest of 40,000 was 54). Every refereed lane equalises vitality (300 + 2 x Renown) and
   rolls a striker's claim against a stand-in, so offence alone decides it: a kitted monk 45.8 a second (a fighter
   felled in 8.3 s), a kitted sword 26.5, the mage at its ceiling 36 (10.6 s). [AUDIT C&C H5: these were measured on
   the striker's own sheet as the stand-in, which cancelled every attribute it brought; on the neutral stand-in a
   high-attribute striker lands more - a level-20 sheet's starting Shortsword 60.18% to 72.24% of swings, 4.51 to 5.98
   a swing - inside the same window, SIEGE_HARM's 180 in 5 s.]
2. **The arena's rival faced nowhere.** `scenes/world.js` arenaRivalBody hands the rival's stand-in `yaw: 0`, and the
   swing's door and the shaft's read a backstab off it - every blow or arrow from its -z side tripled, whatever way the
   rival faced (about double the damage a second over a bout). The duel's, the siege's and the zone's referees roll no
   backstab at all (`combat/duelCombat.js`), and AUDIT WB11 W2 found and fixed the same yaw-0 back on the crystals.

THE LAWS. Every harm a fighter deals - blows and casts together, so a blade and a spell are never two ceilings - is at
most `SIEGE_HARM` (`net/siege/siegeRef.js`: the casts' own 180 in any 5 s), in `refereeBlow` and `refereeCast`, the one
referee of the duel (`net/duel/duelRef.js`), the Wild Zone (`net/wild/wildRef.js`) and the siege's room (`server/src/index.js`).
A claim past it is judged and lands nothing (the striker's `clipped` counts it); a heal is no harm; a room's fighter
from before BAL8 has dealt none. The arena's swing and shaft doors hand the rival no facing (`scenes/dungeonContext.js`:
`_backFacing = false`, `playerFeet: null`) - no backstab at a player in any lane. The relay is `world197`.

WHAT MOVES. Only a striker past 36 a second sustained: the kitted monk 45.8 -> 36; every measured sword, bow and gun
stands (18.2, 26.5, 13). A spellsword's blows and casts share the one 180. The arena's bouts lose the free x3 from the
rival's -z side. Not moved: the arena's own bucket (`net/arena/arenaLaw.js` ARENA_BUCKET_RATE 40, depth 120), its own lane's.

RECORDED, NOT CHANGED:

- **A refereed fight reads no defence** - not the defender's armour, Dodging, guards, sets or Shield spells; vitality
  is equal and every claim is rolled against a neutral stand-in (the striker's own sheet until AUDIT C&C H5). Reading
  the defender's kit - or its attributes, which the INSPECT1 card carries unsigned - in PvP is a design
  of its own (a signed defence, as INT7 signed the arms), not a balance pass.
- **The Warden is backstabbed by a crowd** (`dungeonContext.js` reads his facing): a rogue behind him reaches ~67 a
  second, inside his per-player bucket (75 at level 20). Its own call - the rogue's role, or a watchful boss.
- **Kiting**: a player at Speed 70 runs 8.9 m/s and a plain melee foe 5 (6.25 at Speed 100); only elite, champion and
  revenant foes of eight kinds charge or leap. A bow kites any plain melee foe for nothing - an Enhanced AI change of
  its own.
- **Companions** roughly double a player's damage in the open world and dungeons; they are already out of the gate's
  court, the Shattered Hour and PvP's referees.
- **The Thunderlock** is a sidegrade (per shot 36% over an ebony long bow, per second equal to it and 0.70x a sword;
  x0.8 at a Mithril foe). The arena's blow table has no row for its template 560 (a bare hand's cap, 122, where its own
  would be ~96) - harmless at its numbers.

Pinned: `test/net/siege/bal8_pvp.test.js` (3) - the ceiling by execution (two blows reach 180, the third lands nothing, the
window slides at 5 s to the millisecond, casts and a blow sharing it, INT10's three still its own, a heal no harm, a
fighter without the field); one referee for the three lanes and the arena's two doors by source.
`tools/mutants/bal8.json` (7). PIN MOVED: `tools/mutants/pvpref.json`'s five clipping records, re-aimed by content; the
relay's version pins (`world197`).

## 15. BAL9 - Destruction's channels (2026-10-12)

The owner, 2026-10-12: *"I think destruction needs a buff. A lot of players saying its lack luster. I want to also
introduce some new magic/mage perks to the rarity loot pool since weve done a lot of needing but still dont make it
overpowered"*. BAL6 had recapped the mage work (CAST-SPEED and CAST-RECOVER, STACK-CAP, INT10, SPELL-COST-PAST) as
answers to field reports - each a cost, a tempo or a ceiling, none a spell's damage - and left the caster unmeasured.

THE MEASUREMENT (online; the real `calculateCastCost`, `applySpell` and its saving throw, 20,000 seeded casts a cell; a
foe's attributes at 50 and its tolerances normal, as section 2's; its health the combat overhaul's row at its middle,
BAL3's place on it). Stated builds: a level-12 Mage (INT 75, WIL 60, Destruction 60, 150 magicka at x2.0 INT) and a
level-20 one (INT 85, WIL 65, Destruction 85, 170). Two spells off the spell maker: a Flame Bolt (Damage Health 10-20 +
1-2 a level, single target at range) and a lean bolt (1 + 4 a level) - DFU prices a point a level at 28 gold and a base
point at 20, so the player who reads the cost builds the second.

| build, spell | magicka a cast | landed a cast (none) | Orc Warlord kills a full pool: a town / a Crypt / a Dragon's Den | Ancient Lich: a town / a Den |
| --- | --- | --- | --- | --- |
| L12, Destruction 60, Flame Bolt | 61 | 17.8 (36%) | 0.42 / 0.31 / 0.21 | 0.28 / 0.14 |
| L12, Destruction 60, lean bolt | 24 | 26.7 (36%) | 1.62 / 1.19 / 0.81 | 1.08 / 0.54 |
| L20, Destruction 85, Flame Bolt | 30 | 24.3 (36%) | 1.34 / 0.98 / 0.67 | 0.89 / 0.44 |
| L20, Destruction 85, lean bolt | 12 | 44.2 (36%) | 6.07 / 4.47 / 3.04 | 4.04 / 2.02 |
| L20, Destruction 100, Flame Bolt | 12 | 24.3 (36%) | 3.34 / 2.46 / 1.67 | 2.22 / 1.11 |

What it found, ranked by what it moves:

1. **A Destruction spell's damage has one channel: its caster's level.** DFU's GetMagnitude rolls `base + plus *
   floor(level / per)`, and the school's skill prices the spell and moves nothing else - a level-12 Knight with
   Destruction 20 and a level-12 Mage with 90 land the same fireball. In DFU's 0-100 that is the skill's whole reward
   and a steep one (`(110 - skill)`: a spell at 100 costs a fifth of its price at 60). Past 100 it stops (2).
2. **Online, the school past 100 bought its price and raised the foes.** SPELL-COST-PAST prices the points past 100 at
   `100 / skill` - rightly: they priced spells under nothing - and the same mastery is in the foes' edge (`combatEdge`
   reads the six schools among the fighting skills). Destruction alone mastered, the Flame Bolt, a Crypt:

   | raw (effective) | 100 (100) | 125 (108) | 150 (117) | 175 (127) | 200 (140) |
   | --- | --- | --- | --- | --- | --- |
   | the price | x1 | x0.83 | x0.83 | x0.75 | x0.58 |
   | a Crypt's foes' health | x1.36 | x1.44 | x1.53 | x1.63 | x1.77 |
   | magicka a kill | x1 | x0.88 | x0.94 | x0.90 | x0.76 |

   Five tiers of the softcap's cost ladder for a quarter off a kill, and a step backward at 150. A weapon's climb reads
   in its formulas (the hit at x1.5, a crit's chance, multiplier and aim); a school's read in nothing but its price.
3. **A spell never answered its foe.** Past 100 a mastered skill learns by the foe it fights (SOFTCAP1: a foe tough
   for the skill counts up to x1.5), and only `calculateAttackDamage` ever noted one. A fireball at an Ancient Lich
   counted as a light cast in an empty room (UNCHALLENGED_MAGIC_WEIGHT, a quarter) - the mastery box's "Past 100 a
   skill only learns from tough foes" was never a spell's.
4. **The ladder paid a blade and priced a caster.** A weapon's loot reaches its blow (damage 5-40%, a sear, slayer's
   30%, the leech, the techniques, the Legendary powers on the blow); a caster's reaches the price (focus, the Loop, the
   Conduit, Stendarr's Mercy - half off at most) and the tempo (castSpeed), and no line, gem, set piece or power ever
   reached a spell's damage or its magicka between rests. BAL7's kit killed 47 Ancient Liches in a row; a caster's best
   kit halved its price.
5. **DFU's saving throw lands a third of casts as nothing.** At Willpower 50 a foe saves at 55; a roll more than 20
   under it is a whole save, within 20 a share - 36% of casts land nothing, and a cast lands 54% of its roll. DFU's own
   (FormulaHelper.SavingThrow), for every caster, and left (below).

Checked and found sound, so not changed: the overhaul's health rows move monsters both ways (an Orc Warlord x1.86, a
Lich x1.10, a Vampire x0.96 over DFU's) - the mod's tuning, for every striker; BAL3's place costs a caster magicka where
it costs a blade swings and the blows taken during them; STACK-CAP's renewal of a damage over time is the owner's
("Refresh, never stack").

THE LAWS.

- **BAL9a, A SPELL ANSWERS ITS FOE.** My spell that reaches a foe - not my ally, not a peer's strike spell on my foe -
  notes it as the fight's (`scenes/hostMagic.js` applySpellToFoe), and a foe's spell that reaches me notes its caster
  (applySpellToPlayer): the blow's two directions (`combat/formulas.js`). Past 100 a school's next uses for six seconds
  learn by that foe. The quarter stays a spell's floor (`systems/skillSoftcap.js` overcapTallyWeight:
  `max(UNCHALLENGED_MAGIC_WEIGHT, challengeQuality)`), so a cast at a weak foe never teaches less than a cast at a wall,
  and nothing trains slower than it did.
- **BAL9b, THE SCHOOL PAST 100 IS ITS POTENCY** (CLIMB-PAST's law, for the school whose formula stops paying at 100).
  Online, each effective point of Destruction's CLIMB past 100 lands its damage-health effects - Damage Health and
  Continuous Damage Health, the instant and every round - 1% harder: x1.4 at 200 (`systems/spell/spellPower.js`
  schoolPotency, read by `systems/effects.js` casterDamageScaled with the blow's own rounding and floor of one; a spell
  the throw turned whole stays nothing). The climb is `skillSoftcap.js` climbedSkill - the one read the foes' edge
  takes, so the climb that raises them is the climb that pays; a worn Destruction line already pays in price (the live
  value SPELL-COST-PAST reads) and strikes no harder, and mentoring reads none, as the edge does. Offline DFU's price
  term stands (to nothing at 110 - the field report's For Mac), and so does its damage. Never at a player, a peer's
  stand-in or a foe's cast (`ownSpellAt`): a refereed fight's stand-in is a player (`combat/duelCombat.js` duelStub), so
  the duel, the siege, the Wild Zone and the arena are BAL8's to the point.
- **BAL9c, THE LADDER'S ARCANA.** Two lines, after `castSpeed` and before `technique`, so the numbers' pass draws as it
  did (the last pass moved, as CAST-SPEED's did: a jewel's proc pick lands in four kinds where it landed in two, a
  blade's in five where four) - `potency`, jewellery and weapons, prefix, 3-6 / 6-10 / 10-15, "+N% spell damage": a
  damage spell's landing at a foe, everything I wear summed, at most `POTENCY_CAP` 30 (focus's and castSpeed's); and
  `wellspring`, jewellery, suffix, 2-4 / 4-7 / 7-10, "N% magicka on a kill": the caster's leech, at most
  `WELLSPRING_CAP` 10 (LEECH_CAP's; Soul Siphon's 15 the Legendary's own beside it). And three Legendaries, a table of
  their own after the wardrobe's six (`ARCANE_LEGENDARIES` - the thirty, the six and the Broker stand), found among the
  casters (LOOT6), each LOOT3's shape and its power on the record:

  | record | on | lines | enchantment | power |
  | --- | --- | --- | --- | --- |
  | The Eye of Magnus | Amulet, Cloth Amulet | +15 Intelligence, +25 Destruction, +40% Magic resistance | Extra Spell Points, during summer | Magnus's Gaze: my Destruction spells meet a saving throw 15 lower - after its immunity, so a foe immune stays immune (`spellcast.js` savingChance's `pierce`) |
  | The Ring of Artaeum | Ring | +12 Willpower, +25 Mysticism, +40% Fire resistance | Extra Spell Points, during the half moon | Wellspring of Artaeum: 1% of my magicka back each magic round, 2% under half - Hist-Sap's shape; never offline to a career that cannot regenerate it (rest's own gate, REST-MANA1) |
  | Shalidor's Brand | Broadsword, Saber, Longsword | +24% damage, +12 Intelligence, +22 Destruction | Cast When Strikes: Wizard's Fire | Arcane Surge: while I wield it, my Destruction spells strike 25% harder while my magicka stands above three quarters |

  All the loot adds to a spell's landing, lines and powers together, is at most `SPELL_POWER_MOST` 50 (SPELL_CUT_MOST's
  50 for the price). Every one is MY entity's at a foe: never at a player (the loot arc's law 5), never a peer's, nothing
  with the ladder off. The item law is at 3 (`systems/item/itemLaw.js` ITEM_LAW_VERSION) and the account service that judges
  by it at `acct121`, so an honest piece minted after the site deploys is never read as a forgery (AUDIT TECH1's "the law
  moves the service"); `spellPower.js` joins the account Worker's deploy filter.

WHAT MOVES.

The climb, Destruction alone mastered, the Flame Bolt, a Crypt (the measurement's table, with the potency):

| raw (effective) | 100 (100) | 125 (108) | 150 (117) | 175 (127) | 200 (140) |
| --- | --- | --- | --- | --- | --- |
| a cast lands | x1 | x1.08 | x1.17 | x1.27 | x1.40 |
| magicka a kill, before | x1 | x0.88 | x0.94 | x0.90 | x0.76 |
| magicka a kill, BAL9b | x1 | x0.81 | x0.80 | x0.71 | x0.54 |

Every point of the climb pays now, and no step goes backward; at 200 a kill costs about half its magicka at 100 where
the foes it raised stand at x1.30 - the climb keeps pace with the threat it makes, and outruns it by a little, as a
weapon's does. Below 100 nothing moves: DFU's price is the skill's reward there.

The ladder, a level-20 Mage (Destruction 85, 170 magicka) and the Flame Bolt against an Ancient Lich in a Dragon's Den
(310 health), through the real price, landing and throw (20,000 seeded casts a row):

| what is worn | magicka a cast | landed a cast (none) | kills a full pool |
| --- | --- | --- | --- |
| nothing | 30 | 24.3 (36%) | 0.45 |
| focus at its cap (30) - the most a line did before | 21 | 24.3 (36%) | 0.64 |
| potency at its cap (30) | 30 | 31.6 (36%) | 0.58 |
| a +25 Destruction line alone (its price, before BAL9 as now) | 10 | 24.3 (36%) | 1.33 |
| the Eye of Magnus alone (that line and Magnus's Gaze) | 10 | 31.1 (20%) | 1.70 |
| the best caster kit before BAL9 (a +25 Destruction line, focus 20, the Archmage's Loop) | 7 | 24.3 (36%) | 1.90 |
| the same slots after (the Eye for the line, potency 30 for focus 10) | 8 | 40.4 (20%) | 2.77 |
| every cap (potency 30 and Arcane Surge, the Eye, focus 10 and the Loop) | 7 | 46.8 (20%) | 3.67 |

A caster's best kit lands half again its kills a pool in the same slots, and at every cap about twice its damage a
cast: inside the ceilings every line keeps (30 a kind, 50 for the loot's spell power, the throw's own floor of 5),
against BAL7's melee kit that stood 31 Ancient Liches in a row.

Not moved: a refereed fight (the duel, the siege, the Wild Zone and the arena - INT10's 60 a cast and BAL8's 180 in 5 s
stand, and no power or line reaches a player's stand-in); a foe's spells; every other school (until SCHOOLS2 - below);
DFU's saving throw.

RECORDED, NOT CHANGED:

- **DFU's saving throw.** The third of casts that land nothing is DFU's, for every caster - the player's spells and
  every foe's at the player. A school's skill that pierced it would reach every foe of level 14 and over at 100
  (`enemyEntity.js` skillsLevel: 5L + 30) and land the foes' spells at the player a third harder; a pierce for the
  player's alone is a departure from BAL2's one rule. Magnus's Gaze is the loot's, the player's alone. The owner's call.
- **The school below 100** is DFU's: the price is the skill's reward, and a steep one.
- **The other schools past 100** were left their own call (BAL9) - since made (below).
- **A Cast When Strikes spell** a weapon of mine casts on a foe is my spell: the school's potency and the loot's reach
  it as any of mine. A peer's strike spell on my foe lands at its stand-in (STRIKE-SHARED) and takes none.
- **The pool between rests** stays DFU's but for the loot: wellspring and Soul Siphon on a kill, the Ring's round, the
  Welkynd Stone, a Meditation Candle.

CHANGED SINCE - THE OTHER SCHOOLS PAST 100 (SCHOOLS2, 2026-10-13, `06-Systems/Arcane-Specialisations.md` section 4; the
owner made the call above): each pays in its own dimension by this section's law - on the caster's own body or at a
foe, never in a refereed fight, so the referee's heal ceiling (INT10's 40) is not reached. The bullet stood in the list
above until AUDIT SCHOOLS (L5) moved it out: a change is no "recorded, not changed".

Pinned: `test/systems/bal9_destruction.test.js` (6) by execution - through the real cast engine's two landing doors (the
Lich's tier 135 noted, a cast at 120 weighing 1.125, a rat's never under the quarter, an ally's and a peer's strike
spell nothing, a foe's spell on me its caster); through the real applySpell on a chargen'd mage mastered online and off
(x1, x1.17, x1.4; a damage over time's round; nothing offline, at a player's stand-in, from a peer's or a foe's cast, on a
spell saved whole, from a worn Destruction line, while mentoring); the lines' shape, picks and law; potency's 30 and the
loot's 50 and Arcane Surge's line through the damage door; wellspring's 10, the Ring's 1% and 2% and its career gate
offline and online; Magnus's Gaze 15 off the throw after its immunity, by execution at a roll of 30 (a whole save at 55,
half a hit at 40); the arcane three lawful, found among casters, in their pools. `tools/mutants/bal9.json` (24, all
dead). PIN MOVED, each by content: `castspeed` (castSpeed is followed by the two; its pick at a jewel's second of four
and a blade's fourth of five), `loot4_procs`' and `lr1_lootrarity`'s proc lists, `tech1_roster`'s last pool kind and its
law-service map (law 3, acct121), `int1_itemlaw`'s law, `lr1_lootrarity`'s and `loot3_legendaries`' Test Room (the
arcane three, last), `fb1010_truecurse`'s room order, `thunderlock`'s longsword records (Shalidor's Brand),
`serpentset`'s seed-2 broadsword (the same draw lands on potency, value 8), `dropsaudit`'s round line (its caster), and
the account service's version pins (acct121). Mutants re-aimed by content: `dropsaudit.json`'s rounds-unscaled,
`loot15.json`'s two wardrobe records, `tech1.json`'s law; the account version's five records.

THE FOUR HOSTS. None is touched by name: `scenes/hostMagic.js` is the one cast engine `scenes/exterior.js`,
`scenes/world.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` all cast and land through, and
`systems/effects.js` the one spell door.

## 16. BAL10 - the weapons' own (2026-10-17)

The owner, 2026-10-17: *"we've properly balanced mages, added a specialization tree and added the firmament system. I
want to do the same for other weapon types/classes."* The weapons' side of that ask is the martial paths and every
weapon past 100 (`05-Combat/Martial-Specialisations.md`); this section is its balance pass. THE MEASUREMENT is that
page's section 2 (read through the real cores and the swing law, Roleplay & Realism: Items on, as it ships). Asked what
the pass should cover, the owner chose all four: the weapons past 100 (MARTIAL2, that page's section 4), and three
causes the measurement found:

1. **No blow modifier ever reached a fist.** Both cores ran the port's blow modifiers on a weapon's blow
   (`combat/formulas.js` weaponAttackDamage, `combat/pcaao.js` pcaaoWeaponAttackDamage) and never on a bare hand's, so
   the Firmament's fist stars, the sets' fist-free powers and the loot's armour-and-jewellery powers did nothing for a
   monk. **THE LAW:** a player's bare-handed blow reads `entityMods.js` weaponBlowMods (weapon `null`, the host's word
   `{ unaware }`) at the weapon path's own place - after the enemy-type term - in both cores (`handToHandAttackDamage`,
   `pcaaoHandToHandAttackDamage`), and the sheet's estimate reads it too (`combat/combatStats.js`). Never the beast's
   claws (BAL6 balanced the curse on its own claws and their metal), never a foe's fists. The fists are the strongest
   family raw (19.8 a second at Hand-to-Hand 85, Strength 80, Speed 70), so the Firmament's fist channel - 28% at most
   in the Steed's sign, the blow's group cap of 30 over it (`firmamentLaw.js` blowPct) - is the most it adds, and BAL8's
   referee ceiling (`net/siege/siegeRef.js` SIEGE_HARM: 180 in 5 s) holds every refereed lane as before.
2. **The short blades swung as long blades.** The swing law's handling keys DFU's sprite type (`characters/weaponStates.js`
   SWING_HANDLING), and DFU draws the Tanto, the Shortsword and the Wakizashi as long blades: only the Dagger came round
   at 0.9, and the family that fights by speed was the slowest a second (a Shortsword 8.7 to a Longsword's 12.6).
   **THE LAW:** a weapon that swings with Short Blade takes the Dagger's row (`SWING_SHORT_BLADE`), whatever draws it -
   in the port's own law and both mods' arms (`rriRealism.js` rriMeleeWeaponAnimTime, `rrRealism.js`
   rrMeleeWeaponAnimTime, each handed the swing reader's word, `combat/swingLaw.js` readSwing's `shortBlade` - and in
   Roleplay & Realism's own arm the dagger's Speed-and-Strength blend too, AUDIT MARTIAL L2 F11: its blend kept the long
   blade's, so a Shortsword there was still 0.146 s a frame to a Dagger's 0.133). A
   Shortsword 8.7 -> 9.7 a second; still the lowest blade in an open fight - a short blade's place is the back
   (Backstabbing's x3) and the climb's pace (MARTIAL2).
3. **The Firmament's Axe and Blunt Weapon were the thinnest.** **THE LAW:** every weapon family two notables of its own,
   each raising its skill, and the Axe and the Blunt Weapon a third each (`net/firmament/firmamentTree.js`): Blade Dancer
   `{ longDmg 4, speed 2, Long Blade +4 }`, Iron Knuckles `{ fistDmg 5, strength 3, Hand-to-Hand +4 }`, Headsman
   `{ axeDmg 4, strength 3, Axe +5 }`, Bonebreaker `{ bluntDmg 4, meleeDmg 2, Blunt Weapon +5 }` - each its old stats
   whole, the skill beside them (AUDIT MARTIAL L2 F9: the first cut traded a stat for the skill, and a skill line buys
   to-hit alone, which PCAAO clamps at 97 from about 65 - section 2 of the martial page - so the trade took a stat from
   every fighter past it); Carnage `{ killHeal 2, axeDmg 4 }` (was `meleeDmg 3`), and the Ritual's
   Battlemage's Focus is its **Templar's Mace** `{ bluntDmg 5, spellPower 4 }` (was `meleeDmg 4` - the Ritual stands in PoE's Templar's place;
   the name also left the Elite Gates' Vestige of the same name its own). Stats moved, never a key nor a star: the
   layout, the keys' hash and every build code stand, and no channel of any sign passes its cap (FIRM2's own pin).

WHAT MOVES. A monk's every blow takes the Firmament's fist stars, the sets and the loot as a swordsman's does; a short
blade swings a tenth quicker; a Warrior who walks the axe or the hammer finds a skill notable and a third star of its
own, and the Ritual's spellsword a mace. Not moved: a weapon's raw damage, its reach, the bow's draw, every curse.

RECORDED, NOT CHANGED:

- **A new star a family** (the option's "keystones") would move the sky's layout, its keys' hash and every shared build
  code; the notables took the family's skill instead.
- **The two-handers lead the six raw** (a War Axe 15.2 a second, a Warhammer 15.7, a Claymore 15.5): their weight and
  their reach in the poise law (`ai/tells.js` K_BLUNT, K_AXE, K_TWO_HANDED) are the price; MARTIAL2 climbs them a little
  less than the sword.
- **Reach is one constant for every weapon** (`playerWeapon.js` WEAPON_REACH, 2.5 m) - a weapon's own reach is a design
  of its own.

Pinned: `test/systems/martial_paths.test.js` (BAL10's three by execution - the fists in both cores and the claws refused,
the handling in all three arms, the notables' stats); AUDIT MARTIAL's `test/systems/audit_martial.test.js` drives the
fists through both cores' OUTER calls with a probe that must land whole, both mods' arms as they ship (L5 H1), and the
Stats page's estimate, which now keeps nothing - no fraction carried, no next-blow window spent (`entityMods.js`
`info.estimate`, honoured by every blow modifier: L2 F7 - BAL10 had run the stateful modifiers over every roll of the
fist estimate, some five hundred a page build). `tools/mutants/martial.json` carries BAL10's records beside the
arc's. PIN MOVED: `audit_uicalm_firm1`'s walk names the Templar's Mace where it named Battlemage's Focus (its
spellPower 4 the same).

THE FOUR HOSTS. None is touched by name: both damage cores, the swing law and the Firmament's stars are every host's.

## 17. BAL11 - the hero's threat (2026-10-17)

### 17.1 What was asked

A tester's field report, from the Discord (LostMyLeg, 2026-10-17), handed over by the owner to be calculated rather
than guessed: *"it also looks like with all the systems we have in place the game gets too easy pretty early, i would
say starting around character level 10/renown 15ish... mobs dont need much more hp they prob need like 4x-6x more
damage and 2x-3x more hp. Ppl breeze through the content now. Those multipliers should also count to every type of
mobs elite etc. Thats just super rough quick math i did, iam sure maybe claude can calculate it better to make the game
a challenge again 😄 early game is fine i think (besides encountering strong revenants early)"*.

Section 1 called a multiplier on every foe's health a band-aid, and BAL3's law was that the place sets the threat,
never the player. BAL11 is a multiplier on every foe, keyed on the player - so it has to answer to the same standard:
a cause the measurement finds, a key that is that cause, and a size the measurement sets. Section 17.2 is the cause;
the key is the player's own growth (the level and the Renown that measure it); the size is section 17.3's table.

### 17.2 What was measured

`tools/heroMeasure.mjs` (seeded, 1,500 foes a cell; every figure below is `node tools/heroMeasure.mjs`). A stated
player at each level - section 2's builds at 12 and 20, extended on their slopes to 1 and 30, a longsword and seven
pieces of plate (chain under 8) of a metal stated for the level - against DFU's own encounter band at that level
(`systems/encounters.js` chooseRandomEnemy's, as weights over each table's twenty slots: the nineteen dungeon kinds and
the three temperate wilderness tables), through the real overhaul blow both ways (PCAAO and Meaner Monsters on, as they
ship). Online, the layer Renown brings: 3 health a level, the Firmament's two stars a level (a melee build's blow
channels to their 30% cap first - Riposte, Momentum and Cavalier, 13 stars - then the guard channels: blowTaken to -15%,
evade to 10%, health to its 75 and 15%), a Rare sigil's middle carried by half. The kit is the ladder's bands' middles
(a weapon line +8% from level 8 to +30% from 25; the guards 0.95 a blow from 15 to 0.8 from 25).

THE MEASURE is a kill's cost: the share of the player's health a foe takes while the player kills it (the swings it
takes times its attack's mean, over the player's health; the tempos equal), the band's mean, the geometric mean over
the tables. It is not a death rate - a player rests, drinks, casts and kites - only a ratio that moves as the player
grows.

| level (offline, the kit) | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 25 | 28 | 30 | 35 | 40 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a kill's cost | 58.6% | 49.5% | 40.8% | 35.0% | 23.8% | 13.5% | 12.1% | 9.2% | 4.1% | 3.6% | 3.9% | 4.2% |
| cheaper than at 10 | x1 | x1.18 | x1.44 | x1.67 | x2.46 | x4.33 | x4.84 | x6.35 | x14.2 | x16.2 | x15.1 | x14.0 |

The steps at 18-20 and 28 are the stated metal's (ebony, daedric); the curve under them is near enough a constant rate
- about 13% a level from 10 to 30 (x16.2 is 1.149 a level) - and flat past 30, where the encounter band (its top six
from level 16), the bestiary (level 21) and the stated skills (100) have all stopped. DFU's own world stops growing
there; the player does not, until 30.

| Renown, at a fixed level: cheaper than at 15 | 1 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| level 12 | x0.43 | x0.59 | x0.79 | x1 | x1.22 | x1.45 | x1.71 | x1.99 | x2.14 | x2.24 | x2.34 |
| level 20 | x0.50 | x0.65 | x0.83 | x1 | x1.18 | x1.36 | x1.57 | x1.80 | x1.91 | x1.98 | x2.06 |
| level 30 | x0.54 | x0.69 | x0.85 | x1 | x1.16 | x1.31 | x1.49 | x1.67 | x1.77 | x1.82 | x1.87 |

What the report felt: Renown 1 to 15 makes a kill x1.9-2.3 cheaper at the same level (the Firmament's blow cap is
reached by about Renown 8), so a level-10 Renown-15 player pays 24% of a life a kill where an offline level-10 pays
59% - the report's "starting around level 10/renown 15" is where the two curves above begin to compound. From there to
level 20 and Renown 30 the cost falls x5.6 (24% to 4.3%), and to level 30 and Renown 45, x22 (to 1.1%). The report's
own estimate (4x-6x the blows and 2x-3x the health, x8-x18 between them) is the measured x5.6-x22.

### 17.3 The law

`systems/heroThreat.js` HERO_THREAT, one table: each Daggerfall level past 10, to 30, a foe's blows land x1.07 and its
health x1.04; each Renown past 15, to 50, x1.01 and x1.005 - compounding, because the growth it answers compounds.

- **Three quarters.** The rates answer three quarters of the measured growth (its compounding: 0.75 of the level's
  0.14 a level and of Renown's 0.021) and leave the hero the last quarter, so a level-30 player is still stronger than
  a level-10 one against the same foe - never the flat world that makes a level worthless.
- **Two thirds in the blow.** The answer is split as the report split it (the blows' share 0.63 of the threat): "mobs
  dont need much more hp" - the danger is the blow, never a longer fight.
- **The top is the report's.** Level 30 and Renown 50: x5.48 the blows and x2.61 the health, the report's 4x-6x and
  2x-3x, reached at the top of the curve, not at its foot.

| level, Renown | 10, 15 | 12, 18 | 15, 22 | 18, 27 | 20, 30 | 25, 38 | 30, 45 | 30, 50 | 20, offline | 30, offline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a foe's blows | x1 | x1.18 | x1.50 | x1.94 | x2.28 | x3.47 | x5.22 | x5.48 | x1.97 | x3.87 |
| a foe's health | x1 | x1.10 | x1.26 | x1.45 | x1.60 | x2.02 | x2.54 | x2.61 | x1.48 | x2.19 |

WHOSE LEVEL. The threat is read where a foe is built, off the builder's player (`heroThreatOf`: `mentorMode.js`
effectiveLevel - a mentor's, the group's - and the page's Renown, `sigil.js` sigilRenown; no Renown while mentoring,
when the Firmament sleeps; offline the level alone). Every client builds its own copy of every foe it sees, so a foe's
blows at me are my threat's: my own foes whole, a dungeon's layout copy whole (its maximum then the host's `k`, as
SOFTCAP2's standing always was), a peer's puppet its blows alone (`{ puppet: true }` - its health is its owner's
word). The hero's health is stood on `healthMult` as well (`enemyEntity.js` applyProgressionScaling), the field
`ai/tells.js` kindHealth divides out, so a high level's foe staggers as its kind does.

WHERE IT STANDS. The seams BAL3's place runs through, into the one writer: `scenes/dungeonContext.js`
applyProgressionScalingTo (every dungeon foe - a layout foe, a quest's, a rest's ambush, a retype, a puppet) and
`scenes/exteriorFoes.js` spawnFoe's wilds arm (my foes of the wilds, off a location's ground) and its puppet arm. Every
kind, over its kind's own scale and before none of it: an elite (x5, x3) and an Elite or Super dungeon's are promoted
first, a champion, a revenant and the open zone's own after, all multiplying (BAL3's compounding). The foe's share
(BAL3's "a rat stays a rat") stops the place, never the hero: the report's "every type of mobs". The ladder's gate, as
the place's, the elites' and the champions' - the ladder off is DFU's own foes.

Never: an ally (`ally`, the record's `allied` - a summoned ally is the player's own power), the watch (`cityGuards.js`
runs no scaling), a town's or a building's ground (the wilds' arm's `inLocation`, and the pools of `worldModes.js`'s
interiors and `exterior.js`'s city hand none - BAL3's town), a tuned stage (`_heroStage`: a made level - the court,
the Hour, the Spire, `systems/madeLevel.js` - or the arena's floor; an arena bout's fighter carries its own level and
never reaches the seam), or a body the relay keeps (the gate's lords and harriers, an Elite Breach's, the Remnant -
their health already reads every fighter's level, `net/gate/gateBrain.js` dpsRef, and their blows are
`strikeDamage`'s).

THE FOUR HOSTS. `scenes/world.js` wired (the wilds, through `exteriorFoes.js`, its pool's `inLocation` the location
rect); `scenes/dungeonContext.js` wired, and through it `scenes/worldModes.js`'s dungeon mode and the standalone
dungeon; `scenes/worldModes.js` FLAGGED for its interiors - a building is a town's ground, nothing scales there by
design; `scenes/exterior.js` FLAGGED - the fixed city is a town's ground (its pool hands no `inLocation`).

### 17.4 What moves

The same fights, the threat stood on every foe through the real writer and its blows through the formula's tail
(`node tools/heroMeasure.mjs`'s third table):

| level, Renown | 10, 15 | 12, 18 | 15, 22 | 18, 27 | 20, 30 | 25, 38 | 30, 45 | 30, 50 | 20, offline | 30, offline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a kill's cost, before | 24.1% | 18.9% | 11.2% | 7.9% | 4.3% | 2.7% | 1.1% | 1.1% | 13.5% | 3.6% |
| after | 24.1% | 24.5% | 21.5% | 22.4% | 15.7% | 18.9% | 14.3% | 14.9% | 39.7% | 30.8% |
| the hero's edge over level 10, before | x1 | x1.28 | x2.16 | x3.05 | x5.61 | x8.93 | x22.3 | x22.9 | x4.33 | x16.2 |
| after | x1 | x0.99 | x1.12 | x1.08 | x1.54 | x1.28 | x1.68 | x1.61 | x1.47 | x1.90 |

(Offline the edge is over an offline level 10, 58.6%.) A kill costs between a sixth and a quarter of a life from
level 10 to 30 where it fell to a hundredth; the hero keeps a 1.1x-1.9x edge, rising with the level (the stated metal's
steps make it uneven, not the law). Nothing moves at or under level 10 and Renown 15 - the report's "early game is
fine".

### 17.5 Recorded, not built

- **The kit is the ladder's middles.** A player in a BAL7 kit (Legendaries, the guards, a set) still wins far more
  than the stated one - the guards compose with no overall ceiling (BAL7, recorded). Reading the player's own kit would
  punish finding it; if the field still breezes past BAL11, the guards are the next measurement.
- **A caster in robes** takes the blows' share harder than the stated plate wearer; the Firmament's guards, Shield and
  range are the answer the game already has. A watch item.
- **Companions take a foe's blows at its scale**, as they take an elite's x3 and the place's: a sworn revenant yields
  and a crew companion is knocked down sooner at a high level; their own health does not read the hero.
- **A party's health is the builder's.** A dungeon's foes stand at the host's level (a guest's copy takes the host's
  `k`), an outdoor foe at its owner's; the blows at each player are that player's own. PSCALE1's toughness and blows
  compound on it.
- **Renown and the kill.** A kill pays Renown by the foe's level (`net/renown.js`), unchanged - a level-30 kill takes
  up to x2.6 the swings for the same XP. The grind's pace is RENOWN-ACCOUNT's call, not this one's.
- **The open zone and a revenant's rank** compound with the hero as they compound with the place. The zone's x4 (its
  rings x1.25-x2 over it) was the owner's word over DFU's own foes; at level 30 and Renown 50 its foes hit x27-x44 DFU's.
- **FULL-GUARD** (section 4) fires more often at the top - a foe's one blow from full leaves a player at 1, and the
  next kills, as it always has.
- **A town's and a building's ground** stay unscaled (BAL3's law). A quest's foe in a building, a night street's
  thief, the watch, and a raid on a town (World Events' raiding party stands in the town's rect): DFU's own, or their
  own law's (a class foe still stands at the player's level). A raid's threat is the raid's own call.
- **Master Skills' veteran** (online always) answers the skills' climb from 75 to 100, which the stated builds' growth
  holds too, and stands beside the hero rather than inside it: where it outweighs the place (a high-share dungeon), at
  most about x1.13 the health at level 30 in a Crypt (0.88 x 0.6 of the veteran row against the Crypt's 0.36), nothing
  at level 20 there. The overcap - the climb past 100 - is outside the measurement and answers itself, as it did.
- **The open world's puppets take no place** (section 8) - they take the hero's blows now, at my threat, the place
  still not.

Pinned: `test/systems/bal11_hero.test.js` (8) by execution - the law's table literal and the measured ladder's points
(nothing at or under 10 and 15, x1.07 and x1.04 a level, x1.01 and x1.005 a Renown, compounding, the top held at 30 and
50, whole levels, nothing for anything not a number, the blows' share 0.633); progressionScaling's `hero` (onto the
place and the veteran, alone where neither stands, a rat's share stopping the place and never the hero, never under 1,
no skill and no challenge level); the one writer (the poise the kind's, an elite compounding, `progression.hero`); the
reader (the level offline, the Renown online, a mentor's group level and no Renown, a puppet's blows alone, the ladder
off nothing); the wilds' pool on a crafted MONSTER.BSA (the place x the hero, Renown 50, an elite under it, nothing on a
location's ground, for an ally or with the ladder off; a peer's puppet at my blows and its own health, nothing at level
10 or on a location's ground); the dungeon's seam mounted (a cave the hero alone, a Den x2 under it, a puppet, an ally,
the court, the Hour, the Spire and the arena's floor, the ladder off, level 10); the seams and the four hosts by
source; both doors - a 10-point spell 20 at level 20 (`effects.js` casterDamageScaled) and 300 seeded blows through
`calculateAttackDamage`'s tail at exactly the scale. `tools/mutants/bal11.json` (34, all dead). PIN MOVED:
`bal_arc`'s wilds pool stands its player at level 10 (the place alone, where the hero pays nothing), its seam's source
pins and its mounted seam carry the hero; `arena2_seams`'s call names the ally; three `bal.json` records re-aimed by
content (BAL3-the-place-alone-scales-nothing, -the-dungeon-needs-a-share, -the-dungeon-drops-the-place). Ledger A
(BAL11).

# The Balance arc - the place sets the threat, one rule for every striker (BAL1-BAL4)

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

## 10. What shipped

All four slices in one pull request, each with its pins and mutants (`test/bal_arc.test.js`, 10 tests;
`tools/mutants/bal.json`, 45 mutants).

**BAL1** - `combat/pcaao.js` pcaaoAlterDamageBasedOnWepCondition and pcaaoAlterArmorReducBasedOnItemCondition take
`sharpEdge` (default on: the mod's); the blow, `condOf` and `combat/combatStats.js` hand
`modules.equipmentDamageEnhanced`. Pinned: every band at 0-100% both ways, edged and blunt, weapon and armour; through
`pcaaoAttackDamage` (400 seeded swings of a fresh longsword at an Orc Warlord: x1.3 with the wear, x1 without; a
foe's blow on fresh plate: more taken without the wear's 0.85); the stats card's headline swing (x1.3 / x1).
`test/pcaao.test.js` (the mod's own numbers, its wear on) unmoved.

**BAL2** - one line for the hit (`chanceToHitMod = Math.ceil(F(skill(attacker, skillID) * F(1.5)))`), one roll for the
crit (`crit / (4 - luckTerm)`), one multiplier and aim (`1 + floor(crit / 5) * 0.05`, `+floor(crit / 4)`), one classic
arm without the module (`crit / 3` for `+crit / 3`). Pinned by execution: a class foe's landing over a hundred
evenly spaced rolls on a bare player (Long Blade 20: 62; ten more skill, fifteen more to hit; the 97 clamp), its crit
doubling a blow (10 -> 20) at the player's quarter (0.24 crits, 0.25 does not), and a crit's +25 to hit on a player
who dodges at 100 (the 3% floor -> 25). PIN MOVED in `test/pcaao.test.js`: a monster's classic crit roll (crit/3 for
+crit/3) and its divisor (90 / (4 - 2) = 45%). PIN MOVED by the full suite: two overhaul blows whose first roll is a
monster's crit (`audit39_combat`, `diseases`: 2 x 1.2 = 2.4 -> 2 is now 2 x 1.4 = 2.8 -> 3), and CI's
`wear_vanilla` - an armed Knight's 300 blows on iron plate fall under 5 damage 29 or 52 times by the spawn's own
`Math.random` draw (it was 80 or 105), so its "both kinds of blow land" floor is 20 where it was 30 (a 50% red on CI;
the test's 21 mutants still die).

**BAL3** - `systems/skillSoftcap.js` PLACE_THREAT, placeVeteran, wildernessThreat and progressionScaling's `place`;
`characters/enemyEntity.js` records `progression.place`; the two seams gated on `lootRarityOn`. Pinned: the numbers
and the section 5 table; every dungeon kind at its ladder tier; the max rule, the foe's share, the clamp, the overcap,
three arguments SOFTCAP2's own; the wilds by execution (a crafted MONSTER.BSA, an Orc Warlord at midnight: x1.214
health with the ladder, DFU's with it off or on a location's ground); the dungeon's seam and the four hosts by
source (world.js's wilds pass the location rect; exterior.js's city and worldModes.js's interiors pass none).

**BAL4** - `systems/eliteFoes.js` elitesAllowed; `systems/features.js` 'enhanced-ai' `initial: true`; `systems/uiPrefs.js`
PREF1_ADOPT_NEW_DEFAULT; `ui/deathScreen.js` `rises` and riseHint, `ui/enhancedDeath.js` deathKeys' Rise; the hosts'
`rises` (`world.js`, `worldModes.js` and its dungeon opts, `dungeonContext.js`); `legacyDeathReset`; Privateer's Hold;
`systems/deathPenalty.js`'s header. Pinned: elites by the ladder and the lane, and the open world's own roll by
execution; the AI's default, the brain's and the cover's switch; the death cost by execution (a rising screen states
34 of 345 and the respawn takes it from a purse that grew; no rise, nothing; online, the room's), the plates and the
line. PIN MOVED: FT5's row; FT18's online lock (on the dungeon sizes' row, the forced row that still ships Off);
UXB1-E's card (the player's own Off); PREF1's control; deathpenalty (2), AUDIT 28 B5, FEUD H2, LEGACY B5, D-ONLINE1
(3), FIX-E (2), AUDIT 21 F6, DISC19-C. Made explicit (the classic motor): enemymotor, FALL-HOLD, CRATE-FREE. Mutants
re-aimed by content: `bounty1.json` DEATH-PENALTY-3 and -5, `legacy1.json`'s street reset.

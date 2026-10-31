# Fixed PvE - the world sets the foe (FIXED-PVE, 2026-10-28)

The PvE overhaul replaces player-scaled foes with fixed ones: a foe's level, health and blow come from its own
template, never from the player who meets it. This page holds Stages 2 to 8 of twelve: the data, the balance tools, how a creature meets a player, where it lives, how a fight is built and paid, the zones and populations, and the template foe in the open world. Nothing in the game
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
| Standing | `pveStanding.js` | Stage 4: the state a creature meets a player in, what a blow on it costs, the services it offers (section 6) |
| Bestiary | `pveBestiary.js` | Stage 5: where each species lives, by province, region, climate, dungeon type, faction and need (section 7) |
| Encounter | `pveThreat.js`, `pveContribution.js`, `pveEncounter.js` | Stage 6: whom a foe fights, who earns the kill, the encounter director and who joins a fight (section 8) |
| Population | `pveZones.js`, `pveSpawnTable.js`, `pvePopulation.js`, `pveGrant.js` | Stage 7: the fixed-level zones, a place's spawn table, the manager that keeps a cell's count, and the spawn grant that stands a template (section 9) |
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

## 6. Stage 4: how a creature meets a player (2026-10-30)

One law for hostile, neutral and friendly creatures, in `pveStanding.js`, still behind the switch. `effectiveDisposition`
reads, in order: an event's word, a blow on the creature or its kin, a crime against its faction, the player's standing
with its faction, then the template's start (a wildlife way's, if it has one). The standing is the game's own reputation
(`systems/faction/factionRep.js` `getReputation`): the orc clans read Orsinium, FACTION.TXT #358. At -20 or under its
members fight; at 20 or over, or as an ally, they are friendly, and a hostile clansman only stands down. Bandits are an
outlaw band: no standing moves them. A territorial creature warns inside 20 m and fights inside 10 m or after 4 s of
warning; a neutral or friendly one starts nothing (`neutralAction`).

| A blow on | Is | Costs |
|---|---|---|
| A protected creature | `protected` | Assault, or Murder for a kill (`systems/crimes.js`), -5 or -15 standing, its services close |
| A faction's member | `factionMember` | -5 or -15 standing, its services close |
| A foe, wildlife, an outlaw, or one that struck first | `foe`, `hunting`, `selfDefence` | Nothing |

A kill pays by how the creature started (`killShare`): a foe or wildlife whole, a peaceful one a quarter, a protected one
nothing - so farming the peaceful never beats hunting the hostile. A service needs the creature out of a fight and the
standing it asks (`SERVICE_REP`: trade 0, quest 10, train 20, hire 30). A group marked `community` holds no member that
starts hostile; the first is the Orc Stronghold. Daggerfall Unity's monsters are all hostile and its people all peaceful.
The tests: `test/systems/pve/pve_standing.test.js`.

## 7. Stage 5: where a species lives (2026-10-30)

`pveBestiary.js` holds one record a species, still behind the switch. A record says how the species stands in each of the
nine provinces (`world/tamriel/tamrielGeography.js`) or a game region: primary 1, secondary 0.4, localized 0.6,
conditional 0.3, exceptional 0.02 of a spawn table, or unavailable. Outdoors it lives only in its climates
(`formats/mapsTables.js` CLIMATES); in a dungeon only in its dungeon types (`formats/mapsFile.js` DUNGEON_TYPES). A need
(night, an incursion) or a faction's presence must be met. So the orcs are primary in the Orsinium Area (region 26), secondary in
High Rock and Skyrim, conditional elsewhere, and absent where no clan holds the place; a werewolf walks only by night.

The placements are a first pass from the spec's matrix and the climates each body suits. A record is established where
Daggerfall names it (Orsinium, a crypt, a harpy nest), else inferred; a proposed one may not be primary or secondary. A species the spec names with no art keeps a record and spawns
nowhere. `regionalSpecies` and `regionalTemplates` read the place alone, sorted by key, so every player gets the same
list. Daggerfall Unity picks a foe from a climate's or a dungeon's encounter table, with no provinces and no factions.
The tests: `test/systems/pve/pve_bestiary.test.js`.

## 8. Stage 6: threat, contribution, the director and who joins (2026-10-30)

Still behind the switch, and no relay change yet: the authority that hears a foe's blows will keep these tables when
spawns turn on (Stage 7). Threat (`pveThreat.js`) steers a foe: damage counts whole, healing half split over the foes in
the fight, a hold or stun 30, a taunt puts the taunter 10% over the top for 4 s. A foe turns only when a challenger passes
its target by 10% within 4 m or 30% further off, never to a player it cannot reach, and an idle player fades out after
10 s.

Contribution (`pveContribution.js`) pays the kill and nothing else: damage up to the foe's health in all, healing
of a player in the fight, damage soaked, interrupts. A qualifier acted within Renown's 30 s assist window
(`net/renownTracker.js` RENOWN_ASSIST_MS) and earned 5% of the points. A world boss, a raid or a public event gives each
qualifier a roll; any other kill goes to the party, or lone player, that earned most.

The director (`pveEncounter.js` `directEncounters`) builds a place's encounters from the bestiary, the zone's level band
and a seed from the place's key - never a player, a Combat Score or a party size. Peaceful and protected creatures are
ambient unless an event turns them; a community never becomes an encounter. Every harmful ability must give a 0.3 s tell,
0.8 s for an area strike.

When a creature is struck its own group joins within 40 m; within 20 m its faction's kin join if
already hostile, its guards if the blow wronged the faction. A shared species alone brings nobody, at most 6 join, and a
joiner calls no one. Party scaling (`systems/party/partyScale.js`) is for today's foes; a template foe's difficulty is its
composition. Daggerfall Unity has one player and none of this. The tests: `test/systems/pve/pve_encounter.test.js`.

## 9. Stage 7: zones, spawn tables and the population manager (2026-10-30)

Still behind the switch. A zone (`pveZones.js` `pveZoneAt`) is one of six fixed bands, 1-8 up to 36-45, each
overlapping the next. CENTER-HARDEST (the owner, 2026-10-30: "every area has a starting area", "center is hardest",
"look where people spawn"): each of the ten areas is lowest where its new characters wake (`starts.js` STARTS: a
province's start near its capital; the Bay, High Rock and Hammerfell at Privateer's Hold) and climbs toward the Imperial
City. A place's progress is its distance from the start over that plus its distance to the center, cut into six even
bands, so the back country stands mid-way and the center at the top. Cyrodiil, whose start is the center, reads its
distance against the others' mean reach and stands high throughout.

SAFE-ROAD ("make the road safe out of the pvp
zone", "enemys avoid roads"): the Imperial start wakes at the center, so Cyrodiil's roads hold no hostile population
and foes keep off them; a new character is under the PvP zone's level 30 and walks out on them.

REGION-HOTSPOT (the owner, 2026-10-30: "every region need to have enemy to fight for all leveling in that region";
2026-10-31: "needs to have hot spot of 45 that circles out to 30-34, 20-10, 10-1", "only need 3 spots in total, region
need to be a lot more free for lower level to travel"): each of the ten areas has three hot spots (`pveZones.js`
`areaHotspots`). The first stands as far from the area's start as its land allows, each next as far from the start
and the ones before; the heart's first is the Imperial City. On the Bay they may stand on a region's heart, its land
farthest from its edge and the sea (`pveHotspots.js`, measured from MAPS.BSA by `tools/pveHotspots.mjs`); past the
Bay on a district's middle, by the province map.

A place's rung is 1 on its nearest hot spot and 0 at 120 pixels: 36-45 on it, a band lower each sixth of the way out,
and 1-8 everywhere outside. Toward the center the rings widen. On the Bay the three stand in Gavaudon, Antiphyllos and
Kambria, and 76% of the land is 1-8. The first pass's district step is gone: it broke the rings.

Four districts in a hundred are high-level enclaves, three bands up, with a warning; ten are farming grounds. The party
zone is the heart's ring on the top band. A town is safe, a dungeon is one band deeper and the old and undead ones two.
The recommended Combat Score is advice and changes no foe.

A spawn table (`pveSpawnTable.js`) follows the spec's six steps: place, bestiary, hour and event and factions, band,
then the populations - settlement (a community group), ambient, farming, encounter, group, road patrol and rare. A
town holds no hostile population unless an event turns it. The table reads the place alone.

The manager (`pvePopulation.js`) wakes a cell with fixed slots: each stands one foe at a time, so the count never
grows with the crowd. A fallen slot waits its population's time (a minute on a farming ground, an hour for a rare
foe), and its next foe is drawn from the slot's name and turn, the same on every machine. A cell unseen for five
minutes sleeps; its waits and a lasting death outlive the sleep. Daggerfall Unity spawns round the one player and keeps
no cell. The tests: `test/systems/pve/pve_population.test.js`.

A spawn grant (`pveGrant.js`, `11-Multiplayer/Spawn-Grants.md`) stands a template once the world hands the grant host a
table (`scenes/grantHost.js` `tableAt`; none while the switch is off). An `encr` grant's member is drawn from the
table's plain foes with its own species die, a camp's from the seed's group member by member, so the owner and every
reader stand the same template. Its level, health and blow are the template's: the owner's signed level and party never
move them, and a reader refuses a record whose body or level differs, with no slack. Who holds a place is a first pass
(`factionsHolding`): outlaws every road and wild, the clans Wrothgar and their strongholds. Daggerfall Unity rolls a
climate's table at the player's level. The tests: `test/systems/pve/pve_grant.test.js`.

## 10. Stage 8: the template foe in the open world (2026-10-30)

Still off: the world hands the grant host no table yet, so no foe below stands. The open world's pool
(`scenes/exteriorFoes.js` spawnFoe) asks the grant host for a template: my own encounter's from my `encr` grant
(`templateOf`), a peer's foe from its owner's grant once judged here (`puppetTemplate`). A template foe is built at its
own level and `standTemplate` (`pveGrant.js`) sets its health and blow. Every blow it lands is a roll in its range
(`combat/formulas.js`, before an elite's or champion's scale), and the player's progression scaling, hero threat and the
party's weight on its health and blows are skipped.

Before the switch turns on: the world passes `tableAt` (`scenes/world.js` builds the grant host, and `bootWorld` stands at
its ceiling); a camp's members and a dungeon's foes stand templates; a template's spells take its range too; and a
peer's foe that arrives before its grant is judged stands as it would today. Daggerfall Unity levels a class foe by the
player (`EnemyEntity.SetEnemyCareer`). The tests: `test/systems/pve/pve_grant.test.js`.

The roster (2026-10-30) fills the bands: 81 templates and 10 groups. Outlaws stand in six tiers from Footpad (level 3)
to Raider King (44), with a band of five for each tier from 12 up, so every province, land climate and band holds plain
foes and a group where outlaws hold the land (a test walks all of it). Beasts stand by their climates, the dead and the
conjured in their dungeons, the Daedra at an incursion. Gaps left: harpy nests, giant strongholds and scorpion nests hold
no hostile template, and above level 30 the wild is mostly outlaws. The names stand in English until the switch turns on.

## 11. Stage 9: elites and revenants on templates (2026-10-30)

An elite template stands at a fixed rank over its template (`pveGrant.js` ELITE_RANK): two levels, two and a half times
the health, half again the blow, in place of the street elite's five and three (`systems/eliteFoes.js`
promoteEliteFoe). A Strong, Elite or Champion template is a leader already and never rolls one (`templateMayBeElite`).
A template shows its own name, and the outlaw leaders stand on the Knight body.

A revenant minted from a template foe keeps the template's key (`revenant.js`, `tpl`). It comes back as that template a
level higher per rank, its rank's health and blows on top (`revenantTemplate`), and its band is the rest of the group
it fought in, at the templates' own levels (`templateBand`), never the player's level minus two. A revenant from before
the switch stands as today. Daggerfall Unity has no elites or revenants. The tests: `pve_grant.test.js`.

## 12. The backstab on a template foe (2026-10-30)

Daggerfall's backstab triples a blow from behind on any swing (`combat/formulas.js` backstabDamage), and against fixed
health a sneak would triple most of a fight. On a template foe the triple lands only as an opener, on a foe that has
not seen the striker; once it fights, a backstab is half again (`systems/pve/pveBackstab.js`). One backstab takes at
most 40% of a leader's health (Strong, Elite, Champion). A player, a duel and every foe that is no template keep the
triple. Daggerfall Unity triples every landed backstab (`FormulaHelper.CalculateAttackDamage`). The tests:
`test/systems/pve/pve_backstab.test.js`.

## 13. Spells read the school, not the level (SPELL-SKILL, 2026-10-30)

Daggerfall Unity rolls every magnitude, duration and chance off the caster's level (`BaseEntityEffect`), so a level 45
with a weak school casts like a master. Under fixed PvE my own spell reads each effect's school: cast level is its live
skill / 2.2, so skill 100 is level 45 (`systems/spell/castLevel.js`). Past 100, damage keeps climbing under the PvE and
PvP holds, heal and buff points climb at half speed, and durations and chances stop. Monsters, worn items, a turned-back
spell and the PvP bar keep the caster's level. `systems/effects.js` applySpell reads the levels per effect.

The Magicka cost follows that power (`systems/spellcost.js` skillPricedCost): half the classic price at skill 50, grown
with the mean of the effect's components against skill 100, by its square root past 100, less up to 25% for skill.
Crit is never priced. A pool grows half a per cent for each point of the best magic school (`spell/skillPool.js`). The spellmaker's budget holds a made effect's per-level growth to the fastest stock spell's (10
magnitude, 5 rounds, 15%), and a spell does one damage each to health, fatigue and magicka. Neither rewrites a saved
record. Gold stays the classic price, the same at every skill. The simulator pays spells from a pool when asked
(`pveSim.js` simulate's `magicka`). The tests: `test/systems/pve/pve_castlevel.test.js`.

## 14. A template foe's drop leans to its killer (SKILL-LEAN, 2026-10-30)

The owner: "as they are higher tier area they have better leaning skill gear", "to their highest skills", "for all
weapons armor jewelry"; 2026-10-31: "clothing need to lean as well". A template foe's body and kit roll inside
`withSkillLean` (`loot/lootSkillLean.js`) at the foe's own level: the first skill lines of each weapon, armour piece,
piece of jewellery and garment take the roller's best trained skills in order (`lootPowers.js` `bestSkills`). One line
leans to level 11, two to 27, three from 28. The other lines and the values roll as ever. With the switch off no foe
carries a template, so nothing leans. Daggerfall Unity's items have no lines. The tests:
`test/systems/loot/skilllean.test.js`.

The steps sit a band ahead (the owner: "adjust lean so player start farming gear for the nest area tto pushj up").
Players craft gear to about 30 ("we want them to make gear for say 30"), then better it with leaned drops from harder
zones and honing. Only drops lean: an Imbue stays random (the owner: "its a random"). The reference gear skill
(`pveBuilds.js` `TIERS`) is +375 at 40, the plain enchanted base kit, and +575 at 45, inside the owner's "500-650 rang".

## 15. A template foe's metal follows its level (FOE-METAL, 2026-10-30)

The owner: "material also need to follow a scale", "around 20-30 daedric need to be 7% drop like vanilla". A template
foe's whole loot chain (`hostCombat.js` `spawnEnemyLoot`) runs inside `withFoeMaterialLevel` (`combat/enemyEquipment.js`)
at the foe's fixed level. Every material roll under it reads Daggerfall Unity's own `RandomMaterial` and
`RandomArmorMaterial` at that level, and Unleveled Loot is passed by, so the metal climbs with the zone. The curve's
Daedric is set aside: "smaller weapon roll, more armor" - a weapon and an armour piece are each Daedric at 0.47% a level
past 10 (`foeDaedricChance`): none to 10, about 4.7% at 20, 7% at 25, 9.3% at 30 and 16% at 45. Other foes keep
Unleveled Loot. The tests: `test/systems/loot/foemetal.test.js`.

## 16. Groups are one player's pack, and the heart is for parties (GROUP-SOLO, GROUP-PARTY, 2026-10-30)

The owner: "make sure a lvl 45 can grind groups in the 45 area", "lower need to be able to grind groups", "we need an
area above that for group", "that way each band can be grinded by a lower group if needed". A camp's members stand as a
pack (`pveGrant.js` `grantTemplateFoe`): their health and blow are cut by `packShare` so the whole group weighs
`GROUP_SOLO_WEIGHT`, one and a half Normal foes of its level. In the simulator every build alone beats every group at
its own level 75-100% of the time, in 4-13 seconds, so a lower party can grind a band above it. Members keep their
level, and an encounter is no pack.

The heart's inner ring (`pveZones.js` `PARTY_ZONE_FROM`, 0.9 of the road to the Imperial City, wild and dungeons) is the
party zone: the owner, "they need to grind lvl 50 monsters in group as 45", "an area they have to group", "groups need
to be able to do high packs". Every foe there stands whole at level 50 (`PARTY_FOE`: a level 45's health half again, its
blow a quarter more) and the zone warns. Four level 45 players grind any group there, three sometimes, two never. Daggerfall Unity has no groups. The tests: `pve_grant.test.js`, `pve_population.test.js`.
